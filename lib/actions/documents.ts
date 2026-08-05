"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

/**
 * Mock upload — there's no real file storage yet, this just flips a
 * document to "uploaded". Deliberately does NOT touch documentReviews or
 * scoring: uploading alone must never add score on its own, only an
 * explicit juror certification does.
 */
export async function uploadDocument(documentId: string, fileName: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };
  doc.status = "uploaded";
  doc.fileName = fileName;
  revalidatePath("/applicant/documents");
  revalidatePath("/applicant");
  return { success: true };
}

function upsertReview(documentId: string, jurorId: string, status: "certified" | "rejected", note?: string) {
  const existing = store.documentReviews.find((r) => r.documentId === documentId && r.jurorId === jurorId);
  if (existing) {
    existing.status = status;
    existing.reviewedAt = new Date().toISOString();
    existing.note = note;
  } else {
    store.documentReviews.push({ documentId, jurorId, status, reviewedAt: new Date().toISOString(), note });
  }
}

/** Certifying a document as compliant applies this juror's own score bonus (see lib/data/documents.ts). */
export async function certifyDocument(documentId: string, jurorId: string, jurorName: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };

  upsertReview(documentId, jurorId, "certified");

  const app = store.applications.find((a) => a.id === doc.applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction(jurorName, "Certified document for", orgName ?? doc.applicationId);
  revalidatePath("/jury/documents/" + doc.applicationId);
  return { success: true };
}

/** Marking a document not compliant reviews it (unblocking submission) but adds no score bonus. */
export async function rejectDocument(documentId: string, jurorId: string, jurorName: string, reason?: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };

  upsertReview(documentId, jurorId, "rejected", reason);

  const app = store.applications.find((a) => a.id === doc.applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction(jurorName, "Marked document not compliant for", orgName ?? doc.applicationId);
  revalidatePath("/jury/documents/" + doc.applicationId);
  return { success: true };
}
