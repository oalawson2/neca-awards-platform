"use client";

import { useState, useTransition } from "react";
import { addSector } from "@/lib/actions/sectors";
import { Input } from "@/components/ui/Field";

export function AddSectorControl() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} className="text-xs text-info font-semibold">
        + Add
      </button>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Sector name"
        className="text-xs py-1.5 px-2 w-32"
      />
      <button
        className="text-xs text-success font-semibold"
        disabled={isPending || !name.trim()}
        onClick={() =>
          startTransition(async () => {
            await addSector(name);
            setName("");
            setAdding(false);
          })
        }
      >
        Save
      </button>
    </div>
  );
}
