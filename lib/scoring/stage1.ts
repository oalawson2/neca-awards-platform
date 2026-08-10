/**
 * Stage 1 auto-scoring engine (doc section 4.2) — pure functions, no I/O,
 * so both the mock store's seed data and the real question-engine pages
 * (Phase 3+) can share the exact same scoring logic.
 *
 * Several rules here are generalized from the doc's own "representative,
 * non-obvious examples" table (section 9.1), which explicitly instructs:
 * "developers should derive [the rest] directly from the Track and
 * Evidence Trigger columns of each Section question table." Each
 * generalization is flagged inline — these are judgment calls, not
 * literal doc text, and should be confirmed with NECA before going live:
 *
 *  1. Evidence trigger firing: a "yn" item fires its evidence field on
 *     "Yes"; a "maturity" item fires at level ≥ 3 (every 5-point scale in
 *     this doc uses "documented/formal" as its level-3 label — B2, C1
 *     match this exactly); a "frequency" item fires at "Sometimes" or
 *     above. Doc explicitly confirms the yn=Yes and two MAT cases; the
 *     maturity-in-general and frequency rules are this codebase's
 *     extrapolation.
 *  2. Mandatory/Advanced weight split: 70/30 of the pillar's weight
 *     (doc section 4.3, explicitly "suggested"), divided evenly across
 *     the applicable (non-N/A) items within each track. If a track has
 *     zero applicable items, its whole share moves to the other track —
 *     the doc doesn't say this, but without it a pillar could lose
 *     points outright when e.g. no Advanced items apply.
 *  3. Numeric (NUM) items are only auto-scored when they carry a
 *     benchmarkKey (only C12, training hours, does — doc's prose names
 *     it as a benchmark example even though the item table tags it NUM
 *     not PCT), OR are D7/I5 (see 5 below, NECA-confirmed rules — no
 *     longer informational). Any other NUM item without a benchmarkKey
 *     is still informational: excluded from the Stage 1 denominator like
 *     an N/A item, since the doc never resolves how a general count-type
 *     metric would be benchmarked.
 *  4. Multi-select (MSEL) breadth scoring: 0 selections = 0%, 1–2 = 50%,
 *     3+ = 100% of the item's weight. Doc says "breadth and relevance,
 *     capped at the item's max weight" without a formula — relevance
 *     (whether selections are substantiated) is explicitly a Stage 2
 *     Jury judgment, not part of this Stage 1 auto-score.
 *  5. D7 (industrial actions/strikes) and I5 (youth internship ratio) —
 *     confirmed directly by NECA, fixed rules rather than a general
 *     formula:
 *     - D7 is an inverse fixed lookup (fewer strikes score higher, unlike
 *       every other frequency-style item): 0 → 100%, 1 → 60%, 2 → 30%,
 *       3+ → 0%.
 *     - I5's ratio = (I5's raw count) / (Section A employeeCount), banded
 *       0% → 0%, (0%, 1%] → 50%, (1%, 3%] → 80%, >3% → 100%. The table
 *       NECA gave states each band's *displayed* bounds sharing an
 *       endpoint (e.g. "1%" appears in both the 2nd and 3rd rows) — read
 *       as the standard up-to-and-including convention for the upper
 *       bound of each band, so 1% itself lands in the 80% band and 3%
 *       itself lands in the 80% band, not the 100% one. Stays Advanced
 *       track (unchanged) — NECA's own reasoning: a Mandatory ratio would
 *       unfairly favor larger companies. employeeCount missing/zero is
 *       treated as unable to compute (0%, not excluded) rather than
 *       blocking submission — a data-integrity gap, not grounds to stall
 *       an applicant.
 */

import type {
  AssessmentAnswer,
  AssessmentItem,
  BenchmarkBand,
  OrgSizeTier,
  PillarCode,
} from "@/types/domain";
import { ASSESSMENT_ITEMS } from "@/lib/mock/framework";
import { FREQUENCY_LEVEL_PERCENTS, MATURITY_LEVEL_PERCENTS } from "@/types/domain";

