import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type BadgeTone = "draft" | "review" | "success" | "error" | "winner" | "neutral" | "info";

const TONE_CLASSES: Record<BadgeTone, string> = {
  draft: "bg-[#EDEEFB] text-navy",
  review: "bg-[#FFF1D9] text-warning",
  success: "bg-[#E6F4E6] text-success",
  error: "bg-[#FCE8E8] text-error",
  winner: "bg-navy text-white",
  neutral: "bg-[#F4F4F8] text-text-muted",
  info: "bg-[#DEE1FA] text-navy",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block text-xs font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "draft",
  awaiting_review: "review",
  incomplete: "error",
  scoring: "info",
  scored: "success",
  released: "winner",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "DRAFT",
  awaiting_review: "AWAITING REVIEW",
  incomplete: "INCOMPLETE",
  scoring: "IN SCORING",
  scored: "SCORED",
  released: "RELEASED",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status.toUpperCase()}</Badge>;
}
