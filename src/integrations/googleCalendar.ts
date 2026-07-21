import { JWT } from 'google-auth-library';
import { GarageConfig } from '../config/garage';
import { Appointment } from '../domain/types';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const API_BASE = 'https://www.googleapis.com/calendar/v3/calendars';

/**
 * Spiegelt afspraken naar Google Calendar via een service-account (server-to-
 * server, geen inlogscherm). Bewust eenrichting: de interne agenda blijft de
 * bron voor beschikbaarheid; hier zetten we een kopie in jullie Google-agenda.
 *
 * Alle methodes zijn "fail-safe": als Google hapert of verkeerd is ingesteld,
 * loggen we een fout maar laten we de boeking gewoon staan.
 *
 * Omgevingsvariabelen (zie .env.example):
 *   GOOGLE_CLIENT_EMAIL   – e-mail van de service-account
 *   GOOGLE_PRIVATE_KEY    – private key van de service-account
 *   GOOGLE_CALENDAR_ID    – id van de agenda die je met de service-account deelt
 */
export class GoogleCalendarSync {
  private readonly client: JWT;

  constructor(
    private readonly calendarId: string,
    private readonly config: GarageConfig,
    clientEmail: string,
    privateKey: string,
  ) {
    this.client = new JWT({ email: clientEmail, key: privateKey, scopes: SCOPES });
  }

  /** Maak een event; geeft het Google-event-id terug (of null bij een fout). */
  async createEvent(appt: Appointment, serviceName: string): Promise<string | null> {
    try {
      const created = (await this.request('POST', '/events', this.toEvent(appt, serviceName))) as {
        id?: string;
      };
      return created.id ?? null;
    } catch (err) {
      console.error('[google-calendar] event aanmaken mislukt:', err);
      return null;
    }
  }

  /** Werk een bestaand event bij (bv. na verzetten). */
  async updateEvent(appt: Appointment, serviceName: string): Promise<void> {
    if (!appt.googleEventId) return;
    try {
      await this.request('PATCH', `/events/${encodeURIComponent(appt.googleEventId)}`, this.toEvent(appt, serviceName));
    } catch (err) {
      console.error('[google-calendar] event bijwerken mislukt:', err);
    }
  }

  /** Verwijder een event (bv. na annuleren). */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      await this.request('DELETE', `/events/${encodeURIComponent(eventId)}`);
    } catch (err) {
      console.error('[google-calendar] event verwijderen mislukt:', err);
    }
  }

  /** Zet een afspraak om naar een Google Calendar-event. */
  private toEvent(appt: Appointment, serviceName: string): Record<string, unknown> {
    const endISO = new Date(new Date(appt.start).getTime() + appt.durationMin * 60_000).toISOString();
    const vehicle = [appt.vehicle.brand, appt.vehicle.model, appt.vehicle.licensePlate]
      .filter(Boolean)
      .join(' ');
    const description = [
      `Klant: ${appt.customer.name ?? 'onbekend'}`,
      appt.customer.phone ? `Telefoon: ${appt.customer.phone}` : '',
      appt.customer.email ? `E-mail: ${appt.customer.email}` : '',
      vehicle ? `Voertuig: ${vehicle}` : '',
      appt.complaint ? `Klacht: ${appt.complaint}` : '',
      `Referentie: ${appt.id}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      summary: `${serviceName} — ${appt.customer.name ?? 'klant'}`,
      description,
      start: { dateTime: appt.start, timeZone: this.config.timezone },
      end: { dateTime: endISO, timeZone: this.config.timezone },
    };
  }

  /** Eén geauthenticeerde REST-aanroep naar de Calendar API. */
  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const { token } = await this.client.getAccessToken();
    const res = await fetch(`${API_BASE}/${encodeURIComponent(this.calendarId)}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Google Calendar ${method} ${res.status}: ${await res.text()}`);
    }
    // DELETE geeft een lege body terug.
    return method === 'DELETE' ? null : res.json();
  }
}

/**
 * Maakt de koppeling aan als alle Google-variabelen zijn ingesteld; anders null
 * (dan draait de bot gewoon met de interne agenda).
 */
export function createGoogleCalendarSync(config: GarageConfig): GoogleCalendarSync | null {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!clientEmail || !privateKey || !calendarId) return null;

  // In omgevingsvariabelen staan newlines vaak als letterlijke "\n".
  const key = privateKey.replace(/\\n/g, '\n');
  console.log('✅ Google Calendar: afspraken worden gespiegeld naar de gedeelde agenda.');
  return new GoogleCalendarSync(calendarId, config, clientEmail, key);
}
