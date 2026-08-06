"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";
import { PILLARS } from "@/lib/mock/framework";
import { getPanelSubmissionCount } from "@/lib/data/scorecards";
import type { PillarCode, ScorecardRound } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
type Dimension = "policyExists" | "implementation" | "evidenceQuality" | "measurableImpact";

function getOrCreateCard(applicationId: string, jurorId: string, pillarCode: PillarCode, round: ScorecardRound) {
  let card = store.pillarScorecards.find(
    (c) => c.applicationId === applicationId && c.jurorId === jurorId && c.pillarCode === pillarCode && c.round === round
  );
  if (!card) {
    card = {
      id: generateId("scorecard"),
      applicationId,
      jurorId,
      pillarCode,
      round,
      policyExists: null,
      implementation: null,
      evidenceQuality: null,
      measurableImpact: null,
      submittedAt: null,
    };
    store.pillarScorecards.push(card);
  }
  return card;
}

export async function saveScorecardDimension(
  applicationId: string,
  jurorId: string,
  pillarCode: PillarCode,
  dimension: Dimension,
  value: number,
  round: ScorecardRound = "sector"
) {
  const card = getOrCreateCard(applicationId, jurorId, pillarCode, round);
  if (card.submittedAt) return { success: false, error: "This scorecard has already been submitted." };
  card[dimension] = value;
  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

export async function saveInterviewFinding(applicationId: string, jurorId: string, pillarCode: PillarCode, finding: string, round: ScorecardRound = "sector") {
  const card = getOrCreateCard(applicationId, jurorId, pillarCode, round);
  card.interviewFinding = finding;
  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

export interface SubmitScorecardResult {
  success: boolean;
  error?: string;
  outstandingPillars?: string[];
}

/**
 * Finalizes all 8 pillar scorecards at once. Blocked until every pillar
 * has all 4 dimensions filled. Logs one audit entry per pillar comparing
 * the Stage 1 self-declared score to this juror's Stage 2 pillar score
 * (doc section 12: "Log every score adjustment... against the
 * applicant's original Stage 1 answer"). Once every assigned panel
 * juror has submitted, moves the application to "scored" — this is
 * where the panel-averaged Verified Score becomes computable.
 */
export async function submitScorecard(applicationId: string, jurorId: string, jurorName: string, round: ScorecardRound = "sector"): Promise<SubmitScorecardResult> {
  const cards = SCORED_PILLARS.map((p) => getOrCreateCard(applicationId, jurorId, p.code, round));
  const outstanding = cards.filter((c) => c.policyExists === null || c.implementation === null || c.evidenceQuality === null || c.measurableImpact === null);
  if (outstanding.length > 0) {
    return {
      success: false,
      error: "Score all 4 dimensions on every pillar before submitting.",
      outstandingPillars: outstanding.map((c) => c.pillarCode),
    };
  }

  const app = store.applications.find((a) => a.id === applicationId);
  const org = app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;
  const now = new Date().toISOString();
  for (const card of cards) {
    card.submittedAt = now;
    store.scoreAdjustments.push({
      id: generateId("scoreadj"),
      applicationId,
      itemId: card.pillarCode,
      jurorId,
      stage1Value: "Self-declared (Policy/Implementation only; Evidence Quality & Measurable Impact held at 0)",
      note: `Stage 2 pillar score — Policy ${card.policyExists}, Implementation ${card.implementation}, Evidence Quality ${card.evidenceQuality}, Measurable Impact ${card.measurableImpact}`,
      timestamp: now,
    });
  }

  logAction(jurorName, "Submitted pillar scorecard for", org?.name ?? applicationId);

  if (round === "sector" && app) {
    const { submitted, total } = await getPanelSubmissionCount(applicationId, round);
    if (total > 0 && submitted >= total) {
      app.status = "scored";
      logAction("System", "All panel jurors scored", org?.name ?? applicationId);
    }
  }

  revalidatePath(`/jury/scorecard/${applicationId}`);
  revalidatePath("/jury");
  revalidatePath("/secretariat/live-scoring");
  return { success: true };
}
