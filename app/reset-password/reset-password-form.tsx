"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Label, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // The recovery session /auth/callback established to get this far is
      // a real, full session — proxy.ts's role-gated routing doesn't (and
      // shouldn't) distinguish it from a normal one, since a stolen/shared
      // reset link is exactly the case that check exists for elsewhere.
      // Without signing out here, landing on /login next would show the
      // real form only by coincidence (an applicant's own profiles.role
      // happens to match the /login route's checks); an existing user's
      // still-active recovery session would instead get silently carried
      // straight into their portal by that same proxy.ts rule, never
      // having entered their new password anywhere the app asked for it.
      await supabase.auth.signOut();
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 2000);
    });
  }

  if (success) {
    return (
      <div className="w-full max-w-[340px] text-center">
        <div className="w-16 h-16 rounded-full bg-[#E6F4E6] flex items-center justify-center text-2xl text-success mx-auto mb-5">
          ✓
        </div>
        <div className="font-heading font-extrabold text-xl text-navy mb-2">Password updated</div>
        <p className="text-[13px] text-text-muted">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[340px]">
      <div className="font-heading font-extrabold text-2xl text-navy mb-1.5">Set a new password</div>
      <div className="text-[13px] text-text-muted mb-7">Choose a new password for your account.</div>

      {error && <div className="text-sm text-error mb-4">{error}</div>}

      <div className="mb-[18px]">
        <Label>New password</Label>
        <Input
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="mb-5">
        <Label>Confirm new password</Label>
        <Input
          type="password"
          required
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" loading={isPending}>
        {isPending ? "Updating…" : "Update password"}
      </Button>
      <div className="text-center text-[13px] text-text-muted mt-5">
        <Link href="/login">← Back to sign in</Link>
      </div>
    </form>
  );
}
