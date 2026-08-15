"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { uploadDocument } from "@/lib/actions/documents";
import type { ChecklistGroup } from "@/lib/data/checklist";

export function DocumentChecklist({
  applicationId,
  groups,
  readOnly = false,
}: {
  applicationId: string;
  groups: ChecklistGroup[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // Set the instant a given upload's response comes back successful — the
  // "✓ Uploaded" state no longer waits on router.refresh()'s server
  // round trip to land before showing, which used to leave a multi-second
  // gap where the button just silently reverted to "Upload" (looking like
  // nothing had happened) between the upload finishing and the refreshed
  // props catching up. router.refresh() still runs, to bring doc.status
  // and the mandatory-count in sync with the server — this is just what
  // renders in the meantime.
  const [locallyUploaded, setLocallyUploaded] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const allDocs = groups.flatMap((g) => g.documents);
  const uploadedCount = allDocs.filter((d) => d.status === "uploaded" || locallyUploaded[d.id]).length;

  function pickFile(documentId: string, itemId: string) {
    setErrors((e) => ({ ...e, [documentId]: "" }));
    const input = fileInputRefs.current[documentId];
    if (!input) return;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.set("file", file);
      setUploadingId(documentId);
      const result = await uploadDocument(applicationId, itemId, formData);
      input.value = "";
      if (result.success) {
        setLocallyUploaded((u) => ({ ...u, [documentId]: file.name }));
      } else {
        setErrors((e) => ({ ...e, [documentId]: result.error ?? "Upload failed." }));
      }
      setUploadingId(null);
      router.refresh();
    };
    input.click();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-navy mb-1.5">Required documents</h1>
      <p className="text-[13px] text-text-muted mb-2">
        Generated from your answers to Sections B–I. Uploading everything here strengthens your application, but you
        can still submit with items missing — the Secretariat will follow up separately on anything outstanding.
      </p>
      <p className="text-[13px] font-semibold mb-6">
        {uploadedCount} of {allDocs.length} documents uploaded
      </p>

      {readOnly && (
        <div className="text-[13px] text-navy bg-[#F1F1FB] border border-border rounded-2xl px-4 py-3 mb-6">
          Your application has been submitted, so new uploads are closed here. If the Secretariat needs anything
          further from you, they&rsquo;ll be in touch directly.
        </div>
      )}

      {allDocs.length === 0 && (
        <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
          No documents are required based on your answers so far.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div key={group.pillarCode}>
            <div className="text-xs font-bold text-[#AEB1BC] mb-2.5">
              {group.pillarCode} — {group.pillarName.toUpperCase()}
            </div>
            <div className="border border-border rounded-2xl overflow-hidden">
              {group.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 px-4.5 py-3.5 border-b last:border-b-0 border-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{doc.name}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">{doc.description}</div>
                    <div className="text-xs text-[#AEB1BC] mt-0.5">
                      Accepted: {doc.acceptedFileTypes.join(", ").toUpperCase()} · Max {doc.maxSizeMB}MB (photos and
                      scans are compressed automatically)
                    </div>
                    {(doc.fileName || locallyUploaded[doc.id]) && (
                      <div className="text-xs text-success mt-0.5">{doc.fileName ?? locallyUploaded[doc.id]}</div>
                    )}
                    {errors[doc.id] && <div className="text-xs text-error mt-0.5">{errors[doc.id]}</div>}
                  </div>
                  {doc.status === "uploaded" || locallyUploaded[doc.id] ? (
                    <span className="text-xs font-semibold text-success flex-shrink-0">✓ Uploaded</span>
                  ) : readOnly ? (
                    <span className="text-xs text-text-muted flex-shrink-0">Not uploaded</span>
                  ) : (
                    <>
                      <input
                        ref={(el) => {
                          fileInputRefs.current[doc.id] = el;
                        }}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={uploadingId === doc.id}
                        onClick={() => pickFile(doc.id, doc.itemId)}
                      >
                        {uploadingId === doc.id ? "Uploading…" : "Upload"}
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-9 flex justify-between gap-3">
        <Button variant="secondary" onClick={() => router.push("/applicant/questionnaire")}>
          ← Back to questionnaire
        </Button>
        <Button onClick={() => router.push("/applicant/review")}>
          Continue to review →
        </Button>
      </div>
    </div>
  );
}
