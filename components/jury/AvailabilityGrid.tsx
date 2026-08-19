import type { AvailabilitySlot } from "@/types/domain";

function formatWAT(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" });
}

/**
 * Read-only — the Secretariat publishes slots and applicants book them
 * directly (see components/applicant/InterviewBooking.tsx); jurors just
 * need visibility into what's open and what's been claimed for their own
 * panel, which avail_slots_select_jury RLS already scopes correctly.
 */
export function AvailabilityGrid({ panelName, slots }: { panelName: string | null; slots: AvailabilitySlot[] }) {
  if (!panelName) {
    return <div className="max-w-2xl mx-auto px-6 py-14 text-center text-sm text-text-muted">You aren&rsquo;t assigned to a panel.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 sm:py-9">
      <h1 className="font-heading font-extrabold text-xl sm:text-[21px] text-navy mb-1">Interview slots</h1>
      <p className="text-[13px] text-text-muted mb-6">
        {panelName} — published by the Secretariat, booked directly by applicants.
      </p>

      {slots.length === 0 ? (
        <div className="text-sm text-text-muted border border-border rounded-2xl p-6">No slots published yet.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {slots.map((slot) => (
            <div key={slot.id} className="border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm">{formatWAT(slot.startsAt)}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {slot.durationMinutes} min · {slot.format === "physical" ? "In person" : "Virtual"}
                </div>
              </div>
              {slot.interviewId ? (
                <span className="text-xs font-semibold text-success text-right">
                  ✓ Booked
                  {slot.bookedByOrganizationName && <div className="text-text-muted font-normal">{slot.bookedByOrganizationName}</div>}
                </span>
              ) : (
                <span className="text-xs text-text-muted">Open</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
