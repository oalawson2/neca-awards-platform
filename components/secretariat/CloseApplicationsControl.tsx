"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { closeApplications, reopenApplications } from "@/lib/actions/resultsRelease";

/**
 * The real hard stop on new applications (applications_closed_at,
 * enforced by applications_insert_own RLS) — independent of
 * ResultsReleaseControl's results_released_at. Closing only blocks
 * creating a brand-new application; anyone already partway through a
 * draft keeps editing and submitting normally.
 */
export function CloseApplicationsControl({ closedAt }: { closedAt: string | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setError(null);
    startTransition(async () => {
      const result = await closeApplications();
      if (!result.success) {
        setError(result.error ?? "Could not close applications.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  function reopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenApplications();
      if (!result.success) setError(result.error ?? "Could not reopen applications.");
      else router.refresh();
    });
  }

  if (closedAt) {
    return (
      <div className="border border-border rounded-2xl px-5 py-4 max-w-md">
        <div className="font-bold text-sm text-navy-dark">Applications closed</div>
        <div className="text-xs text-text-muted mt-0.5">
          Closed {new Date(closedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}. No new
          applicants can start an application. Anyone already partway through a draft is unaffected.
        </div>
        {error && <div className="text-xs text-error mt-2">{error}</div>}
        <Button variant="secondary" size="sm" className="mt-3" onClick={reopen} loading={isPending}>
          Reopen applications
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl px-5 py-4 max-w-md">
      <div className="font-bold text-sm text-navy-dark">Close Applications</div>
      <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
        Stops any new applicant from starting an application. Applicants already partway through a draft can still
        finish and submit — this doesn&rsquo;t touch existing applications, and it doesn&rsquo;t reveal or affect
        shortlist results.
      </div>
      {error && <div className="text-xs text-error mt-2">{error}</div>}
      {confirming ? (
        <div className="mt-3 flex gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={close} loading={isPending}>
            Yes, close applications to new entrants
          </Button>
        </div>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setConfirming(true)}>
          Close Applications
        </Button>
      )}
    </div>
  );
}
