import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplication } from "@/lib/data/applications";
import { getDocumentsForVerification, getMissingDocuments, getRedFlagCount } from "@/lib/data/stage2a";
import { getInterviewSession } from "@/lib/data/interviews";
import { DocumentVerificationPanel } from "@/components/jury/DocumentVerificationPanel";

export default async function JuryDocumentReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { applicationId } = await params;
  const application = await getApplication(applicationId);
  if (!application) notFound();

  const [documents, missingDocuments, redFlagCount, interviewSession] = await Promise.all([
    getDocumentsForVerification(applicationId, user.id),
    getMissingDocuments(applicationId),
    getRedFlagCount(applicationId),
    getInterviewSession(applicationId),
  ]);

  return (
    <DocumentVerificationPanel
      organizationName={application.organization.name}
      documents={documents}
      missingDocuments={missingDocuments}
      jurorId={user.id}
      redFlagCount={redFlagCount}
      interviewAlreadyRequested={!!interviewSession}
    />
  );
}
