import type Anthropic from '@anthropic-ai/sdk';
import { GarageConfig, findService } from '../config/garage';
import { Calendar } from '../calendar/calendar';
import { Email } from '../email/email';
import { Store, Session } from '../store/store';
import { Appointment } from '../domain/types';
import { estimatePrice } from '../domain/pricing';
import { estimateWorkshopTime } from '../domain/timeEstimate';
import { formatDateTimeNL, formatPriceRange } from '../util/format';
import { lookupVehicle } from '../integrations/rdw';
import { GoogleCalendarSync } from '../integrations/googleCalendar';

/** Alles wat de tool-uitvoerders nodig hebben. */
export interface ToolContext {
  config: GarageConfig;
  calendar: Calendar;
  store: Store;
  email: Email;
  /** Optionele spiegeling naar Google Calendar (null = niet gekoppeld). */
  calendarSync?: GoogleCalendarSync | null;
  /** Sessie van de huidige klant (id = telefoonnummer / WhatsApp-id). */
  session: Session;
}

/** De gereedschapskist die we aan Claude meegeven. */
export const tools: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description:
      'Zoek vrije momenten in de agenda voor een dienst. Gebruik dit altijd voordat je een tijd voorstelt — verzin geen tijden.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Het id van de dienst, bv. "apk" of "remmen".' },
        from_date: {
          type: 'string',
          description: 'Vroegste datum om vanaf te zoeken, formaat YYYY-MM-DD. Laat weg voor "vanaf nu".',
        },
        num_days: {
          type: 'integer',
          description: 'Hoeveel dagen vooruit zoeken (standaard 14).',
        },
        complaint: {
          type: 'string',
          description: 'Optionele klacht/wens; helpt de werkplaatstijd en dus de slotlengte te bepalen.',
        },
      },
      required: ['service_id'],
    },
  },
  {
    name: 'estimate_price',
    description: 'Geef een eerlijke richtprijs (van–tot) en geschatte werkplaatstijd voor een dienst.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Het id van de dienst.' },
        complaint: { type: 'string', description: 'Optionele klacht/wens voor een nauwkeuriger schatting.' },
      },
      required: ['service_id'],
    },
  },
  {
    name: 'book_appointment',
    description:
      'Boek een afspraak op een vrij moment. Doe dit pas als je dienst, een gekozen starttijd en de naam van de klant hebt. De e-mailbevestiging wordt automatisch verstuurd als er een e-mailadres is.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Het id van de dienst.' },
        start: {
          type: 'string',
          description: 'Starttijd in lokale tijd, ISO 8601 zonder tijdzone, bv. "2026-06-26T14:30:00". Gebruik een slot uit check_availability.',
        },
        customer_name: { type: 'string', description: 'Naam van de klant.' },
        email: { type: 'string', description: 'E-mailadres voor de bevestiging (indien bekend).' },
        vehicle_brand: { type: 'string', description: 'Merk van de auto.' },
        vehicle_model: { type: 'string', description: 'Type/model van de auto.' },
        license_plate: { type: 'string', description: 'Kenteken.' },
        complaint: { type: 'string', description: 'Klacht/wens.' },
      },
      required: ['service_id', 'start', 'customer_name'],
    },
  },
  {
    name: 'find_appointments',
    description: 'Zoek de bestaande (geboekte) afspraken van deze klant op. Gebruik dit voor annuleren of verzetten.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'cancel_appointment',
    description: 'Annuleer een bestaande afspraak van deze klant.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string', description: 'Het id van de afspraak (uit find_appointments).' },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'reschedule_appointment',
    description: 'Verzet een bestaande afspraak naar een nieuw vrij moment.',
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string', description: 'Het id van de afspraak (uit find_appointments).' },
        new_start: { type: 'string', description: 'Nieuwe starttijd, ISO 8601 zonder tijdzone, uit check_availability.' },
      },
      required: ['appointment_id', 'new_start'],
    },
  },
  {
    name: 'lookup_license_plate',
    description:
      'Zoek voertuiggegevens (merk, model, kleur, APK-vervaldatum) op bij de RDW aan de hand van een Nederlands kenteken. Handig tijdens de intake om merk/type automatisch te bepalen en te zien wanneer de APK verloopt.',
    input_schema: {
      type: 'object',
      properties: {
        license_plate: { type: 'string', description: 'Nederlands kenteken, bv. "AB-123-C" of "AB123C".' },
      },
      required: ['license_plate'],
    },
  },
];

