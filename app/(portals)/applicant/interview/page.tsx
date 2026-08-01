import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getBookableSlotsForApplication, getBookedSlotForApplication } from "@/lib/data/interviews";
import { getSectors } from "@/lib/data/sectors-criteria";
import { InterviewBooking } from "@/components/applicant/InterviewBooking";

export default async function ApplicantInterviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  const [slots, bookedSlot, sectors] = await Promise.all([
    getBookableSlotsForApplication(application.id),
    getBookedSlotForApplication(application.id),
    getSectors(),
  ]);
  const sectorName = sectors.find((s) => s.id === application.sectorId)?.name ?? "your";

  return (
    <InterviewBooking
      applicationId={application.id}
      organizationName={application.organization.name}
      sectorName={sectorName}
      slots={slots}
      bookedSlot={bookedSlot}
    />
  );
}
