import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getDocuments } from "@/lib/data/documents";
import { DocumentChecklist } from "@/components/applicant/DocumentChecklist";

export default async function ApplicantDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  const documents = await getDocuments(application.id);

  return <DocumentChecklist documents={documents} />;
}
