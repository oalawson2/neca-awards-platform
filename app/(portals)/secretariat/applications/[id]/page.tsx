import Link from "next/link";
import { notFound } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { getApplication, getCriterionBreakdown, getScoreSummary } from "@/lib/data/applications";
import { getQuestionnaireSections, getAnswers } from "@/lib/data/questionnaire";
import { getDocuments } from "@/lib/data/documents";
import { getSectors } from "@/lib/data/sectors-criteria";
import { getSettings } from "@/lib/data/settings";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PreliminaryScoreForm } from "@/components/secretariat/PreliminaryScoreForm";

const TABS = [
  { key: "responses", label: "Responses" },
  { key: "documents", label: "Documents" },
  { key: "scores", label: "Score Breakdown" },
];

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "responses" } = await searchParams;

  const application = await getApplication(id);
  if (!application) notFound();

  const [sections, answers, documents, sectors, settings] = await Promise.all([
    getQuestionnaireSections(),
    getAnswers(id),
    getDocuments(id),
    getSectors(),
    getSettings(),
  ]);
  const answerMap = Object.fromEntries(answers.map((a) => [a.questionId, a.value]));
  const sectorName = sectors.find((s) => s.id === application.sectorId)?.name;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-7 py-5.5 border-b border-border">
        <Link href="/secretariat" className="text-xs text-info">
          ← Back to applications
        </Link>
        <div className="flex justify-between items-center flex-wrap gap-3 mt-2.5">
          <div>
            <div className="font-heading font-extrabold text-xl text-navy-dark">
              {application.organization.name || "(unnamed organization)"}
            </div>
            <div className="text-[13px] text-text-muted">
              {sectorName} Sector · Submitted {formatDate(application.submittedAt)}
            </div>
          </div>
          <StatusBadge status={application.status} />
        </div>
        <div className="flex gap-1.5 mt-5 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`?tab=${t.key}`}
              className={cn(
                "text-[13px] font-semibold px-4 py-2 rounded-full whitespace-nowrap",
                tab === t.key ? "text-white bg-navy-dark" : "text-[#AEB1BC] bg-[#F4F4F8] sm:bg-transparent"
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-6 sm:px-7 py-6 overflow-y-auto flex-1 flex flex-col gap-3.5">
        {application.status === "awaiting_review" && (
          <PreliminaryScoreForm applicationId={id} threshold={settings.advancementThresholdScore} />
        )}

        {tab === "responses" &&
          sections.map((section) => (
            <div key={section.id} className="border border-border rounded-2xl p-5">
              <div className="font-bold text-sm text-navy-dark mb-2">{section.title}</div>
              <div className="text-[13px] text-[#5B5F6B] leading-relaxed flex flex-col gap-1.5">
                {section.questions.map((q) => (
                  <div key={q.id}>
                    {q.prompt} — <strong>{answerMap[q.id] || "(no answer provided)"}</strong>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {tab === "documents" && (
          <div className="border border-border rounded-2xl overflow-hidden">
            {documents.map((doc) => (
              <div key={doc.id} className="flex justify-between items-center px-5 py-3.5 border-b last:border-b-0 border-border text-sm">
                <div>
                  <div className="font-semibold">{doc.name}</div>
                  {doc.certifiedByJurorId && <div className="text-xs text-success mt-0.5">✓ Certified compliant by jury</div>}
                  {doc.flaggedIssue && <div className="text-xs text-error mt-0.5">⚠ {doc.flaggedIssue}</div>}
                </div>
                {doc.status === "uploaded" ? <Badge tone="success">UPLOADED</Badge> : <Badge tone="error">MISSING</Badge>}
              </div>
            ))}
          </div>
        )}

        {tab === "scores" && <ScoreBreakdownTab applicationId={id} />}
      </div>
    </div>
  );
}

async function ScoreBreakdownTab({ applicationId }: { applicationId: string }) {
  const [summary, breakdown] = await Promise.all([getScoreSummary(applicationId), getCriterionBreakdown(applicationId)]);

  if (!summary.isComplete) {
    return (
      <div className="border border-border rounded-2xl p-5 text-sm text-text-muted">
        {summary.jurorsAssigned === 0
          ? "No jurors are assigned to this sector yet."
          : `${summary.jurorsScored} of ${summary.jurorsAssigned} assigned jurors have scored so far. The aggregate score stays hidden until every assigned juror submits.`}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="font-heading font-extrabold text-xl text-navy-dark mb-4">{summary.averageScore} / 100</div>
      <div className="flex flex-col gap-3.5">
        {breakdown.map((row) => (
          <div key={row.criterionId}>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span>{row.name}</span>
              <span className="font-bold">
                {row.averagePoints}/{row.maxPoints}
              </span>
            </div>
            <ProgressBar percent={(row.averagePoints / row.maxPoints) * 100} />
          </div>
        ))}
      </div>
    </div>
  );
}
