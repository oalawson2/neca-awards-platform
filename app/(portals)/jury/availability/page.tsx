import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPanelForJuror } from "@/lib/data/users";
import { getSlotsForPanel } from "@/lib/data/interviewSlots";
import { AvailabilityGrid } from "@/components/jury/AvailabilityGrid";

export default async function JuryAvailabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const panel = await getPanelForJuror(user.id);
  const slots = panel ? await getSlotsForPanel(panel.id) : [];

  return <AvailabilityGrid panelName={panel?.name ?? null} slots={slots} />;
}
