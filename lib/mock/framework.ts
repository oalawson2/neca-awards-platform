/**
 * Assessment framework definition — synced from the real, live-seeded
 * `sections` + `items` tables (9 sections, 102 items; see
 * NECA_Supabase_Schema_Reference.md), not hand-transcribed from the source
 * PDF anymore. Pulled directly via the Supabase MCP connection and cross-
 * checked against this file's prior hand-transcription (from the same
 * source document, done earlier in the build) — they matched almost
 * exactly, confirming both were faithful; the DB version is now treated as
 * authoritative for anything it stores.
 *
 * Kept as a static, synchronous file rather than converted to live
 * Supabase queries: sections/items are fixed reference data with no
 * Secretariat-facing edit UI (see app/(portals)/secretariat/criteria —
 * "aren't Secretariat-editable here"), and PILLARS/ASSESSMENT_ITEMS are
 * imported synchronously throughout lib/scoring/stage1.ts, lib/scoring/
 * stage2.ts, and the questionnaire engine — converting that to async reads
 * would be a large, high-risk restructure for data that never changes at
 * runtime. If NECA ever needs to edit an item, re-run the sync (or build a
 * dedicated admin editor against the real `items` table) rather than
 * editing this file by hand.
 *
 * NOT stored in the real schema, so still hand-authored here and merged
 * onto the synced fields by item id: maturityLabels (5 stage labels per
 * maturity item), multiselectOptions, benchmarkKey (links a percentage
 * item to its BenchmarkBand), and branchGroup (the DB stores branch_scope
 * per item, i.e. which side of a branch an item belongs to, but not which
 * items are the "same slot" across the two sides — D3/D3-alt etc. are
 * grouped here by convention: same order number within their pillar).
 *
 * `dbId` is the real `items.id` UUID — application_responses.item_id,
 * stage2_document_reviews.item_id, document_evidence's path convention,
 * and interview_evidence_requests.item_id all FK to this, not to the `id`
 * string ("B1") used everywhere else in this codebase as the item's
 * natural key. Every write to those tables must resolve code -> dbId
 * through this file (see lib/data/answers.ts and friends). Section codes
 * (B-I) bridge to `sections.id` the same way via SECTION_DB_IDS, needed
 * for juror_scores.section_id.
 */

import type { AssessmentItem, Pillar, PillarCode } from "@/types/domain";

export const PILLARS: Pillar[] = [
  { code: "A", name: "Organisation Profile & Eligibility", weightPoints: 0, scored: false, order: 1 },
  { code: "B", name: "Leadership, Governance & Ethics", weightPoints: 15, scored: true, order: 2 },
  { code: "C", name: "Human Capital Management", weightPoints: 25, scored: true, order: 3 },
  { code: "D", name: "Labour Relations & Employee Experience", weightPoints: 10, scored: true, order: 4 },
  { code: "E", name: "Technology & Digital Transformation", weightPoints: 10, scored: true, order: 5 },
  { code: "F", name: "Innovation, Productivity & Business Performance", weightPoints: 10, scored: true, order: 6 },
  { code: "G", name: "ESG & Responsible Business", weightPoints: 10, scored: true, order: 7 },
  { code: "H", name: "Diversity, Equity, Inclusion, Safety & Wellbeing", weightPoints: 10, scored: true, order: 8 },
  { code: "I", name: "Responsible Employment & Child Protection", weightPoints: 10, scored: true, order: 9 },
];

export function pillarByCode(code: PillarCode): Pillar {
  const pillar = PILLARS.find((p) => p.code === code);
  if (!pillar) throw new Error(`Unknown pillar code: ${code}`);
  return pillar;
}

/** Real `sections.id` UUIDs, keyed by pillar code — A has no items and is never written to juror_scores, so it's omitted. */
export const SECTION_DB_IDS: Record<Exclude<PillarCode, "A">, string> = {
  B: "8881ef97-a06b-4e82-9bf8-0b5954f828ba",
  C: "c5e91d36-38c2-44da-8c9c-902b1b1ca83f",
  D: "b0862dd1-b9f8-48d4-bc09-d6b82def0bc8",
  E: "6ab42b86-a998-4eb1-97dd-aad62e0b2292",
  F: "1222aecc-f0b7-42a0-984b-e92b87e18952",
  G: "2497e8cf-a936-4eb2-b319-296d7a39a2ea",
  H: "1d246403-ab55-4df1-adbb-1076d8c39a6b",
  I: "0850530b-4357-4581-a292-ee98230db26b",
};

type Base = {
  id: string;
  dbId: string;
  pillarCode: PillarCode;
  order: number;
  prompt: string;
  track: "mandatory" | "advanced";
  evidenceName: string | null;
  triggersEligibilityReviewOnNo?: boolean;
};

const yn = (b: Base, allowNA = true): AssessmentItem => ({ ...b, responseType: "yn_na", allowNA });

