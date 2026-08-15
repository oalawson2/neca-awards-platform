"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { itemById } from "@/lib/mock/framework";
import { logAction } from "@/lib/data/audit";

// Matches the real Storage bucket's own accepted MIME types — checked here
// too for a fast, friendly error instead of letting the upload round-trip
// and get rejected by Storage.
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

// Ceiling on the raw upload, before compression — generous enough for an
// unedited phone photo or a multi-page scan. next.config.ts's
// experimental.serverActions.bodySizeLimit is raised to match (with
// headroom for multipart overhead); requests above it never reach here.
const MAX_RAW_BYTES = 8 * 1024 * 1024;

// What every stored file must fit under, regardless of how large the raw
// upload was — keeps the platform-wide Storage bucket (1GB capacity,
// shared across every applicant) from being dominated by a handful of
// oversized files. The bucket's own size limit is being lowered to match
// separately.
const TARGET_BYTES = 200 * 1024;

const JPEG_QUALITY_STEPS = [80, 70, 60, 50, 40, 30, 20, 15, 10];
const MAX_RESIZE_ATTEMPTS = 4;
const RESIZE_FACTOR = 0.75;
const MIN_WIDTH_PX = 400;
// A compliance document (certificate, form, ID) is fully legible well
// below a raw phone-camera width (commonly 3000-4000px+) — starting the
// quality loop no wider than this bounds worst-case encode time (a
// pathological, hard-to-compress image at full phone resolution measured
// 35s+ across the quality loop in testing) without affecting real scans.
const INITIAL_MAX_WIDTH_PX = 2000;

export interface UploadResult {
  success: boolean;
  error?: string;
}

/**
 * Steps quality down before shrinking dimensions, and only shrinks as a
 * last resort — a slightly-lower-quality full-size scan stays legible;
 * an unnecessarily shrunk one doesn't. Always re-encodes as JPEG (mozjpeg)
 * regardless of input format: these are compliance documents (scans,
 * screenshots, certificates), not images that need PNG transparency, and
 * JPEG compresses far smaller at equivalent visual quality. Returns null
 * if even the smallest/lowest-quality attempt can't fit — caller turns
 * that into a clear error rather than silently shipping a mangled image.
 */
async function compressImage(buffer: Buffer): Promise<Buffer | null> {
  const metadata = await sharp(buffer, { failOn: "none" }).metadata();
  let width = metadata.width && metadata.width > INITIAL_MAX_WIDTH_PX ? INITIAL_MAX_WIDTH_PX : metadata.width;

  for (let resizeAttempt = 0; resizeAttempt <= MAX_RESIZE_ATTEMPTS; resizeAttempt++) {
    for (const quality of JPEG_QUALITY_STEPS) {
      const pipeline = sharp(buffer, { failOn: "none" });
      if (width) pipeline.resize({ width, withoutEnlargement: true });
      const out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      if (out.byteLength <= TARGET_BYTES) return out;
    }
    if (!width || width <= MIN_WIDTH_PX) break;
    width = Math.round(width * RESIZE_FACTOR);
  }
  return null;
}

/**
 * No PDF recompression library is installed (deliberately — see the round-2
 * build notes on the host's 1GB build memory cap), so this is a size gate,
 * not an attempt: a PDF already under the target passes through untouched;
 * one over it gets a clear, actionable error rather than a silent failure
 * or a promise this can't keep.
 */
function checkPdfSize(buffer: Buffer): { ok: true } | { ok: false; error: string } {
  if (buffer.byteLength <= TARGET_BYTES) return { ok: true };
  return {
    ok: false,
    error: "This PDF is too large to store (must be under 200KB). Try re-exporting it at a lower resolution, or upload it as a JPEG/PNG photo instead — images are compressed automatically.",
  };
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
 *
 * Images are compressed to fit TARGET_BYTES before upload; the stored
 * object's extension always reflects what was actually written (.jpg for
 * every compressed image, regardless of whether the original was a PNG),
 * which can differ from document_evidence.file_name (the original,
 * human-readable name kept for display). Anything reading the stored
 * bytes back — the document previewer included — must infer content type
 * from file_path, not file_name.
 */
export async function uploadDocument(applicationId: string, itemCode: string, formData: FormData): Promise<UploadResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Choose a file first." };
  if (!ACCEPTED_MIME_TYPES.has(file.type)) return { success: false, error: "Only PDF, JPEG, or PNG files are accepted." };
  if (file.size > MAX_RAW_BYTES) return { success: false, error: `File must be ${MAX_RAW_BYTES / (1024 * 1024)}MB or smaller.` };

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  let storedBuffer: Buffer;
  let contentType: string;
  let extension: string;

  if (file.type === "application/pdf") {
    const check = checkPdfSize(originalBuffer);
    if (!check.ok) return { success: false, error: check.error };
    storedBuffer = originalBuffer;
    contentType = "application/pdf";
    extension = "pdf";
  } else {
    const compressed = await compressImage(originalBuffer);
    if (!compressed) {
      return { success: false, error: "This image couldn't be compressed under our 200KB storage limit. Try a lower-resolution photo or a simpler scan." };
    }
    storedBuffer = compressed;
    contentType = "image/jpeg";
    extension = "jpg";
  }

  const item = itemById(itemCode);
  const supabase = await createClient();

  const safeBaseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${applicationId}/${item.dbId}/${Date.now()}-${safeBaseName}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("application-documents")
    .upload(path, storedBuffer, { contentType, upsert: false });
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

const PREVIEW_URL_EXPIRY_SECONDS = 300;

export interface DocumentPreviewResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Short-lived signed URL for a stored document, minted fresh on demand
 * rather than baked into server-rendered props — a review session can sit
 * open a lot longer than PREVIEW_URL_EXPIRY_SECONDS. Uses the regular
 * (cookie-authenticated) client, so Storage's own RLS
 * (storage_select_jury_panel / storage_select_secretariat / storage_select_own)
 * decides whether this succeeds — jury only within their own panel's
 * applications, Secretariat unrestricted, same access already governing
 * every other read in this file. No separate authorization check needed.
 */
export async function getDocumentPreviewUrl(storagePath: string): Promise<DocumentPreviewResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("application-documents").createSignedUrl(storagePath, PREVIEW_URL_EXPIRY_SECONDS);
  if (error || !data) return { success: false, error: "Could not load this document." };
  return { success: true, url: data.signedUrl };
}
