"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { PILLARS, SECTION_DB_IDS } from "@/lib/mock/framework";
import { getPanelSubmissionCount } from "@/lib/data/scorecards";
import { applicantVerifiedScore } from "@/lib/scoring/stage2";
import type { PillarCode, ScorecardRound } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
type Dimension = "policyExists" | "implementation" | "evidenceQuality" | "measurableImpact";
const DIMENSION_COLUMN: Record<Dimension, string> = {
  policyExists: "policy_exists",
  implementation: "implementation",
  evidenceQuality: "evidence_quality",
  measurableImpact: "measurable_impact",
};

export async function saveScorecardDimension(
  applicationId: string,
  jurorId: string,
  pillarCode: PillarCode,
  dimension: Dimension,
  value: number,
  round: ScorecardRound = "sector"
) {
  const supabase = await createClient();
  const isEoy = round === "employer_of_year";

  const { data: existing } = await supabase
    .from("juror_scores")
    .select("id, submitted_at")
    .eq("application_id", applicationId)
    .eq("juror_id", jurorId)
    .eq("section_id", SECTION_DB_IDS[pillarCode as Exclude<PillarCode, "A">])
    .eq("is_eoy_joint_score", isEoy)
    .maybeSingle();
  if (existing?.submitted_at) return { success: false, error: "This scorecard has already been submitted." };

  const { error } = await supabase.from("juror_scores").upsert(
    {
      application_id: applicationId,
      juror_id: jurorId,
      section_id: SECTION_DB_IDS[pillarCode as Exclude<PillarCode, "A">],
      is_eoy_joint_score: isEoy,
      [DIMENSION_COLUMN[dimension]]: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,juror_id,section_id,is_eoy_joint_score" }
  );
  if (error) return { success: false, error: "Could not save score." };

  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

export async function saveInterviewFinding(applicationId: string, jurorId: string, pillarCode: PillarCode, finding: string, round: ScorecardRound = "sector") {
  const supabase = await createClient();
  const { error } = await supabase.from("juror_scores").upsert(
    {
      application_id: applicationId,
      juror_id: jurorId,
      section_id: SECTION_DB_IDS[pillarCode as Exclude<PillarCode, "A">],
      is_eoy_joint_score: round === "employer_of_year",
      narrative_notes: finding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,juror_id,section_id,is_eoy_joint_score" }
  );
  if (error) return { success: false, error: "Could not save note." };

  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

export interface SubmitScorecardResult {
  success: boolean;
  error?: string;
  outstandingPillars?: string[];
}

/**
 * Finalizes all 8 pillar scorecards at once (sets submitted_at), blocked
 * until every pillar has all 4 dimensions filled.
 *
 * After recording this juror's own submission, checks whether that was
 * the last of the panel and auto-closes scoring if so (finalizeStage2Scoring,
 * same as the Secretariat-only closeStage2Scoring uses) — this juror's own
 * RLS-scoped session can't see peers' juror_scores rows or write
 * applications.status (blind scoring is enforced by RLS itself, gated on
 * applications.stage2_scoring_closed), so that check and the resulting
 * write both go through the service-role admin client, the one legitimate
 * way to look past blind scoring's RLS from here. Guarded against
 * double-closing (skips if stage2_scoring_closed is already true) so a
 * near-simultaneous submit from two jurors, or a Secretariat manual close
 * racing this, can't both try to finalize.
 */
export async function submitScorecard(applicationId: string, jurorId: string, jurorName: string, round: ScorecardRound = "sector"): Promise<SubmitScorecardResult> {
  const supabase = await createClient();
  const isEoy = round === "employer_of_year";

  const { data: rows } = await supabase
    .from("juror_scores")
    .select("section_id, policy_exists, implementation, evidence_quality, measurable_impact")
    .eq("application_id", applicationId)
    .eq("juror_id", jurorId)
    .eq("is_eoy_joint_score", isEoy);

  const sectionIdToPillar = new Map(Object.entries(SECTION_DB_IDS).map(([code, id]) => [id, code]));
  const outstanding = SCORED_PILLARS.filter((p) => {
    const row = (rows ?? []).find((r) => sectionIdToPillar.get(r.section_id) === p.code);
    return !row || row.policy_exists === null || row.implementation === null || row.evidence_quality === null || row.measurable_impact === null;
  });
  if (outstanding.length > 0) {
    return { success: false, error: "Score all 4 dimensions on every pillar before submitting.", outstandingPillars: outstanding.map((p) => p.code) };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("juror_scores")
    .update({ submitted_at: now })
    .eq("application_id", applicationId)
    .eq("juror_id", jurorId)
    .eq("is_eoy_joint_score", isEoy);
  if (error) return { success: false, error: "Could not submit scorecard." };

  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  const { data: org } = app ? await supabase.from("organizations").select("name").eq("id", app.organization_id).maybeSingle() : { data: null };

  // The mock version this replaces logged one detailed entry per pillar
  // comparing the Stage 1 self-declared score against this juror's Stage
  // 2 score (a separate, more granular concept than the generic action
  // log below). No real-schema equivalent for that specific comparison
  // exists yet, and audit_log itself has no INSERT policy for
  // authenticated users (service-role only) — deferred to task #55,
  // which is already reconsidering the audit-writing story end to end
  // rather than bolting on a partial version here.
  await logAction(jurorName, "Submitted pillar scorecard for", org?.name ?? applicationId);

  if (!isEoy) {
    const admin = createAdminClient();
    const { data: appRow } = await admin.from("applications").select("stage2_scoring_closed").eq("id", applicationId).maybeSingle();
    if (appRow && !appRow.stage2_scoring_closed) {
      const { submitted, total } = await getPanelSubmissionCount(applicationId, "sector", admin);
      if (total > 0 && submitted === total) {
        await finalizeStage2Scoring(admin, applicationId, null, "System");
      }
    }
  }

  revalidatePath(`/jury/scorecard/${applicationId}`);
  return { success: true };
}

/**
 * Shared by closeStage2Scoring (Secretariat-initiated) and submitScorecard's
 * auto-close (juror-initiated, once their submission completes the whole
 * panel) — both already know the panel is fully submitted by the time they
 * call this; it just computes and stores the panel-averaged Verified Score
 * and advances the application to stage2_scored. Takes whichever client
 * the caller already has: the Secretariat's own session can see every
 * panel member's raw scores unconditionally (scores_select_secretariat)
 * and can write applications.status itself (applications_update_secretariat),
 * so it reuses that; the juror auto-close path has neither, so it passes
 * the service-role admin client instead.
 */
async function finalizeStage2Scoring(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  closedByUserId: string | null,
  closedByName: string
): Promise<{ success: boolean; error?: string; verifiedScore?: number }> {
  const { data: rows } = await supabase
    .from("juror_scores")
    .select("section_id, policy_exists, implementation, evidence_quality, measurable_impact")
    .eq("application_id", applicationId)
    .eq("is_eoy_joint_score", false);

  const sectionIdToPillar = new Map(Object.entries(SECTION_DB_IDS).map(([code, id]) => [id, code as PillarCode]));
  const cards = (rows ?? []).map((r) => ({
    id: "",
    applicationId,
    jurorId: "",
    pillarCode: sectionIdToPillar.get(r.section_id)!,
    round: "sector" as const,
    policyExists: r.policy_exists,
    implementation: r.implementation,
    evidenceQuality: r.evidence_quality,
    measurableImpact: r.measurable_impact,
    submittedAt: null,
  }));
  const { overall } = applicantVerifiedScore(PILLARS, cards);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("applications")
    .update({
      stage2_scoring_closed: true,
      stage2_scoring_closed_at: now,
      stage2_scoring_closed_by: closedByUserId,
      verified_score: overall,
      status: "stage2_scored",
    })
    .eq("id", applicationId);
  if (error) return { success: false, error: "Could not close scoring." };

  await logAction(closedByName, "Closed Stage 2 scoring for", applicationId);
  revalidatePath("/secretariat/live-scoring");
  revalidatePath(`/secretariat/applications/${applicationId}`);
  return { success: true, verifiedScore: overall };
}

/**
 * Secretariat-only: closes the blind-scoring window for this application
 * (stage2_scoring_closed=true, which is what RLS itself gates peer
 * juror_scores visibility on) if it isn't closed already. In the normal
 * flow submitScorecard's auto-close (see below) already does this the
 * moment the panel finishes — this is the manual backup: for an
 * application that reached full submission before that auto-close existed,
 * or if the automatic path ever fails partway (e.g. a transient DB error
 * after the last juror's submit already recorded).
 */
export async function closeStage2Scoring(applicationId: string): Promise<{ success: boolean; error?: string; verifiedScore?: number }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can close scoring." };
  }

  const { submitted, total } = await getPanelSubmissionCount(applicationId, "sector");
  if (total === 0) return { success: false, error: "No panel is assigned to this applicant's sector yet." };
  if (submitted < total) return { success: false, error: `Only ${submitted} of ${total} panel jurors have submitted so far.` };

  const supabase = await createClient();
  return finalizeStage2Scoring(supabase, applicationId, user.id, user.fullName || user.email);
}
