"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { bookInterviewSlot } from "@/lib/actions/interviewSlots";
import { formatDate } from "@/lib/utils";
import type { AvailabilitySlot, InterviewSession } from "@/types/domain";

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" });
}

/**
 * Self-service slot picker, replacing the old read-only "your panel will
 * reach out" view — Secretariat publishes availability per panel, and the
 * applicant claims one directly (see lib/actions/interviewSlots.ts's
 * bookInterviewSlot). No slots existing yet for the assigned panel is a
 * real, distinct state from no interview being requested at all.
 */
export function InterviewBooking({
  applicationId,
  session,
  bookableSlots,
}: {
  applicationId: string;
  session: InterviewSession | null;
  bookableSlots: AvailabilitySlot[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14 text-center">
        <h1 className="font-heading font-extrabold text-xl text-navy">No interview requested yet</h1>
        <p className="text-sm text-text-muted mt-2">
          Your sector&rsquo;s jury panel hasn&rsquo;t requested an interview with you yet. You&rsquo;ll receive an
          email once one is scheduled.
        </p>
      </div>
    );
  }

  if (session.status === "scheduled" && session.scheduledAt) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14 text-center">
        <div className="w-16 h-16 rounded-full bg-[#E6F4E6] flex items-center justify-center text-2xl text-success mx-auto mb-5">✓</div>
        <h1 className="font-heading font-extrabold text-xl text-navy">Interview scheduled</h1>
        <p className="text-sm text-text-muted mt-2">
          {formatDate(session.scheduledAt)} — {session.format === "virtual" ? "virtual" : "in person"}
        </p>
        <p className="text-xs text-text-muted mt-4">
          Your panel will be in touch with the meeting details ahead of time.
        </p>
      </div>
    );
  }

  if (session.status === "completed") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14 text-center">
        <h1 className="font-heading font-extrabold text-xl text-navy">Interview complete</h1>
        <p className="text-sm text-text-muted mt-2">Thank you for meeting with your sector&rsquo;s jury panel.</p>
      </div>
    );
  }

  function book(slotId: string) {
    setError(null);
    setBookingId(slotId);
    startTransition(async () => {
      const result = await bookInterviewSlot(applicationId, slotId);
      if (!result.success) {
        setError(result.error ?? "Could not book this slot.");
        setBookingId(null);
        return;
      }
      router.refresh();
    });
  }

  if (bookableSlots.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14 text-center">
        <h1 className="font-heading font-extrabold text-xl text-navy">Interview slots not yet available</h1>
        <p className="text-sm text-text-muted mt-2">
          Your sector&rsquo;s jury panel has requested an interview with you. The Secretariat hasn&rsquo;t published
          available times yet — check back soon, or you&rsquo;ll get an email once slots are ready to book.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-heading font-extrabold text-xl text-navy text-center">Book your interview</h1>
      <p className="text-sm text-text-muted mt-2 text-center">
        Pick a time that works for you — this is with your sector&rsquo;s jury panel.
      </p>

      <div className="flex flex-col gap-2.5 mt-8">
        {bookableSlots.map((slot) => (
          <div key={slot.id} className="border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm">{formatSlotTime(slot.startsAt)}</div>
              <div className="text-xs text-text-muted mt-0.5">
                {slot.durationMinutes} min · {slot.format === "physical" ? "In person" : "Virtual"}
              </div>
            </div>
            <Button size="sm" disabled={isPending} loading={isPending && bookingId === slot.id} onClick={() => book(slot.id)}>
              Book this slot
            </Button>
          </div>
        ))}
      </div>
      {error && <div className="text-sm text-error mt-4 text-center">{error}</div>}
    </div>
  );
}
