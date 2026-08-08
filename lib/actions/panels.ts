"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";

export interface PanelActionResult {
  success: boolean;
  error?: string;
}

/** RLS (panels_write_secretariat etc.) allows either secretariat tier, not just super admin — verified directly against pg_policies. */
async function requireSecretariat(): Promise<PanelActionResult | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can manage panels." };
  }
  return null;
}

/**
 * Bootstraps the 3 fixed panel shells (panel_number 1/2/3) — the real
 * `panels` table starts empty by design (no fabricated seed data; see
 * task #48's commit notes), so this exists as a Secretariat-initiated
 * action a real user clicks, not something inserted on their behalf.
 * Idempotent — a no-op once the 3 rows already exist.
 */
export async function ensurePanelsExist(): Promise<PanelActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { count } = await supabase.from("panels").select("id", { count: "exact", head: true });
  if (count && count > 0) return { success: true };

  const { error } = await supabase.from("panels").insert([{ panel_number: 1 }, { panel_number: 2 }, { panel_number: 3 }]);
  if (error) return { success: false, error: "Could not create panels." };

  logAction("Secretariat", "Created the 3 jury panels", "");
  revalidatePath("/secretariat/panels");
  return { success: true };
}

export async function assignSectorToPanel(panelId: string, sectorId: string): Promise<PanelActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("panel_sector_clusters").insert({ panel_id: panelId, sector_id: sectorId });
  if (error) {
    if (error.code === "23505") return { success: false, error: "This sector is already assigned to a panel." };
    return { success: false, error: "Could not assign sector." };
  }

  logAction("Secretariat", "Assigned sector to panel", panelId);
  revalidatePath("/secretariat/panels");
  return { success: true };
}

export async function unassignSectorFromPanel(panelId: string, sectorId: string): Promise<PanelActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  await supabase.from("panel_sector_clusters").delete().eq("panel_id", panelId).eq("sector_id", sectorId);

  logAction("Secretariat", "Removed sector from panel", panelId);
  revalidatePath("/secretariat/panels");
  return { success: true };
}

/** panel_memberships is unique on juror_id — a juror belongs to exactly one panel, enforced by the database itself. */
export async function assignJurorToPanel(panelId: string, jurorId: string): Promise<PanelActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("panel_memberships").insert({ panel_id: panelId, juror_id: jurorId });
  if (error) {
    if (error.code === "23505") return { success: false, error: "This juror already belongs to a panel — remove them first." };
    return { success: false, error: "Could not assign juror." };
  }

  logAction("Secretariat", "Assigned juror to panel", jurorId);
  revalidatePath("/secretariat/panels");
  revalidatePath("/secretariat/users");
  return { success: true };
}

export async function removeJurorFromPanel(jurorId: string): Promise<PanelActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  await supabase.from("panel_memberships").delete().eq("juror_id", jurorId);

  logAction("Secretariat", "Removed juror from panel", jurorId);
  revalidatePath("/secretariat/panels");
  revalidatePath("/secretariat/users");
  return { success: true };
}

/**
 * Records a conflict of interest (doc section 11.5): either the juror is
 * excused from one specific applicant's review (the other panel members
 * cover it), or reassigned away from a sector cluster entirely for the
 * cycle. juror_conflicts has no real-schema equivalent (a new table
 * added this pass — see the migration) since panel independence and
 * conflict tracking are core integrity features, not optional.
 */
export async function recordJurorConflict(input: {
  jurorId: string;
  applicationId: string | null;
  reason: string;
  resolution: "reassigned_panel" | "excused_from_applicant";
}): Promise<PanelActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;
  if (input.resolution === "excused_from_applicant" && !input.applicationId) {
    return { success: false, error: "Select an applicant to excuse this juror from." };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("juror_conflicts").insert({
    juror_id: input.jurorId,
    application_id: input.applicationId,
    reason: input.reason,
    resolution: input.resolution,
    created_by: user?.id,
  });
  if (error) return { success: false, error: "Could not record conflict." };

  logAction(user?.fullName ?? "Secretariat", "Recorded conflict of interest for", input.jurorId);
  revalidatePath("/secretariat/panels");
  return { success: true };
}
