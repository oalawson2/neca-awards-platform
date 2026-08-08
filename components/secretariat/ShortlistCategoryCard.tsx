"use client";

import { useState, useTransition } from "react";
import { Select, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { setShortlistConfig, applyShortlist } from "@/lib/actions/shortlisting";
import type { ShortlistCategory } from "@/lib/data/shortlisting";
import type { ShortlistMode } from "@/types/domain";

export function ShortlistCategoryCard({ category }: { category: ShortlistCategory }) {
  const [mode, setMode] = useState<ShortlistMode>(category.config?.mode ?? "count");
  const [value, setValue] = useState(category.config?.value ?? 0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function saveConfig() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setShortlistConfig(category.sectorId, mode, value);
      if (!result.success) setError(result.error ?? "Could not save.");
      else setMessage("Saved.");
    });
  }

  function apply() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await applyShortlist(category.sectorId);
      if (!result.success) setError(result.error ?? "Could not apply shortlist.");
      else setMessage("Shortlist applied.");
    });
  }

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <div className="font-bold text-sm text-navy-dark">{category.sectorName}</div>
          <div className="text-xs text-text-muted">{category.ranked.length} submitted applications</div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mode} onChange={(e) => setMode(e.target.value as ShortlistMode)} className="text-xs py-2 w-32">
            <option value="count">Top N</option>
            <option value="percentage">Top N%</option>
          </Select>
          <Input
            type="number"
            min={1}
            value={value || ""}
            onChange={(e) => setValue(Number(e.target.value))}
            className="text-xs py-2 w-20"
          />
          <Button size="sm" variant="secondary" onClick={saveConfig} disabled={isPending}>
            Save
          </Button>
          <Button size="sm" onClick={apply} disabled={isPending || category.cutoffCount === null}>
            Apply shortlist
          </Button>
        </div>
      </div>

      {error && <div className="text-xs text-error mb-3">{error}</div>}
      {message && <div className="text-xs text-success mb-3">{message}</div>}
      {category.cutoffCount !== null && (
        <div className="text-xs text-text-muted mb-3">Cutoff: top {category.cutoffCount} advance to Stage 2.</div>
      )}

      <div className="flex flex-col gap-1.5">
        {category.ranked.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between text-[13px] px-3.5 py-2.5 rounded-xl bg-bg"
          >
            <div className="flex items-center gap-3">
              <span className="w-5 text-text-muted font-mono text-xs">#{app.rank}</span>
              <span className="font-semibold">{app.organization.name || "(unnamed)"}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold">{app.stage1Score}%</span>
              <StatusBadge status={app.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
