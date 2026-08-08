import Link from "next/link";
import { getReportQueue } from "@/lib/data/reports";
import { Badge } from "@/components/ui/Badge";

const STATUS_TONE = {
  not_generated: "neutral",
  pending_approval: "review",
  approved: "success",
  sent_back: "error",
} as const;

export default async function AIReportQueuePage() {
  const rows = await getReportQueue();

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Applicant Reports</h1>
      </div>
      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_90px] bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]">
            <div>ORGANIZATION</div>
            <div>REPORT TYPE</div>
            <div>STATUS</div>
            <div />
          </div>
          {rows.map((row) => (
            <div key={row.applicationId} className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_90px] gap-1 sm:gap-0 px-4.5 py-3.5 border-t border-border items-center text-[13px]">
              <div className="font-semibold sm:font-normal">{row.organizationName}</div>
              <div className="text-text-muted">{row.variant === "shortlisted" ? "Verified Score report" : "Stage 1 feedback summary"}</div>
              <div>
                <Badge tone={STATUS_TONE[row.status]}>{row.status.replace("_", " ").toUpperCase()}</Badge>
              </div>
              <div>
                <Link href={`/secretariat/ai-reports/${row.applicationId}`} className="text-info text-xs">
                  Review
                </Link>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="px-5 py-8 text-sm text-text-muted text-center">No applications ready for a report yet.</div>}
        </div>
      </div>
    </div>
  );
}
