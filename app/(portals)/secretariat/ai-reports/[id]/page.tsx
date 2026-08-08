import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getApplication } from "@/lib/data/applications";
import { getShortlistedReport, getNonShortlistedReport } from "@/lib/data/reports";
import { store } from "@/lib/mock/store";
import { ReportReviewForm } from "@/components/secretariat/ReportReviewForm";

export default async function AIReportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const application = await getApplication(id);
  if (!application) notFound();
  if (application.isShortlisted === null) notFound();

  const [shortlistedReport, nonShortlistedReport] = await Promise.all([
    getShortlistedReport(id),
    getNonShortlistedReport(id),
  ]);
  const reviewerName = store.users.find((u) => u.id === user.id)?.name ?? user.email;

  return (
    <ReportReviewForm
      applicationId={id}
      organizationName={application.organization.name}
      isShortlisted={!!application.isShortlisted}
      shortlistedReport={shortlistedReport}
      nonShortlistedReport={nonShortlistedReport}
      reviewerName={reviewerName}
    />
  );
}
