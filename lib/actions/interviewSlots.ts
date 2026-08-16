"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { logAction } from "@/lib/data/audit";
import { sendEmail } from "@/lib/email/send";

export interface SlotActionResult {
  success: boolean;
  error?: string;
}

async function requireSecretariat(): Promise<SlotActionResult | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) {
    return { success: false, error: "Only Secretariat can manage interview slots." };
  }
  return null;
}

export async function createAvailabilitySlot(
  panelId: string,
  startsAtIso: string,
  durationMinutes: number,
  format: "virtual" | "physical"
): Promise<SlotActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("interview_availability_slots").insert({
    panel_id: panelId,
    starts_at: startsAtIso,
    duration_minutes: durationMinutes,
    format,
    created_by: user!.id,
  });
  if (error) {
    if (error.code === "23505") return { success: false, error: "A slot already exists at this exact time for this panel." };
    return { success: false, error: "Could not create the slot." };
  }

  await logAction(user?.fullName ?? "Secretariat", "Published an interview slot for panel", panelId);
  revalidatePath("/secretariat/interviews");
  return { success: true };
}

/** Booked slots are left alone — cancelling a slot an applicant already claimed needs a human to sort out the interview itself, not a silent delete. */
export async function deleteAvailabilitySlot(slotId: string): Promise<SlotActionResult> {
  const denied = await requireSecretariat();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: slot } = await supabase.from("interview_availability_slots").select("interview_id").eq("id", slotId).maybeSingle();
  if (slot?.interview_id) {
    return { success: false, error: "This slot has already been booked — cancel or reschedule the interview instead of deleting it." };
  }

  const { error } = await supabase.from("interview_availability_slots").delete().eq("id", slotId);
  if (error) return { success: false, error: "Could not delete the slot." };

  const user = await getCurrentUser();
  await logAction(user?.fullName ?? "Secretariat", "Removed an unbooked interview slot", slotId);
  revalidatePath("/secretariat/interviews");
  return { success: true };
}

/**
 * Applicant-initiated booking. Claims the slot through the applicant's
 * own (RLS-scoped) client — avail_slots_update_applicant_booking
 * guarantees it's unbooked, belongs to the panel handling their own
 * `requested` interview, and that they can only ever set interview_id to
 * their own interview; avail_slots_select_applicant_own_booking covers
 * reading the row back afterward, which is what the earlier version of
 * this function's admin-client workaround was standing in for (that
 * policy didn't exist yet — a row an applicant just booked wasn't
 * SELECT-visible to them under any policy, so requesting it back via
 * .select() failed as a row-level security violation on what looked
 * like an unrelated UPDATE; fixed on the schema side, not here).
 * `interviews` itself still has no applicant write policy at all, so
 * that update (and any rollback if it fails) goes through the admin
 * client instead.
 */
export async function bookInterviewSlot(applicationId: string, slotId: string): Promise<SlotActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, panel_id")
    .eq("application_id", applicationId)
    .eq("status", "requested")
    .maybeSingle();
  if (!interview) return { success: false, error: "No interview request found to book against." };

  const { data: bookedSlot, error: slotError } = await supabase
    .from("interview_availability_slots")
    .update({ interview_id: interview.id, booked_at: new Date().toISOString() })
    .eq("id", slotId)
    .is("interview_id", null)
    .select("starts_at, duration_minutes, format")
    .maybeSingle();
  if (slotError || !bookedSlot) {
    return { success: false, error: "This slot was just booked by someone else — pick another." };
  }

  const admin = createAdminClient();
  const { error: interviewError } = await admin
    .from("interviews")
    .update({
      status: "scheduled",
      scheduled_at: bookedSlot.starts_at,
      format: bookedSlot.format,
      duration_minutes: bookedSlot.duration_minutes,
    })
    .eq("id", interview.id);
  if (interviewError) {
    // The applicant's own client can no longer touch this row (its RLS
    // requires interview_id IS NULL, which is no longer true) — the admin
    // client bypasses RLS entirely, so it's the only thing that can undo
    // the claim and leave the slot bookable again.
    await admin.from("interview_availability_slots").update({ interview_id: null, booked_at: null }).eq("id", slotId);
    return { success: false, error: "Could not confirm the booking. Try again." };
  }

  const [{ data: app }, { data: participants }, { data: secretariatUsers }] = await Promise.all([
    admin.from("applications").select("organization_id").eq("id", applicationId).maybeSingle(),
    admin.from("interview_participants").select("juror_id").eq("interview_id", interview.id),
    admin.from("profiles").select("email").in("role", ["secretariat", "secretariat_super_admin"]),
  ]);
  const { data: org } = app
    ? await admin.from("organizations").select("name").eq("id", app.organization_id).maybeSingle()
    : { data: null };
  const { data: jurorProfiles } = participants?.length
    ? await admin.from("profiles").select("email").in(
        "id",
        participants.map((p) => p.juror_id)
      )
    : { data: [] as { email: string }[] };

  const emailContext = {
    organizationName: org?.name ?? "An applicant",
    applicationId,
    scheduledAt: bookedSlot.starts_at,
    format: bookedSlot.format,
  };
  await Promise.all([
    ...(jurorProfiles ?? []).map((j) =>
      sendEmail({ to: j.email, subject: "Interview slot booked", template: "interview-slot-booked-juror", context: emailContext })
    ),
    ...(secretariatUsers ?? []).map((s) =>
      sendEmail({ to: s.email, subject: "Interview slot booked", template: "interview-slot-booked-secretariat", context: emailContext })
    ),
  ]);

  await logAction(org?.name ?? "Applicant", "Booked interview slot for", org?.name ?? applicationId);
  revalidatePath("/applicant/interview");
  revalidatePath("/jury/availability");
  revalidatePath(`/jury/interview/${applicationId}`);
  revalidatePath("/secretariat/interviews");
  revalidatePath(`/secretariat/applications/${applicationId}`);
  return { success: true };
}
