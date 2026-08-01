import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationsForJuror } from "@/lib/data/applications";
import { getSectors } from "@/lib/data/sectors-criteria";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";

const SCORECARD_LABEL: Record<string, string> = {
  not_started: "NOT STARTED",
  in_progress: "IN PROGRESS",
  submitted: "SUBMITTED",
};

export default async function JuryDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [companies, sectors] = await Promise.all([getApplicationsForJuror(user.id), getSectors()]);
  const sectorNames = Array.from(new Set(companies.map((c) => sectors.find((s) => s.id === c.sectorId)?.name))).filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-2xl text-jury mb-1.5">Your assigned companies</h1>
      <p className="text-[13px] text-text-muted mb-7">
        {sectorNames.join(" & ")} sector{sectorNames.length > 1 ? "s" : ""} · {companies.length} companies
      </p>

      <div className="flex flex-col gap-3">
        {companies.map((c) => (
          <div
            key={c.id}
            className="border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <div className="font-bold text-[15px]">{c.organization.name}</div>
              <div className="text-[13px] text-text-muted">{sectors.find((s) => s.id === c.sectorId)?.name}</div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge tone={c.myScorecardStatus === "submitted" ? "success" : c.myScorecardStatus === "in_progress" ? "review" : "error"}>
                {SCORECARD_LABEL[c.myScorecardStatus]}
              </Badge>
              {c.myScorecardStatus === "submitted" ? (
                <LinkButton variant="secondary" size="sm" href={`/jury/scorecard/${c.id}`}>
                  View
                </LinkButton>
              ) : (
                <div className="flex gap-2">
                  <LinkButton variant="secondary" size="sm" href={`/jury/documents/${c.id}`}>
                    Review documents
                  </LinkButton>
                  <LinkButton size="sm" href={`/jury/scorecard/${c.id}`}>
                    {c.myScorecardStatus === "in_progress" ? "Continue →" : "Score now →"}
                  </LinkButton>
                </div>
              )}
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
            No companies are currently assigned to your sector(s).
          </div>
        )}
      </div>
    </div>
  );
}
