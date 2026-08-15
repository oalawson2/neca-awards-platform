import { getPanelsWithDetails, getJurorConflicts, getUnassignedSectorCategoryIds } from "@/lib/data/panels";
import { getSectorCategories } from "@/lib/data/sectors";
import { getApplications } from "@/lib/data/applications";
import { getStaffAndJurors } from "@/lib/data/users";
import { PanelSectorAssignment } from "@/components/secretariat/PanelSectorAssignment";
import { JurorPanelAssignment } from "@/components/secretariat/JurorPanelAssignment";
import { ConflictOfInterestForm } from "@/components/secretariat/ConflictOfInterestForm";
import { CreatePanelsButton } from "@/components/secretariat/CreatePanelsButton";
import { formatDate } from "@/lib/utils";

export default async function PanelsPage() {
  const [panels, sectorCategories, unassignedSectorCategoryIds, conflicts, applications, staffAndJurors] = await Promise.all([
    getPanelsWithDetails(),
    getSectorCategories(),
    getUnassignedSectorCategoryIds(),
    getJurorConflicts(),
    getApplications(),
    getStaffAndJurors(),
  ]);
  const unassignedSectors = sectorCategories.filter((s) => unassignedSectorCategoryIds.includes(s.id));
  const jurors = staffAndJurors.filter((u) => u.role === "jury");
  const assignedJurorIds = new Set(panels.flatMap((p) => p.jurorIds));
  const unassignedJurors = jurors.filter((j) => !assignedJurorIds.has(j.id));
  const applicationOptions = applications.map((a) => ({ id: a.id, name: a.organization.name || a.referenceNo }));

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center justify-between px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Jury Panels</h1>
        {panels.length > 0 && <ConflictOfInterestForm jurors={jurors} applications={applicationOptions} />}
      </div>

      <div className="p-6 sm:p-7 overflow-y-auto flex-1 flex flex-col gap-5">
        {panels.length === 0 ? (
          <div className="border border-border rounded-2xl p-8 text-center flex flex-col items-center gap-3">
            <div className="text-sm text-text-muted max-w-sm">
              No panels configured yet. NECA uses exactly 3 fixed panels — create them once, then assign sectors and
              jurors to each.
            </div>
            <CreatePanelsButton />
          </div>
        ) : (
          <>
            {unassignedSectors.length > 0 && (
              <div className="bg-[#FFF1D9] text-warning text-[13px] rounded-xl px-4 py-3">
                {unassignedSectors.length} sector{unassignedSectors.length > 1 ? "s" : ""} not yet assigned to a panel:{" "}
                {unassignedSectors.map((s) => s.name).join(", ")}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
              {panels.map((panel) => (
                <div key={panel.id} className="border border-border rounded-2xl p-5">
                  <div className="font-bold text-sm text-navy-dark mb-1">{panel.name}</div>
                  <div className="text-xs text-text-muted mb-3.5">
                    {panel.shortlistedCount} shortlisted applicant{panel.shortlistedCount === 1 ? "" : "s"}
                  </div>
                  <div className="text-xs font-bold text-[#AEB1BC] mb-2">ASSIGNED SECTORS</div>
                  <PanelSectorAssignment
                    panelId={panel.id}
                    assignedSectorIds={panel.sectorCategoryIds}
                    unassignedSectors={unassignedSectors}
                    allSectors={sectorCategories}
                  />
                  <JurorPanelAssignment
                    panelId={panel.id}
                    assignedJurorIds={panel.jurorIds}
                    assignedJurorNames={panel.jurorNames}
                    unassignedJurors={unassignedJurors}
                  />
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-bold text-[#AEB1BC] mb-2.5">CONFLICTS OF INTEREST</div>
              {conflicts.length === 0 ? (
                <div className="text-sm text-text-muted border border-border rounded-2xl p-5">None recorded.</div>
              ) : (
                <div className="border border-border rounded-2xl overflow-hidden">
                  {conflicts.map((c) => {
                    const juror = jurors.find((j) => j.id === c.jurorId);
                    const app = applicationOptions.find((a) => a.id === c.applicationId);
                    return (
                      <div key={c.id} className="px-4.5 py-3.5 border-b last:border-b-0 border-border text-[13px] flex justify-between gap-3">
                        <div>
                          <span className="font-semibold">{juror?.name ?? c.jurorId}</span> — {c.reason}
                          {app && <span className="text-text-muted"> (excused from {app.name})</span>}
                          {c.resolution === "reassigned_panel" && <span className="text-text-muted"> (reassigned away from cluster)</span>}
                        </div>
                        <div className="text-text-muted flex-shrink-0">{formatDate(c.createdAt)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
