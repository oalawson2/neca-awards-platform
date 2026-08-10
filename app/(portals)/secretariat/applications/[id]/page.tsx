import Link from "next/link";
import { notFound } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { getApplication } from "@/lib/data/applications";
import { getAnswers, getEffectiveItemsForApplication } from "@/lib/data/answers";
import { getDocumentVerificationSummary } from "@/lib/data/stage2a";
import { getPanelSubmissionCount, getVerifiedScoreIfComplete } from "@/lib/data/scorecards";
import { itemScorePercent } from "@/lib/scoring/stage1";
import {
  GEOGRAPHICAL_COVERAGE_LABELS,
  ORG_SIZE_LABELS,
  OWNERSHIP_STRUCTURE_LABELS,
  YEAR_ESTABLISHED_LABELS,
} from "@/types/domain";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { AnswerValue } from "@/types/domain";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "responses", label: "Responses" },
  { key: "documents", label: "Documents" },
  { key: "scores", label: "Score Breakdown" },
];

function formatAnswer(value: AnswerValue): string {
  if (value === null) return "(no answer)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "(none selected)";
  return String(value);
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "profile" } = await searchParams;

  const application = await getApplication(id);
  if (!application) notFound();
  const org = application.organization;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-7 py-5.5 border-b border-border">
        <Link href="/secretariat" className="text-xs text-info">
          ← Back to applications
        </Link>
        <div className="flex justify-between items-center flex-wrap gap-3 mt-2.5">
          <div>
            <div className="font-heading font-extrabold text-xl text-navy-dark">{org.name || "(unnamed organization)"}</div>
            <div className="text-[13px] text-text-muted">Submitted {formatDate(application.submittedAt)}</div>
          </div>
          <div className="flex items-center gap-2">
            {application.eligibilityFlagged && <Badge tone="error">ELIGIBILITY FLAGGED</Badge>}
            <StatusBadge status={application.status} />
          </div>
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
        {tab === "profile" && (
          <div className="border border-border rounded-2xl p-5 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
            <ProfileRow label="RC Number" value={org.rcNumber} />
            <ProfileRow label="Year established" value={YEAR_ESTABLISHED_LABELS[org.yearEstablishedBand]} />
            <ProfileRow label="Size" value={ORG_SIZE_LABELS[org.sizeTier]} />
            <ProfileRow label="Geographical coverage" value={GEOGRAPHICAL_COVERAGE_LABELS[org.geographicalCoverage]} />
            <ProfileRow label="Ownership structure" value={OWNERSHIP_STRUCTURE_LABELS[org.ownershipStructure]} />
            <ProfileRow label="Local/Multinational" value={org.localOrMultinational === "local" ? "Local" : "Multinational"} />
            <ProfileRow label="Unionised" value={org.isUnionised ? "Yes" : "No"} />
            <ProfileRow label="Contact" value={`${org.primaryContactName} · ${org.primaryContactEmail}`} />
            <ProfileRow
              label="Previous participation"
              value={org.previousParticipation.participated ? org.previousParticipation.years.join(", ") || "Yes" : "No"}
            />
            <ProfileRow label="Stage 1 score" value={application.stage1Score !== null ? `${application.stage1Score}%` : "—"} />
          </div>
        )}

        {tab === "responses" && <ResponsesTab applicationId={id} sectorId={org.sectorId} employeeCount={org.employeeCount} />}
        {tab === "documents" && <DocumentsTab applicationId={id} />}
        {tab === "scores" && <ScoreBreakdownTab applicationId={id} />}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-right">{value || "—"}</span>
    </div>
  );
}

async function ResponsesTab({
  applicationId,
  sectorId,
  employeeCount,
}: {
  applicationId: string;
  sectorId: string;
  employeeCount: number | null;
}) {
  const [answers, items] = await Promise.all([getAnswers(applicationId), getEffectiveItemsForApplication(applicationId)]);
  const answerByItem = Object.fromEntries(answers.map((a) => [a.itemId, a]));

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      {items.map((item) => {
        const answer = answerByItem[item.id];
        // Same per-item Stage 1 scoring the pillar rollup uses — null
        // means this item doesn't contribute at all (N/A, narrative, or
        // an un-benchmarked NUM item), shown as "—" rather than 0%, which
        // would misleadingly read as "scored zero."
        const scorePercent = itemScorePercent(item, answer, [], sectorId, employeeCount);
        return (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3 px-5 py-3.5 border-b last:border-b-0 border-border text-sm"
          >
            <div className="min-w-0 sm:pr-3">
              <span className="text-text-muted font-mono text-xs mr-2">{item.id}</span>
              {item.prompt}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:flex-shrink-0">
              <span
                className={`text-xs font-bold font-mono flex-shrink-0 ${scorePercent === null ? "text-[#AEB1BC]" : scorePercent >= 60 ? "text-success" : "text-warning"}`}
                title="This item's Stage 1 auto-score"
              >
                {scorePercent === null ? "—" : `${scorePercent}%`}
              </span>
              <span className="sm:text-right">
                {answer?.isNA ? (
                  <span className="text-warning font-semibold">N/A — {answer.naJustification}</span>
                ) : (
                  <strong>{formatAnswer(answer?.value ?? null)}</strong>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function DocumentsTab({ applicationId }: { applicationId: string }) {
  const documents = await getDocumentVerificationSummary(applicationId);
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      {documents.map((doc) => (
        <div key={doc.id} className="flex justify-between items-center px-5 py-3.5 border-b last:border-b-0 border-border text-sm">
          <div>
            <div className="font-semibold">{doc.name}</div>
            {doc.status === "uploaded" && (
              <div className="text-xs text-text-muted mt-0.5">
                {doc.credibleCount > 0 && <span className="text-success">✓ Verified credible by {doc.credibleCount}</span>}
                {doc.credibleCount > 0 && doc.redFlagCount > 0 && " · "}
                {doc.redFlagCount > 0 && <span className="text-error">⚠ Red-flagged by {doc.redFlagCount}</span>}
                {doc.credibleCount === 0 && doc.redFlagCount === 0 && "Not yet reviewed"}
              </div>
            )}
          </div>
          {doc.status === "uploaded" ? <Badge tone="success">UPLOADED</Badge> : <Badge tone="error">MISSING</Badge>}
        </div>
      ))}
      {documents.length === 0 && <div className="px-5 py-8 text-sm text-text-muted text-center">No documents required based on this applicant&rsquo;s answers.</div>}
    </div>
  );
}

async function ScoreBreakdownTab({ applicationId }: { applicationId: string }) {
  const [submission, verified] = await Promise.all([getPanelSubmissionCount(applicationId), getVerifiedScoreIfComplete(applicationId)]);

  if (!verified) {
    return (
      <div className="border border-border rounded-2xl p-5 text-sm text-text-muted">
        {submission.total === 0
          ? "No jury panel is assigned to this application's sector yet."
          : `${submission.submitted} of ${submission.total} assigned panel jurors have scored so far. The Verified Score stays hidden until every assigned juror submits.`}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="font-heading font-extrabold text-xl text-navy-dark mb-4">{verified.overall}%</div>
      <div className="flex flex-col gap-3.5">
        {verified.byPillar.map((row) => (
          <div key={row.pillarCode}>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span>{row.pillarCode}</span>
              <span className="font-bold">{row.contributionPercent}%</span>
            </div>
            <ProgressBar percent={(row.panelPillarScore / 5) * 100} />
          </div>
        ))}
      </div>
    </div>
  );
}
