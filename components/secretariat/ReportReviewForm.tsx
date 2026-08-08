"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { generateReport, approveAndReleaseReport, sendBackReport } from "@/lib/actions/reports";
import type { NonShortlistedReport, ShortlistedReport } from "@/types/domain";

export function ReportReviewForm({
  applicationId,
  organizationName,
  isShortlisted,
  shortlistedReport,
  nonShortlistedReport,
  reviewerName,
}: {
  applicationId: string;
  organizationName: string;
  isShortlisted: boolean;
  shortlistedReport: ShortlistedReport | null;
  nonShortlistedReport: NonShortlistedReport | null;
  reviewerName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function generate() {
    setMessage(null);
    startTransition(async () => {
      await generateReport(applicationId);
      setMessage("Generated. Refresh to see the draft.");
    });
  }

  function approve() {
    startTransition(async () => {
      await approveAndReleaseReport(applicationId, reviewerName);
      setMessage("Approved and released to the applicant.");
    });
  }

  function sendBack() {
    startTransition(async () => {
      await sendBackReport(applicationId, reviewerName);
      setMessage("Sent back — regenerate when ready.");
    });
  }

  const report = isShortlisted ? shortlistedReport : nonShortlistedReport;

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl text-navy-dark mb-1">{organizationName}</h1>
      <p className="text-[13px] text-text-muted mb-6">
        {isShortlisted ? "Verified Score report (shortlisted applicant)" : "Stage 1 feedback summary (not shortlisted)"}
      </p>

      {message && <div className="text-sm text-success mb-4">{message}</div>}

      {!report ? (
        <div className="border border-border rounded-2xl p-6 text-center">
          <p className="text-sm text-text-muted mb-4">No report generated yet.</p>
          <Button onClick={generate} disabled={isPending}>
            Generate report
          </Button>
        </div>
      ) : isShortlisted && shortlistedReport ? (
        <div className="border border-border rounded-2xl p-5 mb-4">
          <div className="font-heading font-extrabold text-2xl text-navy mb-4">{shortlistedReport.verifiedScore}%</div>
          <div className="flex flex-col gap-3 mb-5">
            {shortlistedReport.pillarBreakdown.map((p) => (
              <div key={p.pillarCode}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span>{p.pillarCode}</span>
                  <span className="font-bold">{p.contributionPercent}%</span>
                </div>
                <ProgressBar percent={(p.panelPillarScore / 5) * 100} />
              </div>
            ))}
          </div>
          <p className="text-[13px] leading-relaxed mb-3">{shortlistedReport.narrative}</p>
          <div className="text-xs font-bold text-success mb-1">STRENGTHS</div>
          <ul className="list-disc pl-5 text-[13px] mb-3">
            {shortlistedReport.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <div className="text-xs font-bold text-warning mb-1">AREAS TO IMPROVE</div>
          <ul className="list-disc pl-5 text-[13px]">
            {shortlistedReport.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : nonShortlistedReport ? (
        <div className="border border-border rounded-2xl p-5 mb-4">
          <div className="flex flex-col gap-4">
            {nonShortlistedReport.pillarSummary.map((p) => (
              <div key={p.pillarCode}>
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span className="font-semibold">{p.pillarCode}</span>
                  <span className="font-bold">{p.stage1ScorePercent}%</span>
                </div>
                {p.strengths.map((s) => (
                  <div key={s} className="text-xs text-success">
                    ✓ {s}
                  </div>
                ))}
                {p.gaps.map((g) => (
                  <div key={g} className="text-xs text-warning">
                    ⚠ {g}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {report && (
        <div className="flex gap-3">
          <Button variant="secondary" onClick={generate} disabled={isPending}>
            Regenerate
          </Button>
          {report.status !== "approved" && (
            <>
              <Button variant="secondary" onClick={sendBack} disabled={isPending}>
                Send back
              </Button>
              <Button onClick={approve} disabled={isPending}>
                Approve &amp; release
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
