/**
 * Placeholder for screens whose business logic depends on the 2026 EEA
 * Assessment Framework rebuild but haven't been rebuilt yet — see the
 * phase task list. Keeps every route reachable and the app honestly
 * labeled mid-migration, rather than leaving a broken import.
 */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <h1 className="font-heading font-extrabold text-xl text-navy mb-2">{title}</h1>
      <p className="text-sm text-text-muted leading-relaxed">
        This screen is being rebuilt against NECA&rsquo;s 2026 Assessment Framework.
        <br />
        Coming in: {phase}.
      </p>
    </div>
  );
}
