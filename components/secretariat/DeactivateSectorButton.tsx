"use client";

import { useTransition } from "react";
import { Spinner } from "@/components/ui/Button";
import { deactivateSector, reactivateSector } from "@/lib/actions/sectors";

export function DeactivateSectorButton({ sectorId, isActive }: { sectorId: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={"text-[11px] font-semibold flex-shrink-0 inline-flex items-center gap-1.5 " + (isActive ? "text-error" : "text-success")}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          if (isActive) await deactivateSector(sectorId);
          else await reactivateSector(sectorId);
        })
      }
    >
      {isPending && <Spinner className="w-3 h-3" />}
      {isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
