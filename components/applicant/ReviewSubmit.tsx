"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { submitApplication } from "@/lib/actions/submission";
import type { QuestionnaireSection, RequiredDocument, Organization } from "@/types/domain";

export function ReviewSubmit({
  applicationId,
  organization,
  sections,
  documents,
}: {
  applicationId: string;
  organization: Organization;
  sections: QuestionnaireSection[];
  documents: RequiredDocument[];
}) {
  const router = useRouter();
  const [certify, setCertify] = useState(false);
  const [acknowledgeIncomplete, setAcknowledgeIncomplete] = useState(false);
  const [needsAcknowledgement, setNeedsAcknowledgement] = useState(false);
  const [missingNames, setMissingNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const uploaded = documents.filter((d) => d.status === "uploaded");
  const missing = documents.filter((d) => d.status === "missing");

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitApplication(applicationId, acknowledgeIncomplete);
      if (result.requiresIncompleteAcknowledgement) {
        setNeedsAcknowledgement(true);
        setMissingNames(result.missingDocumentNames ?? []);
        return;
      }
      if (!result.success) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.push("/applicant/submitted");
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8 sm:py-10 flex flex-col lg:flex-row gap-8">
      <div className="flex-1 flex flex-col gap-4">
        <ReviewCard title="Organization Profile" editHref="/applicant/profile">
          {organization.name} · {organization.rcNumber} · {organization.employeeHeadcount} employees
        </ReviewCard>

        <ReviewCard title={`Questionnaire — ${sections.length} of ${sections.length} sections complete`} editHref="/applicant/questionnaire">
          <div className="flex flex-col gap-1.5">
            {sections.map((s) => (
              <div key={s.id}>✓ {s.title}</div>
            ))}
          </div>
        </ReviewCard>

        <ReviewCard
          title={`Documents — ${uploaded.length} of ${documents.length} uploaded`}
          editHref="/applicant/documents"
          warn={missing.length > 0}
        >
          {missing.length === 0 ? (
            "All required documents uploaded."
          ) : (
            <div className="flex flex-col gap-1.5">
              {uploaded.map((d) => (
                <div key={d.id}>✓ {d.name}</div>
              ))}
              {missing.map((d) => (
                <div key={d.id} className="text-error">
                  ✕ {d.name} — missing
                </div>
              ))}
            </div>
          )}
        </ReviewCard>
      </div>

      <div className="lg:w-80 flex-shrink-0">
        {!needsAcknowledgement ? (
          <Card>
            <div className="font-bold text-[15px] mb-3.5">Ready to submit</div>
            {error && <div className="text-sm text-error mb-3">{error}</div>}
            <Checkbox
              className="mb-5"
              checked={certify}
              onChange={(e) => setCertify(e.target.checked)}
              label="I certify the information provided is accurate and complete, and understand it cannot be edited after submission."
            />
            <Button variant="gold" className="w-full" disabled={!certify || isPending} onClick={handleSubmit}>
              Submit Application
            </Button>
          </Card>
        ) : (
          <Card className="border-[1.5px] border-[#F3C98A] bg-[#FFF6E8]">
            <div className="font-bold text-[15px] mb-2.5 text-warning">⚠ Submitting incomplete</div>
            <div className="text-[13px] text-[#8A5A0C] leading-relaxed mb-4">
              {missingNames.length} required document{missingNames.length === 1 ? " is" : "s are"} missing. Jurors will
              score with the information available — missing evidence will lower your score on the related criteria.
              You can still submit now; adding documents isn&rsquo;t possible after submission.
            </div>
            <Checkbox
              className="mb-4 text-[#8A5A0C]"
              checked={acknowledgeIncomplete}
              onChange={(e) => setAcknowledgeIncomplete(e.target.checked)}
              label="I understand missing documents may reduce my score, and wish to submit anyway."
            />
            <Button
              className="w-full !bg-warning"
              disabled={!acknowledgeIncomplete || isPending}
              onClick={handleSubmit}
            >
              Submit incomplete application
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  editHref,
  warn,
  children,
}: {
  title: string;
  editHref: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={"border rounded-2xl overflow-hidden " + (warn ? "border-[1.5px] border-[#F3C98A]" : "border-border")}>
      <div className={"flex justify-between items-center px-5 py-4 " + (warn ? "bg-[#FFF6E8]" : "bg-bg")}>
        <div className={"font-bold text-[15px] " + (warn ? "text-warning" : "")}>{title}</div>
        <Link href={editHref} className="text-[13px] text-info">
          {warn ? "Upload now" : "Edit"}
        </Link>
      </div>
      <div className="px-5 py-4 text-sm text-[#5B5F6B] leading-relaxed">{children}</div>
    </div>
  );
}
