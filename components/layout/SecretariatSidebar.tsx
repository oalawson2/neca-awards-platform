"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { signOut } from "@/lib/auth/actions";

const NAV_ITEMS = [
  { href: "/secretariat", label: "Dashboard" },
  { href: "/secretariat/live-scoring", label: "Live Scoring" },
  { href: "/secretariat/users", label: "Users & Roles" },
  { href: "/secretariat/criteria", label: "Sectors & Framework" },
  { href: "/secretariat/panels", label: "Jury Panels" },
  { href: "/secretariat/ai-reports", label: "AI Reports" },
  { href: "/secretariat/winners", label: "Winners" },
  { href: "/secretariat/audit-log", label: "Audit Log" },
];

function isActive(pathname: string, href: string) {
  return href === "/secretariat" ? pathname === "/secretariat" : pathname.startsWith(href);
}

function NavLinks({ items, onNavigate, pathname }: { items: typeof NAV_ITEMS; onNavigate?: () => void; pathname: string }) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "text-[13px] px-4 py-[11px] rounded-full transition-colors",
            isActive(pathname, item.href) ? "text-white font-bold bg-white/[0.14]" : "text-[#B7B9D6] hover:text-white"
          )}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function SecretariatSidebar({ userName, isSuperAdmin }: { userName: string; isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = isSuperAdmin ? [...NAV_ITEMS, { href: "/secretariat/settings", label: "Settings" }] : NAV_ITEMS;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-shrink-0 bg-navy-dark flex-col gap-0.5 px-4 py-6">
        <div className="px-2 pb-[22px]">
          <Image src="/neca-logo.png" alt="" width={104} height={26} className="h-6 w-auto brightness-0 invert" />
        </div>
        <NavLinks items={items} pathname={pathname} />
        <form action={signOut} className="mt-auto pt-4">
          <button className="text-[13px] text-[#B7B9D6] hover:text-white px-4 py-[11px] w-full text-left">Sign out</button>
        </form>
      </aside>

      {/* Tablet icon rail */}
      <aside className="hidden md:flex lg:hidden w-16 flex-shrink-0 bg-navy-dark flex-col items-center py-5 gap-3">
        <Image src="/neca-logo.png" alt="" width={80} height={20} className="h-5 w-auto brightness-0 invert mb-1.5" />
        <button onClick={() => setDrawerOpen(true)} className="w-[30px] h-[30px] rounded-[10px] bg-white/[0.16] text-white text-xs">
          ☰
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden h-14 bg-navy-dark flex items-center justify-between px-4 sticky top-0 z-30">
        <button onClick={() => setDrawerOpen(true)} className="w-5 flex flex-col gap-1">
          <span className="h-0.5 bg-white rounded-full" />
          <span className="h-0.5 bg-white rounded-full" />
          <span className="h-0.5 bg-white rounded-full" />
        </button>
        <span className="font-heading font-bold text-[13px] text-white">NECA Secretariat</span>
        <Avatar name={userName} />
      </header>

      {/* Drawer for tablet/mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:items-stretch" onClick={() => setDrawerOpen(false)}>
          <div className="w-64 bg-navy-dark flex flex-col gap-0.5 px-4 py-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 pb-[22px]">
              <Image src="/neca-logo.png" alt="" width={104} height={26} className="h-6 w-auto brightness-0 invert" />
              <button onClick={() => setDrawerOpen(false)} className="text-white text-lg">
                ✕
              </button>
            </div>
            <NavLinks items={items} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <form action={signOut} className="mt-auto pt-4">
              <button className="text-[13px] text-[#B7B9D6] hover:text-white px-4 py-[11px] w-full text-left">Sign out</button>
            </form>
          </div>
          <div className="flex-1 bg-black/30" />
        </div>
      )}
    </>
  );
}
