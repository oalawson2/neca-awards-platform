import type {
  Application,
  AssessmentAnswer,
  AuditLogEntry,
  BenchmarkBand,
  DocumentVerification,
  EligibilityReview,
  EmployerOfYearValidation,
  InterviewAvailabilitySlot,
  InterviewSession,
  JurorConflict,
  LiveEvidenceRequest,
  NonShortlistedReport,
  Organization,
  Panel,
  PanelSectorAssignment,
  PillarScorecard,
  PlatformUser,
  RedFlag,
  RequiredDocument,
  ScoreAdjustmentAuditEntry,
  Sector,
  ShortlistConfig,
  ShortlistedReport,
} from "@/types/domain";
import { ASSESSMENT_ITEMS, PILLARS, evidenceDefaultsFor } from "@/lib/mock/framework";
import { effectiveItemsForOrg, evidenceTriggerFired, computeStage1Score } from "@/lib/scoring/stage1";

/**
 * In-memory mock "database" standing in for Supabase until the real schema
 * exists (being built in parallel — see README). Lives as a module-level
 * singleton on `globalThis` so it survives Next.js dev Fast Refresh and
 * stays consistent across the standalone build's separately-traced route
 * bundles. Server Actions in lib/actions/* mutate this directly; read
 * functions in lib/data/* read from it. Nothing outside lib/mock/
 * lib/data/lib/actions should import this file directly.
 */

export interface MockCredential {
  userId: string;
  email: string;
  /** Mock-phase only: any non-empty password is accepted for a known email. */
  password: string;
}

interface Store {
  sectors: Sector[];
  benchmarkBands: BenchmarkBand[];
  organizations: Organization[];
  applications: Application[];
  answers: AssessmentAnswer[];
  documents: RequiredDocument[];
  redFlags: RedFlag[];
  documentVerifications: DocumentVerification[];
  eligibilityReviews: EligibilityReview[];
  panels: Panel[];
  panelSectorAssignments: PanelSectorAssignment[];
  jurorConflicts: JurorConflict[];
  shortlistConfigs: ShortlistConfig[];
  interviewSessions: InterviewSession[];
  availability: InterviewAvailabilitySlot[];
  liveEvidenceRequests: LiveEvidenceRequest[];
  pillarScorecards: PillarScorecard[];
  scoreAdjustments: ScoreAdjustmentAuditEntry[];
  shortlistedReports: ShortlistedReport[];
  nonShortlistedReports: NonShortlistedReport[];
  employerOfYear: EmployerOfYearValidation;
  auditLog: AuditLogEntry[];
  users: PlatformUser[];
  credentials: MockCredential[];
}

function nowIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

/**
 * The real 21-category/183-sector taxonomy is already seeded in the live
 * Supabase database (sector_categories + sectors tables), but this
 * sandbox's network egress is blocked from reaching that project (proxy
 * denies the host outright), so those real names can't be pulled in
 * here — and they're deliberately not fabricated. These three
 * placeholder names are synthetic on purpose — never mistake them for
 * real NECA sectors — and exist only so the rest of the mock data
 * (applications, panel assignments, shortlist config) has something to
 * attach to while the app still runs in mock mode. Once Section 14's
 * real Supabase integration is live, sector reads come straight from the
 * database and this seed becomes irrelevant for that purpose.
 */
const SECTORS: Sector[] = [
  { id: "sector-placeholder-a", name: "Placeholder Sector A", order: 1 },
  { id: "sector-placeholder-b", name: "Placeholder Sector B", order: 2 },
  { id: "sector-placeholder-c", name: "Placeholder Sector C", order: 3 },
];

/** Deterministic pseudo-random in [0,1) — stable seed data, no Math.random(). */
function seededRatio(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return (hash % 1000) / 1000;
}

function band(benchmarkKey: string, label: string, ranges: BenchmarkBand["ranges"]): BenchmarkBand {
  return { id: `bb-${benchmarkKey}`, benchmarkKey, sectorId: "all", label, ranges };
}

