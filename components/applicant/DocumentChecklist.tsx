"use client";

import { useState, useTransition } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { uploadDocument } from "@/lib/actions/documents";
import type { RequiredDocument } from "@/types/domain";

export function DocumentChecklist({ documents }: { documents: RequiredDocument[] }) {
  const [docs, setDocs] = useState(documents);
  const [isPending, startTransition] = useTransition();
  const uploadedCount = docs.filter((d) => d.status === "uploaded").length;

  function handleUpload(doc: RequiredDocument) {
    startTransition(async () => {
      const fileName = `${doc.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
      const result = await uploadDocument(doc.id, fileName);
      if (result.success) {
        setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: "uploaded", fileName } : d)));
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <div className="flex justify-between items-center flex-wrap gap-3 mb-5">
        <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-navy">Required documents</h1>
        <div className="w-full sm:w-56">
          <ProgressBar percent={(uploadedCount / Math.max(1, docs.length)) * 100} color="success" />
          <div className="text-xs text-text-muted mt-1.5 text-right">
            {uploadedCount} of {docs.length} uploaded
          </div>
        </div>
      </div>

      <div className="border border-border rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_140px] bg-bg px-5 py-3 text-[11px] font-bold text-[#AEB1BC]">
          <div>DOCUMENT</div>
          <div>REQUIRED BECAUSE</div>
          <div>STATUS</div>
          <div />
        </div>
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_140px] gap-2 sm:gap-0 px-5 py-4 border-t border-border items-center text-sm"
          >
            <div className="font-semibold sm:font-normal">{doc.name}</div>
            <div className="text-text-muted text-[13px]">{doc.requiredBecause}</div>
            <div>
              {doc.status === "uploaded" ? <Badge tone="success">UPLOADED</Badge> : <Badge tone="error">MISSING</Badge>}
            </div>
            <div>
              {doc.status === "uploaded" ? (
                <button className="text-[13px] text-info" onClick={() => handleUpload(doc)} disabled={isPending}>
                  Replace
                </button>
              ) : (
                <Button size="sm" onClick={() => handleUpload(doc)} disabled={isPending}>
                  Upload
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7 flex justify-end">
        <LinkButton href="/applicant/review">Continue to review →</LinkButton>
      </div>
    </div>
  );
}
