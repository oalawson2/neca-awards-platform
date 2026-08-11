import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth/session";
import { getApplicationForApplicantUser } from "@/lib/data/applications";

/**
 * Generates a real one-page PDF submission receipt on demand — was
 * previously a permanently-disabled button ("not wired up in this
 * mock-data phase"). Auth is the same scoping getApplicationForApplicantUser
 * already does (organizations.created_by = the signed-in user), so this
 * can only ever produce the caller's own receipt, never anyone else's.
 *
 * A dynamic `import("pdf-lib")` was tried here to keep it out of the
 * build's eagerly-compiled module graph. Reverted: this route is compiled
 * with `next build --webpack` (see package.json's build script — Turbopack
 * can't resolve through cPanel's symlinked node_modules), and webpack
 * bundles a plain top-level import straight into this route's single
 * compiled file — confirmed pdf-lib's code is genuinely inlined into
 * .next/server/app/api/applicant/receipt/route.js, ~440KB, self-contained.
 * A dynamic import instead becomes a separate async chunk that has to be
 * loaded at runtime, and nothing here verified that chunk file actually
 * survives the .next/standalone copy step — not a risk worth taking for a
 * feature already confirmed working end-to-end against the live app.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const application = await getApplicationForApplicantUser(user.id);
  if (!application) return NextResponse.json({ error: "No application found." }, { status: 404 });
  if (!application.submittedAt) {
    return NextResponse.json({ error: "This application hasn't been submitted yet." }, { status: 400 });
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const navy = rgb(0x25 / 255, 0x1c / 255, 0x5b / 255);
  const muted = rgb(0x5b / 255, 0x5f / 255, 0x6b / 255);

  const { width, height } = page.getSize();
  const marginX = 56;
  let y = height - 80;

  page.drawText("NECA Employers' Excellence Awards", { x: marginX, y, size: 20, font: bold, color: navy });
  y -= 28;
  page.drawText("Application Submission Receipt", { x: marginX, y, size: 13, font: regular, color: muted });
  y -= 40;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: rgb(0.9, 0.9, 0.92) });
  y -= 36;

  const row = (label: string, value: string) => {
    page.drawText(label, { x: marginX, y, size: 10, font: regular, color: muted });
    page.drawText(value, { x: marginX + 160, y, size: 11, font: bold, color: navy });
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
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: rgb(0.9, 0.9, 0.92) });
  y -= 30;

  const bodyLines = [
    "This confirms your organisation's Stage 1 application for the NECA Employers'",
    "Excellence Awards has been received and locked for review. The Secretariat will",
    "complete a completeness check, after which sector jurors will score independently.",
    "You will be notified of the outcome once the application window closes and results",
    "are released.",
  ];
  for (const line of bodyLines) {
    page.drawText(line, { x: marginX, y, size: 10.5, font: regular, color: muted });
    y -= 16;
  }

  y -= 20;
  page.drawText(`Generated ${new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}`, {
    x: marginX,
    y,
    size: 8.5,
    font: regular,
    color: muted,
  });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="EEA-receipt-${application.referenceNo}.pdf"`,
    },
  });
}
