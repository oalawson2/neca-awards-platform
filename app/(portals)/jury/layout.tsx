import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationsForJurorPanel } from "@/lib/data/applications";
import { getApplicationIdsWithInterviewSessions } from "@/lib/data/interviews";
import { JuryTabNav } from "@/components/layout/JuryTabNav";

export default async function JuryLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "jury") redirect("/login");

  const assigned = await getApplicationsForJurorPanel(user.id);
  const applicationIdsWithInterviews = await getApplicationIdsWithInterviewSessions(assigned.map((a) => a.id));

  return (
    <div className="min-h-screen flex flex-col">
      <JuryTabNav
        userName={user.fullName || user.email}
        defaultApplicationId={assigned[0]?.id}
        applicationIdsWithInterviews={applicationIdsWithInterviews}
      />
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
    </div>
  );
}