const mat = (b: Base, maturityLabels: [string, string, string, string, string]): AssessmentItem => ({
  ...b,
  responseType: "maturity",
  maturityLabels,
});

const freq = (b: Base): AssessmentItem => ({ ...b, responseType: "frequency" });

const num = (b: Base): AssessmentItem => ({ ...b, responseType: "numeric" });

const pct = (b: Base, benchmarkKey: string): AssessmentItem => ({ ...b, responseType: "percentage", benchmarkKey });

const narr = (b: Base): AssessmentItem => ({ ...b, responseType: "narrative" });

const msel = (b: Base, options: string[]): AssessmentItem => ({ ...b, responseType: "multiselect", multiselectOptions: options });

export const ASSESSMENT_ITEMS: AssessmentItem[] = [
  // --- Section B — Leadership, Governance & Ethics (15%) ---
  mat(
    { id: "B1", dbId: "dc573982-4996-4a7e-b3b7-fab1b8a9a12c", pillarCode: "B", order: 1, prompt: "Strategic direction: which best describes your organisation?", track: "mandatory", evidenceName: "Strategic Plan" },
    ["No documented strategy", "Strategy exists but uncommunicated", "Communicated to management", "Communicated organisation-wide", "Reviewed annually and monitored through KPIs"]
  ),
  mat(
    { id: "B2", dbId: "3620a3f4-fa8e-45ad-9f87-06f82df6376a", pillarCode: "B", order: 2, prompt: "Corporate governance maturity: how mature is your governance framework?", track: "mandatory", evidenceName: "Board Charter / Organogram / Governance Policy" },
    ["None", "Informal", "Formal with documented responsibilities", "Board effectiveness reviews conducted", "Independently reviewed"]
  ),
  yn({ id: "B3", dbId: "8423e8b5-0b5a-4917-a757-1bf5d8fcc283", pillarCode: "B", order: 3, prompt: "Our governance/advisory Board has clearly defined roles and responsibilities that are separate from those of staff.", track: "mandatory", evidenceName: "Governance Policy" }),
  yn({ id: "B4", dbId: "72b0aba0-43ee-4727-b3b6-4e1c3883a4b2", pillarCode: "B", order: 4, prompt: "Our governance/advisory Board regularly assesses the effectiveness of relations with customers, partners, suppliers and other stakeholders.", track: "mandatory", evidenceName: "Stakeholder review report / minutes" }),
  yn({ id: "B5", dbId: "b3a7611f-3d84-4bdb-aa4b-8a99514f3480", pillarCode: "B", order: 5, prompt: "Our governance/advisory Board has a formal process for reviewing its own performance.", track: "advanced", evidenceName: "Board evaluation report" }),
  yn({ id: "B6", dbId: "8d9fde0a-f4b8-43ac-86cd-976f4856fa06", pillarCode: "B", order: 6, prompt: "Our governance/advisory Board has a clear method for recruiting the chief executive and a proper succession plan for that role.", track: "mandatory", evidenceName: "Succession policy" }),
  pct({ id: "B7", dbId: "23f0e3fd-1180-4801-affe-1f29bdb9bde8", pillarCode: "B", order: 7, prompt: "Board/advisory board gender diversity - % of female board or advisory members.", track: "advanced", evidenceName: null }, "board-gender-diversity"),
  yn({ id: "B8", dbId: "d470a137-9cde-413a-8939-702ae82a4aaa", pillarCode: "B", order: 8, prompt: "Our organisation has a Code of Conduct / ethics framework known to staff and observed by employees, partners and suppliers.", track: "mandatory", evidenceName: "Code of Conduct" }),
  yn({ id: "B9", dbId: "790ee4bd-7302-4be6-918d-090ab044c6ea", pillarCode: "B", order: 9, prompt: "Our organisation has an anti-bribery and corruption policy.", track: "mandatory", evidenceName: "Anti-bribery Policy" }),
  yn({ id: "B10", dbId: "5d2f8081-1c9a-4839-8d01-0b82574e15c4", pillarCode: "B", order: 10, prompt: "Our organisation has a whistleblowing policy and channel accessible to all employees.", track: "mandatory", evidenceName: "Whistleblowing Policy" }),
  mat(
    { id: "B11", dbId: "8e701032-aa6d-4f7f-8580-8a232f9d6bbb", pillarCode: "B", order: 11, prompt: "Enterprise risk management maturity:", track: "mandatory", evidenceName: "Risk register / ERM policy" },
    ["No process", "Ad-hoc", "Documented risk register", "Regularly reviewed", "Integrated into strategic decision-making"]
  ),
  yn({ id: "B12", dbId: "a45b68ea-ac8f-4607-b503-63a141b99538", pillarCode: "B", order: 12, prompt: "Our organisation has a documented Business Continuity / Disaster Recovery Plan.", track: "advanced", evidenceName: "BCP document" }),
  yn({ id: "B13", dbId: "1966a8e7-ca4f-4f09-b002-22aa0621b5e4", pillarCode: "B", order: 13, prompt: "Our organisation has an organisation-wide succession planning framework (beyond the CEO role).", track: "advanced", evidenceName: "Succession framework" }),
  yn({ id: "B14", dbId: "9a78e7c9-aee7-4331-b43d-5f46150fa735", pillarCode: "B", order: 14, prompt: "Our organisation implements a certified quality management system (e.g. ISO 9001 or equivalent).", track: "advanced", evidenceName: "QMS certificate" }),
  freq({ id: "B15", dbId: "d875f404-ddc8-457f-a296-92d311e5cfa8", pillarCode: "B", order: 15, prompt: "How often does your Board/leadership formally engage with employees or their representatives on organisational direction?", track: "mandatory", evidenceName: "Meeting minutes" }),

  // --- Section C — Human Capital Management (25%) ---
  mat(
    { id: "C1", dbId: "2e56eb01-c88d-4e72-91d2-4789d9a1ea2f", pillarCode: "C", order: 1, prompt: "HR policy maturity: are HR management policies formalised, documented, approved by the relevant authority and regularly updated?", track: "mandatory", evidenceName: "HR Policy Manual" },
    ["None", "Informal", "Documented but outdated", "Documented and current", "Documented, current, and benchmarked externally"]
  ),
  yn({ id: "C2", dbId: "fcc5045a-2ae7-448a-a961-8c6771629b1b", pillarCode: "C", order: 2, prompt: "Our organisation has a structured workforce planning process aligned to business strategy.", track: "mandatory", evidenceName: "Workforce plan" }),
  freq({ id: "C3", dbId: "2deb0084-1575-4c29-abdf-23a1dcfafd36", pillarCode: "C", order: 3, prompt: "How often does the HR department work with line managers and staff in designing and delivering HR practice?", track: "mandatory", evidenceName: null }),
  yn({ id: "C4", dbId: "6cab5f9a-dd3f-4ffe-ac93-fa48d6ef6422", pillarCode: "C", order: 4, prompt: "We maintain updated personnel files with access and data-use policies aligned to the Nigeria Data Protection Regulation.", track: "mandatory", evidenceName: "Data Protection Policy" }),
  mat(
    { id: "C5", dbId: "07f1f7f0-9bfd-4da1-afdc-de326893bb1a", pillarCode: "C", order: 5, prompt: "HR technology maturity: extent of HR Management System / software use.", track: "advanced", evidenceName: "System name / screenshot" },
    ["None", "Manual/spreadsheet", "Basic HRIS", "Integrated HRIS with self-service", "AI-enabled/analytics-driven HRIS"]
  ),
  yn({ id: "C6", dbId: "3daf60d2-a225-47a4-9bcc-1b62f50e5f51", pillarCode: "C", order: 6, prompt: "Our organisation uses a structured, competency-based recruitment and selection process.", track: "mandatory", evidenceName: "Recruitment Policy" }),
  yn({ id: "C7", dbId: "c8f0a33c-4e6d-4dcd-99bf-2f87d7a8218e", pillarCode: "C", order: 7, prompt: "Our organisation has a formal onboarding/induction programme for new employees.", track: "mandatory", evidenceName: "Onboarding Plan" }),
  mat(
    { id: "C8", dbId: "29c2c121-e2ac-489e-9a44-79277ecff25d", pillarCode: "C", order: 8, prompt: "Performance management maturity.", track: "mandatory", evidenceName: "Appraisal Policy / template" },
    ["None", "Informal", "Annual appraisal only", "Continuous performance conversations", "Integrated with learning, promotion and reward"]
  ),
  yn({ id: "C9", dbId: "a58d53fd-bd86-4462-93b6-58ad704312a6", pillarCode: "C", order: 9, prompt: "Our organisation has a formal process for managing or improving unsatisfactory employee performance.", track: "mandatory", evidenceName: "PIP procedure" }),
  yn({ id: "C10", dbId: "33df2164-93b7-4f86-bd3a-965b1eaca357", pillarCode: "C", order: 10, prompt: "Training needs are formally identified before L&D programmes are designed.", track: "mandatory", evidenceName: "Training needs analysis" }),
  yn({ id: "C11", dbId: "32adc0fb-7851-4640-929c-9d51d2d271a8", pillarCode: "C", order: 11, prompt: "Our organisation conducts post-training evaluations to measure outcomes and impact on performance.", track: "advanced", evidenceName: "Evaluation report" }),
  num({ id: "C12", dbId: "bb53afaa-3ebb-49a4-bb5f-414ad76a307e", pillarCode: "C", order: 12, prompt: "Average training hours per employee (past 12 months).", track: "advanced", evidenceName: null }),
  yn({ id: "C13", dbId: "61571803-5552-49e5-98b8-169cbf5180cc", pillarCode: "C", order: 13, prompt: "Our organisation maintains a leadership pipeline / talent pool for critical roles.", track: "advanced", evidenceName: "Talent pipeline document" }),
  yn({ id: "C14", dbId: "1ca2a774-8cfd-4a8c-9ae4-9d0d3e5aca0a", pillarCode: "C", order: 14, prompt: "Our organisation runs a structured graduate or entry-level development programme.", track: "advanced", evidenceName: "Programme document" }),
  yn({ id: "C15", dbId: "c1e776c8-c0da-4ed8-b4ec-58c6a908f7de", pillarCode: "C", order: 15, prompt: "Our organisation has a defined career development / progression framework communicated to staff.", track: "advanced", evidenceName: "Career framework" }),
  yn({ id: "C16", dbId: "df1f28f1-9b04-4b72-b89b-544d8bcd2516", pillarCode: "C", order: 16, prompt: "Our organisation conducts an employee engagement survey.", track: "mandatory", evidenceName: "Latest survey summary or action plan" }),
  pct({ id: "C17", dbId: "3716f43b-0786-4137-a2e1-15b4ee8d0e82", pillarCode: "C", order: 17, prompt: "Most recent employee engagement score / survey participation rate (%).", track: "advanced", evidenceName: null }, "employee-engagement-score"),
  yn({ id: "C18", dbId: "8301b9f8-f842-4763-9d3b-0043c771453f", pillarCode: "C", order: 18, prompt: "Our organisation has a documented employee retention strategy.", track: "mandatory", evidenceName: "Retention strategy" }),
  pct({ id: "C19", dbId: "e1f106da-ef0c-4aa8-af30-de7e556dac3d", pillarCode: "C", order: 19, prompt: "Staff turnover rate, 2025 (%).", track: "mandatory", evidenceName: null }, "staff-turnover"),
  yn({ id: "C20", dbId: "fb608e09-f263-4818-8139-c335746ed024", pillarCode: "C", order: 20, prompt: "Our organisation operates a formal employee recognition and reward programme.", track: "advanced", evidenceName: "Programme description" }),
  yn({ id: "C21", dbId: "e70ee266-dc29-4844-b0ef-ed2789a0dd2a", pillarCode: "C", order: 21, prompt: "Our organisation offers flexible/hybrid working arrangements where role-appropriate.", track: "advanced", evidenceName: "Flexible work policy" }),
  pct({ id: "C22", dbId: "62c5cb60-7eb4-4db7-851a-d1ff2094eed9", pillarCode: "C", order: 22, prompt: "Internal promotion rate - % of vacancies filled internally (past 12 months).", track: "advanced", evidenceName: null }, "internal-promotion-rate"),

  // --- Section D — Labour Relations & Employee Experience (10%) ---
  msel(
    { id: "D1", dbId: "d24c6ac8-92c0-4892-9eed-d9d5c0ddcdc2", pillarCode: "D", order: 1, prompt: "How does your organisation engage employees on workplace matters?", track: "mandatory", evidenceName: "Evidence matched to each selection" },
    ["Recognised Trade Union", "Joint Consultative Committee", "Staff Consultative Forum", "Employee Representatives", "Town Hall Meetings", "Employee Engagement Surveys", "Digital Feedback Platforms", "Suggestion Scheme", "Other"]
  ),
  // Branch: unionised path
  { ...yn({ id: "D3", dbId: "28739d91-0943-4b5d-a08a-01f5011e17ce", pillarCode: "D", order: 2, prompt: "Do you have a Collective Bargaining Agreement in force?", track: "mandatory", evidenceName: "Collective Bargaining Agreement" }), branchGroup: "D3", branchValue: "unionised" },
  { ...freq({ id: "D4", dbId: "7fda1072-5a83-442a-b0c5-f319fdc5a729", pillarCode: "D", order: 3, prompt: "Frequency of formal union engagement meetings.", track: "mandatory", evidenceName: "Union meeting minutes" }), branchGroup: "D4", branchValue: "unionised" },
  { ...yn({ id: "D5", dbId: "96ec9389-a70c-495c-9b5a-78a12d1b4f72", pillarCode: "D", order: 4, prompt: "Do you have a Joint Consultative Committee or equivalent?", track: "mandatory", evidenceName: "JCC minutes" }), branchGroup: "D5", branchValue: "unionised" },
  // Branch: non-unionised path (equivalently weighted)
  { ...yn({ id: "D3-alt", dbId: "19372cb9-f18e-498e-ada0-5a0f0b14aabb", pillarCode: "D", order: 2, prompt: "Do you have a documented Employee Consultation Policy?", track: "mandatory", evidenceName: "Consultation Policy" }), branchGroup: "D3", branchValue: "non_unionised" },
  { ...freq({ id: "D4-alt", dbId: "cdb6698f-1fca-474d-9493-ed278c8f9811", pillarCode: "D", order: 3, prompt: "Frequency of Town Hall / staff forum meetings.", track: "mandatory", evidenceName: "Forum minutes" }), branchGroup: "D4", branchValue: "non_unionised" },
  { ...yn({ id: "D5-alt", dbId: "a8b8a32b-8824-48ac-b874-54d09e295ef3", pillarCode: "D", order: 4, prompt: "Do you have an Employee Engagement Policy/Framework?", track: "mandatory", evidenceName: "Policy/Framework document" }), branchGroup: "D5", branchValue: "non_unionised" },
  yn({ id: "D6", dbId: "6055cb10-da0a-4c8f-9021-36f7883bfbe7", pillarCode: "D", order: 5, prompt: "Our organisation has a documented grievance resolution procedure known to employees.", track: "mandatory", evidenceName: "Grievance Policy" }),
  num({ id: "D7", dbId: "2e397aed-4d2a-4362-bf36-2ed5a20455dd", pillarCode: "D", order: 6, prompt: "Number of formal industrial actions or strikes affecting the organisation in the past 24 months.", track: "mandatory", evidenceName: null }),
  narr({ id: "D8", dbId: "6a85812c-22f4-443b-9e33-11bc1d44cdb0", pillarCode: "D", order: 7, prompt: "Most recent measure of employee satisfaction with internal communication (survey score or equivalent, if available).", track: "advanced", evidenceName: "Survey extract" }),
  freq({ id: "D9", dbId: "88432a86-20c5-4305-8772-b51ba57ccc02", pillarCode: "D", order: 8, prompt: "How often are organisation-wide communication forums (town halls, briefings, newsletters) held?", track: "mandatory", evidenceName: null }),

  // --- Section E — Technology & Digital Transformation (10%) ---
  mat(
    { id: "E1", dbId: "8740ce95-326a-4d3a-91ae-c14163e0c607", pillarCode: "E", order: 1, prompt: "HRIS maturity: extent of technology used to manage HR processes.", track: "mandatory", evidenceName: "System description" },
    ["None", "Manual", "Basic system", "Integrated with self-service", "AI-enabled/analytics-driven"]
  ),
  yn({ id: "E2", dbId: "186ee3a1-97d8-436f-a19d-2814bf41df2f", pillarCode: "E", order: 2, prompt: "Our organisation has automated one or more core business or HR processes in the past 24 months.", track: "advanced", evidenceName: "Process description" }),
  yn({ id: "E3", dbId: "f368beba-6337-4faf-9475-1c8ac970bd34", pillarCode: "E", order: 3, prompt: "Our organisation develops or subscribes to e-learning programmes for employees.", track: "mandatory", evidenceName: "Platform / programme description" }),
  yn({ id: "E4", dbId: "881d42db-aa6e-4a41-b753-8ed2aeb4c2a5", pillarCode: "E", order: 4, prompt: "Our organisation applies AI in its operations or HR function.", track: "advanced", evidenceName: "Use-case description" }),
  yn({ id: "E5", dbId: "9624bee9-53fc-4278-bbe7-d198bceb45c3", pillarCode: "E", order: 5, prompt: "Our organisation has a documented cybersecurity and data protection policy.", track: "mandatory", evidenceName: "Policy" }),
  yn({ id: "E6", dbId: "8861dfd0-27f5-49c0-8a9e-16e05df2516f", pillarCode: "E", order: 6, prompt: "Our organisation uses digital collaboration tools organisation-wide (e.g. shared workspaces, video conferencing, project tools).", track: "mandatory", evidenceName: null }),
  yn({ id: "E7", dbId: "e06fa330-46bd-49b8-b355-e9787159060c", pillarCode: "E", order: 7, prompt: "Our organisation has established processes to protect intellectual property and institutional knowledge.", track: "advanced", evidenceName: "IP/knowledge management policy" }),
  pct({ id: "E8", dbId: "1395c65e-c166-4923-881f-885b0f940823", pillarCode: "E", order: 8, prompt: "Technology investment, past 12 months, as a proportion of operating budget.", track: "advanced", evidenceName: null }, "tech-investment"),
  yn({ id: "E9", dbId: "205990d1-7bf8-4f1e-ae29-308ebd1de141", pillarCode: "E", order: 9, prompt: "Our organisation has a dedicated innovation lab, digital transformation team or equivalent function.", track: "advanced", evidenceName: null }),
  freq({ id: "E10", dbId: "7743780c-3746-44c1-9d49-ff15a8c91d6e", pillarCode: "E", order: 10, prompt: "How often does your organisation train employees, at all levels, on the latest technological changes relevant to their roles?", track: "mandatory", evidenceName: null }),

  // --- Section F — Innovation, Productivity & Business Performance (10%) ---
  yn({ id: "F1", dbId: "ae9dd7b8-9a5a-4906-8017-d9f6bc67a6f1", pillarCode: "F", order: 1, prompt: "Our organisation has a clear, documented strategy for enhancing quality, productivity and innovation.", track: "mandatory", evidenceName: "Strategy document" }),
  yn({ id: "F2", dbId: "fafcbbf9-ea2b-4d42-978d-79d79571ceab", pillarCode: "F", order: 2, prompt: "Our organisation enforces clearly defined production or service standards (e.g. SON, sector-specific standards).", track: "mandatory", evidenceName: "Standard/certificate" }),
  yn({ id: "F3", dbId: "48501be0-0076-4122-945f-881ff286b97a", pillarCode: "F", order: 3, prompt: "In the most recently completed financial year, our organisation met its own strategic performance objectives (not limited to profitability).", track: "mandatory", evidenceName: "Performance report / Balanced Scorecard" }),
  yn({ id: "F4", dbId: "1c741c27-a406-45f8-a185-d304f8ca3462", pillarCode: "F", order: 4, prompt: "In the most recently completed financial year, our organisation maintained or increased staff strength.", track: "mandatory", evidenceName: "Headcount data" }),
  yn({ id: "F5", dbId: "cf8925c5-f3e7-4ec5-9a18-cd7a3026f56e", pillarCode: "F", order: 5, prompt: "Our organisation formally measures customer satisfaction.", track: "advanced", evidenceName: "CSAT/NPS report" }),
  yn({ id: "F6", dbId: "b1a46a84-983b-4d8c-877e-0934d1ff136e", pillarCode: "F", order: 6, prompt: "Our organisation runs a structured continuous improvement programme (e.g. Kaizen, Lean, Six Sigma or equivalent).", track: "advanced", evidenceName: "Programme description" }),
  yn({ id: "F7", dbId: "f2945a16-daf3-48fa-bd0b-6746cf26aa7f", pillarCode: "F", order: 7, prompt: "Our organisation tracks productivity metrics (e.g. output per employee) over time.", track: "advanced", evidenceName: "Productivity data" }),
  narr({ id: "F8", dbId: "3a2e616d-b6d9-4b08-9bfe-27b838e2bcc6", pillarCode: "F", order: 8, prompt: "Describe one innovation your organisation implemented in the past 12 months and its measurable effect.", track: "advanced", evidenceName: "Supporting case note (optional)" }),
  yn({ id: "F9", dbId: "cd8a0953-5d2b-45df-a383-edb13ba53029", pillarCode: "F", order: 9, prompt: "Our organisation maintains a business performance dashboard reviewed by leadership.", track: "advanced", evidenceName: "Dashboard sample" }),

  // --- Section G — ESG & Responsible Business (10%) ---
  yn({ id: "G1", dbId: "9f4475a2-2d4f-496d-a85c-71757ed95b97", pillarCode: "G", order: 1, prompt: "Our organisation has a functional CSR policy linked to organisational values and communicated to employees.", track: "mandatory", evidenceName: "CSR Policy" }),
  yn({ id: "G2", dbId: "4c83a6fe-653d-4da2-8a0b-b9f78a383f0e", pillarCode: "G", order: 2, prompt: "Our organisation complies with all applicable local laws and regulations, including tax and social security obligations.", track: "mandatory", evidenceName: "Tax clearance / compliance certificate", triggersEligibilityReviewOnNo: true }),
  yn({ id: "G3", dbId: "2b6d3730-7ddc-459a-b1b2-48a8f1446058", pillarCode: "G", order: 3, prompt: "Our organisation has integrated ESG criteria into its overall business strategy.", track: "advanced", evidenceName: "ESG Policy / Strategy" }),
  yn({ id: "G4", dbId: "16833c23-4657-484a-96d6-691fcf225cf5", pillarCode: "G", order: 4, prompt: "Our organisation fosters an ESG culture, leveraging technology for data collection/reporting and engaging stakeholders on ESG strategy.", track: "advanced", evidenceName: null }),
  yn({ id: "G5", dbId: "064f7e08-9d61-401f-944c-e8bad53f429e", pillarCode: "G", order: 5, prompt: "Our organisation manages its environmental impact (e.g. waste, emissions, energy use) through a documented approach.", track: "advanced", evidenceName: "Environmental Policy" }),
  yn({ id: "G6", dbId: "dbcb07fa-0ca0-4b3b-897c-2e500687f4d8", pillarCode: "G", order: 6, prompt: "Our organisation has a responsible/ethical procurement policy covering its supply chain.", track: "advanced", evidenceName: "Procurement Policy" }),
  yn({ id: "G7", dbId: "5c878b70-0dff-4723-b7b0-3c20dafa6641", pillarCode: "G", order: 7, prompt: "Our organisation has a documented human rights policy.", track: "mandatory", evidenceName: "Human Rights Policy" }),
  yn({ id: "G8", dbId: "8b295f99-eb34-4af8-9094-d02ad6bdd962", pillarCode: "G", order: 8, prompt: "Our organisation runs a community investment programme.", track: "advanced", evidenceName: "CSR project report" }),
  yn({ id: "G9", dbId: "c765ca2e-901c-4d1c-807f-09454d0403d9", pillarCode: "G", order: 9, prompt: "Our organisation measures the impact of its CSR/ESG initiatives on both financial performance and stakeholder trust.", track: "advanced", evidenceName: "Impact report" }),
  yn({ id: "G10", dbId: "3ac7ad7f-3ce9-4435-8be3-08fc1b24400d", pillarCode: "G", order: 10, prompt: "Our organisation monitors CSR/ESG impact and shares results with stakeholders.", track: "advanced", evidenceName: "Sustainability report" }),
  yn({ id: "G11", dbId: "add8fe88-59cf-405e-962f-f94e87ac178b", pillarCode: "G", order: 11, prompt: "Our organisation applies a supplier/vendor code of conduct covering responsible business practice.", track: "advanced", evidenceName: "Supplier Code of Conduct" }),

  // --- Section H — Diversity, Equity, Inclusion, Safety & Wellbeing (10%) ---
  pct({ id: "H1", dbId: "a4568270-a810-48b4-b3ce-c8bcc96bc9dc", pillarCode: "H", order: 1, prompt: "% of female employees in the total workforce.", track: "mandatory", evidenceName: null }, "female-workforce-share"),
  pct({ id: "H2", dbId: "b9d11f7b-0a8a-426b-9181-2b2ca2619b02", pillarCode: "H", order: 2, prompt: "% of female employees in management/leadership roles.", track: "advanced", evidenceName: null }, "female-management-share"),
  yn({ id: "H3", dbId: "57b89765-887a-4400-8faf-3a55394caf2d", pillarCode: "H", order: 3, prompt: "Our organisation has a functional disability policy handling employees with disability in line with the Discrimination Against Persons with Disabilities (Prohibition) Act 2018.", track: "mandatory", evidenceName: "Disability Policy" }),
  yn({ id: "H4", dbId: "81bf12c7-904f-49b3-9a1a-a63e8ffcea3e", pillarCode: "H", order: 4, prompt: "Job adverts are accessible to Persons with Disabilities (PWDs), who are encouraged to apply for all positions.", track: "mandatory", evidenceName: null }),
  yn({ id: "H5", dbId: "59f71693-fba5-4f31-809a-c4a4dc512cf9", pillarCode: "H", order: 5, prompt: "Our organisation has an Equal Employment Opportunity policy.", track: "mandatory", evidenceName: "EEO Policy" }),
  yn({ id: "H6", dbId: "3966078d-172d-4ca3-bb86-ea47243381b7", pillarCode: "H", order: 6, prompt: "Our organisation has an anti-harassment / anti-discrimination policy.", track: "mandatory", evidenceName: "Policy" }),
  yn({ id: "H7", dbId: "65c7dfc7-07c8-4d90-9625-5dcc0f630fc5", pillarCode: "H", order: 7, prompt: "Our organisation monitors pay equity across gender and other demographic groups.", track: "advanced", evidenceName: "Pay equity review" }),
  yn({ id: "H8", dbId: "cb361d9a-b94e-4fad-84f8-3562dc82304b", pillarCode: "H", order: 8, prompt: "Our organisation regularly assesses and evaluates the effectiveness of its EEO and diversity programmes.", track: "advanced", evidenceName: "Evaluation report" }),
  yn({ id: "H9", dbId: "e8c7b8f4-7c89-421e-baf6-b5659469216b", pillarCode: "H", order: 9, prompt: "Our organisation has a comprehensive health and safety policy covering critical H&S risks.", track: "mandatory", evidenceName: "H&S Policy" }),
  yn({ id: "H10", dbId: "1c0bdb49-b7ab-4951-89c1-eff3acc1002c", pillarCode: "H", order: 10, prompt: "Our organisation records and analyses health and safety performance statistics and shares them regularly with employees.", track: "mandatory", evidenceName: "H&S statistics" }),
  freq({ id: "H11", dbId: "e4418393-7a08-47e1-ac31-d9c197d2ada0", pillarCode: "H", order: 11, prompt: "How often does your organisation conduct occupational health and safety training for staff?", track: "mandatory", evidenceName: "Training records" }),
  yn({ id: "H12", dbId: "32151984-58b7-4fb3-ab83-2f6ae22da7f1", pillarCode: "H", order: 12, prompt: "Our organisation encourages employee participation and feedback in safety and health decision-making.", track: "mandatory", evidenceName: null }),
  yn({ id: "H13", dbId: "08562799-b474-4f37-bd9d-3428b83b282f", pillarCode: "H", order: 13, prompt: "Our organisation holds ISO 45001 or an equivalent occupational health & safety certification.", track: "advanced", evidenceName: "Certificate" }),
  yn({ id: "H14", dbId: "d375de82-5c76-4b26-830a-cd3335b4db11", pillarCode: "H", order: 14, prompt: "Our organisation has a documented emergency preparedness/response plan.", track: "mandatory", evidenceName: "Emergency Plan" }),
  yn({ id: "H15", dbId: "fc38a6f8-9416-4b28-90dd-b760aa7f660b", pillarCode: "H", order: 15, prompt: "Our organisation operates a near-miss/incident reporting system.", track: "advanced", evidenceName: "Reporting procedure" }),
  yn({ id: "H16", dbId: "200a858f-3026-4a97-bbf7-0cb19eca0086", pillarCode: "H", order: 16, prompt: "Our organisation provides mental health or employee assistance (EAP) initiatives.", track: "advanced", evidenceName: "Programme description" }),

  // --- Section I — Responsible Employment & Child Protection (10%) ---
  yn({ id: "I1", dbId: "94f0354e-c5a3-4b53-a018-27ed6c3c98cb", pillarCode: "I", order: 1, prompt: "Our organisation has policies or procedures to prevent child labour in any part of its workforce and supply chain.", track: "mandatory", evidenceName: "Child Labour Policy" }),
  yn({ id: "I2", dbId: "b73dc0e8-234b-46e7-bde5-47e796116e44", pillarCode: "I", order: 2, prompt: "Our organisation has policies or procedures to prevent forced labour and modern slavery.", track: "mandatory", evidenceName: "Policy" }),
  yn({ id: "I3", dbId: "541c03cc-c8ae-4729-aa48-b89290e94647", pillarCode: "I", order: 3, prompt: "Our organisation follows ethical/responsible recruitment practices (e.g. no recruitment fees charged to workers, transparent contracts).", track: "advanced", evidenceName: "Recruitment practice statement" }),
  yn({ id: "I4", dbId: "27e4161d-c045-4322-acc3-4be366f74025", pillarCode: "I", order: 4, prompt: "Our organisation offers structured internship or apprenticeship programmes for young persons aged 15-17.", track: "advanced", evidenceName: "Programme document" }),
  num({ id: "I5", dbId: "0aaa503a-66e6-4d34-a7b6-e7c975029931", pillarCode: "I", order: 5, prompt: "Number of young persons (15-17) engaged through structured internships/apprenticeships in the past 12 months.", track: "advanced", evidenceName: null }),
  yn({ id: "I6", dbId: "9f6442ed-9f3a-4e5e-9221-cd4c4f80b7ab", pillarCode: "I", order: 6, prompt: "Our organisation includes support to children's welfare and education as part of its CSR.", track: "advanced", evidenceName: "CSR report" }),
  yn({ id: "I7", dbId: "b8d68fe7-6fc1-4a33-bcac-48916cc84df9", pillarCode: "I", order: 7, prompt: "Our organisation's employment practices align with the ILO core labour standards.", track: "mandatory", evidenceName: null }),
  yn({ id: "I8", dbId: "971e473e-37c0-4107-8ac9-cc2f331c8d1d", pillarCode: "I", order: 8, prompt: "Our organisation conducts due diligence on suppliers for child/forced labour risk.", track: "advanced", evidenceName: "Supplier due diligence record / Code of Conduct" }),
];

