"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/Field";
import type { Sector } from "@/types/domain";

export function SectorSelect({ sectors, selectedSectorId }: { sectors: Sector[]; selectedSectorId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      defaultValue={selectedSectorId}
      className="w-auto"
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sector", e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      {sectors.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
