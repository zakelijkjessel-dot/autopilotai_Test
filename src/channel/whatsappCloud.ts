import express from 'express';
import { Channel, MessageHandler } from './channel';

/**
 * WhatsApp via de officiële **Meta WhatsApp Cloud API** (alternatief voor
 * Twilio). Meta stuurt inkomende berichten naar een webhook en verwacht eerst
 * een verificatie-handshake bij het instellen.
 *
 * Benodigde omgevingsvariabelen (zie .env.example):
 *   WHATSAPP_VERIFY_TOKEN      – zelfgekozen token voor de webhook-verificatie
 *   WHATSAPP_TOKEN             – (later, voor antwoorden) permanent access token
 *   WHATSAPP_PHONE_NUMBER_ID   – (later, voor antwoorden) phone number id
 *   PORT                       – poort van de webhookserver
 *
 * Endpoints:
 *   GET  /webhook  – Meta-verificatie (hub.mode / hub.verify_token / hub.challenge)
 *   POST /webhook  – binnenkomende berichten (nu: loggen ter inspectie)
 */
export class WhatsAppCloudChannel implements Channel {
  private readonly port = Number(process.env.PORT || 3000);

  async start(handler: MessageHandler): Promise<void> {
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
    // Voorlopig loggen we de volledige payload, zodat je de structuur van
    // WhatsApp-berichten kunt bekijken in de logs. Volgende stap: hier het
    // bericht uitpakken, `handler` aanroepen en met `send()` antwoorden.
    app.post(['/webhook', '/api/webhook'], (req, res) => {
      console.log('[whatsapp-cloud] inkomende payload:\n' + JSON.stringify(req.body, null, 2));
      res.status(200).json({ received: true });
    });

    await new Promise<void>((resolve) => {
      app.listen(this.port, () => {
        console.log(`✅ WhatsApp Cloud API-webhook luistert op http://localhost:${this.port}/webhook`);
        console.log('   Zet deze URL + je WHATSAPP_VERIFY_TOKEN in de Meta-app (WhatsApp → Configuration).');
        console.log('   ℹ️  Inkomende berichten worden nu alleen gelogd (nog geen automatische antwoorden).');
        resolve();
      });
    });
  }

  /**
   * Stuur een tekstbericht via de Cloud API. Pas bruikbaar zodra WHATSAPP_TOKEN
   * en WHATSAPP_PHONE_NUMBER_ID zijn ingesteld (nodig voor herinneringen en,
   * later, automatische antwoorden).
   */
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
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
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
