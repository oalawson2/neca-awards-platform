"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input, Select } from "@/components/ui/Field";
import type { Sector } from "@/types/domain";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "eligibility_flagged", label: "Eligibility flagged" },
  { value: "ranked", label: "Ranked" },
  { value: "not_shortlisted", label: "Not shortlisted" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "in_stage2", label: "Stage 2 (verification / interview)" },
  { value: "stage2_scored", label: "Scored" },
  { value: "sector_finalist", label: "Sector finalist" },
  { value: "sector_winner", label: "Sector winner" },
  { value: "eoy_finalist", label: "EOY finalist" },
  { value: "eoy_winner", label: "EOY winner" },
];

export function ApplicationsFilterBar({ sectors }: { sectors: Sector[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2.5">
      <Input
        placeholder="Search organization…"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => updateParam("q", e.target.value)}
        className="flex-1"
      />
      <Select defaultValue={searchParams.get("sector") ?? ""} onChange={(e) => updateParam("sector", e.target.value)} className="sm:w-56">
        <option value="">All sectors</option>
        {sectors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select defaultValue={searchParams.get("status") ?? ""} onChange={(e) => updateParam("status", e.target.value)} className="sm:w-56">
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
