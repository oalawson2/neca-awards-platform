import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationsForJuror } from "@/lib/data/applications";
import { store } from "@/lib/mock/store";
import { JuryTabNav } from "@/components/layout/JuryTabNav";

export default async function JuryLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "jury") redirect("/login");

  const platformUser = store.users.find((u) => u.id === user.id);
  const assigned = await getApplicationsForJuror(user.id);
  const defaultApplication = assigned.find((a) => a.myScorecardStatus !== "submitted") ?? assigned[0];

  return (
    <div className="min-h-screen flex flex-col">
      <JuryTabNav userName={platformUser?.name ?? user.email} defaultApplicationId={defaultApplication?.id} />
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
    </div>
  );
}
