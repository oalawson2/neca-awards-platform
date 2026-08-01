import Image from "next/image";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex">
      <div
        className="hidden lg:flex w-[45%] flex-col justify-between p-13 flex-shrink-0"
        style={{ background: "linear-gradient(160deg,#251C5B,#1A1442)" }}
      >
        <Image src="/neca-logo.png" alt="" width={140} height={36} className="h-9 w-auto brightness-0 invert" />
        <div>
          <div className="font-heading font-extrabold text-[28px] text-white leading-tight">
            Create your applicant account
          </div>
          <div className="text-sm text-[#C9CCE8] mt-3.5 leading-relaxed">
            Participation is free and open to all corporate organizations in Nigeria.
          </div>
        </div>
        <div className="text-xs text-[#8B8FC0]">apply.necaexcellenceawards.com</div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12">
        <div className="lg:hidden mb-8">
          <Image src="/neca-logo.png" alt="NECA Excellence Awards" width={120} height={30} className="h-8 w-auto" />
        </div>
        <SignupForm />
      </div>
    </main>
  );
}
