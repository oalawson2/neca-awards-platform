import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationsForJurorPanel } from "@/lib/data/applications";
import { getPanelForJuror } from "@/lib/data/users";
import { getSectors } from "@/lib/data/sectors";
import { getInterviewSession } from "@/lib/data/interviews";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";

export default async function JuryDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [companies, sectors, panel] = await Promise.all([
    getApplicationsForJurorPanel(user.id),
    getSectors(),
    getPanelForJuror(user.id),
  ]);
  const interviewSessions = Object.fromEntries(
    await Promise.all(companies.map(async (c) => [c.id, await getInterviewSession(c.id)] as const))
  );

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-2xl text-jury mb-1.5">Your assigned companies</h1>
      <p className="text-[13px] text-text-muted mb-7">
        {panel?.name ?? "No panel assigned"} · {companies.length} companies
      </p>

      <div className="flex flex-col gap-3">
        {companies.map((c) => (
          <div
            key={c.id}
            className="border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <div className="font-bold text-[15px]">{c.organization.name}</div>
              <div className="text-[13px] text-text-muted">{sectors.find((s) => s.id === c.organization.sectorId)?.name}</div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {c.eligibilityFlagged && <Badge tone="error">ELIGIBILITY FLAGGED</Badge>}
              <StatusBadge status={c.status} />
              <div className="flex gap-2">
                <LinkButton variant="secondary" size="sm" href={`/jury/documents/${c.id}`}>
                  Review documents
                </LinkButton>
                {interviewSessions[c.id] && (
                  <LinkButton variant="secondary" size="sm" href={`/jury/interview/${c.id}`}>
                    Interview
                  </LinkButton>
                )}
                <LinkButton size="sm" href={`/jury/scorecard/${c.id}`}>
                  Scorecard →
                </LinkButton>
              </div>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
            No companies are currently in your panel&rsquo;s assigned sectors.
          </div>
        )}
      </div>
    </div>
  );
}
