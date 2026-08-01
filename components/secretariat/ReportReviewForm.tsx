"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { approveAndReleaseReport, sendBackReport } from "@/lib/actions/reports";
import type { CriterionBreakdownRow } from "@/lib/data/applications";
import type { AIReport } from "@/types/domain";

export function ReportReviewForm({ report, breakdown }: { report: AIReport; breakdown: CriterionBreakdownRow[] }) {
  const router = useRouter();
  const [narrative, setNarrative] = useState(report.narrative);
  const [strengths, setStrengths] = useState(report.strengths.join("\n"));
  const [improvements, setImprovements] = useState(report.improvements.join("\n"));
  const [isPending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      await approveAndReleaseReport(report.id, {
        narrative,
        strengths: strengths.split("\n").filter(Boolean),
        improvements: improvements.split("\n").filter(Boolean),
      });
      router.push("/secretariat/ai-reports");
    });
  }

  function sendBack() {
    startTransition(async () => {
      await sendBackReport(report.id);
      router.push("/secretariat/ai-reports");
    });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-7">
      <div className="flex-1">
        <div className="text-xs font-bold text-[#AEB1BC] mb-2.5">
          DRAFT NARRATIVE (editable — released to applicant as a normal assessment, no AI attribution)
        </div>
        <Textarea rows={6} value={narrative} onChange={(e) => setNarrative(e.target.value)} />

        <div className="text-xs font-bold text-success mt-4 mb-1.5">STRENGTHS (editable, one per line)</div>
        <Textarea rows={3} value={strengths} onChange={(e) => setStrengths(e.target.value)} />

        <div className="text-xs font-bold text-warning mt-4 mb-1.5">AREAS TO IMPROVE (editable, one per line)</div>
        <Textarea rows={3} value={improvements} onChange={(e) => setImprovements(e.target.value)} />
      </div>

      <div className="sm:w-70 flex-shrink-0">
        <div className="border border-border rounded-2xl p-5.5">
          <div className="font-bold text-sm mb-3">Score breakdown</div>
          <div className="text-[13px] text-[#5B5F6B] flex flex-col gap-1.5">
            {breakdown.map((row) => (
              <div key={row.criterionId}>
                {row.name} — {row.averagePoints}/{row.maxPoints}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5 mt-4">
          <Button onClick={approve} disabled={isPending}>
            Approve &amp; release
          </Button>
          <Button variant="secondary" onClick={sendBack} disabled={isPending}>
            Send back for revision
          </Button>
        </div>
      </div>
    </div>
  );
}
