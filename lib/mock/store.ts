import type {
  AIReport,
  Application,
  AuditLogEntry,
  Criterion,
  InterviewAvailabilitySlot,
  JurorAssignment,
  JurorScorecard,
  Organization,
  PlatformSettings,
  PlatformUser,
  QuestionnaireAnswer,
  QuestionnaireSection,
  RequiredDocument,
  Sector,
} from "@/types/domain";

/**
 * In-memory mock "database" standing in for Supabase until the real schema
 * exists. Lives as a module-level singleton on `globalThis` so it survives
 * Next.js dev Fast Refresh; in production it simply lives for the lifetime
 * of the Node process. Server Actions in lib/actions/* mutate this directly;
 * read functions in lib/data/* read from it. Nothing outside lib/mock and
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
  criteria: Criterion[];
  organizations: Organization[];
  applications: Application[];
  questionnaireSections: QuestionnaireSection[];
  questionnaireAnswers: QuestionnaireAnswer[]; // keyed by applicationId via composite below
  answersByApplication: Record<string, QuestionnaireAnswer[]>;
  documents: RequiredDocument[];
  jurorAssignments: JurorAssignment[];
  scorecards: JurorScorecard[];
  availability: InterviewAvailabilitySlot[];
  aiReports: AIReport[];
  auditLog: AuditLogEntry[];
  users: PlatformUser[];
  credentials: MockCredential[];
  settings: PlatformSettings;
}

function nowIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

const CRITERIA: Criterion[] = [
  { id: "crit-leadership", name: "Leadership and Governance", weightPoints: 20, order: 1 },
  { id: "crit-innovation", name: "Innovation, Productivity and Corporate Performance", weightPoints: 20, order: 2 },
  { id: "crit-hrm", name: "Effective HRM and Industrial Relations Practice", weightPoints: 20, order: 3 },
  { id: "crit-conduct", name: "Responsible Business Conduct", weightPoints: 15, order: 4 },
  { id: "crit-diversity", name: "Inclusiveness and Diversity", weightPoints: 15, order: 5 },
  { id: "crit-tech-ohs", name: "Technological Optimization / OHS", weightPoints: 10, order: 6 },
];

const SECTORS: Sector[] = [
  { id: "sector-manufacturing", name: "Manufacturing" },
  { id: "sector-agriculture", name: "Agriculture" },
  { id: "sector-financial", name: "Financial Services" },
  { id: "sector-logistics", name: "Logistics" },
  { id: "sector-oil-gas", name: "Oil & Gas" },
  { id: "sector-ict", name: "ICT / Telecoms" },
];

const QUESTIONNAIRE_SECTIONS: QuestionnaireSection[] = [
  {
    id: "qs-leadership",
    criterionId: "crit-leadership",
    title: "Leadership and Governance",
    questions: [
      { id: "q-lead-1", prompt: "Describe your board governance structure.", type: "textarea" },
      { id: "q-lead-2", prompt: "How many independent directors sit on your board?", type: "number" },
    ],
  },
  {
    id: "qs-innovation",
    criterionId: "crit-innovation",
    title: "Innovation, Productivity and Corporate Performance",
    questions: [
      { id: "q-innov-1", prompt: "Evidence of measurable productivity improvements over the last 3 years.", type: "textarea" },
      { id: "q-innov-2", prompt: "Innovation initiatives introduced in the review period.", type: "textarea" },
    ],
  },
  {
    id: "qs-hrm",
    criterionId: "crit-hrm",
    title: "Effective HRM and Industrial Relations Practice",
    questions: [
      { id: "q-hrm-1", prompt: "Describe your organization's grievance-handling process.", type: "textarea" },
      { id: "q-hrm-2", prompt: "What % of staff are unionized?", type: "number" },
      { id: "q-hrm-3", prompt: "Has your organization had any labor disputes in the last 3 years?", type: "boolean" },
    ],
  },
  {
    id: "qs-conduct",
    criterionId: "crit-conduct",
    title: "Responsible Business Conduct",
    questions: [
      { id: "q-conduct-1", prompt: "Describe your approach to environmental compliance.", type: "textarea" },
      { id: "q-conduct-2", prompt: "Do you have a published code of ethics?", type: "boolean" },
    ],
  },
  {
    id: "qs-diversity",
    criterionId: "crit-diversity",
    title: "Inclusiveness and Diversity",
    questions: [
      { id: "q-div-1", prompt: "What % of senior leadership roles are held by women?", type: "number" },
      { id: "q-div-2", prompt: "Describe initiatives supporting workplace inclusiveness.", type: "textarea" },
    ],
  },
  {
    id: "qs-tech-ohs",
    criterionId: "crit-tech-ohs",
    title: "Technological Optimization / OHS",
    questions: [
      { id: "q-tech-1", prompt: "Describe technology adopted to optimize operations.", type: "textarea" },
      { id: "q-tech-2", prompt: "Do you have a documented Occupational Health & Safety policy?", type: "boolean" },
    ],
  },
];

const REQUIRED_DOC_TEMPLATES = [
  { name: "Certificate of Incorporation (CAC)", requiredBecause: "All applicants" },
  { name: "Audited Financial Statement (last FY)", requiredBecause: "All applicants" },
  { name: "Collective Bargaining Agreement", requiredBecause: 'Answered "Yes" to unionized staff' },
  { name: "OHS Policy Document", requiredBecause: "All applicants" },
  { name: "Board Composition Statement", requiredBecause: "All applicants" },
];

function makeDocs(applicationId: string, uploadedCount: number): RequiredDocument[] {
  return REQUIRED_DOC_TEMPLATES.map((t, i) => ({
    id: `${applicationId}-doc-${i}`,
    applicationId,
    name: t.name,
    requiredBecause: t.requiredBecause,
    status: i < uploadedCount ? "uploaded" : "missing",
    fileName: i < uploadedCount ? `${t.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf` : undefined,
    certifiedByJurorId: null,
    certifiedAt: null,
    flaggedIssue: null,
  }));
}

/**
 * Every scorecard item is scored 0–5 raw (matching the wireframe's fixed
 * button grid) regardless of which criterion it belongs to. A criterion's
 * contribution to the total is the item average scaled up to that
 * criterion's weight — see scoreCriterionRaw, shared with the submit-score
 * Server Action so seed data and live scoring use identical math.
 *
 * `criterionTargets`, when given, is the desired *scaled* score per
 * criterion (e.g. 16 out of a 20-point criterion) — used only to generate
 * plausible seed data; raw item values are back-solved from it.
 */
