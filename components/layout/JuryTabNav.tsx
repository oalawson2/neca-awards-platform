"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { signOut } from "@/lib/auth/actions";

export function JuryTabNav({ userName, defaultApplicationId }: { userName: string; defaultApplicationId?: string }) {
  const pathname = usePathname();

  const items = [
    { href: "/jury", label: "Dashboard", short: "Dashboard" },
    { href: defaultApplicationId ? `/jury/documents/${defaultApplicationId}` : "/jury", match: "/jury/documents", label: "Documents", short: "Docs" },
    { href: defaultApplicationId ? `/jury/scorecard/${defaultApplicationId}` : "/jury", match: "/jury/scorecard", label: "Scorecard", short: "Score" },
    { href: "/jury/availability", label: "Availability", short: "Available" },
    { href: "/jury/employer-of-year", label: "Employer of the Year", short: "EOTY" },
  ];

  return (
    <>
      <header className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-10">
        <div className="flex items-center gap-4 sm:gap-7 min-w-0">
          <Link href="/jury" className="flex-shrink-0">
            <Image src="/neca-logo.png" alt="NECA Excellence Awards" width={104} height={26} className="h-6 w-auto" />
          </Link>
          <nav className="hidden md:flex gap-1.5">
            {items.map((item) => {
              const active = pathname === item.href || (item.match && pathname.startsWith(item.match));
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "text-[13px] font-semibold px-[18px] py-[9px] rounded-full transition-colors",
                    active ? "text-white bg-jury" : "text-[#AEB1BC] hover:text-jury"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden sm:flex items-center gap-3.5">
          <span className="text-[13px] text-[#5B5F6B]">{userName}</span>
          <Avatar name={userName} tone="jury" />
          <form action={signOut}>
            <button type="submit" className="text-[13px] text-[#5B5F6B] hover:text-jury">
              Sign out
            </button>
          </form>
        </div>
        <div className="flex sm:hidden items-center gap-2.5">
          <Avatar name={userName} tone="jury" />
          <form action={signOut}>
            <button type="submit" className="text-[12px] text-[#5B5F6B]">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <nav className="md:hidden fixed bottom-0 inset-x-0 h-15 bg-white border-t border-border flex items-center justify-around z-40">
        {items.map((item) => {
          const active = pathname === item.href || (item.match && pathname.startsWith(item.match));
          return (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1">
              <div className={cn("w-[18px] h-[18px] rounded-md", active ? "bg-jury" : "bg-border")} />
              <span className={cn("text-[9px]", active ? "font-semibold text-jury" : "text-[#AEB1BC]")}>{item.short}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
