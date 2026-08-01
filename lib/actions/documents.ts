"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

/** Mock upload — there's no real file storage yet, this just flips a document to "uploaded". */
export async function uploadDocument(documentId: string, fileName: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };
  doc.status = "uploaded";
  doc.fileName = fileName;
  revalidatePath("/applicant/documents");
  revalidatePath("/applicant");
  return { success: true };
}

/** Certifying a document as compliant applies a predetermined score bonus (see lib/data/documents.ts). */
export async function certifyDocument(documentId: string, jurorId: string, jurorName: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };
  doc.certifiedByJurorId = jurorId;
  doc.certifiedAt = new Date().toISOString();
  doc.flaggedIssue = null;
  const app = store.applications.find((a) => a.id === doc.applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction(jurorName, "Certified document for", orgName ?? doc.applicationId);
  revalidatePath("/jury/documents/" + doc.applicationId);
  return { success: true };
}

export async function flagDocument(documentId: string, jurorName: string, issue: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Document not found." };
  doc.flaggedIssue = issue || "Issue flagged by juror";
  doc.certifiedByJurorId = null;
  doc.certifiedAt = null;
  const app = store.applications.find((a) => a.id === doc.applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction(jurorName, "Flagged document issue for", orgName ?? doc.applicationId);
  revalidatePath("/jury/documents/" + doc.applicationId);
  return { success: true };
}
