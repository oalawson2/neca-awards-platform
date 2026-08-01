"use server";

import { revalidatePath } from "next/cache";
import { store, scoreCriteria } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

export async function saveScoreItem(
  applicationId: string,
  jurorId: string,
  criterionId: string,
  itemId: string,
  value: number,
  note?: string
) {
  const scorecard = store.scorecards.find((s) => s.applicationId === applicationId && s.jurorId === jurorId);
  if (!scorecard) return { success: false, error: "Scorecard not found." };

  const criterionScore = scorecard.criteriaScores.find((c) => c.criterionId === criterionId);
  const item = criterionScore?.items.find((i) => i.id === itemId);
  if (!item) return { success: false, error: "Score item not found." };

  item.value = value;
  if (note !== undefined) item.note = note;
  if (scorecard.status === "not_started") scorecard.status = "in_progress";
  return { success: true };
}

export async function submitScorecard(applicationId: string, jurorId: string, jurorName: string) {
  const scorecard = store.scorecards.find((s) => s.applicationId === applicationId && s.jurorId === jurorId);
  if (!scorecard) return { success: false, error: "Scorecard not found." };

  const allScored = scorecard.criteriaScores.every((c) => c.items.every((i) => i.value !== null));
  if (!allScored) return { success: false, error: "Score every item before submitting." };

  scorecard.status = "submitted";
  scorecard.submittedAt = new Date().toISOString();
  scorecard.totalScore = scoreCriteria(scorecard.criteriaScores);

  const app = store.applications.find((a) => a.id === applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction(jurorName, "Submitted score for", orgName ?? applicationId);

  revalidatePath("/jury");
  revalidatePath("/secretariat/live-scoring");
  return { success: true };
}

/** Secretariat closes the scoring window for a sector — this is what reveals per-juror scores were finalized. */
export async function closeScoringWindow(sectorId: string, sectorName: string) {
  const apps = store.applications.filter((a) => a.sectorId === sectorId && a.status === "scoring");
  for (const app of apps) {
    const scorecards = store.scorecards.filter((s) => s.applicationId === app.id);
    const allSubmitted = scorecards.length > 0 && scorecards.every((s) => s.status === "submitted");
    if (allSubmitted) app.status = "scored";
  }
  logAction("System", "Closed scoring window for", sectorName);
  revalidatePath("/secretariat/live-scoring");
  revalidatePath("/secretariat");
  return { success: true };
}
