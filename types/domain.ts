/**
 * Domain model for the NECA Employers' Excellence Awards platform, built
 * against NECA's 2026 Edition Assessment Framework & Applicant
 * Questionnaire (source document — treat it as authoritative over this
 * file's comments wherever they might drift).
 *
 * This is the shape every lib/data/*.ts query returns, mapped from the
 * real Supabase schema (see NECA_Supabase_Schema_Reference.md) — kept as
 * the single source of truth for shapes used across portals, independent
 * of the underlying table/column names.
 */

// ===========================================================================
// Sectors — Secretariat-managed. Deliberately NOT hardcoded to real NECA
// sector names anywhere in this codebase (we don't have NECA's real list
// yet) — see lib/mock/store.ts's seed comment for how placeholders are
// handled so the rest of the app still has something to demo against.
// ===========================================================================

/**
 * Real data has a 2-level hierarchy (21 sector_categories -> 183 sectors,
 * see NECA_Supabase_Schema_Reference.md) — categoryId/categoryName are
 * carried on the flat Sector for display/grouping (Section A's dropdown,
 * the Secretariat sectors admin screen) without forcing every other
 * consumer that only ever needed `.id`/`.name` (scoring, shortlisting,
 * panel assignment) to deal with a separate hierarchy type.
 */
export interface Sector {
  id: string;
  name: string;
  order: number;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
}

// ===========================================================================
// Pillars — Sections A–I. A is eligibility/profile only (not scored); B–I
// are the 8 scored pillars, weights per doc section 4.4.
// ===========================================================================

export type PillarCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I";

export interface Pillar {
  code: PillarCode;
  name: string;
  /** Percentage of the overall Verified Score, e.g. 15 for Section B. 0 for A. */
  weightPoints: number;
  scored: boolean;
  order: number;
}

// ===========================================================================
// Response type library (doc section 4.2 / the "Response type legend"
// repeated under every section).
// ===========================================================================

export type ResponseType =
  | "yn_na" // Yes / No / (optionally) Not Applicable — matches the real response_type enum's "yn_na" value exactly
  | "maturity" // 5-point maturity scale, item-specific stage labels
  | "frequency" // Never / Rarely / Sometimes / Often-Usually / Always
  | "numeric"
  | "percentage" // scored against Secretariat-configured benchmark bands
  | "multiselect"
  | "narrative"; // 200-300 words, never auto-scored — Stage 2 only

export type ItemTrack = "mandatory" | "advanced";

export const FREQUENCY_LABELS = ["Never", "Rarely", "Sometimes", "Often/Usually", "Always"] as const;

/** Level 1 = 0%, 2 = 25%, 3 = 50%, 4 = 75%, 5 = 100% of the item's weight — doc section 4.2. */
export const MATURITY_LEVEL_PERCENTS = [0, 25, 50, 75, 100] as const;
export const FREQUENCY_LEVEL_PERCENTS = [0, 25, 50, 75, 100] as const;

/**
 * One assessment item (B1, C1, D3-alt, ...). `id` is the item code used
 * throughout the platform (matches the doc's numbering exactly, including
 * the "-alt" suffix for Section D's non-unionised branch).
 */
