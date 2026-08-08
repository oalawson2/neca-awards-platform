import { createClient } from "@/lib/supabase/server";
import type { Application, ApplicationStatus, Organization } from "@/types/domain";

export interface ApplicationWithOrg extends Application {
  organization: Organization;
}

// No contact_phone column exists on the real organizations table at all
// (checked directly against information_schema — this codebase's
// primaryContactPhone field has no home in the real schema). Kept in the
// UI/type as an always-blank, unpersisted field rather than removed
// outright, since dropping it is a product decision, not an engineering
// one — flagging this clearly rather than silently discarding it.
const ORG_COLUMNS =
  "id, name, rc_number, year_established_band, sector_id, org_size_tier, geographical_coverage, ownership_structure, is_local_or_multinational, is_unionised, contact_name, contact_email, previous_participation, eligibility_declarations";

const APPLICATION_COLUMNS = `id, organization_id, cycle_year, status, stage1_score, submitted_at, eligibility_review_needed, red_flag_count, organizations (${ORG_COLUMNS})`;

type OrgRow = {
  id: string;
  name: string;
  rc_number: string;
  year_established_band: string | null;
  sector_id: string;
  org_size_tier: string;
  geographical_coverage: string | null;
  ownership_structure: string | null;
  is_local_or_multinational: string | null;
  is_unionised: boolean;
  contact_name: string;
  contact_email: string;
  previous_participation: boolean;
  eligibility_declarations: {
    legally_registered_nigeria: boolean | null;
    tax_compliant: boolean | null;
    no_regulatory_sanction: boolean | null;
    information_accurate: boolean | null;
  };
};

type AppRow = {
  id: string;
  organization_id: string;
  cycle_year: number;
  status: ApplicationStatus;
  stage1_score: number | null;
  submitted_at: string | null;
  eligibility_review_needed: boolean;
  red_flag_count: number;
  organizations: OrgRow | OrgRow[];
};

const SECTOR_WINNER_STATUSES: ApplicationStatus[] = ["sector_winner", "eoy_finalist", "eoy_winner"];
const EOY_FINALIST_STATUSES: ApplicationStatus[] = ["eoy_finalist", "eoy_winner"];
const DECIDED_STATUSES: ApplicationStatus[] = [
  "shortlisted",
  "not_shortlisted",
  "in_stage2",
  "stage2_scored",
  "sector_finalist",
  "sector_winner",
  "eoy_finalist",
  "eoy_winner",
];

function mapOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    rcNumber: row.rc_number,
    // year_established_band/geographical_coverage/ownership_structure/is_local_or_multinational
    // are nullable in the real schema (collected across later wizard steps) — cast through
    // the mock-era non-null domain type with an empty-string/undefined fallback rather than
    // widening the type everywhere it's consumed; ProfileWizard treats "" as "not yet chosen".
    yearEstablishedBand: (row.year_established_band ?? "") as Organization["yearEstablishedBand"],
    sectorId: row.sector_id,
    sizeTier: row.org_size_tier as Organization["sizeTier"],
    geographicalCoverage: (row.geographical_coverage ?? "") as Organization["geographicalCoverage"],
    ownershipStructure: (row.ownership_structure ?? "") as Organization["ownershipStructure"],
    localOrMultinational: (row.is_local_or_multinational ?? "local") as Organization["localOrMultinational"],
    isUnionised: row.is_unionised,
    primaryContactName: row.contact_name,
    primaryContactEmail: row.contact_email,
    primaryContactPhone: "",
    previousParticipation: { participated: row.previous_participation, years: [] },
  };
}

/** organizations.eligibility_declarations starts as all-null (schema default) until Section A is first saved. */
function mapDeclarations(d: OrgRow["eligibility_declarations"]) {
  return {
    legallyRegistered: !!d?.legally_registered_nigeria,
    taxCompliant: !!d?.tax_compliant,
    notUnderSanction: !!d?.no_regulatory_sanction,
    infoAccurate: !!d?.information_accurate,
  };
}

