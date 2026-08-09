import Image from "next/image";
import { LinkButton } from "@/components/ui/Button";

/**
 * Public landing page — applicant-facing only. Never mentions Secretariat
 * or Jury: the public has no reason to know those portals exist. "Sign
 * in" stays role-agnostic (it happens to also work for staff), matching
 * how /login already routes any authenticated user to their own portal.
 */
export default function Home() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
      style={{ background: "linear-gradient(160deg,#251C5B,#1A1442)" }}
    >
      <Image src="/neca-logo.png" alt="NECA" width={160} height={68} className="h-14 w-auto brightness-0 invert mb-10" />

      <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-white leading-tight max-w-2xl">
        NECA Employers&rsquo; Excellence Awards
      </h1>
      <p className="max-w-lg text-[15px] sm:text-base text-[#C9CCE8] mt-5 leading-relaxed">
        Nigeria&rsquo;s national recognition for employers who lead on governance, people practice, and responsible
        business. If your organisation is ready to be measured against that standard, applications are open now.
      </p>

      <LinkButton href="/signup" variant="gold" className="mt-9 !px-9 !py-4 !text-[15px]">
        Apply Now →
      </LinkButton>

      <a href="/login" className="mt-8 text-[13px] text-[#8B8FC0] hover:text-white transition-colors">
        Already applying? Sign in
      </a>
    </main>
  );
}
