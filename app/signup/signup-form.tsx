"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Label, Input, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { signUpApplicant } from "@/lib/auth/actions";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signUpApplicant({ email, password, confirmPassword, agreeToTerms });
      if (!result.success) {
        setError(result.error ?? "Sign up failed.");
        return;
      }
      if (result.needsEmailConfirmation) {
        setNeedsEmailConfirmation(true);
        return;
      }
      router.push("/applicant/profile");
      router.refresh();
    });
  }

  if (needsEmailConfirmation) {
    return (
      <div className="w-full max-w-[360px]">
        <div className="font-heading font-extrabold text-[22px] text-navy mb-3">Check your email</div>
        <p className="text-sm text-text-muted">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then{" "}
          <Link href="/login">sign in</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[360px]">
      <div className="font-heading font-extrabold text-[22px] text-navy mb-6">Sign up</div>

      {error && <div className="text-sm text-error mb-4">{error}</div>}

      <div className="mb-4">
        <Label>Work email</Label>
        <Input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="mb-4">
        <Label>Password</Label>
        <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <div className="mb-[18px]">
        <Label>Confirm password</Label>
        <Input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <Checkbox
        className="mb-[22px]"
        checked={agreeToTerms}
        onChange={(e) => setAgreeToTerms(e.target.checked)}
        label="I agree to the Data Privacy Statement and Terms of Participation."
      />
      <Button type="submit" className="w-full" loading={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </Button>
      <div className="text-center text-[13px] text-text-muted mt-5">
        Already registered? <Link href="/login">Sign in</Link>
      </div>
    </form>
  );
}
