import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cn("bg-white border border-border rounded-2xl", padded && "p-5", className)}>{children}</div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between px-5 py-4 bg-bg border-b border-border", className)}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, tone = "navy" }: { label: string; value: ReactNode; tone?: "navy" | "warning" | "info" | "success" }) {
  const toneClass = { navy: "text-navy", warning: "text-warning", info: "text-info", success: "text-success" }[tone];
  return (
    <div className="border border-border rounded-2xl px-[18px] py-4">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={cn("font-heading font-extrabold text-2xl mt-0.5", toneClass)}>{value}</div>
    </div>
  );
}
