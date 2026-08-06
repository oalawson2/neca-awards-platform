import { store } from "@/lib/mock/store";
import { effectiveItemsForOrg } from "@/lib/scoring/stage1";
import type { AssessmentAnswer } from "@/types/domain";

export async function getAnswers(applicationId: string): Promise<AssessmentAnswer[]> {
  return store.answers.filter((a) => a.applicationId === applicationId);
}

/** All B–I items that apply to this org, resolving Section D's branch by the org's isUnionised flag. */
export async function getEffectiveItemsForApplication(applicationId: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  const org = app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;
  return effectiveItemsForOrg(!!org?.isUnionised);
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
