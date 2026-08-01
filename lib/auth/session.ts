import { cookies } from "next/headers";
import type { SessionUser } from "@/types/auth";
import { store } from "@/lib/mock/store";
import { SESSION_COOKIE_NAME } from "@/lib/auth/portal-path";

export { SESSION_COOKIE_NAME, portalPathForRole } from "@/lib/auth/portal-path";

/**
 * Mock-phase session lookup, reading a plain cookie set by the mock sign-in
 * Server Action (lib/auth/actions.ts). Once Supabase Auth is connected,
 * only the internals here change — read the Supabase session instead of
 * this cookie — the SessionUser shape and every caller stay the same.
 *
 * Server Components / Route Handlers only — this file imports next/headers,
 * so it can't be imported from Client Components or proxy.ts. Those should
 * import lib/auth/portal-path.ts instead (see its docstring).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!userId) return null;

  const user = store.users.find((u) => u.id === userId);
  if (!user) return null;

  return { id: user.id, email: user.email, role: user.role };
}
