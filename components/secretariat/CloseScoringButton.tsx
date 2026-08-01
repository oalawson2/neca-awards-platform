"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { closeScoringWindow } from "@/lib/actions/scoring";

export function CloseScoringButton({ sectorId, sectorName }: { sectorId: string; sectorName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await closeScoringWindow(sectorId, sectorName);
        })
      }
    >
      Close scoring window
    </Button>
  );
}
