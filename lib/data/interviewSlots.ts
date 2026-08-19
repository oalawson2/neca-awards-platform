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

function mapSlot(row: SlotRow, bookedBy?: { applicationId: string; organizationName: string }): AvailabilitySlot {
  return {
    id: row.id,
    panelId: row.panel_id,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    format: row.format,
    interviewId: row.interview_id,
    bookedAt: row.booked_at,
    bookedByApplicationId: bookedBy?.applicationId ?? null,
    bookedByOrganizationName: bookedBy?.organizationName ?? null,
  };
}

/**
 * Every slot (booked and open) for one panel, oldest-first, with the
 * booking applicant's organization name attached to booked slots — the
 * Secretariat management view and the jury read-only view both use this
 * (both need to know who to follow up with, not just that a slot is
 * taken); RLS (avail_slots_all_secretariat / avail_slots_select_jury)
 * decides which panels a given caller can actually see rows for.
 */
export async function getSlotsForPanel(panelId: string): Promise<AvailabilitySlot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_availability_slots")
    .select("id, panel_id, starts_at, duration_minutes, format, interview_id, booked_at")
    .eq("panel_id", panelId)
    .order("starts_at", { ascending: true });
  const rows = data ?? [];

  const interviewIds = rows.map((r) => r.interview_id).filter((id): id is string => !!id);
  if (interviewIds.length === 0) return rows.map((r) => mapSlot(r));

  const { data: interviews } = await supabase.from("interviews").select("id, application_id").in("id", interviewIds);
  const applicationIdByInterviewId = new Map((interviews ?? []).map((i) => [i.id, i.application_id]));
  const applicationIds = Array.from(applicationIdByInterviewId.values());

  const { data: applications } = await supabase.from("applications").select("id, organization_id").in("id", applicationIds);
  const orgIdByApplicationId = new Map((applications ?? []).map((a) => [a.id, a.organization_id]));
  const orgIds = Array.from(orgIdByApplicationId.values());

  const { data: organizations } = await supabase.from("organizations").select("id, name").in("id", orgIds);
  const orgNameById = new Map((organizations ?? []).map((o) => [o.id, o.name]));

  return rows.map((row) => {
    if (!row.interview_id) return mapSlot(row);
    const applicationId = applicationIdByInterviewId.get(row.interview_id);
    const orgId = applicationId ? orgIdByApplicationId.get(applicationId) : undefined;
    const organizationName = orgId ? orgNameById.get(orgId) : undefined;
    return applicationId && organizationName ? mapSlot(row, { applicationId, organizationName }) : mapSlot(row);
  });
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
  return (data ?? []).map((row) => mapSlot(row));
}
