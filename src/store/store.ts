import { promises as fs } from 'fs';
import path from 'path';
import type Anthropic from '@anthropic-ai/sdk';
import { Appointment, Customer } from '../domain/types';

/** Gespreksstatus per klant (telefoonnummer / WhatsApp-id). */
export interface Session {
  id: string;
  customer: Customer;
  /** Volledige berichtgeschiedenis voor Claude. */
  history: Anthropic.MessageParam[];
}

interface DbShape {
  appointments: Appointment[];
  sessions: Record<string, Session>;
}

/**
 * Eenvoudige opslag in een JSON-bestand. Genoeg voor ontwikkeling en demo's.
 * Voor productie vervang je dit door bv. PostgreSQL achter dezelfde methodes.
 */
export class Store {
  private db: DbShape = { appointments: [], sessions: {} };
  private readonly file: string;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(dataDir = path.resolve(process.cwd(), 'data')) {
    this.file = path.join(dataDir, 'db.json');
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      this.db = JSON.parse(raw);
      this.db.appointments ||= [];
      this.db.sessions ||= {};
    } catch {
      // Nog geen bestand: begin leeg.
      this.db = { appointments: [], sessions: {} };
    }
  }

  /** Sla op (gedebounced) zodat we niet bij elk bericht naar schijf schrijven. */
  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 250);
  }

  async flush(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.db, null, 2), 'utf8');
  }

  // ----- Afspraken -----

  addAppointment(appt: Appointment): void {
    this.db.appointments.push(appt);
    this.scheduleSave();
  }

  getAppointment(id: string): Appointment | undefined {
    return this.db.appointments.find((a) => a.id === id);
  }

  /** Actieve (geboekte) afspraken van een klant, op tijd gesorteerd. */
  findAppointmentsByPhone(phone: string, includeCancelled = false): Appointment[] {
    return this.db.appointments
      .filter((a) => a.customer.phone === phone && (includeCancelled || a.status === 'booked'))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  /** Alle geboekte afspraken (voor agenda-berekeningen). */
  bookedAppointments(): Appointment[] {
    return this.db.appointments.filter((a) => a.status === 'booked');
  }

  updateAppointment(id: string, patch: Partial<Appointment>): Appointment | undefined {
    const appt = this.getAppointment(id);
    if (!appt) return undefined;
    Object.assign(appt, patch);
    this.scheduleSave();
    return appt;
  }

  // ----- Sessies -----

  getSession(id: string): Session {
    let session = this.db.sessions[id];
    if (!session) {
      session = { id, customer: { phone: id }, history: [] };
      this.db.sessions[id] = session;
    }
    return session;
  }

  saveSession(session: Session): void {
    this.db.sessions[session.id] = session;
    this.scheduleSave();
  }
}
