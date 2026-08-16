/**
 * Detects GoTrue's "the email-send step failed" failure class — common to
 * every one of its own email-sending endpoints (invite, password
 * recovery, magic link, signup confirmation), not just the one this was
 * first diagnosed against (see lib/actions/users.ts's original invite
 * flow, confirmed live against this project's own Auth logs).
 * error.message is not a reliable signal on its own: the SDK sometimes
 * hands back the literal string "{}" instead of GoTrue's real "Error
 * sending ... email" text for the exact same failure (an empty/malformed
 * error body it couldn't parse into its usual shape). status is the
 * reliable part: expected rejections (bad email, rate limit) come back
 * 4xx; a bare 500 with no more specific code is GoTrue's generic
 * "unexpected_failure" bucket, which in practice here is the send step.
 */
export function isEmailSendFailure(error: { message: string; code?: string; status?: number }): boolean {
  return error.code === "unexpected_failure" || error.status === 500 || /error sending/i.test(error.message);
}
