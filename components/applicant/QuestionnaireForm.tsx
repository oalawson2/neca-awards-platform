"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Label, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/lib/utils";
import { saveAnswer, markSectionComplete } from "@/lib/actions/questionnaire";
import type { QuestionnaireAnswer, QuestionnaireSection } from "@/types/domain";

export function QuestionnaireForm({
  applicationId,
  sections,
  initialAnswers,
  initialSectionsCompleted,
}: {
  applicationId: string;
  sections: QuestionnaireSection[];
  initialAnswers: QuestionnaireAnswer[];
  initialSectionsCompleted: number;
}) {
  const router = useRouter();
  const [sectionIndex, setSectionIndex] = useState(Math.min(initialSectionsCompleted, sections.length - 1));
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(initialAnswers.map((a) => [a.questionId, a.value]))
  );
  const [completed, setCompleted] = useState(initialSectionsCompleted);
  const [savedLabel, setSavedLabel] = useState<string | null>(initialAnswers.length ? "Saved" : null);
  const [, startTransition] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const section = sections[sectionIndex];
  const percent = Math.round(((sectionIndex + 1) / sections.length) * 100);

  function updateAnswer(questionId: string, value: string) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    setSavedLabel("Saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      startTransition(async () => {
        await saveAnswer(applicationId, questionId, value);
        setSavedLabel("Saved just now");
      });
    }, 600);
  }

  function goToSection(i: number) {
    setSectionIndex(i);
  }

  function previous() {
    setSectionIndex((i) => Math.max(0, i - 1));
  }

  function saveAndContinue() {
    const newCompleted = Math.max(completed, sectionIndex + 1);
    setCompleted(newCompleted);
    startTransition(async () => {
      await markSectionComplete(applicationId, newCompleted);
    });
    if (sectionIndex < sections.length - 1) {
      setSectionIndex((i) => i + 1);
    } else {
      router.push("/applicant/documents");
    }
  }

  return (
    <div>
      <div className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-8">
        <div className="font-heading font-bold text-navy text-[15px]">Questionnaire</div>
        {savedLabel && (
          <div className="text-[13px] text-success flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            {savedLabel}
          </div>
        )}
      </div>
      <div className="px-6 sm:px-8 pt-5">
        <ProgressBar percent={percent} />
        <div className="text-xs text-text-muted mt-2">
          Section {sectionIndex + 1} of {sections.length} · {percent}% complete
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <aside className="hidden lg:flex lg:w-[280px] flex-col gap-4 border-r border-border px-6 py-6 mt-2">
          <div className="text-xs font-bold tracking-wide text-[#AEB1BC] mb-1">CRITERIA SECTIONS</div>
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToSection(i)}
              className={cn(
                "text-left text-sm flex items-center gap-2",
                i === sectionIndex ? "font-bold text-navy" : i < completed ? "text-success" : "text-[#AEB1BC]"
              )}
            >
              {i < completed ? "✓" : i === sectionIndex ? "→" : ""} {s.title}
            </button>
          ))}
        </aside>

        <div className="lg:hidden flex gap-2 overflow-x-auto px-6 py-4 border-b border-border">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToSection(i)}
              className={cn(
                "flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap",
                i === sectionIndex ? "bg-navy text-white" : i < completed ? "bg-[#E6F4E6] text-success" : "bg-[#F4F4F8] text-[#AEB1BC]"
              )}
            >
              {i < completed ? "✓ " : ""}
              {s.title.split(" ").slice(0, 2).join(" ")}
            </button>
          ))}
        </div>

        <div className="flex-1 px-6 sm:px-8 lg:px-13 py-7 max-w-2xl">
          <div className="flex justify-between items-baseline flex-wrap gap-2 mb-6">
            <h1 className="font-heading font-extrabold text-lg sm:text-xl text-navy">{section.title}</h1>
          </div>

          <div className="flex flex-col gap-6">
            {section.questions.map((q, qi) => (
              <div key={q.id}>
                <Label>
                  {qi + 1}. {q.prompt}
                </Label>
                {q.type === "textarea" && (
                  <Textarea rows={3} value={answers[q.id] ?? ""} onChange={(e) => updateAnswer(q.id, e.target.value)} />
                )}
                {q.type === "number" && (
                  <Input
                    type="number"
                    className="sm:w-48"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => updateAnswer(q.id, e.target.value)}
                  />
                )}
                {q.type === "text" && <Input value={answers[q.id] ?? ""} onChange={(e) => updateAnswer(q.id, e.target.value)} />}
                {q.type === "boolean" && (
                  <div className="flex gap-5 text-sm">
                    {["Yes", "No"].map((opt) => (
                      <label key={opt} className="flex gap-1.5 items-center cursor-pointer">
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt}
                          onChange={() => updateAnswer(q.id, opt)}
                          className="accent-navy"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-9 flex justify-between">
            <Button variant="secondary" onClick={previous} disabled={sectionIndex === 0}>
              ← Previous section
            </Button>
            <Button onClick={saveAndContinue}>
              {sectionIndex === sections.length - 1 ? "Save & finish →" : "Save & continue →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
