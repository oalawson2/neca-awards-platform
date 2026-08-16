"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { getApplicationsClosedStatus } from "@/lib/data/resultsRelease";
import type { EligibilityDeclarations, Organization } from "@/types/domain";

export type OrganizationProfileInput = Omit<Organization, "id">;

export interface SaveProfileResult {
  success: boolean;
  error?: string;
  /** Present on success — the caller (ProfileWizard) needs this on first save, when it didn't have one yet. */
  applicationId?: string;
}

function toDbDeclarations(d: EligibilityDeclarations) {
  return {
    legally_registered_nigeria: d.legallyRegistered,
    tax_compliant: d.taxCompliant,
    no_regulatory_sanction: d.notUnderSanction,
    information_accurate: d.infoAccurate,
  };
}

/**
 * `eligibility_reviews` has no INSERT/UPDATE policy for applicants at all
 * (only `eligibility_reviews_secretariat`, ALL commands gated on
 * is_secretariat()) — an applicant's own session can never create the
 * review record their own failed declaration is supposed to produce.
 * Uses the service-role client for just this write, the same justified
 * exception as audit_log (see lib/supabase/admin.ts) — the applicant-
 * visible signal (applications.eligibility_review_needed) is still set
 * through their own normal, RLS-scoped write below.
 */
async function syncEligibilityReview(applicationId: string, failedDeclaration: boolean) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("eligibility_reviews")
    .select("id")
    .eq("application_id", applicationId)
    .eq("status", "pending")
    .eq("reason", "declaration_unchecked")
    .maybeSingle();

  if (failedDeclaration && !existing) {
    await admin.from("eligibility_reviews").insert({
      application_id: applicationId,
      reason: "declaration_unchecked",
      status: "pending",
    });
  } else if (!failedDeclaration && existing) {
    await admin.from("eligibility_reviews").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", existing.id);
  }
}

/**
 * Section A save — now create-or-update depending on whether the
 * applicant already has an application. Self-signup no longer creates an
 * organization/application row (see lib/auth/actions.ts's docstring) — the
 * first successful save here does, deferred until enough fields exist to
 * satisfy the real schema's NOT NULL columns (sector_id, org_size_tier,
 * contact_name, contact_email, is_unionised — see the CREATE-path check
 * below). "One submission per organisation" (rc_number + contact_email
 * both unique) is enforced by the database itself now; a 23505 unique
 * violation is surfaced as a friendly error rather than a raw DB error.
 */
export async function saveOrganizationProfile(
  applicationId: string | null,
  profile: OrganizationProfileInput,
  eligibilityDeclarations: EligibilityDeclarations
): Promise<SaveProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not signed in." };

  const trimmedName = profile.name.trim();
  const trimmedRc = profile.rcNumber.trim();
  if (!trimmedName || !trimmedRc) {
    return { success: false, error: "Organisation name and RC number are required." };
  }

  const supabase = await createClient();
  const failedDeclaration = Object.values(eligibilityDeclarations).some((v) => v === false);

  const orgFields = {
    name: trimmedName,
    rc_number: trimmedRc,
    employee_count: profile.employeeCount,
    // ProfileWizard only shows/populates this field when the selected
    // sector is "Other (Please Specify)", and clears it in its own state
    // the moment a different sector is chosen — so whatever's here at
    // save time is already correctly scoped, just trimmed/nulled here.
    sector_other_detail: profile.sectorOtherDetail?.trim() || null,
    year_established_band: profile.yearEstablishedBand || null,
    geographical_coverage: profile.geographicalCoverage || null,
    ownership_structure: profile.ownershipStructure || null,
    is_local_or_multinational: profile.localOrMultinational || null,
    is_unionised: profile.isUnionised,
    contact_name: profile.primaryContactName.trim(),
    contact_email: profile.primaryContactEmail.trim(),
    previous_participation: profile.previousParticipation.participated,
    eligibility_declarations: toDbDeclarations(eligibilityDeclarations),
  };

  if (applicationId) {
    const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
    if (!app) return { success: false, error: "Application not found." };

    const { error: orgError } = await supabase
      .from("organizations")
      .update({ ...orgFields, sector_id: profile.sectorId || undefined, org_size_tier: profile.sizeTier || undefined })
      .eq("id", app.organization_id);
    if (orgError) {
      if (orgError.code === "23505") {
        return { success: false, error: "An application already exists for this RC number or contact email." };
      }
      console.error("[saveOrganizationProfile] organizations update error:", JSON.stringify(orgError));
      await logAction("System", "Organisation profile save failed for", `${trimmedName} — update: ${orgError.code} ${orgError.message}`);
      return { success: false, error: "Could not save profile." };
    }

    const { error: appError } = await supabase
      .from("applications")
      .update({ eligibility_review_needed: failedDeclaration })
      .eq("id", applicationId);
    if (!appError) await syncEligibilityReview(applicationId, failedDeclaration);

    await logAction(trimmedName, "Saved organisation profile for", trimmedName);
    revalidatePath("/applicant/profile");
    revalidatePath("/applicant");
    return { success: true, applicationId };
  }

  if (!profile.sectorId || !profile.sizeTier || !orgFields.contact_name || !orgFields.contact_email) {
    return {
      success: false,
      error: "Complete organisation name, RC number, sector, size, and contact details before your first save.",
    };
  }

  // Checked proactively rather than left to surface as an RLS violation on
  // the applications insert below — applications_insert_own would reject
  // it either way, but this gives a real, specific message instead of a
  // raw permission error. Existing drafts are never affected (this is the
  // create-only path — the applicationId branch above returns first).
  const { closedAt } = await getApplicationsClosedStatus();
  if (closedAt) {
    return { success: false, error: "Applications for this cycle are now closed." };
  }

  const { data: newOrg, error: orgInsertError } = await supabase
    .from("organizations")
    .insert({ ...orgFields, sector_id: profile.sectorId, org_size_tier: profile.sizeTier, created_by: user.id })
    .select("id")
    .single();
  if (orgInsertError || !newOrg) {
    if (orgInsertError?.code === "23505") {
      return { success: false, error: "An application already exists for this RC number or contact email." };
    }
    console.error("[saveOrganizationProfile] organizations insert error:", JSON.stringify(orgInsertError));
    await logAction("System", "Organisation profile creation failed for", `${trimmedName} — insert: ${orgInsertError?.code} ${orgInsertError?.message}`);
    return { success: false, error: "Could not create your organisation profile." };
  }

  const { data: newApp, error: appInsertError } = await supabase
    .from("applications")
    .insert({ organization_id: newOrg.id, eligibility_review_needed: failedDeclaration })
    .select("id")
    .single();
  if (appInsertError || !newApp) {
    console.error("[saveOrganizationProfile] applications insert error:", JSON.stringify(appInsertError));
    await logAction("System", "Application creation failed for", `${trimmedName} — insert: ${appInsertError?.code} ${appInsertError?.message}`);
    return { success: false, error: "Organisation saved, but couldn't start your application. Try again." };
  }
  await syncEligibilityReview(newApp.id, failedDeclaration);

  await logAction(trimmedName, "Created organisation profile for", trimmedName);
  revalidatePath("/applicant/profile");
  revalidatePath("/applicant");
  return { success: true, applicationId: newApp.id };
}
