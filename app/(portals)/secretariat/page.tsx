import Link from "next/link";
import { getApplications, getDashboardStats } from "@/lib/data/applications";
import { getSectors } from "@/lib/data/sectors";
import { StatTile } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ApplicationsFilterBar } from "@/components/secretariat/ApplicationsFilterBar";
import { formatDate } from "@/lib/utils";
import type { Application } from "@/types/domain";

export default async function SecretariatDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sector?: string; status?: string }>;
}) {
  const params = await searchParams;
  const [stats, sectors, applications] = await Promise.all([
    getDashboardStats(),
    getSectors(),
    getApplications({
      search: params.q,
      sectorId: params.sector,
      status: params.status as Application["status"] | undefined,
    }),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">All Applications</h1>
      </div>

      <div className="p-6 sm:p-7 flex flex-col gap-4 overflow-y-auto flex-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatTile label="Total applications" value={stats.total} />
          <StatTile label="Eligibility flagged" value={stats.eligibilityFlagged} tone="warning" />
          <StatTile label="In Stage 2" value={stats.inStage2} tone="info" />
          <StatTile label="Scored" value={stats.scored} tone="success" />
        </div>

        <ApplicationsFilterBar sectors={sectors} />

        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_90px] bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]">
            <div>ORGANIZATION</div>
            <div>SECTOR</div>
            <div>SUBMITTED</div>
            <div>STATUS</div>
            <div />
          </div>
          {applications.length === 0 && (
            <div className="px-5 py-8 text-sm text-text-muted text-center">No applications match these filters.</div>
          )}
          {applications.map((app) => (
            <div
              key={app.id}
              className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_90px] gap-1 sm:gap-0 px-4.5 py-3.5 border-t border-border items-center text-[13px]"
            >
              <div className="font-semibold sm:font-normal">{app.organization.name || "(unnamed organization)"}</div>
              <div className="text-text-muted">{sectors.find((s) => s.id === app.organization.sectorId)?.name}</div>
              <div className="text-text-muted">{formatDate(app.submittedAt)}</div>
              <div>
                <StatusBadge status={app.status} />
              </div>
              <div>
                <Link href={`/secretariat/applications/${app.id}`} className="text-info text-[12px]">
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
