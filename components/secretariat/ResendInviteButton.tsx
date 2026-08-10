"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/Button";

/**
 * Submit button for the "Resend invite" <form action={...}> in the Users
 * page — useFormStatus() only works inside a descendant of the form it's
 * reporting on, so this can't just be inline in that (server component)
 * page.
 */
export function ResendInviteButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-info text-xs inline-flex items-center gap-1.5 disabled:text-[#AEB1BC]">
      {pending && <Spinner className="w-3 h-3" />}
      {pending ? "Resending…" : "Resend"}
    </button>
  );
}
