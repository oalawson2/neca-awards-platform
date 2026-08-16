import { createClient } from "@/lib/supabase/server";
import type { AvailabilitySlot } from "@/types/domain";

interface SlotRow {
  id: string;
  panel_id: string;
  starts_at: string;
  duration_minutes: number;
  format: "virtual" | "physical";
  interview_id: string | null;
  booked_at: string | null;
}

function mapSlot(row: SlotRow): AvailabilitySlot {
  return {
    id: row.id,
    panelId: row.panel_id,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    format: row.format,
    interviewId: row.interview_id,
    bookedAt: row.booked_at,
  };
}

/**
 * Every slot (booked and open) for one panel, oldest-first — the
 * Secretariat management view and the jury read-only view both use this;
 * RLS (avail_slots_all_secretariat / avail_slots_select_jury) decides
 * which panels a given caller can actually see rows for.
 */
export async function getSlotsForPanel(panelId: string): Promise<AvailabilitySlot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_availability_slots")
    .select("id, panel_id, starts_at, duration_minutes, format, interview_id, booked_at")
    .eq("panel_id", panelId)
    .order("starts_at", { ascending: true });
  return (data ?? []).map(mapSlot);
}

/**
 * Open slots an applicant can book, for their own requested interview —
 * avail_slots_select_applicant RLS already scopes this to the right
 * panel and to unbooked rows; the explicit filters here are just
 * defense-in-depth, not what's actually doing the scoping.
 */
export async function getBookableSlotsForApplication(applicationId: string): Promise<AvailabilitySlot[]> {
  const supabase = await createClient();
  const { data: interview } = await supabase
    .from("interviews")
    .select("panel_id")
    .eq("application_id", applicationId)
    .eq("status", "requested")
    .maybeSingle();
  if (!interview) return [];

  const { data } = await supabase
    .from("interview_availability_slots")
    .select("id, panel_id, starts_at, duration_minutes, format, interview_id, booked_at")
    .eq("panel_id", interview.panel_id)
    .is("interview_id", null)
    .order("starts_at", { ascending: true });
  return (data ?? []).map(mapSlot);
}
