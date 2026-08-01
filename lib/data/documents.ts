import { store } from "@/lib/mock/store";
import type { RequiredDocument } from "@/types/domain";

export async function getDocuments(applicationId: string): Promise<RequiredDocument[]> {
  return store.documents.filter((d) => d.applicationId === applicationId);
}

/**
 * Predetermined score bonus per certified document (business rule: "a juror
 * can certify an uploaded document as compliant, which applies a
 * predetermined score bonus"). The wireframes don't specify the exact point
 * value or whether it's per-juror or shared, so this is a judgment call:
 * treated as one shared, transparent bonus added at the aggregate score
 * level (see getScoreSummary in lib/data/applications.ts), not baked into
 * any individual juror's blind scorecard.
 */
export const DOCUMENT_CERTIFICATION_BONUS_PER_DOC = 1;

export async function getCertificationBonus(applicationId: string): Promise<number> {
  const certifiedCount = store.documents.filter(
    (d) => d.applicationId === applicationId && d.certifiedByJurorId
  ).length;
  return certifiedCount * DOCUMENT_CERTIFICATION_BONUS_PER_DOC;
}