function makeScorecard(
  applicationId: string,
  jurorId: string,
  status: "not_started" | "in_progress" | "submitted",
  criterionTargets?: number[]
): JurorScorecard {
  const criteriaScores = CRITERIA.map((crit, ci) => {
    const questions = QUESTIONNAIRE_SECTIONS.find((s) => s.criterionId === crit.id)!.questions;
    const n = questions.length;

    let rawValues: (number | null)[] = questions.map(() => null);
    if (status === "submitted" && criterionTargets) {
      const target = criterionTargets[ci];
      const rawSumNeeded = Math.round((target * n * 5) / crit.weightPoints);
      const base = Math.floor(rawSumNeeded / n);
      const remainder = rawSumNeeded - base * n;
      rawValues = questions.map((_, qi) => Math.min(5, Math.max(0, base + (qi < remainder ? 1 : 0))));
    } else if (status === "in_progress") {
      rawValues = questions.map((_, qi) => (qi === 0 ? 3 : null));
    }

    return {
      criterionId: crit.id,
      items: questions.map((q, qi) => ({
        id: `${applicationId}-${jurorId}-${crit.id}-${qi}`,
        prompt: q.prompt,
        value: rawValues[qi],
        maxValue: 5,
      })),
    };
  });

  const totalScore = status === "submitted" ? scoreCriteria(criteriaScores) : null;

  return {
    applicationId,
    jurorId,
    status,
    criteriaScores,
    totalScore,
    submittedAt: status === "submitted" ? nowIso(-2) : null,
  };
}

