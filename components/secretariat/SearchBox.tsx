"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/Field";

export function SearchBox({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <Input
      placeholder={placeholder}
      defaultValue={searchParams.get("q") ?? ""}
      className="sm:w-64"
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set("q", e.target.value);
        else params.delete("q");
        startTransition(() => router.replace(`${pathname}?${params.toString()}`));
      }}
    />
  );
}
