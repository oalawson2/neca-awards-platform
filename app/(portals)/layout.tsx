/**
 * Route group only — no shared chrome here. Each portal (Applicant,
 * Secretariat, Jury) has a visually distinct nav pattern per the design
 * system (top nav / sidebar / tab nav), so the actual layout shells live
 * in applicant/layout.tsx, secretariat/layout.tsx, and jury/layout.tsx.
 * proxy.ts gates access to these routes.
 */
export default function PortalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
