"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { certifyDocument, rejectDocument } from "@/lib/actions/documents";
import { requestInterview } from "@/lib/actions/interviews";
import type { DocumentReview, DocumentReviewStatus, InterviewRequest, RequiredDocument } from "@/types/domain";

export function DocumentReviewPanel({
  applicationId,
  organizationName,
  documents,
  myReviews,
  jurorId,
  jurorName,
  interviewRequest,
}: {
  applicationId: string;
  organizationName: string;
  documents: RequiredDocument[];
  myReviews: DocumentReview[];
  jurorId: string;
  jurorName: string;
  interviewRequest: InterviewRequest | null;
}) {
  const uploaded = documents.filter((d) => d.status === "uploaded");
  const [reviewStatusByDoc, setReviewStatusByDoc] = useState<Record<string, DocumentReviewStatus>>(
    Object.fromEntries(myReviews.map((r) => [r.documentId, r.status]))
  );
  const [activeId, setActiveId] = useState(uploaded[0]?.id ?? documents[0]?.id);
  const [isPending, startTransition] = useTransition();
  const [interviewRequested, setInterviewRequested] = useState(!!interviewRequest);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  const active = documents.find((d) => d.id === activeId) ?? documents[0];
  const reviewedCount = uploaded.filter((d) => reviewStatusByDoc[d.id]).length;
  const outstanding = uploaded.filter((d) => !reviewStatusByDoc[d.id]);
  const allReviewed = outstanding.length === 0 && uploaded.length > 0;

  function certify() {
    if (!active) return;
    startTransition(async () => {
      await certifyDocument(active.id, jurorId, jurorName);
      setReviewStatusByDoc((prev) => ({ ...prev, [active.id]: "certified" }));
      goNext();
    });
  }

  function reject() {
    if (!active) return;
    startTransition(async () => {
      await rejectDocument(active.id, jurorId, jurorName, "Marked not compliant by juror");
      setReviewStatusByDoc((prev) => ({ ...prev, [active.id]: "rejected" }));
      goNext();
    });
  }

  function goNext() {
    const idx = documents.findIndex((d) => d.id === active?.id);
    const next = documents[idx + 1];
    if (next) setActiveId(next.id);
  }

  function handleRequestInterview() {
    setInterviewError(null);
    startTransition(async () => {
      const result = await requestInterview(applicationId, jurorId, jurorName);
      if (result.success) setInterviewRequested(true);
      else setInterviewError(result.error ?? "Could not request interview.");
    });
  }

  if (!active) {
    return <div className="p-8 text-sm text-text-muted">No documents were uploaded for this application.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 sm:px-8 py-2.5 border-b border-border gap-3 flex-wrap">
        <div className="text-[13px] font-bold text-navy">
          {reviewedCount} of {uploaded.length} reviewed
        </div>
        {interviewRequested ? (
          <span className="text-[13px] font-semibold text-success">✓ Interview requested</span>
        ) : allReviewed ? (
          <div className="flex items-center gap-2.5">
            {interviewError && <span className="text-xs text-error">{interviewError}</span>}
            <button
              onClick={handleRequestInterview}
              disabled={isPending}
              className="bg-gold text-white rounded-[10px] px-4 py-2 text-[13px] font-semibold"
            >
              Request Interview
            </button>
          </div>
        ) : (
          <span className="text-xs text-text-muted">
            Review every uploaded document to unlock interview requests
          </span>
        )}
      </div>
      <div className="flex flex-col sm:flex-row flex-1 min-h-0">
        <div className="sm:w-75 sm:border-r border-border p-5.5 overflow-y-auto flex-shrink-0">
          <div className="text-xs text-text-muted mb-3">{organizationName}</div>
          <div className="flex flex-col gap-2">
            {documents.map((d) => {
              const status = reviewStatusByDoc[d.id];
              return (
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
                  ) : status === "certified" ? (
                    <div className="text-xs text-success mt-1">✓ Certified compliant</div>
                  ) : status === "rejected" ? (
                    <div className="text-xs text-error mt-1">✕ Not compliant</div>
                  ) : (
                    <div className="text-xs text-warning mt-1">Awaiting review</div>
                  )}
                </button>
              );
            })}
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
                <div className="text-[13px] font-semibold">
                  {reviewStatusByDoc[active.id] === "certified" && <span className="text-success">✓ Certified compliant</span>}
                  {reviewStatusByDoc[active.id] === "rejected" && <span className="text-error">✕ Marked not compliant</span>}
                  {!reviewStatusByDoc[active.id] && <span className="text-text-muted">Not yet reviewed</span>}
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={reject}
                    disabled={isPending}
                    className={cn(
                      "border-[1.5px] rounded-[10px] px-4.5 py-2.5 text-[13px] font-semibold",
                      reviewStatusByDoc[active.id] === "rejected" ? "bg-error text-white border-error" : "border-error text-error"
                    )}
                  >
                    Mark not compliant
                  </button>
                  <button
                    onClick={certify}
                    disabled={isPending}
                    className={cn(
                      "rounded-[10px] px-5 py-2.5 text-[13px] font-semibold",
                      reviewStatusByDoc[active.id] === "certified" ? "bg-success text-white" : "bg-navy text-white"
                    )}
                  >
                    Certify compliant
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
