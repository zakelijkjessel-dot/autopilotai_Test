import express from 'express';
import { Channel, MessageHandler } from './channel';
import { ImageInput, UserContent } from '../domain/types';

const GRAPH_VERSION = 'v21.0';
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Minimale vorm van een inkomend Cloud API-webhookbericht. */
interface CloudMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
}
interface CloudWebhookBody {
  entry?: Array<{ changes?: Array<{ value?: { messages?: CloudMessage[] } }> }>;
}

/**
 * WhatsApp via de officiële **Meta WhatsApp Cloud API** (alternatief voor
 * Twilio). Meta stuurt inkomende berichten naar een webhook; wij bevestigen
 * direct met 200 en verwerken het bericht daarna (Claude mag rustig nadenken).
 *
 * Omgevingsvariabelen (zie .env.example):
 *   WHATSAPP_VERIFY_TOKEN      – zelfgekozen token voor de webhook-verificatie
 *   WHATSAPP_TOKEN             – permanent access token (nodig om te antwoorden)
 *   WHATSAPP_PHONE_NUMBER_ID   – phone number id (nodig om te antwoorden)
 *   PORT                       – poort van de webhookserver
 */
export class WhatsAppCloudChannel implements Channel {
  private readonly port = Number(process.env.PORT || 3000);
  private handler?: MessageHandler;

  async start(handler: MessageHandler): Promise<void> {
    this.handler = handler;
    const app = express();
    app.use(express.json());

    app.get('/', (_req, res) =>
      res.send('Garage WhatsApp Cloud API-bot draait. Webhook: GET/POST /webhook'),
    );

    // --- Meta webhook-verificatie (eenmalig bij het koppelen in de Meta-app) ---
    // Bereikbaar op /webhook én /api/webhook (voor wie de Next.js-URL verwacht).
    app.get(['/webhook', '/api/webhook'], (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = String(req.query['hub.challenge'] ?? '');
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

      if (mode === 'subscribe' && verifyToken && token === verifyToken) {
        res.status(200).type('text/plain').send(challenge);
      } else {
        res.sendStatus(403);
      }
    });

    // --- Binnenkomende berichten ---
    app.post(['/webhook', '/api/webhook'], (req, res) => {
      // Meta verwacht een snelle bevestiging; daarna verwerken we asynchroon.
      res.status(200).json({ received: true });
      void this.processWebhook(req.body as CloudWebhookBody);
    });

    await new Promise<void>((resolve) => {
      app.listen(this.port, () => {
        console.log(`✅ WhatsApp Cloud API-webhook luistert op http://localhost:${this.port}/webhook`);
        console.log('   Zet deze URL + je WHATSAPP_VERIFY_TOKEN in de Meta-app (WhatsApp → Configuration).');
        if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
          console.log('   ⚠️  WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID nog niet gezet: de bot ontvangt wel, maar kan nog niet antwoorden.');
        }
        resolve();
      });
    });
  }

  /** Loop door de webhook-payload en verwerk elk echt bericht (geen statusupdates). */
  private async processWebhook(body: CloudWebhookBody): Promise<void> {
    const handler = this.handler;
    if (!handler) return;

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const messages = change?.value?.messages;
        if (!Array.isArray(messages)) continue; // bv. bezorgstatussen: overslaan
        for (const msg of messages) {
          await this.handleMessage(msg, handler);
        }
      }
    }
  }

  /** Eén inkomend bericht: uitpakken → brein → antwoord terugsturen. */
  private async handleMessage(msg: CloudMessage, handler: MessageHandler): Promise<void> {
    const from = msg.from;
    if (!from) return;

    console.log(`[whatsapp-cloud] bericht van ${from} (type: ${msg.type ?? 'onbekend'})`);
    try {
      const content = await this.toUserContent(msg);
      const reply = await handler(from, content);
      await this.send(from, reply);
    } catch (err) {
      console.error('[whatsapp-cloud] verwerken bericht mislukt:', err);
      await this.send(from, 'Sorry, er ging iets mis. Probeer het zo nog eens.');
    }
  }

  /** Zet een Cloud API-bericht om naar de interne UserContent (tekst + foto's). */
  private async toUserContent(msg: CloudMessage): Promise<UserContent> {
    if (msg.type === 'text') {
      return { text: msg.text?.body };
    }
    if (msg.type === 'image' && msg.image?.id) {
      const image = await this.downloadMedia(msg.image.id);
      return { text: msg.image.caption, images: image ? [image] : undefined };
    }
    // Audio, locatie, stickers e.d. ondersteunen we (nog) niet inhoudelijk.
    return { text: `(klant stuurde een bericht van type '${msg.type}')` };
  }

  /** Download een afbeelding via de Cloud API (twee stappen: metadata → binair). */
  private async downloadMedia(mediaId: string): Promise<ImageInput | null> {
    const token = process.env.WHATSAPP_TOKEN;
    if (!token) return null;
    try {
      const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!metaRes.ok) return null;
      const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
      if (!meta.url || !meta.mime_type || !SUPPORTED_IMAGE_TYPES.has(meta.mime_type)) return null;

      const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
      if (!binRes.ok) return null;
      const data = Buffer.from(await binRes.arrayBuffer()).toString('base64');
      return { mediaType: meta.mime_type as ImageInput['mediaType'], data };
    } catch (err) {
      console.error('[whatsapp-cloud] media downloaden mislukt:', err);
      return null;
    }
  }

  /** Stuur een tekstbericht via de Cloud API. */
  async send(to: string, text: string): Promise<void> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      console.warn(
        '[whatsapp-cloud] kan niet versturen: stel WHATSAPP_TOKEN en WHATSAPP_PHONE_NUMBER_ID in.',
      );
      return;
    }

    // Cloud API verwacht een kaal nummer, bv. '31612345678'.
    const recipient = to.replace(/^whatsapp:/, '').replace(/^\+/, '');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: text },
      }),
    });
    if (!res.ok) {
      console.error(`[whatsapp-cloud] versturen mislukt (${res.status}):`, await res.text());
    }
  }
}
