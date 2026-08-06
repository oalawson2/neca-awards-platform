import { store } from "@/lib/mock/store";
import type { DocumentVerification, RedFlag, RequiredDocument } from "@/types/domain";

export interface DocumentWithVerification extends RequiredDocument {
  myVerification: DocumentVerification | null;
  myRedFlag: RedFlag | null;
}

/**
 * Stage 2a worklist (doc section 11.2): every uploaded document for a
 * shortlisted applicant, since "uploaded" already means the applicant
 * declared Yes / maturity>=3 for that item (see evidenceTriggerFired in
 * lib/scoring/stage1.ts — that's exactly what fired the checklist entry
 * in the first place). Per-juror verification, same reasoning as the
 * rest of Stage 2: one juror's credibility call doesn't leak to another
 * before the panel's scores are reconciled.
 */
export async function getDocumentsForVerification(applicationId: string, jurorId: string): Promise<DocumentWithVerification[]> {
  const documents = store.documents.filter((d) => d.applicationId === applicationId && d.status === "uploaded");
  return documents.map((doc) => ({
    ...doc,
    myVerification: store.documentVerifications.find((v) => v.documentId === doc.id && v.jurorId === jurorId) ?? null,
    myRedFlag: store.redFlags.find((f) => f.documentId === doc.id && f.jurorId === jurorId) ?? null,
  }));
}

export async function getOutstandingVerifications(applicationId: string, jurorId: string): Promise<RequiredDocument[]> {
  const documents = await getDocumentsForVerification(applicationId, jurorId);
  return documents.filter((d) => !d.myVerification);
}

/** Doc section 11.2/11.4: "3+ red flags across an application triggers mandatory Secretariat review" — computed live, not stored, since it's a pure function of the red flags already on record. */
export async function getRedFlagCount(applicationId: string): Promise<number> {
  const documentIds = new Set(store.documents.filter((d) => d.applicationId === applicationId).map((d) => d.id));
  return store.redFlags.filter((f) => documentIds.has(f.documentId)).length;
}

export async function isMandatorySecretariatReviewTriggered(applicationId: string): Promise<boolean> {
  return (await getRedFlagCount(applicationId)) >= 3;
}
