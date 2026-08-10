"use client";

import { useMemo, useState, useTransition } from "react";
import { Select, Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { setShortlistConfig, applyShortlist } from "@/lib/actions/shortlisting";
import type { ShortlistCategory } from "@/lib/data/shortlisting";
import { ORG_SIZE_LABELS } from "@/types/domain";
import type { ShortlistMode } from "@/types/domain";

/** Same derivation as getShortlistCategories's cutoffCount, run client-side against the in-progress (possibly unsaved) mode/value so the preview updates as you type, not just after Save. */
function previewCutoffCount(mode: ShortlistMode, value: number, rankedCount: number, sortedScores: number[]): number | null {
  if (!value || value <= 0) return null;
  if (mode === "count") return value;
  if (mode === "percentage") return Math.max(1, Math.ceil((value / 100) * rankedCount));
  if (mode === "minimum_score") return sortedScores.filter((s) => s >= value).length;
  return null;
}

export function ShortlistCategoryCard({ category }: { category: ShortlistCategory }) {
  const [mode, setMode] = useState<ShortlistMode>(category.config?.mode ?? "count");
  const [value, setValue] = useState(category.config?.value ?? 0);
  const [isPending, startTransition] = useTransition();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sortedScores = useMemo(() => category.ranked.map((a) => a.stage1Score ?? 0), [category.ranked]);
  const preview = previewCutoffCount(mode, value, category.ranked.length, sortedScores);

  function saveConfig() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setShortlistConfig(category.sectorId, category.sizeTier, mode, value);
      if (!result.success) setError(result.error ?? "Could not save.");
      else setMessage("Cutoff configuration saved. No applicant's status has changed — click Apply Shortlist when you're ready to act on it.");
    });
  }

  function apply() {
    setError(null);
    setMessage(null);
    setApplying(true);
    startTransition(async () => {
      const result = await applyShortlist(category.sectorId, category.sizeTier);
      setApplying(false);
      if (!result.success) setError(result.error ?? "Could not apply shortlist.");
      else setMessage("Shortlist applied — every application in this category now has a shortlisted/not-shortlisted status.");
    });
  }

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
        <div>
          <div className="font-bold text-sm text-navy-dark">
            {category.sectorName} <span className="font-normal text-text-muted">— {ORG_SIZE_LABELS[category.sizeTier]}</span>
          </div>
          <div className="text-xs text-text-muted">{category.ranked.length} submitted applications</div>
        </div>
        <div className="flex items-end gap-2.5">
          <div>
            <Label className="text-[11px]">Cutoff type</Label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as ShortlistMode)} className="text-xs py-2 w-40">
              <option value="count">Top N applicants</option>
              <option value="percentage">Top N% (by rank)</option>
              <option value="minimum_score">Minimum score %</option>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">{mode === "count" ? "Count" : "Percent"}</Label>
            <Input
              type="number"
              min={1}
              max={mode === "count" ? undefined : 100}
              value={value || ""}
              onChange={(e) => setValue(Number(e.target.value))}
              className="text-xs py-2 w-20"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={saveConfig} loading={isPending && !applying}>
            Save
          </Button>
          <Button size="sm" onClick={apply} disabled={category.cutoffCount === null} loading={isPending && applying}>
            Apply shortlist
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-text-muted -mt-2 mb-3.5 leading-relaxed">
        <strong className="text-text">Save</strong> only stores this cutoff — it never changes any applicant&rsquo;s status or this list.{" "}
        <strong className="text-text">Apply shortlist</strong> is the real action: it computes shortlisted/not-shortlisted for every
        application below, right away. Results still aren&rsquo;t visible to applicants until Secretariat separately closes
        applications (Settings).
      </p>

      {error && <div className="text-xs text-error mb-3">{error}</div>}
      {message && <div className="text-xs text-success mb-3">{message}</div>}

      {preview !== null && (
        <div className="text-xs text-info bg-[#EEF2FF] rounded-xl px-3.5 py-2.5 mb-3.5">
          At this configuration, <strong>{Math.min(preview, category.ranked.length)} of {category.ranked.length}</strong> applicants would be
          shortlisted.
          {category.config && (category.config.mode !== mode || category.config.value !== value) && " (Not yet saved.)"}
        </div>
      )}
      {category.cutoffCount !== null && (
        <div className="text-xs text-text-muted mb-3">Saved cutoff: top {category.cutoffCount} advance to Stage 2.</div>
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
