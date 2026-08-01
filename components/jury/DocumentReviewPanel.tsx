"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { certifyDocument, flagDocument } from "@/lib/actions/documents";
import type { RequiredDocument } from "@/types/domain";

export function DocumentReviewPanel({
  organizationName,
  documents,
  jurorId,
  jurorName,
}: {
  organizationName: string;
  documents: RequiredDocument[];
  jurorId: string;
  jurorName: string;
}) {
  const uploaded = documents.filter((d) => d.status === "uploaded");
  const [docs, setDocs] = useState(documents);
  const [activeId, setActiveId] = useState(uploaded[0]?.id ?? documents[0]?.id);
  const [isPending, startTransition] = useTransition();

  const active = docs.find((d) => d.id === activeId) ?? docs[0];
  const certifiedCount = docs.filter((d) => d.certifiedByJurorId).length;

  function certify() {
    if (!active) return;
    startTransition(async () => {
      await certifyDocument(active.id, jurorId, jurorName);
      setDocs((prev) => prev.map((d) => (d.id === active.id ? { ...d, certifiedByJurorId: jurorId, flaggedIssue: null } : d)));
      goNext();
    });
  }

  function flag() {
    if (!active) return;
    startTransition(async () => {
      await flagDocument(active.id, jurorName, "Issue flagged for review");
      setDocs((prev) => prev.map((d) => (d.id === active.id ? { ...d, flaggedIssue: "Issue flagged for review", certifiedByJurorId: null } : d)));
    });
  }

  function goNext() {
    const idx = docs.findIndex((d) => d.id === active?.id);
    const next = docs[idx + 1];
    if (next) setActiveId(next.id);
  }

  if (!active) {
    return <div className="p-8 text-sm text-text-muted">No documents were uploaded for this application.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-6 sm:px-8 py-2.5 border-b border-border">
        <div className="text-[13px] font-bold text-navy">
          {certifiedCount} of {docs.length} certified
        </div>
      </div>
      <div className="flex flex-col sm:flex-row flex-1 min-h-0">
      <div className="sm:w-75 sm:border-r border-border p-5.5 overflow-y-auto flex-shrink-0">
        <div className="text-xs text-text-muted mb-3">{organizationName}</div>
        <div className="flex flex-col gap-2">
          {docs.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={cn(
                "text-left rounded-xl px-3.5 py-3.5 border",
                d.id === active.id ? "border-[1.5px] border-navy bg-[#F1F1FB]" : "border-border"
              )}
            >
              <div className={cn("text-[13px]", d.id === active.id ? "font-bold" : "font-semibold")}>{d.name}</div>
              {d.status === "missing" ? (
                <div className="text-xs text-error mt-1">Not uploaded</div>
              ) : d.certifiedByJurorId ? (
                <div className="text-xs text-success mt-1">✓ Certified compliant</div>
              ) : d.flaggedIssue ? (
                <div className="text-xs text-error mt-1">⚠ Flagged</div>
              ) : (
                <div className="text-xs text-warning mt-1">Awaiting review</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 sm:p-8 flex flex-col">
        {active.status === "missing" ? (
          <div className="flex-1 flex items-center justify-center text-sm text-text-muted border border-border rounded-2xl">
            This document wasn&rsquo;t uploaded by the applicant.
          </div>
        ) : (
          <>
            <div
              className="flex-1 border border-border rounded-2xl flex items-center justify-center text-[13px] text-[#AEB1BC] font-mono min-h-56"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, #FAFAFC, #FAFAFC 10px, #F1F1F5 10px, #F1F1F5 20px)",
              }}
            >
              PDF viewer — {active.fileName}
            </div>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="flex gap-2.5 items-center text-sm font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  className="w-[18px] h-[18px] accent-navy"
                  checked={!!active.certifiedByJurorId}
                  onChange={(e) => (e.target.checked ? certify() : undefined)}
                  disabled={isPending}
                />
                Certify this document as compliant
              </label>
              <div className="flex gap-2.5">
                <button
                  onClick={flag}
                  disabled={isPending}
                  className="border-[1.5px] border-error text-error rounded-[10px] px-4.5 py-2.5 text-[13px] font-semibold"
                >
                  Flag issue
                </button>
                <button
                  onClick={goNext}
                  className="bg-navy text-white rounded-[10px] px-5 py-2.5 text-[13px] font-semibold"
                >
                  Next document →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
