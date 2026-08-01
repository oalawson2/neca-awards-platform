import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getQuestionnaireSections, getAnswers } from "@/lib/data/questionnaire";
import { QuestionnaireForm } from "@/components/applicant/QuestionnaireForm";

export default async function ApplicantQuestionnairePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  const [sections, answers] = await Promise.all([getQuestionnaireSections(), getAnswers(application.id)]);

  return (
    <QuestionnaireForm
      applicationId={application.id}
      sections={sections}
      initialAnswers={answers}
      initialSectionsCompleted={application.sectionsCompleted}
    />
  );
}
