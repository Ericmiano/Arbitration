import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let transporter: Transporter | null = null;
let warnedNoSmtp = false;

/**
 * SMTP is intentionally optional. In production, point this at whatever
 * mailbox comes with the cPanel hosting plan (free, no third-party signup) -
 * or Gmail/Brevo SMTP if that's preferred. Locally, or if it's never
 * configured, emails are logged to the console instead of failing outright,
 * so password reset etc. can still be tested end to end without setting up
 * a real mail server first.
 */
function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(options: { to: string; subject: string; text: string }): Promise<void> {
  const client = getTransporter();

  if (!client) {
    if (!warnedNoSmtp) {
      console.warn('SMTP_HOST is not configured - emails will be logged instead of sent. Set SMTP_* env vars to send for real.');
      warnedNoSmtp = true;
    }
    console.log(`[mail:not-sent] to=${options.to} subject="${options.subject}"\n${options.text}`);
    return;
  }

  await client.sendMail({
    from: env.SMTP_FROM ?? 'no-reply@aak-arbitration.local',
    to: options.to,
    subject: options.subject,
    text: options.text,
  });
}
