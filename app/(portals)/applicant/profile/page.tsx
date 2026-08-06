import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getSectors } from "@/lib/data/sectors";
import { ProfileWizard } from "@/components/applicant/ProfileWizard";

export default async function ApplicantProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  const sectors = await getSectors();

  return (
    <ProfileWizard
      applicationId={application.id}
      initialOrg={application.organization}
      initialDeclarations={application.eligibilityDeclarations}
      sectors={sectors}
    />
  );
}
