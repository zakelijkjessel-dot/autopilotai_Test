// Centrale datatypes voor de garage-chatbot.

/** Een dienst die de garage aanbiedt (APK, beurt, banden, etc.). */
export interface Service {
  id: string;
  name: string;
  /** Korte uitleg die de bot mag gebruiken in antwoorden. */
  description: string;
  /** Richtprijs in euro voor onderdelen/vaste kosten (excl. arbeid die per uur loopt). */
  basePrice: number;
  /** Standaard werkplaatstijd in minuten. */
  baseDurationMin: number;
  /** Markeer APK zodat de bot er een kleine beurt bij kan voorstellen (upselling). */
  isAPK?: boolean;
}

/** Voertuiggegevens uit de intake. */
export interface Vehicle {
  brand?: string;
  model?: string;
  /** Kenteken, bv. "AB-123-C". */
  licensePlate?: string;
  year?: number;
}

/** Klantgegevens. */
export interface Customer {
  name?: string;
  /** Telefoonnummer / WhatsApp-id; uniek per klant. */
  phone: string;
  email?: string;
}

export type AppointmentStatus = 'booked' | 'cancelled';

/** Een geplande afspraak in de agenda. */
export interface Appointment {
  id: string;
  customer: Customer;
  vehicle: Vehicle;
  serviceId: string;
  /** Vrije omschrijving van de klacht/wens. */
  complaint?: string;
  /** Start in ISO 8601 (lokale tijd van de garage). */
  start: string;
  /** Geschatte werkplaatstijd in minuten. */
  durationMin: number;
  status: AppointmentStatus;
  /** Richtprijs die de klant vooraf kreeg. */
  priceEstimateLow?: number;
  priceEstimateHigh?: number;
  createdAt: string;
  /** Is er al een herinnering gestuurd? Voorkomt dubbele reminders. */
  reminderSent?: boolean;
}

/** Een vrij tijdslot in de agenda. */
export interface Slot {
  /** Start in ISO 8601. */
  start: string;
  /** Einde in ISO 8601. */
  end: string;
}

/** Een afbeelding die een klant meestuurt (foto-analyse). */
export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  /** Base64-gecodeerde inhoud (zonder data:-prefix). */
  data: string;
}

/** Inhoud van een binnenkomend bericht: tekst en/of foto's. */
export interface UserContent {
  text?: string;
  images?: ImageInput[];
}
