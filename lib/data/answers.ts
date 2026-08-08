import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_ITEMS } from "@/lib/mock/framework";
import { effectiveItemsForOrg } from "@/lib/scoring/stage1";
import type { AssessmentAnswer, AnswerValue } from "@/types/domain";

const ITEM_BY_DB_ID = new Map(ASSESSMENT_ITEMS.map((i) => [i.dbId, i]));

export async function getAnswers(applicationId: string): Promise<AssessmentAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_responses")
    .select("item_id, response_value, na_selected, na_justification")
    .eq("application_id", applicationId);
  if (error || !data) return [];

  return data.flatMap((row): AssessmentAnswer[] => {
    const item = ITEM_BY_DB_ID.get(row.item_id);
    if (!item) return [];
    return [
      {
        applicationId,
        itemId: item.id,
        value: row.response_value as AnswerValue,
        isNA: row.na_selected,
        naJustification: row.na_justification ?? undefined,
      },
    ];
  });
}

/** All B–I items that apply to this org, resolving Section D's branch by the org's isUnionised flag. */
export async function getEffectiveItemsForApplication(applicationId: string) {
  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("organization_id").eq("id", applicationId).maybeSingle();
  if (!app) return effectiveItemsForOrg(false);

  const { data: org } = await supabase.from("organizations").select("is_unionised").eq("id", app.organization_id).maybeSingle();
  return effectiveItemsForOrg(!!org?.is_unionised);
}

export interface QuestionnaireProgress {
  totalItems: number;
  answeredItems: number;
  isComplete: boolean;
}

export async function getQuestionnaireProgress(applicationId: string): Promise<QuestionnaireProgress> {
  const items = await getEffectiveItemsForApplication(applicationId);
  const answers = await getAnswers(applicationId);
  const answeredIds = new Set(answers.filter((a) => a.isNA || a.value !== null).map((a) => a.itemId));
  const answeredItems = items.filter((i) => answeredIds.has(i.id)).length;
  return { totalItems: items.length, answeredItems, isComplete: answeredItems === items.length };
}
