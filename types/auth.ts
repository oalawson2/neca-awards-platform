export type UserRole = "applicant" | "secretariat" | "jury";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}
