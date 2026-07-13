import nodemailer, { Transporter } from 'nodemailer';
import { Email, OutgoingEmail } from './email';

/**
 * Echte e-mailverzending via SMTP. Werkt met Gmail en met vrijwel elke andere
 * mailprovider (SendGrid, je hostingpartij, enz.).
 *
 * Config via omgevingsvariabelen (zie .env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optioneel).
 *
 * Voor Gmail: gebruik een App-wachtwoord (met 2FA aan), niet je gewone
 * wachtwoord.
 */
export class SmtpEmail implements Email {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const host = requireEnv('SMTP_HOST');
    const port = Number(process.env.SMTP_PORT || 587);
    const user = requireEnv('SMTP_USER');
    const pass = requireEnv('SMTP_PASS');
    // Poort 465 = versleuteld vanaf de start (implicit TLS); 587/25 = STARTTLS.
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;

    this.transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    this.from = process.env.SMTP_FROM || user;
  }

  async send(message: OutgoingEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
  }

  /** Controleert host + inloggegevens; handig om bij het opstarten te melden. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Omgevingsvariabele ${name} ontbreekt. Vul deze in je .env in (zie .env.example).`);
  }
  return value;
}
