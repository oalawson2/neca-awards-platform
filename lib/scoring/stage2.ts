/**
 * Stage 2 Verified Score computation (doc section 11.4) — pure functions.
 * Verified against the doc's own worked example (Alpha Manufacturing Ltd,
 * section 11.4): Juror 1's individual Verified Score = 67.05%, and Pillar
 * B's Panel Pillar Score (mean of 3.50/3.00/3.70) = 3.40, contributing
 * 10.20% — checked against a ground truth, not just self-consistent.
 */

import { PILLAR_SCORE_WEIGHTS } from "@/types/domain";
import type { Pillar, PillarScorecard } from "@/types/domain";

/** Per pillar, per juror: (Policy×0.25) + (Implementation×0.30) + (EvidenceQuality×0.25) + (MeasurableImpact×0.20). Null if any dimension is unscored. */
export function blendedPillarScore(card: PillarScorecard): number | null {
  const { policyExists, implementation, evidenceQuality, measurableImpact } = card;
  if (policyExists === null || implementation === null || evidenceQuality === null || measurableImpact === null) return null;
  const blended =
    policyExists * PILLAR_SCORE_WEIGHTS.policyExists +
    implementation * PILLAR_SCORE_WEIGHTS.implementation +
    evidenceQuality * PILLAR_SCORE_WEIGHTS.evidenceQuality +
    measurableImpact * PILLAR_SCORE_WEIGHTS.measurableImpact;
  return Math.round(blended * 100) / 100;
}

/** One juror's own Verified Score across all 8 pillars — an intermediate figure (doc: "just one input", not the number that counts on its own for panel scoring, but IS the number that counts for the Employer of the Year round). */
export function jurorVerifiedScore(cards: PillarScorecard[], pillars: Pillar[]): number | null {
  const scoredPillars = pillars.filter((p) => p.scored);
  let total = 0;
  for (const pillar of scoredPillars) {
    const card = cards.find((c) => c.pillarCode === pillar.code);
    if (!card) return null;
    const blended = blendedPillarScore(card);
    if (blended === null) return null;
    total += (blended / 5) * pillar.weightPoints;
  }
  return Math.round(total * 100) / 100;
}

export interface PanelPillarResult {
  pillarCode: Pillar["code"];
  panelPillarScore: number; // mean of the panel jurors' blended scores, 0-5
  contributionPercent: number; // (panelPillarScore/5) * pillar weight
  jurorScoresCount: number;
}

/** Mean of the panel's (up to 3) jurors' Blended Scores for one pillar — "averaging out any one juror's harshness or leniency ... before the score ever leaves the panel." */
export function panelPillarScore(pillarCode: Pillar["code"], weightPoints: number, cardsForPillar: PillarScorecard[]): PanelPillarResult {
  const blended = cardsForPillar.map(blendedPillarScore).filter((b): b is number => b !== null);
  const mean = blended.length > 0 ? blended.reduce((s, b) => s + b, 0) / blended.length : 0;
  const panelPillarScoreValue = Math.round(mean * 100) / 100;
  return {
    pillarCode,
    panelPillarScore: panelPillarScoreValue,
    contributionPercent: Math.round(((panelPillarScoreValue / 5) * weightPoints) * 100) / 100,
    jurorScoresCount: blended.length,
  };
}

/** Applicant's Verified Score = sum of the 8 pillar contributions, from the PANEL-averaged (not any one juror's) scores. */
export function applicantVerifiedScore(pillars: Pillar[], allCardsForApplication: PillarScorecard[]): { overall: number; byPillar: PanelPillarResult[] } {
  const scoredPillars = pillars.filter((p) => p.scored);
  const byPillar = scoredPillars.map((p) =>
    panelPillarScore(
      p.code,
      p.weightPoints,
      allCardsForApplication.filter((c) => c.pillarCode === p.code)
    )
  );
  const overall = Math.round(byPillar.reduce((s, p) => s + p.contributionPercent, 0) * 100) / 100;
  return { overall, byPillar };
}
