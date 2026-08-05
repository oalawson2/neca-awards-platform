/**
 * Domain model for the NECA Excellence Awards platform.
 *
 * This is the shape mock data currently returns (see lib/mock/data.ts) and
 * what the real Supabase-backed queries will eventually return once the
 * schema exists. Keep this file the single source of truth for shapes used
 * across portals.
 */

export type ApplicationStatus =
  | "draft"
  | "awaiting_review"
  | "incomplete"
  | "scoring"
  | "scored"
  | "released";

export interface Sector {
  id: string;
  name: string;
}

/** Universal judging criteria — identical for every sector. */
export interface Criterion {
  id: string;
  name: string;
  weightPoints: number;
  order: number;
}

export interface Organization {
  id: string;
  name: string;
  rcNumber: string;
  yearFounded: number;
  address: string;
  sectorId: string;
  employeeHeadcount: string;
  primaryContactName: string;
  primaryContactEmail: string;
}

export type QuestionType = "text" | "textarea" | "number" | "boolean";

export interface QuestionnaireQuestion {
  id: string;
  prompt: string;
  type: QuestionType;
}

/** One questionnaire section maps 1:1 to a scoring criterion. */
export interface QuestionnaireSection {
  id: string;
  criterionId: string;
  title: string;
  questions: QuestionnaireQuestion[];
}

export interface QuestionnaireAnswer {
  questionId: string;
  value: string;
}

export type DocumentStatus = "uploaded" | "missing";

export interface RequiredDocument {
  id: string;
  applicationId: string;
  name: string;
  requiredBecause: string;
  status: DocumentStatus;
  fileName?: string;
}

export type DocumentReviewStatus = "certified" | "rejected";

/**
 * A single juror's compliance review of a single document. Scoped per
 * juror (not shared) so it lines up with blind scoring — one juror's
 * compliance call on a document doesn't leak to another juror, and each
 * juror's own certification bonus only reflects documents *they*
 * personally certified.
 */
export interface DocumentReview {
  documentId: string;
  jurorId: string;
  status: DocumentReviewStatus;
  reviewedAt: string;
  note?: string;
}

export interface Application {
  id: string;
  referenceNo: string;
  organizationId: string;
  sectorId: string;
  status: ApplicationStatus;
  submittedAt: string | null;
  /** Secretariat completeness score. Gates advancement to jury only — zero weight in final score. */
  preliminaryScore: number | null;
  totalSections: number;
  sectionsCompleted: number;
  isSectorWinner?: boolean;
  isEmployerOfYearShortlist?: boolean;
  isEmployerOfYear?: boolean;
}

/** Many-to-many: a juror can be assigned to several sectors, and vice versa. */
export interface JurorAssignment {
  jurorId: string;
  sectorId: string;
}

export interface ScoredItem {
  id: string;
  prompt: string;
  value: number | null;
  maxValue: number;
  note?: string;
}

export interface CriterionScore {
  criterionId: string;
  items: ScoredItem[];
}

export type ScorecardStatus = "not_started" | "in_progress" | "submitted";

/** One juror's private scorecard for one application. Never visible to other jurors. */
export interface JurorScorecard {
  applicationId: string;
  jurorId: string;
  status: ScorecardStatus;
  criteriaScores: CriterionScore[];
  /** Sum of all item values once submitted; null until then. */
  totalScore: number | null;
  submittedAt: string | null;
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

/**
 * Created when an assigned juror finishes document review for one
 * applicant and requests an interview. This — not any general
 * application-status change — is what unlocks booking for the applicant.
 * The *Sent timestamps are mock placeholders for real email sends (no
 * email provider is wired up yet); see lib/actions/interviews.ts.
 */
export interface InterviewRequest {
  id: string;
  applicationId: string;
  requestedByJurorId: string;
  requestedAt: string;
  initialEmailSentAt: string | null;
  lastBookingReminderAt: string | null;
  lastAttendanceReminderAt: string | null;
}

export type AIReportStatus = "pending_approval" | "approved" | "sent_back";

/**
 * Drafted applicant-facing report. Must go through Secretariat approval
 * before release, and never carries an "AI-generated" label anywhere an
 * applicant can see it.
 */
export interface AIReport {
  id: string;
  applicationId: string;
  status: AIReportStatus;
  narrative: string;
  strengths: string[];
  improvements: string[];
  createdAt: string;
  releasedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  target: string;
}

export type PlatformUserStatus = "active" | "invited";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: "applicant" | "secretariat" | "jury";
  status: PlatformUserStatus;
  sectorIds?: string[];
  /** Secretariat-only: gates access to the advancement-threshold setting. */
  isSuperAdmin?: boolean;
}

export interface PlatformSettings {
  advancementThresholdScore: number;
}

/** Computed, never stored: jury score summary honoring the "N of M assigned jurors scored" rule. */
export interface ScoreSummary {
  jurorsAssigned: number;
  jurorsScored: number;
  isComplete: boolean;
  averageScore: number | null;
}