/** Secretariat-configurable, seeded here with placeholder defaults pending NECA's real bands (doc section 4.2). */
const BENCHMARK_BANDS: BenchmarkBand[] = [
  band("board-gender-diversity", "Board gender diversity (%)", [
    { min: 0, max: 10, scorePercent: 25 },
    { min: 10, max: 30, scorePercent: 50 },
    { min: 30, max: 50, scorePercent: 75 },
    { min: 50, max: null, scorePercent: 100 },
  ]),
  band("employee-engagement-score", "Employee engagement score / participation rate (%)", [
    { min: 0, max: 40, scorePercent: 0 },
    { min: 40, max: 60, scorePercent: 50 },
    { min: 60, max: 80, scorePercent: 75 },
    { min: 80, max: null, scorePercent: 100 },
  ]),
  band("staff-turnover", "Staff turnover rate (%) — lower is better", [
    { min: 0, max: 5, scorePercent: 100 },
    { min: 5, max: 10, scorePercent: 75 },
    { min: 10, max: 20, scorePercent: 50 },
    { min: 20, max: null, scorePercent: 0 },
  ]),
  band("internal-promotion-rate", "Internal promotion rate (%)", [
    { min: 0, max: 10, scorePercent: 25 },
    { min: 10, max: 30, scorePercent: 50 },
    { min: 30, max: 50, scorePercent: 75 },
    { min: 50, max: null, scorePercent: 100 },
  ]),
  band("tech-investment", "Technology investment (% of operating budget)", [
    { min: 0, max: 2, scorePercent: 25 },
    { min: 2, max: 5, scorePercent: 50 },
    { min: 5, max: 10, scorePercent: 75 },
    { min: 10, max: null, scorePercent: 100 },
  ]),
  band("female-workforce-share", "Female employees (% of workforce)", [
    { min: 0, max: 20, scorePercent: 25 },
    { min: 20, max: 35, scorePercent: 50 },
    { min: 35, max: 50, scorePercent: 75 },
    { min: 50, max: null, scorePercent: 100 },
  ]),
  band("female-management-share", "Female employees in management (%)", [
    { min: 0, max: 15, scorePercent: 25 },
    { min: 15, max: 30, scorePercent: 50 },
    { min: 30, max: 45, scorePercent: 75 },
    { min: 45, max: null, scorePercent: 100 },
  ]),
  band("training-hours", "Average training hours per employee", [
    { min: 0, max: 8, scorePercent: 25 },
    { min: 8, max: 20, scorePercent: 50 },
    { min: 20, max: 40, scorePercent: 75 },
    { min: 40, max: null, scorePercent: 100 },
  ]),
];

// Give C12 (training hours) a benchmark key so it's auto-scored — see
// lib/scoring/stage1.ts's file-header assumption 3 for why NUM items
// otherwise aren't.
const itemOverrides: Record<string, string> = { C12: "training-hours" };
for (const item of ASSESSMENT_ITEMS) {
  const key = itemOverrides[item.id];
  if (key) item.benchmarkKey = key;
}

const PANELS: Panel[] = [
  { id: "panel-1", name: "Panel 1", jurorIds: ["juror-p1-a", "juror-p1-b", "juror-p1-c"] },
  { id: "panel-2", name: "Panel 2", jurorIds: ["juror-p2-a", "juror-p2-b", "juror-p2-c"] },
  { id: "panel-3", name: "Panel 3", jurorIds: ["juror-p3-a", "juror-p3-b", "juror-p3-c"] },
];

const PANEL_SECTOR_ASSIGNMENTS: PanelSectorAssignment[] = [
  { panelId: "panel-1", sectorId: "sector-placeholder-a" },
  { panelId: "panel-2", sectorId: "sector-placeholder-b" },
  { panelId: "panel-3", sectorId: "sector-placeholder-c" },
];

const SHORTLIST_CONFIGS: ShortlistConfig[] = SECTORS.map((s) => ({
  id: `shortlist-${s.id}`,
  sectorId: s.id,
  sizeTier: "all",
  mode: null,
  value: null,
}));

