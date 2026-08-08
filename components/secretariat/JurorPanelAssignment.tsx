"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Field";
import { assignJurorToPanel, removeJurorFromPanel } from "@/lib/actions/panels";
import type { PlatformUser } from "@/types/domain";

/** panel_memberships is unique on juror_id, so "unassigned jurors" is simply every juror not yet in any panel's jurorIds. */
export function JurorPanelAssignment({
  panelId,
  assignedJurorIds,
  assignedJurorNames,
  unassignedJurors,
}: {
  panelId: string;
  assignedJurorIds: string[];
  assignedJurorNames: string[];
  unassignedJurors: PlatformUser[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState(unassignedJurors[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3">
      <div className="text-xs font-bold text-[#AEB1BC] mb-2">JURORS</div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {assignedJurorIds.length === 0 && <span className="text-xs text-text-muted">No jurors assigned yet.</span>}
        {assignedJurorIds.map((id, i) => (
          <span key={id} className="inline-flex items-center gap-1.5 bg-[#EFE6FB] text-[#5E3B9A] text-xs font-semibold px-2.5 py-1.5 rounded-full">
            {assignedJurorNames[i]}
            <button
              disabled={isPending}
              onClick={() => startTransition(async () => { await removeJurorFromPanel(id); })}
              className="text-[#5E3B9A]/60 hover:text-[#5E3B9A]"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      {unassignedJurors.length > 0 && (
        <div className="flex gap-2 items-center">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="text-xs py-2 w-48">
            {unassignedJurors.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </Select>
          <button
            disabled={isPending || !selected}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await assignJurorToPanel(panelId, selected);
                if (!result.success) setError(result.error ?? "Could not assign juror.");
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
