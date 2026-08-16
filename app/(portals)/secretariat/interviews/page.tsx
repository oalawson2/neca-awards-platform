import { getPanelsWithDetails } from "@/lib/data/panels";
import { getSlotsForPanel } from "@/lib/data/interviewSlots";
import { InterviewSlotsPanel } from "@/components/secretariat/InterviewSlotsPanel";

export default async function SecretariatInterviewsPage() {
  const panels = await getPanelsWithDetails();
  const slotsByPanel = await Promise.all(panels.map((p) => getSlotsForPanel(p.id)));

  return (
    <div className="flex flex-col h-full">
      <div className="h-17 border-b border-border flex items-center px-6 sm:px-7 flex-shrink-0">
        <h1 className="font-heading font-extrabold text-[19px] text-navy-dark">Interview Slots</h1>
      </div>

      <div className="p-6 sm:p-7 overflow-y-auto flex-1">
        {panels.length === 0 ? (
          <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
            No panels exist yet — create them on the Jury Panels screen first.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {panels.map((panel, i) => (
              <InterviewSlotsPanel key={panel.id} panelId={panel.id} panelName={panel.name} slots={slotsByPanel[i]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
