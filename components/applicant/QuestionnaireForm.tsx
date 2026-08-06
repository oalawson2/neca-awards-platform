"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AssessmentItemField } from "@/components/applicant/AssessmentItemField";
import { saveAnswer } from "@/lib/actions/answers";
import { effectiveItemsForPillar } from "@/lib/scoring/stage1";
import { PILLARS } from "@/lib/mock/framework";
import type { AnswerValue, AssessmentAnswer, PillarCode } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);

export function QuestionnaireForm({
  applicationId,
  isUnionised,
  initialAnswers,
}: {
  applicationId: string;
  isUnionised: boolean;
  initialAnswers: AssessmentAnswer[];
}) {
  const router = useRouter();
  const [pillarIndex, setPillarIndex] = useState(0);
  const [answersByItem, setAnswersByItem] = useState<Record<string, AssessmentAnswer>>(
    Object.fromEntries(initialAnswers.map((a) => [a.itemId, a]))
  );
  const [, startTransition] = useTransition();

  const pillar = SCORED_PILLARS[pillarIndex];
  const items = effectiveItemsForPillar(pillar.code, isUnionised);

  const answeredCountByPillar = (code: PillarCode) =>
    effectiveItemsForPillar(code, isUnionised).filter((i) => {
      const a = answersByItem[i.id];
      return a && (a.isNA || a.value !== null);
    }).length;

  function handleChange(itemId: string, value: AnswerValue, isNA: boolean, naJustification: string) {
    const next: AssessmentAnswer = { applicationId, itemId, value, isNA, naJustification: isNA ? naJustification : undefined };
    setAnswersByItem((prev) => ({ ...prev, [itemId]: next }));
    startTransition(() => {
      saveAnswer(applicationId, itemId, value, isNA, naJustification);
    });
  }

  function goToPillar(index: number) {
    setPillarIndex(Math.max(0, Math.min(SCORED_PILLARS.length - 1, index)));
  }

  function continueOrFinish() {
    if (pillarIndex < SCORED_PILLARS.length - 1) {
      goToPillar(pillarIndex + 1);
    } else {
      router.push("/applicant/documents");
    }
  }

  const totalItems = SCORED_PILLARS.reduce((sum, p) => sum + effectiveItemsForPillar(p.code, isUnionised).length, 0);
  const totalAnswered = SCORED_PILLARS.reduce((sum, p) => sum + answeredCountByPillar(p.code), 0);

  return (
    <div className="flex flex-col lg:flex-row">
      <aside className="lg:w-72 lg:border-r border-border px-6 sm:px-8 lg:px-6 py-6 flex-shrink-0">
        <div className="hidden lg:flex flex-col gap-1.5">
          <div className="text-xs font-bold tracking-wide text-[#AEB1BC] mb-2">SECTIONS B–I</div>
          {SCORED_PILLARS.map((p, i) => {
            const count = answeredCountByPillar(p.code);
            const total = effectiveItemsForPillar(p.code, isUnionised).length;
            const complete = count === total;
            return (
              <button
                key={p.code}
                onClick={() => goToPillar(i)}
                className={
                  "text-left px-3 py-2.5 rounded-xl text-[13px] flex items-center justify-between gap-2 " +
                  (i === pillarIndex ? "bg-[#F1F1FB] font-semibold text-navy" : "text-text")
                }
              >
                <span>
                  {p.code} — {p.name}
                </span>
                <span className={complete ? "text-success text-xs font-bold" : "text-[#AEB1BC] text-xs"}>
                  {complete ? "✓" : `${count}/${total}`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="lg:hidden">
          <ProgressBar percent={(totalAnswered / Math.max(1, totalItems)) * 100} />
          <div className="text-xs text-text-muted mt-2">
            {totalAnswered} of {totalItems} items answered
          </div>
        </div>
      </aside>

      <div className="flex-1 px-6 sm:px-8 lg:px-13 py-8 lg:py-10 max-w-3xl">
        <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-navy mb-1.5">
          Section {pillar.code} — {pillar.name}
        </h1>
        <p className="text-[13px] text-text-muted mb-6">Weight: {pillar.weightPoints}% of overall score.</p>

        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const answer = answersByItem[item.id];
            return (
              <AssessmentItemField
                key={item.id}
                item={item}
                value={answer?.value ?? null}
                isNA={answer?.isNA ?? false}
                naJustification={answer?.naJustification ?? ""}
                onChange={(value, isNA, naJustification) => handleChange(item.id, value, isNA, naJustification)}
              />
            );
          })}
        </div>

        <div className="mt-9 flex justify-between gap-3">
          <Button variant="secondary" onClick={() => goToPillar(pillarIndex - 1)} disabled={pillarIndex === 0}>
            ← Previous
          </Button>
          <Button onClick={continueOrFinish}>
            {pillarIndex < SCORED_PILLARS.length - 1 ? "Save & continue →" : "Continue to documents →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
