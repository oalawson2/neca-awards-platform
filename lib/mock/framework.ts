/**
 * Static assessment framework definition — the platform's transcription
 * of NECA's 2026 Edition Assessment Framework & Applicant Questionnaire
 * source document. This file holds no application/runtime state (that's
 * lib/mock/store.ts); it's the fixed rulebook every other mock module
 * reads from, matching how a real schema would separate "framework
 * config" tables from "application data" tables.
 *
 * Item `id`s match the document's own numbering exactly (B1, C19,
 * D3-alt, ...) so every score/checklist/audit entry traces back to a
 * specific line in the source doc.
 *
 * Two assumptions made transcribing this, not stated explicitly in the
 * doc, flagged here rather than guessed silently elsewhere:
 *  1. Accepted file types / max size per checklist item aren't specified
 *     in the doc (it only says the checklist "shows accepted file types,
 *     max size, and a one-line description" — not what those values are).
 *     Defaulted to PDF/DOCX/JPG/PNG, 10MB, pending NECA's real spec —
 *     see evidenceDefaultsFor() below.
 *  2. "N/A" is offered wherever the doc's own type legend defines a type
 *     as "Y/N/NA" (i.e. every "yn"-type item) — the doc's section 2.1
 *     rule 7 describes N/A as offered "on context-dependent questions"
 *     without enumerating which ones, so this file treats every yn-type
 *     item as NA-eligible and no non-yn item as NA-eligible. Flagged as a
 *     judgment call, not a literal doc requirement.
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

const yn = (
  id: string,
  pillarCode: PillarCode,
  order: number,
  prompt: string,
  track: "mandatory" | "advanced",
  evidenceName: string | null
): AssessmentItem => ({ id, pillarCode, order, prompt, responseType: "yn", track, evidenceName, allowNA: true });

const mat = (
  id: string,
  pillarCode: PillarCode,
  order: number,
  prompt: string,
  track: "mandatory" | "advanced",
  evidenceName: string | null,
  maturityLabels: [string, string, string, string, string]
): AssessmentItem => ({ id, pillarCode, order, prompt, responseType: "maturity", track, evidenceName, maturityLabels });

const freq = (
  id: string,
  pillarCode: PillarCode,
  order: number,
  prompt: string,
  track: "mandatory" | "advanced",
  evidenceName: string | null
): AssessmentItem => ({ id, pillarCode, order, prompt, responseType: "frequency", track, evidenceName });

const num = (
  id: string,
  pillarCode: PillarCode,
  order: number,
  prompt: string,
  track: "mandatory" | "advanced",
  evidenceName: string | null
): AssessmentItem => ({ id, pillarCode, order, prompt, responseType: "numeric", track, evidenceName });

const pct = (
  id: string,
  pillarCode: PillarCode,
  order: number,
  prompt: string,
  track: "mandatory" | "advanced",
  benchmarkKey: string
): AssessmentItem => ({ id, pillarCode, order, prompt, responseType: "percentage", track, evidenceName: null, benchmarkKey });

const narr = (
  id: string,
  pillarCode: PillarCode,
  order: number,
  prompt: string,
  track: "mandatory" | "advanced",
  evidenceName: string | null
): AssessmentItem => ({ id, pillarCode, order, prompt, responseType: "narrative", track, evidenceName });

const msel = (
  id: string,
  pillarCode: PillarCode,
  order: number,
  prompt: string,
  track: "mandatory" | "advanced",
  options: string[]
): AssessmentItem => ({ id, pillarCode, order, prompt, responseType: "multiselect", track, evidenceName: null, multiselectOptions: options });

export const ASSESSMENT_ITEMS: AssessmentItem[] = [
  // --- Section B — Leadership, Governance & Ethics (15%) ---
  mat("B1", "B", 1, "Strategic direction: which best describes your organisation?", "mandatory", "Strategic Plan", [
    "No documented strategy",
    "Strategy exists but uncommunicated",
    "Communicated to management",
    "Communicated organisation-wide",
    "Reviewed annually and monitored through KPIs",
  ]),
  mat("B2", "B", 2, "Corporate governance maturity: how mature is your governance framework?", "mandatory", "Board Charter / Organogram / Governance Policy", [
    "None",
    "Informal",
    "Formal with documented responsibilities",
    "Board effectiveness reviews conducted",
    "Independently reviewed",
  ]),
  yn("B3", "B", 3, "Our governance/advisory Board has clearly defined roles and responsibilities that are separate from those of staff.", "mandatory", "Governance Policy"),
  yn("B4", "B", 4, "Our governance/advisory Board regularly assesses the effectiveness of relations with customers, partners, suppliers and other stakeholders.", "mandatory", "Stakeholder review report / minutes"),
  yn("B5", "B", 5, "Our governance/advisory Board has a formal process for reviewing its own performance.", "advanced", "Board evaluation report"),
  yn("B6", "B", 6, "Our governance/advisory Board has a clear method for recruiting the chief executive and a proper succession plan for that role.", "mandatory", "Succession policy"),
  pct("B7", "B", 7, "Board/advisory board gender diversity — % of female board or advisory members.", "advanced", "board-gender-diversity"),
  yn("B8", "B", 8, "Our organisation has a Code of Conduct / ethics framework known to staff and observed by employees, partners and suppliers.", "mandatory", "Code of Conduct"),
  yn("B9", "B", 9, "Our organisation has an anti-bribery and corruption policy.", "mandatory", "Anti-bribery Policy"),
  yn("B10", "B", 10, "Our organisation has a whistleblowing policy and channel accessible to all employees.", "mandatory", "Whistleblowing Policy"),
  mat("B11", "B", 11, "Enterprise risk management maturity:", "mandatory", "Risk register / ERM policy", [
    "No process",
    "Ad-hoc",
    "Documented risk register",
    "Regularly reviewed",
    "Integrated into strategic decision-making",
  ]),
  yn("B12", "B", 12, "Our organisation has a documented Business Continuity / Disaster Recovery Plan.", "advanced", "BCP document"),
  yn("B13", "B", 13, "Our organisation has an organisation-wide succession planning framework (beyond the CEO role).", "advanced", "Succession framework"),
  yn("B14", "B", 14, "Our organisation implements a certified quality management system (e.g. ISO 9001 or equivalent).", "advanced", "QMS certificate"),
  freq("B15", "B", 15, "How often does your Board/leadership formally engage with employees or their representatives on organisational direction?", "mandatory", "Meeting minutes"),

  // --- Section C — Human Capital Management (25%) ---
  mat("C1", "C", 1, "HR policy maturity: are HR management policies formalised, documented, approved by the relevant authority and regularly updated?", "mandatory", "HR Policy Manual", [
    "None",
    "Informal",
    "Documented but outdated",
    "Documented and current",
    "Documented, current, and benchmarked externally",
  ]),
  yn("C2", "C", 2, "Our organisation has a structured workforce planning process aligned to business strategy.", "mandatory", "Workforce plan"),
  freq("C3", "C", 3, "How often does the HR department work with line managers and staff in designing and delivering HR practice?", "mandatory", null),
  yn("C4", "C", 4, "We maintain updated personnel files with access and data-use policies aligned to the Nigeria Data Protection Regulation.", "mandatory", "Data Protection Policy"),
  mat("C5", "C", 5, "HR technology maturity: extent of HR Management System / software use.", "advanced", "System name / screenshot", [
    "None",
    "Manual/spreadsheet",
    "Basic HRIS",
    "Integrated HRIS with self-service",
    "AI-enabled/analytics-driven HRIS",
  ]),
  yn("C6", "C", 6, "Our organisation uses a structured, competency-based recruitment and selection process.", "mandatory", "Recruitment Policy"),
  yn("C7", "C", 7, "Our organisation has a formal onboarding/induction programme for new employees.", "mandatory", "Onboarding Plan"),
  mat("C8", "C", 8, "Performance management maturity.", "mandatory", "Appraisal Policy / template", [
    "None",
    "Informal",
    "Annual appraisal only",
    "Continuous performance conversations",
    "Integrated with learning, promotion and reward",
  ]),
  yn("C9", "C", 9, "Our organisation has a formal process for managing or improving unsatisfactory employee performance.", "mandatory", "PIP procedure"),
  yn("C10", "C", 10, "Training needs are formally identified before L&D programmes are designed.", "mandatory", "Training needs analysis"),
  yn("C11", "C", 11, "Our organisation conducts post-training evaluations to measure outcomes and impact on performance.", "advanced", "Evaluation report"),
  num("C12", "C", 12, "Average training hours per employee (past 12 months).", "advanced", null),
  yn("C13", "C", 13, "Our organisation maintains a leadership pipeline / talent pool for critical roles.", "advanced", "Talent pipeline document"),
  yn("C14", "C", 14, "Our organisation runs a structured graduate or entry-level development programme.", "advanced", "Programme document"),
  yn("C15", "C", 15, "Our organisation has a defined career development / progression framework communicated to staff.", "advanced", "Career framework"),
  yn("C16", "C", 16, "Our organisation conducts an employee engagement survey.", "mandatory", "Latest survey summary or action plan"),
  pct("C17", "C", 17, "Most recent employee engagement score / survey participation rate (%).", "advanced", "employee-engagement-score"),
  yn("C18", "C", 18, "Our organisation has a documented employee retention strategy.", "mandatory", "Retention strategy"),
  pct("C19", "C", 19, "Staff turnover rate, 2025 (%).", "mandatory", "staff-turnover"),
  yn("C20", "C", 20, "Our organisation operates a formal employee recognition and reward programme.", "advanced", "Programme description"),
  yn("C21", "C", 21, "Our organisation offers flexible/hybrid working arrangements where role-appropriate.", "advanced", "Flexible work policy"),
  pct("C22", "C", 22, "Internal promotion rate — % of vacancies filled internally (past 12 months).", "advanced", "internal-promotion-rate"),

  // --- Section D — Labour Relations & Employee Experience (10%) ---
  msel("D1", "D", 1, "How does your organisation engage employees on workplace matters?", "mandatory", [
    "Recognised Trade Union",
    "Joint Consultative Committee",
    "Staff Consultative Forum",
    "Employee Representatives",
    "Town Hall Meetings",
    "Employee Engagement Surveys",
    "Digital Feedback Platforms",
    "Suggestion Scheme",
    "Other",
  ]),
  // Branch: unionised path
  { ...yn("D3", "D", 3, "Do you have a Collective Bargaining Agreement in force?", "mandatory", "CBA"), branchGroup: "D3", branchValue: "unionised" },
  { ...freq("D4", "D", 4, "Frequency of formal union engagement meetings.", "mandatory", "Union meeting minutes"), branchGroup: "D4", branchValue: "unionised" },
  { ...yn("D5", "D", 5, "Do you have a Joint Consultative Committee or equivalent?", "mandatory", "JCC minutes"), branchGroup: "D5", branchValue: "unionised" },
  // Branch: non-unionised path (equivalently weighted)
  { ...yn("D3-alt", "D", 3, "Do you have a documented Employee Consultation Policy?", "mandatory", "Consultation Policy"), branchGroup: "D3", branchValue: "non-unionised" },
  { ...freq("D4-alt", "D", 4, "Frequency of Town Hall / staff forum meetings.", "mandatory", "Forum minutes"), branchGroup: "D4", branchValue: "non-unionised" },
  { ...yn("D5-alt", "D", 5, "Do you have an Employee Engagement Policy/Framework?", "mandatory", "Policy/Framework document"), branchGroup: "D5", branchValue: "non-unionised" },
  yn("D6", "D", 6, "Our organisation has a documented grievance resolution procedure known to employees.", "mandatory", "Grievance Policy"),
  num("D7", "D", 7, "Number of formal industrial actions or strikes affecting the organisation in the past 24 months.", "mandatory", null),
  narr("D8", "D", 8, "Most recent measure of employee satisfaction with internal communication (survey score or equivalent, if available).", "advanced", "Survey extract"),
  freq("D9", "D", 9, "How often are organisation-wide communication forums (town halls, briefings, newsletters) held?", "mandatory", null),

  // --- Section E — Technology & Digital Transformation (10%) ---
  mat("E1", "E", 1, "HRIS maturity: extent of technology used to manage HR processes.", "mandatory", "System description", [
    "None",
    "Manual",
    "Basic system",
    "Integrated with self-service",
    "AI-enabled/analytics-driven",
  ]),
  yn("E2", "E", 2, "Our organisation has automated one or more core business or HR processes in the past 24 months.", "advanced", "Process description"),
  yn("E3", "E", 3, "Our organisation develops or subscribes to e-learning programmes for employees.", "mandatory", "Platform / programme description"),
  yn("E4", "E", 4, "Our organisation applies AI in its operations or HR function.", "advanced", "Use-case description (NARR)"),
  yn("E5", "E", 5, "Our organisation has a documented cybersecurity and data protection policy.", "mandatory", "Policy"),
  yn("E6", "E", 6, "Our organisation uses digital collaboration tools organisation-wide (e.g. shared workspaces, video conferencing, project tools).", "mandatory", null),
  yn("E7", "E", 7, "Our organisation has established processes to protect intellectual property and institutional knowledge.", "advanced", "IP/knowledge management policy"),
  pct("E8", "E", 8, "Technology investment, past 12 months, as a proportion of operating budget.", "advanced", "tech-investment"),
  yn("E9", "E", 9, "Our organisation has a dedicated innovation lab, digital transformation team or equivalent function.", "advanced", null),
  freq("E10", "E", 10, "How often does your organisation train employees, at all levels, on the latest technological changes relevant to their roles?", "mandatory", null),

  // --- Section F — Innovation, Productivity & Business Performance (10%) ---
  yn("F1", "F", 1, "Our organisation has a clear, documented strategy for enhancing quality, productivity and innovation.", "mandatory", "Strategy document"),
  yn("F2", "F", 2, "Our organisation enforces clearly defined production or service standards (e.g. SON, sector-specific standards).", "mandatory", "Standard/certificate"),
  yn("F3", "F", 3, "In the most recently completed financial year, our organisation met its own strategic performance objectives (not limited to profitability).", "mandatory", "Performance report / Balanced Scorecard"),
  yn("F4", "F", 4, "In the most recently completed financial year, our organisation maintained or increased staff strength.", "mandatory", "Headcount data"),
  yn("F5", "F", 5, "Our organisation formally measures customer satisfaction.", "advanced", "CSAT/NPS report"),
  yn("F6", "F", 6, "Our organisation runs a structured continuous improvement programme (e.g. Kaizen, Lean, Six Sigma or equivalent).", "advanced", "Programme description"),
  yn("F7", "F", 7, "Our organisation tracks productivity metrics (e.g. output per employee) over time.", "advanced", "Productivity data"),
  narr("F8", "F", 8, "Describe one innovation your organisation implemented in the past 12 months and its measurable effect.", "advanced", "Supporting case note (optional)"),
  yn("F9", "F", 9, "Our organisation maintains a business performance dashboard reviewed by leadership.", "advanced", "Dashboard sample"),

  // --- Section G — ESG & Responsible Business (10%) ---
  yn("G1", "G", 1, "Our organisation has a functional CSR policy linked to organisational values and communicated to employees.", "mandatory", "CSR Policy"),
  yn("G2", "G", 2, "Our organisation complies with all applicable local laws and regulations, including tax and social security obligations.", "mandatory", "Tax clearance / compliance certificate"),
  yn("G3", "G", 3, "Our organisation has integrated ESG criteria into its overall business strategy.", "advanced", "ESG Policy / Strategy"),
  yn("G4", "G", 4, "Our organisation fosters an ESG culture, leveraging technology for data collection/reporting and engaging stakeholders on ESG strategy.", "advanced", null),
  yn("G5", "G", 5, "Our organisation manages its environmental impact (e.g. waste, emissions, energy use) through a documented approach.", "advanced", "Environmental Policy"),
  yn("G6", "G", 6, "Our organisation has a responsible/ethical procurement policy covering its supply chain.", "advanced", "Procurement Policy"),
  yn("G7", "G", 7, "Our organisation has a documented human rights policy.", "mandatory", "Human Rights Policy"),
  yn("G8", "G", 8, "Our organisation runs a community investment programme.", "advanced", "CSR project report"),
  yn("G9", "G", 9, "Our organisation measures the impact of its CSR/ESG initiatives on both financial performance and stakeholder trust.", "advanced", "Impact report"),
  yn("G10", "G", 10, "Our organisation monitors CSR/ESG impact and shares results with stakeholders.", "advanced", "Sustainability report"),
  yn("G11", "G", 11, "Our organisation applies a supplier/vendor code of conduct covering responsible business practice.", "advanced", "Supplier Code of Conduct"),

  // --- Section H — Diversity, Equity, Inclusion, Safety & Wellbeing (10%) ---
  pct("H1", "H", 1, "% of female employees in the total workforce.", "mandatory", "female-workforce-share"),
  pct("H2", "H", 2, "% of female employees in management/leadership roles.", "advanced", "female-management-share"),
  yn("H3", "H", 3, "Our organisation has a functional disability policy handling employees with disability in line with the Discrimination Against Persons with Disabilities (Prohibition) Act 2018.", "mandatory", "Disability Policy"),
  yn("H4", "H", 4, "Job adverts are accessible to Persons with Disabilities (PWDs), who are encouraged to apply for all positions.", "mandatory", null),
  yn("H5", "H", 5, "Our organisation has an Equal Employment Opportunity policy.", "mandatory", "EEO Policy"),
  yn("H6", "H", 6, "Our organisation has an anti-harassment / anti-discrimination policy.", "mandatory", "Policy"),
  yn("H7", "H", 7, "Our organisation monitors pay equity across gender and other demographic groups.", "advanced", "Pay equity review"),
  yn("H8", "H", 8, "Our organisation regularly assesses and evaluates the effectiveness of its EEO and diversity programmes.", "advanced", "Evaluation report"),
  yn("H9", "H", 9, "Our organisation has a comprehensive health and safety policy covering critical H&S risks.", "mandatory", "H&S Policy"),
  yn("H10", "H", 10, "Our organisation records and analyses health and safety performance statistics and shares them regularly with employees.", "mandatory", "H&S statistics"),
  freq("H11", "H", 11, "How often does your organisation conduct occupational health and safety training for staff?", "mandatory", "Training records"),
  yn("H12", "H", 12, "Our organisation encourages employee participation and feedback in safety and health decision-making.", "mandatory", null),
  yn("H13", "H", 13, "Our organisation holds ISO 45001 or an equivalent occupational health & safety certification.", "advanced", "Certificate"),
  yn("H14", "H", 14, "Our organisation has a documented emergency preparedness/response plan.", "mandatory", "Emergency Plan"),
  yn("H15", "H", 15, "Our organisation operates a near-miss/incident reporting system.", "advanced", "Reporting procedure"),
  yn("H16", "H", 16, "Our organisation provides mental health or employee assistance (EAP) initiatives.", "advanced", "Programme description"),

  // --- Section I — Responsible Employment & Child Protection (10%) ---
  yn("I1", "I", 1, "Our organisation has policies or procedures to prevent child labour in any part of its workforce and supply chain.", "mandatory", "Child Labour Policy"),
  yn("I2", "I", 2, "Our organisation has policies or procedures to prevent forced labour and modern slavery.", "mandatory", "Policy"),
  yn("I3", "I", 3, "Our organisation follows ethical/responsible recruitment practices (e.g. no recruitment fees charged to workers, transparent contracts).", "advanced", "Recruitment practice statement"),
  yn("I4", "I", 4, "Our organisation offers structured internship or apprenticeship programmes for young persons aged 15–17.", "advanced", "Programme document"),
  num("I5", "I", 5, "Number of young persons (15–17) engaged through structured internships/apprenticeships in the past 12 months.", "advanced", null),
  yn("I6", "I", 6, "Our organisation includes support to children's welfare and education as part of its CSR.", "advanced", "CSR report"),
  yn("I7", "I", 7, "Our organisation's employment practices align with the ILO core labour standards.", "mandatory", null),
  yn("I8", "I", 8, "Our organisation conducts due diligence on suppliers for child/forced labour risk.", "advanced", "Supplier due diligence record / Code of Conduct"),
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
 * specs.
 */
export function evidenceDefaultsFor(evidenceName: string): { acceptedFileTypes: string[]; maxSizeMB: number; description: string } {
  return {
    acceptedFileTypes: ["pdf", "docx", "jpg", "png"],
    maxSizeMB: 10,
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
