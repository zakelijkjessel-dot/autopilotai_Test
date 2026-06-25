import { Service, Vehicle } from './types';

/**
 * Schat de werkplaatstijd (in minuten) voor een dienst.
 * Begint bij de standaardtijd van de dienst en past die aan op basis van
 * signaalwoorden in de klacht. Bewust simpel en uitlegbaar.
 */
export function estimateWorkshopTime(
  service: Service,
  complaint?: string,
  _vehicle?: Vehicle,
): number {
  let minutes = service.baseDurationMin;
  const text = (complaint || '').toLowerCase();

  // Klachten die doorgaans extra tijd kosten.
  const heavySignals = ['lekkage', 'lek', 'distributie', 'koppeling', 'motor', 'versnellingsbak'];
  const mediumSignals = ['piept', 'piepen', 'trilt', 'trillen', 'lampje', 'storing', 'geluid', 'rammelt'];

  if (heavySignals.some((s) => text.includes(s))) minutes += 60;
  else if (mediumSignals.some((s) => text.includes(s))) minutes += 30;

  // Rond af op kwartieren voor nette agendablokken.
  return Math.ceil(minutes / 15) * 15;
}
