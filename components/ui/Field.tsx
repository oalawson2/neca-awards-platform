import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

const FIELD_BASE =
  "w-full box-border px-3.5 py-3 border-[1.5px] border-[#E3E4EA] rounded-xl text-sm font-body focus:outline-none focus:border-navy transition-colors";

export function Label({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <label className={cn("text-[13px] font-semibold block mb-[7px]", error ? "text-error" : "text-text")}>
      {children}
    </label>
  );
}

export function HelpText({ children, error }: { children: ReactNode; error?: boolean }) {
  return <div className={cn("text-xs mt-[5px]", error ? "text-error" : "text-text-muted")}>{children}</div>;
}

export function Input({ className, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={cn(FIELD_BASE, error && "border-error", className)} {...props} />;
}

export function Textarea({ className, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={cn(FIELD_BASE, "font-body", error && "border-error", className)} {...props} />;
}

export function Select({ className, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select className={cn(FIELD_BASE, "bg-white", error && "border-error", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("flex gap-2.5 items-start text-[13px] text-[#5B5F6B] leading-relaxed cursor-pointer", className)}>
      <input type="checkbox" className="mt-0.5 w-4 h-4 accent-navy flex-shrink-0" {...props} />
      <span>{label}</span>
    </label>
  );
}
