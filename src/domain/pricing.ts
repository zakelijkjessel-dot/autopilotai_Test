import { GarageConfig } from '../config/garage';
import { Service, Vehicle } from './types';
import { estimateWorkshopTime } from './timeEstimate';

export interface PriceEstimate {
  low: number;
  high: number;
  currency: string;
  /** Korte, eerlijke uitleg waarop de richtprijs is gebaseerd. */
  explanation: string;
}

/**
 * Bereken een eerlijke richtprijs (van–tot) voor een dienst.
 * Formule: vaste kosten (onderdelen) + arbeid (geschatte tijd x uurtarief),
 * met een marge van -10% / +25% omdat de exacte staat pas in de werkplaats blijkt.
 */
export function estimatePrice(
  config: GarageConfig,
  service: Service,
  complaint?: string,
  vehicle?: Vehicle,
): PriceEstimate {
  const minutes = estimateWorkshopTime(service, complaint, vehicle);
  const laborCost = (minutes / 60) * config.laborRatePerHour;
  const midpoint = service.basePrice + laborCost;

  const low = Math.round((midpoint * 0.9) / 5) * 5;
  const high = Math.round((midpoint * 1.25) / 5) * 5;

  const hours = (minutes / 60).toFixed(1).replace('.', ',');
  const explanation =
    `Onderdelen/vaste kosten €${service.basePrice} + ongeveer ${hours} uur arbeid ` +
    `(€${config.laborRatePerHour}/uur). Definitieve prijs hangt af van de staat van de auto.`;

  return { low, high, currency: config.currency, explanation };
}
