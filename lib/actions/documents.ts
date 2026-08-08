"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { itemById } from "@/lib/mock/framework";
import { logAction } from "@/lib/data/audit";

// Matches the real Storage bucket's own config exactly (2MB cap,
// PDF/JPEG/PNG only) — checked here too for a fast, friendly error
// instead of letting the upload round-trip and get rejected by Storage.
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_BYTES = 2 * 1024 * 1024;

export interface UploadResult {
  success: boolean;
  error?: string;
}

/**
 * Real file upload to the `application-documents` Storage bucket, using
 * the exact path convention its RLS policies parse:
 * `{application_id}/{item_id}/{filename}` — item_id here is the item's
 * real UUID (item.dbId), not the "B1"-style code. Runs entirely through
 * the regular (cookie-authenticated) Supabase client, so Storage's own
 * RLS enforces "own application, still draft" — same gate as the
 * document_evidence insert right after it. Rolls the Storage object back
 * if the document_evidence insert fails, so a partial failure doesn't
 * leave an orphaned file with no bookkeeping row pointing at it.
 */
export async function uploadDocument(applicationId: string, itemCode: string, formData: FormData): Promise<UploadResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Choose a file first." };
  if (!ACCEPTED_MIME_TYPES.has(file.type)) return { success: false, error: "Only PDF, JPEG, or PNG files are accepted." };
  if (file.size > MAX_BYTES) return { success: false, error: "File must be 2MB or smaller." };

  const item = itemById(itemCode);
  const supabase = await createClient();

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${applicationId}/${item.dbId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("application-documents")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    return { success: false, error: "Upload failed. You can only upload documents while your application is still a draft." };
  }

  const { error: insertError } = await supabase.from("document_evidence").insert({
    application_id: applicationId,
    item_id: item.dbId,
    file_path: path,
    file_name: file.name,
    uploaded_by: user.id,
  });
  if (insertError) {
    await supabase.storage.from("application-documents").remove([path]);
    return { success: false, error: "Could not record the upload. Try again." };
  }

  await logAction(user.fullName || user.email, "Uploaded document for", item.evidenceName ?? item.id);
  revalidatePath("/applicant/documents");
  revalidatePath("/applicant/review");
  return { success: true };
}
