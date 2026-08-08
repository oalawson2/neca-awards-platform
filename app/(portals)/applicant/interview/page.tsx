import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getInterviewSession } from "@/lib/data/interviews";
import { InterviewBooking } from "@/components/applicant/InterviewBooking";

export default async function ApplicantInterviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/applicant/profile");

  const session = await getInterviewSession(application.id);

  return <InterviewBooking session={session} />;
}
