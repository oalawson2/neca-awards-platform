import { store, applicantOrgLink } from "@/lib/mock/store";
import { getCertificationBonus } from "@/lib/data/documents";
import type { Application, Organization, ScoreSummary } from "@/types/domain";

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
  if (filters.sectorId) results = results.filter((a) => a.sectorId === filters.sectorId);
  if (filters.status) results = results.filter((a) => a.status === filters.status);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter((a) => a.organization.name.toLowerCase().includes(q));
  }
  return results.sort((a, b) => (a.submittedAt ?? "") < (b.submittedAt ?? "") ? 1 : -1);
}

export async function getApplication(applicationId: string): Promise<ApplicationWithOrg | null> {
  const app = store.applications.find((a) => a.id === applicationId);
  return app ? withOrg(app) : null;
}

/** Resolves the single application belonging to a logged-in applicant user. */
export async function getApplicationForApplicantUser(userId: string): Promise<ApplicationWithOrg | null> {
  const orgId = applicantOrgLink[userId];
  if (!orgId) return null;
  const app = store.applications.find((a) => a.organizationId === orgId);
  return app ? withOrg(app) : null;
}

/** Applications in any sector the juror is assigned to, each tagged with that juror's own scorecard status. */
export async function getApplicationsForJuror(jurorId: string) {
  const sectorIds = store.jurorAssignments.filter((a) => a.jurorId === jurorId).map((a) => a.sectorId);
  const apps = store.applications
    .filter((a) => sectorIds.includes(a.sectorId) && a.status !== "draft" && a.status !== "awaiting_review" && a.status !== "incomplete")
    .map(withOrg);

  return apps.map((app) => {
    const scorecard = store.scorecards.find((s) => s.applicationId === app.id && s.jurorId === jurorId);
    return { ...app, myScorecardStatus: scorecard?.status ?? "not_started" };
  });
}

/**
 * Score summary honoring the "total ÷ jurors assigned (not just those who
 * scored)" rule, and the incomplete-scoring state when any assigned juror
 * hasn't submitted yet.
 */
export async function getScoreSummary(applicationId: string): Promise<ScoreSummary> {
  const app = store.applications.find((a) => a.id === applicationId);
  const jurorsAssigned = app
    ? store.jurorAssignments.filter((a) => a.sectorId === app.sectorId).length
    : 0;
  const submittedScorecards = store.scorecards.filter(
    (s) => s.applicationId === applicationId && s.status === "submitted"
  );
  const jurorsScored = submittedScorecards.length;
  const isComplete = jurorsAssigned > 0 && jurorsScored === jurorsAssigned;
  const bonus = isComplete ? await getCertificationBonus(applicationId) : 0;
  const averageScore = isComplete
    ? Math.round(
        (submittedScorecards.reduce((sum, s) => sum + (s.totalScore ?? 0), 0) / jurorsAssigned + bonus) * 10
      ) / 10
    : null;

  return { jurorsAssigned, jurorsScored, isComplete, averageScore };
}

export interface CriterionBreakdownRow {
  criterionId: string;
  name: string;
  maxPoints: number;
  averagePoints: number;
}

/** Per-criterion average across all jurors assigned to the application's sector (same denominator as getScoreSummary). */
export async function getCriterionBreakdown(applicationId: string): Promise<CriterionBreakdownRow[]> {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return [];
  const jurorsAssigned = store.jurorAssignments.filter((a) => a.sectorId === app.sectorId).length;
  const submitted = store.scorecards.filter((s) => s.applicationId === applicationId && s.status === "submitted");

  return store.criteria
    .sort((a, b) => a.order - b.order)
    .map((crit) => {
      // Items are raw 0–5 regardless of criterion; scale each juror's
      // criterion score up to the criterion's weight before averaging
      // (matches the scaling in lib/mock/store.ts's scoreCriteria).
      const scaledTotal = submitted.reduce((sum, sc) => {
        const criterionScore = sc.criteriaScores.find((c) => c.criterionId === crit.id);
        if (!criterionScore) return sum;
        const n = criterionScore.items.length;
        const rawSum = criterionScore.items.reduce((s, i) => s + (i.value ?? 0), 0);
        return sum + (n > 0 ? (rawSum / (n * 5)) * crit.weightPoints : 0);
      }, 0);
      const averagePoints = jurorsAssigned > 0 ? Math.round((scaledTotal / jurorsAssigned) * 10) / 10 : 0;
      return { criterionId: crit.id, name: crit.name, maxPoints: crit.weightPoints, averagePoints };
    });
}

export async function getDashboardStats() {
  const all = store.applications;
  return {
    total: all.length,
    awaitingReview: all.filter((a) => a.status === "awaiting_review").length,
    inScoring: all.filter((a) => a.status === "scoring").length,
    scoringComplete: all.filter((a) => a.status === "scored" || a.status === "released").length,
  };
}
