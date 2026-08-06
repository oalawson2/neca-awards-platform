import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplication } from "@/lib/data/applications";
import { getDocumentsForVerification, getRedFlagCount } from "@/lib/data/stage2a";
import { DocumentVerificationPanel } from "@/components/jury/DocumentVerificationPanel";

export default async function JuryDocumentReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { applicationId } = await params;
  const application = await getApplication(applicationId);
  if (!application) notFound();

  const [documents, redFlagCount] = await Promise.all([
    getDocumentsForVerification(applicationId, user.id),
    getRedFlagCount(applicationId),
  ]);

  return (
    <DocumentVerificationPanel
      organizationName={application.organization.name}
      documents={documents}
      jurorId={user.id}
      redFlagCount={redFlagCount}
    />
  );
}