function mapApp(row: AppRow): ApplicationWithOrg {
  const orgRow = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
  const organization = mapOrg(orgRow);
  return {
    id: row.id,
    // No reference_no column in the real schema — computed, deterministic, not stored.
    referenceNo: `EEA-${row.cycle_year}-${row.id.slice(0, 8).toUpperCase()}`,
    organizationId: row.organization_id,
    status: row.status,
    // eligibility_declarations live on organizations in the real schema, not applications.
    eligibilityDeclarations: mapDeclarations(orgRow.eligibility_declarations),
    eligibilityFlagged: row.eligibility_review_needed,
    submittedAt: row.submitted_at,
    stage1Score: row.stage1_score,
    isShortlisted: DECIDED_STATUSES.includes(row.status) ? row.status !== "not_shortlisted" : null,
    isSectorWinner: SECTOR_WINNER_STATUSES.includes(row.status),
    isEmployerOfYearFinalist: EOY_FINALIST_STATUSES.includes(row.status),
    isEmployerOfYear: row.status === "eoy_winner",
    organization,
  };
}

export interface ApplicationFilters {
  search?: string;
  sectorId?: string;
  status?: Application["status"];
}

export async function getApplications(filters: ApplicationFilters = {}): Promise<ApplicationWithOrg[]> {
  const supabase = await createClient();
  let query = supabase.from("applications").select(APPLICATION_COLUMNS);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query.order("submitted_at", { ascending: false, nullsFirst: false });
  if (error || !data) return [];

  let results = (data as unknown as AppRow[]).map(mapApp);
  // sector/search filters applied client-side post-join — Supabase's embedded-resource
  // filtering (organizations.sector_id=eq...) needs the FK direction PostgREST doesn't
  // support cleanly here without a second round trip; fine at this data volume.
  if (filters.sectorId) results = results.filter((a) => a.organization.sectorId === filters.sectorId);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter((a) => a.organization.name.toLowerCase().includes(q));
  }
  return results;
}

export async function getApplication(applicationId: string): Promise<ApplicationWithOrg | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("applications").select(APPLICATION_COLUMNS).eq("id", applicationId).maybeSingle();
  if (error || !data) return null;
  return mapApp(data as unknown as AppRow);
}

/** Resolves the single application belonging to a logged-in applicant user, if one has been started yet. */
export async function getApplicationForApplicantUser(userId: string): Promise<ApplicationWithOrg | null> {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").eq("created_by", userId).maybeSingle();
  if (!org) return null;

  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_COLUMNS)
    .eq("organization_id", org.id)
    .maybeSingle();
  if (error || !data) return null;
  return mapApp(data as unknown as AppRow);
}

/**
 * Applications visible to a juror, panel-independence enforced by RLS
 * itself (applications_select_jury_panel: is_jury() AND
 * application_in_my_panel(id) AND status IN (shortlisted, in_stage2, ...))
 * — this function no longer needs to replicate that filtering in app code
 * the way the mock version did.
 *
 * NOT yet handled: the mock version also excluded applications a juror
 * was excused from via a recorded conflict of interest (doc section
 * 11.5). The real schema has no equivalent table for that at all — no
 * juror_conflicts/excusal concept exists anywhere in the 22 tables. This
 * is a genuine gap, not an oversight; flagging it for task #48 (panels),
 * since resolving it means either a new table (another schema change,
 * should be confirmed before adding) or a different mechanism entirely.
 */
export async function getApplicationsForJurorPanel(_jurorId: string): Promise<ApplicationWithOrg[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("applications").select(APPLICATION_COLUMNS).neq("status", "draft");
  if (error || !data) return [];
  return (data as unknown as AppRow[]).map(mapApp);
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("applications").select("status, eligibility_review_needed");
  if (error || !data) {
    return { total: 0, submitted: 0, shortlisted: 0, inStage2: 0, scored: 0, eligibilityFlagged: 0 };
  }

  return {
    total: data.length,
    submitted: data.filter((a) => a.status === "submitted").length,
    shortlisted: data.filter((a) => DECIDED_STATUSES.includes(a.status) && a.status !== "not_shortlisted").length,
    inStage2: data.filter((a) => a.status === "in_stage2").length,
    scored: data.filter((a) =>
      ["stage2_scored", "sector_finalist", "sector_winner", "eoy_finalist", "eoy_winner"].includes(a.status)
    ).length,
    eligibilityFlagged: data.filter((a) => a.eligibility_review_needed).length,
  };
}
