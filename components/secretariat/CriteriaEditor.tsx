"use client";

import { useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { updateCriterionWeight } from "@/lib/actions/sectors-criteria";
import type { Criterion } from "@/types/domain";

export function CriteriaEditor({ criteria }: { criteria: Criterion[] }) {
  const [weights, setWeights] = useState(Object.fromEntries(criteria.map((c) => [c.id, c.weightPoints])));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const total = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights]);

  function save() {
    setSaved(false);
    startTransition(async () => {
      await Promise.all(
        criteria
          .filter((c) => weights[c.id] !== c.weightPoints)
          .map((c) => updateCriterionWeight(c.id, weights[c.id]))
      );
      setSaved(true);
    });
  }

  return (
    <div>
      <div className="border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_90px] bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]">
          <div>CRITERION</div>
          <div>WEIGHT</div>
          <div />
        </div>
        {criteria.map((c) => (
          <div key={c.id} className="grid grid-cols-[2fr_1fr_90px] px-4.5 py-3.5 border-t border-border items-center text-[13px]">
            <div>{c.name}</div>
            <div>
              <Input
                type="number"
                className="w-16 inline-block px-2 py-1.5"
                value={weights[c.id]}
                onChange={(e) => setWeights((w) => ({ ...w, [c.id]: Number(e.target.value) }))}
              />{" "}
              pts
            </div>
            <div />
          </div>
        ))}
      </div>
      <div className="mt-4.5 flex justify-between items-center">
        <div className={cn("text-[13px] font-bold", total === 100 ? "text-success" : "text-error")}>
          Total: {total} pts {total === 100 ? "✓" : "— must equal 100"}
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-success">Saved</span>}
          <Button size="sm" onClick={save} disabled={isPending || total !== 100}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
