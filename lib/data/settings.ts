import { store } from "@/lib/mock/store";
import type { PlatformSettings } from "@/types/domain";

export async function getSettings(): Promise<PlatformSettings> {
  return { ...store.settings };
}

export async function countBelowThreshold(threshold: number): Promise<number> {
  return store.applications.filter((a) => a.preliminaryScore !== null && a.preliminaryScore < threshold).length;
}
