import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { store } from "@/lib/mock/store";
import { SecretariatSidebar } from "@/components/layout/SecretariatSidebar";

export default async function SecretariatLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "secretariat") redirect("/login");

  const platformUser = store.users.find((u) => u.id === user.id);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <SecretariatSidebar userName={platformUser?.name ?? user.email} isSuperAdmin={!!platformUser?.isSuperAdmin} />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
