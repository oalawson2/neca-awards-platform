import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getInterviewSession } from "@/lib/data/interviews";
import { getResultsReleaseStatus } from "@/lib/data/resultsRelease";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import type { ApplicationStatus } from "@/types/domain";

/**
 * There's no explicit "Applicant dashboard" wireframe — this landing page
 * is a judgment call: a status overview that routes into whichever step
 * the applicant is on, so /applicant (the portal root) isn't empty.
 *
 * Simplified against the new stage model while Sections B–I (task #27),
 * the document checklist (#28), and reports (#36) are rebuilt — this page
 * will grow a real progress breakdown once those exist.
 */
export default async function ApplicantDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/applicant/profile");

  const [interviewSession, { releasedAt }] = await Promise.all([getInterviewSession(application.id), getResultsReleaseStatus()]);
  const nextStepHref = !application.organization.name ? "/applicant/profile" : "/applicant/questionnaire";

  // Apply Shortlist sets the real status the moment it runs, sector by
  // sector — but applicants shouldn't see a shortlisted/not_shortlisted
  // outcome until Secretariat explicitly closes applications and releases
  // results (see lib/actions/resultsRelease.ts). Everything from
  // in_stage2 onward already implies "you know you were shortlisted" (the
  // applicant is mid-interview by then), so only these two statuses need
  // holding back.
  const HELD_BACK_STATUSES: ApplicationStatus[] = ["shortlisted", "not_shortlisted"];
  const displayStatus: ApplicationStatus =
    HELD_BACK_STATUSES.includes(application.status) && !releasedAt ? "submitted" : application.status;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-heading font-extrabold text-2xl text-navy">
        Welcome{application.organization.name ? `, ${application.organization.name}` : ""}
      </h1>
      <p className="text-sm text-text-muted mt-1.5">
        Reference No. <strong className="text-text">{application.referenceNo}</strong>
      </p>

      <Card className="mt-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[13px] font-semibold text-text-muted mb-1.5">Application status</div>
            <StatusBadge status={displayStatus} />
          </div>
          {displayStatus === "draft" && <LinkButton href={nextStepHref}>Continue application →</LinkButton>}
        </div>

        {application.eligibilityFlagged && (
          <p className="text-sm text-warning mt-4 leading-relaxed">
            One or more eligibility declarations need attention. Your application can still be completed and
            submitted — the Secretariat will follow up on this directly.
          </p>
        )}

        {displayStatus === "submitted" && (
          <p className="text-sm text-text-muted mt-4 leading-relaxed">
            Your self-assessment has been received. Applicants are ranked within their sector and size category, and
            the Secretariat will shortlist a set of top-ranked applicants to proceed to jury review.
          </p>
        )}

        {displayStatus === "not_shortlisted" && (
          <p className="text-sm text-text-muted mt-4 leading-relaxed">
            Your application was not shortlisted for jury review this cycle. A feedback summary based on your
            self-assessment will be made available here.
          </p>
        )}

        {(displayStatus === "shortlisted" || displayStatus === "in_stage2") && (
          <p className="text-sm text-text-muted mt-4 leading-relaxed">
            Your application has been shortlisted and is with the sector jury panel for document verification and
            interview. Scores stay confidential until this stage concludes.
          </p>
        )}

        {(displayStatus === "stage2_scored" ||
          displayStatus === "sector_finalist" ||
          displayStatus === "sector_winner" ||
          displayStatus === "eoy_finalist" ||
          displayStatus === "eoy_winner") && (
          <p className="text-sm text-text-muted mt-4 leading-relaxed">
            Jury review is complete for your application. Check the Report tab — it becomes available once the
            Secretariat releases it.
          </p>
        )}
      </Card>

      {interviewSession && (
        <Card className="mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="font-heading font-bold text-[15px] text-navy">Panel interview</div>
              <div className="text-[13px] text-text-muted mt-0.5">Book a slot with your sector&rsquo;s juror panel.</div>
            </div>
            <Link href="/applicant/interview" className="text-[13px] font-semibold text-info">
              Book / view →
            </Link>
          </div>
        </Card>
      )}
    </main>
  );
}
