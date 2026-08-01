"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { bookInterviewSlot } from "@/lib/actions/interviews";
import type { InterviewAvailabilitySlot } from "@/types/domain";

export function InterviewBooking({
  applicationId,
  organizationName,
  sectorName,
  slots,
  bookedSlot,
}: {
  applicationId: string;
  organizationName: string;
  sectorName: string;
  slots: InterviewAvailabilitySlot[];
  bookedSlot: InterviewAvailabilitySlot | null;
}) {
  const dates = useMemo(() => Array.from(new Set(slots.map((s) => s.date))).sort(), [slots]);
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(bookedSlot);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const slotsForDate = slots.filter((s) => s.date === selectedDate);
  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  function confirm() {
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await bookInterviewSlot(applicationId, selectedSlot.id, organizationName);
      if (result.success) setConfirmed(selectedSlot);
      else setError(result.error ?? "Could not book that slot.");
    });
  }

  if (confirmed) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14 text-center">
        <div className="w-16 h-16 rounded-full bg-[#E6F4E6] flex items-center justify-center text-2xl text-success mx-auto mb-5">
          ✓
        </div>
        <h1 className="font-heading font-extrabold text-xl text-navy">Interview confirmed</h1>
        <p className="text-sm text-text-muted mt-2">
          {formatDate(confirmed.date)} · {confirmed.startTime} – {confirmed.endTime} (WAT)
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 sm:py-9">
      <h1 className="font-heading font-extrabold text-xl sm:text-[21px] text-navy mb-1">Book your panel interview</h1>
      <p className="text-[13px] text-text-muted mb-6">
        30-minute slot with the {sectorName} sector panel. All times WAT.
      </p>

      {dates.length === 0 ? (
        <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
          No interview slots have been published by your sector&rsquo;s jurors yet. Check back soon.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="flex-1">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dates.map((date) => (
                <button
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedSlotId(null);
                  }}
                  className={cn(
                    "flex-shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl",
                    date === selectedDate ? "bg-navy text-white" : "bg-bg text-text"
                  )}
                >
                  {formatDate(date)}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:w-80">
            <div className="font-bold text-sm mb-3.5">{formatDate(selectedDate)} — available times</div>
            <div className="flex flex-col gap-2.5">
              {slotsForDate.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlotId(slot.id)}
                  className={cn(
                    "text-left border-[1.5px] rounded-xl px-4 py-3.5 text-sm",
                    slot.id === selectedSlotId ? "border-navy bg-[#F1F1FB] text-navy font-semibold" : "border-[#E3E4EA]"
                  )}
                >
                  {slot.startTime} – {slot.endTime}
                </button>
              ))}
            </div>
            {error && <div className="text-sm text-error mt-3">{error}</div>}
            <Button variant="gold" className="w-full mt-6" disabled={!selectedSlot || isPending} onClick={confirm}>
              {selectedSlot ? `Confirm ${selectedSlot.startTime} slot` : "Select a time"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
