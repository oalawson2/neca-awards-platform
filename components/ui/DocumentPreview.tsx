"use client";

import { useEffect, useState } from "react";
import { getDocumentPreviewUrl } from "@/lib/actions/documents";

/**
 * Renders a stored document (PDF or JPEG/PNG) via a short-lived signed
 * URL, fetched fresh whenever storagePath changes rather than once up
 * front — a review session can stay open a lot longer than the signed
 * URL's expiry. Storage's own RLS decides who can actually get a URL back
 * (see lib/actions/documents.ts's getDocumentPreviewUrl) — jury only
 * within their own panel's applications, Secretariat unrestricted — so
 * there's nothing to authorize here beyond that.
 *
 * Callers must pass `key={storagePath}` (or an id derived from it) when
 * rendering this for a document that can change — e.g. switching the
 * jury's active document — so React remounts fresh with `loading: true`
 * on every effect run right in the initial state, instead of the effect
 * resetting state on every run (a setState-synchronously-in-effect
 * anti-pattern that also risks briefly re-showing stale content).
 */
export function DocumentPreview({ storagePath, fileName }: { storagePath: string; fileName: string }) {
  const [state, setState] = useState<{ url: string | null; error: string | null; loading: boolean }>({
    url: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    getDocumentPreviewUrl(storagePath).then((result) => {
      if (cancelled) return;
      if (result.success && result.url) setState({ url: result.url, error: null, loading: false });
      else setState({ url: null, error: result.error ?? "Could not load this document.", loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (state.loading) {
    return <div className="flex-1 flex items-center justify-center text-[13px] text-text-muted min-h-56">Loading preview…</div>;
  }

  if (state.error || !state.url) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-error text-center px-6 min-h-56">
        {state.error ?? "Could not load this document."}
      </div>
    );
  }

  // storagePath's extension reflects the real stored content-type (every
  // compressed image is written as .jpg regardless of the original upload
  // format — see lib/actions/documents.ts) — not fileName, which stays the
  // original, human-readable name and can disagree with it.
  const isPdf = storagePath.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-2">
      {isPdf ? (
        <iframe src={state.url} title={fileName} className="flex-1 w-full border border-border rounded-2xl min-h-56" />
      ) : (
        <div className="flex-1 border border-border rounded-2xl overflow-auto flex items-center justify-center min-h-56 bg-[#FAFAFC]">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL, not a static asset next/image can optimize */}
          <img src={state.url} alt={fileName} className="max-w-full max-h-full object-contain" />
        </div>
      )}
      <a href={state.url} target="_blank" rel="noopener noreferrer" className="text-xs text-info font-semibold self-start flex-shrink-0">
        Open in new tab ↗
      </a>
    </div>
  );
}
