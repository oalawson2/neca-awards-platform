import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { store } from "@/lib/mock/store";
import { ComingSoon } from "@/components/ui/ComingSoon";

/**
 * The old advancement-threshold setting is gone — Section A eligibility
 * flagging is non-blocking now, and shortlisting is per sector/size
 * category (task #34) rather than a single platform-wide score cutoff.
 */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  const platformUser = user ? store.users.find((u) => u.id === user.id) : undefined;
  if (!platformUser?.isSuperAdmin) redirect("/secretariat");

  return <ComingSoon title="Settings" phase="the shortlisting configuration build (task #34)" />;
}
