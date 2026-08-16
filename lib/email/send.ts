import { Resend } from "resend";

/**
 * Single seam for all outbound transactional email this app sends
 * directly (interview invite + reminders). Every caller goes through
 * sendEmail() — this is the only place that knows about Resend.
 *
 * This is NOT how jury/secretariat invite emails are sent — those go
 * through supabase.auth.admin.inviteUserByEmail() (lib/actions/users.ts),
 * which is Supabase Auth's own built-in invite mechanism: it creates the
 * user, issues a real magic-link token, and sends the email itself,
 * through whatever SMTP provider is configured in the Supabase project
 * (Project Settings -> Auth -> SMTP Settings), not through this file or
 * any env var here. Rebuilding that as a custom Resend-sent email would
 * mean also building a "set your password" landing page this app doesn't
 * have yet, since Supabase's hosted flow currently provides that. The
 * simpler, lower-risk way to get invite emails onto Resend too: add
 * Resend's SMTP credentials as the Supabase project's custom SMTP
 * provider — no code change, and it keeps using Supabase's already-
 * working invite link/session flow.
 */
export type EmailTemplate =
  | "interview-invite"
  | "interview-booking-reminder"
  | "interview-attendance-reminder"
  | "interview-slot-booked-juror"
  | "interview-slot-booked-secretariat";

export interface EmailMessage {
  to: string;
  subject: string;
  template: EmailTemplate;
  context: Record<string, string>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

function renderTemplate(message: EmailMessage): string {
  const { organizationName = "there", applicationId = "" } = message.context;
  const interviewLink = `${SITE_URL}/applicant/interview`;
  const jurorInterviewLink = `${SITE_URL}/jury/interview/${applicationId}`;
  const secretariatApplicationLink = `${SITE_URL}/secretariat/applications/${applicationId}`;

  const wrap = (bodyHtml: string) => `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1A1442;">
      <div style="background:linear-gradient(160deg,#251C5B,#1A1442);padding:28px 32px;border-radius:14px 14px 0 0;">
        <span style="color:#fff;font-weight:800;font-size:17px;">NECA Employers&rsquo; Excellence Awards</span>
      </div>
      <div style="background:#fff;border:1px solid #E3E4EA;border-top:none;border-radius:0 0 14px 14px;padding:32px;">
        ${bodyHtml}
        <p style="font-size:12px;color:#8B8FC0;margin-top:32px;">Reference: ${applicationId}</p>
      </div>
    </div>`;

  switch (message.template) {
    case "interview-invite":
      return wrap(`
        <p style="font-size:15px;">Hello ${organizationName},</p>
        <p style="font-size:14px;line-height:1.6;">Your organisation has been shortlisted, and a sector jury panel is ready to schedule your interview as part of Stage 2 review.</p>
        <p style="margin:28px 0;"><a href="${interviewLink}" style="background:#251C5B;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Book your interview slot →</a></p>
      `);
    case "interview-booking-reminder":
      return wrap(`
        <p style="font-size:15px;">Hello ${organizationName},</p>
        <p style="font-size:14px;line-height:1.6;">This is a reminder that your NECA Excellence Awards panel interview is still awaiting scheduling. Please book a slot at your earliest convenience.</p>
        <p style="margin:28px 0;"><a href="${interviewLink}" style="background:#251C5B;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Book your interview slot →</a></p>
      `);
    case "interview-attendance-reminder": {
      const when = message.context.scheduledAt
        ? new Date(message.context.scheduledAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" })
        : "soon";
      return wrap(`
        <p style="font-size:15px;">Hello ${organizationName},</p>
        <p style="font-size:14px;line-height:1.6;">This is a reminder that your NECA Excellence Awards panel interview is scheduled for <strong>${when}</strong>.</p>
        <p style="margin:28px 0;"><a href="${interviewLink}" style="background:#251C5B;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">View interview details →</a></p>
      `);
    }
    case "interview-slot-booked-juror": {
      const when = message.context.scheduledAt
        ? new Date(message.context.scheduledAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" })
        : "soon";
      const format = message.context.format === "physical" ? "in person" : "virtual";
      return wrap(`
        <p style="font-size:15px;">Hello,</p>
        <p style="font-size:14px;line-height:1.6;"><strong>${organizationName}</strong> has booked their panel interview slot for <strong>${when}</strong> (${format}).</p>
        <p style="margin:28px 0;"><a href="${jurorInterviewLink}" style="background:#251C5B;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">View in your portal →</a></p>
      `);
    }
    case "interview-slot-booked-secretariat": {
      const when = message.context.scheduledAt
        ? new Date(message.context.scheduledAt).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" })
        : "soon";
      const format = message.context.format === "physical" ? "in person" : "virtual";
      return wrap(`
        <p style="font-size:15px;">Hello,</p>
        <p style="font-size:14px;line-height:1.6;"><strong>${organizationName}</strong> has booked their panel interview slot for <strong>${when}</strong> (${format}).</p>
        <p style="margin:28px 0;"><a href="${secretariatApplicationLink}" style="background:#251C5B;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">View application →</a></p>
      `);
    }
  }
}

export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;

  if (!apiKey || !from) {
    console.log(
      `[mock-email] RESEND_API_KEY/EMAIL_FROM_ADDRESS not set — would send "${message.subject}" to ${message.to} (template: ${message.template})`,
      message.context
    );
    return { sent: false };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    html: renderTemplate(message),
  });

  if (error) {
    console.error("[email] Resend send failed:", error.message);
    return { sent: false, error: error.message };
  }
  return { sent: true };
}
