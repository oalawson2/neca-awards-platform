"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { verifyDocumentCredible, flagDocument } from "@/lib/actions/stage2a";
import { requestInterview } from "@/lib/actions/interviews";
import { RED_FLAG_LABELS } from "@/types/domain";
import type { DocumentVerification, RedFlag, RedFlagReason } from "@/types/domain";
import type { DocumentWithVerification } from "@/lib/data/stage2a";

const RED_FLAG_REASONS = Object.keys(RED_FLAG_LABELS) as RedFlagReason[];

export function DocumentVerificationPanel({
  applicationId,
  organizationName,
  documents,
  jurorId,
  jurorName,
  redFlagCount,
  interviewAlreadyRequested,
}: {
  applicationId: string;
  organizationName: string;
  documents: DocumentWithVerification[];
  jurorId: string;
  jurorName: string;
  redFlagCount: number;
  interviewAlreadyRequested: boolean;
}) {
  const [items, setItems] = useState(documents);
  const [activeId, setActiveId] = useState(documents[0]?.id);
  const [flagReason, setFlagReason] = useState<RedFlagReason>("undated");
  const [isPending, startTransition] = useTransition();
  const [interviewRequested, setInterviewRequested] = useState(interviewAlreadyRequested);
  const [interviewError, setInterviewError] = useState<string | null>(null);

  const active = items.find((d) => d.id === activeId) ?? items[0];
  const reviewedCount = items.filter((d) => d.myVerification).length;
  const allReviewed = items.length > 0 && reviewedCount === items.length;

  function handleRequestInterview() {
    setInterviewError(null);
    startTransition(async () => {
      const result = await requestInterview(applicationId, jurorId, jurorName);
      if (result.success) setInterviewRequested(true);
      else setInterviewError(result.error ?? "Could not request interview.");
    });
  }

  function goNext() {
    const idx = items.findIndex((d) => d.id === active?.id);
    const next = items[idx + 1];
    if (next) setActiveId(next.id);
  }

  function markCredible() {
    if (!active) return;
    startTransition(async () => {
      await verifyDocumentCredible(active.id, jurorId);
      const verification: DocumentVerification = {
        id: active.myVerification?.id ?? `local-${active.id}`,
        documentId: active.id,
        jurorId,
        credible: true,
        reviewedAt: new Date().toISOString(),
      };
      setItems((prev) => prev.map((d) => (d.id === active.id ? { ...d, myVerification: verification, myRedFlag: null } : d)));
      goNext();
    });
  }

  function markFlagged() {
    if (!active) return;
    startTransition(async () => {
      await flagDocument(active.id, jurorId, flagReason);
      const verification: DocumentVerification = {
        id: active.myVerification?.id ?? `local-${active.id}`,
        documentId: active.id,
        jurorId,
        credible: false,
        reviewedAt: new Date().toISOString(),
      };
      const redFlag: RedFlag = {
        id: active.myRedFlag?.id ?? `local-flag-${active.id}`,
        documentId: active.id,
        jurorId,
        reason: flagReason,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => prev.map((d) => (d.id === active.id ? { ...d, myVerification: verification, myRedFlag: redFlag } : d)));
      goNext();
    });
  }

  if (!active) {
    return <div className="p-8 text-sm text-text-muted">No uploaded documents to verify for this applicant yet.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 sm:px-8 py-2.5 border-b border-border gap-3 flex-wrap">
        <div className="text-[13px] font-bold text-navy">
          {reviewedCount} of {items.length} documents reviewed
        </div>
        <div className="flex items-center gap-2.5">
          {redFlagCount >= 3 && <Badge tone="error">3+ RED FLAGS — SECRETARIAT REVIEW TRIGGERED</Badge>}
          {interviewRequested ? (
            <span className="text-[13px] font-semibold text-success">✓ Interview requested</span>
          ) : allReviewed ? (
            <>
              {interviewError && <span className="text-xs text-error">{interviewError}</span>}
              <button
                onClick={handleRequestInterview}
                disabled={isPending}
                className="bg-gold text-white rounded-[10px] px-4 py-2 text-[13px] font-semibold"
              >
                Request Interview
              </button>
            </>
          ) : (
            <span className="text-xs text-text-muted">Review every document to unlock interview requests</span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-1 min-h-0">
        <div className="sm:w-75 sm:border-r border-border p-5.5 overflow-y-auto flex-shrink-0">
          <div className="text-xs text-text-muted mb-3">{organizationName}</div>
          <div className="flex flex-col gap-2">
            {items.map((d) => (
              <button
                key={d.id}
                onClick={() => setActiveId(d.id)}
                className={cn(
                  "text-left rounded-xl px-3.5 py-3.5 border",
                  d.id === active.id ? "border-[1.5px] border-navy bg-[#F1F1FB]" : "border-border"
                )}
              >
                <div className={cn("text-[13px]", d.id === active.id ? "font-bold" : "font-semibold")}>{d.name}</div>
                {d.myVerification?.credible === true && <div className="text-xs text-success mt-1">✓ Verified credible</div>}
                {d.myVerification?.credible === false && <div className="text-xs text-error mt-1">⚠ Red-flagged</div>}
                {!d.myVerification && <div className="text-xs text-warning mt-1">Awaiting review</div>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 sm:p-8 flex flex-col">
          <div
            className="flex-1 border border-border rounded-2xl flex items-center justify-center text-[13px] text-[#AEB1BC] font-mono min-h-56"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, #FAFAFC, #FAFAFC 10px, #F1F1F5 10px, #F1F1F5 20px)" }}
          >
            PDF viewer — {active.fileName}
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <div className="text-[13px] font-semibold">
              {active.myVerification?.credible === true && <span className="text-success">✓ Verified credible</span>}
              {active.myVerification?.credible === false && <span className="text-error">⚠ Red-flagged: {active.myRedFlag ? RED_FLAG_LABELS[active.myRedFlag.reason] : ""}</span>}
              {!active.myVerification && <span className="text-text-muted">Not yet reviewed</span>}
            </div>
            <div className="flex flex-wrap gap-2.5 items-center">
              <select
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value as RedFlagReason)}
                className="border-[1.5px] border-[#E3E4EA] rounded-xl px-3 py-2.5 text-[13px]"
              >
                {RED_FLAG_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {RED_FLAG_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                onClick={markFlagged}
                disabled={isPending}
                className={cn(
                  "border-[1.5px] rounded-[10px] px-4.5 py-2.5 text-[13px] font-semibold",
                  active.myVerification?.credible === false ? "bg-error text-white border-error" : "border-error text-error"
                )}
              >
                Red-flag document
              </button>
              <button
                onClick={markCredible}
                disabled={isPending}
                className={cn(
                  "rounded-[10px] px-5 py-2.5 text-[13px] font-semibold",
                  active.myVerification?.credible === true ? "bg-success text-white" : "bg-navy text-white"
                )}
              >
                Verify as credible
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
