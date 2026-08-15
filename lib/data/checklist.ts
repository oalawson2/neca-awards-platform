import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_ITEMS, PILLARS, evidenceDefaultsFor } from "@/lib/mock/framework";
import { evidenceTriggerFired } from "@/lib/scoring/stage1";
import type { AnswerValue, PillarCode, RequiredDocument } from "@/types/domain";

const ITEM_BY_DB_ID = new Map(ASSESSMENT_ITEMS.map((i) => [i.dbId, i]));

/**
 * The real schema has no "pending checklist item" table at all — only
 * document_evidence, which records actual uploads. Unlike the mock
 * version this replaces (which synced a persisted RequiredDocument row
 * per fired trigger), the checklist here is fully computed on every read
 * from application_responses (which triggers fired) joined against
 * document_evidence (what's been uploaded) — matching the doc's own
 * framing of the checklist as "compiled" from answers, not a stored
 * artifact. A not-yet-uploaded item gets a synthetic `pending-{itemCode}`
 * id since there's no real row to reference yet.
 */
export async function getDocuments(applicationId: string): Promise<RequiredDocument[]> {
  const supabase = await createClient();
  const [{ data: responses }, { data: uploads }] = await Promise.all([
    supabase.from("application_responses").select("item_id, response_value, na_selected").eq("application_id", applicationId),
    supabase.from("document_evidence").select("id, item_id, file_name, file_path, uploaded_at").eq("application_id", applicationId),
  ]);

  const uploadByItemCode = new Map<string, { id: string; file_name: string; file_path: string; uploaded_at: string }>();
  for (const u of uploads ?? []) {
    const item = ITEM_BY_DB_ID.get(u.item_id);
    if (item) uploadByItemCode.set(item.id, u);
  }

  const firedItemCodes = new Set<string>();
  for (const r of responses ?? []) {
    const item = ITEM_BY_DB_ID.get(r.item_id);
    if (!item || !item.evidenceName) continue;
    const fired = evidenceTriggerFired(item, {
      applicationId,
      itemId: item.id,
      value: r.response_value as AnswerValue,
      isNA: r.na_selected,
    });
    if (fired) firedItemCodes.add(item.id);
  }

  return [...firedItemCodes]
    .map((itemCode) => {
      const item = ITEM_BY_DB_ID.get(ASSESSMENT_ITEMS.find((i) => i.id === itemCode)!.dbId)!;
      const defaults = evidenceDefaultsFor(item.evidenceName!);
      const upload = uploadByItemCode.get(itemCode);
      const doc: RequiredDocument = {
        id: upload?.id ?? `pending-${itemCode}`,
        applicationId,
        itemId: item.id,
        pillarCode: item.pillarCode,
        name: item.evidenceName!,
        track: item.track,
        acceptedFileTypes: defaults.acceptedFileTypes,
        maxSizeMB: defaults.maxSizeMB,
        description: defaults.description,
        status: upload ? "uploaded" : "pending",
        fileName: upload?.file_name,
        uploadedAt: upload?.uploaded_at,
        storagePath: upload?.file_path,
      };
      return doc;
    })
    .sort((a, b) => a.pillarCode.localeCompare(b.pillarCode) || a.itemId.localeCompare(b.itemId));
}

export interface ChecklistGroup {
  pillarCode: PillarCode;
  pillarName: string;
  documents: RequiredDocument[];
}

/** The applicant-facing checklist, grouped by pillar, in pillar order (doc section 10). */
export async function getChecklistGrouped(applicationId: string): Promise<ChecklistGroup[]> {
  const documents = await getDocuments(applicationId);
  return PILLARS.filter((p) => p.scored)
    .map((p) => ({
      pillarCode: p.code,
      pillarName: p.name,
      documents: documents.filter((d) => d.pillarCode === p.code),
    }))
    .filter((g) => g.documents.length > 0);
}

export interface ChecklistStatus {
  mandatoryTotal: number;
  mandatoryUploaded: number;
  advancedTotal: number;
  advancedUploaded: number;
  allMandatoryUploaded: boolean;
}

export async function getChecklistStatus(applicationId: string): Promise<ChecklistStatus> {
  const documents = await getDocuments(applicationId);
  const mandatory = documents.filter((d) => d.track === "mandatory");
  const advanced = documents.filter((d) => d.track === "advanced");
  return {
    mandatoryTotal: mandatory.length,
    mandatoryUploaded: mandatory.filter((d) => d.status === "uploaded").length,
    advancedTotal: advanced.length,
    advancedUploaded: advanced.filter((d) => d.status === "uploaded").length,
    allMandatoryUploaded: mandatory.every((d) => d.status === "uploaded"),
  };
}
