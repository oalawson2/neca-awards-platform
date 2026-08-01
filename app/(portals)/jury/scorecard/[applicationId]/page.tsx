import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplication } from "@/lib/data/applications";
import { getJurorScorecard } from "@/lib/data/scoring";
import { getCriteria } from "@/lib/data/sectors-criteria";
import { store } from "@/lib/mock/store";
import { ScorecardForm } from "@/components/jury/ScorecardForm";

export default async function JuryScorecardPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { applicationId } = await params;
  const application = await getApplication(applicationId);
  if (!application) notFound();

  const [scorecard, criteria] = await Promise.all([getJurorScorecard(applicationId, user.id), getCriteria()]);
  if (!scorecard) notFound();

  const jurorName = store.users.find((u) => u.id === user.id)?.name ?? user.email;

  if (scorecard.status === "submitted") {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="font-heading font-extrabold text-xl text-jury">Score already submitted</h1>
        <p className="text-sm text-text-muted mt-2">
          You submitted your scorecard for {application.organization.name} on{" "}
          {scorecard.submittedAt && new Date(scorecard.submittedAt).toLocaleDateString()}. Scores are final once
          submitted.
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
      criteria={criteria}
      scorecard={scorecard}
    />
  );
}
