import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplication } from "@/lib/data/applications";
import { getDocuments } from "@/lib/data/documents";
import { store } from "@/lib/mock/store";
import { DocumentReviewPanel } from "@/components/jury/DocumentReviewPanel";

export default async function JuryDocumentReviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { applicationId } = await params;
  const application = await getApplication(applicationId);
  if (!application) notFound();

  const documents = await getDocuments(applicationId);
  const jurorName = store.users.find((u) => u.id === user.id)?.name ?? user.email;

  return (
    <DocumentReviewPanel
      organizationName={application.organization.name}
      documents={documents}
      jurorId={user.id}
      jurorName={jurorName}
    />
  );
}
