import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getInterviewSession } from "@/lib/data/interviews";
import { getBookableSlotsForApplication } from "@/lib/data/interviewSlots";
import { InterviewBooking } from "@/components/applicant/InterviewBooking";

export default async function ApplicantInterviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/applicant/profile");

  const session = await getInterviewSession(application.id);
  const bookableSlots = session?.status === "requested" ? await getBookableSlotsForApplication(application.id) : [];

  return <InterviewBooking applicationId={application.id} session={session} bookableSlots={bookableSlots} />;
}
