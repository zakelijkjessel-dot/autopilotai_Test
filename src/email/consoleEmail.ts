import { Email, OutgoingEmail } from './email';

/**
 * Ontwikkel-implementatie: schrijft de e-mail naar de console in plaats van
 * 'm echt te versturen. Zo zie je tijdens het testen precies wat de klant
 * zou ontvangen, zonder mailaccount.
 */
export class ConsoleEmail implements Email {
  async send(message: OutgoingEmail): Promise<void> {
    const line = '─'.repeat(56);
    console.log(
      `\n📧 \x1b[36mE-MAILBEVESTIGING (console)\x1b[0m\n${line}\n` +
        `Aan:      ${message.to}\n` +
        `Onderwerp: ${message.subject}\n${line}\n` +
        `${message.body}\n${line}\n`,
    );
  }
}
