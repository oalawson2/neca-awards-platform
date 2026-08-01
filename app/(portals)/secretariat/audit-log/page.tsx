import { getAuditLog } from "@/lib/data/audit";
import { SearchBox } from "@/components/secretariat/SearchBox";
import { formatDateTime } from "@/lib/utils";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const entries = await getAuditLog();
  const filtered = q
    ? entries.filter((e) =>
        [e.actorName, e.action, e.target].some((field) => field.toLowerCase().includes(q.toLowerCase()))
      )
    : entries;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border flex items-center justify-between px-6 sm:px-7 py-4 sm:py-0 sm:h-17 flex-shrink-0 gap-3 flex-wrap">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Audit Log</h1>
        <SearchBox placeholder="Search…" />
      </div>

      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[170px_1fr_1.4fr_1fr] bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]">
            <div>TIMESTAMP</div>
            <div>ACTOR</div>
            <div>ACTION</div>
            <div>TARGET</div>
          </div>
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-1 sm:grid-cols-[170px_1fr_1.4fr_1fr] gap-0.5 sm:gap-0 px-4.5 py-3.5 border-t border-border items-center text-[13px]"
            >
              <div className="text-text-muted">{formatDateTime(entry.timestamp)}</div>
              <div className="font-semibold sm:font-normal">{entry.actorName}</div>
              <div>{entry.action}</div>
              <div>{entry.target}</div>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-5 py-8 text-sm text-text-muted text-center">No matching entries.</div>}
        </div>
      </div>
    </div>
  );
}
