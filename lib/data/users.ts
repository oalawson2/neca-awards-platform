import { createClient } from "@/lib/supabase/server";
import type { PlatformUser } from "@/types/domain";

/**
 * Secretariat and Jury accounts only — Applicants self-register (see
 * lib/auth/actions.ts). PlatformUser.role only has 3 values
 * (applicant/secretariat/jury) predating the real 4-value role enum;
 * secretariat_super_admin maps to role="secretariat" + isSuperAdmin=true,
 * same convention the UI already used before this was real data.
 *
 * "status" is always "active" here — the real schema has no "invited but
 * not yet accepted" signal without an extra admin API call per user
 * (auth.users.email_confirmed_at, not exposed to the regular client), so
 * that distinction is dropped rather than faked.
 */
export async function getStaffAndJurors(): Promise<PlatformUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["secretariat", "secretariat_super_admin", "jury"]);
  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
    role: p.role === "jury" ? "jury" : "secretariat",
    status: "active",
    isSuperAdmin: p.role === "secretariat_super_admin",
  }));
}

/** The panel (if any) a juror belongs to. */
export async function getPanelForJuror(jurorId: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("panel_memberships")
    .select("panel_id, panels(panel_number)")
    .eq("juror_id", jurorId)
    .maybeSingle();
  if (!data) return null;

  const panel = Array.isArray(data.panels) ? data.panels[0] : data.panels;
  if (!panel) return null;
  return { id: data.panel_id, name: `Panel ${panel.panel_number}` };
}
