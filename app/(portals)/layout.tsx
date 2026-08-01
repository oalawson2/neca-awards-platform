/**
 * Shared shell for the authenticated portal areas (Applicant, Secretariat,
 * Jury). proxy.ts already gates access to these routes; this layout is
 * just the common chrome (nav/header placeholder) they'll all sit inside.
 */
export default function PortalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 px-6 py-4">
        <span className="text-sm font-semibold">NECA Excellence Awards</span>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
