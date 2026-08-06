import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getBookableSlotsForApplication, getBookedSlotForApplication, getInterviewSession } from "@/lib/data/interviews";
import { InterviewBooking } from "@/components/applicant/InterviewBooking";

export default async function ApplicantInterviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  const [slots, bookedSlot, session] = await Promise.all([
    getBookableSlotsForApplication(application.id),
    getBookedSlotForApplication(application.id),
    getInterviewSession(application.id),
  ]);

  return (
    <InterviewBooking
      applicationId={application.id}
      organizationName={application.organization.name}
      slots={slots}
      bookedSlot={bookedSlot}
      interviewRequested={!!session}
    />
  );
}
