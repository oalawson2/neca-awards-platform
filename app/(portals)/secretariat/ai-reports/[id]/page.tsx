import Link from "next/link";
import { notFound } from "next/navigation";
import { getAIReport } from "@/lib/data/reports";
import { getApplication, getScoreSummary, getCriterionBreakdown } from "@/lib/data/applications";
import { getSectors } from "@/lib/data/sectors-criteria";
import { Badge } from "@/components/ui/Badge";
import { ReportReviewForm } from "@/components/secretariat/ReportReviewForm";

export default async function AIReportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getAIReport(id);
  if (!report) notFound();

  const application = await getApplication(report.applicationId);
  if (!application) notFound();

  const [summary, breakdown, sectors] = await Promise.all([
    getScoreSummary(report.applicationId),
    getCriterionBreakdown(report.applicationId),
    getSectors(),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-7 py-5.5 border-b border-border">
        <Link href="/secretariat/ai-reports" className="text-xs text-info">
          ← Back to report queue
        </Link>
        <div className="flex justify-between items-center flex-wrap gap-2.5 mt-2">
          <div>
            <div className="font-heading font-extrabold text-lg sm:text-[19px] text-navy-dark">
              {application.organization.name} — draft report
            </div>
            <div className="text-xs text-text-muted">
              {sectors.find((s) => s.id === application.sectorId)?.name} · Final score {summary.averageScore}
            </div>
          </div>
          <Badge tone={report.status === "pending_approval" ? "review" : "success"}>
            {report.status === "pending_approval" ? "PENDING APPROVAL" : report.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        <ReportReviewForm report={report} breakdown={breakdown} />
      </div>
    </div>
  );
}
