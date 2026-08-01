"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { store, applicantOrgLink, generateId } from "@/lib/mock/store";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { UserRole } from "@/types/auth";

export interface AuthResult {
  success: boolean;
  error?: string;
  role?: UserRole;
}

/**
 * Mock-phase sign-in: any non-empty password is accepted for a known
 * email. Once Supabase Auth is connected, this becomes a real
 * supabase.auth.signInWithPassword call — callers (the login form) don't
 * need to change.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { success: false, error: "Enter your email and password." };
  }

  const credential = store.credentials.find((c) => c.email.toLowerCase() === normalizedEmail);
  const user = credential ? store.users.find((u) => u.id === credential.userId) : undefined;
  if (!credential || !user) {
    return { success: false, error: "No account found with that email." };
  }
  if (user.status === "invited") {
    return { success: false, error: "This account hasn't accepted its invite yet." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return { success: true, role: user.role };
}

export interface SignUpInput {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

/** Applicant self-registration. Secretariat and Jury are invite-only and never go through this. */
export async function signUpApplicant(input: SignUpInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return { success: false, error: "Email and password are required." };
  }
  if (input.password !== input.confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }
  if (!input.agreeToTerms) {
    return { success: false, error: "You must agree to the Data Privacy Statement and Terms of Participation." };
  }
  if (store.credentials.some((c) => c.email.toLowerCase() === email)) {
    return { success: false, error: "An account with this email already exists." };
  }

  const userId = generateId("app-user");
  const orgId = generateId("org");
  const appId = generateId("app");
  const defaultSectorId = store.sectors[0].id;

  store.users.push({ id: userId, name: email.split("@")[0], email, role: "applicant", status: "active" });
  store.credentials.push({ userId, email, password: input.password });
  store.organizations.push({
    id: orgId,
    name: "",
    rcNumber: "",
    yearFounded: new Date().getFullYear(),
    address: "",
    sectorId: defaultSectorId,
    employeeHeadcount: "",
    primaryContactName: "",
    primaryContactEmail: email,
  });
  applicantOrgLink[userId] = orgId;
  store.applications.push({
    id: appId,
    referenceNo: `EEA-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    organizationId: orgId,
    sectorId: defaultSectorId,
    status: "draft",
    submittedAt: null,
    preliminaryScore: null,
    totalSections: store.questionnaireSections.length,
    sectionsCompleted: 0,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  return { success: true, role: "applicant" };
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
