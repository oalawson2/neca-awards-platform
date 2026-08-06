import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default async function ApplicantInterviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  return <ComingSoon title="Panel interview booking" phase="the Stage 2b sector interview restructure (task #32)" />;
}