function generateAnswerValue(item: (typeof ASSESSMENT_ITEMS)[number], orgId: string, bias: number) {
  const r = seededRatio(`${orgId}:${item.id}`);
  const effectiveR = Math.min(0.98, r * (1 - bias) + bias * 0.9);
  switch (item.responseType) {
    case "yn_na":
      return effectiveR > 0.25;
    case "maturity":
      return Math.max(1, Math.min(5, Math.round(1 + effectiveR * 4)));
    case "frequency":
      return Math.max(0, Math.min(4, Math.round(effectiveR * 4)));
    case "numeric":
      if (item.id === "C12") return Math.round(effectiveR * 40);
      if (item.id === "D7") return effectiveR > 0.85 ? 1 : 0;
      if (item.id === "I5") return Math.round(effectiveR * 15);
      return 0;
    case "percentage":
      if (item.id === "C19") return Math.round((1 - effectiveR) * 30);
      return Math.round(effectiveR * 60);
    case "multiselect": {
      const options = item.multiselectOptions ?? [];
      const n = Math.max(1, Math.round(1 + effectiveR * (options.length - 2)));
      return options.slice(0, n);
    }
    case "narrative":
      return effectiveR > 0.3 ? "Narrative response describing the practice, how it runs day to day, and its measurable outcome for employees." : null;
    default:
      return null;
  }
}

function generateAnswersForOrg(orgId: string, isUnionised: boolean, bias: number): AssessmentAnswer[] {
  return effectiveItemsForOrg(isUnionised).map((item) => {
    const naRoll = seededRatio(`${orgId}:${item.id}:na`);
    const isNA = !!item.allowNA && item.track === "advanced" && naRoll > 0.93;
    if (isNA) {
      return {
        applicationId: "",
        itemId: item.id,
        value: null,
        isNA: true,
        naJustification: "Not applicable given our organisation's current size and structure.",
      };
    }
    return { applicationId: "", itemId: item.id, value: generateAnswerValue(item, orgId, bias), isNA: false };
  });
}

function documentsFromAnswers(applicationId: string, answers: AssessmentAnswer[], uploadBias: number): RequiredDocument[] {
  const docs: RequiredDocument[] = [];
  for (const answer of answers) {
    const item = ASSESSMENT_ITEMS.find((i) => i.id === answer.itemId);
    if (!item || !evidenceTriggerFired(item, answer)) continue;
    const defaults = evidenceDefaultsFor(item.evidenceName!);
    const uploadRoll = seededRatio(`${applicationId}:${item.id}:upload`);
    const uploaded = item.track === "mandatory" ? uploadRoll < uploadBias || uploadBias >= 0.99 : uploadRoll < uploadBias * 0.7;
    docs.push({
      id: `doc-${applicationId}-${item.id}`,
      applicationId,
      itemId: item.id,
      pillarCode: item.pillarCode,
      name: item.evidenceName!,
      track: item.track,
      acceptedFileTypes: defaults.acceptedFileTypes,
      maxSizeMB: defaults.maxSizeMB,
      description: defaults.description,
      status: uploaded ? "uploaded" : "pending",
      fileName: uploaded ? `${item.evidenceName}.pdf` : undefined,
      uploadedAt: uploaded ? nowIso(-5) : undefined,
    });
  }
  return docs;
}

