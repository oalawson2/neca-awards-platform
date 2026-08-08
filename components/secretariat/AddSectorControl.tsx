"use client";

import { useState, useTransition } from "react";
import { addSector } from "@/lib/actions/sectors";
import { Input, Select } from "@/components/ui/Field";
import type { SectorCategoryOption } from "@/lib/data/sectors";

export function AddSectorControl({ categories }: { categories: SectorCategoryOption[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!adding) {
    return (
      <button onClick={() => setAdding(true)} className="text-xs text-info font-semibold">
        + Add
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="text-xs py-1.5 px-2">
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
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
          disabled={isPending || !name.trim() || !categoryId}
          onClick={() =>
            startTransition(async () => {
              const result = await addSector(name, categoryId);
              if (!result.success) {
                setError(result.error ?? "Could not add sector.");
                return;
              }
              setName("");
              setError(null);
              setAdding(false);
            })
          }
        >
          Save
        </button>
      </div>
      {error && <div className="text-[11px] text-error">{error}</div>}
    </div>
  );
}
