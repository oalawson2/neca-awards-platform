"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";

const STEPS = [
  { href: "/applicant/profile", label: "Profile Setup" },
  { href: "/applicant/questionnaire", label: "Questionnaire" },
  { href: "/applicant/documents", label: "Documents" },
  { href: "/applicant/interview", label: "Interview" },
  { href: "/applicant/report", label: "Report" },
];

export function ApplicantNav({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();

  return (
    <>
      <header className="h-17 bg-white border-b border-border flex items-center justify-between px-6 sm:px-8">
        <div className="flex items-center gap-4 sm:gap-7 min-w-0">
          <Link href="/applicant" className="flex-shrink-0">
            <Image src="/neca-logo.png" alt="NECA Excellence Awards" width={104} height={26} className="h-6 w-auto" />
          </Link>
          <nav className="hidden md:flex gap-1.5">
            {STEPS.map((step) => {
              const active = pathname.startsWith(step.href);
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className={cn(
                    "text-[13px] font-semibold px-4 py-2 rounded-full transition-colors",
                    active ? "text-navy bg-[#F1F1FB]" : "text-[#AEB1BC] hover:text-navy"
                  )}
                >
                  {step.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="hidden sm:inline text-[13px] text-[#5B5F6B] truncate max-w-[220px]">{organizationName}</span>
          <Avatar name={organizationName || "A"} />
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 inset-x-0 h-15 bg-white border-t border-border flex items-center justify-around z-40">
        {STEPS.map((step) => {
          const active = pathname.startsWith(step.href);
          return (
            <Link key={step.href} href={step.href} className="flex flex-col items-center gap-1">
              <div className={cn("w-[18px] h-[18px] rounded-md", active ? "bg-gold" : "bg-border")} />
              <span className={cn("text-[9px]", active ? "font-semibold text-navy" : "text-[#AEB1BC]")}>
                {step.label.split(" ")[0]}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
