import { store } from "@/lib/mock/store";
import type { DocumentReview, RequiredDocument } from "@/types/domain";

export async function getDocuments(applicationId: string): Promise<RequiredDocument[]> {
  return store.documents.filter((d) => d.applicationId === applicationId);
}

export async function getDocumentReviewsForJuror(applicationId: string, jurorId: string): Promise<DocumentReview[]> {
  const docIds = new Set(store.documents.filter((d) => d.applicationId === applicationId).map((d) => d.id));
  return store.documentReviews.filter((r) => r.jurorId === jurorId && docIds.has(r.documentId));
}

/**
 * Predetermined score bonus per document *this juror personally certified*
 * (business rule: "a juror can certify an uploaded document as compliant,
 * which applies a predetermined score bonus"). The exact point value is a
 * placeholder pending NECA's real criteria. Scoped per juror — not shared
 * across the panel — so it stays consistent with blind scoring: a juror's
 * own bonus only reflects their own compliance calls, never another
 * juror's. Uploading alone earns nothing; only an explicit "certified"
 * review counts, and only for documents that were actually uploaded.
 */
export const DOCUMENT_CERTIFICATION_BONUS_PER_DOC = 1;

export async function getJurorCertificationBonus(applicationId: string, jurorId: string): Promise<number> {
  const uploadedDocIds = new Set(
    store.documents.filter((d) => d.applicationId === applicationId && d.status === "uploaded").map((d) => d.id)
  );
  const certifiedCount = store.documentReviews.filter(
    (r) => r.jurorId === jurorId && r.status === "certified" && uploadedDocIds.has(r.documentId)
  ).length;
  return certifiedCount * DOCUMENT_CERTIFICATION_BONUS_PER_DOC;
}

/**
 * Uploaded documents this juror hasn't certified or rejected yet. A
 * non-empty result blocks that juror from submitting their scorecard for
 * this application (see lib/actions/scoring.ts's submitScorecard) and
 * from requesting an interview (see lib/actions/interviews.ts).
 */
export async function getOutstandingDocuments(applicationId: string, jurorId: string): Promise<RequiredDocument[]> {
  const uploaded = store.documents.filter((d) => d.applicationId === applicationId && d.status === "uploaded");
  const reviewedDocIds = new Set(
    store.documentReviews.filter((r) => r.jurorId === jurorId).map((r) => r.documentId)
  );
  return uploaded.filter((d) => !reviewedDocIds.has(d.id));
}

export interface DocumentReviewSummaryRow {
  documentId: string;
  name: string;
  status: RequiredDocument["status"];
  certifiedByCount: number;
  rejectedByCount: number;
  totalJurorsAssigned: number;
}

/** Secretariat-facing view-only summary — how many of the assigned jurors certified/rejected each document. */
export async function getDocumentReviewSummary(applicationId: string): Promise<DocumentReviewSummaryRow[]> {
  const app = store.applications.find((a) => a.id === applicationId);
  const totalJurorsAssigned = app
    ? store.jurorAssignments.filter((a) => a.sectorId === app.sectorId).length
    : 0;
  const docs = store.documents.filter((d) => d.applicationId === applicationId);

  return docs.map((doc) => {
    const reviews = store.documentReviews.filter((r) => r.documentId === doc.id);
    return {
      documentId: doc.id,
      name: doc.name,
      status: doc.status,
      certifiedByCount: reviews.filter((r) => r.status === "certified").length,
      rejectedByCount: reviews.filter((r) => r.status === "rejected").length,
      totalJurorsAssigned,
    };
  });
}
