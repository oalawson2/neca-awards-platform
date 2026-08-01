import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { LinkButton } from "@/components/ui/Button";

export default async function ApplicantSubmittedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  return (
    <div className="px-6 py-14 sm:py-17 flex flex-col items-center text-center">
      <div className="w-16 h-16 sm:w-19 sm:h-19 rounded-full bg-[#E6F4E6] flex items-center justify-center text-3xl text-success mb-5">
        ✓
      </div>
      <h1 className="font-heading font-extrabold text-2xl sm:text-[27px] text-navy">Application submitted</h1>
      <p className="text-sm text-text-muted mt-2 max-w-md">
        Your entry for the NECA Employers&rsquo; Excellence Awards has been received and locked for review.
      </p>
      <div className="mt-6 bg-bg rounded-full px-7 py-3.5 text-sm">
        Reference No. <strong className="text-navy">{application.referenceNo}</strong>
      </div>

      <div className="mt-11 w-full max-w-3xl grid sm:grid-cols-3 gap-4 text-left">
        <StepCard n="1" title="Secretariat review" desc="Completeness check, ~5 business days" />
        <StepCard n="2" title="Jury scoring" desc="Sector jurors score independently" />
        <StepCard n="3" title="Results released" desc="Report + interview invite if shortlisted" />
      </div>

      <div className="mt-10 flex gap-3.5 flex-wrap justify-center">
        <button
          disabled
          title="Receipt download is not wired up in this mock-data phase"
          className="bg-white text-navy border-[1.5px] border-navy rounded-xl px-[22px] py-[13px] text-sm font-semibold opacity-50 cursor-not-allowed"
        >
          Download receipt
        </button>
        <LinkButton href="/applicant">Return to dashboard</LinkButton>
      </div>
    </div>
  );
}

function StepCard({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="font-bold text-[13px] text-navy mb-1.5">
        {n}. {title}
      </div>
      <div className="text-xs text-text-muted">{desc}</div>
    </div>
  );
}
