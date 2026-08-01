import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { ApplicantNav } from "@/components/layout/ApplicantNav";

export default async function ApplicantLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "applicant") redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);

  return (
    <div className="min-h-screen flex flex-col">
      <ApplicantNav organizationName={application?.organization.name || "Your organization"} />
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
    </div>
  );
}
