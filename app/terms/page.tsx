import Link from "next/link";
import Image from "next/image";
import { TERMS_VERSION } from "@/lib/terms";

export const metadata = {
  title: "Application Guidelines & Terms and Conditions — NECA Employers' Excellence Awards",
};

const PILLARS = [
  ["Organisation Profile & Eligibility", "Establishes eligibility — not scored"],
  ["Leadership, Governance & Ethics", "How the organisation is led and governed"],
  ["Human Capital Management", "How people are recruited, developed and managed"],
  ["Labour Relations & Employee Experience", "How employees are engaged and heard"],
  ["Technology & Digital Transformation", "How technology is used to support the workforce"],
  ["Innovation, Productivity & Business Performance", "How the organisation performs against its own goals"],
  ["ESG & Responsible Business", "Environmental, social and governance and responsible business conduct"],
  ["Diversity, Equity, Inclusion, Safety & Wellbeing", "How inclusive and safe the workplace is"],
  ["Responsible Employment & Child Protection", "Ethical and lawful employment practice"],
] as const;

const STEPS = [
  {
    title: "Register Your Organisation",
    body: "Create an account on the Awards platform using your organisation's official details. You will be asked to confirm your sector, size classification and basic eligibility information.",
  },
  {
    title: "Complete the Assessment Questionnaire",
    body: "Answer the questions across all nine assessment pillars. Responses should be factual and specific to your organisation. The platform saves your progress automatically, so you may complete the questionnaire in more than one sitting.",
  },
  {
    title: "Upload Your Supporting Evidence",
    body: "Once you complete the questionnaire, the platform generates a personalised checklist of mandatory and optional documents relevant to your own answers. Submission is possible if a required document on your checklist has not been uploaded. However, not uploading mandatory documents will lower your eligibility score.",
  },
  {
    title: "Submit Before the Deadline",
    body: "All applications must be submitted by the stated closing date of 15th October 2026. Late submissions will not be accepted under any circumstances.",
  },
  {
    title: "Confirmation of Entry",
    body: "You will receive a message confirming that your application has been successfully received. This can also be viewed on your dashboard.",
  },
] as const;

