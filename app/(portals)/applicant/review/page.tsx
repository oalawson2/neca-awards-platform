import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getQuestionnaireSections } from "@/lib/data/questionnaire";
import { getDocuments } from "@/lib/data/documents";
import { ReviewSubmit } from "@/components/applicant/ReviewSubmit";

export default async function ApplicantReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  const [sections, documents] = await Promise.all([
    getQuestionnaireSections(),
    getDocuments(application.id),
  ]);

  return (
    <ReviewSubmit
      applicationId={application.id}
      organization={application.organization}
      sections={sections}
      documents={documents}
    />
  );
}
