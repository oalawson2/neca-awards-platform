import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { getApplication } from "@/lib/data/applications";
import { StatusBadge } from "@/components/ui/Badge";
import { ComingSoon } from "@/components/ui/ComingSoon";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const application = await getApplication(id);
  if (!application) notFound();

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 sm:px-7 py-5.5 border-b border-border">
        <Link href="/secretariat" className="text-xs text-info">
          ← Back to applications
        </Link>
        <div className="flex justify-between items-center flex-wrap gap-3 mt-2.5">
          <div>
            <div className="font-heading font-extrabold text-xl text-navy-dark">
              {application.organization.name || "(unnamed organization)"}
            </div>
            <div className="text-[13px] text-text-muted">Submitted {formatDate(application.submittedAt)}</div>
          </div>
          <StatusBadge status={application.status} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ComingSoon
          title="Responses, documents & score breakdown"
          phase="the question engine, document checklist, and jury scorecard builds (tasks #27, #28, #33)"
        />
      </div>
    </div>
  );
}
