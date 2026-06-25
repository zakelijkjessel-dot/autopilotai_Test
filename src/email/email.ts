/** Een te versturen e-mail. */
export interface OutgoingEmail {
  to: string;
  subject: string;
  /** Platte tekst (voldoende voor bevestigingen). */
  body: string;
}

/**
 * E-mailkoppeling. De console-versie logt de mail; een echte implementatie
 * (Resend, SendGrid, SMTP) vult dezelfde interface in.
 */
export interface Email {
  send(message: OutgoingEmail): Promise<void>;
}
