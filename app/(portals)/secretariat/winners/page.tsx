import Link from "next/link";
import { getEmployerOfYearShortlist, getSectorWinnerCount } from "@/lib/data/winners";
import { getSectors } from "@/lib/data/sectors-criteria";
import { Badge } from "@/components/ui/Badge";
import { ConfirmWinnerButton } from "@/components/secretariat/ConfirmWinnerButton";
import { cn } from "@/lib/utils";

export default async function WinnersPage() {
  const [shortlist, winnerCount, sectors] = await Promise.all([
    getEmployerOfYearShortlist(),
    getSectorWinnerCount(),
    getSectors(),
  ]);

  const currentWinner = shortlist.find((s) => s.isEmployerOfYear);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border flex items-center justify-between px-6 sm:px-7 py-4 sm:py-0 sm:h-17 flex-shrink-0 gap-3 flex-wrap">
        <h1 className="font-heading font-extrabold text-lg sm:text-[19px] text-navy-dark">Employer of the Year — Shortlist</h1>
        <Badge tone="info">
          {winnerCount.decided} of {winnerCount.total} sectors decided
        </Badge>
      </div>

      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        <div className="flex flex-col gap-3">
          {shortlist.map((entry, i) => (
            <div
              key={entry.id}
              className={cn(
                "border rounded-2xl px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-4 sm:gap-5",
                i === 0 ? "border-[1.5px] border-[#F3D48A] bg-[#FFFBF0]" : "border-border"
              )}
            >
              <div className={cn("font-heading font-extrabold text-xl sm:text-2xl", i === 0 ? "text-gold" : "text-[#AEB1BC]")}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm sm:text-[15px] truncate">{entry.organization.name}</div>
                <div className="text-xs text-text-muted">
                  {sectors.find((s) => s.id === entry.sectorId)?.name} — Sector Winner
                </div>
              </div>
              <div className="font-heading font-extrabold text-lg sm:text-xl text-navy">{entry.finalScore}</div>
              <Link
                href={`/secretariat/applications/${entry.id}?tab=scores`}
                className={cn(
                  "hidden sm:inline-block text-[13px] font-semibold rounded-[10px] px-4 py-2",
                  i === 0 ? "bg-navy text-white" : "bg-white text-navy border-[1.5px] border-navy"
                )}
              >
                View report
              </Link>
            </div>
          ))}
          {shortlist.length === 0 && (
            <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
              No sector winners have been decided yet.
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          {currentWinner ? (
            <span className="text-sm font-semibold text-success">
              ✓ {currentWinner.organization.name} confirmed as Employer of the Year
            </span>
          ) : (
            shortlist[0] && <ConfirmWinnerButton applicationId={shortlist[0].id} />
          )}
        </div>
      </div>
    </div>
  );
}
