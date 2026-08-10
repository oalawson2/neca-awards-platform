"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { conveneEmployerOfYear, validateEmployerOfYearWinner } from "@/lib/actions/winners";
import type { EmployerOfYearResult, EmployerOfYearValidation } from "@/types/domain";

export function EmployerOfYearPanel({
  hasFinalists,
  results,
  finalistNames,
  validation,
  currentUserId,
  currentUserName,
}: {
  hasFinalists: boolean;
  results: EmployerOfYearResult[];
  finalistNames: Record<string, string>;
  validation: EmployerOfYearValidation;
  currentUserId: string;
  currentUserName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function convene() {
    setMessage(null);
    startTransition(async () => {
      const result = await conveneEmployerOfYear();
      setMessage(result.success ? `Convened with ${result.finalistCount} finalists.` : result.error ?? "Could not convene.");
    });
  }

  function validate(applicationId: string) {
    startTransition(async () => {
      await validateEmployerOfYearWinner(applicationId, currentUserId, currentUserName);
    });
  }

  if (!hasFinalists) {
    return (
      <div className="border border-border rounded-2xl p-5">
        <div className="font-bold text-sm text-navy-dark mb-2">Employer of the Year</div>
        <p className="text-[13px] text-text-muted mb-3">
          Once every sector&rsquo;s panel has confirmed a sectoral winner, convene the cross-sector round — all 9
          jurors independently re-score every winner from scratch.
        </p>
        <Button size="sm" onClick={convene} loading={isPending}>
          Convene Employer of the Year round
        </Button>
        {message && <div className="text-xs text-text-muted mt-2">{message}</div>}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="font-bold text-sm text-navy-dark mb-1">Employer of the Year — ranking</div>
      <p className="text-[13px] text-text-muted mb-4">
        Overall Verified Score = mean of all 9 jurors&rsquo; individual scores. Spread shown per finalist.
      </p>
      <div className="flex flex-col gap-2">
        {results.map((r) => (
          <div key={r.applicationId} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 rounded-xl bg-bg flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="w-5 text-text-muted font-mono text-xs">#{r.rank}</span>
              <span className="font-semibold">{finalistNames[r.applicationId]}</span>
              <span className="font-bold">{r.overallVerifiedScore}%</span>
              <span className="text-xs text-text-muted">
                ({r.individualScores.length}/9 scored — spread {r.individualScores.length > 0 ? `${Math.min(...r.individualScores)}–${Math.max(...r.individualScores)}` : "—"})
              </span>
            </div>
            {validation.validated ? (
              validation.winnerApplicationId === r.applicationId && <Badge tone="winner">EMPLOYER OF THE YEAR</Badge>
            ) : (
              r.individualScores.length === 9 && (
                <Button size="sm" onClick={() => validate(r.applicationId)} loading={isPending}>
                  Jury Committee validate as winner
                </Button>
              )
            )}
          </div>
        ))}
      </div>
      {validation.validated && (
        <p className="text-xs text-success mt-3">
          Validated by {currentUserId === validation.validatedByUserId ? "you" : "the Chair/co-chair"} — final decision recorded.
        </p>
      )}
    </div>
  );
}
