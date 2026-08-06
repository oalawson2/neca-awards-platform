import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default async function JuryAvailabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <ComingSoon title="Interview availability" phase="the Stage 2b sector interview restructure (task #32)" />;
}
