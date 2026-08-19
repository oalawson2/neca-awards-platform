/**
 * Single source of truth for which edition of the Application Guidelines
 * & Terms and Conditions (app/terms/page.tsx) is currently live — shown
 * on the page itself and recorded against every signup's agreement (see
 * lib/auth/actions.ts's signUpApplicant), so a future edit to the terms
 * doesn't retroactively relabel what an existing applicant actually
 * agreed to.
 */
export const TERMS_VERSION = "2026 Edition";
