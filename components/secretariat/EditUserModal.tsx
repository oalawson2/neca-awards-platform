"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Label, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { editUser, deactivateUser, reactivateUser } from "@/lib/actions/users";
import type { PlatformUser } from "@/types/domain";

/**
 * One modal covers both editing basic details and deactivating/
 * reactivating — they're the same "manage this account" action from the
 * user's point of view, triggered from the same row.
 */
export function EditUserModal({ user }: { user: PlatformUser }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<"secretariat" | "jury">(user.role === "jury" ? "jury" : "secretariat");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTogglingStatus, startTogglingStatus] = useTransition();

  const isDeactivated = user.status === "deactivated";

  function openModal() {
    setName(user.name);
    setRole(user.role === "jury" ? "jury" : "secretariat");
    setError(null);
    setOpen(true);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await editUser(user.id, { name, role });
      if (!result.success) {
        setError(result.error ?? "Could not save changes.");
        return;
      }
      setOpen(false);
    });
  }

  function toggleStatus() {
    setError(null);
    startTogglingStatus(async () => {
      const result = isDeactivated ? await reactivateUser(user.id) : await deactivateUser(user.id);
      if (!result.success) {
        setError(result.error ?? "Could not update this account's status.");
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button onClick={openModal} className="text-info text-xs">
        Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Edit ${user.role === "jury" ? "juror" : "Secretariat member"}`}>
        {error && <div className="text-sm text-error mb-3">{error}</div>}
        {isDeactivated && (
          <div className="text-xs text-warning mb-3.5 bg-[#FDF3E3] rounded-xl px-3.5 py-2.5">
            This account is deactivated — they can&rsquo;t sign in until reactivated.
          </div>
        )}
        <div className="mb-3.5">
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as "secretariat" | "jury")} disabled={user.isSuperAdmin}>
            <option value="jury">Juror</option>
            <option value="secretariat">Secretariat staff</option>
          </Select>
          {user.isSuperAdmin && <p className="text-xs text-text-muted mt-1.5">Super admin role can&rsquo;t be changed here.</p>}
        </div>
        <div className="mb-5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div className="flex items-center justify-between gap-2.5">
          <button
            onClick={toggleStatus}
            disabled={isTogglingStatus}
            className={isDeactivated ? "text-success text-xs" : "text-error text-xs"}
          >
            {isTogglingStatus ? "Working…" : isDeactivated ? "Reactivate account" : "Deactivate account"}
          </button>
          <div className="flex gap-2.5">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} disabled={!name} loading={isPending}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
