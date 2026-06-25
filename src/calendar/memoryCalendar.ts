import { GarageConfig } from '../config/garage';
import { Slot } from '../domain/types';
import { Store } from '../store/store';
import { Calendar } from './calendar';

/** Stappgrootte waarop we slots aanbieden (in minuten). */
const SLOT_GRID_MIN = 30;
/** Minimale voorbereidingstijd: niet binnen nu + dit aantal minuten boeken. */
const LEAD_TIME_MIN = 60;

/**
 * Agenda op basis van de in-memory/JSON-store. Rekent vrije slots uit binnen
 * de openingstijden en houdt rekening met al geboekte afspraken.
 *
 * Let op: werkt in de lokale tijd van het proces. Zet daarom de TZ-omgeving
 * (bv. Europe/Amsterdam) gelijk aan de tijdzone van de garage.
 */
export class MemoryCalendar implements Calendar {
  constructor(
    private readonly config: GarageConfig,
    private readonly store: Store,
  ) {}

  isFree(startISO: string, durationMin: number): boolean {
    const start = new Date(startISO);
    const end = new Date(start.getTime() + durationMin * 60_000);
    if (!this.withinOpeningHours(start, end)) return false;
    return !this.overlapsExisting(start, end);
  }

  findAvailableSlots(durationMin: number, fromISO: string, toISO: string, max = 6): Slot[] {
    const slots: Slot[] = [];
    const now = new Date();
    const earliest = new Date(now.getTime() + LEAD_TIME_MIN * 60_000);

    let cursor = new Date(Math.max(new Date(fromISO).getTime(), earliest.getTime()));
    const until = new Date(toISO);

    // Begin op een nette rastergrens.
    cursor = this.ceilToGrid(cursor);

    while (cursor < until && slots.length < max) {
      const hours = this.openingForDay(cursor);
      if (hours) {
        const open = this.atTime(cursor, hours.open);
        const close = this.atTime(cursor, hours.close);
        let slotStart = new Date(Math.max(cursor.getTime(), open.getTime()));
        slotStart = this.ceilToGrid(slotStart);

        while (slots.length < max) {
          const slotEnd = new Date(slotStart.getTime() + durationMin * 60_000);
          if (slotEnd > close) break;
          if (slotStart >= earliest && !this.overlapsExisting(slotStart, slotEnd)) {
            slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
          }
          slotStart = new Date(slotStart.getTime() + SLOT_GRID_MIN * 60_000);
        }
      }
      // Naar de volgende dag, 00:00.
      cursor = this.nextMidnight(cursor);
    }

    return slots;
  }

  // ----- Hulpfuncties -----

  private openingForDay(d: Date): { open: string; close: string } | null {
    return this.config.openingHours[d.getDay()] ?? null;
  }

  private withinOpeningHours(start: Date, end: Date): boolean {
    const hours = this.openingForDay(start);
    if (!hours) return false;
    const open = this.atTime(start, hours.open);
    const close = this.atTime(start, hours.close);
    return start >= open && end <= close;
  }

  private overlapsExisting(start: Date, end: Date): boolean {
    return this.store.bookedAppointments().some((appt) => {
      const aStart = new Date(appt.start);
      const aEnd = new Date(aStart.getTime() + appt.durationMin * 60_000);
      return start < aEnd && aStart < end; // standaard interval-overlap
    });
  }

  /** Date op dezelfde dag, op het opgegeven "HH:MM" (lokale tijd). */
  private atTime(day: Date, hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
  }

  private ceilToGrid(d: Date): Date {
    const ms = SLOT_GRID_MIN * 60_000;
    return new Date(Math.ceil(d.getTime() / ms) * ms);
  }

  private nextMidnight(d: Date): Date {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    n.setDate(n.getDate() + 1);
    return n;
  }
}
