import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default async function ApplicantReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  return <ComingSoon title="Your report" phase="the two-variant applicant reports build (task #36)" />;
}
