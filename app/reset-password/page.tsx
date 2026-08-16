import Image from "next/image";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Reachable two ways: normally via /auth/callback exchanging a real
 * recovery link's code for a session first, or directly (an old
 * bookmark, a second click on an already-used link) with no session at
 * all. getCurrentUser() covers both — it's the same "is there a real,
 * revalidated session" check every protected portal route already uses,
 * and a recovery session satisfies it exactly like a normal sign-in does.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen flex">
      <div
        className="hidden lg:flex w-[45%] flex-col justify-between p-13 flex-shrink-0"
        style={{ background: "linear-gradient(160deg,#251C5B,#1A1442)" }}
      >
        <Image src="/neca-logo.png" alt="" width={140} height={36} className="h-9 w-auto brightness-0 invert" />
        <div>
          <div className="font-heading font-extrabold text-3xl text-white leading-tight">
            Employers&rsquo; Excellence Awards
          </div>
          <div className="text-sm text-[#C9CCE8] mt-3.5 leading-relaxed">
            Apply, review, and score — one platform for the full national awards process.
          </div>
        </div>
        <div className="text-xs text-[#8B8FC0]">apply.necaexcellenceawards.com</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12">
        <div className="lg:hidden mb-8">
          <Image src="/neca-logo.png" alt="NECA Excellence Awards" width={120} height={30} className="h-8 w-auto" />
        </div>
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="w-full max-w-[340px] text-center">
            <div className="font-heading font-extrabold text-xl text-navy mb-2">Link expired</div>
            <p className="text-[13px] text-text-muted leading-relaxed">
              This password reset link is invalid or has already been used. Request a new one to continue.
            </p>
            <Link href="/forgot-password" className="text-[13px] font-semibold text-info mt-6 inline-block">
              Request a new link →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
