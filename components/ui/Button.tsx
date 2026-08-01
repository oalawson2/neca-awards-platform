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

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
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
