"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import type { EligibilityDeclarations, Organization } from "@/types/domain";

export type OrganizationProfileInput = Omit<Organization, "id">;

/**
 * Recomputes whether an application should be flagged for Secretariat
 * review, from its own eligibility declarations. Doc section 9.1 also
 * flags on "G2 = No" (Section G — "complies with all applicable local
 * laws...") — G2 doesn't exist as an answerable item until the Sections
 * B–I question engine is built (task #27), so this only checks
 * declarations for now. Whoever builds task #27 needs to extend this
 * function to also check G2 once that answer exists, not add a second,
 * separate flagging path.
 */
function recomputeEligibilityFlag(applicationId: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return;

  const failedDeclaration = Object.values(app.eligibilityDeclarations).some((v) => v === false);
  const existing = store.eligibilityReviews.find((r) => r.applicationId === applicationId && r.status === "open");

  if (failedDeclaration && !existing) {
    store.eligibilityReviews.push({
      id: generateId("elig"),
      applicationId,
      reasons: ["declaration_unchecked"],
      status: "open",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });
    app.eligibilityFlagged = true;
  } else if (!failedDeclaration && existing && existing.reasons.every((r) => r === "declaration_unchecked")) {
    existing.status = "resolved";
    existing.resolvedAt = new Date().toISOString();
    app.eligibilityFlagged = false;
  } else {
    app.eligibilityFlagged = !!existing;
  }
}

export interface SaveProfileResult {
  success: boolean;
  error?: string;
}

/**
 * Section A save. Duplicate RC number is blocked here (email is already
 * blocked at sign-up — see lib/auth/actions.ts) — "one submission per
 * organisation" (doc section 3, Stage 0). A failed eligibility
 * declaration flags the application for Secretariat review but never
 * blocks saving or, later, submission (doc section 9.1) — it's recorded,
 * not enforced as a gate.
 */
export async function saveOrganizationProfile(
  applicationId: string,
  profile: OrganizationProfileInput,
  eligibilityDeclarations: EligibilityDeclarations
): Promise<SaveProfileResult> {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };

  const trimmedRc = profile.rcNumber.trim();
  if (trimmedRc) {
    const duplicate = store.organizations.find(
      (o) => o.id !== app.organizationId && o.rcNumber.trim().toLowerCase() === trimmedRc.toLowerCase()
    );
    if (duplicate) {
      return { success: false, error: "An application already exists for this RC number." };
    }
  }

  const org = store.organizations.find((o) => o.id === app.organizationId);
  if (!org) return { success: false, error: "Organisation not found." };

  Object.assign(org, profile);
  app.eligibilityDeclarations = eligibilityDeclarations;
  recomputeEligibilityFlag(applicationId);

  logAction(org.name || "Applicant", "Saved organisation profile for", org.name || applicationId);
  revalidatePath("/applicant/profile");
  revalidatePath("/applicant");
  return { success: true };
}