function SectionHeading({ id, number, children }: { id: string; number: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-heading font-extrabold text-lg sm:text-xl text-navy mt-11 mb-4 scroll-mt-24">
      {number}. {children}
    </h2>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 flex flex-col gap-2 text-[14px] text-text leading-relaxed">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-bg">
      <header className="h-17 border-b border-border flex items-center px-6 sm:px-10 bg-white sticky top-0 z-10">
        <Link href="/" className="flex-shrink-0">
          <Image src="/neca-logo.png" alt="NECA Excellence Awards" width={120} height={30} className="h-7 w-auto" />
        </Link>
      </header>

      <div className="max-w-[720px] mx-auto px-6 sm:px-8 py-10 sm:py-14">
        <div className="text-xs font-bold text-gold uppercase tracking-wide mb-2">{TERMS_VERSION}</div>
        <h1 className="font-heading font-extrabold text-2xl sm:text-[28px] text-navy leading-tight">
          NECA Employers&rsquo; Excellence Awards
        </h1>
        <p className="font-heading font-bold text-base sm:text-lg text-text-muted mt-1.5">
          Application Guidelines &amp; Terms and Conditions
        </p>

        <nav className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] border border-border rounded-2xl px-5 py-4">
          <a href="#part-one" className="text-info font-semibold">
            Part One — Application Guidelines
          </a>
          <a href="#part-two" className="text-info font-semibold">
            Part Two — Terms and Conditions
          </a>
        </nav>

        {/* ============ PART ONE ============ */}
        <h2 id="part-one" className="font-heading font-extrabold text-xl sm:text-2xl text-navy mt-12 pt-2 border-t-2 border-navy scroll-mt-24">
          Part One — Application Guidelines
        </h2>

        <SectionHeading id="about-the-awards" number="1">
          About the Awards
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          The NECA Employers&rsquo; Excellence Awards recognise organisations operating in Nigeria that demonstrate
          outstanding people management, governance and workplace practice. The Awards assess applicants across nine
          themes covering leadership, human capital, labour relations, technology, business performance, responsible
          business conduct, diversity and safety, and responsible employment — evaluated in a way that is fair to
          organisations of every size, from small enterprises to multinational employers.
        </p>

        <SectionHeading id="how-to-apply" number="2">
          How to Apply
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          Organisations are invited to submit one application covering all applicable assessment areas. Only one
          submission is permitted per organisation; duplicate entries will be disqualified.
        </p>
        <ol className="flex flex-col gap-4 mt-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3.5">
              <div className="w-7 h-7 rounded-full bg-navy text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </div>
              <div>
                <div className="font-semibold text-[14px] text-navy">Step {i + 1}: {step.title}</div>
                <div className="text-[14px] text-text-muted leading-relaxed mt-0.5">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>

        <SectionHeading id="eligibility" number="3">
          Eligibility
        </SectionHeading>
        <Bullets
          items={[
            "The Awards are open to all eligible Nigerian employers / private sector businesses, regardless of membership status. That is, you do not have to be a member of NECA.",
            "Applicants must be organisations legally registered and operating in Nigeria.",
            "Applicants must be able to provide evidence of compliance with applicable statutory obligations, including tax, pension, ITF and NSITF requirements, where relevant to eligibility review.",
            "Information and practices submitted must relate to the organisation's current operations, or those within the eligibility period specified for the applicable Awards year (2025–2026).",
            "Each organisation may submit only one application. Multiple entries from the same organisation, or entries submitted on behalf of an organisation without proper authorisation, will be disqualified. If a Group applies, subsidiaries cannot apply, and vice versa.",
            "Organisations under active regulatory/legal sanction, or unable to provide basic eligibility documentation, may be disqualified.",
          ]}
        />

        <SectionHeading id="application-evidence-guidelines" number="4">
          Application &amp; Evidence Guidelines
        </SectionHeading>
        <Bullets
          items={[
            "Responses should be factual, specific and outcome-focused. General statements of intent are less persuasive than concrete examples of what your organisation actually does.",
            "Every claim that can be supported by evidence should be — a policy, a report, a certificate, meeting minutes or similar documentation. The platform will indicate which documents are required based on your own answers.",
            "Judges are assessing evidence of practice and impact.",
            "All information provided must be accurate, current and verifiable. Submitting false, misleading or fabricated information, including documents that do not genuinely belong to the applicant organisation, is grounds for disqualification at any stage, including after an award has been announced.",
            "Documents should be legible, dated, and clearly show the applicant organisation's name where applicable.",
          ]}
        />

        <SectionHeading id="understanding-the-assessment" number="5">
          Understanding the Assessment
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed mb-4">
          Applications are assessed across nine pillars covering the full picture of employer excellence:
        </p>
        <div className="border border-border rounded-2xl overflow-hidden">
          {PILLARS.map(([name, desc], i) => (
            <div
              key={name}
              className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4.5 py-3 text-[13px] ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="font-semibold text-navy sm:w-[260px] flex-shrink-0">{name}</div>
              <div className="text-text-muted">{desc}</div>
            </div>
          ))}
        </div>

        <h3 className="font-heading font-bold text-[15px] text-navy mt-7 mb-3">5.1 How responses are evaluated</h3>
        <p className="text-[14px] text-text leading-relaxed mb-4">
          Rather than a simple yes/no checklist, each area of the questionnaire is evaluated against four dimensions
          of genuine practice:
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ["Policy Exists", "Is there a documented policy or framework covering this?"],
            ["Implementation", "Is it actually applied — consistently, and recently?"],
            ["Evidence Quality", "Does the supporting documentation credibly support it?"],
            ["Measurable Impact", "Is there a real, demonstrable outcome?"],
          ].map(([label, desc]) => (
            <div key={label} className="border border-border rounded-xl px-4 py-3.5">
              <div className="font-semibold text-[13px] text-navy">{label}</div>
              <div className="text-[13px] text-text-muted mt-1 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        <SectionHeading id="the-judging-process" number="6">
          The Judging Process
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          The Awards use a structured, independent, evidence-based process designed for fairness and transparency.
        </p>

        <h3 className="font-heading font-bold text-[15px] text-navy mt-6 mb-3">6.1 Stages of review</h3>
        <Bullets
          items={[
            "Self-Assessment — every applicant completes the online questionnaire; a provisional score is generated.",
            "Document Review — an independent Judges panel reviews the evidence uploaded against what was declared.",
            "Sector Interview — shortlisted applicants meet their assigned Judges panel, virtually or in person, to verify claimed practices and discuss their evidence. This is also an opportunity for the panel to request any additional documentation.",
            "Judges' Validation — shortlisted applicants are validated.",
          ]}
        />

        <h3 className="font-heading font-bold text-[15px] text-navy mt-6 mb-3">6.2 The Judges</h3>
        <p className="text-[14px] text-text leading-relaxed">
          Entries are reviewed by an independent panel of experienced professionals drawn from industry, whose
          identities are kept anonymous until the Awards night. Jurors are required to declare any conflict of
          interest with an applicant organisation and are recused from reviewing an applicant where a conflict
          exists.
        </p>

        <h3 className="font-heading font-bold text-[15px] text-navy mt-6 mb-3">6.3 Scoring and shortlisting</h3>
        <Bullets
          items={[
            "Applications are scored independently by the judges assessing them and shortlisted for each sector and overall winner.",
            "Judges' decisions are final and not subject to appeal.",
          ]}
        />

        <SectionHeading id="confidentiality-data-protection" number="7">
          Confidentiality &amp; Data Protection
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          All information and documents submitted are treated as confidential and are used solely for the purpose of
          assessing your application. Access is restricted to authorised Secretariat and Judges accounts. Judges and
          administrators are bound by confidentiality obligations throughout the process and are not permitted to
          disclose applicant information outside the Awards process.
        </p>
        <p className="text-[14px] text-text leading-relaxed mt-3.5">
          Personal data submitted as part of an application is processed in line with the Nigeria Data Protection
          Regulation and used only for purposes connected to the Awards.
        </p>

        <SectionHeading id="notification-recognition" number="8">
          Notification &amp; Recognition
        </SectionHeading>
        <Bullets
          items={[
            "Awards finalists will be notified directly ahead of the Awards ceremony.",
            "Winners will be announced and celebrated at the Awards ceremony and recognised across NECA's official communication platforms.",
          ]}
        />

        {/* ============ PART TWO ============ */}
        <h2 id="part-two" className="font-heading font-extrabold text-xl sm:text-2xl text-navy mt-14 pt-2 border-t-2 border-navy scroll-mt-24">
          Part Two — Terms and Conditions
        </h2>
        <p className="text-[14px] text-text leading-relaxed mt-4">
          By submitting an application, the applicant organisation agrees to the following terms.
        </p>

        <SectionHeading id="accuracy-of-information" number="9">
          Accuracy of Information
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          The applicant confirms that all information, statements and documents submitted are true, accurate and
          belong to the applicant organisation. Discovery of false, misleading or fabricated information at any
          stage, including after shortlisting or an award has been announced, may result in disqualification,
          withdrawal of an award already granted, and referral to the Secretariat for further action.
        </p>

        <SectionHeading id="right-to-request-additional-information" number="10">
          Right to Request Additional Information
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          The Judges and Secretariat reserve the right to request additional documentation or clarification not
          originally listed in the questionnaire, where reasonably necessary to verify a claim. Failure to provide
          requested information within the stated timeframe may affect an application&rsquo;s standing.
        </p>

        <SectionHeading id="confidentiality" number="11">
          Confidentiality
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          Submitted materials are used solely for the purposes of assessing entries for the Awards and will not be
          shared with third parties outside the judging process, except as required by law or with the
          applicant&rsquo;s consent.
        </p>

        <SectionHeading id="intellectual-property" number="12">
          Intellectual Property &amp; Use of Submitted Materials
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          The applicant retains ownership of all materials submitted. By applying, the applicant grants NECA a
          limited, non-exclusive licence to use excerpts of the submitted information — such as the
          organisation&rsquo;s name, sector, and a general description of the practice being recognised — for the
          purpose of shortlisting communications, the Awards ceremony, and post-Awards publicity, where the applicant
          is shortlisted or wins an award. NECA will not publish confidential internal documents, data, or personal
          employee data submitted as evidence.
        </p>

        <SectionHeading id="publicity-media-consent" number="13">
          Publicity &amp; Media Consent
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          Shortlisted applicants and winners consent to their organisation&rsquo;s name and, where applicable, a
          representative&rsquo;s name and photograph or video likeness being used in Awards-related publicity,
          including press releases, NECA&rsquo;s website and social media platforms, and the Awards ceremony. An
          applicant may notify the Secretariat in writing if it does not wish to be publicised beyond the minimum
          required winner announcement.
        </p>

        <SectionHeading id="decisions-are-final" number="14">
          Decisions Are Final
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          All scoring, shortlisting and award decisions made by the Judges are final. The Awards do not operate a
          formal appeals process.
        </p>

        <SectionHeading id="disqualification" number="15">
          Disqualification
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed mb-3">Grounds for disqualification include:</p>
        <Bullets
          items={[
            "Submission of false, fabricated or plagiarised information or evidence.",
            "Multiple entries submitted for the same organisation.",
            "Failure to complete the mandatory portions of the questionnaire or upload required evidence by the stated deadline.",
            "Attempting to influence the Secretariat or a Judge outside the formal assessment process.",
            "Any conduct that undermines the integrity or fairness of the Awards process.",
          ]}
        />

        <SectionHeading id="amendments" number="16">
          Amendments to These Guidelines
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          NECA reserves the right to amend these Guidelines and Terms and Conditions, including eligibility criteria,
          deadlines and the assessment framework, at any time before the close of applications. Material changes will
          be communicated to registered applicants and reflected in the published version of this document.
        </p>

        <SectionHeading id="limitation-of-liability" number="17">
          Limitation of Liability
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed">
          NECA and the Awards Secretariat are not liable for any loss, cost, or damage arising from an
          applicant&rsquo;s participation in the Awards, including but not limited to technical issues affecting
          submission.
        </p>

        <SectionHeading id="inquiries" number="18">
          Inquiries
        </SectionHeading>
        <p className="text-[14px] text-text leading-relaxed mb-16">
          Email:{" "}
          <a href="mailto:neca@neca.org.ng" className="text-info font-semibold">
            neca@neca.org.ng
          </a>
        </p>
      </div>
    </main>
  );
}
