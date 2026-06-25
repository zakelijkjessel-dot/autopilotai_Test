import { promises as fs } from 'fs';
import path from 'path';
import readline from 'readline';
import { Channel, MessageHandler } from './channel';
import { ImageInput } from '../domain/types';

/** Vast klant-id voor de lokale test (mimet één WhatsApp-gebruiker). */
const SIM_USER = 'sim-user';

/**
 * Terminal-simulator: typ berichten alsof je de klant bent en zie de
 * antwoorden van de bot. Zo testen we alle logica zonder WhatsApp-account.
 *
 * Commando's:
 *   /foto <pad> [tekst]   stuur een foto mee (schade, band, lekkage)
 *   /help                 toon de hulp
 *   /quit                 stop
 */
export class SimulatorChannel implements Channel {
  async send(to: string, text: string): Promise<void> {
    process.stdout.write(`\n\x1b[35m🔔 Bot → ${to} (proactief):\x1b[0m ${text}\n`);
    this.prompt();
  }

  async start(handler: MessageHandler): Promise<void> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.printWelcome();
    this.prompt();

    rl.on('line', async (line) => {
      const text = line.trim();
      if (!text) return this.prompt();

      if (text === '/quit' || text === '/exit') {
        rl.close();
        return;
      }
      if (text === '/help') {
        this.printHelp();
        return this.prompt();
      }

      try {
        if (text.startsWith('/foto ')) {
          await this.handlePhoto(text.slice('/foto '.length).trim(), handler);
        } else {
          const reply = await handler(SIM_USER, { text });
          this.printBot(reply);
        }
      } catch (err) {
        console.error('[simulator] fout:', err);
      }
      this.prompt();
    });

    rl.on('close', () => {
      console.log('\nTot ziens! 👋');
      process.exit(0);
    });
  }

  private async handlePhoto(rest: string, handler: MessageHandler): Promise<void> {
    const [filePath, ...textParts] = rest.split(' ');
    const caption = textParts.join(' ').trim() || undefined;
    try {
      const image = await readImage(filePath);
      const reply = await handler(SIM_USER, { text: caption, images: [image] });
      console.log(`\x1b[2m(foto verstuurd: ${path.basename(filePath)})\x1b[0m`);
      this.printBot(reply);
    } catch {
      console.log(`\x1b[31mKon de foto niet lezen: ${filePath}\x1b[0m`);
    }
  }

  private printBot(text: string): void {
    process.stdout.write(`\x1b[32m🤖 Bot:\x1b[0m ${text}\n`);
  }

  private prompt(): void {
    process.stdout.write('\x1b[34m💬 Jij:\x1b[0m ');
  }

  private printWelcome(): void {
    console.log(
      '\n\x1b[1mWhatsApp-simulator voor de garage-chatbot\x1b[0m\n' +
        'Typ alsof je een klant bent. Bijvoorbeeld: "Wat zijn jullie openingstijden?"\n' +
        'Typ \x1b[1m/help\x1b[0m voor commando\'s, \x1b[1m/quit\x1b[0m om te stoppen.\n',
    );
  }

  private printHelp(): void {
    console.log(
      '\nCommando\'s:\n' +
        '  /foto <pad> [tekst]   stuur een foto mee, bv. /foto ./band.jpg is dit nog goed?\n' +
        '  /help                 deze hulp\n' +
        '  /quit                 stoppen\n',
    );
  }
}

const MEDIA_TYPES: Record<string, ImageInput['mediaType']> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

async function readImage(filePath: string): Promise<ImageInput> {
  const ext = path.extname(filePath).toLowerCase();
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) throw new Error(`Niet-ondersteund formaat: ${ext}`);
  const data = (await fs.readFile(filePath)).toString('base64');
  return { mediaType, data };
}
