"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { setAvailability } from "@/lib/actions/interviews";
import type { InterviewAvailabilitySlot } from "@/types/domain";

interface DraftSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export function AvailabilityGrid({ jurorId, existingSlots }: { jurorId: string; existingSlots: InterviewAvailabilitySlot[] }) {
  const unbooked = existingSlots.filter((s) => !s.booked);
  const booked = existingSlots.filter((s) => s.booked);
  const [drafts, setDrafts] = useState<DraftSlot[]>(unbooked.map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime })));
  const [newSlot, setNewSlot] = useState<DraftSlot>({ date: "", startTime: "", endTime: "" });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function addSlot() {
    if (!newSlot.date || !newSlot.startTime || !newSlot.endTime) return;
    setDrafts((prev) => [...prev, newSlot]);
    setNewSlot({ date: "", startTime: "", endTime: "" });
    setSaved(false);
  }

  function removeSlot(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await setAvailability(jurorId, drafts);
      setSaved(true);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-jury mb-1.5">Interview availability</h1>
      <p className="text-[13px] text-text-muted mb-6">
        Publish 30–45 minute slots for applicants assigned to your interviews to book.
      </p>

      <div className="border border-border rounded-2xl p-5 mb-4">
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <Input type="date" value={newSlot.date} onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))} />
          <Input type="time" value={newSlot.startTime} onChange={(e) => setNewSlot((s) => ({ ...s, startTime: e.target.value }))} />
          <Input type="time" value={newSlot.endTime} onChange={(e) => setNewSlot((s) => ({ ...s, endTime: e.target.value }))} />
        </div>
        <Button variant="secondary" size="sm" onClick={addSlot}>
          + Add slot
        </Button>
      </div>

      <div className="flex flex-col gap-2 mb-6">
        {drafts.map((slot, idx) => (
          <div key={idx} className="flex items-center justify-between border border-border rounded-xl px-4 py-2.5 text-[13px]">
            <span>
              {slot.date} · {slot.startTime}–{slot.endTime}
            </span>
            <button onClick={() => removeSlot(idx)} className="text-error text-xs">
              Remove
            </button>
          </div>
        ))}
        {drafts.length === 0 && <div className="text-sm text-text-muted">No unbooked slots published.</div>}
      </div>

      <Button onClick={save} disabled={isPending}>
        Save availability
      </Button>
      {saved && <span className="ml-3 text-xs text-success">Saved.</span>}

      {booked.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold text-[#AEB1BC] mb-2">BOOKED SLOTS</div>
          <div className="flex flex-col gap-2">
            {booked.map((slot) => (
              <div key={slot.id} className={cn("border border-border rounded-xl px-4 py-2.5 text-[13px] bg-bg")}>
                {slot.date} · {slot.startTime}–{slot.endTime} — booked
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
