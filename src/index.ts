import './util/tz'; // ALLEREERST: laadt .env en zet de tijdzone.

import Anthropic from '@anthropic-ai/sdk';
import { garageConfig } from './config/garage';
import { Store } from './store/store';
import { MemoryCalendar } from './calendar/memoryCalendar';
import { ConsoleEmail } from './email/consoleEmail';
import { Brain } from './brain/brain';
import { Channel, MessageHandler } from './channel/channel';
import { SimulatorChannel } from './channel/simulator';
import { TwilioChannel } from './channel/twilio';
import { startReminderScheduler } from './scheduler/reminders';

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
  const email = new ConsoleEmail();
  const brain = new Brain({ client, config: garageConfig, calendar, store, email });

  // Kies het kanaal (simulator standaard, twilio voor echte WhatsApp).
  const channelName = (process.env.CHANNEL || 'simulator').toLowerCase();
  const channel: Channel = channelName === 'twilio' ? new TwilioChannel() : new SimulatorChannel();
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
