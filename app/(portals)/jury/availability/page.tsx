import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getJurorAvailability } from "@/lib/data/interviews";
import { AvailabilityGrid } from "@/components/jury/AvailabilityGrid";

export default async function JuryAvailabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const slots = await getJurorAvailability(user.id);

  return <AvailabilityGrid jurorId={user.id} existingSlots={slots} />;
}
