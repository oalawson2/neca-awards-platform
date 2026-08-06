import { store } from "@/lib/mock/store";
import type { Application, Organization } from "@/types/domain";

export interface ApplicationWithOrg extends Application {
  organization: Organization;
}

function withOrg(app: Application): ApplicationWithOrg {
  const organization = store.organizations.find((o) => o.id === app.organizationId)!;
  return { ...app, organization };
}

export interface ApplicationFilters {
  search?: string;
  sectorId?: string;
  status?: Application["status"];
}

export async function getApplications(filters: ApplicationFilters = {}): Promise<ApplicationWithOrg[]> {
  let results = store.applications.map(withOrg);
  if (filters.sectorId) results = results.filter((a) => a.organization.sectorId === filters.sectorId);
  if (filters.status) results = results.filter((a) => a.status === filters.status);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter((a) => a.organization.name.toLowerCase().includes(q));
  }
  return results.sort((a, b) => ((a.submittedAt ?? "") < (b.submittedAt ?? "") ? 1 : -1));
}

export async function getApplication(applicationId: string): Promise<ApplicationWithOrg | null> {
  const app = store.applications.find((a) => a.id === applicationId);
  return app ? withOrg(app) : null;
}

/** Resolves the single application belonging to a logged-in applicant user. */
export async function getApplicationForApplicantUser(userId: string): Promise<ApplicationWithOrg | null> {
  const { applicantOrgLink } = await import("@/lib/mock/store");
  const orgId = applicantOrgLink[userId];
  if (!orgId) return null;
  const app = store.applications.find((a) => a.organizationId === orgId);
  return app ? withOrg(app) : null;
}

/**
 * Applications in sectors assigned to a juror's panel, tagged with
 * whether that application is currently in this juror's Stage 2 work
 * (document verification or interview). Panel independence: this only
 * ever returns applications in the juror's own panel's assigned sectors
 * — a real data-access gate, not a UI-only filter, so it maps directly to
 * an RLS policy later (see task #30 for the fuller panel-assignment
 * build-out; this is the minimal version other pages need meanwhile).
 */
export async function getApplicationsForJurorPanel(jurorId: string) {
  const panel = store.panels.find((p) => p.jurorIds.includes(jurorId));
  if (!panel) return [];
  const sectorIds = store.panelSectorAssignments.filter((a) => a.panelId === panel.id).map((a) => a.sectorId);
  return store.applications
    .filter((a) => a.status !== "draft")
    .map(withOrg)
    .filter((a) => sectorIds.includes(a.organization.sectorId));
}

export async function getDashboardStats() {
  const all = store.applications;
  return {
    total: all.length,
    submitted: all.filter((a) => a.status === "submitted").length,
    shortlisted: all.filter((a) => a.isShortlisted === true).length,
    inStage2: all.filter((a) => a.status === "stage2_verification" || a.status === "stage2_interview").length,
    scored: all.filter((a) => a.status === "scored" || a.status === "released").length,
    eligibilityFlagged: all.filter((a) => a.eligibilityFlagged).length,
  };
}
