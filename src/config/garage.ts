import { Service } from '../domain/types';

/** Openingstijden per weekdag (0 = zondag ... 6 = zaterdag). null = gesloten. */
export interface OpeningHours {
  [weekday: number]: { open: string; close: string } | null;
}

/** Alle instellingen van één garage. Pas dit aan voor jouw garage. */
export interface GarageConfig {
  name: string;
  phone: string;
  email: string;
  address: string;
  /** IANA-tijdzone, bv. 'Europe/Amsterdam'. */
  timezone: string;
  currency: string;
  /** Uurtarief arbeid in euro (excl. btw-uitleg houden we simpel). */
  laborRatePerHour: number;
  openingHours: OpeningHours;
  services: Service[];
}

const services: Service[] = [
  {
    id: 'apk',
    name: 'APK-keuring',
    description: 'Wettelijk verplichte keuring. Vaak combineerbaar met een kleine beurt.',
    basePrice: 55,
    baseDurationMin: 45,
    isAPK: true,
  },
  {
    id: 'kleine-beurt',
    name: 'Kleine beurt',
    description: 'Olie + filter verversen, vloeistoffen en banden controleren.',
    basePrice: 60,
    baseDurationMin: 60,
  },
  {
    id: 'grote-beurt',
    name: 'Grote beurt',
    description: 'Uitgebreide onderhoudsbeurt incl. filters, bougies en controles.',
    basePrice: 150,
    baseDurationMin: 150,
  },
  {
    id: 'bandenwissel',
    name: 'Bandenwissel (zomer/winter)',
    description: 'Wisselen en uitbalanceren van een setje banden op velg.',
    basePrice: 40,
    baseDurationMin: 45,
  },
  {
    id: 'nieuwe-banden',
    name: 'Nieuwe banden monteren',
    description: 'Oude banden eraf, nieuwe erop, monteren en balanceren (prijs banden apart).',
    basePrice: 80,
    baseDurationMin: 60,
  },
  {
    id: 'remmen',
    name: 'Remmen vervangen',
    description: 'Remblokken en/of remschijven vervangen (voor- of achteras).',
    basePrice: 180,
    baseDurationMin: 120,
  },
  {
    id: 'olie-verversen',
    name: 'Olie verversen',
    description: 'Motorolie en oliefilter vervangen.',
    basePrice: 50,
    baseDurationMin: 30,
  },
  {
    id: 'airco-service',
    name: 'Airco-service',
    description: 'Airco bijvullen, controleren en ontsmetten.',
    basePrice: 90,
    baseDurationMin: 60,
  },
  {
    id: 'distributieriem',
    name: 'Distributieriem vervangen',
    description: 'Vervangen van distributieriem en spanrol; groot onderhoud.',
    basePrice: 450,
    baseDurationMin: 240,
  },
  {
    id: 'diagnose',
    name: 'Storingsdiagnose',
    description: 'Uitlezen en zoeken naar de oorzaak van een storing of waarschuwingslampje.',
    basePrice: 50,
    baseDurationMin: 60,
  },
];

/**
 * Voorbeeldgarage. Vervang naam, contactgegevens, openingstijden,
 * tarieven en diensten door die van de echte garage.
 */
export const garageConfig: GarageConfig = {
  name: 'Garage De Vrij',
  phone: '+31 20 123 4567',
  email: 'afspraken@garagedevrij.nl',
  address: 'Werkplaatsstraat 12, 1011 AB Amsterdam',
  timezone: process.env.TZ || 'Europe/Amsterdam',
  currency: 'EUR',
  laborRatePerHour: 75,
  openingHours: {
    0: null, // zondag gesloten
    1: { open: '08:00', close: '17:30' }, // maandag
    2: { open: '08:00', close: '17:30' },
    3: { open: '08:00', close: '17:30' },
    4: { open: '08:00', close: '17:30' },
    5: { open: '08:00', close: '17:30' }, // vrijdag
    6: { open: '09:00', close: '13:00' }, // zaterdag
  },
  services,
};

/** Zoek een dienst op id. */
export function findService(config: GarageConfig, serviceId: string): Service | undefined {
  return config.services.find((s) => s.id === serviceId);
}
