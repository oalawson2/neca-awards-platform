import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default async function ApplicantQuestionnairePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  return <ComingSoon title="Sections B–I: the assessment questionnaire" phase="the question engine build (task #27)" />;
}
