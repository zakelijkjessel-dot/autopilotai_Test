import Anthropic from '@anthropic-ai/sdk';
import { GarageConfig } from '../config/garage';
import { Calendar } from '../calendar/calendar';
import { Email } from '../email/email';
import { Store, Session } from '../store/store';
import { UserContent } from '../domain/types';
import { buildSystemPrompt } from './systemPrompt';
import { tools, executeTool, ToolContext } from './tools';

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 2048;
/** Maximaal aantal tool-rondes per bericht (voorkomt vastlopen). */
const MAX_TOOL_ROUNDS = 6;

export interface BrainDeps {
  client: Anthropic;
  config: GarageConfig;
  calendar: Calendar;
  store: Store;
  email: Email;
}

/** Het "brein": vertaalt een binnenkomend bericht naar een antwoord, met tools. */
export class Brain {
  private readonly system: string;

  constructor(private readonly deps: BrainDeps) {
    this.system = buildSystemPrompt(deps.config);
  }

  /** Verwerk één binnenkomend bericht van een klant en geef het antwoord terug. */
  async handle(session: Session, content: UserContent): Promise<string> {
    session.history.push({ role: 'user', content: toContentBlocks(content) });

    const ctx: ToolContext = {
      config: this.deps.config,
      calendar: this.deps.calendar,
      store: this.deps.store,
      email: this.deps.email,
      session,
    };

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await this.deps.client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: this.system,
          tools,
          messages: session.history,
        });

        // Bewaar het antwoord van Claude (incl. eventuele tool-aanroepen).
        session.history.push({
          role: 'assistant',
          content: response.content as unknown as Anthropic.ContentBlockParam[],
        });

        if (response.stop_reason === 'tool_use') {
          const results = await this.runTools(response.content, ctx);
          session.history.push({ role: 'user', content: results });
          continue; // laat Claude verder met de tool-resultaten
        }

        return extractText(response.content);
      }

      return 'Sorry, dit lukt me even niet. Wil je het anders formuleren of ons bellen?';
    } catch (err) {
      console.error('[brain] fout bij verwerken bericht:', err);
      return 'Sorry, er ging technisch iets mis. Probeer het zo nog eens, of bel ons even.';
    } finally {
      this.deps.store.saveSession(session);
    }
  }

  /** Voer alle tool-aanroepen in een antwoord uit en bouw de tool_result-blokken. */
  private async runTools(
    blocks: Anthropic.ContentBlock[],
    ctx: ToolContext,
  ): Promise<Anthropic.ContentBlockParam[]> {
    const results: Anthropic.ContentBlockParam[] = [];
    for (const block of blocks) {
      if (block.type !== 'tool_use') continue;
      let content: string;
      try {
        content = await executeTool(block.name, block.input as Record<string, unknown>, ctx);
      } catch (err) {
        console.error(`[brain] tool '${block.name}' faalde:`, err);
        content = JSON.stringify({ error: 'Interne fout bij het uitvoeren van deze actie.' });
      }
      results.push({ type: 'tool_result', tool_use_id: block.id, content });
    }
    return results;
  }
}

/** Zet binnenkomende tekst/foto's om naar content-blokken voor Claude. */
function toContentBlocks(content: UserContent): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const img of content.images ?? []) {
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.data },
    });
  }
  const text = content.text?.trim();
  if (text) blocks.push({ type: 'text', text });
  // Claude verwacht minstens één blok.
  if (blocks.length === 0) blocks.push({ type: 'text', text: '(leeg bericht)' });
  return blocks;
}

/** Haal de platte tekst uit een antwoord van Claude. */
function extractText(blocks: Anthropic.ContentBlock[]): string {
  const text = blocks
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return text || 'Oké!';
}