/** The items that actually apply to this org, resolving Section D's branch to whichever path matches isUnionised. */
export function effectiveItemsForOrg(isUnionised: boolean): AssessmentItem[] {
  return ASSESSMENT_ITEMS.filter((item) => {
    if (!item.branchGroup) return true;
    return item.branchValue === (isUnionised ? "unionised" : "non_unionised");
  });
}

export function effectiveItemsForPillar(pillarCode: PillarCode, isUnionised: boolean): AssessmentItem[] {
  return effectiveItemsForOrg(isUnionised)
    .filter((i) => i.pillarCode === pillarCode)
    .sort((a, b) => a.order - b.order);
}

function findAnswer(answers: AssessmentAnswer[], itemId: string): AssessmentAnswer | undefined {
  return answers.find((a) => a.itemId === itemId);
}

function benchmarkScorePercent(bands: BenchmarkBand[], benchmarkKey: string, sectorId: string, value: number): number {
  const band =
    bands.find((b) => b.benchmarkKey === benchmarkKey && b.sectorId === sectorId) ??
    bands.find((b) => b.benchmarkKey === benchmarkKey && b.sectorId === "all");
  if (!band) return 0; // no Secretariat-configured band yet — see caller for the "needs configuration" signal
  const range = band.ranges.find((r) => value >= r.min && (r.max === null || value < r.max));
  return range?.scorePercent ?? 0;
}

/** D7's fixed inverse lookup — see file header note 5. */
function d7ScorePercent(strikeCount: number): number {
  const count = Math.max(0, strikeCount);
  if (count === 0) return 100;
  if (count === 1) return 60;
  if (count === 2) return 30;
  return 0;
}

/**
 * I5's youth internship ratio — see file header note 5. Returns 0 (not
 * null — I5 still contributes, just as a 0) when employeeCount is
 * missing/zero, since that's a data-integrity gap on Section A, not a
 * reason to exclude an otherwise-answered Advanced item from scoring.
 */
function i5ScorePercent(youthInternCount: number, employeeCount: number | null): number {
  if (!employeeCount || employeeCount <= 0) return 0;
  const ratio = Math.max(0, youthInternCount) / employeeCount;
  if (ratio === 0) return 0;
  if (ratio <= 0.01) return 50;
  if (ratio <= 0.03) return 80;
  return 100;
}

/**
 * Returns null when the item doesn't contribute to the Stage 1 pillar
 * denominator at all (N/A, narrative, or an un-benchmarked NUM item) —
 * callers must exclude it, not treat null as a zero score.
 */
export function itemScorePercent(
  item: AssessmentItem,
  answer: AssessmentAnswer | undefined,
  benchmarkBands: BenchmarkBand[],
  sectorId: string,
  employeeCount: number | null
): number | null {
  if (!answer || answer.isNA) return null;
  const value = answer.value;

  switch (item.responseType) {
    case "yn_na":
      if (typeof value !== "boolean") return null;
      // "Yes" earns provisional marks on Policy Exists (25%) + Implementation (30%) only — 55% of item weight.
      return value ? 55 : 0;
    case "maturity": {
      if (typeof value !== "number" || value < 1 || value > 5) return null;
      return MATURITY_LEVEL_PERCENTS[value - 1];
    }
    case "frequency": {
      if (typeof value !== "number" || value < 0 || value > 4) return null;
      return FREQUENCY_LEVEL_PERCENTS[value];
    }
    case "percentage": {
      if (typeof value !== "number" || !item.benchmarkKey) return null;
      return benchmarkScorePercent(benchmarkBands, item.benchmarkKey, sectorId, value);
    }
    case "numeric": {
      if (typeof value !== "number") return null;
      if (item.id === "D7") return d7ScorePercent(value);
      if (item.id === "I5") return i5ScorePercent(value, employeeCount);
      if (!item.benchmarkKey) return null; // other NUM items — see file header note 3
      return benchmarkScorePercent(benchmarkBands, item.benchmarkKey, sectorId, value);
    }
    case "multiselect": {
      if (!Array.isArray(value)) return null;
      const count = value.length;
      if (count >= 3) return 100;
      if (count >= 1) return 50;
      return 0;
    }
    case "narrative":
      return null; // never auto-scored — Stage 2 only
    default:
      return null;
  }
}

