import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser, getScoreSummary, getCriterionBreakdown } from "@/lib/data/applications";
import { getReportForApplication } from "@/lib/data/reports";
import { getSectors } from "@/lib/data/sectors-criteria";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

export default async function ApplicantReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  if (application.status !== "released") {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="font-heading font-extrabold text-xl text-navy">Report not yet available</h1>
        <p className="text-sm text-text-muted mt-2">
          Your report will appear here — and we&rsquo;ll email you — once the Secretariat releases it.
        </p>
      </div>
    );
  }

  const [summary, breakdown, report, sectors] = await Promise.all([
    getScoreSummary(application.id),
    getCriterionBreakdown(application.id),
    getReportForApplication(application.id),
    getSectors(),
  ]);
  const sectorName = sectors.find((s) => s.id === application.sectorId)?.name ?? "";

  return (
    <div>
      <div className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-8">
        <span className="font-heading font-bold text-navy text-[15px]">Your report</span>
        {application.isSectorWinner && <Badge tone="winner">SECTOR FINALIST</Badge>}
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8 sm:py-10 flex flex-col lg:flex-row gap-10">
        <div className="flex-1">
          <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-navy mb-1.5">
            Your final score: {summary.averageScore} / 100
          </h1>
          <p className="text-[13px] text-text-muted mb-6">
            {sectorName} Sector · {summary.jurorsScored} of {summary.jurorsAssigned} jurors completed scoring
          </p>

          <div className="flex flex-col gap-4">
            {breakdown.map((row) => (
              <div key={row.criterionId}>
                <div className="flex justify-between text-[13px] mb-1.5">
                  <span>{row.name}</span>
                  <span className="font-bold">
                    {row.averagePoints}/{row.maxPoints}
                  </span>
                </div>
                <ProgressBar percent={(row.averagePoints / row.maxPoints) * 100} />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:w-96 flex-shrink-0">
          <div className="bg-bg rounded-2xl p-6">
            <div className="font-bold text-sm text-navy mb-3">Assessment summary</div>
            <p className="text-[13px] leading-relaxed text-[#3A3F4B]">{report?.narrative}</p>
            {report && report.strengths.length > 0 && (
              <>
                <div className="font-bold text-xs text-success mt-4 mb-1.5">STRENGTHS</div>
                <ul className="list-disc pl-[18px] text-[13px] leading-relaxed text-[#3A3F4B]">
                  {report.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {report && report.improvements.length > 0 && (
              <>
                <div className="font-bold text-xs text-warning mt-4 mb-1.5">AREAS TO IMPROVE</div>
                <ul className="list-disc pl-[18px] text-[13px] leading-relaxed text-[#3A3F4B]">
                  {report.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <button
            disabled
            title="PDF export isn't wired up in this mock-data phase"
            className="w-full mt-4 bg-navy text-white rounded-xl py-3.5 text-sm font-semibold opacity-60 cursor-not-allowed"
          >
            Download full report (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}
