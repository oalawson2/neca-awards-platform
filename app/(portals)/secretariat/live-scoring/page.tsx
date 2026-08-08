import { getApplications } from "@/lib/data/applications";
import { getPanelSubmissionCount, getVerifiedScoreIfComplete } from "@/lib/data/scorecards";
import { StatusBadge } from "@/components/ui/Badge";
import { CloseScoringButton } from "@/components/secretariat/CloseScoringButton";

/**
 * Secretariat view: live but blind — shows how many of the panel's 3
 * jurors have submitted, never the individual scores themselves, and
 * only reveals the panel-averaged Verified Score once every assigned
 * juror has submitted (doc's blind-scoring principle, carried forward).
 */
export default async function LiveScoringPage() {
  const applications = await getApplications();
  const shortlisted = applications.filter((a) => a.isShortlisted);

  const rows = await Promise.all(
    shortlisted.map(async (app) => {
      const [submission, verified] = await Promise.all([getPanelSubmissionCount(app.id), getVerifiedScoreIfComplete(app.id)]);
      return { app, submission, verified };
    })
  );

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Live Scoring</h1>
      </div>
      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr] bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]">
            <div>ORGANIZATION</div>
            <div>STATUS</div>
            <div>PANEL SUBMITTED</div>
            <div>VERIFIED SCORE</div>
            <div />
          </div>
          {rows.map(({ app, submission, verified }) => (
            <div key={app.id} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-1 sm:gap-0 px-4.5 py-3.5 border-t border-border items-center text-[13px]">
              <div className="font-semibold sm:font-normal">{app.organization.name}</div>
              <div>
                <StatusBadge status={app.status} />
              </div>
              <div className="text-text-muted">
                {submission.submitted} of {submission.total}
              </div>
              <div className="font-bold">{verified ? `${verified.overall}%` : "— (in progress)"}</div>
              <div>
                {app.status !== "stage2_scored" && (
                  <CloseScoringButton applicationId={app.id} disabled={submission.total === 0 || submission.submitted < submission.total} />
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="px-5 py-8 text-sm text-text-muted text-center">No shortlisted applicants yet.</div>}
        </div>
      </div>
    </div>
  );
}
