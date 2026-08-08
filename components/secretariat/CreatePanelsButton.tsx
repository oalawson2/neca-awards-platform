"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ensurePanelsExist } from "@/lib/actions/panels";

export function CreatePanelsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await ensurePanelsExist();
          router.refresh();
        })
      }
    >
      {isPending ? "Creating…" : "Create the 3 panels"}
    </Button>
  );
}
