import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { getShortlistedReport, getNonShortlistedReport } from "@/lib/data/reports";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";

export default async function ApplicantReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) redirect("/login");

  /**
   * Gated on the report row's own release state, not application.status —
   * matches the real schema exactly (task #54): applicants have no RLS
   * read access to juror_scores at all, so the only thing that can ever
   * make a report visible to them is application_reports.released_at
   * being set. There's no separate "released" application status.
   */
  const notReleased = (
    <div className="max-w-lg mx-auto px-6 py-16 text-center">
      <h1 className="font-heading font-extrabold text-xl text-navy">Report not yet available</h1>
      <p className="text-sm text-text-muted mt-2">
        Your report will appear here — and we&rsquo;ll email you — once the Secretariat releases it.
      </p>
    </div>
  );

  if (application.isShortlisted) {
    const report = await getShortlistedReport(application.id);
    if (!report) return notReleased;
    if (report.status !== "approved") return notReleased;
    return (
      <div>
        <div className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-8">
          <span className="font-heading font-bold text-navy text-[15px]">Your report</span>
          {application.isSectorWinner && <Badge tone="winner">SECTOR FINALIST</Badge>}
        </div>
        <div className="max-w-5xl mx-auto px-6 sm:px-8 py-8 sm:py-10 flex flex-col lg:flex-row gap-10">
          <div className="flex-1">
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-navy mb-1.5">Your Verified Score: {report.verifiedScore}%</h1>
            <p className="text-[13px] text-text-muted mb-6">Scored across all 8 pillars of the Assessment Framework by your sector&rsquo;s jury panel.</p>
            <div className="flex flex-col gap-4">
              {report.pillarBreakdown.map((row) => (
                <div key={row.pillarCode}>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span>{row.pillarCode}</span>
                    <span className="font-bold">{row.contributionPercent}%</span>
                  </div>
                  <ProgressBar percent={(row.panelPillarScore / 5) * 100} />
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-96 flex-shrink-0">
            <div className="bg-bg rounded-2xl p-6">
              <div className="font-bold text-sm text-navy mb-3">Assessment summary</div>
              <p className="text-[13px] leading-relaxed text-[#3A3F4B]">{report.narrative}</p>
              {report.strengths.length > 0 && (
                <>
                  <div className="font-bold text-xs text-success mt-4 mb-1.5">STRENGTHS</div>
                  <ul className="list-disc pl-[18px] text-[13px] leading-relaxed text-[#3A3F4B]">
                    {report.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {report.improvements.length > 0 && (
                <>
                  <div className="font-bold text-xs text-warning mt-4 mb-1.5">AREAS TO IMPROVE</div>
                  <ul className="list-disc pl-[18px] text-[13px] leading-relaxed text-[#3A3F4B]">
                    {report.improvements.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const report = await getNonShortlistedReport(application.id);
  if (!report) return notReleased;
  if (report.status !== "approved") return notReleased;
  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-navy mb-1.5">Your feedback summary</h1>
      <p className="text-[13px] text-text-muted mb-6">
        Based on your self-assessment. We hope this is useful as you continue strengthening these practices ahead of
        a future cycle.
      </p>
      <div className="flex flex-col gap-4">
        {report.pillarSummary.map((p) => (
          <div key={p.pillarCode} className="border border-border rounded-2xl p-5">
            <div className="font-bold text-sm mb-2">{p.pillarCode}</div>
            {p.strengths.map((s) => (
              <div key={s} className="text-[13px] text-success mb-1">
                ✓ {s}
              </div>
            ))}
            {p.gaps.map((g) => (
              <div key={g} className="text-[13px] text-warning mb-1">
                ⚠ {g}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
