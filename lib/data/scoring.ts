import { store } from "@/lib/mock/store";
import type { JurorScorecard } from "@/types/domain";

export async function getJurorScorecard(applicationId: string, jurorId: string): Promise<JurorScorecard | null> {
  return store.scorecards.find((s) => s.applicationId === applicationId && s.jurorId === jurorId) ?? null;
}

/** All scorecards for an application — Secretariat-only view (live scoring / collation sheet). */
export async function getScorecardsForApplication(applicationId: string): Promise<JurorScorecard[]> {
  return store.scorecards.filter((s) => s.applicationId === applicationId);
}
