import { getSectors, getCriteria } from "@/lib/data/sectors-criteria";
import { CriteriaEditor } from "@/components/secretariat/CriteriaEditor";
import { AddSectorControl } from "@/components/secretariat/AddSectorControl";

export default async function CriteriaPage() {
  const [sectors, criteria] = await Promise.all([getSectors(), getCriteria()]);

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Sectors &amp; Criteria</h1>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 p-6 sm:p-9 overflow-y-auto">
          <h2 className="font-heading font-extrabold text-lg text-navy-dark mb-1">Judging criteria — universal, applies to all sectors</h2>
          <p className="text-[13px] text-text-muted mb-5">
            Weights must total 100 points. Placeholder criteria — replace with NECA&rsquo;s finalized set. Sector has
            no effect on scoring.
          </p>
          <CriteriaEditor criteria={criteria} />
        </div>

        <div className="lg:w-75 border-t lg:border-t-0 lg:border-l border-border p-6 sm:p-7 overflow-y-auto flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs font-bold text-[#AEB1BC]">SECTORS ({sectors.length})</div>
            <AddSectorControl />
          </div>
          <div className="flex flex-col gap-1.5 text-[13px]">
            {sectors.map((s) => (
              <div key={s.id} className="px-3 py-2.5 rounded-[10px] bg-bg">
                {s.name}
              </div>
            ))}
          </div>
          <p className="text-xs text-[#AEB1BC] mt-4 leading-relaxed">
            Sectors are labels only — they group applicants for reporting and juror assignment, and don&rsquo;t
            change how scoring works.
          </p>
        </div>
      </div>
    </div>
  );
}
