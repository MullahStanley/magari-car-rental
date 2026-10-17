import { Resend } from "resend";

// Guarded so the app keeps working (status changes succeed, emails are
// skipped with a warning) before RESEND_API_KEY is configured.
export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Magari Car Rental <onboarding@resend.dev>";

export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@magari.com";
