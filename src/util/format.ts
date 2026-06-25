import { garageConfig } from '../config/garage';

/** Formatteer een ISO-tijd als nette Nederlandse datum + tijd. */
export function formatDateTimeNL(iso: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: garageConfig.timezone,
  }).format(new Date(iso));
}

/** Alleen de tijd, bv. "14:30". */
export function formatTimeNL(iso: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: garageConfig.timezone,
  }).format(new Date(iso));
}

/** Bedragnotatie, bv. "€ 95". */
export function formatEuro(amount: number): string {
  return `€ ${Math.round(amount)}`;
}

/** Richtprijs van–tot, bv. "€ 95 – € 130". */
export function formatPriceRange(low: number, high: number): string {
  return `${formatEuro(low)} – ${formatEuro(high)}`;
}
