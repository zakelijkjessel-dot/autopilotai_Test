// Laad .env en zet de tijdzone vóór alle andere modules.
// Belangrijk: dit bestand als ALLEREERSTE importeren in index.ts, zodat
// openingstijden en agenda-berekeningen in de juiste tijdzone gebeuren.
import 'dotenv/config';

if (!process.env.TZ) {
  process.env.TZ = 'Europe/Amsterdam';
}
