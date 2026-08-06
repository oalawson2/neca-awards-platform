import { notFound } from "next/navigation";
import { getApplication } from "@/lib/data/applications";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default async function AIReportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getApplication(id);
  if (!application) notFound();

  return <ComingSoon title={`Report review — ${application.organization.name}`} phase="the two-variant applicant reports build (task #36)" />;
}
