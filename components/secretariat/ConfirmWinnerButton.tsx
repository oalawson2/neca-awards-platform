"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { confirmEmployerOfYear } from "@/lib/actions/winners";

export function ConfirmWinnerButton({ applicationId }: { applicationId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return <span className="text-sm font-semibold text-success">✓ Confirmed as Employer of the Year</span>;
  }

  return (
    <Button
      variant="gold"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await confirmEmployerOfYear(applicationId);
          setConfirmed(true);
        })
      }
    >
      Confirm Employer of the Year
    </Button>
  );
}
