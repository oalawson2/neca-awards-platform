import { formatDate } from "@/lib/utils";
import type { InterviewSession } from "@/types/domain";

/**
 * Read-only status view — applicants have no write access to `interviews`
 * under RLS, and the real schema has no availability-slot/booking table
 * at all, so there's no self-service booking flow to build here.
 * Scheduling coordination happens off-platform (email/phone); a juror on
 * the panel records the agreed time once it's set.
 */
export function InterviewBooking({ session }: { session: InterviewSession | null }) {
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-14 text-center">
      <h1 className="font-heading font-extrabold text-xl text-navy">Interview requested</h1>
      <p className="text-sm text-text-muted mt-2">
        Your sector&rsquo;s jury panel has requested an interview with you. They&rsquo;ll reach out directly to agree
        a time — no action is needed here yet.
      </p>
    </div>
  );
}
