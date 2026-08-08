import { getSectors, getSectorCategories } from "@/lib/data/sectors";
import { PILLARS, itemsForPillar } from "@/lib/mock/framework";
import { AddSectorControl } from "@/components/secretariat/AddSectorControl";
import { DeactivateSectorButton } from "@/components/secretariat/DeactivateSectorButton";
import { Badge } from "@/components/ui/Badge";

/**
 * Read-only view of the 2026 Assessment Framework (pillars, weights, items,
 * tracks) — this replaces the old universal-criteria editor, since scoring
 * criteria are now fixed by NECA's framework document rather than
 * Secretariat-editable. Sector management (the one part of this page that
 * IS Secretariat-owned — see task #24's data model) is unchanged.
 */
export default async function AssessmentFrameworkPage() {
  const [sectors, categories] = await Promise.all([getSectors(true), getSectorCategories()]);
  const scoredPillars = PILLARS.filter((p) => p.scored);

  const byCategory = new Map<string, typeof sectors>();
  for (const sector of sectors) {
    const list = byCategory.get(sector.categoryName) ?? [];
    list.push(sector);
    byCategory.set(sector.categoryName, list);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Sectors &amp; Assessment Framework</h1>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 p-6 sm:p-9 overflow-y-auto">
          <h2 className="font-heading font-extrabold text-lg text-navy-dark mb-1">2026 Assessment Framework — fixed by NECA</h2>
          <p className="text-[13px] text-text-muted mb-5">
            8 scored pillars (Section A is eligibility-only, not scored). Weights and items come from NECA&rsquo;s
            Assessment Framework document and aren&rsquo;t Secretariat-editable here.
          </p>
          <div className="flex flex-col gap-3.5">
            {scoredPillars.map((pillar) => {
              const items = itemsForPillar(pillar.code);
              const mandatoryCount = items.filter((i) => i.track === "mandatory").length;
              return (
                <details key={pillar.code} className="border border-border rounded-2xl px-5 py-4">
                  <summary className="cursor-pointer flex items-center justify-between gap-3 font-semibold text-sm">
                    <span>
                      {pillar.code} — {pillar.name}
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <Badge tone="info">{pillar.weightPoints}%</Badge>
                      <span className="text-xs text-text-muted font-normal">
                        {items.length} items · {mandatoryCount} mandatory
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3.5 flex flex-col gap-2">
                    {items.map((item) => (
                      <div key={item.id} className="text-[13px] border-t border-border pt-2.5 flex justify-between gap-3">
                        <span>
                          <strong className="text-navy-dark">{item.id}</strong> — {item.prompt}
                        </span>
                        <span className="flex-shrink-0 text-xs text-text-muted uppercase">{item.track}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        <div className="lg:w-75 border-t lg:border-t-0 lg:border-l border-border p-6 sm:p-7 overflow-y-auto flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs font-bold text-[#AEB1BC]">SECTORS ({sectors.filter((s) => s.isActive).length} active)</div>
            <AddSectorControl categories={categories} />
          </div>
          <div className="flex flex-col gap-3 text-[13px]">
            {[...byCategory.entries()].map(([categoryName, categorySectors]) => (
              <details key={categoryName} className="group">
                <summary className="cursor-pointer text-xs font-bold text-navy-dark mb-1.5">
                  {categoryName} ({categorySectors.length})
                </summary>
                <div className="flex flex-col gap-1.5 mt-1.5">
                  {categorySectors.map((s) => (
                    <div key={s.id} className="px-3 py-2.5 rounded-[10px] bg-bg flex items-center justify-between gap-2">
                      <span className={s.isActive ? undefined : "text-text-muted line-through"}>{s.name}</span>
                      <DeactivateSectorButton sectorId={s.id} isActive={s.isActive} />
                    </div>
                  ))}
                </div>
              </details>
            ))}
            {sectors.length === 0 && (
              <div className="text-xs text-text-muted">No sectors configured yet.</div>
            )}
          </div>
          <p className="text-xs text-[#AEB1BC] mt-4 leading-relaxed">
            Sectors group applicants for jury panel assignment, benchmark bands and shortlisting categories.
          </p>
        </div>
      </div>
    </div>
  );
}
