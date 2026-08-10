"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { releaseResults, unreleaseResults } from "@/lib/actions/resultsRelease";

/**
 * The explicit, deliberate action that makes shortlist outcomes visible
 * to applicants (see lib/actions/resultsRelease.ts for why this is kept
 * separate from Apply Shortlist). Two-step confirm rather than a native
 * confirm() dialog, since this platform-wide, immediately-visible-to-
 * every-applicant action deserves more friction than an accidental click.
 */
export function ResultsReleaseControl({ releasedAt }: { releasedAt: string | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function release() {
    setError(null);
    startTransition(async () => {
      const result = await releaseResults();
      if (!result.success) {
        setError(result.error ?? "Could not release results.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  function undo() {
    setError(null);
    startTransition(async () => {
      const result = await unreleaseResults();
      if (!result.success) setError(result.error ?? "Could not undo.");
      else router.refresh();
    });
  }

  if (releasedAt) {
    return (
      <div className="border border-border rounded-2xl px-5 py-4 max-w-md">
        <div className="font-bold text-sm text-navy-dark">Applications closed — results released</div>
        <div className="text-xs text-text-muted mt-0.5">
          Released {new Date(releasedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}. Every
          applicant can now see their shortlisted/not-shortlisted outcome.
        </div>
        {error && <div className="text-xs text-error mt-2">{error}</div>}
        <Button variant="secondary" size="sm" className="mt-3" onClick={undo} loading={isPending}>
          Undo (results were released by mistake)
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl px-5 py-4 max-w-md">
      <div className="font-bold text-sm text-navy-dark">Close Applications &amp; Release Results</div>
      <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
        Applicants can&rsquo;t see whether they were shortlisted until you do this — Apply Shortlist (per sector, on the
        Shortlisting screen) only decides the outcome, it doesn&rsquo;t show it to anyone. Run this once every sector&rsquo;s
        shortlist is finalized.
      </div>
      {error && <div className="text-xs text-error mt-2">{error}</div>}
      {confirming ? (
        <div className="mt-3 flex gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={release} loading={isPending}>
            Yes, release results to every applicant now
          </Button>
        </div>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setConfirming(true)}>
          Close Applications &amp; Release Results
        </Button>
      )}
    </div>
  );
}