export interface AssessmentItem {
  /** Item code (B1, D3-alt, ...) — the natural key used everywhere in this codebase (URLs, branching, scoring). */
  id: string;
  /** Real `items.id` UUID — what application_responses.item_id and friends actually FK to. See lib/mock/framework.ts's header. */
  dbId: string;
  pillarCode: PillarCode;
  order: number;
  prompt: string;
  responseType: ResponseType;
  track: ItemTrack;
  /** The named document this item's evidence trigger requires, or null if it never triggers one (e.g. most PCT/NUM items). */
  evidenceName: string | null;
  /** Only for responseType "maturity" — the 5 stage labels are item-specific text, not a shared scale. */
  maturityLabels?: [string, string, string, string, string];
  /** Only for responseType "multiselect". */
  multiselectOptions?: string[];
  /** Only for responseType "percentage" — key into BenchmarkBand.benchmarkKey. */
  benchmarkKey?: string;
  /**
   * Links branch-equivalent items across Section D's unionised vs
   * non-unionised paths (e.g. "D3" and "D3-alt" share branchGroup "D3") so
   * scoring/weight logic can treat them as the same "slot" — doc's
   * "equivalently weighted" branch table (section 9.2/D2). Not stored in
   * the real schema (which only records branch_scope per item, not the
   * grouping) — derived/hand-set in lib/mock/framework.ts.
   */
  branchGroup?: string;
  /** Matches the real `branch_scope` enum's non-"all" values exactly. */
  branchValue?: "unionised" | "non_unionised";
  /** Whether N/A is offered on this item (doc section 2.1 rule 7 / 4.2) — matches real `items.na_allowed`. */
  allowNA?: boolean;
  /** True only for G2 — matches real `items.triggers_eligibility_review_on_no`. A "No" answer flags the application for Secretariat review. */
  triggersEligibilityReviewOnNo?: boolean;
}

// ===========================================================================
// Benchmark bands — Secretariat-configurable, per sector, per PCT-type
// metric (doc section 4.2: "scored against sector-adjusted benchmark
// bands set annually by the Secretariat").
// ===========================================================================

export interface BenchmarkBandRange {
  /** Inclusive lower bound of this band, in the item's own units (e.g. a %). */
  min: number;
  /** Exclusive upper bound; null means "and above". */
  max: number | null;
  /** % of the item's weight this band earns. */
  scorePercent: number;
}

export interface BenchmarkBand {
  id: string;
  benchmarkKey: string;
  sectorId: string | "all";
  label: string;
  ranges: BenchmarkBandRange[];
}

// ===========================================================================
// Organisation profile & Section A eligibility
// ===========================================================================

export type OrgSizeTier = "micro" | "small" | "medium" | "large" | "very_large";

export const ORG_SIZE_LABELS: Record<OrgSizeTier, string> = {
  micro: "Micro Enterprise (1–9 employees)",
  small: "Small Enterprise (10–49 employees)",
  medium: "Medium Enterprise (50–199 employees)",
  large: "Large Enterprise (200–999 employees)",
  very_large: "Very Large Enterprise (1,000+ employees)",
};

export type YearEstablishedBand = "lt5" | "5to10" | "11to20" | "21to50" | "gt50";

export const YEAR_ESTABLISHED_LABELS: Record<YearEstablishedBand, string> = {
  lt5: "Less than 5 years",
  "5to10": "5–10 years",
  "11to20": "11–20 years",
  "21to50": "21–50 years",
  gt50: "Above 50 years",
};

export type GeographicalCoverage = "single_state" | "multi_state" | "nationwide" | "regional_west_africa" | "international";

export const GEOGRAPHICAL_COVERAGE_LABELS: Record<GeographicalCoverage, string> = {
  single_state: "Single State",
  multi_state: "Multi-State",
  nationwide: "Nationwide",
  regional_west_africa: "Regional (West Africa)",
  international: "International",
};

export type OwnershipStructure =
  | "private"
  | "public"
  | "government"
  | "partnership"
  | "sole_proprietorship"
  | "non_profit"
  | "cooperative";

export const OWNERSHIP_STRUCTURE_LABELS: Record<OwnershipStructure, string> = {
  private: "Private",
  public: "Public",
  government: "Government",
  partnership: "Partnership",
  sole_proprietorship: "Sole Proprietorship",
  non_profit: "Non-profit",
  cooperative: "Cooperative",
};

export interface Organization {
  id: string;
  name: string;
  rcNumber: string;
  yearEstablishedBand: YearEstablishedBand;
  sectorId: string;
  sizeTier: OrgSizeTier;
  /** Raw headcount, alongside (not replacing) sizeTier's category band — I5's youth internship ratio needs the actual number. */
  employeeCount: number | null;
  geographicalCoverage: GeographicalCoverage;
  ownershipStructure: OwnershipStructure;
  localOrMultinational: "local" | "multinational";
  isUnionised: boolean;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  previousParticipation: { participated: boolean; years: string[] };
}

