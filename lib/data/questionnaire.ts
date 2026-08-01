import { store } from "@/lib/mock/store";
import type { QuestionnaireAnswer, QuestionnaireSection } from "@/types/domain";

export async function getQuestionnaireSections(): Promise<QuestionnaireSection[]> {
  return [...store.questionnaireSections];
}

export async function getAnswers(applicationId: string): Promise<QuestionnaireAnswer[]> {
  return store.answersByApplication[applicationId] ?? [];
}
