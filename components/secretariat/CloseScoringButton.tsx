"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Button";
import { closeStage2Scoring } from "@/lib/actions/scorecards";

export function CloseScoringButton({ applicationId, disabled }: { applicationId: string; disabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={disabled || isPending}
      title={disabled ? "Waiting on the full panel to submit" : "Closes blind scoring and computes the Verified Score"}
      className="text-xs font-semibold text-info disabled:text-[#AEB1BC] disabled:cursor-not-allowed inline-flex items-center gap-1.5"
      onClick={() =>
        startTransition(async () => {
          await closeStage2Scoring(applicationId);
          router.refresh();
        })
      }
    >
      {isPending && <Spinner className="w-3 h-3" />}
      {isPending ? "Closing…" : "Close scoring"}
    </button>
  );
}