export interface EligibilityDeclarations {
  legallyRegistered: boolean;
  taxCompliant: boolean;
  notUnderSanction: boolean;
  infoAccurate: boolean;
}

export type EligibilityFlagReason = "declaration_unchecked" | "g2_not_compliant";

/**
 * Created when a Section A eligibility declaration is unchecked or G2
 * ("complies with all applicable local laws...") = No. Flags the
 * application for Secretariat review — does NOT block submission or
 * progression (doc: "applicant may still complete and submit, but cannot
 * advance to shortlisting until resolved").
 */
export interface EligibilityReview {
  id: string;
  applicationId: string;
  reasons: EligibilityFlagReason[];
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
  resolvedNote?: string;
}

// ===========================================================================
// Application
// ===========================================================================

/**
 * Matches the real `application_status` enum exactly (see
 * NECA_Supabase_Schema_Reference.md) — RLS depends on these literal values
 * (e.g. the Employer of the Year cross-panel visibility exception checks
 * status IN ('sector_winner','eoy_finalist','eoy_winner') directly), so
 * this can't drift from the enum the way the old mock-only union did.
 *
 * Note there's only one in-progress Stage 2 status (`in_stage2`) covering
 * both the 2a document-verification and 2b interview sub-phases — the
 * schema doesn't store which sub-phase an application is in as a status;
 * lib/data/applications.ts derives that from stage2_document_reviews /
 * interviews completeness instead (see getStage2Phase()).
 */
export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "eligibility_flagged"
  | "ranked"
  | "shortlisted"
  | "not_shortlisted"
  | "in_stage2"
  | "stage2_scored"
  | "sector_finalist"
  | "sector_winner"
  | "eoy_finalist"
  | "eoy_winner";

export interface Application {
  id: string;
  referenceNo: string;
  organizationId: string;
  status: ApplicationStatus;
  eligibilityDeclarations: EligibilityDeclarations;
  /**
   * True whenever `applications.eligibility_review_needed` is set (auto
   * per doc: failed declaration or G2=No) — this does NOT block
   * submission, it's purely an Secretariat review flag. Separate from (and
   * a looser signal than) the 'eligibility_flagged' status value, which
   * the schema also defines but which this app doesn't drive the normal
   * submit flow into — see lib/data/applications.ts's docstring.
   */
  eligibilityFlagged: boolean;
  submittedAt: string | null;
  /**
   * Self-declared provisional score (0-100), used ONLY to rank/shortlist
   * within sector/size category. Never contributes to the Verified Score
   * — doc section 11.1: "never used or averaged into the final jury
   * score."
   */
  stage1Score: number | null;
  /** Computed from status, not a stored column — null until a shortlist decision (ranked or later) exists. */
  isShortlisted: boolean | null;
  /** Computed from status: true for sector_winner, eoy_finalist, eoy_winner (winning EOY implies having won your sector first). */
  isSectorWinner?: boolean;
  /** Computed from status: true for eoy_finalist, eoy_winner. */
  isEmployerOfYearFinalist?: boolean;
  /** Computed from status: true only for eoy_winner. */
  isEmployerOfYear?: boolean;
}

// ===========================================================================
// Assessment answers (Sections B–I)
// ===========================================================================

export type AnswerValue = boolean | number | string | string[] | null;

export interface AssessmentAnswer {
  applicationId: string;
  itemId: string;
  value: AnswerValue;
  isNA: boolean;
  /** Required, ≤50 words, whenever isNA is true (doc section 2.1 rule 7). Stored for Jury review, not scored. */
  naJustification?: string;
}

// ===========================================================================
// Dynamic document checklist (doc section 10) — one RequiredDocument per
// fired evidence trigger, generated from the applicant's own answers.
// ===========================================================================

export type DocumentStatus = "pending" | "uploaded";

