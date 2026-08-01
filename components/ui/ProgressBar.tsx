import { cn } from "@/lib/utils";

export function ProgressBar({ percent, color = "gold", className }: { percent: number; color?: "gold" | "success"; className?: string }) {
  const barColor = color === "success" ? "bg-success" : "bg-gold";
  return (
    <div className={cn("h-1.5 rounded-full bg-border", className)}>
      <div className={cn("h-1.5 rounded-full", barColor)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}
