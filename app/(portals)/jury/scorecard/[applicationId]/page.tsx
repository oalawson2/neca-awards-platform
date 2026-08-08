import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplication } from "@/lib/data/applications";
import { getJurorScorecards, getScorecardProgress } from "@/lib/data/scorecards";
import { store } from "@/lib/mock/store";
import { ScorecardForm } from "@/components/jury/ScorecardForm";
import type { ScorecardRound } from "@/types/domain";

export default async function JuryScorecardPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ round?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { applicationId } = await params;
  const { round: roundParam } = await searchParams;
  const round: ScorecardRound = roundParam === "employer_of_year" ? "employer_of_year" : "sector";

  const application = await getApplication(applicationId);
  if (!application) notFound();
  if (round === "employer_of_year" && !application.isEmployerOfYearFinalist) notFound();

  const [cards, progress] = await Promise.all([
    getJurorScorecards(applicationId, user.id, round),
    getScorecardProgress(applicationId, user.id, round),
  ]);
  const jurorName = store.users.find((u) => u.id === user.id)?.name ?? user.email;

  if (progress.isComplete) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="font-heading font-extrabold text-xl text-jury">Score already submitted</h1>
        <p className="text-sm text-text-muted mt-2">
          You submitted your {round === "employer_of_year" ? "Employer of the Year" : "pillar"} scorecard for{" "}
          {application.organization.name}. Scores are final once submitted.
        </p>
      </div>
    );
  }

  return (
    <ScorecardForm
      applicationId={applicationId}
      jurorId={user.id}
      jurorName={jurorName}
      organizationName={application.organization.name}
      initialCards={cards}
      round={round}
    />
  );
}
