"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { confirmSectorWinner } from "@/lib/actions/winners";
import type { SectorWinnerGroup } from "@/lib/data/winners";

export function SectorWinnerPicker({ group }: { group: SectorWinnerGroup }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="font-bold text-sm text-navy-dark mb-3">{group.sectorName}</div>
      <div className="flex flex-col gap-2">
        {group.scored.map((row, idx) => (
          <div key={row.applicationId} className="flex items-center justify-between text-[13px] px-3.5 py-2.5 rounded-xl bg-bg">
            <div className="flex items-center gap-3">
              <span className="w-5 text-text-muted font-mono text-xs">#{idx + 1}</span>
              <span className="font-semibold">{row.organizationName}</span>
              <span className="font-bold">{row.verifiedScore}%</span>
            </div>
            {row.isSectorWinner ? (
              <span className="text-xs font-bold text-success">✓ Sectoral winner</span>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() => startTransition(async () => { await confirmSectorWinner(row.applicationId); })}
              >
                Confirm as winner
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
