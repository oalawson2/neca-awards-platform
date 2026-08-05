import { NextRequest, NextResponse } from "next/server";
import {
  getBookingReminderCandidates,
  getAttendanceReminderCandidates,
} from "@/lib/data/interviews";
import { sendBookingReminder, sendAttendanceReminder } from "@/lib/actions/interviews";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest, secret: string): boolean {
  const headerSecret = request.headers.get("x-cron-secret");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret;
}

/**
 * Meant to be hit periodically by an external scheduler (see README —
 * cPanel Cron Jobs on this host), not by anything inside the Next.js app
 * itself. There's no background job runner here, so nothing calls this on
 * its own.
 *
 * For every applicant with an open interview request: sends a booking
 * reminder if they haven't booked yet, or an attendance reminder if
 * they've booked an upcoming slot — both throttled to at most once per
 * REMINDER_INTERVAL_MS (lib/data/interviews.ts). No real email provider is
 * wired up yet; sendBookingReminder/sendAttendanceReminder log via
 * lib/email/send.ts's sendEmail() instead of actually sending.
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
    `[cron/interview-reminders] checked ${bookingCandidates.length} unbooked + ${attendanceCandidates.length} upcoming-booked request(s); sent ${bookingRemindersSent} booking reminder(s), ${attendanceRemindersSent} attendance reminder(s)`
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
