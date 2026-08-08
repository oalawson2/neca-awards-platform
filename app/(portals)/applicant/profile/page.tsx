import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getSectors } from "@/lib/data/sectors";
import { ProfileWizard } from "@/components/applicant/ProfileWizard";
import type { Organization } from "@/types/domain";

/**
 * Self-signup no longer creates an organization/application (see
 * lib/auth/actions.ts) — a brand-new applicant has neither yet, so this
 * page seeds the wizard with a blank, unpersisted scaffold rather than
 * redirecting. Nothing is written to the database until the applicant's
 * first save (lib/actions/registration.ts).
 */
const BLANK_ORG: Organization = {
  id: "",
  name: "",
  rcNumber: "",
  yearEstablishedBand: "" as Organization["yearEstablishedBand"],
  sectorId: "",
  sizeTier: "micro",
  geographicalCoverage: "" as Organization["geographicalCoverage"],
  ownershipStructure: "" as Organization["ownershipStructure"],
  localOrMultinational: "local",
  isUnionised: false,
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  previousParticipation: { participated: false, years: [] },
};

const BLANK_DECLARATIONS = { legallyRegistered: false, taxCompliant: false, notUnderSanction: false, infoAccurate: false };

export default async function ApplicantProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [application, sectors] = await Promise.all([getApplicationForApplicantUser(user.id), getSectors()]);

  return (
    <ProfileWizard
      applicationId={application?.id ?? null}
      initialOrg={application?.organization ?? { ...BLANK_ORG, primaryContactEmail: user.email }}
      initialDeclarations={application?.eligibilityDeclarations ?? BLANK_DECLARATIONS}
      sectors={sectors}
    />
  );
}
