import express from 'express';
import { Channel, MessageHandler } from './channel';
import { ImageInput, UserContent } from '../domain/types';

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/**
 * WhatsApp via Twilio. Ontvangt inkomende berichten op een webhook en stuurt
 * antwoorden terug via de Twilio REST API (asynchroon, zodat Claude rustig
 * mag nadenken zonder dat de webhook timeout).
 *
 * Benodigde omgevingsvariabelen (zie .env.example):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, PORT
 */
export class TwilioChannel implements Channel {
  private readonly sid = requireEnv('TWILIO_ACCOUNT_SID');
  private readonly token = requireEnv('TWILIO_AUTH_TOKEN');
  private readonly from = requireEnv('TWILIO_WHATSAPP_FROM');
  private readonly port = Number(process.env.PORT || 3000);

  async start(handler: MessageHandler): Promise<void> {
    const app = express();
    app.use(express.urlencoded({ extended: false }));

    app.get('/', (_req, res) => res.send('Garage WhatsApp-bot draait. Webhook: POST /whatsapp'));

    app.post('/whatsapp', (req, res) => {
      // Bevestig direct (lege TwiML); we sturen het echte antwoord zo via de API.
      res.type('text/xml').send('<Response></Response>');
      void this.process(req.body, handler);
    });

    await new Promise<void>((resolve) => {
      app.listen(this.port, () => {
        console.log(`✅ Twilio-webhook luistert op http://localhost:${this.port}/whatsapp`);
        console.log('   Koppel deze URL (via bv. ngrok) in de Twilio-console aan je WhatsApp-sandbox.');
        resolve();
      });
    });
  }

  async send(to: string, text: string): Promise<void> {
    const body = new URLSearchParams({ From: this.from, To: to, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${this.sid}:${this.token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      console.error(`[twilio] versturen mislukt (${res.status}):`, await res.text());
    }
  }

  /** Verwerk een binnenkomend webhook-bericht en stuur het antwoord terug. */
  private async process(
    body: Record<string, string>,
    handler: MessageHandler,
  ): Promise<void> {
    const from = body.From; // bv. 'whatsapp:+31612345678'
    if (!from) return;
    try {
      const content: UserContent = { text: body.Body, images: await this.downloadMedia(body) };
      const reply = await handler(from, content);
      await this.send(from, reply);
    } catch (err) {
      console.error('[twilio] verwerken mislukt:', err);
      await this.send(from, 'Sorry, er ging iets mis. Probeer het zo nog eens.');
    }
  }

  /** Download meegestuurde afbeeldingen en geef ze als base64 terug. */
  private async downloadMedia(body: Record<string, string>): Promise<ImageInput[]> {
    const count = Number(body.NumMedia || 0);
    const images: ImageInput[] = [];
    for (let i = 0; i < count; i++) {
      const url = body[`MediaUrl${i}`];
      const type = body[`MediaContentType${i}`];
      if (!url || !SUPPORTED_IMAGE_TYPES.has(type)) continue;
      const res = await fetch(url, {
        headers: { Authorization: 'Basic ' + Buffer.from(`${this.sid}:${this.token}`).toString('base64') },
      });
      if (!res.ok) continue;
      const data = Buffer.from(await res.arrayBuffer()).toString('base64');
      images.push({ mediaType: type as ImageInput['mediaType'], data });
    }
    return images;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Omgevingsvariabele ${name} ontbreekt. Vul deze in je .env in (zie .env.example).`);
  }
  return value;
}
