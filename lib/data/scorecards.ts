import { store } from "@/lib/mock/store";
import { PILLARS } from "@/lib/mock/framework";
import { blendedPillarScore, jurorVerifiedScore, applicantVerifiedScore } from "@/lib/scoring/stage2";
import type { PillarScorecard, ScorecardRound } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);

export async function getJurorScorecards(applicationId: string, jurorId: string, round: ScorecardRound = "sector"): Promise<PillarScorecard[]> {
  return store.pillarScorecards.filter((c) => c.applicationId === applicationId && c.jurorId === jurorId && c.round === round);
}

export interface ScorecardProgress {
  totalPillars: number;
  submittedPillars: number;
  isComplete: boolean;
}

export async function getScorecardProgress(applicationId: string, jurorId: string, round: ScorecardRound = "sector"): Promise<ScorecardProgress> {
  const cards = await getJurorScorecards(applicationId, jurorId, round);
  const submitted = cards.filter((c) => c.submittedAt !== null);
  return { totalPillars: SCORED_PILLARS.length, submittedPillars: submitted.length, isComplete: submitted.length === SCORED_PILLARS.length };
}

export async function getMyVerifiedScore(applicationId: string, jurorId: string, round: ScorecardRound = "sector"): Promise<number | null> {
  const cards = await getJurorScorecards(applicationId, jurorId, round);
  return jurorVerifiedScore(cards, PILLARS);
}

/**
 * How many of the panel's 3 jurors have finished scoring this
 * applicant — blind scoring: this is a count only, never the scores
 * themselves, so a juror filling in their own card can't see how the
 * others scored.
 */
export async function getPanelSubmissionCount(applicationId: string, round: ScorecardRound = "sector"): Promise<{ submitted: number; total: number }> {
  const app = store.applications.find((a) => a.id === applicationId);
  const org = app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;
  const panel = org ? store.panels.find((p) => store.panelSectorAssignments.some((a) => a.panelId === p.id && a.sectorId === org.sectorId)) : undefined;
  if (!panel) return { submitted: 0, total: 0 };

  const submittedJurorIds = new Set(
    panel.jurorIds.filter((jurorId) => {
      const cards = store.pillarScorecards.filter((c) => c.applicationId === applicationId && c.jurorId === jurorId && c.round === round);
      return cards.filter((c) => c.submittedAt !== null).length === SCORED_PILLARS.length;
    })
  );
  return { submitted: submittedJurorIds.size, total: panel.jurorIds.length };
}

/** Only meaningful once the whole panel has submitted — the Panel Pillar Score / Verified Score, per doc section 11.4. */
export async function getVerifiedScoreIfComplete(applicationId: string, round: ScorecardRound = "sector") {
  const { submitted, total } = await getPanelSubmissionCount(applicationId, round);
  if (total === 0 || submitted < total) return null;

  const allCards = store.pillarScorecards.filter((c) => c.applicationId === applicationId && c.round === round);
  return applicantVerifiedScore(PILLARS, allCards);
}

export { blendedPillarScore };
