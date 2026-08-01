import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">
        NECA Employers&rsquo; Excellence Awards
      </h1>
      <p className="max-w-md text-sm text-gray-500">
        Applicant, Secretariat, and Jury portal &mdash; under construction.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
      >
        Sign in
      </Link>
    </main>
  );
}
