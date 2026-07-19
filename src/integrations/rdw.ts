/**
 * RDW Open Data — voertuiggegevens opzoeken op kenteken.
 * Gratis, publieke overheidsdata (geen sleutel, geen persoonsgegevens).
 * Dataset "Gekentekende voertuigen": https://opendata.rdw.nl/resource/m9d7-ebf2.json
 */

export interface RdwVehicle {
  plate: string;
  brand?: string; // merk
  model?: string; // handelsbenaming
  vehicleType?: string; // voertuigsoort (Personenauto, Bedrijfsauto, ...)
  color?: string; // eerste_kleur
  firstAdmission?: string; // datum eerste toelating (YYYY-MM-DD)
  apkExpiry?: string; // APK-vervaldatum (YYYY-MM-DD)
}

/** Ruwe RDW-velden die we gebruiken. */
interface RdwRow {
  kenteken?: string;
  merk?: string;
  handelsbenaming?: string;
  voertuigsoort?: string;
  eerste_kleur?: string;
  datum_eerste_toelating?: string;
  vervaldatum_apk?: string;
}

/** Zoek een voertuig op kenteken. Geeft null bij niet gevonden of een fout. */
export async function lookupVehicle(plate: string): Promise<RdwVehicle | null> {
  const kenteken = normalizePlate(plate);
  if (!kenteken) return null;

  try {
    const url = `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${encodeURIComponent(kenteken)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const rows = (await res.json()) as RdwRow[];
    const row = rows[0];
    if (!row) return null;

    return {
      plate: kenteken,
      brand: titleCase(row.merk),
      model: titleCase(row.handelsbenaming),
      vehicleType: titleCase(row.voertuigsoort),
      color: titleCase(row.eerste_kleur),
      firstAdmission: formatRdwDate(row.datum_eerste_toelating),
      apkExpiry: formatRdwDate(row.vervaldatum_apk),
    };
  } catch (err) {
    console.error('[rdw] opzoeken mislukt:', err);
    return null;
  }
}

/** Maak er 'AB123C' van: hoofdletters, alleen letters/cijfers. */
function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** 'VOLKSWAGEN' -> 'Volkswagen'. */
function titleCase(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

/** RDW-datum '20260301' -> '2026-03-01'. */
function formatRdwDate(value?: string): string | undefined {
  if (!value || !/^\d{8}$/.test(value)) return undefined;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
