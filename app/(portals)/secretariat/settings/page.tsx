import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { store } from "@/lib/mock/store";
import { getSettings, countBelowThreshold } from "@/lib/data/settings";
import { getDashboardStats } from "@/lib/data/applications";
import { ThresholdSlider } from "@/components/secretariat/ThresholdSlider";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const platformUser = user ? store.users.find((u) => u.id === user.id) : undefined;
  if (!platformUser?.isSuperAdmin) redirect("/secretariat");

  const [settings, stats] = await Promise.all([getSettings(), getDashboardStats()]);
  const belowCount = await countBelowThreshold(settings.advancementThresholdScore);

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Settings</h1>
      </div>
      <div className="p-6 sm:p-9 overflow-y-auto flex-1">
        <ThresholdSlider initialValue={settings.advancementThresholdScore} belowCount={belowCount} total={stats.total} />
      </div>
    </div>
  );
}
