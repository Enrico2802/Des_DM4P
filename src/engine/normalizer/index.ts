/**
 * B2 — TextNormalizer
 *
 * TranscriptSegment → Token[]. Reine Funktion, kein State, keine Seiteneffekte.
 *
 * Schritte:
 *  - Tokenisierung an Wortgrenzen (Whitespace, Satzzeichen, Bindestriche),
 *  - Kleinschreibung für die Lookup-Form, Original (`raw`) bleibt erhalten,
 *  - Satzzeichen entfernen, Umlaute/ß bleiben erhalten,
 *  - Zahlen werden als eigene Tokens durchgereicht (→ Fingeralphabet/Zahlgebärden),
 *  - optionales Filtern von Füllwörtern.
 *
 * `segmentId` wird an jedes Token gehängt, damit B5 Interim-Tokens ersetzen kann.
 */
import type { TranscriptSegment, Token } from '../types';

/**
 * Was als „Wort" gilt: alle Unicode-Buchstaben (inkl. Umlauten, kleinem ß UND
 * großem ẞ) sowie Ziffern. Bewusst breit, damit Großschreibung mit ẞ und
 * Akzentwörter (z. B. „Café") als EIN Token erhalten bleiben statt verstümmelt
 * zu werden. B3 stuft nicht buchstabierbare Wörter anschließend als „unknown" ein.
 */
const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

/** Standard-Füllwörter (überschreibbar via Optionen). */
export const DEFAULT_FILLERS: readonly string[] = [
  'äh',
  'ähm',
  'ah',
  'ahm',
  'halt',
  'quasi',
  'sozusagen',
];

export interface NormalizeOptions {
  /** Füllwörter aus der Liste entfernen (Default: false). */
  filterFillers?: boolean;
  /** Eigene Füllwortliste (Default: {@link DEFAULT_FILLERS}). */
  fillers?: readonly string[];
}

/**
 * Zerlegt ein TranscriptSegment in normalisierte Tokens.
 *
 * @param segment   Rohtext-Segment aus B1.
 * @param segmentId Stabile Id des Segments (von B1 vergeben).
 * @param options   Optionales Füllwort-Filtering.
 */
export function normalize(
  segment: TranscriptSegment,
  segmentId: string,
  options: NormalizeOptions = {},
): Token[] {
  const fillerSet =
    options.filterFillers === true
      ? new Set((options.fillers ?? DEFAULT_FILLERS).map((f) => f.normalize('NFC').toLowerCase()))
      : null;

  // NFC zuerst, damit zerlegte Umlaute (a + ¨) zu einem Codepoint werden und
  // vom Wortmuster erfasst werden.
  const matches = segment.text.normalize('NFC').match(WORD_PATTERN) ?? [];

  const tokens: Token[] = [];
  for (const raw of matches) {
    const normalized = raw.toLowerCase();
    if (fillerSet?.has(normalized)) continue;
    tokens.push({ raw, normalized, segmentId });
  }
  return tokens;
}

/**
 * Wie {@link normalize}, reichert die Tokens aber mit `candidates` (alternative
 * normalisierte Formen pro Wortposition) und der `confidence` des Segments an.
 *
 * Ausrichtung der Alternativen: Die Web Speech API liefert GANZE Sätze als
 * Alternativen, nicht einzelne Wörter. Wir richten daher nur Alternativen aus,
 * die nach der Normalisierung dieselbe Tokenzahl wie die Primärhypothese haben
 * — dann ist die i-te Alternative der i-ten Primärposition zuzuordnen. Das deckt
 * den häufigen Fall „ein Wort anders erkannt" (Homophone) sauber ab und
 * vermeidet Fehlausrichtungen bei abweichender Wortzahl.
 */
export function normalizeWithAlternatives(
  segment: TranscriptSegment,
  segmentId: string,
  options: NormalizeOptions = {},
): Token[] {
  const tokens = normalize(segment, segmentId, options);
  if (tokens.length === 0) return tokens;

  // Pro Position eine Liste alternativer normalisierter Formen sammeln.
  const perPosition: string[][] = tokens.map(() => []);
  for (const altText of segment.alternatives ?? []) {
    const altTokens = normalize({ ...segment, text: altText }, segmentId, options);
    if (altTokens.length !== tokens.length) continue; // nur deckungsgleiche ausrichten
    altTokens.forEach((altTok, i) => {
      const cand = altTok.normalized;
      const primary = tokens[i]?.normalized;
      const list = perPosition[i];
      if (list && cand !== primary && !list.includes(cand)) list.push(cand);
    });
  }

  return tokens.map((token, i) => {
    const candidates = perPosition[i] ?? [];
    return {
      ...token,
      ...(candidates.length ? { candidates } : {}),
      ...(typeof segment.confidence === 'number' ? { confidence: segment.confidence } : {}),
    };
  });
}
