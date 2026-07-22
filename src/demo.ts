import './util/tz'; // ALLEREERST: laadt .env en zet de tijdzone.

import os from 'os';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { garageConfig } from './config/garage';
import { Store, FilePersistence } from './store/store';
import { MemoryCalendar } from './calendar/memoryCalendar';
import { ConsoleEmail } from './email/consoleEmail';
import { Brain } from './brain/brain';

/**
 * Speelt automatisch een voorbeeldgesprek af door de echte bot. Handig om in
 * één commando te zien hoe alles samenwerkt, zonder zelf te hoeven typen.
 *
 *   npm run demo
 *
 * Vereist een ANTHROPIC_API_KEY in je .env (de bot praat met Claude).
 */

// De berichten die de "klant" stuurt. De bot beantwoordt ze één voor één.
const CUSTOMER_TURNS = [
  'Hoi! Wat zijn jullie openingstijden?',
  'Ik wil graag een APK laten doen. Het is een Volkswagen Golf, kenteken AB-123-C.',
  'Volgende week in de ochtend zou fijn zijn.',
  'De eerste optie is prima. Mijn naam is Jan Jansen, e-mail jan@example.com.',
  'Ja, doe die kleine beurt er meteen maar bij.',
  'Wat gaat me dat ongeveer kosten?',
  'Kun je de afspraak toch een dag later zetten?',
  'Top, bedankt!',
];

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      '\n❌ ANTHROPIC_API_KEY ontbreekt.\n' +
        '   Vul je Claude-sleutel in je .env in (cp .env.example .env).\n',
    );
    process.exit(1);
  }

  // Aparte, schone opslag voor de demo (vervuilt je echte data/ niet).
  const dataDir = path.join(os.tmpdir(), `garage-demo-${Date.now()}`);
  const store = new Store(new FilePersistence(dataDir));
  await store.load();

  const client = new Anthropic({ apiKey });
  const calendar = new MemoryCalendar(garageConfig, store);
  const brain = new Brain({ client, config: garageConfig, calendar, store, email: new ConsoleEmail() });
  const session = store.getSession('demo-klant');

  console.log(`\n🚗 Voorbeeldgesprek met de chatbot van ${garageConfig.name}\n${'═'.repeat(60)}`);

  for (const text of CUSTOMER_TURNS) {
    console.log(`\n\x1b[34m👤 Klant:\x1b[0m ${text}`);
    const reply = await brain.handle(session, { text });
    console.log(`\x1b[32m🤖 Bot:\x1b[0m   ${reply}`);
  }

  console.log(`\n${'═'.repeat(60)}\n✅ Demo klaar.`);
  await store.flush();
}

main().catch((err) => {
  console.error('Demo mislukt:', err);
  process.exit(1);
});
