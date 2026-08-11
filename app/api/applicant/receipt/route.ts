import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";
import { PAGE_HEIGHT, PAGE_WIDTH, SimplePdfPage, renderSimplePdf } from "@/lib/pdf/simplePdf";

/**
 * Generates a real one-page PDF submission receipt on demand — was
 * previously a permanently-disabled button ("not wired up in this
 * mock-data phase"). Auth is the same scoping getApplicationForApplicantUser
 * already does (organizations.created_by = the signed-in user), so this
 * can only ever produce the caller's own receipt, never anyone else's.
 *
 * Originally built on pdf-lib. Replaced with lib/pdf/simplePdf.ts (no
 * dependency) once pdf-lib's ~24MB of embedded font data turned out to be
 * enough, on top of everything else, to push `next build` past our 1GB
 * hosting cap — see next.config.ts's build-memory notes. A dynamic
 * import() of pdf-lib was tried and reverted first (see git history on
 * this file) since it risked breaking the standalone deploy for an
 * unproven memory win; removing the dependency outright is the version of
 * this fix that's actually guaranteed to help, since it's zero bytes of
 * pdf-lib in the build at all rather than a hope about how it's chunked.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) return NextResponse.json({ error: "No application found." }, { status: 404 });
  if (!application.submittedAt) {
    return NextResponse.json({ error: "This application hasn't been submitted yet." }, { status: 400 });
  }

  const navy: [number, number, number] = [0x25 / 255, 0x1c / 255, 0x5b / 255];
  const muted: [number, number, number] = [0x5b / 255, 0x5f / 255, 0x6b / 255];
  const lineColor: [number, number, number] = [0.9, 0.9, 0.92];

  const page = new SimplePdfPage();
  const marginX = 56;
  let y = PAGE_HEIGHT - 80;

  page.drawText("NECA Employers' Excellence Awards", { x: marginX, y, size: 20, font: "bold", color: navy });
  y -= 28;
  page.drawText("Application Submission Receipt", { x: marginX, y, size: 13, font: "regular", color: muted });
  y -= 40;
  page.drawLine({ x1: marginX, y1: y, x2: PAGE_WIDTH - marginX, y2: y, width: 1, color: lineColor });
  y -= 36;

  const row = (label: string, value: string) => {
    page.drawText(label, { x: marginX, y, size: 10, font: "regular", color: muted });
    page.drawText(value, { x: marginX + 160, y, size: 11, font: "bold", color: navy });
    y -= 26;
  };

  row("Reference number", application.referenceNo);
  row("Organisation", application.organization.name || "—");
  row("RC number", application.organization.rcNumber || "—");
  row(
    "Submitted",
    new Date(application.submittedAt).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lagos" })
  );

  y -= 20;
  page.drawLine({ x1: marginX, y1: y, x2: PAGE_WIDTH - marginX, y2: y, width: 1, color: lineColor });
  y -= 30;

  const bodyLines = [
    "This confirms your organisation's Stage 1 application for the NECA Employers'",
    "Excellence Awards has been received and locked for review. The Secretariat will",
    "complete a completeness check, after which sector jurors will score independently.",
    "You will be notified of the outcome once the application window closes and results",
    "are released.",
  ];
  for (const line of bodyLines) {
    page.drawText(line, { x: marginX, y, size: 10.5, font: "regular", color: muted });
    y -= 16;
  }

  y -= 20;
  page.drawText(`Generated ${new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}`, {
    x: marginX,
    y,
    size: 8.5,
    font: "regular",
    color: muted,
  });

  const bytes = renderSimplePdf(page);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="EEA-receipt-${application.referenceNo}.pdf"`,
    },
  });
}
