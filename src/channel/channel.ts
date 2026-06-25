import { UserContent } from '../domain/types';

/** Wordt aangeroepen bij elk binnenkomend bericht; geeft het antwoord terug. */
export type MessageHandler = (from: string, content: UserContent) => Promise<string>;

/**
 * Een berichtenkanaal (simulator, Twilio, later Meta Cloud API).
 * De rest van de bot praat alleen met deze interface, zodat we kanalen kunnen
 * wisselen zonder de logica te veranderen.
 */
export interface Channel {
  /** Start het kanaal en verwerk binnenkomende berichten via `handler`. */
  start(handler: MessageHandler): Promise<void>;
  /** Stuur proactief een bericht naar een klant (bv. een herinnering). */
  send(to: string, text: string): Promise<void>;
}
