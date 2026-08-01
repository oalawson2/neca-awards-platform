import { cn } from "@/lib/utils";

export function Avatar({ name, className, tone = "navy" }: { name: string; className?: string; tone?: "navy" | "jury" }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const bg = tone === "jury" ? "bg-jury" : "bg-navy";
  return (
    <div
      className={cn(
        "w-8 h-8 rounded-full text-white text-[13px] font-bold flex items-center justify-center flex-shrink-0",
        bg,
        className
      )}
    >
      {initial}
    </div>
  );
}
