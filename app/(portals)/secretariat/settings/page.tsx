import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * The old single advancement-threshold setting is gone — Section A
 * eligibility flagging is non-blocking now, and every other former
 * "settings" concern now has its own real, dedicated screen: shortlist
 * cutoffs live in Shortlisting, sectors and the assessment framework
 * live in Sectors & Framework, panel/sector assignment lives in Jury
 * Panels. This page is intentionally just a pointer, not a duplicate.
 */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "secretariat_super_admin") redirect("/secretariat");

  const links = [
    { href: "/secretariat/shortlisting", label: "Shortlisting", desc: "Per-sector shortlist count/percentage cutoffs" },
    { href: "/secretariat/criteria", label: "Sectors & Framework", desc: "Sector list and the assessment framework reference" },
    { href: "/secretariat/panels", label: "Jury Panels", desc: "Panel-sector cluster assignment and conflicts of interest" },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Settings</h1>
      </div>
      <div className="p-6 sm:p-9 overflow-y-auto flex-1">
        <p className="text-[13px] text-text-muted mb-5">Platform configuration now lives on its own dedicated screen per concern:</p>
        <div className="flex flex-col gap-3 max-w-md">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="border border-border rounded-2xl px-5 py-4 hover:border-navy transition-colors">
              <div className="font-bold text-sm text-navy-dark">{l.label}</div>
              <div className="text-xs text-text-muted mt-0.5">{l.desc}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
