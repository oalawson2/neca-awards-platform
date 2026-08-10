import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Variant = "primary" | "gold" | "secondary" | "tertiary" | "danger";
type Size = "md" | "sm";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-dark disabled:bg-[#F1F1F5] disabled:text-[#B7B9C4]",
  gold: "bg-gold text-white hover:brightness-95 disabled:bg-[#F1F1F5] disabled:text-[#B7B9C4]",
  secondary: "bg-white text-navy border-[1.5px] border-navy hover:bg-[#F1F1FB] disabled:border-[#E3E4EA] disabled:text-[#B7B9C4]",
  tertiary: "bg-transparent text-navy hover:underline px-1.5 py-3",
  danger: "bg-white text-error border-[1.5px] border-error hover:bg-[#FCE8E8]",
};

const SIZE_CLASSES: Record<Size, string> = {
  md: "px-[22px] py-[13px] text-[14px]",
  sm: "px-4 py-[10px] text-[13px]",
};

function buttonClasses(variant: Variant, size: Size, className?: string) {
  return cn(
    "font-semibold rounded-xl cursor-pointer transition-colors disabled:cursor-not-allowed whitespace-nowrap inline-block text-center",
    variant !== "tertiary" && SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    className
  );
}

/** Small inline spinner — no external dependency, just Tailwind's built-in animate-spin. Exported for the handful of custom-styled raw `<button>` elements that can't use Button's `loading` prop directly (bespoke per-state classNames Button's variant system doesn't cover) but should still show the same feedback. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/**
 * `loading` is the standard way every button-triggered action in this app
 * shows pending state: pass the same boolean an action's isPending/
 * useTransition (or an explicit "is this specific button's request still
 * in flight" state) already tracks. Disables the button and swaps in a
 * spinner next to the existing label — callers don't need to also change
 * their button text to something like "Saving…" (though they still can),
 * since the spinner alone gives the immediate-feedback signal this exists
 * for.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Spinner className="w-3.5 h-3.5" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** Same visual variants as Button, but renders a Next.js Link (for navigation, not form submission). */
export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; href: string }) {
  return <Link href={href} className={buttonClasses(variant, size, className)} {...props} />;
}
