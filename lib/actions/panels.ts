"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

export async function assignSectorToPanel(panelId: string, sectorId: string) {
  const panel = store.panels.find((p) => p.id === panelId);
  const sector = store.sectors.find((s) => s.id === sectorId);
  if (!panel || !sector) return { success: false, error: "Panel or sector not found." };

  if (store.panelSectorAssignments.some((a) => a.panelId === panelId && a.sectorId === sectorId)) {
    return { success: false, error: "This sector is already assigned to this panel." };
  }
  const elsewhere = store.panelSectorAssignments.find((a) => a.sectorId === sectorId);
  if (elsewhere) {
    return { success: false, error: "This sector is already assigned to another panel — remove it there first." };
  }

  store.panelSectorAssignments.push({ panelId, sectorId });
  logAction("Funke Adeyemi", `Assigned ${sector.name} to`, panel.name);
  revalidatePath("/secretariat/panels");
  return { success: true };
}

export async function unassignSectorFromPanel(panelId: string, sectorId: string) {
  store.panelSectorAssignments = store.panelSectorAssignments.filter(
    (a) => !(a.panelId === panelId && a.sectorId === sectorId)
  );
  const panel = store.panels.find((p) => p.id === panelId);
  const sector = store.sectors.find((s) => s.id === sectorId);
  logAction("Funke Adeyemi", `Removed ${sector?.name ?? sectorId} from`, panel?.name ?? panelId);
  revalidatePath("/secretariat/panels");
  return { success: true };
}

/**
 * Records a conflict of interest (doc section 11.5): either the juror is
 * excused from one specific applicant's review (the other 2 panel
 * members cover it — task #31/#32 read this list when assigning
 * document-review/interview jurors), or reassigned away from a sector
 * cluster entirely for the cycle, recorded here without an automatic
 * panel move since the doc leaves that judgment to the Secretariat.
 */
export async function recordJurorConflict(input: {
  jurorId: string;
  applicationId: string | null;
  reason: string;
  resolution: "reassigned_panel" | "excused_from_applicant";
}) {
  const juror = store.users.find((u) => u.id === input.jurorId);
  if (!juror) return { success: false, error: "Juror not found." };
  if (input.resolution === "excused_from_applicant" && !input.applicationId) {
    return { success: false, error: "Select an applicant to excuse this juror from." };
  }

  store.jurorConflicts.push({
    id: generateId("conflict"),
    jurorId: input.jurorId,
    applicationId: input.applicationId,
    reason: input.reason,
    resolution: input.resolution,
    createdAt: new Date().toISOString(),
  });

  logAction("Funke Adeyemi", "Recorded conflict of interest for", juror.name);
  revalidatePath("/secretariat/panels");
  return { success: true };
}
