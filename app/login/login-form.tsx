"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Label, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { signIn } from "@/lib/auth/actions";
import { portalPathForRole } from "@/lib/auth/portal-path";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn(email, password);
      if (!result.success || !result.role) {
        setError(result.error ?? "Sign in failed.");
        return;
      }
      const next = searchParams.get("next");
      router.push(next && next.startsWith(`/${result.role}`) ? next : portalPathForRole(result.role));
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[340px]">
      <div className="font-heading font-extrabold text-2xl text-navy mb-1.5">Sign in</div>
      <div className="text-[13px] text-text-muted mb-7">Use the credentials issued to your organization or role.</div>

      {error && <div className="text-sm text-error mb-4">{error}</div>}

      <div className="mb-[18px]">
        <Label>Email address</Label>
        <Input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="mb-2.5">
        <Label>Password</Label>
        <Input
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="text-right mb-5">
        <a href="#" className="text-[13px]" title="Not wired up in this mock-data phase">
          Forgot password?
        </a>
      </div>
      <Button type="submit" className="w-full" loading={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="text-center text-[13px] text-text-muted mt-5">
        New applicant? <Link href="/signup">Create an account</Link>
      </div>
    </form>
  );
}
