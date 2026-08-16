"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Label, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { requestPasswordReset } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(email);
      if (!result.success) {
        setError(result.error ?? "Could not send the reset link. Try again.");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="w-full max-w-[340px] text-center">
        <div className="w-16 h-16 rounded-full bg-[#E6F4E6] flex items-center justify-center text-2xl text-success mx-auto mb-5">
          ✓
        </div>
        <div className="font-heading font-extrabold text-xl text-navy mb-2">Check your email</div>
        <p className="text-[13px] text-text-muted leading-relaxed">
          If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to reset your password.
        </p>
        <Link href="/login" className="text-[13px] font-semibold text-info mt-6 inline-block">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[340px]">
      <div className="font-heading font-extrabold text-2xl text-navy mb-1.5">Reset your password</div>
      <div className="text-[13px] text-text-muted mb-7">
        Enter the email address on your account and we&rsquo;ll send you a link to reset your password.
      </div>

      {error && <div className="text-sm text-error mb-4">{error}</div>}

      <div className="mb-5">
        <Label>Email address</Label>
        <Input
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" loading={isPending}>
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
      <div className="text-center text-[13px] text-text-muted mt-5">
        <Link href="/login">← Back to sign in</Link>
      </div>
    </form>
  );
}