export function itemsForPillar(pillarCode: PillarCode): AssessmentItem[] {
  return ASSESSMENT_ITEMS.filter((i) => i.pillarCode === pillarCode).sort((a, b) => a.order - b.order);
}

export function itemById(id: string): AssessmentItem {
  const item = ASSESSMENT_ITEMS.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown assessment item id: ${id}`);
  return item;
}

/**
 * Evidence-item document metadata not specified per-item in the source
 * doc (see file header, assumption 1) — one reasonable default set,
 * applied to every evidence trigger until NECA provides real per-item
 * specs. Real Storage bucket only accepts pdf/jpeg/png (2MB cap) — see
 * lib/actions/documents.ts — so this display copy is narrower than that
 * hard limit, not wider.
 */
export function evidenceDefaultsFor(evidenceName: string): { acceptedFileTypes: string[]; maxSizeMB: number; description: string } {
  return {
    acceptedFileTypes: ["pdf", "jpg", "png"],
    maxSizeMB: 2,
    description: `Upload your organisation's ${evidenceName}.`,
  };
}

/** Sample interview probes by pillar (doc section 11.3.1) — editable defaults for InterviewSession.probeQuestions. */
export const SAMPLE_INTERVIEW_PROBES: Record<Exclude<PillarCode, "A">, string> = {
  B: "Walk us through the last time your Board/advisory body reviewed its own performance — what changed as a result?",
  C: "Describe how a recent performance appraisal cycle actually ran, from setting objectives to the final review conversation.",
  D: "Tell us about the last significant issue raised through your employee voice mechanism, and how it was resolved.",
  E: "Show us (screen-share) the HR system in use, or describe what changed for employees since it was introduced.",
  F: "What is one number you track monthly to know whether the organisation is performing, and who reviews it?",
  G: "Describe your most recent CSR/ESG initiative end-to-end — what problem it addressed and what changed.",
  H: "Talk us through your most recent workplace safety incident or near-miss, and what came out of the review.",
  I: "How does your organisation actually verify a new employee's or intern's age and eligibility to work?",
};
