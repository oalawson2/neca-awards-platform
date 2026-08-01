import { store } from "@/lib/mock/store";
import type { PlatformUser } from "@/types/domain";

/** Secretariat and Jury accounts only — Applicants self-register (see lib/auth/actions.ts). */
export async function getStaffAndJurors(): Promise<PlatformUser[]> {
  return store.users.filter((u) => u.role === "secretariat" || u.role === "jury");
}

/** Jurors assigned to a sector (many-to-many via jurorAssignments). */
export async function getJurorsForSector(sectorId: string): Promise<PlatformUser[]> {
  const jurorIds = store.jurorAssignments.filter((a) => a.sectorId === sectorId).map((a) => a.jurorId);
  return store.users.filter((u) => jurorIds.includes(u.id));
}
