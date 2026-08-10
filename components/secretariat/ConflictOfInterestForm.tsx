"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { recordJurorConflict } from "@/lib/actions/panels";
import type { PlatformUser } from "@/types/domain";

export function ConflictOfInterestForm({
  jurors,
  applications,
}: {
  jurors: PlatformUser[];
  applications: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [jurorId, setJurorId] = useState(jurors[0]?.id ?? "");
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState<"reassigned_panel" | "excused_from_applicant">("excused_from_applicant");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await recordJurorConflict({
        jurorId,
        applicationId: resolution === "excused_from_applicant" ? applicationId : null,
        reason,
        resolution,
      });
      if (!result.success) {
        setError(result.error ?? "Could not record conflict.");
        return;
      }
      setOpen(false);
      setReason("");
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Record conflict of interest
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Record a conflict of interest">
        {error && <div className="text-sm text-error mb-3">{error}</div>}
        <div className="mb-3.5">
          <Label>Juror</Label>
          <Select value={jurorId} onChange={(e) => setJurorId(e.target.value)}>
            {jurors.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="mb-3.5">
          <Label>Resolution</Label>
          <Select value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)}>
            <option value="excused_from_applicant">Excuse from a specific applicant (other 2 panel members cover it)</option>
            <option value="reassigned_panel">Reassign away from this sector cluster for the cycle</option>
          </Select>
        </div>
        {resolution === "excused_from_applicant" && (
          <div className="mb-3.5">
            <Label>Applicant</Label>
            <Select value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="mb-5">
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. former employer, family relationship" />
        </div>
        <div className="flex gap-2.5 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!reason.trim()} loading={isPending}>
            Record
          </Button>
        </div>
      </Modal>
    </>
  );
}
