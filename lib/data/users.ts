import { store } from "@/lib/mock/store";
import type { PlatformUser } from "@/types/domain";

/** Secretariat and Jury accounts only — Applicants self-register (see lib/auth/actions.ts). */
export async function getStaffAndJurors(): Promise<PlatformUser[]> {
  return store.users.filter((u) => u.role === "secretariat" || u.role === "jury");
}

/** The panel (if any) a juror belongs to — panels are fixed at 3x3, assigned separately from invites. */
export async function getPanelForJuror(jurorId: string) {
  return store.panels.find((p) => p.jurorIds.includes(jurorId)) ?? null;
}