function seed(): Store {
  const organizations: Organization[] = [
    {
      id: "org-alpha",
      name: "Alpha Manufacturing Ltd",
      rcNumber: "RC 1122334",
      yearEstablishedBand: "21to50",
      sectorId: "sector-placeholder-a",
      sizeTier: "large",
      geographicalCoverage: "nationwide",
      ownershipStructure: "private",
      localOrMultinational: "local",
      isUnionised: true,
      primaryContactName: "Ngozi Eze",
      primaryContactEmail: "ngozi.eze@alpha-example.com",
      primaryContactPhone: "+234 802 000 0001",
      previousParticipation: { participated: true, years: ["2024"] },
    },
    {
      id: "org-beta",
      name: "Beta Financial Services Ltd",
      rcNumber: "RC 2233445",
      yearEstablishedBand: "11to20",
      sectorId: "sector-placeholder-b",
      sizeTier: "medium",
      geographicalCoverage: "multi_state",
      ownershipStructure: "private",
      localOrMultinational: "local",
      isUnionised: false,
      primaryContactName: "Bola Fashina",
      primaryContactEmail: "bola.fashina@beta-example.com",
      primaryContactPhone: "+234 802 000 0002",
      previousParticipation: { participated: false, years: [] },
    },
    {
      id: "org-gamma",
      name: "Gamma Logistics Group",
      rcNumber: "RC 3344556",
      yearEstablishedBand: "5to10",
      sectorId: "sector-placeholder-c",
      sizeTier: "small",
      geographicalCoverage: "single_state",
      ownershipStructure: "partnership",
      localOrMultinational: "local",
      isUnionised: true,
      primaryContactName: "Chinedu Obi",
      primaryContactEmail: "chinedu.obi@gamma-example.com",
      primaryContactPhone: "+234 802 000 0003",
      previousParticipation: { participated: false, years: [] },
    },
    {
      id: "org-delta",
      name: "Delta Tech Solutions",
      rcNumber: "RC 4455667",
      yearEstablishedBand: "lt5",
      sectorId: "sector-placeholder-b",
      sizeTier: "micro",
      geographicalCoverage: "single_state",
      ownershipStructure: "sole_proprietorship",
      localOrMultinational: "local",
      isUnionised: false,
      primaryContactName: "Amaka Nwosu",
      primaryContactEmail: "amaka.nwosu@delta-example.com",
      primaryContactPhone: "+234 802 000 0004",
      previousParticipation: { participated: false, years: [] },
    },
  ];

  // bias: 0-1, roughly "how strong a performer" — drives the deterministic answer generator.
  const answerConfig: { orgId: string; isUnionised: boolean; bias: number; uploadBias: number }[] = [
    { orgId: "org-alpha", isUnionised: true, bias: 0.82, uploadBias: 0.95 },
    { orgId: "org-beta", isUnionised: false, bias: 0.65, uploadBias: 0.9 },
    { orgId: "org-gamma", isUnionised: true, bias: 0.5, uploadBias: 0.85 },
    { orgId: "org-delta", isUnionised: false, bias: 0.35, uploadBias: 0.5 },
  ];

  const applicationIdForOrg: Record<string, string> = {
    "org-alpha": "app-alpha",
    "org-beta": "app-beta",
    "org-gamma": "app-gamma",
    "org-delta": "app-delta",
  };

  const answers: AssessmentAnswer[] = [];
  const documents: RequiredDocument[] = [];
  for (const cfg of answerConfig) {
    const applicationId = applicationIdForOrg[cfg.orgId];
    const orgAnswers = generateAnswersForOrg(cfg.orgId, cfg.isUnionised, cfg.bias).map((a) => ({ ...a, applicationId }));
    answers.push(...orgAnswers);
    documents.push(...documentsFromAnswers(applicationId, orgAnswers, cfg.uploadBias));
  }

  const applications: Application[] = [
    {
      id: "app-alpha",
      referenceNo: "EEA-2026-000101",
      organizationId: "org-alpha",
      status: "stage2_scored",
      eligibilityDeclarations: { legallyRegistered: true, taxCompliant: true, notUnderSanction: true, infoAccurate: true },
      eligibilityFlagged: false,
      submittedAt: nowIso(-20),
      stage1Score: null, // filled in below once computed
      isShortlisted: true,
      isSectorWinner: true,
      isEmployerOfYearFinalist: true,
    },
    {
      id: "app-beta",
      referenceNo: "EEA-2026-000102",
      organizationId: "org-beta",
      status: "in_stage2",
      eligibilityDeclarations: { legallyRegistered: true, taxCompliant: true, notUnderSanction: true, infoAccurate: true },
      eligibilityFlagged: false,
      submittedAt: nowIso(-15),
      stage1Score: null,
      isShortlisted: true,
    },
    {
      id: "app-gamma",
      referenceNo: "EEA-2026-000103",
      organizationId: "org-gamma",
      status: "submitted",
      eligibilityDeclarations: { legallyRegistered: true, taxCompliant: false, notUnderSanction: true, infoAccurate: true },
      eligibilityFlagged: true,
      submittedAt: nowIso(-4),
      stage1Score: null,
      isShortlisted: null,
    },
    {
      id: "app-delta",
      referenceNo: "EEA-2026-000104",
      organizationId: "org-delta",
      status: "draft",
      eligibilityDeclarations: { legallyRegistered: true, taxCompliant: true, notUnderSanction: true, infoAccurate: true },
      eligibilityFlagged: false,
      submittedAt: null,
      stage1Score: null,
      isShortlisted: null,
    },
  ];

  // Compute and fill each submitted+ application's Stage 1 score from its seeded answers.
  for (const app of applications) {
    if (!app.submittedAt) continue;
    const org = organizations.find((o) => o.id === app.organizationId)!;
    const appAnswers = answers.filter((a) => a.applicationId === app.id);
    const result = computeStage1Score(PILLARS, org.isUnionised, appAnswers, BENCHMARK_BANDS, org.sectorId);
    app.stage1Score = result.overallScore;
  }

  const eligibilityReviews: EligibilityReview[] = [
    {
      id: "elig-1",
      applicationId: "app-gamma",
      reasons: ["g2_not_compliant"],
      status: "open",
      createdAt: nowIso(-4),
      resolvedAt: null,
    },
  ];

  // --- Stage 2a document verification demo (app-alpha, app-beta) ---
  const documentVerifications: DocumentVerification[] = [];
  const redFlags: RedFlag[] = [];
  for (const applicationId of ["app-alpha", "app-beta"]) {
    const jurorId = applicationId === "app-alpha" ? "juror-p1-a" : "juror-p2-a";
    const uploadedDocs = documents.filter((d) => d.applicationId === applicationId && d.status === "uploaded");
    uploadedDocs.forEach((doc, idx) => {
      const credible = idx !== 1; // seed exactly one non-credible/red-flagged doc per app for a realistic demo
      documentVerifications.push({
        id: `docverify-${doc.id}`,
        documentId: doc.id,
        jurorId,
        credible,
        reviewedAt: nowIso(-8),
      });
      if (!credible) {
        redFlags.push({
          id: `redflag-${doc.id}`,
          documentId: doc.id,
          jurorId,
          reason: "undated",
          note: "Document has no visible date — cannot confirm currency.",
          createdAt: nowIso(-8),
        });
      }
    });
  }

  // --- Stage 2b interview sessions ---
  const interviewSessions: InterviewSession[] = [
    {
      id: "interview-alpha",
      applicationId: "app-alpha",
      panelId: "panel-1",
      assignedJurorIds: ["juror-p1-b", "juror-p1-c"], // neither is the Stage 2a reviewer (juror-p1-a) — satisfies the "one non-2a-reviewer" rule with room to spare
      scheduledAt: nowIso(-6),
      format: "virtual",
      status: "completed",
      consistencyNotes: {
        B: "Ops director described the last board effectiveness review in specific detail — consistent with declaration.",
        C: "HR lead walked through a real appraisal cycle end-to-end, matched the documented process.",
      },
      probeQuestions: {},
      requestedAt: nowIso(-12),
      requestedByJurorId: "juror-p1-a",
      initialEmailSentAt: nowIso(-12),
      lastBookingReminderAt: null,
      lastAttendanceReminderAt: nowIso(-7),
    },
    {
      id: "interview-beta",
      applicationId: "app-beta",
      panelId: "panel-2",
      assignedJurorIds: ["juror-p2-b", "juror-p2-c"],
      scheduledAt: nowIso(3),
      format: "virtual",
      status: "scheduled",
      consistencyNotes: {},
      probeQuestions: {},
      requestedAt: nowIso(-5),
      requestedByJurorId: "juror-p2-a",
      initialEmailSentAt: nowIso(-5),
      lastBookingReminderAt: null,
      lastAttendanceReminderAt: null,
    },
  ];

  const availability: InterviewAvailabilitySlot[] = [
    { id: "slot-1", jurorId: "juror-p2-b", date: nowIso(3).slice(0, 10), startTime: "10:00", endTime: "10:45", booked: true, bookedByApplicationId: "app-beta" },
    { id: "slot-2", jurorId: "juror-p2-c", date: nowIso(3).slice(0, 10), startTime: "10:00", endTime: "10:45", booked: true, bookedByApplicationId: "app-beta" },
    { id: "slot-3", jurorId: "juror-p2-b", date: nowIso(8).slice(0, 10), startTime: "14:00", endTime: "14:45", booked: false },
  ];

  const liveEvidenceRequests: LiveEvidenceRequest[] = [
    {
      id: "live-evidence-1",
      interviewSessionId: "interview-alpha",
      applicationId: "app-alpha",
      description: "Updated org chart showing current board composition",
      requestedAt: nowIso(-6),
      deadline: nowIso(-1),
      receivedAt: nowIso(-2),
    },
  ];

  // --- Pillar scorecards: app-alpha matches the doc's own worked example
  // (section 11.4) exactly, as a ground-truth check for
  // lib/scoring/stage2.ts — Juror 1's individual Verified Score should
  // compute to 67.05%, and Pillar B's Panel Pillar Score (mean of
  // 3.50/3.00/3.70) to 3.40 / 10.20% contribution.
  const alphaJurors = ["juror-p1-a", "juror-p1-b", "juror-p1-c"];
  const alphaPillarDims: Record<string, [number, number, number, number][]> = {
    // pillar: [ [policy, implementation, evidenceQuality, measurableImpact], ... ] one per juror (p1-a, p1-b, p1-c)
    B: [
      [4, 3, 4, 3], // Juror 1 (doc example) -> blended 3.50
      [3, 3, 3, 3], // Juror 2 (doc example) -> blended 3.00
      [4, 3, 4, 4], // Juror 3 (doc example) -> blended 3.70
    ],
    C: [
      [4, 4, 3, 3],
      [3, 4, 3, 3],
      [4, 4, 4, 3],
    ],
    D: [
      [3, 3, 3, 2],
      [3, 2, 3, 2],
      [3, 3, 3, 3],
    ],
    E: [
      [3, 2, 3, 2],
      [2, 2, 3, 2],
      [3, 3, 3, 2],
    ],
    F: [
      [4, 3, 4, 4],
      [3, 3, 4, 3],
      [4, 4, 4, 4],
    ],
    G: [
      [3, 3, 2, 2],
      [3, 2, 2, 2],
      [3, 3, 3, 2],
    ],
    H: [
      [4, 4, 4, 3],
      [3, 4, 3, 3],
      [4, 4, 4, 4],
    ],
    I: [
      [5, 4, 4, 3],
      [4, 4, 3, 3],
      [5, 4, 4, 4],
    ],
  };

  const pillarScorecards: PillarScorecard[] = [];
  for (const [pillarCode, byJuror] of Object.entries(alphaPillarDims)) {
    byJuror.forEach(([policyExists, implementation, evidenceQuality, measurableImpact], idx) => {
      pillarScorecards.push({
        id: `scorecard-alpha-${pillarCode}-${idx}`,
        applicationId: "app-alpha",
        jurorId: alphaJurors[idx],
        pillarCode: pillarCode as PillarScorecard["pillarCode"],
        round: "sector",
        policyExists,
        implementation,
        evidenceQuality,
        measurableImpact,
        submittedAt: nowIso(-6),
      });
    });
  }

  const scoreAdjustments: ScoreAdjustmentAuditEntry[] = [
    {
      id: "scoreadj-1",
      applicationId: "app-alpha",
      itemId: "B9",
      jurorId: "juror-p1-a",
      stage1Value: "Yes (self-declared)",
      note: "Evidence Quality confirmed on review — signed and dated anti-bribery policy, consistent with declaration.",
      timestamp: nowIso(-8),
    },
  ];

  const shortlistedReports: ShortlistedReport[] = [
    {
      id: "report-alpha",
      applicationId: "app-alpha",
      status: "approved",
      verifiedScore: 0, // filled below once lib/scoring/stage2.ts computes it in later phases; kept at 0 here since this store must stay framework-agnostic
      pillarBreakdown: [],
      narrative:
        "Alpha Manufacturing Ltd demonstrates strong, consistently-implemented governance and human capital practices, with clear board oversight and a mature performance management cycle.",
      strengths: ["Board governance is formal and independently reviewed", "Performance management is integrated with learning and reward"],
      improvements: ["ESG impact measurement and reporting is still early-stage", "Technology investment as a share of budget trails sector peers"],
      createdAt: nowIso(-3),
      releasedAt: nowIso(-1),
    },
  ];

  const nonShortlistedReports: NonShortlistedReport[] = [];

  const employerOfYear: EmployerOfYearValidation = {
    validated: false,
    validatedByUserId: null,
    validatedAt: null,
    winnerApplicationId: null,
  };

  const users: PlatformUser[] = [
    { id: "sec-funke", name: "Funke Adeyemi", email: "funke@neca.org.ng", role: "secretariat", status: "active", isSuperAdmin: true },
    { id: "sec-tosin", name: "Tosin Bankole", email: "tosin@neca.org.ng", role: "secretariat", status: "active", isSuperAdmin: false },
    { id: "juror-p1-a", name: "Dr. Ike Obi", email: "ike.obi@example.com", role: "jury", status: "active" },
    { id: "juror-p1-b", name: "Grace Nwachukwu", email: "grace.nwachukwu@example.com", role: "jury", status: "active" },
    { id: "juror-p1-c", name: "Emeka Udo", email: "emeka.udo@example.com", role: "jury", status: "active" },
    { id: "juror-p2-a", name: "Tunde Bakare", email: "tunde.bakare@example.com", role: "jury", status: "active" },
    { id: "juror-p2-b", name: "Halima Suleiman", email: "halima.suleiman@example.com", role: "jury", status: "active" },
    { id: "juror-p2-c", name: "Kunle Are", email: "kunle.are@example.com", role: "jury", status: "active" },
    { id: "juror-p3-a", name: "Ada Chukwu", email: "ada.chukwu@example.com", role: "jury", status: "active" },
    { id: "juror-p3-b", name: "Yusuf Bello", email: "yusuf.bello@example.com", role: "jury", status: "active" },
    { id: "juror-p3-c", name: "Chinwe Obasi", email: "chinwe.obasi@example.com", role: "jury", status: "active" },
    { id: "app-user-alpha", name: "Ngozi Eze", email: "ngozi.eze@alpha-example.com", role: "applicant", status: "active" },
    { id: "app-user-beta", name: "Bola Fashina", email: "bola.fashina@beta-example.com", role: "applicant", status: "active" },
    { id: "app-user-gamma", name: "Chinedu Obi", email: "chinedu.obi@gamma-example.com", role: "applicant", status: "active" },
    { id: "app-user-delta", name: "Amaka Nwosu", email: "amaka.nwosu@delta-example.com", role: "applicant", status: "active" },
  ];

  const credentials: MockCredential[] = users.map((u) => ({ userId: u.id, email: u.email, password: "demo" }));

  const auditLog: AuditLogEntry[] = [
    { id: "audit-1", timestamp: nowIso(-1).slice(0, 16), actorName: "Dr. Ike Obi", action: "Submitted pillar scorecard for", target: "Alpha Manufacturing Ltd" },
    { id: "audit-2", timestamp: nowIso(-2).slice(0, 16), actorName: "Funke Adeyemi", action: "Assigned sector cluster to", target: "Panel 1" },
    { id: "audit-3", timestamp: nowIso(-4).slice(0, 16), actorName: "System", action: "Flagged eligibility review for", target: "Gamma Logistics Group" },
  ];

  return {
    sectors: SECTORS,
    benchmarkBands: BENCHMARK_BANDS,
    organizations,
    applications,
    answers,
    documents,
    redFlags,
    documentVerifications,
    eligibilityReviews,
    panels: PANELS,
    panelSectorAssignments: PANEL_SECTOR_ASSIGNMENTS,
    jurorConflicts: [],
    shortlistConfigs: SHORTLIST_CONFIGS,
    interviewSessions,
    availability,
    liveEvidenceRequests,
    pillarScorecards,
    scoreAdjustments,
    shortlistedReports,
    nonShortlistedReports,
    employerOfYear,
    auditLog,
    users,
    credentials,
  };
}

