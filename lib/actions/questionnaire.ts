"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

export async function saveAnswer(applicationId: string, questionId: string, value: string) {
  const existing = store.answersByApplication[applicationId] ?? [];
  const idx = existing.findIndex((a) => a.questionId === questionId);
  if (idx >= 0) existing[idx] = { questionId, value };
  else existing.push({ questionId, value });
  store.answersByApplication[applicationId] = existing;
  return { success: true, savedAt: new Date().toISOString() };
}

export async function markSectionComplete(applicationId: string, sectionsCompleted: number) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false };
  app.sectionsCompleted = Math.max(app.sectionsCompleted, sectionsCompleted);
  revalidatePath("/applicant");
  return { success: true };
}

export async function saveOrganizationProfile(
  applicationId: string,
  fields: {
    name: string;
    rcNumber: string;
    yearFounded: number;
    address: string;
    sectorId: string;
    employeeHeadcount: string;
    primaryContactName: string;
    primaryContactEmail: string;
  }
) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };
  const org = store.organizations.find((o) => o.id === app.organizationId);
  if (!org) return { success: false, error: "Organization not found." };

  Object.assign(org, fields);
  app.sectorId = fields.sectorId;
  logAction(fields.primaryContactName || org.name || "Applicant", "Saved organization profile for", org.name || "(unnamed organization)");
  revalidatePath("/applicant");
  revalidatePath("/applicant/profile");
  return { success: true };
}
