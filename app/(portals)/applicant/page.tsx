import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser, getScoreSummary } from "@/lib/data/applications";
import { getDocuments } from "@/lib/data/documents";
import { getInterviewRequest } from "@/lib/data/interviews";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * There's no explicit "Applicant dashboard" wireframe among the 9 screens —
 * 02–08 are a linear flow reached via the top nav's step tabs. This landing
 * page is a judgment call: a status overview that routes into whichever
 * step the applicant is on, so /applicant (the portal root) isn't empty.
 */
export default async function ApplicantDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  const documents = await getDocuments(application.id);
  const uploadedCount = documents.filter((d) => d.status === "uploaded").length;
  const scoreSummary = application.status === "released" ? await getScoreSummary(application.id) : null;
  const interviewRequest = await getInterviewRequest(application.id);

  const nextStepHref =
    !application.organization.name ? "/applicant/profile" :
    application.sectionsCompleted < application.totalSections ? "/applicant/questionnaire" :
    uploadedCount < documents.length ? "/applicant/documents" :
    "/applicant/review";

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
            <StatusBadge status={application.status} />
          </div>
          {application.status === "draft" && <LinkButton href={nextStepHref}>Continue application →</LinkButton>}
        </div>

        {application.status === "draft" && (
          <div className="mt-5 space-y-3">
            <div>
              <div className="flex justify-between text-[13px] mb-1">
                <span>Questionnaire</span>
                <span className="font-semibold">
                  {application.sectionsCompleted} of {application.totalSections} sections
                </span>
              </div>
              <ProgressBar percent={(application.sectionsCompleted / application.totalSections) * 100} />
            </div>
            <div>
              <div className="flex justify-between text-[13px] mb-1">
                <span>Documents</span>
                <span className="font-semibold">
                  {uploadedCount} of {documents.length} uploaded
                </span>
              </div>
              <ProgressBar percent={(uploadedCount / Math.max(1, documents.length)) * 100} color="success" />
            </div>
          </div>
        )}

        {(application.status === "awaiting_review" || application.status === "incomplete") && (
          <p className="text-sm text-text-muted mt-4 leading-relaxed">
            Your application has been received and is with the Secretariat for a completeness check. You&rsquo;ll
            hear from us once it advances to jury scoring.
          </p>
        )}

        {(application.status === "scoring" || application.status === "scored") && (
          <p className="text-sm text-text-muted mt-4 leading-relaxed">
            Your application is being scored independently by the sector jury panel. Scores stay confidential until
            the Secretariat closes the scoring window.
          </p>
        )}

        {application.status === "released" && scoreSummary && (
          <div className="mt-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="font-heading font-extrabold text-3xl text-navy">
                {scoreSummary.averageScore}
                <span className="text-base text-text-muted font-body font-normal">/100</span>
              </div>
              <div className="text-[13px] text-text-muted">Final score</div>
            </div>
            <LinkButton variant="secondary" href="/applicant/report">
              View full report →
            </LinkButton>
          </div>
        )}
      </Card>

      {interviewRequest && (
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
