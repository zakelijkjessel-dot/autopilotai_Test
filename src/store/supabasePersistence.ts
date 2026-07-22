import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DbShape, Persistence } from './store';

/**
 * Bewaart de bot-gegevens (afspraken + sessies) in Supabase, zodat ze een
 * herstart of nieuwe deploy overleven. We slaan de hele staat op als één
 * JSON-document in de tabel `garage_state` — simpel en betrouwbaar voor één
 * garage. (Losse tabellen per afspraak kunnen later, als je wilt rapporteren.)
 *
 * Vereist de tabel (eenmalig aanmaken, zie SUPABASE.md):
 *   create table garage_state (
 *     id text primary key,
 *     data jsonb not null,
 *     updated_at timestamptz default now()
 *   );
 */
const TABLE = 'garage_state';
const ROW_ID = 'main';

export class SupabasePersistence implements Persistence {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  async load(): Promise<DbShape> {
    const { data, error } = await this.client.from(TABLE).select('data').eq('id', ROW_ID).maybeSingle();
    if (error) {
      // Gooi door: beginnen met een lege staat zou bestaande data kunnen overschrijven.
      throw new Error(`Supabase laden mislukt: ${error.message}`);
    }
    if (!data) return { appointments: [], sessions: {} }; // nog geen data opgeslagen
    return data.data as DbShape;
  }

  async save(db: DbShape): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ id: ROW_ID, data: db, updated_at: new Date().toISOString() });
    if (error) throw new Error(`Supabase opslaan mislukt: ${error.message}`);
  }
}
