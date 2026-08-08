import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getChecklistGrouped } from "@/lib/data/checklist";
import { DocumentChecklist } from "@/components/applicant/DocumentChecklist";

export default async function ApplicantDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/applicant/profile");

  const groups = await getChecklistGrouped(application.id);

  return <DocumentChecklist groups={groups} />;
}
