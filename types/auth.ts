/**
 * Matches the real `user_role` Postgres enum exactly (see
 * NECA_Supabase_Schema_Reference.md). `secretariat_super_admin` is a
 * distinct role value, not a boolean flag layered on `secretariat` — RLS's
 * `is_super_admin()` function checks `role = 'secretariat_super_admin'`
 * specifically, so this union must stay in sync with the enum.
 */
export type UserRole = "applicant" | "secretariat" | "secretariat_super_admin" | "jury";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}
