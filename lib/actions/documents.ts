"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

/** Mock upload — no real file storage yet (Supabase Storage is being wired up in parallel). Records a filename and flips the checklist item to uploaded. */
export async function uploadDocument(documentId: string, fileName: string) {
  const doc = store.documents.find((d) => d.id === documentId);
  if (!doc) return { success: false, error: "Checklist item not found." };

  doc.status = "uploaded";
  doc.fileName = fileName;
  doc.uploadedAt = new Date().toISOString();

  const app = store.applications.find((a) => a.id === doc.applicationId);
  const org = app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;
  logAction(org?.name ?? "Applicant", "Uploaded document for", doc.name);

  revalidatePath("/applicant/documents");
  revalidatePath("/applicant/review");
  return { success: true };
}
