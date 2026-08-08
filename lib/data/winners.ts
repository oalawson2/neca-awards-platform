import { store } from "@/lib/mock/store";
import { PILLARS } from "@/lib/mock/framework";
import { applicantVerifiedScore, jurorVerifiedScore } from "@/lib/scoring/stage2";
import type { EmployerOfYearResult, EmployerOfYearValidation } from "@/types/domain";

export interface ScoredApplicationRow {
  applicationId: string;
  organizationName: string;
  verifiedScore: number;
  isSectorWinner: boolean;
}

export interface SectorWinnerGroup {
  sectorId: string;
  sectorName: string;
  scored: ScoredApplicationRow[];
}

/** Every "scored" application, ranked by panel-averaged Verified Score within its sector — the panel's own candidates for that sector's winner (doc section 11.5: "one sectoral winner per assigned sector"). */
export async function getSectorWinnerGroups(): Promise<SectorWinnerGroup[]> {
  const scoredApps = store.applications.filter((a) => a.status === "stage2_scored" || a.isSectorWinner);
  const groups: SectorWinnerGroup[] = [];

  for (const sector of store.sectors) {
    const inSector = scoredApps
      .map((app) => ({ app, org: store.organizations.find((o) => o.id === app.organizationId)! }))
      .filter(({ org }) => org.sectorId === sector.id);
    if (inSector.length === 0) continue;

    const rows: ScoredApplicationRow[] = inSector
      .map(({ app, org }) => {
        const cards = store.pillarScorecards.filter((c) => c.applicationId === app.id && c.round === "sector");
        const { overall } = applicantVerifiedScore(PILLARS, cards);
        return { applicationId: app.id, organizationName: org.name, verifiedScore: overall, isSectorWinner: !!app.isSectorWinner };
      })
      .sort((a, b) => b.verifiedScore - a.verifiedScore);

    groups.push({ sectorId: sector.id, sectorName: sector.name, scored: rows });
  }
  return groups;
}

export async function getEmployerOfYearFinalists() {
  return store.applications
    .filter((a) => a.isEmployerOfYearFinalist)
    .map((app) => ({ ...app, organization: store.organizations.find((o) => o.id === app.organizationId)! }));
}

/**
 * Overall Verified Score per finalist = mean of ALL 9 jurors' individual
 * Verified Scores (doc section 11.6, step 3) — not a panel average like
 * the sector round, since every juror scores every finalist here,
 * including jurors from the finalist's own panel.
 */
export async function getEmployerOfYearResults(): Promise<EmployerOfYearResult[]> {
  const finalists = await getEmployerOfYearFinalists();
  const allJurorIds = store.users.filter((u) => u.role === "jury").map((u) => u.id);

  const results = finalists.map((finalist) => {
    const individualScores = allJurorIds
      .map((jurorId) => {
        const cards = store.pillarScorecards.filter((c) => c.applicationId === finalist.id && c.jurorId === jurorId && c.round === "employer_of_year");
        return jurorVerifiedScore(cards, PILLARS);
      })
      .filter((s): s is number => s !== null);

    const overallVerifiedScore =
      individualScores.length > 0 ? Math.round((individualScores.reduce((a, b) => a + b, 0) / individualScores.length) * 100) / 100 : 0;

    return { applicationId: finalist.id, overallVerifiedScore, individualScores, rank: 0 };
  });

  return results
    .sort((a, b) => b.overallVerifiedScore - a.overallVerifiedScore)
    .map((r, idx) => ({ ...r, rank: idx + 1 }));
}

export async function getEmployerOfYearJurorProgress() {
  const finalists = await getEmployerOfYearFinalists();
  const allJurors = store.users.filter((u) => u.role === "jury");
  return allJurors.map((juror) => {
    const submittedCount = finalists.filter((f) => {
      const cards = store.pillarScorecards.filter(
        (c) => c.applicationId === f.id && c.jurorId === juror.id && c.round === "employer_of_year" && c.submittedAt
      );
      return cards.length === PILLARS.filter((p) => p.scored).length;
    }).length;
    return { jurorId: juror.id, jurorName: juror.name, submittedCount, totalFinalists: finalists.length };
  });
}

export async function getEmployerOfYearValidation(): Promise<EmployerOfYearValidation> {
  return { ...store.employerOfYear };
}
