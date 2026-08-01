"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

export async function confirmEmployerOfYear(applicationId: string) {
  for (const app of store.applications) app.isEmployerOfYear = app.id === applicationId;
  const app = store.applications.find((a) => a.id === applicationId);
  const orgName = app ? store.organizations.find((o) => o.id === app.organizationId)?.name : undefined;
  logAction("Funke Adeyemi", "Confirmed Employer of the Year:", orgName ?? applicationId);
  revalidatePath("/secretariat/winners");
  return { success: true };
}
