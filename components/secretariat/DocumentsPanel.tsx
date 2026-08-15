"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import type { DocumentVerificationSummary } from "@/lib/data/stage2a";

/**
 * Secretariat's document list, now with an actual previewer — clicking an
 * uploaded row expands it inline (accordion-style, one open at a time
 * rather than a fixed split pane) instead of opening nothing at all.
 * Missing documents (doc.status !== "uploaded") stay non-interactive,
 * same as before — nothing to preview for a document that was never
 * uploaded.
 */
export function DocumentsPanel({ documents }: { documents: DocumentVerificationSummary[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (documents.length === 0) {
    return <div className="px-5 py-8 text-sm text-text-muted text-center border border-border rounded-2xl">No documents required based on this applicant&rsquo;s answers.</div>;
  }

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      {documents.map((doc) => {
        const isActive = activeId === doc.id;
        const isUploaded = doc.status === "uploaded";

        return (
          <div key={doc.id} className="border-b last:border-b-0 border-border">
            {isUploaded ? (
              <button
                onClick={() => setActiveId(isActive ? null : doc.id)}
                className="w-full flex justify-between items-center gap-3 px-5 py-3.5 text-sm text-left hover:bg-[#FAFAFC]"
              >
                <div>
                  <div className="font-semibold">{doc.name}</div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {doc.credibleCount > 0 && <span className="text-success">✓ Verified credible by {doc.credibleCount}</span>}
                    {doc.credibleCount > 0 && doc.redFlagCount > 0 && " · "}
                    {doc.redFlagCount > 0 && <span className="text-error">⚠ Red-flagged by {doc.redFlagCount}</span>}
                    {doc.credibleCount === 0 && doc.redFlagCount === 0 && "Not yet reviewed"}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="text-xs font-semibold text-info">{isActive ? "Hide" : "View"}</span>
                  <Badge tone="success">UPLOADED</Badge>
                </div>
              </button>
            ) : (
              <div className="flex justify-between items-center gap-3 px-5 py-3.5 text-sm">
                <div className="font-semibold">{doc.name}</div>
                <Badge tone="error">MISSING</Badge>
              </div>
            )}
            {isActive && doc.storagePath && (
              <div className="px-5 pb-5 h-96 flex flex-col">
                <DocumentPreview key={doc.storagePath} storagePath={doc.storagePath} fileName={doc.fileName ?? doc.name} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
