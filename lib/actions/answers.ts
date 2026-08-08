"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { itemById } from "@/lib/mock/framework";
import type { AnswerValue } from "@/types/domain";

/**
 * No separate "sync the checklist" step needed anymore (unlike the mock
 * version this replaces) — the real checklist (lib/data/checklist.ts,
 * task #47) is computed live from application_responses + document_evidence
 * on every read, not stored as its own synced set of rows. Saving an
 * answer that changes which evidence triggers fire just changes what the
 * next checklist read returns.
 */
export async function saveAnswer(
  applicationId: string,
  itemId: string,
  value: AnswerValue,
  isNA: boolean,
  naJustification?: string
) {
  if (isNA && (!naJustification || naJustification.trim().split(/\s+/).length > 50)) {
    return { success: false, error: "N/A requires a justification of 50 words or fewer." };
  }

  const item = itemById(itemId);
  const supabase = await createClient();

  const { error } = await supabase.from("application_responses").upsert(
    {
      application_id: applicationId,
      item_id: item.dbId,
      response_value: value,
      na_selected: isNA,
      na_justification: isNA ? naJustification : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id,item_id" }
  );
  if (error) return { success: false, error: "Could not save your answer." };

  revalidatePath("/applicant/questionnaire");
  revalidatePath("/applicant/documents");
  revalidatePath("/applicant/review");
  return { success: true };
}
