"use client";

import { useState } from "react";

/**
 * Placeholder login form. Not wired to Supabase Auth yet — submitting
 * currently does nothing but show a "not connected" notice. Once Supabase
 * Auth and the profiles/roles schema exist, this will call
 * supabase.auth.signInWithPassword (or magic link) and redirect via
 * portalPathForRole().
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    alert(
      "Auth is not connected yet. This form is a structural placeholder pending the Supabase schema."
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white"
      >
        Sign in
      </button>
    </form>
  );
}
