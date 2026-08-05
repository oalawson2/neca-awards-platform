/**
 * Single seam for all outbound transactional email. No provider is wired
 * up yet (EMAIL_API_KEY/EMAIL_FROM_ADDRESS in .env.example are empty), so
 * this just logs what would have been sent. Every caller in the app goes
 * through sendEmail() — swapping in a real provider later means rewriting
 * the body of this one function, not touching any caller.
 */
export type EmailTemplate =
  | "interview-invite"
  | "interview-booking-reminder"
  | "interview-attendance-reminder";

export interface EmailMessage {
  to: string;
  subject: string;
  template: EmailTemplate;
  context: Record<string, string>;
}

export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean }> {
  if (process.env.EMAIL_API_KEY) {
    // TODO: once EMAIL_API_KEY/EMAIL_FROM_ADDRESS are populated, replace this
    // block with a real provider call (e.g. Resend, Postmark) using
    // message.to/subject/template/context. Nothing else in the app needs
    // to change.
  }

  console.log(
    `[mock-email] would send "${message.subject}" to ${message.to} (template: ${message.template})`,
    message.context
  );
  return { sent: false };
}
