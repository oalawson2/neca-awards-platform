import { store } from "@/lib/mock/store";
import { getScoreSummary, type ApplicationWithOrg } from "@/lib/data/applications";

export interface ShortlistEntry extends ApplicationWithOrg {
  finalScore: number;
}

/**
 * Once each sector produces a winner, the top 5 highest-scoring sector
 * winners become the Employer of the Year shortlist. Computed live from
 * scores rather than a stored flag, so it stays correct as scoring changes.
 */
export async function getEmployerOfYearShortlist(): Promise<ShortlistEntry[]> {
  const winners = store.applications.filter((a) => a.isSectorWinner);
  const withScores = await Promise.all(
    winners.map(async (app) => {
      const summary = await getScoreSummary(app.id);
      const organization = store.organizations.find((o) => o.id === app.organizationId)!;
      return { ...app, organization, finalScore: summary.averageScore ?? 0 };
    })
  );
  return withScores.sort((a, b) => b.finalScore - a.finalScore).slice(0, 5);
}

export async function getSectorWinnerCount(): Promise<{ decided: number; total: number }> {
  const total = store.sectors.length;
  const decided = new Set(store.applications.filter((a) => a.isSectorWinner).map((a) => a.sectorId)).size;
  return { decided, total };
}
