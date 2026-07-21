import './util/tz'; // ALLEREERST: laadt .env en zet de tijdzone.

import Anthropic from '@anthropic-ai/sdk';
import { garageConfig } from './config/garage';
import { Store } from './store/store';
import { MemoryCalendar } from './calendar/memoryCalendar';
import { Email } from './email/email';
import { ConsoleEmail } from './email/consoleEmail';
import { SmtpEmail } from './email/smtpEmail';
import { Brain } from './brain/brain';
import { createGoogleCalendarSync } from './integrations/googleCalendar';
import { Channel, MessageHandler } from './channel/channel';
import { SimulatorChannel } from './channel/simulator';
import { TwilioChannel } from './channel/twilio';
import { WhatsAppCloudChannel } from './channel/whatsappCloud';
import { startReminderScheduler } from './scheduler/reminders';

/** Kiest het berichtenkanaal op basis van de CHANNEL-omgevingsvariabele. */
function selectChannel(name: string): Channel {
  switch (name) {
    case 'twilio':
      return new TwilioChannel();
    case 'whatsapp':
    case 'cloud':
    case 'meta':
      return new WhatsAppCloudChannel();
    default:
      return new SimulatorChannel();
  }
}

/** Kiest de e-mailverzender: echt via SMTP als dat is ingesteld, anders console. */
async function createEmail(): Promise<Email> {
  if (!process.env.SMTP_HOST) {
    console.log('ℹ️  E-mail: simulatiemodus (console). Stel SMTP_* in voor echte verzending.');
    return new ConsoleEmail();
  }
  const smtp = new SmtpEmail();
  try {
    await smtp.verify();
    console.log('✅ E-mail: SMTP-verbinding OK — bevestigingen worden echt verstuurd.');
  } catch (err) {
    console.error(
      '⚠️  E-mail: SMTP-verbinding mislukt. Controleer je SMTP_*-instellingen; ' +
        'bevestigingen worden mogelijk niet verstuurd.\n',
      err,
    );
  }
  return smtp;
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      '\n❌ ANTHROPIC_API_KEY ontbreekt.\n' +
        '   Maak een .env aan (cp .env.example .env) en vul je Claude-sleutel in.\n' +
        '   Een sleutel haal je bij https://console.anthropic.com\n',
    );
    process.exit(1);
  }

  // Kern-onderdelen opzetten.
  const client = new Anthropic({ apiKey });
  const store = new Store();
  await store.load();
  const calendar = new MemoryCalendar(garageConfig, store);
  const email = await createEmail();
  const calendarSync = createGoogleCalendarSync(garageConfig);
  const brain = new Brain({ client, config: garageConfig, calendar, store, email, calendarSync });

  // Kies het kanaal: simulator (standaard), twilio, of whatsapp (Meta Cloud API).
  const channelName = (process.env.CHANNEL || 'simulator').toLowerCase();
  const channel: Channel = selectChannel(channelName);
  console.log(`🚗 ${garageConfig.name} — chatbot gestart (kanaal: ${channelName}).`);

  // Eén binnenkomend bericht → laad sessie → laat het brein antwoorden.
  const handler: MessageHandler = async (from, content) => {
    const session = store.getSession(from);
    return brain.handle(session, content);
  };

  startReminderScheduler({ store, channel, config: garageConfig });
  await channel.start(handler);
}

main().catch((err) => {
  console.error('Fatale fout bij opstarten:', err);
  process.exit(1);
});
