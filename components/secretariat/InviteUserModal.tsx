"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { inviteUser } from "@/lib/actions/users";
import type { Sector } from "@/types/domain";

export function InviteUserModal({ sectors }: { sectors: Sector[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"secretariat" | "jury">("jury");
  const [sectorId, setSectorId] = useState(sectors[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await inviteUser({ name, email, role, sectorIds: role === "jury" ? [sectorId] : undefined });
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
        <div className="mb-3.5">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </div>
        {role === "jury" && (
          <div className="mb-5">
            <Label>Sector(s)</Label>
            <Select value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
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
