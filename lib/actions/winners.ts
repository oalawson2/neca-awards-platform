"use server";

import { revalidatePath } from "next/cache";
import { store } from "@/lib/mock/store";
import { logAction } from "@/lib/data/audit";

/** One winner per sector — confirming a new one un-confirms any previous winner in that sector. */
export async function confirmSectorWinner(applicationId: string) {
  const app = store.applications.find((a) => a.id === applicationId);
  if (!app) return { success: false, error: "Application not found." };
  const org = store.organizations.find((o) => o.id === app.organizationId);
  if (!org) return { success: false, error: "Organisation not found." };

  for (const other of store.applications) {
    const otherOrg = store.organizations.find((o) => o.id === other.organizationId);
    if (otherOrg?.sectorId === org.sectorId) other.isSectorWinner = false;
  }
  app.isSectorWinner = true;

  logAction("Funke Adeyemi", "Confirmed sectoral winner:", org.name);
  revalidatePath("/secretariat/winners");
  return { success: true };
}

/**
 * Step 1 (doc section 11.6): once every panel has named its sectoral
 * winner(s), ALL of them become finalists — no top-5 cut, however many
 * sectors there are.
 */
export async function conveneEmployerOfYear() {
  const winners = store.applications.filter((a) => a.isSectorWinner);
  if (winners.length === 0) return { success: false, error: "No sectoral winners have been confirmed yet." };

  for (const app of winners) {
    app.isEmployerOfYearFinalist = true;
  }

  logAction("Funke Adeyemi", "Convened Employer of the Year round with", `${winners.length} finalists`);
  revalidatePath("/secretariat/winners");
  revalidatePath("/jury");
  return { success: true, finalistCount: winners.length };
}

/** Step 5 (doc section 11.6): a human decision, presented to the Chair/co-chair — never auto-finalized from the ranking alone. */
export async function validateEmployerOfYearWinner(winnerApplicationId: string, validatedByUserId: string, validatedByName: string) {
  store.employerOfYear.validated = true;
  store.employerOfYear.validatedByUserId = validatedByUserId;
  store.employerOfYear.validatedAt = new Date().toISOString();
  store.employerOfYear.winnerApplicationId = winnerApplicationId;

  const app = store.applications.find((a) => a.id === winnerApplicationId);
  if (app) app.isEmployerOfYear = true;
  const org = app ? store.organizations.find((o) => o.id === app.organizationId) : undefined;

  logAction(validatedByName, "Validated Employer of the Year:", org?.name ?? winnerApplicationId);
  revalidatePath("/secretariat/winners");
  return { success: true };
}