const globalForStore = globalThis as unknown as {
  __necaMockStore?: Store;
  __necaApplicantOrgLink?: Record<string, string>;
  __necaNextId?: number;
};

/**
 * Always cache on globalThis, in every environment. This isn't just a dev
 * Fast-Refresh convenience: the standalone production build (see
 * next.config.ts's output: "standalone", and how deploy.sh/README run
 * `node .next/standalone/server.js`) traces each route/action into its own
 * bundle, so without a process-wide singleton here, different bundles each
 * call seed() independently and end up with silently divergent copies of
 * "the database" within the same running server. globalThis is the only
 * thing guaranteed to be shared across those bundles.
 */
export const store: Store = globalForStore.__necaMockStore ?? seed();
export const applicantOrgLink: Record<string, string> =
  globalForStore.__necaApplicantOrgLink ??
  {
    "app-user-alpha": "org-alpha",
    "app-user-beta": "org-beta",
    "app-user-gamma": "org-gamma",
    "app-user-delta": "org-delta",
  };

globalForStore.__necaMockStore = store;
globalForStore.__necaApplicantOrgLink = applicantOrgLink;

export function generateId(prefix: string): string {
  globalForStore.__necaNextId = (globalForStore.__necaNextId ?? 1000) + 1;
  return `${prefix}-${globalForStore.__necaNextId}`;
}
