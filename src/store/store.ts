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

export interface DbShape {
  appointments: Appointment[];
  sessions: Record<string, Session>;
}

/**
 * Waar de gegevens bewaard worden. De bot houdt alles in geheugen; deze laag
 * laadt bij het opstarten en bewaart bij wijzigingen. Standaard een JSON-
 * bestand; met Supabase een database (zelfde methodes, geen andere logica).
 */
export interface Persistence {
  load(): Promise<DbShape>;
  save(db: DbShape): Promise<void>;
}

/**
 * Opslag met een pluggbare backend. De methodes zijn synchroon (werken op de
 * kopie in geheugen); persistentie gebeurt gedebounced op de achtergrond.
 */
export class Store {
  private db: DbShape = { appointments: [], sessions: {} };
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly persistence: Persistence = new FilePersistence()) {}

  async load(): Promise<void> {
    this.db = await this.persistence.load();
    this.db.appointments ||= [];
    this.db.sessions ||= {};
  }

  /** Sla op (gedebounced) zodat we niet bij elke wijziging naar de backend schrijven. */
  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, 250);
  }

  async flush(): Promise<void> {
    try {
      await this.persistence.save(this.db);
    } catch (err) {
      console.error('[store] opslaan mislukt (gegevens blijven in geheugen):', err);
    }
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

/** Standaardopslag: een lokaal JSON-bestand. Genoeg voor ontwikkeling en demo's. */
export class FilePersistence implements Persistence {
  private readonly file: string;

  constructor(dataDir = path.resolve(process.cwd(), 'data')) {
    this.file = path.join(dataDir, 'db.json');
  }

  async load(): Promise<DbShape> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      return JSON.parse(raw) as DbShape;
    } catch {
      return { appointments: [], sessions: {} };
    }
  }

  async save(db: DbShape): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(db, null, 2), 'utf8');
  }
}