export interface RequiredDocument {
  id: string;
  applicationId: string;
  itemId: string;
  pillarCode: PillarCode;
  name: string;
  track: ItemTrack;
  acceptedFileTypes: string[];
  maxSizeMB: number;
  description: string;
  status: DocumentStatus;
  fileName?: string;
  uploadedAt?: string;
}

export type RedFlagReason = "undated" | "unsigned" | "generic_template" | "mismatched_organisation" | "expired";

export const RED_FLAG_LABELS: Record<RedFlagReason, string> = {
  undated: "Undated",
  unsigned: "Unsigned",
  generic_template: "Generic template",
  mismatched_organisation: "Mismatched organisation name",
  expired: "Expired",
};

export interface RedFlag {
  id: string;
  documentId: string;
  jurorId: string;
  reason: RedFlagReason;
  note?: string;
  createdAt: string;
}

/**
 * Stage 2a: a panel juror's credibility check on one uploaded document.
 * Per juror (not shared), same reasoning as the old per-juror
 * DocumentReview model — one juror's call doesn't leak to another before
 * scores are reconciled.
 */
export interface DocumentVerification {
  id: string;
  documentId: string;
  jurorId: string;
  credible: boolean;
  note?: string;
  reviewedAt: string;
}

// ===========================================================================
// Jury panels (doc section 11.5) — fixed at 9 jurors, 3 panels of 3.
// ===========================================================================

export interface Panel {
  id: string;
  name: string;
  /** Exactly 3 juror user IDs. */
  jurorIds: string[];
}

/** Secretariat-assigned cluster of sectors per panel, before Stage 2 opens. */
export interface PanelSectorAssignment {
  panelId: string;
  sectorId: string;
}

export type ConflictResolution = "reassigned_panel" | "excused_from_applicant";

export interface JurorConflict {
  id: string;
  jurorId: string;
  /** Set when resolution is "excused_from_applicant"; null for a full panel/sector reassignment. */
  applicationId: string | null;
  reason: string;
  resolution: ConflictResolution;
  createdAt: string;
}

// ===========================================================================
// Shortlisting (doc section 13 / 11.1) — Secretariat-configurable per
// sector/size category. No hardcoded value: NECA hasn't decided this yet.
// ===========================================================================

export type ShortlistMode = "count" | "percentage";

export interface ShortlistConfig {
  id: string;
  sectorId: string;
  sizeTier: OrgSizeTier | "all";
  /** null = not yet configured by the Secretariat for this category. */
  mode: ShortlistMode | null;
  value: number | null;
}

// ===========================================================================
// Stage 2b — sector interview (doc section 11.3)
// ===========================================================================

/** Matches the real interview_status enum exactly. "No interview row exists yet" (not a stored value) is this codebase's "not requested" state. */
export type InterviewStatus = "requested" | "scheduled" | "completed" | "no_show" | "cancelled";

export interface InterviewSession {
  id: string;
  applicationId: string;
  panelId: string;
  /** >= 2 juror IDs; must include at least one juror who did NOT do this applicant's Stage 2a document review. */
  assignedJurorIds: string[];
  scheduledAt: string | null;
  format: "virtual" | "physical";
  status: InterviewStatus;
  /** Per-pillar consistency-check finding — juror's note on whether the applicant could describe a declared Mandatory practice unprompted. */
  consistencyNotes: Partial<Record<PillarCode, string>>;
  /** Per-pillar probe question actually asked, editable, defaults from the doc's sample bank. */
  probeQuestions: Partial<Record<PillarCode, string>>;
  requestedAt: string;
  requestedByJurorId: string;
  initialEmailSentAt: string | null;
  lastBookingReminderAt: string | null;
  lastAttendanceReminderAt: string | null;
}

/**
 * A document requested live during the interview, not part of the
 * original checklist. That item's score isn't finalized until it arrives
 * or the deadline lapses — a "pending" state that blocks only this item,
 * not the whole application (doc section 11.3).
 */
