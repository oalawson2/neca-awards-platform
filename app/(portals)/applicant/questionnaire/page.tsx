import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getAnswers } from "@/lib/data/answers";
import { QuestionnaireForm } from "@/components/applicant/QuestionnaireForm";

export default async function ApplicantQuestionnairePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/applicant/profile");
  if (!application.organization.name) redirect("/applicant/profile");

  const answers = await getAnswers(application.id);

  return (
    <QuestionnaireForm
      applicationId={application.id}
      isUnionised={application.organization.isUnionised}
      initialAnswers={answers}
      readOnly={application.status !== "draft"}
    />
  );
}
