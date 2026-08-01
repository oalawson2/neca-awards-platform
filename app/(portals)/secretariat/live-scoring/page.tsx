import { getApplications, getScoreSummary } from "@/lib/data/applications";
import { getSectors } from "@/lib/data/sectors-criteria";
import { getJurorsForSector } from "@/lib/data/users";
import { getJurorScorecard } from "@/lib/data/scoring";
import { Badge } from "@/components/ui/Badge";
import { CloseScoringButton } from "@/components/secretariat/CloseScoringButton";
import { SectorSelect } from "@/components/secretariat/SectorSelect";

export default async function LiveScoringPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string }>;
}) {
  const { sector: sectorParam } = await searchParams;
  const sectors = await getSectors();
  const sector = sectors.find((s) => s.id === sectorParam) ?? sectors[0];

  const [jurors, applications] = await Promise.all([
    getJurorsForSector(sector.id),
    getApplications({ sectorId: sector.id }),
  ]);
  const scoringApps = applications.filter((a) => a.status === "scoring" || a.status === "scored");

  const rows = await Promise.all(
    scoringApps.map(async (app) => {
      const summary = await getScoreSummary(app.id);
      const perJuror = await Promise.all(
        jurors.map(async (j) => {
          const sc = await getJurorScorecard(app.id, j.id);
          return { jurorId: j.id, score: sc?.status === "submitted" ? sc.totalScore : null };
        })
      );
      return { app, summary, perJuror };
    })
  );

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border flex items-center justify-between px-6 sm:px-7 py-4 sm:py-0 sm:h-17 flex-shrink-0 gap-3 flex-wrap">
        <div>
          <div className="font-heading font-extrabold text-lg sm:text-[19px] text-navy-dark">
            Live Scoring — {sector.name} Sector
          </div>
          <div className="text-xs text-success flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Live · updates as jurors submit
          </div>
        </div>
        <SectorSelect sectors={sectors} selectedSectorId={sector.id} />
      </div>

      <div className="p-6 sm:p-7 overflow-auto flex-1">
        <div className="border border-border rounded-2xl overflow-x-auto">
          <div className="min-w-[600px]">
            <div
              className="grid bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]"
              style={{ gridTemplateColumns: `2fr repeat(${jurors.length}, 1fr) 1fr 1.2fr` }}
            >
              <div>ORGANIZATION</div>
              {jurors.map((j) => (
                <div key={j.id}>{j.name.split(" ")[0].toUpperCase()}</div>
              ))}
              <div>AVERAGE</div>
              <div>STATUS</div>
            </div>
            {rows.length === 0 && <div className="px-5 py-8 text-sm text-text-muted text-center">No applications in scoring for this sector.</div>}
            {rows.map(({ app, summary, perJuror }) => (
              <div
                key={app.id}
                className="grid px-4.5 py-3.5 border-t border-border items-center text-[13px]"
                style={{ gridTemplateColumns: `2fr repeat(${jurors.length}, 1fr) 1fr 1.2fr` }}
              >
                <div>{app.organization.name}</div>
                {perJuror.map((pj) => (
                  <div key={pj.jurorId}>{pj.score ?? "—"}</div>
                ))}
                <div className={summary.isComplete ? "font-bold" : "font-bold text-[#AEB1BC]"}>
                  {summary.isComplete ? summary.averageScore : "— pending"}
                </div>
                <div>
                  <Badge tone={summary.isComplete ? "success" : summary.jurorsScored === 0 ? "error" : "review"}>
                    {summary.jurorsScored} of {summary.jurorsAssigned} scored
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4.5 flex justify-between items-center flex-wrap gap-3">
          <div className="text-xs text-text-muted">
            🔒 Individual juror scores stay hidden from jurors and applicants until the window closes.
          </div>
          <CloseScoringButton sectorId={sector.id} sectorName={sector.name} />
        </div>
      </div>
    </div>
  );
}
