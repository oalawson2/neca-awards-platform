import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_ITEMS } from "@/lib/mock/framework";
import type { InterviewSession, InterviewStatus, LiveEvidenceRequest, PillarCode } from "@/types/domain";

const ITEM_BY_DB_ID = new Map(ASSESSMENT_ITEMS.map((i) => [i.dbId, i]));

interface InterviewRow {
  id: string;
  application_id: string;
  panel_id: string;
  requested_by: string;
  requested_at: string;
  scheduled_at: string | null;
  format: "virtual" | "physical";
  status: InterviewStatus;
  consistency_notes: Partial<Record<PillarCode, string>>;
  probe_questions: Partial<Record<PillarCode, string>>;
  initial_email_sent_at: string | null;
  last_booking_reminder_at: string | null;
  last_attendance_reminder_at: string | null;
}

async function mapSession(supabase: Awaited<ReturnType<typeof createClient>>, row: InterviewRow): Promise<InterviewSession> {
  const { data: participants } = await supabase
    .from("interview_participants")
    .select("juror_id")
    .eq("interview_id", row.id);
  return {
    id: row.id,
    applicationId: row.application_id,
    panelId: row.panel_id,
    assignedJurorIds: (participants ?? []).map((p) => p.juror_id),
    scheduledAt: row.scheduled_at,
    format: row.format,
    status: row.status,
    consistencyNotes: row.consistency_notes ?? {},
    probeQuestions: row.probe_questions ?? {},
    requestedAt: row.requested_at,
    requestedByJurorId: row.requested_by,
    initialEmailSentAt: row.initial_email_sent_at,
    lastBookingReminderAt: row.last_booking_reminder_at,
    lastAttendanceReminderAt: row.last_attendance_reminder_at,
  };
}

export async function getInterviewSession(applicationId: string): Promise<InterviewSession | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("interviews").select("*").eq("application_id", applicationId).maybeSingle();
  if (!data) return null;
  return mapSession(supabase, data as InterviewRow);
}

export async function getLiveEvidenceRequests(applicationId: string): Promise<LiveEvidenceRequest[]> {
  const supabase = await createClient();
  const { data: interview } = await supabase.from("interviews").select("id").eq("application_id", applicationId).maybeSingle();
  if (!interview) return [];

  const { data } = await supabase
    .from("interview_evidence_requests")
    .select("id, item_id, requested_at, deadline_at, fulfilled_at, notes")
    .eq("interview_id", interview.id);
  return (data ?? []).map((r) => {
    const item = ITEM_BY_DB_ID.get(r.item_id);
    return {
      id: r.id,
      interviewSessionId: interview.id,
      applicationId,
      description: item ? `${item.id} — ${item.evidenceName ?? item.prompt}` : (r.notes ?? "Requested document"),
      requestedAt: r.requested_at,
      deadline: r.deadline_at,
      receivedAt: r.fulfilled_at,
    };
  });
}

/** Which jurors on this application's panel already did a Stage 2a document review — used to satisfy the "one non-2a-reviewer" interview-panel rule. */
export async function getStage2aReviewerIds(applicationId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stage2_document_reviews")
    .select("juror_id")
    .eq("application_id", applicationId)
    .not("credible", "is", null);
  return Array.from(new Set((data ?? []).map((r) => r.juror_id)));
}

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

function dueForReminder(lastSentAt: string | null): boolean {
  if (!lastSentAt) return true;
  return Date.now() - new Date(lastSentAt).getTime() >= REMINDER_INTERVAL_MS;
}

export interface ReminderCandidate {
  applicationId: string;
}

/** Interview sessions requested but not yet scheduled, due for a reminder (not sent in the last 24h) — consumed by app/api/cron/interview-reminders. */
export async function getBookingReminderCandidates(): Promise<ReminderCandidate[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("interviews").select("application_id, last_booking_reminder_at").eq("status", "requested");
  return (data ?? [])
    .filter((s) => dueForReminder(s.last_booking_reminder_at))
    .map((s) => ({ applicationId: s.application_id }));
}

/** Scheduled interviews whose slot is still upcoming, due for a reminder. */
export async function getAttendanceReminderCandidates(): Promise<ReminderCandidate[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("interviews")
    .select("application_id, last_attendance_reminder_at")
    .eq("status", "scheduled")
    .gte("scheduled_at", now);
  return (data ?? [])
    .filter((s) => dueForReminder(s.last_attendance_reminder_at))
    .map((s) => ({ applicationId: s.application_id }));
}

