import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SecretariatSidebar } from "@/components/layout/SecretariatSidebar";

export default async function SecretariatLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "secretariat" && user.role !== "secretariat_super_admin")) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <SecretariatSidebar userName={user.fullName || user.email} isSuperAdmin={user.role === "secretariat_super_admin"} />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
