import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnscheduledInterviewsForJuror } from "@/lib/data/interviews";
import { getApplication } from "@/lib/data/applications";
import { AvailabilityGrid } from "@/components/jury/AvailabilityGrid";

export default async function JuryAvailabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sessions = await getUnscheduledInterviewsForJuror(user.id);
  const withOrgNames = await Promise.all(
    sessions.map(async (session) => {
      const application = await getApplication(session.applicationId);
      return { ...session, organizationName: application?.organization.name ?? session.applicationId };
    })
  );

  return <AvailabilityGrid interviews={withOrgNames} />;
}
