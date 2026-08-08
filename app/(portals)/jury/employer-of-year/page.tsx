import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getEmployerOfYearFinalists } from "@/lib/data/winners";
import { getJurorScorecards } from "@/lib/data/scorecards";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/**
 * Deliberately NOT gated by panel — doc section 11.6: every one of the 9
 * jurors scores every finalist from scratch, "including jurors from the
 * finalist's own panel, who score again with the benefit of seeing all
 * finalists side by side." Panel independence (getApplicationsForJurorPanel)
 * only applies to the Stage 2 sector round.
 */
export default async function JuryEmployerOfYearPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const finalists = await getEmployerOfYearFinalists();
  const withStatus = await Promise.all(
    finalists.map(async (f) => {
      const cards = await getJurorScorecards(f.id, user.id, "employer_of_year");
      const submitted = cards.filter((c) => c.submittedAt).length;
      return { finalist: f, submitted };
    })
  );

  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 sm:py-10">
      <h1 className="font-heading font-extrabold text-xl sm:text-[22px] text-jury mb-1.5">Employer of the Year — finalists</h1>
      <p className="text-[13px] text-text-muted mb-6 leading-relaxed">
        Every sectoral winner, across all sectors. Score each finalist independently, from scratch, exactly as at
        Stage 2 — even for applicants you scored before.
      </p>

      <div className="flex flex-col gap-3">
        {withStatus.map(({ finalist, submitted }) => (
          <div key={finalist.id} className="border border-border rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-bold text-[15px]">{finalist.organization.name}</div>
              <div className="text-xs text-text-muted">Sectoral winner</div>
            </div>
            <div className="flex items-center gap-3">
              {submitted === 8 ? (
                <Badge tone="success">SUBMITTED</Badge>
              ) : (
                <LinkButton size="sm" href={`/jury/scorecard/${finalist.id}?round=employer_of_year`}>
                  Score →
                </LinkButton>
              )}
            </div>
          </div>
        ))}
        {finalists.length === 0 && (
          <div className="text-sm text-text-muted border border-border rounded-2xl p-6">
            No finalists yet — the Secretariat convenes this round once every sectoral winner is confirmed.
          </div>
        )}
      </div>
    </div>
  );
}
