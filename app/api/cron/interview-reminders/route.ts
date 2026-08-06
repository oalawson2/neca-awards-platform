import { NextRequest, NextResponse } from "next/server";
import { getBookingReminderCandidates, getAttendanceReminderCandidates } from "@/lib/data/interviews";
import { sendBookingReminder, sendAttendanceReminder } from "@/lib/actions/interviews";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest, secret: string): boolean {
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

/**
 * Meant to be hit periodically by an external scheduler (see README —
 * cPanel Cron Jobs on this host). Re-scoped to InterviewSession (the
 * panel-based Stage 2b model) rather than the old single-juror
 * InterviewRequest — see lib/actions/interviews.ts's requestInterview.
 */
async function runReminderSweep() {
  const [bookingCandidates, attendanceCandidates] = await Promise.all([
    getBookingReminderCandidates(),
    getAttendanceReminderCandidates(),
  ]);

  let bookingRemindersSent = 0;
  for (const candidate of bookingCandidates) {
    const result = await sendBookingReminder(candidate.applicationId);
    if (result.success) bookingRemindersSent++;
  }

  let attendanceRemindersSent = 0;
  for (const candidate of attendanceCandidates) {
    const result = await sendAttendanceReminder(candidate.applicationId);
    if (result.success) attendanceRemindersSent++;
  }

  console.log(
    `[cron/interview-reminders] checked ${bookingCandidates.length} awaiting-booking + ${attendanceCandidates.length} upcoming-scheduled session(s); sent ${bookingRemindersSent} booking reminder(s), ${attendanceRemindersSent} attendance reminder(s)`
  );

  return { bookingRemindersSent, attendanceRemindersSent };
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server." }, { status: 500 });
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runReminderSweep();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
