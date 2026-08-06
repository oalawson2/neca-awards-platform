import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplication } from "@/lib/data/applications";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default async function JuryDocumentReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { applicationId } = await params;
  const application = await getApplication(applicationId);
  if (!application) notFound();

  return (
    <ComingSoon
      title={`Document verification — ${application.organization.name}`}
      phase="the Stage 2a document verification build (task #31)"
    />
  );
}
