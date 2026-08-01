import { store } from "@/lib/mock/store";
import type { Criterion, Sector } from "@/types/domain";

export async function getSectors(): Promise<Sector[]> {
  return [...store.sectors];
}

/** Universal judging criteria — identical for every sector, sector has zero effect on scoring. */
export async function getCriteria(): Promise<Criterion[]> {
  return [...store.criteria].sort((a, b) => a.order - b.order);
}