export interface LiveEvidenceRequest {
  id: string;
  interviewSessionId: string;
  applicationId: string;
  description: string;
  requestedAt: string;
  deadline: string;
  receivedAt: string | null;
}

export interface InterviewAvailabilitySlot {
  id: string;
  jurorId: string;
  date: string;
  startTime: string;
  endTime: string;
  booked: boolean;
  bookedByApplicationId?: string | null;
}

// ===========================================================================
// Jury pillar scorecard (doc section 11.2/11.4) — the real scoring
// formula. One row per pillar per juror per applicant (NOT per item —
// the 4 dimensions are judged holistically per pillar after reviewing all
// of that pillar's item-level evidence in Stage 2a/2b).
// ===========================================================================

export type ScorecardRound = "sector" | "employer_of_year";

export interface PillarScorecard {
  id: string;
  applicationId: string;
  jurorId: string;
  pillarCode: PillarCode;
  round: ScorecardRound;
  policyExists: number | null; // 0-5
  implementation: number | null; // 0-5
  evidenceQuality: number | null; // 0-5
  measurableImpact: number | null; // 0-5
  interviewFinding?: string;
  submittedAt: string | null;
}

export const PILLAR_SCORE_WEIGHTS = {
  policyExists: 0.25,
  implementation: 0.3,
  evidenceQuality: 0.25,
  measurableImpact: 0.2,
} as const;

export interface ScoreAdjustmentAuditEntry {
  id: string;
  applicationId: string;
  itemId: string;
  jurorId: string;
  /** Serialized original Stage 1 answer/score, for the reconstructable audit trail (doc section 12). */
  stage1Value: string;
  note: string;
  timestamp: string;
}

// ===========================================================================
// Employer of the Year (doc section 11.6)
// ===========================================================================

export interface EmployerOfYearResult {
  applicationId: string;
  overallVerifiedScore: number;
  /** The 9 jurors' individual Verified Scores for this finalist, for showing the spread. */
  individualScores: number[];
  rank: number;
}

export interface EmployerOfYearValidation {
  validated: boolean;
  validatedByUserId: string | null;
  validatedAt: string | null;
  winnerApplicationId: string | null;
}

// ===========================================================================
// Reports (doc section 12) — two genuinely different variants.
// ===========================================================================

export type ReportStatus = "pending_approval" | "approved" | "sent_back";

export interface PillarContribution {
  pillarCode: PillarCode;
  panelPillarScore: number; // 0-5
  contributionPercent: number; // 0-weightPoints
}

/** Shortlisted applicants only — built from their Stage 2 Verified Score. */
export interface ShortlistedReport {
  id: string;
  applicationId: string;
  status: ReportStatus;
  verifiedScore: number;
  pillarBreakdown: PillarContribution[];
  narrative: string;
  strengths: string[];
  improvements: string[];
  createdAt: string;
  releasedAt: string | null;
}

export interface PillarStage1Summary {
  pillarCode: PillarCode;
  stage1ScorePercent: number;
  strengths: string[];
  gaps: string[];
}

/** Non-shortlisted applicants only — built from Stage 1 answers only; they never reach Stage 2. */
export interface NonShortlistedReport {
  id: string;
  applicationId: string;
  status: ReportStatus;
  pillarSummary: PillarStage1Summary[];
  createdAt: string;
  releasedAt: string | null;
}

// ===========================================================================
// Platform users, audit log, settings
// ===========================================================================

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  target: string;
};

export type PlatformUserStatus = "active" | "invited";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: "applicant" | "secretariat" | "jury";
  status: PlatformUserStatus;
  /** Secretariat-only: gates access to platform-wide configuration screens. */
  isSuperAdmin?: boolean;
}

/** Computed, never stored: jury score summary honoring the "N of 3 panel jurors scored" rule for a given pillar/round. */
export interface ScoreSummary {
  jurorsAssigned: number;
  jurorsScored: number;
  isComplete: boolean;
  averageScore: number | null;
}
