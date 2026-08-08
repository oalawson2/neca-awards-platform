"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea, Input, Select } from "@/components/ui/Field";
import { formatDate } from "@/lib/utils";
import { saveConsistencyNote, addLiveEvidenceRequest, markEvidenceReceived } from "@/lib/actions/interviews";
import { PILLARS, ASSESSMENT_ITEMS, SAMPLE_INTERVIEW_PROBES as SAMPLE_PROBES } from "@/lib/mock/framework";
import type { InterviewSession, LiveEvidenceRequest, PillarCode } from "@/types/domain";

const SCORED_PILLARS = PILLARS.filter((p) => p.scored);
const SCOREABLE_ITEMS = ASSESSMENT_ITEMS.filter((i) => i.pillarCode !== "A");

export function InterviewWorksheet({
  session,
  liveEvidenceRequests,
  organizationName,
}: {
  session: InterviewSession;
  liveEvidenceRequests: LiveEvidenceRequest[];
  organizationName: string;
}) {
  const [notes, setNotes] = useState(session.consistencyNotes);
  const [newRequestItemId, setNewRequestItemId] = useState(SCOREABLE_ITEMS[0]?.id ?? "");
  const [newRequestNote, setNewRequestNote] = useState("");
  const [requests, setRequests] = useState(liveEvidenceRequests);
  const [isPending, startTransition] = useTransition();

  function saveNote(pillarCode: PillarCode, note: string) {
    setNotes((prev) => ({ ...prev, [pillarCode]: note }));
    startTransition(() => {
      saveConsistencyNote(session.applicationId, pillarCode, note);
    });
  }

  function submitRequest() {
    if (!newRequestItemId) return;
    const item = SCOREABLE_ITEMS.find((i) => i.id === newRequestItemId);
    startTransition(async () => {
      await addLiveEvidenceRequest(session.applicationId, newRequestItemId, newRequestNote || undefined);
      setRequests((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          interviewSessionId: session.id,
          applicationId: session.applicationId,
          description: item ? `${item.id} — ${item.evidenceName ?? item.prompt}` : newRequestItemId,
          requestedAt: new Date().toISOString(),
          deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
          receivedAt: null,
        },
      ]);
      setNewRequestNote("");
    });
  }

  function markReceived(id: string) {
    startTransition(async () => {
      await markEvidenceReceived(id, session.applicationId);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, receivedAt: new Date().toISOString() } : r)));
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-jury mb-1.5">Sector interview — {organizationName}</h1>
      <p className="text-[13px] text-text-muted mb-2">
        Status: {session.status.replace("_", " ")} {session.scheduledAt && `· ${formatDate(session.scheduledAt)}`}
      </p>
      <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
        For every Mandatory item scored ≥3 at Stage 1/2a, ask the applicant to describe the practice in their own
        words. A representative who can&rsquo;t describe a declared practice should pull that pillar&rsquo;s
        Implementation score down regardless of what was uploaded.
      </p>

      <div className="flex flex-col gap-4 mb-8">
        {SCORED_PILLARS.map((pillar) => (
          <div key={pillar.code} className="border border-border rounded-2xl p-5">
            <div className="font-bold text-sm mb-1">
              {pillar.code} — {pillar.name}
            </div>
            <div className="text-xs text-text-muted mb-3 italic">
              Probe: {SAMPLE_PROBES[pillar.code as Exclude<PillarCode, "A">]}
            </div>
            <Textarea
              rows={2}
              placeholder="Consistency-check finding for this pillar…"
              value={notes[pillar.code] ?? ""}
              onChange={(e) => saveNote(pillar.code, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div>
        <div className="text-xs font-bold text-[#AEB1BC] mb-2.5">LIVE EVIDENCE REQUESTS</div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <Select value={newRequestItemId} onChange={(e) => setNewRequestItemId(e.target.value)} className="flex-1">
            {SCOREABLE_ITEMS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} — {item.evidenceName ?? item.prompt}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Note (optional)"
            value={newRequestNote}
            onChange={(e) => setNewRequestNote(e.target.value)}
            className="flex-1"
          />
          <Button variant="secondary" size="sm" onClick={submitRequest} disabled={isPending || !newRequestItemId}>
            + Request
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between border border-border rounded-xl px-4 py-2.5 text-[13px]">
              <div>
                <div className="font-semibold">{r.description}</div>
                <div className="text-xs text-text-muted">Deadline: {formatDate(r.deadline)}</div>
              </div>
              {r.receivedAt ? (
                <span className="text-xs font-semibold text-success">✓ Received</span>
              ) : (
                <button onClick={() => markReceived(r.id)} className="text-xs text-info font-semibold">
                  Mark received
                </button>
              )}
            </div>
          ))}
          {requests.length === 0 && <div className="text-sm text-text-muted">No additional evidence requested yet.</div>}
        </div>
      </div>
    </div>
  );
}
