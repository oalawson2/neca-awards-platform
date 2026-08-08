"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";

export interface WinnerActionResult {
  success: boolean;
  error?: string;
}

async function requireSecretariat(): Promise<WinnerActionResult | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can confirm winners." };
  }
  return null;
}

/** One winner per sector — confirming a new one un-confirms any previous winner in that sector (reverts them to stage2_scored). */
export async function confirmSectorWinner(applicationId: string): Promise<WinnerActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return { success: false, error: "Application not found." };
  const { data: org } = await supabase.from("organizations").select("name, sector_id").eq("id", app.organization_id).maybeSingle();
  if (!org) return { success: false, error: "Organisation not found." };

  const { data: sectorApps } = await supabase
    .from("applications")
    .select("id, organizations!inner(sector_id)")
    .eq("status", "sector_winner")
    .eq("organizations.sector_id", org.sector_id);
  for (const other of sectorApps ?? []) {
    if (other.id !== applicationId) await supabase.from("applications").update({ status: "stage2_scored" }).eq("id", other.id);
  }

  const { error } = await supabase.from("applications").update({ status: "sector_winner" }).eq("id", applicationId);
  if (error) return { success: false, error: "Could not confirm winner." };

  const user = await getCurrentUser();
  logAction(user?.fullName ?? "Secretariat", "Confirmed sectoral winner:", org.name);
  revalidatePath("/secretariat/winners");
  return { success: true };
}

/**
 * Step 1 (doc section 11.6): once every panel has named its sectoral
 * winner(s), ALL of them become finalists — no top-5 cut, however many
 * sectors there are.
 */
export async function conveneEmployerOfYear(): Promise<WinnerActionResult & { finalistCount?: number }> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: winners } = await supabase.from("applications").select("id").eq("status", "sector_winner");
  if (!winners || winners.length === 0) return { success: false, error: "No sectoral winners have been confirmed yet." };

  const { error } = await supabase
    .from("applications")
    .update({ status: "eoy_finalist" })
    .in("id", winners.map((w) => w.id));
  if (error) return { success: false, error: "Could not convene the Employer of the Year round." };

  const user = await getCurrentUser();
  logAction(user?.fullName ?? "Secretariat", "Convened Employer of the Year round with", `${winners.length} finalists`);
  revalidatePath("/secretariat/winners");
  revalidatePath("/jury");
  return { success: true, finalistCount: winners.length };
}

/**
 * Step 5 (doc section 11.6): a human decision, presented to the
 * Chair/co-chair — never auto-finalized from the ranking alone. No real
 * table exists for a separate "validation" record (validatedByUserId/
 * validatedAt in the mock's EmployerOfYearValidation) — this action's own
 * audit_log entry (once task #55 lands) is the record of who confirmed
 * and when; the application reaching status='eoy_winner' is itself the
 * validation signal (see lib/data/winners.ts's getEmployerOfYearValidation).
 */
export async function validateEmployerOfYearWinner(winnerApplicationId: string, _validatedByUserId: string, validatedByName: string): Promise<WinnerActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", winnerApplicationId).maybeSingle();
  const { data: org } = app ? await supabase.from("organizations").select("name").eq("id", app.organization_id).maybeSingle() : { data: null };

  const { error } = await supabase.from("applications").update({ status: "eoy_winner" }).eq("id", winnerApplicationId);
  if (error) return { success: false, error: "Could not validate the winner." };

  logAction(validatedByName, "Validated Employer of the Year:", org?.name ?? winnerApplicationId);
  revalidatePath("/secretariat/winners");
  return { success: true };
}
