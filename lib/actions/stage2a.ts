"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/data/audit";
import type { RedFlagReason } from "@/types/domain";

/**
 * documentId here is document_evidence.id (what lib/data/checklist.ts's
 * RequiredDocument.id resolves to for uploaded items) — looked up
 * directly to get its application_id/item_id rather than re-deriving
 * from the full checklist.
 */
async function resolveDocument(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string) {
  const { data } = await supabase.from("document_evidence").select("application_id, item_id, file_name").eq("id", documentId).maybeSingle();
  return data;
}

export async function verifyDocumentCredible(documentId: string, jurorId: string) {
  const supabase = await createClient();
  const doc = await resolveDocument(supabase, documentId);
  if (!doc) return { success: false, error: "Document not found." };

  const { error } = await supabase
    .from("stage2_document_reviews")
    .upsert(
      { application_id: doc.application_id, item_id: doc.item_id, juror_id: jurorId, credible: true, reviewed_at: new Date().toISOString() },
      { onConflict: "application_id,item_id,juror_id" }
    );
  if (error) return { success: false, error: "Could not save review." };

  // Note: red_flags has no UPDATE/DELETE policy for anyone (append-only,
  // permanent record by design) — marking credible now doesn't retract an
  // earlier flag this juror may have raised on this document.
  logAction("Jury", "Verified document as credible:", doc.file_name);
  revalidatePath(`/jury/documents/${doc.application_id}`);
  return { success: true };
}

/**
 * red_flags is INSERT + SELECT only — no way to edit or withdraw a flag
 * once raised, by design (a permanent record, not a mutable status). If
 * this juror already flagged this document, this is a no-op on the flag
 * itself (the underlying review verdict below still upserts normally) —
 * there's no schema-backed way to change the reason after the fact.
 */
export async function flagDocument(documentId: string, jurorId: string, reason: RedFlagReason, note?: string) {
  const supabase = await createClient();
  const doc = await resolveDocument(supabase, documentId);
  if (!doc) return { success: false, error: "Document not found." };

  const { error: reviewError } = await supabase
    .from("stage2_document_reviews")
    .upsert(
      { application_id: doc.application_id, item_id: doc.item_id, juror_id: jurorId, credible: false, notes: note, reviewed_at: new Date().toISOString() },
      { onConflict: "application_id,item_id,juror_id" }
    );
  if (reviewError) return { success: false, error: "Could not save review." };

  const { data: existingFlag } = await supabase
    .from("red_flags")
    .select("id")
    .eq("document_evidence_id", documentId)
    .eq("flagged_by", jurorId)
    .maybeSingle();
  if (!existingFlag) {
    await supabase.from("red_flags").insert({
      application_id: doc.application_id,
      document_evidence_id: documentId,
      flagged_by: jurorId,
      reason,
      notes: note,
    });
  }

  logAction("Jury", `Red-flagged document (${reason}):`, doc.file_name);

  const { data: app } = await supabase.from("applications").select("red_flag_count").eq("id", doc.application_id).maybeSingle();
  const redFlagCount = app?.red_flag_count ?? 0;
  if (redFlagCount === 3) {
    logAction("System", "3+ red flags — mandatory Secretariat review triggered for", doc.application_id);
  }

  revalidatePath(`/jury/documents/${doc.application_id}`);
  return { success: true, redFlagCount };
}
