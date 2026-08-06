"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { getRedFlagCount } from "@/lib/data/stage2a";
import type { RedFlagReason } from "@/types/domain";

function upsertVerification(documentId: string, jurorId: string, credible: boolean, note?: string) {
  const existing = store.documentVerifications.find((v) => v.documentId === documentId && v.jurorId === jurorId);
  if (existing) {
    existing.credible = credible;
    existing.note = note;
    existing.reviewedAt = new Date().toISOString();
  } else {
    store.documentVerifications.push({
      id: generateId("docverify"),
      documentId,
      jurorId,
      credible,
      note,
      reviewedAt: new Date().toISOString(),
    });
  }
}

export async function verifyDocumentCredible(documentId: string, jurorId: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };

  upsertVerification(documentId, jurorId, true);
  store.redFlags = store.redFlags.filter((f) => !(f.documentId === documentId && f.jurorId === jurorId));

  logAction("Jury", "Verified document as credible:", doc.name);
  revalidatePath(`/jury/documents/${doc.applicationId}`);
  return { success: true };
}

export async function flagDocument(documentId: string, jurorId: string, reason: RedFlagReason, note?: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };

  upsertVerification(documentId, jurorId, false, note);
  const existingFlag = store.redFlags.find((f) => f.documentId === documentId && f.jurorId === jurorId);
  if (existingFlag) {
    existingFlag.reason = reason;
    existingFlag.note = note;
  } else {
    store.redFlags.push({ id: generateId("redflag"), documentId, jurorId, reason, note, createdAt: new Date().toISOString() });
  }

  logAction("Jury", `Red-flagged document (${reason}):`, doc.name);

  const redFlagCount = await getRedFlagCount(doc.applicationId);
  if (redFlagCount === 3) {
    const app = store.applications.find((a) => a.id === doc.applicationId);
    const org = app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;
    logAction("System", "3+ red flags — mandatory Secretariat review triggered for", org?.name ?? doc.applicationId);
  }

  revalidatePath(`/jury/documents/${doc.applicationId}`);
  return { success: true, redFlagCount };
}
