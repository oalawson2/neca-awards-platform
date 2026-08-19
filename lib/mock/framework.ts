/**
 * Assessment framework definition — synced from the real, live-seeded
 * `sections` + `items` tables (9 sections, 56 items as of the third
 * resync; see NECA_Supabase_Schema_Reference.md), not hand-transcribed
 * from the source PDF anymore. Pulled directly via the Supabase MCP
 * connection.
 *
 * Third resync note: NECA edited the live `items` table directly again
 * (81 -> 56 items). 25 items were deleted outright (B3, B5, B7, B12,
 * B13, C3, C13, C15, C21, D8, E2, E4, E9, F6, F7, F9, G8, G10, G11, H4,
 * H5, H13, H15, I2, I8) — none had any item-specific scoring rule in
 * lib/scoring/stage1.ts to remove along with them (that class of cleanup
 * was D7/I5, both already gone as of the second resync). 13 items kept
 * their question but had evidence_trigger_name cleared to null in the DB
 * (B1, B6, C2, C4, C7, C9, C11, C14, C18, C20, E1, F1, F3) — evidenceName
 * below is null for exactly these, which is also all
 * lib/scoring/stage1.ts's evidenceTriggerFired() and lib/data/checklist.ts
 * need to stop generating a checklist entry for them: both already key
 * off `!item.evidenceName`, generically, so this needed no code change,
 * only the data resync. 7 items were revised (question text and/or
 * evidence_trigger_name): C10, E5, G3, G6, G7, H9, I1 — G7/H9/I1's
 * question text changes visibly absorb the concepts of items deleted
 * alongside them (H13's ISO 45001 wording folded into H9; I2's forced-
 * labour wording folded into I1).
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
 * maturity item — parsed out of question_text's own trailing "(A -> B ->
 * ...)" list, which the DB does bake into the stored text for maturity
 * items, into the separate array this codebase's rendering expects),
 * multiselectOptions, benchmarkKey (links a percentage item to its
 * BenchmarkBand), and branchGroup (the DB stores branch_scope per item,
 * i.e. which side of a branch an item belongs to, but not which items are
 * the "same slot" across the two sides — D3/D3-alt etc. are grouped here
 * by convention: same order number within their pillar). Only 2
 * percentage items survive this resync (H1, H2) — B7 (the third) was
 * deleted, so its "board-gender-diversity" BenchmarkBand key is gone too.
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

const pct = (b: Base, benchmarkKey: string): AssessmentItem => ({ ...b, responseType: "percentage", benchmarkKey });

const msel = (b: Base, options: string[]): AssessmentItem => ({ ...b, responseType: "multiselect", multiselectOptions: options });

export const ASSESSMENT_ITEMS: AssessmentItem[] = [
  // --- Section B — Leadership, Governance & Ethics (15%) ---
  mat(
    { id: "B1", dbId: "dc573982-4996-4a7e-b3b7-fab1b8a9a12c", pillarCode: "B", order: 1, prompt: "Strategic direction: which best describes your organisation?", track: "mandatory", evidenceName: null },
    ["No documented strategy", "Strategy exists but uncommunicated", "Communicated to management", "Communicated organisation-wide", "Reviewed annually and monitored through KPIs"]
  ),
  mat(
    { id: "B2", dbId: "3620a3f4-fa8e-45ad-9f87-06f82df6376a", pillarCode: "B", order: 2, prompt: "Corporate governance maturity: how mature is your governance framework?", track: "mandatory", evidenceName: "Organogram and Board Charter/Governance Policy" },
    ["None", "Informal", "Formal with documented responsibilities", "Board effectiveness reviews conducted", "Independently reviewed"]
  ),
  yn({ id: "B6", dbId: "8d9fde0a-f4b8-43ac-86cd-976f4856fa06", pillarCode: "B", order: 6, prompt: "Our governance/advisory Board has a clear method for recruiting the chief executive and a proper succession plan for that role.", track: "mandatory", evidenceName: null }),
  yn({ id: "B8", dbId: "d470a137-9cde-413a-8939-702ae82a4aaa", pillarCode: "B", order: 8, prompt: "Our organisation has a Code of Conduct / ethics framework known to staff and observed by employees, partners and suppliers.", track: "mandatory", evidenceName: "Code of Conduct" }),
  yn({ id: "B9", dbId: "790ee4bd-7302-4be6-918d-090ab044c6ea", pillarCode: "B", order: 9, prompt: "Our organisation has an anti-bribery and corruption policy.", track: "mandatory", evidenceName: "Anti-bribery Policy" }),
  yn({ id: "B10", dbId: "5d2f8081-1c9a-4839-8d01-0b82574e15c4", pillarCode: "B", order: 10, prompt: "Our organisation has a whistleblowing policy and channel accessible to all employees.", track: "mandatory", evidenceName: "Whistleblowing Policy" }),
  mat(
    { id: "B11", dbId: "8e701032-aa6d-4f7f-8580-8a232f9d6bbb", pillarCode: "B", order: 11, prompt: "Enterprise risk management maturity:", track: "mandatory", evidenceName: "Risk register / Enterprise risk management policy" },
    ["No process", "Ad-hoc", "Documented risk register", "Regularly reviewed", "Integrated into strategic decision-making"]
  ),
  yn({ id: "B14", dbId: "9a78e7c9-aee7-4331-b43d-5f46150fa735", pillarCode: "B", order: 14, prompt: "Our organisation implements a certified quality management system (e.g. ISO 9001 or equivalent).", track: "advanced", evidenceName: "QMS certificate" }),

  // --- Section C — Human Capital Management (25%) ---
  mat(
    { id: "C1", dbId: "2e56eb01-c88d-4e72-91d2-4789d9a1ea2f", pillarCode: "C", order: 1, prompt: "HR policy maturity: are HR management policies formalised, documented, approved by the relevant authority and regularly updated?", track: "mandatory", evidenceName: "HR Policy Manual" },
    ["None", "Informal", "Documented but outdated", "Documented and current", "Documented, current, and benchmarked externally"]
  ),
  yn({ id: "C2", dbId: "fcc5045a-2ae7-448a-a961-8c6771629b1b", pillarCode: "C", order: 2, prompt: "Our organisation has a structured workforce planning process aligned to business strategy.", track: "mandatory", evidenceName: null }),
  yn({ id: "C4", dbId: "6cab5f9a-dd3f-4ffe-ac93-fa48d6ef6422", pillarCode: "C", order: 4, prompt: "We maintain updated personnel files with access and data-use policies aligned to the Nigeria Data Protection Regulation.", track: "mandatory", evidenceName: null }),
  mat(
    { id: "C5", dbId: "07f1f7f0-9bfd-4da1-afdc-de326893bb1a", pillarCode: "C", order: 5, prompt: "HR technology maturity: extent of HR Management System / software use.", track: "mandatory", evidenceName: "System screenshot" },
    ["None", "Manual/spreadsheet", "Basic HRIS", "Integrated HRIS with self-service", "AI-enabled/analytics-driven HRIS"]
  ),
  yn({ id: "C6", dbId: "3daf60d2-a225-47a4-9bcc-1b62f50e5f51", pillarCode: "C", order: 6, prompt: "Our organisation uses a structured, competency-based recruitment and selection process.", track: "mandatory", evidenceName: "Recruitment Policy" }),
  yn({ id: "C7", dbId: "c8f0a33c-4e6d-4dcd-99bf-2f87d7a8218e", pillarCode: "C", order: 7, prompt: "Our organisation has a formal onboarding/induction programme for new employees.", track: "mandatory", evidenceName: null }),
  mat(
    { id: "C8", dbId: "29c2c121-e2ac-489e-9a44-79277ecff25d", pillarCode: "C", order: 8, prompt: "Performance management maturity.", track: "mandatory", evidenceName: "Appraisal Policy / template" },
    ["None", "Informal", "Annual appraisal only", "Continuous performance conversations", "Integrated with learning, promotion and reward"]
  ),
  yn({ id: "C9", dbId: "a58d53fd-bd86-4462-93b6-58ad704312a6", pillarCode: "C", order: 9, prompt: "Our organisation has a formal process for managing or improving unsatisfactory employee performance.", track: "mandatory", evidenceName: null }),
  yn({ id: "C10", dbId: "33df2164-93b7-4f86-bd3a-965b1eaca357", pillarCode: "C", order: 10, prompt: "Training needs are formally identified before L&D programmes are designed.", track: "mandatory", evidenceName: "Latest Training needs analysis questionnaire or framework" }),
  yn({ id: "C11", dbId: "32adc0fb-7851-4640-929c-9d51d2d271a8", pillarCode: "C", order: 11, prompt: "Our organisation conducts post-training evaluations to measure outcomes and impact on performance.", track: "advanced", evidenceName: null }),
  yn({ id: "C14", dbId: "1ca2a774-8cfd-4a8c-9ae4-9d0d3e5aca0a", pillarCode: "C", order: 14, prompt: "Our organisation runs a structured graduate or entry-level development programme.", track: "advanced", evidenceName: null }),
  yn({ id: "C16", dbId: "df1f28f1-9b04-4b72-b89b-544d8bcd2516", pillarCode: "C", order: 16, prompt: "Our organisation conducts an employee engagement survey.", track: "mandatory", evidenceName: "Latest survey summary or action plan" }),
  yn({ id: "C18", dbId: "8301b9f8-f842-4763-9d3b-0043c771453f", pillarCode: "C", order: 18, prompt: "Our organisation has a documented employee retention strategy.", track: "mandatory", evidenceName: null }),
  yn({ id: "C20", dbId: "fb608e09-f263-4818-8139-c335746ed024", pillarCode: "C", order: 20, prompt: "Our organisation operates a formal employee recognition and reward programme.", track: "advanced", evidenceName: null }),

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

  // --- Section E — Technology & Digital Transformation (10%) ---
  mat(
    { id: "E1", dbId: "8740ce95-326a-4d3a-91ae-c14163e0c607", pillarCode: "E", order: 1, prompt: "HRIS maturity: extent of technology used to manage HR processes.", track: "mandatory", evidenceName: null },
    ["None", "Manual", "Basic system", "Integrated with self-service", "AI-enabled/analytics-driven"]
  ),
  yn({ id: "E3", dbId: "f368beba-6337-4faf-9475-1c8ac970bd34", pillarCode: "E", order: 3, prompt: "Our organisation develops or subscribes to e-learning programmes for employees.", track: "mandatory", evidenceName: "Platform / programme description" }),
  yn({ id: "E5", dbId: "9624bee9-53fc-4278-bbe7-d198bceb45c3", pillarCode: "E", order: 5, prompt: "Our organisation has a documented cybersecurity and data protection policy.", track: "mandatory", evidenceName: "cybersecurity and data protection policy." }),
  yn({ id: "E7", dbId: "e06fa330-46bd-49b8-b355-e9787159060c", pillarCode: "E", order: 7, prompt: "Our organisation has established processes to protect intellectual property and institutional knowledge.", track: "advanced", evidenceName: "IP/knowledge management policy" }),
  freq({ id: "E10", dbId: "7743780c-3746-44c1-9d49-ff15a8c91d6e", pillarCode: "E", order: 10, prompt: "How often does your organisation train employees, at all levels, on the latest technological changes relevant to their roles?", track: "mandatory", evidenceName: null }),

  // --- Section F — Innovation, Productivity & Business Performance (10%) ---
  yn({ id: "F1", dbId: "ae9dd7b8-9a5a-4906-8017-d9f6bc67a6f1", pillarCode: "F", order: 1, prompt: "Our organisation has a clear, documented strategy for enhancing quality, productivity and innovation.", track: "mandatory", evidenceName: null }),
  yn({ id: "F2", dbId: "fafcbbf9-ea2b-4d42-978d-79d79571ceab", pillarCode: "F", order: 2, prompt: "Our organisation enforces clearly defined production or service standards (e.g. SON, sector-specific standards).", track: "mandatory", evidenceName: "Standard/certificate" }),
  yn({ id: "F3", dbId: "48501be0-0076-4122-945f-881ff286b97a", pillarCode: "F", order: 3, prompt: "In the most recently completed financial year, our organisation met its own strategic performance objectives (not limited to profitability).", track: "mandatory", evidenceName: null }),
  yn({ id: "F5", dbId: "cf8925c5-f3e7-4ec5-9a18-cd7a3026f56e", pillarCode: "F", order: 5, prompt: "Our organisation formally measures customer satisfaction.", track: "advanced", evidenceName: "CSAT/NPS report" }),

  // --- Section G — ESG & Responsible Business (10%) ---
  yn({ id: "G1", dbId: "9f4475a2-2d4f-496d-a85c-71757ed95b97", pillarCode: "G", order: 1, prompt: "Our organisation has a functional CSR policy linked to organisational values and communicated to employees.", track: "mandatory", evidenceName: "CSR Policy" }),
  yn({ id: "G2", dbId: "4c83a6fe-653d-4da2-8a0b-b9f78a383f0e", pillarCode: "G", order: 2, prompt: "Our organisation complies with all applicable tax obligations, including remittance of Companies Income Tax / PAYE and VAT to the relevant Federal or State tax authority.", track: "mandatory", evidenceName: "Tax Clearance Certificate (FIRS or relevant State IRS)", triggersEligibilityReviewOnNo: true }),
  yn({ id: "G3", dbId: "2b6d3730-7ddc-459a-b1b2-48a8f1446058", pillarCode: "G", order: 3, prompt: "Our organisation has integrated ESG criteria into its overall business strategy.", track: "advanced", evidenceName: "ESG Policy / Strategy/Report" }),
  yn({ id: "G4", dbId: "16833c23-4657-484a-96d6-691fcf225cf5", pillarCode: "G", order: 4, prompt: "Our organisation is registered and compliant with the Industrial Training Fund (ITF), including remittance of the statutory training contribution levy.", track: "advanced", evidenceName: "ITF Compliance Certificate" }),
  yn({ id: "G5", dbId: "064f7e08-9d61-401f-944c-e8bad53f429e", pillarCode: "G", order: 5, prompt: "Our organisation is compliant with the Pension Reform Act 2014, including remittance of employee and employer pension contributions to a licensed Pension Fund Administrator (PFA).", track: "advanced", evidenceName: "PENCOM Compliance Certificate" }),
  yn({ id: "G6", dbId: "dbcb07fa-0ca0-4b3b-897c-2e500687f4d8", pillarCode: "G", order: 6, prompt: "Our organisation has a responsible/ethical procurement policy covering its supply chain.", track: "advanced", evidenceName: "Procurement Policy/ Supplier Code of Conduct" }),
  yn({ id: "G7", dbId: "5c878b70-0dff-4723-b7b0-3c20dafa6641", pillarCode: "G", order: 7, prompt: "Our organisation has a documented human rights policy (can include Equal Employment Opportunity policy/ an anti-harassment / anti-discrimination policy etc)", track: "mandatory", evidenceName: "Human Rights Policy/ Code of Ethics" }),
  yn({ id: "G9", dbId: "c765ca2e-901c-4d1c-807f-09454d0403d9", pillarCode: "G", order: 9, prompt: "Our organisation is registered and compliant with the Nigeria Social Insurance Trust Fund (NSITF) Employees' Compensation Scheme.", track: "advanced", evidenceName: "NSITF Compliance Certificate" }),

  // --- Section H — Diversity, Equity, Inclusion, Safety & Wellbeing (10%) ---
  pct({ id: "H1", dbId: "a4568270-a810-48b4-b3ce-c8bcc96bc9dc", pillarCode: "H", order: 1, prompt: "% of female employees in the total workforce.", track: "mandatory", evidenceName: "Workforce data with gender demography" }, "female-workforce-share"),
  pct({ id: "H2", dbId: "b9d11f7b-0a8a-426b-9181-2b2ca2619b02", pillarCode: "H", order: 2, prompt: "% of female employees in management/leadership roles.", track: "advanced", evidenceName: "Board composition" }, "female-management-share"),
  yn({ id: "H3", dbId: "57b89765-887a-4400-8faf-3a55394caf2d", pillarCode: "H", order: 3, prompt: "Our organisation has a functional disability policy handling employees with disability in line with the Discrimination Against Persons with Disabilities (Prohibition) Act 2018.", track: "mandatory", evidenceName: "Disability Policy" }),
  yn({ id: "H9", dbId: "e8c7b8f4-7c89-421e-baf6-b5659469216b", pillarCode: "H", order: 9, prompt: "Our organisation has a comprehensive health and safety policy and/or certification covering critical H&S risks.", track: "mandatory", evidenceName: "H&S Policy and/or ISO 45001 or an equivalent certification" }),
  freq({ id: "H11", dbId: "e4418393-7a08-47e1-ac31-d9c197d2ada0", pillarCode: "H", order: 11, prompt: "How often does your organisation conduct occupational health and safety training for staff?", track: "mandatory", evidenceName: "Training records" }),
  yn({ id: "H14", dbId: "d375de82-5c76-4b26-830a-cd3335b4db11", pillarCode: "H", order: 14, prompt: "Our organisation has a documented emergency preparedness/response plan.", track: "mandatory", evidenceName: "Emergency Plan" }),
  yn({ id: "H16", dbId: "200a858f-3026-4a97-bbf7-0cb19eca0086", pillarCode: "H", order: 16, prompt: "Our organisation provides mental health or employee assistance (EAP) initiatives.", track: "advanced", evidenceName: "Programme description" }),

  // --- Section I — Responsible Employment & Child Protection (10%) ---
  yn({ id: "I1", dbId: "94f0354e-c5a3-4b53-a018-27ed6c3c98cb", pillarCode: "I", order: 1, prompt: "Our organisation has policies or procedures to prevent child labour and forced labour/modern slavery in any part of its workforce and supply chain.", track: "mandatory", evidenceName: "Child Labour Policy/Force Labour Policy" }),
  yn({ id: "I3", dbId: "541c03cc-c8ae-4729-aa48-b89290e94647", pillarCode: "I", order: 3, prompt: "Our organisation follows ethical/responsible recruitment practices (e.g. no recruitment fees charged to workers, transparent contracts).", track: "advanced", evidenceName: "Recruitment practice statement" }),
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
 * specs. Real Storage accepts pdf/jpeg/png up to this raw size — see
 * lib/actions/documents.ts's MAX_RAW_BYTES — images are then compressed
 * down to fit the much smaller per-file storage target automatically, so
 * this is the ceiling on what you upload, not what ends up stored.
 */
export function evidenceDefaultsFor(evidenceName: string): { acceptedFileTypes: string[]; maxSizeMB: number; description: string } {
  return {
    acceptedFileTypes: ["pdf", "jpg", "png"],
    maxSizeMB: 8,
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
