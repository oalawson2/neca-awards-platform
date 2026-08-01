"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { reviewAndSetPreliminaryScore } from "@/lib/actions/submission";

/**
 * Judgment call: the wireframes' Application Detail screen (10) doesn't show
 * an explicit "mark reviewed" control. This small form fills that gap so an
 * awaiting_review application can actually be advanced (or held back) against
 * the configured threshold — otherwise there'd be no way to reach the jury
 * scoring stage in this mock demo.
 */
export function PreliminaryScoreForm({ applicationId, threshold }: { applicationId: string; threshold: number }) {
  const [score, setScore] = useState(threshold);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    startTransition(async () => {
      await reviewAndSetPreliminaryScore(applicationId, score);
      setDone(true);
    });
  }

  if (done) return <p className="text-sm text-success">Preliminary score saved — refresh to see the updated status.</p>;

  return (
    <div className="border border-border rounded-2xl p-5 bg-bg">
      <div className="font-bold text-sm mb-1">Secretariat completeness review</div>
      <p className="text-[13px] text-text-muted mb-3.5">
        Set a preliminary (completeness) score. Applications at or above {threshold} advance to jury scoring
        automatically; this score carries zero weight in the final jury-driven score.
      </p>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-28"
        />
        <Button size="sm" onClick={submit} disabled={isPending}>
          Save & {score >= threshold ? "advance to jury" : "mark incomplete"}
        </Button>
      </div>
    </div>
  );
}
