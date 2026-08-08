import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_ITEMS } from "@/lib/mock/framework";
import { getDocuments } from "@/lib/data/checklist";
import type { DocumentVerification, RedFlag, RedFlagReason, RequiredDocument } from "@/types/domain";

const ITEM_BY_CODE = new Map(ASSESSMENT_ITEMS.map((i) => [i.id, i]));

export interface DocumentWithVerification extends RequiredDocument {
  myVerification: DocumentVerification | null;
  myRedFlag: RedFlag | null;
}

/**
 * Stage 2a worklist (doc section 11.2): every uploaded document for a
 * shortlisted applicant. Verification (stage2_document_reviews) is keyed
 * by item, not by the specific uploaded file — matches the real schema
 * (unique on application_id+item_id+juror_id); red flags key off the
 * actual document_evidence row instead, which lib/data/checklist.ts's
 * RequiredDocument.id already resolves to for uploaded items.
 */
export async function getDocumentsForVerification(applicationId: string, jurorId: string): Promise<DocumentWithVerification[]> {
  const documents = (await getDocuments(applicationId)).filter((d) => d.status === "uploaded");
  if (documents.length === 0) return [];

  const supabase = await createClient();
  const itemDbIds = documents.map((d) => ITEM_BY_CODE.get(d.itemId)!.dbId);
  const docEvidenceIds = documents.map((d) => d.id);
  const [{ data: reviews }, { data: flags }] = await Promise.all([
    supabase
      .from("stage2_document_reviews")
      .select("id, item_id, credible, notes, reviewed_at")
      .eq("application_id", applicationId)
      .eq("juror_id", jurorId)
      .in("item_id", itemDbIds),
    supabase.from("red_flags").select("id, document_evidence_id, reason, notes, created_at").eq("flagged_by", jurorId).in("document_evidence_id", docEvidenceIds),
  ]);

  return documents.map((doc) => {
    const item = ITEM_BY_CODE.get(doc.itemId)!;
    const review = (reviews ?? []).find((r) => r.item_id === item.dbId);
    const flag = (flags ?? []).find((f) => f.document_evidence_id === doc.id);
    return {
      ...doc,
      myVerification:
        review && review.credible !== null
          ? { id: review.id, documentId: doc.id, jurorId, credible: review.credible, note: review.notes ?? undefined, reviewedAt: review.reviewed_at ?? "" }
          : null,
      myRedFlag: flag
        ? { id: flag.id, documentId: doc.id, jurorId, reason: flag.reason as RedFlagReason, note: flag.notes ?? undefined, createdAt: flag.created_at }
        : null,
    };
  });
}

export async function getOutstandingVerifications(applicationId: string, jurorId: string): Promise<RequiredDocument[]> {
  const documents = await getDocumentsForVerification(applicationId, jurorId);
  return documents.filter((d) => !d.myVerification);
}

/**
 * applications.red_flag_count is auto-synced by a DB trigger on red_flags
 * insert/delete — read it directly rather than counting rows ourselves.
 */
export async function getRedFlagCount(applicationId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("red_flag_count").eq("id", applicationId).maybeSingle();
  return data?.red_flag_count ?? 0;
}

export async function isMandatorySecretariatReviewTriggered(applicationId: string): Promise<boolean> {
  return (await getRedFlagCount(applicationId)) >= 3;
}

export interface DocumentVerificationSummary extends RequiredDocument {
  credibleCount: number;
  redFlagCount: number;
}

/** Secretariat view: every checklist item with the aggregate (not per-juror) verification tally. */
export async function getDocumentVerificationSummary(applicationId: string): Promise<DocumentVerificationSummary[]> {
  const documents = await getDocuments(applicationId);
  if (documents.length === 0) return [];

  const supabase = await createClient();
  const itemDbIds = documents.map((d) => ITEM_BY_CODE.get(d.itemId)!.dbId);
  const docEvidenceIds = documents.filter((d) => d.status === "uploaded").map((d) => d.id);
  const [{ data: reviews }, { data: flags }] = await Promise.all([
    supabase.from("stage2_document_reviews").select("item_id, credible").eq("application_id", applicationId).in("item_id", itemDbIds),
    docEvidenceIds.length
      ? supabase.from("red_flags").select("document_evidence_id").in("document_evidence_id", docEvidenceIds)
      : Promise.resolve({ data: [] as { document_evidence_id: string }[] }),
  ]);

  return documents.map((doc) => {
    const item = ITEM_BY_CODE.get(doc.itemId)!;
    return {
      ...doc,
      credibleCount: (reviews ?? []).filter((r) => r.item_id === item.dbId && r.credible).length,
      redFlagCount: (flags ?? []).filter((f) => f.document_evidence_id === doc.id).length,
    };
  });
}
