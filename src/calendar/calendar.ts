import { Slot } from '../domain/types';

/**
 * Agenda-koppeling. De simulator-versie rekent zelf vrije slots uit; een
 * Google/Outlook-implementatie kan dezelfde interface invullen zodat de rest
 * van de bot niet verandert.
 */
export interface Calendar {
  /** Zoek vrije slots van minstens `durationMin` minuten tussen twee momenten. */
  findAvailableSlots(durationMin: number, fromISO: string, toISO: string, max?: number): Slot[];
  /** Is een specifiek tijdstip vrij voor `durationMin` minuten? */
  isFree(startISO: string, durationMin: number): boolean;
}
