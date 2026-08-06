import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplication } from "@/lib/data/applications";
import { getInterviewSession, getLiveEvidenceRequests } from "@/lib/data/interviews";
import { InterviewWorksheet } from "@/components/jury/InterviewWorksheet";

export default async function JuryInterviewPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { applicationId } = await params;
  const application = await getApplication(applicationId);
  if (!application) notFound();

  const [session, liveEvidenceRequests] = await Promise.all([
    getInterviewSession(applicationId),
    getLiveEvidenceRequests(applicationId),
  ]);
  if (!session) notFound();

  return (
    <InterviewWorksheet session={session} liveEvidenceRequests={liveEvidenceRequests} organizationName={application.organization.name} />
  );
}
