"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { submitStage1Application } from "@/lib/actions/submission";
import type { Organization } from "@/types/domain";
import type { QuestionnaireProgress } from "@/lib/data/answers";
import type { ChecklistStatus } from "@/lib/data/checklist";

export function ReviewSubmit({
  applicationId,
  organization,
  progress,
  checklistStatus,
}: {
  applicationId: string;
  organization: Organization;
  progress: QuestionnaireProgress;
  checklistStatus: ChecklistStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [outstandingQuestions, setOutstandingQuestions] = useState<string[] | null>(null);
  const [outstandingDocuments, setOutstandingDocuments] = useState<string[] | null>(null);

  function submit() {
    setError(null);
    setOutstandingQuestions(null);
    setOutstandingDocuments(null);
    startTransition(async () => {
      const result = await submitStage1Application(applicationId);
      if (!result.success) {
        setError(result.error ?? "Could not submit application.");
        setOutstandingQuestions(result.outstandingQuestions ?? null);
        setOutstandingDocuments(result.outstandingDocuments ?? null);
        return;
      }
      router.push("/applicant/submitted");
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-navy mb-1.5">Review &amp; submit</h1>
      <p className="text-[13px] text-text-muted mb-6">
        Once submitted, your Section B–I answers are locked. You can still be asked for more evidence during jury
        review if you&rsquo;re shortlisted.
      </p>

      <div className="border border-border rounded-2xl p-5 mb-4">
        <div className="font-bold text-sm mb-3">{organization.name || "(unnamed organisation)"}</div>
        <SummaryRow label="Questionnaire" value={`${progress.answeredItems} of ${progress.totalItems} items answered`} ok={progress.isComplete} />
        <SummaryRow
          label="Mandatory documents"
          value={`${checklistStatus.mandatoryUploaded} of ${checklistStatus.mandatoryTotal} uploaded`}
          ok={checklistStatus.allMandatoryUploaded}
        />
        <SummaryRow
          label="Advanced documents"
          value={`${checklistStatus.advancedUploaded} of ${checklistStatus.advancedTotal} uploaded (optional)`}
          ok
        />
      </div>

      {error && (
        <div className="text-sm text-error mb-4">
          {error}
          {outstandingQuestions && (
            <div className="mt-2">
              <div className="font-semibold text-xs mb-1">Unanswered questions:</div>
              <ul className="list-disc pl-5">
                {outstandingQuestions.slice(0, 10).map((q) => (
                  <li key={q}>{q}</li>
                ))}
                {outstandingQuestions.length > 10 && <li>…and {outstandingQuestions.length - 10} more</li>}
              </ul>
            </div>
          )}
          {outstandingDocuments && (
            <div className="mt-2">
              <div className="font-semibold text-xs mb-1">Missing mandatory documents:</div>
              <ul className="list-disc pl-5">
                {outstandingDocuments.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between gap-3">
        <Button variant="secondary" onClick={() => router.push("/applicant/documents")}>
          ← Back to documents
        </Button>
        <Button onClick={submit} loading={isPending}>
          Submit application →
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-center border-b border-border last:border-b-0 py-2.5 text-[13px]">
      <span className="text-text-muted">{label}</span>
      <span className={ok ? "text-success font-semibold" : "text-warning font-semibold"}>{value}</span>
    </div>
  );
}
