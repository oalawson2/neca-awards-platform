"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { scheduleInterview } from "@/lib/actions/interviews";
import type { InterviewSession } from "@/types/domain";

/**
 * Repurposed from the old self-service availability-slot publisher (no
 * real backing — see lib/data/interviews.ts's docstring) into a worklist
 * of this juror's requested-but-unscheduled interviews, each with a
 * direct date/time entry once a time has been agreed off-platform.
 */
export function AvailabilityGrid({ interviews }: { interviews: (InterviewSession & { organizationName: string })[] }) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, { date: string; time: string; format: "virtual" | "physical" }>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  if (interviews.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-14 text-center text-sm text-text-muted">
        No interviews awaiting scheduling right now.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-8 py-8 sm:py-9">
      <h1 className="font-heading font-extrabold text-xl sm:text-[21px] text-navy mb-1">Schedule interviews</h1>
      <p className="text-[13px] text-text-muted mb-6">
        Once you&rsquo;ve agreed a time with the applicant (by email or phone), record it here.
      </p>
      <div className="flex flex-col gap-4">
        {interviews.map((session) => {
          const v = values[session.id] ?? { date: "", time: "", format: "virtual" as const };
          const saved = savedIds.has(session.id);
          return (
            <div key={session.id} className="border border-border rounded-2xl p-5">
              <div className="font-bold text-sm mb-3">{session.organizationName}</div>
              {saved ? (
                <div className="text-sm text-success">✓ Scheduled</div>
              ) : (
                <div className="grid sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label>Date</Label>
                    <input
                      type="date"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                      value={v.date}
                      onChange={(e) => setValues((p) => ({ ...p, [session.id]: { ...v, date: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <Label>Time (WAT)</Label>
                    <input
                      type="time"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                      value={v.time}
                      onChange={(e) => setValues((p) => ({ ...p, [session.id]: { ...v, time: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <Label>Format</Label>
                    <Select
                      value={v.format}
                      onChange={(e) => setValues((p) => ({ ...p, [session.id]: { ...v, format: e.target.value as "virtual" | "physical" } }))}
                    >
                      <option value="virtual">Virtual</option>
                      <option value="physical">Physical</option>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    className="sm:col-span-3"
                    disabled={isPending || !v.date || !v.time}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null);
                        const result = await scheduleInterview(session.applicationId, `${v.date}T${v.time}:00`);
                        if (!result.success) setError(result.error ?? "Could not schedule.");
                        else setSavedIds((prev) => new Set(prev).add(session.id));
                      })
                    }
                  >
                    Confirm scheduled time
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <div className="text-sm text-error mt-4">{error}</div>}
    </div>
  );
}
