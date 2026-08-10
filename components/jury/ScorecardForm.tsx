"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { saveScorecardDimension, saveInterviewFinding, submitScorecard } from "@/lib/actions/scorecards";
import { blendedPillarScore } from "@/lib/scoring/stage2";
import { PILLARS } from "@/lib/mock/framework";
import { PILLAR_SCORE_WEIGHTS } from "@/types/domain";
import type { PillarCode, PillarScorecard, ScorecardRound } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
const DIMENSIONS: { key: "policyExists" | "implementation" | "evidenceQuality" | "measurableImpact"; label: string }[] = [
  { key: "policyExists", label: `Policy Exists (${PILLAR_SCORE_WEIGHTS.policyExists * 100}%)` },
  { key: "implementation", label: `Implementation (${PILLAR_SCORE_WEIGHTS.implementation * 100}%)` },
  { key: "evidenceQuality", label: `Evidence Quality (${PILLAR_SCORE_WEIGHTS.evidenceQuality * 100}%)` },
  { key: "measurableImpact", label: `Measurable Impact (${PILLAR_SCORE_WEIGHTS.measurableImpact * 100}%)` },
];

function emptyCard(applicationId: string, jurorId: string, pillarCode: PillarCode, round: ScorecardRound): PillarScorecard {
  return {
    id: `draft-${pillarCode}`,
    applicationId,
    jurorId,
    pillarCode,
    round,
    policyExists: null,
    implementation: null,
    evidenceQuality: null,
    measurableImpact: null,
    submittedAt: null,
  };
}

export function ScorecardForm({
  applicationId,
  jurorId,
  jurorName,
  organizationName,
  initialCards,
  round = "sector",
}: {
  applicationId: string;
  jurorId: string;
  jurorName: string;
  organizationName: string;
  initialCards: PillarScorecard[];
  round?: ScorecardRound;
}) {
  const router = useRouter();
  const [cardsByPillar, setCardsByPillar] = useState<Record<string, PillarScorecard>>(() => {
    const map: Record<string, PillarScorecard> = {};
    for (const p of SCORED_PILLARS) {
      map[p.code] = initialCards.find((c) => c.pillarCode === p.code) ?? emptyCard(applicationId, jurorId, p.code, round);
    }
    return map;
  });
  const [sectionIndex, setSectionIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outstandingPillars, setOutstandingPillars] = useState<string[] | null>(null);

  const pillar = SCORED_PILLARS[sectionIndex];
  const card = cardsByPillar[pillar.code];
  const percent = Math.round(((sectionIndex + 1) / SCORED_PILLARS.length) * 100);
  const blended = blendedPillarScore(card);

  function setDimension(dimension: (typeof DIMENSIONS)[number]["key"], value: number) {
    setCardsByPillar((prev) => ({ ...prev, [pillar.code]: { ...prev[pillar.code], [dimension]: value } }));
    startTransition(() => {
      saveScorecardDimension(applicationId, jurorId, pillar.code, dimension, value, round);
    });
  }

  function setFinding(value: string) {
    setCardsByPillar((prev) => ({ ...prev, [pillar.code]: { ...prev[pillar.code], interviewFinding: value } }));
    startTransition(() => {
      saveInterviewFinding(applicationId, jurorId, pillar.code, value, round);
    });
  }

  function previous() {
    setSectionIndex((i) => Math.max(0, i - 1));
  }

  function saveAndContinue() {
    setError(null);
    setOutstandingPillars(null);
    const allScored = DIMENSIONS.every((d) => card[d.key] !== null);
    if (!allScored) {
      setError("Score all 4 dimensions before continuing.");
      return;
    }
    if (sectionIndex < SCORED_PILLARS.length - 1) {
      setSectionIndex((i) => i + 1);
      return;
    }
    startTransition(async () => {
      const result = await submitScorecard(applicationId, jurorId, jurorName, round);
      if (!result.success) {
        setError(result.error ?? "Could not submit scorecard.");
        setOutstandingPillars(result.outstandingPillars ?? null);
        return;
      }
      router.push(round === "employer_of_year" ? "/jury/employer-of-year" : "/jury");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="px-6 sm:px-15 pt-4.5">
        <div className="flex justify-end text-[13px] text-text-muted mb-1.5">
          Pillar {sectionIndex + 1} of {SCORED_PILLARS.length}
        </div>
        <div className="h-1.5 rounded-full bg-border">
          <div className="h-1.5 rounded-full bg-gold" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="px-6 sm:px-15 py-7 max-w-3xl mx-auto">
        <h1 className="font-heading font-extrabold text-lg sm:text-xl text-jury mb-1">
          {organizationName} — {pillar.code}: {pillar.name}
        </h1>
        <p className="text-[13px] text-text-muted mb-6.5">
          Score each dimension 0–5, from your document review and interview findings. Your score is confidential
          until the Secretariat closes the scoring window.
          {blended !== null && <span className="font-semibold text-navy"> Blended: {blended}/5</span>}
        </p>

        {error && (
          <div className="text-sm text-error mb-4">
            {error}
            {outstandingPillars && (
              <ul className="list-disc pl-5 mt-1.5">
                {outstandingPillars.map((code) => (
                  <li key={code}>{code} — incomplete</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-6">
          {DIMENSIONS.map((dim) => (
            <div key={dim.key} className="border border-border rounded-2xl p-5">
              <div className="text-sm font-semibold mb-3.5">{dim.label}</div>
              <div className="grid grid-cols-6 sm:flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setDimension(dim.key, n)}
                    className={cn(
                      "h-11 sm:w-11.5 sm:h-11.5 rounded-xl border-[1.5px] font-bold flex items-center justify-center",
                      card[dim.key] === n ? "bg-navy text-white border-navy" : "border-[#E3E4EA] text-text"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="border border-border rounded-2xl p-5">
            <div className="text-sm font-semibold mb-3.5">Interview finding / justification</div>
            <Textarea rows={3} value={card.interviewFinding ?? ""} onChange={(e) => setFinding(e.target.value)} placeholder="Notes justifying these scores (optional)" />
          </div>
        </div>

        <div className="mt-8.5 flex justify-between">
          <Button variant="secondary" onClick={previous} disabled={sectionIndex === 0 || isPending}>
            ← Previous
          </Button>
          <Button onClick={saveAndContinue} loading={isPending}>
            {sectionIndex === SCORED_PILLARS.length - 1 ? "Submit scorecard →" : "Save & continue →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
