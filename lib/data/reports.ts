import { store } from "@/lib/mock/store";
import type { AIReport } from "@/types/domain";

/** Every application with a drafted report pending Secretariat approval before release. */
export async function getAIReportQueue(): Promise<AIReport[]> {
  return store.aiReports.filter((r) => r.status === "pending_approval");
}

export async function getAIReport(reportId: string): Promise<AIReport | null> {
  return store.aiReports.find((r) => r.id === reportId) ?? null;
}

export async function getReportForApplication(applicationId: string): Promise<AIReport | null> {
  return store.aiReports.find((r) => r.applicationId === applicationId) ?? null;
}
