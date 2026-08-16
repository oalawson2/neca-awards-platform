"use client";

import { useState, useTransition } from "react";
import { Input, Label, Select } from "@/components/ui/Field";
import { Button, Spinner } from "@/components/ui/Button";
import { createAvailabilitySlot, deleteAvailabilitySlot } from "@/lib/actions/interviewSlots";
import type { AvailabilitySlot } from "@/types/domain";

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

/**
 * datetime-local gives a naive wall-clock string with no timezone info.
 * Every other time display in this app assumes the Secretariat is
 * entering/reading times in Africa/Lagos (WAT, a fixed UTC+1 — Nigeria
 * doesn't observe DST), so that offset is applied explicitly here rather
 * than trusting whatever timezone the server or browser happens to run
 * in.
 */
function localInputToUtcIso(value: string): string {
  return new Date(`${value}:00+01:00`).toISOString();
}

function formatWAT(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
}

export function InterviewSlotsPanel({ panelId, panelName, slots }: { panelId: string; panelName: string; slots: AvailabilitySlot[] }) {
  const [isPending, startTransition] = useTransition();
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState(60);
  const [format, setFormat] = useState<"virtual" | "physical">("virtual");
  const [error, setError] = useState<string | null>(null);
  const [localSlots, setLocalSlots] = useState(slots);

  function addSlot() {
    if (!when) return;
    setError(null);
    startTransition(async () => {
      const result = await createAvailabilitySlot(panelId, localInputToUtcIso(when), duration, format);
      if (!result.success) {
        setError(result.error ?? "Could not create the slot.");
        return;
      }
      setWhen("");
      // Server data will catch up on next navigation/refresh — this is
      // just so the just-added slot doesn't appear to vanish immediately.
      setLocalSlots((prev) =>
        [...prev, { id: `pending-${Date.now()}`, panelId, startsAt: localInputToUtcIso(when), durationMinutes: duration, format, interviewId: null, bookedAt: null }].sort(
          (a, b) => a.startsAt.localeCompare(b.startsAt)
        )
      );
    });
  }

  function removeSlot(slotId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteAvailabilitySlot(slotId);
      if (!result.success) {
        setError(result.error ?? "Could not delete the slot.");
        return;
      }
      setLocalSlots((prev) => prev.filter((s) => s.id !== slotId));
    });
  }

  return (
    <div className="border border-border rounded-2xl p-5">
      <div className="font-bold text-sm text-navy-dark mb-3.5">{panelName}</div>

      <div className="flex flex-col gap-2.5 mb-4">
        <div>
          <Label>New slot</Label>
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="flex-1">
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </Select>
          <Select value={format} onChange={(e) => setFormat(e.target.value as "virtual" | "physical")} className="flex-1">
            <option value="virtual">Virtual</option>
            <option value="physical">Physical</option>
          </Select>
        </div>
        <Button size="sm" disabled={!when || isPending} loading={isPending} onClick={addSlot}>
          + Add slot
        </Button>
        {error && <div className="text-xs text-error">{error}</div>}
      </div>

      <div className="text-xs font-bold text-[#AEB1BC] mb-2">SLOTS</div>
      {localSlots.length === 0 ? (
        <div className="text-xs text-text-muted">No slots published yet.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {localSlots.map((slot) => (
            <div key={slot.id} className="flex items-center justify-between gap-2 text-[13px] border border-border rounded-xl px-3 py-2">
              <div>
                <div className="font-semibold">{formatWAT(slot.startsAt)}</div>
                <div className="text-xs text-text-muted">
                  {slot.durationMinutes} min · {slot.format === "physical" ? "In person" : "Virtual"}
                </div>
              </div>
              {slot.interviewId ? (
                <span className="text-xs font-semibold text-success flex-shrink-0">Booked</span>
              ) : (
                <button
                  onClick={() => removeSlot(slot.id)}
                  disabled={isPending}
                  className="text-xs text-error flex-shrink-0 inline-flex items-center gap-1"
                >
                  {isPending ? <Spinner className="w-3 h-3" /> : "Remove"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