/** Sums a scorecard's criteria into the final weighted total. Shared with lib/actions/scoring.ts. */
export function scoreCriteria(criteriaScores: JurorScorecard["criteriaScores"]): number {
  const total = criteriaScores.reduce((sum, cs) => {
    const crit = CRITERIA.find((c) => c.id === cs.criterionId)!;
    const n = cs.items.length;
    const rawSum = cs.items.reduce((s, i) => s + (i.value ?? 0), 0);
    return sum + (rawSum / (n * 5)) * crit.weightPoints;
  }, 0);
  return Math.round(total * 10) / 10;
}

function seed(): Store {
  const organizations: Organization[] = [
    { id: "org-aeros", name: "Aeros Marketing Solutions", rcNumber: "RC 1234567", yearFounded: 2011, address: "12 Adeola Odeku St, Victoria Island, Lagos", sectorId: "sector-manufacturing", employeeHeadcount: "50–250", primaryContactName: "Tosin Lawson", primaryContactEmail: "aeros@example.com" },
    { id: "org-nordic", name: "Nordic Steelworks Ltd", rcNumber: "RC 2233445", yearFounded: 1998, address: "Km 12 Lekki-Epe Expressway, Lagos", sectorId: "sector-manufacturing", employeeHeadcount: "250–1000", primaryContactName: "Bola Fashina", primaryContactEmail: "contact@nordicsteel.example.com" },
    { id: "org-prime", name: "Prime Textiles Co.", rcNumber: "RC 3344556", yearFounded: 2005, address: "Kano Industrial Estate, Kano", sectorId: "sector-manufacturing", employeeHeadcount: "250–1000", primaryContactName: "Halima Suleiman", primaryContactEmail: "contact@primetextiles.example.com" },
    { id: "org-crestline", name: "Crestline Manufacturing Co", rcNumber: "RC 9988776", yearFounded: 2016, address: "Ogun Industrial Park, Ogun State", sectorId: "sector-manufacturing", employeeHeadcount: "50–250", primaryContactName: "Emeka Obi", primaryContactEmail: "contact@crestline.example.com" },
    { id: "org-delta", name: "Delta Fintech Group", rcNumber: "RC 4455667", yearFounded: 2016, address: "Churchgate St, Victoria Island, Lagos", sectorId: "sector-financial", employeeHeadcount: "250–1000", primaryContactName: "Adaeze Nwosu", primaryContactEmail: "delta@example.com" },
    { id: "org-sahara", name: "Sahara Logistics Ltd", rcNumber: "RC 5566778", yearFounded: 2009, address: "Apapa Port Complex, Lagos", sectorId: "sector-logistics", employeeHeadcount: "50–250", primaryContactName: "Chukwuma Eze", primaryContactEmail: "contact@saharalogistics.example.com" },
    { id: "org-titan", name: "Titan Freight Movers", rcNumber: "RC 6677889", yearFounded: 2013, address: "Trans Amadi, Port Harcourt", sectorId: "sector-logistics", employeeHeadcount: "50–250", primaryContactName: "Ifeanyi Obasi", primaryContactEmail: "contact@titanfreight.example.com" },
    { id: "org-coastline", name: "Coastline Shipping & Logistics", rcNumber: "RC 7788990", yearFounded: 2001, address: "Marina Rd, Lagos Island, Lagos", sectorId: "sector-logistics", employeeHeadcount: "250–1000", primaryContactName: "Femi Adisa", primaryContactEmail: "contact@coastline.example.com" },
    { id: "org-zenith", name: "Zenith Agro Processing", rcNumber: "RC 8899001", yearFounded: 2007, address: "Kaduna Agro Processing Zone, Kaduna", sectorId: "sector-agriculture", employeeHeadcount: "250–1000", primaryContactName: "Grace Danladi", primaryContactEmail: "contact@zenithagro.example.com" },
    { id: "org-brightpath", name: "Brightpath Foods Ltd", rcNumber: "RC 1122330", yearFounded: 2019, address: "Ibadan Agro Hub, Oyo State", sectorId: "sector-agriculture", employeeHeadcount: "10–50", primaryContactName: "Draft Applicant", primaryContactEmail: "draft@example.com" },
    { id: "org-horizon", name: "Horizon Oil Services", rcNumber: "RC 2233001", yearFounded: 1995, address: "Trans Amadi Industrial Layout, Port Harcourt", sectorId: "sector-oil-gas", employeeHeadcount: "1000+", primaryContactName: "Kunle Are", primaryContactEmail: "contact@horizonoil.example.com" },
    { id: "org-nimbus", name: "Nimbus Cloud Systems", rcNumber: "RC 3344001", yearFounded: 2018, address: "Yaba Tech Hub, Lagos", sectorId: "sector-ict", employeeHeadcount: "50–250", primaryContactName: "Yusuf Bello", primaryContactEmail: "contact@nimbuscloud.example.com" },
  ];

  const applications: Application[] = [
    { id: "app-aeros", referenceNo: "EEA-2026-004821", organizationId: "org-aeros", sectorId: "sector-manufacturing", status: "scoring", submittedAt: nowIso(-9), preliminaryScore: 78, totalSections: 6, sectionsCompleted: 6 },
    { id: "app-nordic", referenceNo: "EEA-2026-004822", organizationId: "org-nordic", sectorId: "sector-manufacturing", status: "scoring", submittedAt: nowIso(-8), preliminaryScore: 71, totalSections: 6, sectionsCompleted: 6 },
    { id: "app-prime", referenceNo: "EEA-2026-004823", organizationId: "org-prime", sectorId: "sector-manufacturing", status: "scoring", submittedAt: nowIso(-6), preliminaryScore: 65, totalSections: 6, sectionsCompleted: 6 },
    { id: "app-crestline", referenceNo: "EEA-2026-004830", organizationId: "org-crestline", sectorId: "sector-manufacturing", status: "awaiting_review", submittedAt: nowIso(-1), preliminaryScore: null, totalSections: 6, sectionsCompleted: 6 },
    { id: "app-delta", referenceNo: "EEA-2026-004824", organizationId: "org-delta", sectorId: "sector-financial", status: "released", submittedAt: nowIso(-14), preliminaryScore: 88, totalSections: 6, sectionsCompleted: 6, isSectorWinner: true, isEmployerOfYearShortlist: true },
    { id: "app-sahara", referenceNo: "EEA-2026-004825", organizationId: "org-sahara", sectorId: "sector-logistics", status: "awaiting_review", submittedAt: nowIso(-2), preliminaryScore: null, totalSections: 6, sectionsCompleted: 6 },
    { id: "app-titan", referenceNo: "EEA-2026-004826", organizationId: "org-titan", sectorId: "sector-logistics", status: "incomplete", submittedAt: nowIso(-4), preliminaryScore: 45, totalSections: 6, sectionsCompleted: 6 },
    { id: "app-coastline", referenceNo: "EEA-2026-004827", organizationId: "org-coastline", sectorId: "sector-logistics", status: "released", submittedAt: nowIso(-15), preliminaryScore: 82, totalSections: 6, sectionsCompleted: 6, isSectorWinner: true, isEmployerOfYearShortlist: true },
    { id: "app-zenith", referenceNo: "EEA-2026-004828", organizationId: "org-zenith", sectorId: "sector-agriculture", status: "released", submittedAt: nowIso(-13), preliminaryScore: 75, totalSections: 6, sectionsCompleted: 6, isSectorWinner: true, isEmployerOfYearShortlist: true },
    { id: "app-brightpath", referenceNo: "EEA-2026-004829", organizationId: "org-brightpath", sectorId: "sector-agriculture", status: "draft", submittedAt: null, preliminaryScore: null, totalSections: 6, sectionsCompleted: 3 },
    { id: "app-horizon", referenceNo: "EEA-2026-004831", organizationId: "org-horizon", sectorId: "sector-oil-gas", status: "released", submittedAt: nowIso(-16), preliminaryScore: 79, totalSections: 6, sectionsCompleted: 6, isSectorWinner: true, isEmployerOfYearShortlist: true },
    { id: "app-nimbus", referenceNo: "EEA-2026-004832", organizationId: "org-nimbus", sectorId: "sector-ict", status: "released", submittedAt: nowIso(-17), preliminaryScore: 69, totalSections: 6, sectionsCompleted: 6, isSectorWinner: true, isEmployerOfYearShortlist: false },
  ];

  const documents: RequiredDocument[] = [
    ...makeDocs("app-aeros", 4),
    ...makeDocs("app-nordic", 5),
    ...makeDocs("app-prime", 5),
    ...makeDocs("app-crestline", 5),
    ...makeDocs("app-delta", 5),
    ...makeDocs("app-sahara", 5),
    ...makeDocs("app-titan", 2),
    ...makeDocs("app-coastline", 5),
    ...makeDocs("app-zenith", 5),
    ...makeDocs("app-brightpath", 2),
    ...makeDocs("app-horizon", 5),
    ...makeDocs("app-nimbus", 5),
  ];
  // Certify a couple of documents on the released applications, for demo purposes.
  documents.find((d) => d.applicationId === "app-delta" && d.name.startsWith("Certificate"))!.certifiedByJurorId = "juror-tunde";
  documents.find((d) => d.applicationId === "app-delta" && d.name.startsWith("Certificate"))!.certifiedAt = nowIso(-10);
  documents.find((d) => d.applicationId === "app-aeros" && d.name.startsWith("Certificate"))!.certifiedByJurorId = "juror-ike";
  documents.find((d) => d.applicationId === "app-aeros" && d.name.startsWith("Certificate"))!.certifiedAt = nowIso(-5);
  documents.find((d) => d.applicationId === "app-aeros" && d.name.startsWith("Audited"))!.certifiedByJurorId = "juror-ike";
  documents.find((d) => d.applicationId === "app-aeros" && d.name.startsWith("Audited"))!.certifiedAt = nowIso(-5);

  const jurorAssignments: JurorAssignment[] = [
    { jurorId: "juror-ike", sectorId: "sector-manufacturing" },
    { jurorId: "juror-ike", sectorId: "sector-agriculture" },
    { jurorId: "juror-adaeze", sectorId: "sector-manufacturing" },
    { jurorId: "juror-tunde", sectorId: "sector-manufacturing" },
    { jurorId: "juror-tunde", sectorId: "sector-financial" },
    { jurorId: "juror-bisi", sectorId: "sector-financial" },
    { jurorId: "juror-emeka", sectorId: "sector-financial" },
    { jurorId: "juror-chidi", sectorId: "sector-agriculture" },
    { jurorId: "juror-chidi", sectorId: "sector-logistics" },
    { jurorId: "juror-amaka", sectorId: "sector-agriculture" },
    { jurorId: "juror-ngozi", sectorId: "sector-logistics" },
    { jurorId: "juror-ngozi", sectorId: "sector-oil-gas" },
    { jurorId: "juror-ngozi", sectorId: "sector-ict" },
    { jurorId: "juror-femi", sectorId: "sector-logistics" },
    { jurorId: "juror-kunle", sectorId: "sector-oil-gas" },
    { jurorId: "juror-ada", sectorId: "sector-oil-gas" },
    { jurorId: "juror-yusuf", sectorId: "sector-ict" },
    { jurorId: "juror-chinwe", sectorId: "sector-ict" },
  ];

  const scorecards: JurorScorecard[] = [
    makeScorecard("app-aeros", "juror-ike", "submitted", [16, 15, 18, 12, 11, 10]), // 82
    makeScorecard("app-aeros", "juror-adaeze", "submitted", [17, 16, 18, 13, 12, 10]), // 86
    makeScorecard("app-aeros", "juror-tunde", "submitted", [16, 16, 18, 12, 12, 10]), // 84
    makeScorecard("app-nordic", "juror-ike", "submitted", [15, 14, 16, 11, 11, 10]), // 77
    makeScorecard("app-nordic", "juror-adaeze", "in_progress"),
    makeScorecard("app-nordic", "juror-tunde", "submitted", [16, 15, 17, 12, 10, 10]), // 80
    makeScorecard("app-prime", "juror-ike", "not_started"),
    makeScorecard("app-prime", "juror-adaeze", "not_started"),
    makeScorecard("app-prime", "juror-tunde", "not_started"),
    makeScorecard("app-delta", "juror-tunde", "submitted", [18, 19, 17, 14, 10, 9]), // 87 -> adjust below
    makeScorecard("app-delta", "juror-bisi", "submitted", [17, 18, 18, 13, 11, 9]), // 86
    makeScorecard("app-delta", "juror-emeka", "submitted", [18, 19, 18, 14, 11, 9]), // 89
    makeScorecard("app-zenith", "juror-ike", "submitted", [15, 14, 16, 11, 10, 9]), // 75
    makeScorecard("app-zenith", "juror-chidi", "submitted", [15, 15, 16, 12, 10, 9]), // 77
    makeScorecard("app-zenith", "juror-amaka", "submitted", [15, 14, 16, 11, 11, 9]), // 76
    makeScorecard("app-coastline", "juror-chidi", "submitted", [16, 17, 17, 12, 12, 9]), // 83
    makeScorecard("app-coastline", "juror-ngozi", "submitted", [16, 16, 16, 12, 11, 9]), // 80
    makeScorecard("app-coastline", "juror-femi", "submitted", [16, 16, 17, 12, 11, 9]), // 81
    makeScorecard("app-horizon", "juror-ngozi", "submitted", [15, 16, 16, 12, 11, 9]), // 79
    makeScorecard("app-horizon", "juror-kunle", "submitted", [15, 15, 16, 12, 11, 9]), // 78
    makeScorecard("app-horizon", "juror-ada", "submitted", [16, 16, 16, 12, 11, 9]), // 80
    makeScorecard("app-nimbus", "juror-ngozi", "submitted", [14, 14, 15, 10, 9, 8]), // 70
    makeScorecard("app-nimbus", "juror-yusuf", "submitted", [13, 14, 14, 10, 10, 8]), // 69
    makeScorecard("app-nimbus", "juror-chinwe", "submitted", [14, 15, 14, 10, 9, 8]), // 70
  ];

  const availability: InterviewAvailabilitySlot[] = [
    { id: "slot-1", jurorId: "juror-ike", date: nowIso(4).slice(0, 10), startTime: "10:00", endTime: "10:30", booked: false },
    { id: "slot-2", jurorId: "juror-ike", date: nowIso(4).slice(0, 10), startTime: "11:00", endTime: "11:30", booked: false },
    { id: "slot-3", jurorId: "juror-ike", date: nowIso(4).slice(0, 10), startTime: "14:00", endTime: "14:30", booked: false },
    { id: "slot-4", jurorId: "juror-ike", date: nowIso(8).slice(0, 10), startTime: "09:00", endTime: "09:30", booked: false },
    { id: "slot-5", jurorId: "juror-ike", date: nowIso(8).slice(0, 10), startTime: "10:00", endTime: "10:30", booked: false },
  ];

  const aiReports: AIReport[] = [
    {
      id: "report-delta",
      applicationId: "app-delta",
      status: "approved",
      narrative:
        "Delta Fintech Group shows particularly strong industrial relations practice and technological adoption across its branch network. Diversity representation at senior levels is the clearest opportunity for improvement ahead of next year's cycle.",
      strengths: ["Structured grievance resolution with low dispute recurrence", "Documented OHS policy with quarterly audits"],
      improvements: ["Increase female representation in senior leadership", "Publish a formal diversity & inclusion policy"],
      createdAt: nowIso(-3),
      releasedAt: nowIso(-2),
    },
    {
      id: "report-zenith",
      applicationId: "app-zenith",
      status: "approved",
      narrative:
        "Zenith Agro Processing demonstrates consistent productivity gains and a well-documented safety program across its processing sites. Formalizing succession planning at the leadership tier is the most immediate opportunity.",
      strengths: ["Quarterly OHS audits with zero lost-time incidents", "Transparent grievance escalation process"],
      improvements: ["Formalize a leadership succession plan", "Expand supplier diversity program"],
      createdAt: nowIso(-4),
      releasedAt: nowIso(-3),
    },
    {
      id: "report-coastline",
      applicationId: "app-coastline",
      status: "approved",
      narrative:
        "Coastline Shipping & Logistics shows strong fleet safety performance and consistent labor relations. Broader adoption of digital tracking across regional depots is the clearest next step.",
      strengths: ["Zero unresolved labor disputes in 3 years", "Strong board independence ratio"],
      improvements: ["Expand digital fleet tracking to regional depots", "Publish sustainability metrics annually"],
      createdAt: nowIso(-4),
      releasedAt: nowIso(-3),
    },
    {
      id: "report-horizon",
      applicationId: "app-horizon",
      status: "approved",
      narrative:
        "Horizon Oil Services demonstrates mature safety governance and steady productivity performance. Diversity in technical roles remains an area to develop further.",
      strengths: ["Comprehensive OHS incident reporting system", "Strong union engagement record"],
      improvements: ["Increase diversity in technical and field roles", "Publish an annual sustainability report"],
      createdAt: nowIso(-5),
      releasedAt: nowIso(-4),
    },
    {
      id: "report-nimbus",
      applicationId: "app-nimbus",
      status: "approved",
      narrative:
        "Nimbus Cloud Systems shows strong innovation output for its size, with a lean governance structure that will need to formalize as the organization scales.",
      strengths: ["High R&D reinvestment relative to revenue", "Modern, well-documented OHS policy for a hybrid workforce"],
      improvements: ["Formalize board governance structure as the company scales", "Increase representation of women in senior technical roles"],
      createdAt: nowIso(-5),
      releasedAt: nowIso(-4),
    },
    {
      id: "report-aeros",
      applicationId: "app-aeros",
      status: "pending_approval",
      narrative:
        "Aeros Marketing Solutions shows particularly strong industrial relations practice and technological adoption. Diversity representation at senior levels is the clearest opportunity for improvement ahead of next year's cycle.",
      strengths: ["Structured grievance resolution with low dispute recurrence", "Documented OHS policy with quarterly audits"],
      improvements: ["Increase female representation in senior leadership", "Publish a formal diversity & inclusion policy"],
      createdAt: nowIso(-1),
      releasedAt: null,
    },
  ];

  const users: PlatformUser[] = [
    { id: "sec-funke", name: "Funke Adeyemi", email: "funke@neca.org.ng", role: "secretariat", status: "active", isSuperAdmin: true },
    { id: "sec-tosin", name: "Tosin Bankole", email: "tosin@neca.org.ng", role: "secretariat", status: "active", isSuperAdmin: false },
    { id: "juror-ike", name: "Dr. Ike Obi", email: "ike.obi@example.com", role: "jury", status: "active", sectorIds: ["sector-manufacturing", "sector-agriculture"] },
    { id: "juror-adaeze", name: "Adaeze Umeh", email: "adaeze.umeh@example.com", role: "jury", status: "active", sectorIds: ["sector-manufacturing"] },
    { id: "juror-tunde", name: "Tunde Bakare", email: "tunde.bakare@example.com", role: "jury", status: "active", sectorIds: ["sector-manufacturing", "sector-financial"] },
    { id: "juror-grace", name: "Grace Nwachukwu", email: "grace.n@example.com", role: "jury", status: "invited", sectorIds: ["sector-financial"] },
    { id: "juror-bisi", name: "Bisi Coker", email: "bisi.coker@example.com", role: "jury", status: "active", sectorIds: ["sector-financial"] },
    { id: "juror-emeka", name: "Emeka Nnamdi", email: "emeka.nnamdi@example.com", role: "jury", status: "active", sectorIds: ["sector-financial"] },
    { id: "juror-chidi", name: "Chidi Okafor", email: "chidi.okafor@example.com", role: "jury", status: "active", sectorIds: ["sector-agriculture", "sector-logistics"] },
    { id: "juror-amaka", name: "Amaka Johnson", email: "amaka.johnson@example.com", role: "jury", status: "active", sectorIds: ["sector-agriculture"] },
    { id: "juror-ngozi", name: "Ngozi Eze", email: "ngozi.eze@example.com", role: "jury", status: "active", sectorIds: ["sector-logistics", "sector-oil-gas", "sector-ict"] },
    { id: "juror-femi", name: "Femi Adisa", email: "femi.adisa@example.com", role: "jury", status: "active", sectorIds: ["sector-logistics"] },
    { id: "juror-kunle", name: "Kunle Are", email: "kunle.are@example.com", role: "jury", status: "active", sectorIds: ["sector-oil-gas"] },
    { id: "juror-ada", name: "Ada Chukwu", email: "ada.chukwu@example.com", role: "jury", status: "active", sectorIds: ["sector-oil-gas"] },
    { id: "juror-yusuf", name: "Yusuf Bello", email: "yusuf.bello@example.com", role: "jury", status: "active", sectorIds: ["sector-ict"] },
    { id: "juror-chinwe", name: "Chinwe Obasi", email: "chinwe.obasi@example.com", role: "jury", status: "active", sectorIds: ["sector-ict"] },
    { id: "app-user-aeros", name: "Tosin Lawson", email: "aeros@example.com", role: "applicant", status: "active" },
    { id: "app-user-delta", name: "Adaeze Nwosu", email: "delta@example.com", role: "applicant", status: "active" },
    { id: "app-user-brightpath", name: "Draft Applicant", email: "draft@example.com", role: "applicant", status: "active" },
  ];

  const credentials: MockCredential[] = users.map((u) => ({ userId: u.id, email: u.email, password: "demo" }));

  const auditLog: AuditLogEntry[] = [
    { id: "audit-1", timestamp: nowIso(-1).slice(0, 16), actorName: "Dr. Ike Obi", action: "Submitted score for", target: "Aeros Marketing Solutions" },
    { id: "audit-2", timestamp: nowIso(-1).slice(0, 16), actorName: "Funke Adeyemi", action: "Approved report for", target: "Delta Fintech Group" },
    { id: "audit-3", timestamp: nowIso(-2).slice(0, 16), actorName: "Funke Adeyemi", action: "Invited juror", target: "Grace Nwachukwu" },
    { id: "audit-4", timestamp: nowIso(-2).slice(0, 16), actorName: "System", action: "Closed scoring window for", target: "Financial Services" },
    { id: "audit-5", timestamp: nowIso(-3).slice(0, 16), actorName: "Tunde Bakare", action: "Certified document for", target: "Delta Fintech Group" },
    { id: "audit-6", timestamp: nowIso(-4).slice(0, 16), actorName: "Funke Adeyemi", action: "Updated advancement threshold to", target: "60" },
  ];

  return {
    sectors: SECTORS,
    criteria: CRITERIA,
    organizations,
    applications,
    questionnaireSections: QUESTIONNAIRE_SECTIONS,
    questionnaireAnswers: [],
    answersByApplication: {
      "app-brightpath": [
        { questionId: "q-lead-1", value: "Our board is composed of 5 members, 2 of whom are independent directors." },
        { questionId: "q-lead-2", value: "2" },
      ],
    },
    documents,
    jurorAssignments,
    scorecards,
    availability,
    aiReports,
    auditLog,
    users,
    credentials,
    settings: { advancementThresholdScore: 60 },
  };
}

const globalForStore = globalThis as unknown as { __necaMockStore?: Store; __necaApplicantOrgLink?: Record<string, string> };

export const store: Store = globalForStore.__necaMockStore ?? seed();
export const applicantOrgLink: Record<string, string> =
  globalForStore.__necaApplicantOrgLink ??
  { "app-user-aeros": "org-aeros", "app-user-delta": "org-delta", "app-user-brightpath": "org-brightpath" };

if (process.env.NODE_ENV !== "production") {
  globalForStore.__necaMockStore = store;
  globalForStore.__necaApplicantOrgLink = applicantOrgLink;
}

let nextId = 1000;
export function generateId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}
