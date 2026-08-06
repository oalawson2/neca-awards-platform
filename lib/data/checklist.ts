import { store } from "@/lib/mock/store";
import { PILLARS } from "@/lib/mock/framework";
import type { PillarCode, RequiredDocument } from "@/types/domain";

export async function getDocuments(applicationId: string): Promise<RequiredDocument[]> {
  return store.documents.filter((d) => d.applicationId === applicationId);
}

export interface ChecklistGroup {
  pillarCode: PillarCode;
  pillarName: string;
  documents: RequiredDocument[];
}

/** The applicant-facing checklist, grouped by pillar, in pillar order (doc section 10). */
export async function getChecklistGrouped(applicationId: string): Promise<ChecklistGroup[]> {
  const documents = await getDocuments(applicationId);
  return PILLARS.filter((p) => p.scored)
    .map((p) => ({
      pillarCode: p.code,
      pillarName: p.name,
      documents: documents.filter((d) => d.pillarCode === p.code),
    }))
    .filter((g) => g.documents.length > 0);
}

export interface ChecklistStatus {
  mandatoryTotal: number;
  mandatoryUploaded: number;
  advancedTotal: number;
  advancedUploaded: number;
  allMandatoryUploaded: boolean;
}

export async function getChecklistStatus(applicationId: string): Promise<ChecklistStatus> {
  const documents = await getDocuments(applicationId);
  const mandatory = documents.filter((d) => d.track === "mandatory");
  const advanced = documents.filter((d) => d.track === "advanced");
  return {
    mandatoryTotal: mandatory.length,
    mandatoryUploaded: mandatory.filter((d) => d.status === "uploaded").length,
    advancedTotal: advanced.length,
    advancedUploaded: advanced.filter((d) => d.status === "uploaded").length,
    allMandatoryUploaded: mandatory.every((d) => d.status === "uploaded"),
  };
}
