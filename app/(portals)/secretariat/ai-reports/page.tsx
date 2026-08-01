import Link from "next/link";
import { getAIReportQueue } from "@/lib/data/reports";
import { getApplication, getScoreSummary } from "@/lib/data/applications";
import { getSectors } from "@/lib/data/sectors-criteria";
import { formatDate } from "@/lib/utils";

export default async function AIReportQueuePage() {
  const [reports, sectors] = await Promise.all([getAIReportQueue(), getSectors()]);

  const rows = await Promise.all(
    reports.map(async (report) => {
      const application = await getApplication(report.applicationId);
      const summary = await getScoreSummary(report.applicationId);
      return { report, application, summary };
    })
  );

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Reports Pending Approval</h1>
      </div>

      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_110px] bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]">
            <div>ORGANIZATION</div>
            <div>SECTOR</div>
            <div>FINAL SCORE</div>
            <div>DRAFTED</div>
            <div />
          </div>
          {rows.map(({ report, application, summary }) =>
            application ? (
              <div
                key={report.id}
                className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_110px] gap-1 sm:gap-0 px-4.5 py-3.5 border-t border-border items-center text-[13px]"
              >
                <div className="font-semibold sm:font-normal">{application.organization.name}</div>
                <div className="text-text-muted">{sectors.find((s) => s.id === application.sectorId)?.name}</div>
                <div className="font-bold">{summary.averageScore}</div>
                <div className="text-text-muted">{formatDate(report.createdAt)}</div>
                <div>
                  <Link href={`/secretariat/ai-reports/${report.id}`} className="text-info font-semibold text-xs">
                    Review →
                  </Link>
                </div>
              </div>
            ) : null
          )}
          {rows.length === 0 && (
            <div className="px-5 py-8 text-sm text-text-muted text-center">No reports pending approval.</div>
          )}
        </div>
        <div className="mt-4 text-xs text-text-muted">
          {rows.length} report{rows.length === 1 ? "" : "s"} awaiting review · none will release to applicants until
          approved here.
        </div>
      </div>
    </div>
  );
}
