"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Field";
import { assignSectorToPanel, unassignSectorFromPanel } from "@/lib/actions/panels";
import type { Sector } from "@/types/domain";

export function PanelSectorAssignment({
  panelId,
  assignedSectorIds,
  unassignedSectors,
  allSectors,
}: {
  panelId: string;
  assignedSectorIds: string[];
  unassignedSectors: Sector[];
  allSectors: Sector[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState(unassignedSectors[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function nameFor(id: string) {
    return allSectors.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {assignedSectorIds.length === 0 && <span className="text-xs text-text-muted">No sectors assigned yet.</span>}
        {assignedSectorIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5 bg-[#EDEEFB] text-navy text-xs font-semibold px-2.5 py-1.5 rounded-full">
            {nameFor(id)}
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await unassignSectorFromPanel(panelId, id);
                })
              }
              className="text-navy/60 hover:text-navy"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      {unassignedSectors.length > 0 && (
        <div className="flex gap-2 items-center">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="text-xs py-2 w-48">
            {unassignedSectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <button
            disabled={isPending || !selected}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await assignSectorToPanel(panelId, selected);
                if (!result.success) setError(result.error ?? "Could not assign sector.");
              })
            }
            className="text-xs font-semibold text-info"
          >
            + Add
          </button>
        </div>
      )}
      {error && <div className="text-xs text-error mt-1.5">{error}</div>}
    </div>
  );
}
