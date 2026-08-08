import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getSectorWinnerGroups,
  getEmployerOfYearFinalists,
  getEmployerOfYearResults,
  getEmployerOfYearValidation,
} from "@/lib/data/winners";
import { SectorWinnerPicker } from "@/components/secretariat/SectorWinnerPicker";
import { EmployerOfYearPanel } from "@/components/secretariat/EmployerOfYearPanel";

export default async function WinnersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [groups, finalists, results, validation] = await Promise.all([
    getSectorWinnerGroups(),
    getEmployerOfYearFinalists(),
    getEmployerOfYearResults(),
    getEmployerOfYearValidation(),
  ]);
  const finalistNames = Object.fromEntries(finalists.map((f) => [f.id, f.organization.name]));

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Winners</h1>
      </div>
      <div className="p-6 sm:p-7 overflow-y-auto flex-1 flex flex-col gap-5">
        <div>
          <div className="text-xs font-bold text-[#AEB1BC] mb-2.5">SECTORAL WINNERS</div>
          <div className="flex flex-col gap-3.5">
            {groups.map((group) => (
              <SectorWinnerPicker key={group.sectorId} group={group} />
            ))}
            {groups.length === 0 && (
              <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
                No fully-scored applications yet.
              </div>
            )}
          </div>
        </div>

        <EmployerOfYearPanel
          hasFinalists={finalists.length > 0}
          results={results}
          finalistNames={finalistNames}
          validation={validation}
          currentUserId={user.id}
          currentUserName={user.fullName || user.email}
        />
      </div>
    </div>
  );
}
