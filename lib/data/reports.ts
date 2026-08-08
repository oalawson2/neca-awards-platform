import { store } from "@/lib/mock/store";
import { PILLARS } from "@/lib/mock/framework";
import { applicantVerifiedScore } from "@/lib/scoring/stage2";
import { computeStage1Score } from "@/lib/scoring/stage1";
import type { NonShortlistedReport, ShortlistedReport } from "@/types/domain";

export async function getShortlistedReport(applicationId: string): Promise<ShortlistedReport | null> {
  return store.shortlistedReports.find((r) => r.applicationId === applicationId) ?? null;
}

export async function getNonShortlistedReport(applicationId: string): Promise<NonShortlistedReport | null> {
  return store.nonShortlistedReports.find((r) => r.applicationId === applicationId) ?? null;
}

export interface ReportQueueRow {
  applicationId: string;
  organizationName: string;
  variant: "shortlisted" | "non_shortlisted";
  status: "pending_approval" | "approved" | "sent_back" | "not_generated";
}

/** Every application eligible for a report (submitted, decided one way or the other) with its current report state. */
export async function getReportQueue(): Promise<ReportQueueRow[]> {
  const eligible = store.applications.filter((a) => a.isShortlisted !== null && a.submittedAt);
  return eligible.map((app) => {
    const org = store.organizations.find((o) => o.id === app.organizationId)!;
    const variant = app.isShortlisted ? "shortlisted" : "non_shortlisted";
    const report =
      variant === "shortlisted"
        ? store.shortlistedReports.find((r) => r.applicationId === app.id)
        : store.nonShortlistedReports.find((r) => r.applicationId === app.id);
    return { applicationId: app.id, organizationName: org.name, variant, status: report?.status ?? "not_generated" };
  });
}

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);

/** Mock generation — deterministic from real score data, not a live Anthropic call (not wired up yet). Picks the 2 strongest/weakest pillars by contribution for the narrative. */
export async function buildShortlistedReportContent(applicationId: string) {
  const cards = store.pillarScorecards.filter((c) => c.applicationId === applicationId && c.round === "sector");
  const { overall, byPillar } = applicantVerifiedScore(PILLARS, cards);
  const sorted = [...byPillar].sort((a, b) => b.contributionPercent / SCORED_PILLARS.find((p) => p.code === b.pillarCode)!.weightPoints - a.contributionPercent / SCORED_PILLARS.find((p) => p.code === a.pillarCode)!.weightPoints);

  const pillarName = (code: string) => SCORED_PILLARS.find((p) => p.code === code)?.name ?? code;
  const strengths = sorted.slice(0, 2).map((p) => `Strong, well-evidenced practice in ${pillarName(p.pillarCode)}.`);
  const improvements = sorted
    .slice(-2)
    .reverse()
    .map((p) => `${pillarName(p.pillarCode)} is an area with room to strengthen practice and evidence.`);

  return {
    verifiedScore: overall,
    pillarBreakdown: byPillar.map((p) => ({ pillarCode: p.pillarCode, panelPillarScore: p.panelPillarScore, contributionPercent: p.contributionPercent })),
    narrative: `This organisation's Verified Score reflects consistent, evidence-backed practice across most pillars of the Assessment Framework, with particular strength where documentation and interview findings closely matched declared practice.`,
    strengths,
    improvements,
  };
}

export async function buildNonShortlistedReportContent(applicationId: string) {
  const app = store.applications.find((a) => a.id === applicationId)!;
  const org = store.organizations.find((o) => o.id === app.organizationId)!;
  const answers = store.answers.filter((a) => a.applicationId === applicationId);
  const { pillars } = computeStage1Score(PILLARS, org.isUnionised, answers, store.benchmarkBands, org.sectorId);

  const sorted = [...pillars].sort((a, b) => b.scorePercent - a.scorePercent);
  const pillarName = (code: string) => SCORED_PILLARS.find((p) => p.code === code)?.name ?? code;

  const pillarSummary = sorted.map((p) => ({
    pillarCode: p.pillarCode,
    stage1ScorePercent: p.scorePercent,
    strengths: p.scorePercent >= 60 ? [`${pillarName(p.pillarCode)}: self-assessment indicates established practice.`] : [],
    gaps: p.scorePercent < 60 ? [`${pillarName(p.pillarCode)}: self-assessment indicates this is an area to develop before the next cycle.`] : [],
  }));

  return { pillarSummary };
}