export interface PillarStage1Result {
  pillarCode: PillarCode;
  scorePercent: number; // 0-100, this pillar's own scale
  contributionPoints: number; // 0-weightPoints, this pillar's share of the 100-point overall score
  scoredItemCount: number;
  excludedItemCount: number;
}

/**
 * Stage 1 pillar score: applies the Mandatory/Advanced 70/30 split
 * (assumption 2 above), scores each applicable item, and rolls up to a
 * 0-100 pillar percentage and its weighted contribution to the overall
 * Stage 1 score.
 */
export function computePillarStage1Score(
  pillarCode: PillarCode,
  pillarWeightPoints: number,
  isUnionised: boolean,
  answers: AssessmentAnswer[],
  benchmarkBands: BenchmarkBand[],
  sectorId: string,
  employeeCount: number | null
): PillarStage1Result {
  const items = effectiveItemsForPillar(pillarCode, isUnionised);

  const scored = items
    .map((item) => ({
      item,
      percent: itemScorePercent(item, findAnswer(answers, item.id), benchmarkBands, sectorId, employeeCount),
    }))
    .filter((row): row is { item: AssessmentItem; percent: number } => row.percent !== null);

  const mandatory = scored.filter((r) => r.item.track === "mandatory");
  const advanced = scored.filter((r) => r.item.track === "advanced");

  let mandatoryShare = 0.7;
  let advancedShare = 0.3;
  if (mandatory.length === 0 && advanced.length > 0) {
    mandatoryShare = 0;
    advancedShare = 1;
  } else if (advanced.length === 0 && mandatory.length > 0) {
    mandatoryShare = 1;
    advancedShare = 0;
  }

  const mandatoryPoolPercent = mandatory.length > 0 ? (mandatory.reduce((s, r) => s + r.percent, 0) / mandatory.length) * mandatoryShare : 0;
  const advancedPoolPercent = advanced.length > 0 ? (advanced.reduce((s, r) => s + r.percent, 0) / advanced.length) * advancedShare : 0;

  const scorePercent = scored.length > 0 ? Math.round((mandatoryPoolPercent + advancedPoolPercent) * 10) / 10 : 0;
  const contributionPoints = Math.round(((scorePercent / 100) * pillarWeightPoints) * 100) / 100;

  return {
    pillarCode,
    scorePercent,
    contributionPoints,
    scoredItemCount: scored.length,
    excludedItemCount: items.length - scored.length,
  };
}

export interface Stage1ScoreResult {
  overallScore: number; // 0-100
  pillars: PillarStage1Result[];
}

export function computeStage1Score(
  pillars: { code: PillarCode; weightPoints: number; scored: boolean }[],
  isUnionised: boolean,
  answers: AssessmentAnswer[],
  benchmarkBands: BenchmarkBand[],
  sectorId: string,
  employeeCount: number | null
): Stage1ScoreResult {
  const results = pillars
    .filter((p) => p.scored)
    .map((p) => computePillarStage1Score(p.code, p.weightPoints, isUnionised, answers, benchmarkBands, sectorId, employeeCount));
  const overallScore = Math.round(results.reduce((s, r) => s + r.contributionPoints, 0) * 10) / 10;
  return { overallScore, pillars: results };
}

/** Whether this item's evidence trigger has fired for a given answer — see file header assumption 1. */
export function evidenceTriggerFired(item: AssessmentItem, answer: AssessmentAnswer | undefined): boolean {
  if (!item.evidenceName || !answer || answer.isNA) return false;
  const value = answer.value;
  switch (item.responseType) {
    case "yn_na":
      return value === true;
    case "maturity":
      return typeof value === "number" && value >= 3;
    case "frequency":
      return typeof value === "number" && value >= 2;
    default:
      return false;
  }
}

/** Sector/size bucket used for shortlist ranking and benchmark sector fallback. */
export function categoryKey(sectorId: string, sizeTier: OrgSizeTier): string {
  return `${sectorId}::${sizeTier}`;
}
