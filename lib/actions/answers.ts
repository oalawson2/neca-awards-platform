"use server";

import { revalidatePath } from "next/cache";
import { store, generateId } from "@/lib/mock/store";
import { evidenceTriggerFired } from "@/lib/scoring/stage1";
import { itemById, evidenceDefaultsFor } from "@/lib/mock/framework";
import type { AnswerValue } from "@/types/domain";

/**
 * Recomputes the required-document checklist from an application's
 * current answers — adds a document for any newly-fired evidence
 * trigger, and removes one whose trigger no longer fires because the
 * applicant changed an earlier answer (doc section 10: "the checklist
 * recalculates automatically if they return to change an earlier
 * answer"). An already-uploaded document that stops being required is
 * simply dropped — there's no un-upload step needed since it's gone from
 * the checklist entirely.
 */
function syncChecklist(applicationId: string) {
  const answers = store.answers.filter((a) => a.applicationId === applicationId);
  const firedItemIds = new Set<string>();
  for (const answer of answers) {
    const item = itemById(answer.itemId);
    if (evidenceTriggerFired(item, answer)) firedItemIds.add(item.id);
  }

  store.documents = store.documents.filter((d) => d.applicationId !== applicationId || firedItemIds.has(d.itemId));

  const existingItemIds = new Set(store.documents.filter((d) => d.applicationId === applicationId).map((d) => d.itemId));
  for (const itemId of firedItemIds) {
    if (existingItemIds.has(itemId)) continue;
    const item = itemById(itemId);
    const defaults = evidenceDefaultsFor(item.evidenceName!);
    store.documents.push({
      id: generateId("doc"),
      applicationId,
      itemId: item.id,
      pillarCode: item.pillarCode,
      name: item.evidenceName!,
      track: item.track,
      acceptedFileTypes: defaults.acceptedFileTypes,
      maxSizeMB: defaults.maxSizeMB,
      description: defaults.description,
      status: "pending",
    });
  }
}

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

  const existing = store.answers.find((a) => a.applicationId === applicationId && a.itemId === itemId);
  if (existing) {
    existing.value = value;
    existing.isNA = isNA;
    existing.naJustification = isNA ? naJustification : undefined;
  } else {
    store.answers.push({ applicationId, itemId, value, isNA, naJustification: isNA ? naJustification : undefined });
  }

  syncChecklist(applicationId);
  revalidatePath("/applicant/questionnaire");
  revalidatePath("/applicant/documents");
  revalidatePath("/applicant/review");
  return { success: true };
}
