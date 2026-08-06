"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { inviteUser } from "@/lib/actions/users";

/**
 * Sector assignment isn't part of inviting a juror anymore — jurors join
 * one of the 3 fixed panels, assigned separately by the Secretariat once
 * they accept (see task #30's panel-assignment build-out).
 */
export function InviteUserModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"secretariat" | "jury">("jury");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await inviteUser({ name, email, role });
      if (!result.success) {
        setError(result.error ?? "Could not send invite.");
        return;
      }
      setOpen(false);
      setName("");
      setEmail("");
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Invite user
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Invite a ${role === "jury" ? "juror" : "Secretariat member"}`}>
        {error && <div className="text-sm text-error mb-3">{error}</div>}
        <div className="mb-3.5">
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as "secretariat" | "jury")}>
            <option value="jury">Juror</option>
            <option value="secretariat">Secretariat staff</option>
          </Select>
        </div>
        <div className="mb-3.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="mb-5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </div>
        {role === "jury" && (
          <p className="text-xs text-text-muted mb-5 -mt-2 leading-relaxed">
            Panel assignment (one of the 3 fixed panels) happens separately, once this juror accepts their invite.
          </p>
        )}
        <div className="flex gap-2.5 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={isPending || !email}>
            Send invite
          </Button>
        </div>
      </Modal>
    </>
  );
}
