import { store } from "@/lib/mock/store";
import type { Sector } from "@/types/domain";

export async function getSectors(): Promise<Sector[]> {
  return [...store.sectors].sort((a, b) => a.order - b.order);
}