/** Voer een tool uit en geef een (JSON-)string terug die naar Claude gaat. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  switch (name) {
    case 'check_availability':
      return checkAvailability(input, ctx);
    case 'estimate_price':
      return estimatePriceTool(input, ctx);
    case 'book_appointment':
      return bookAppointment(input, ctx);
    case 'find_appointments':
      return findAppointments(ctx);
    case 'cancel_appointment':
      return cancelAppointment(input, ctx);
    case 'reschedule_appointment':
      return rescheduleAppointment(input, ctx);
    case 'lookup_license_plate':
      return lookupLicensePlate(input);
    default:
      return ok({ error: `Onbekende tool: ${name}` });
  }
}

// ----- Tool-uitvoerders -----

function checkAvailability(input: Record<string, unknown>, ctx: ToolContext): string {
  const service = findService(ctx.config, String(input.service_id));
  if (!service) return ok({ error: `Onbekende dienst: ${input.service_id}` });

  const durationMin = estimateWorkshopTime(service, asString(input.complaint));
  const numDays = typeof input.num_days === 'number' ? input.num_days : 14;

  const from = input.from_date ? new Date(`${input.from_date}T00:00:00`) : new Date();
  const to = new Date(from.getTime() + numDays * 24 * 60 * 60_000);

  const slots = ctx.calendar.findAvailableSlots(durationMin, from.toISOString(), to.toISOString(), 6);

  return ok({
    service: service.name,
    duration_min: durationMin,
    slots: slots.map((s) => ({ start: s.start, human: formatDateTimeNL(s.start) })),
    message: slots.length ? undefined : 'Geen vrije momenten gevonden in deze periode.',
  });
}

function estimatePriceTool(input: Record<string, unknown>, ctx: ToolContext): string {
  const service = findService(ctx.config, String(input.service_id));
  if (!service) return ok({ error: `Onbekende dienst: ${input.service_id}` });

  const complaint = asString(input.complaint);
  const est = estimatePrice(ctx.config, service, complaint);
  const durationMin = estimateWorkshopTime(service, complaint);

  return ok({
    service: service.name,
    price_range: formatPriceRange(est.low, est.high),
    price_low: est.low,
    price_high: est.high,
    duration_min: durationMin,
    explanation: est.explanation,
  });
}

async function bookAppointment(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const service = findService(ctx.config, String(input.service_id));
  if (!service) return ok({ error: `Onbekende dienst: ${input.service_id}` });

  const start = parseLocalISO(asString(input.start));
  if (!start) return ok({ error: 'Ongeldige starttijd. Gebruik een slot uit check_availability.' });

  const complaint = asString(input.complaint);
  const durationMin = estimateWorkshopTime(service, complaint);

  if (!ctx.calendar.isFree(start, durationMin)) {
    return ok({
      error: 'Dat moment is niet (meer) vrij of valt buiten de openingstijden. Kies een ander slot via check_availability.',
    });
  }

  const est = estimatePrice(ctx.config, service, complaint);
  const name = asString(input.customer_name);
  const email = asString(input.email);

  // Onthoud klantgegevens op de sessie.
  ctx.session.customer = {
    phone: ctx.session.id,
    name: name || ctx.session.customer.name,
    email: email || ctx.session.customer.email,
  };

  const appt: Appointment = {
    id: makeId(),
    customer: { phone: ctx.session.id, name, email },
    vehicle: {
      brand: asString(input.vehicle_brand),
      model: asString(input.vehicle_model),
      licensePlate: asString(input.license_plate),
    },
    serviceId: service.id,
    complaint,
    start,
    durationMin,
    status: 'booked',
    priceEstimateLow: est.low,
    priceEstimateHigh: est.high,
    createdAt: new Date().toISOString(),
  };

  ctx.store.addAppointment(appt);
  ctx.store.saveSession(ctx.session);

  // Spiegel naar Google Calendar (indien gekoppeld); faalt nooit hard.
  if (ctx.calendarSync) {
    try {
      const eventId = await ctx.calendarSync.createEvent(appt, service.name);
      if (eventId) ctx.store.updateAppointment(appt.id, { googleEventId: eventId });
    } catch (err) {
      console.error('[google-calendar] spiegelen bij boeken mislukt:', err);
    }
  }

  let emailed = false;
  let emailFailed = false;
  if (email) {
    try {
      await ctx.email.send(buildConfirmationEmail(ctx.config, appt, service.name));
      emailed = true;
    } catch (err) {
      emailFailed = true;
      console.error('[email] versturen van bevestiging mislukt:', err);
    }
  }

  return ok({
    booked: true,
    appointment_id: appt.id,
    service: service.name,
    when: formatDateTimeNL(start),
    duration_min: durationMin,
    price_range: formatPriceRange(est.low, est.high),
    email_sent: emailed,
    note: emailed
      ? undefined
      : emailFailed
        ? 'De bevestigingsmail kon niet verstuurd worden; de afspraak staat wél vast. Bied eventueel aan de bevestiging later te sturen.'
        : 'Nog geen e-mailadres bekend — vraag dit als de klant een bevestiging per mail wil.',
  });
}

function findAppointments(ctx: ToolContext): string {
  const appts = ctx.store.findAppointmentsByPhone(ctx.session.id);
  return ok({
    appointments: appts.map((a) => ({
      appointment_id: a.id,
      service: serviceName(ctx, a.serviceId),
      when: formatDateTimeNL(a.start),
      vehicle: [a.vehicle.brand, a.vehicle.model, a.vehicle.licensePlate].filter(Boolean).join(' '),
    })),
  });
}

async function cancelAppointment(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const id = String(input.appointment_id ?? '');
  const appt = ctx.store.getAppointment(id);
  if (!appt || appt.customer.phone !== ctx.session.id) {
    return ok({ error: 'Afspraak niet gevonden voor deze klant.' });
  }
  if (appt.status === 'cancelled') return ok({ error: 'Deze afspraak is al geannuleerd.' });

  ctx.store.updateAppointment(id, { status: 'cancelled' });
  if (appt.googleEventId && ctx.calendarSync) {
    try {
      await ctx.calendarSync.deleteEvent(appt.googleEventId);
    } catch (err) {
      console.error('[google-calendar] verwijderen bij annuleren mislukt:', err);
    }
  }
  return ok({ cancelled: true, appointment_id: id, when: formatDateTimeNL(appt.start) });
}

async function rescheduleAppointment(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const id = String(input.appointment_id ?? '');
  const appt = ctx.store.getAppointment(id);
  if (!appt || appt.customer.phone !== ctx.session.id) {
    return ok({ error: 'Afspraak niet gevonden voor deze klant.' });
  }

  const newStart = parseLocalISO(asString(input.new_start));
  if (!newStart) return ok({ error: 'Ongeldige nieuwe starttijd.' });

  // Maak het oude slot tijdelijk vrij zodat het de vrije-controle niet blokkeert.
  ctx.store.updateAppointment(id, { status: 'cancelled' });
  if (!ctx.calendar.isFree(newStart, appt.durationMin)) {
    ctx.store.updateAppointment(id, { status: 'booked' }); // herstel
    return ok({ error: 'Dat nieuwe moment is niet vrij of valt buiten de openingstijden. Kies een ander slot.' });
  }

  ctx.store.updateAppointment(id, { status: 'booked', start: newStart, reminderSent: false });
  if (appt.googleEventId && ctx.calendarSync) {
    try {
      await ctx.calendarSync.updateEvent(appt, serviceName(ctx, appt.serviceId));
    } catch (err) {
      console.error('[google-calendar] bijwerken bij verzetten mislukt:', err);
    }
  }
  return ok({ rescheduled: true, appointment_id: id, when: formatDateTimeNL(newStart) });
}

async function lookupLicensePlate(input: Record<string, unknown>): Promise<string> {
  const plate = asString(input.license_plate);
  if (!plate) return ok({ error: 'Geen kenteken opgegeven.' });

  const vehicle = await lookupVehicle(plate);
  if (!vehicle) {
    return ok({ found: false, message: 'Geen voertuig gevonden bij de RDW voor dit kenteken.' });
  }
  return ok({ found: true, vehicle });
}

// ----- Hulpfuncties -----

function serviceName(ctx: ToolContext, serviceId: string): string {
  return findService(ctx.config, serviceId)?.name ?? serviceId;
}

/** E-mailtekst voor een bevestiging. */
function buildConfirmationEmail(config: GarageConfig, appt: Appointment, serviceName: string) {
  const vehicle = [appt.vehicle.brand, appt.vehicle.model, appt.vehicle.licensePlate].filter(Boolean).join(' ');
  const price =
    appt.priceEstimateLow != null && appt.priceEstimateHigh != null
      ? formatPriceRange(appt.priceEstimateLow, appt.priceEstimateHigh)
      : 'op aanvraag';

  const body = `Beste ${appt.customer.name || 'klant'},

Bedankt voor je afspraak bij ${config.name}. Hierbij de bevestiging:

  Dienst:     ${serviceName}
  Datum/tijd: ${formatDateTimeNL(appt.start)}
  Voertuig:   ${vehicle || 'niet opgegeven'}${appt.complaint ? `\n  Klacht:     ${appt.complaint}` : ''}
  Richtprijs: ${price}
  Referentie: ${appt.id}

Adres: ${config.address}
Vragen of wijzigen? Stuur ons gerust een WhatsApp-bericht.

Met vriendelijke groet,
${config.name}
${config.phone}`;

  return {
    to: appt.customer.email as string,
    subject: `Bevestiging afspraak ${serviceName} – ${formatDateTimeNL(appt.start)}`,
    body,
  };
}

function ok(obj: unknown): string {
  return JSON.stringify(obj);
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/** Parse een lokale ISO-tijd ("2026-06-26T14:30:00") naar een ISO-string, of null. */
function parseLocalISO(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function makeId(): string {
  return `AFS-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0')}`;
}
