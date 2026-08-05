"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { saveScoreItem, submitScorecard } from "@/lib/actions/scoring";
import type { Criterion, JurorScorecard } from "@/types/domain";

export function ScorecardForm({
  applicationId,
  jurorId,
  jurorName,
  organizationName,
  criteria,
  scorecard,
}: {
  applicationId: string;
  jurorId: string;
  jurorName: string;
  organizationName: string;
  criteria: Criterion[];
  scorecard: JurorScorecard;
}) {
  const router = useRouter();
  const [criteriaScores, setCriteriaScores] = useState(scorecard.criteriaScores);
  const [sectionIndex, setSectionIndex] = useState(
    Math.max(0, criteriaScores.findIndex((c) => c.items.some((i) => i.value === null)))
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outstandingDocuments, setOutstandingDocuments] = useState<string[] | null>(null);

  const criterion = criteria[sectionIndex];
  const criterionScore = criteriaScores[sectionIndex];
  const percent = Math.round(((sectionIndex + 1) / criteria.length) * 100);

  function setItemValue(itemId: string, value: number) {
    setCriteriaScores((prev) =>
      prev.map((c, ci) =>
        ci === sectionIndex ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, value } : i)) } : c
      )
    );
    startTransition(() => {
      saveScoreItem(applicationId, jurorId, criterion.id, itemId, value);
    });
  }

  function setItemNote(itemId: string, note: string) {
    setCriteriaScores((prev) =>
      prev.map((c, ci) => (ci === sectionIndex ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, note } : i)) } : c))
    );
  }

  function previous() {
    setSectionIndex((i) => Math.max(0, i - 1));
  }

  function saveAndContinue() {
    setError(null);
    setOutstandingDocuments(null);
    const allScoredInSection = criterionScore.items.every((i) => i.value !== null);
    if (!allScoredInSection) {
      setError("Score every item in this section before continuing.");
      return;
    }
    if (sectionIndex < criteria.length - 1) {
      setSectionIndex((i) => i + 1);
      return;
    }
    startTransition(async () => {
      const result = await submitScorecard(applicationId, jurorId, jurorName);
      if (!result.success) {
        setError(result.outstandingDocuments?.length ? "Outstanding document reviews are blocking submission:" : result.error ?? "Could not submit scorecard.");
        setOutstandingDocuments(result.outstandingDocuments ?? null);
        return;
      }
      router.push("/jury");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="px-6 sm:px-15 pt-4.5">
        <div className="flex justify-end text-[13px] text-text-muted mb-1.5">
          Section {sectionIndex + 1} of {criteria.length}
        </div>
        <div className="h-1.5 rounded-full bg-border">
          <div className="h-1.5 rounded-full bg-gold" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="px-6 sm:px-15 py-7 max-w-3xl mx-auto">
        <h1 className="font-heading font-extrabold text-lg sm:text-xl text-jury mb-1">
          {organizationName} — {criterion.name}
        </h1>
        <p className="text-[13px] text-text-muted mb-6.5">Score each item 0–5. Your score is confidential.</p>

        {error && (
          <div className="text-sm text-error mb-4">
            {error}
            {outstandingDocuments && outstandingDocuments.length > 0 && (
              <ul className="list-disc pl-5 mt-1.5">
                {outstandingDocuments.map((name) => (
                  <li key={name}>{name} — needs certify or mark not compliant</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6">
          {criterionScore.items.map((item) => (
            <div key={item.id} className="border border-border rounded-2xl p-5">
              <div className="text-sm font-semibold mb-3.5">{item.prompt}</div>
              <div className="grid grid-cols-6 sm:flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setItemValue(item.id, n)}
                    className={cn(
                      "h-11 sm:w-11.5 sm:h-11.5 rounded-xl border-[1.5px] font-bold flex items-center justify-center",
                      item.value === n ? "bg-navy text-white border-navy" : "border-[#E3E4EA] text-text"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Textarea
                rows={2}
                placeholder="Notes to justify your score (optional)"
                className="mt-3.5"
                value={item.note ?? ""}
                onChange={(e) => setItemNote(item.id, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mt-8.5 flex justify-between">
          <Button variant="secondary" onClick={previous} disabled={sectionIndex === 0 || isPending}>
            ← Previous
          </Button>
          <Button onClick={saveAndContinue} disabled={isPending}>
            {sectionIndex === criteria.length - 1 ? "Submit scorecard →" : "Save & continue →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
