import { getStaffAndJurors } from "@/lib/data/users";
import { getSectors } from "@/lib/data/sectors-criteria";
import { resendInviteFormAction } from "@/lib/actions/users";
import { Badge } from "@/components/ui/Badge";
import { InviteUserModal } from "@/components/secretariat/InviteUserModal";

export default async function UsersPage() {
  const [users, sectors] = await Promise.all([getStaffAndJurors(), getSectors()]);
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Users &amp; Roles</h1>
        <InviteUserModal sectors={sectors} />
      </div>

      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.8fr_1fr_1.4fr_1fr_90px] bg-bg px-4.5 py-2.5 text-[11px] font-bold text-[#AEB1BC]">
            <div>NAME</div>
            <div>ROLE</div>
            <div>SECTOR(S)</div>
            <div>STATUS</div>
            <div />
          </div>
          {users.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-1 sm:grid-cols-[1.8fr_1fr_1.4fr_1fr_90px] gap-1 sm:gap-0 px-4.5 py-3.5 border-t border-border items-center text-[13px]"
            >
              <div>
                <div className="font-semibold sm:font-normal">{u.name}</div>
                <div className="text-xs text-[#AEB1BC]">{u.email}</div>
              </div>
              <div>
                <Badge tone={u.role === "secretariat" ? "info" : "draft"} className={u.role === "jury" ? "!bg-[#EFE6FB] !text-[#5E3B9A]" : undefined}>
                  {u.role.toUpperCase()}
                  {u.isSuperAdmin ? " (ADMIN)" : ""}
                </Badge>
              </div>
              <div className="text-text-muted">{u.sectorIds?.map(sectorName).join(", ") || "—"}</div>
              <div className={u.status === "active" ? "text-success" : "text-warning"}>
                ● {u.status === "active" ? "Active" : "Invited"}
              </div>
              <div>
                {u.status === "invited" ? (
                  <form action={resendInviteFormAction.bind(null, u.id)}>
                    <button className="text-info text-xs">Resend</button>
                  </form>
                ) : (
                  <span className="text-xs text-[#AEB1BC]" title="Not implemented in this mock-data phase">
                    Edit
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
