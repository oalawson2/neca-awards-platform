"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { uploadDocument } from "@/lib/actions/documents";
import type { ChecklistGroup } from "@/lib/data/checklist";

export function DocumentChecklist({ applicationId, groups }: { applicationId: string; groups: ChecklistGroup[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const allDocs = groups.flatMap((g) => g.documents);
  const mandatory = allDocs.filter((d) => d.track === "mandatory");
  const mandatoryUploaded = mandatory.filter((d) => d.status === "uploaded").length;
  const allMandatoryUploaded = mandatory.every((d) => d.status === "uploaded");

  function pickFile(documentId: string, itemId: string) {
    setErrors((e) => ({ ...e, [documentId]: "" }));
    const input = fileInputRefs.current[documentId];
    if (!input) return;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.set("file", file);
      setUploadingId(documentId);
      startTransition(async () => {
        const result = await uploadDocument(applicationId, itemId, formData);
        setUploadingId(null);
        if (!result.success) setErrors((e) => ({ ...e, [documentId]: result.error ?? "Upload failed." }));
        input.value = "";
        router.refresh();
      });
    };
    input.click();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-navy mb-1.5">Required documents</h1>
      <p className="text-[13px] text-text-muted mb-2">
        Generated from your answers to Sections B–I. Mandatory items must be uploaded before you can submit; Advanced
        items can be left pending.
      </p>
      <p className="text-[13px] font-semibold mb-6">
        {mandatoryUploaded} of {mandatory.length} mandatory documents uploaded
      </p>

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
                      <Badge tone={doc.track === "mandatory" ? "error" : "neutral"}>{doc.track.toUpperCase()}</Badge>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">{doc.description}</div>
                    <div className="text-xs text-[#AEB1BC] mt-0.5">
                      Accepted: {doc.acceptedFileTypes.join(", ").toUpperCase()} · Max {doc.maxSizeMB}MB
                    </div>
                    {doc.status === "uploaded" && doc.fileName && (
                      <div className="text-xs text-success mt-0.5">{doc.fileName}</div>
                    )}
                    {errors[doc.id] && <div className="text-xs text-error mt-0.5">{errors[doc.id]}</div>}
                  </div>
                  {doc.status === "uploaded" ? (
                    <span className="text-xs font-semibold text-success flex-shrink-0">✓ Uploaded</span>
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
                        disabled={isPending && uploadingId === doc.id}
                        onClick={() => pickFile(doc.id, doc.itemId)}
                      >
                        {isPending && uploadingId === doc.id ? "Uploading…" : "Upload"}
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
        <Button onClick={() => router.push("/applicant/review")} disabled={!allMandatoryUploaded}>
          Continue to review →
        </Button>
      </div>
    </div>
  );
}
