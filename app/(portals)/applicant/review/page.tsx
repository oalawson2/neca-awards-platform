import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getQuestionnaireProgress } from "@/lib/data/answers";
import { getChecklistStatus } from "@/lib/data/checklist";
import { ReviewSubmit } from "@/components/applicant/ReviewSubmit";

export default async function ApplicantReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/applicant/profile");

  const [progress, checklistStatus] = await Promise.all([
    getQuestionnaireProgress(application.id),
    getChecklistStatus(application.id),
  ]);

  return (
    <ReviewSubmit
      applicationId={application.id}
      organization={application.organization}
      progress={progress}
      checklistStatus={checklistStatus}
    />
  );
}
