import { describe, it, expect } from 'vitest';
import { normalize, normalizeWithAlternatives, DEFAULT_FILLERS } from './index';
import type { TranscriptSegment } from '../types';

function seg(text: string, isFinal = true): TranscriptSegment {
  return { text, isFinal, timestamp: 0 };
}

describe('B2 TextNormalizer – normalize', () => {
  // Tabellen-getriebene Fälle: [Eingabe, erwartete normalized-Formen]
  const cases: Array<[string, string[]]> = [
    ['Hallo, wie geht es dir?', ['hallo', 'wie', 'geht', 'es', 'dir']],
    ['SignBridge ist GUT', ['signbridge', 'ist', 'gut']],
    ['Universität Prüfung groß', ['universität', 'prüfung', 'groß']],
    ['S-Bahn um 8 Uhr', ['s', 'bahn', 'um', '8', 'uhr']],
    ['Das Jahr 2026, der 3. Mai', ['das', 'jahr', '2026', 'der', '3', 'mai']],
    ['', []],
    ['   ', []],
    ['!?.,;:-', []],
  ];

  it.each(cases)('normalisiert %j', (input, expected) => {
    const tokens = normalize(seg(input), 'seg-1');
    expect(tokens.map((t) => t.normalized)).toEqual(expected);
  });

  it('erhält die Original-Schreibweise in raw', () => {
    const tokens = normalize(seg('Hörsäle SIND groß'), 'seg-1');
    expect(tokens.map((t) => t.raw)).toEqual(['Hörsäle', 'SIND', 'groß']);
    expect(tokens.map((t) => t.normalized)).toEqual(['hörsäle', 'sind', 'groß']);
  });

  it('hängt segmentId an jedes Token', () => {
    const tokens = normalize(seg('eins zwei'), 'abc-42');
    expect(tokens.every((t) => t.segmentId === 'abc-42')).toBe(true);
  });

  it('behält ß und Umlaute als Wortbestandteile', () => {
    const tokens = normalize(seg('Straße Möhre über'), 'seg-1');
    expect(tokens.map((t) => t.normalized)).toEqual(['straße', 'möhre', 'über']);
  });

  it('behandelt zerlegte und vorkomponierte Umlaute identisch', () => {
    const precomposed = normalize(seg('Tür'), 's'); // U+00FC
    const decomposed = normalize(seg('Tür'.normalize('NFD')), 's'); // u + U+0308
    expect(decomposed.map((t) => t.normalized)).toEqual(precomposed.map((t) => t.normalized));
    expect(decomposed[0]?.normalized).toBe('tür');
  });

  it('hält großes ẞ als Wortbestandteil und schreibt es klein', () => {
    // ẞ (U+1E9E) ist die Großform von ß; darf das Wort nicht zerreißen.
    expect(normalize(seg('STRAẞE'), 's').map((t) => t.normalized)).toEqual(['straße']);
  });

  it('hält Akzentwörter als ein Token zusammen (statt sie zu verstümmeln)', () => {
    // Nicht-deutsche Akzente bleiben erhalten; B3 entscheidet dann über unknown.
    expect(normalize(seg('Café Renée'), 's').map((t) => t.normalized)).toEqual(['café', 'renée']);
  });

  it('filtert Füllwörter nur bei aktivierter Option', () => {
    const text = 'äh ich halt weiß quasi nicht';
    const ohne = normalize(seg(text), 's');
    expect(ohne.map((t) => t.normalized)).toEqual(['äh', 'ich', 'halt', 'weiß', 'quasi', 'nicht']);

    const mit = normalize(seg(text), 's', { filterFillers: true });
    expect(mit.map((t) => t.normalized)).toEqual(['ich', 'weiß', 'nicht']);
  });

  it('akzeptiert eine eigene Füllwortliste', () => {
    const tokens = normalize(seg('genau das meine ich'), 's', {
      filterFillers: true,
      fillers: ['genau'],
    });
    expect(tokens.map((t) => t.normalized)).toEqual(['das', 'meine', 'ich']);
  });

  it('enthält die dokumentierten Standard-Füllwörter', () => {
    expect(DEFAULT_FILLERS).toContain('äh');
    expect(DEFAULT_FILLERS).toContain('quasi');
  });
});

describe('B2 TextNormalizer – normalizeWithAlternatives', () => {
  it('verhält sich ohne Alternativen wie normalize', () => {
    const tokens = normalizeWithAlternatives(seg('hallo welt'), 's');
    expect(tokens.map((t) => t.normalized)).toEqual(['hallo', 'welt']);
    expect(tokens.every((t) => t.candidates === undefined)).toBe(true);
  });

  it('richtet deckungsgleiche Alternativen pro Position aus (Homophon-Fall)', () => {
    const s: TranscriptSegment = {
      ...seg('ich höre häuser'),
      alternatives: ['ich höre heiser', 'ich höre reiser'],
    };
    const tokens = normalizeWithAlternatives(s, 's');
    expect(tokens.map((t) => t.normalized)).toEqual(['ich', 'höre', 'häuser']);
    // Position 0/1 identisch in allen Hypothesen → keine Kandidaten:
    expect(tokens[0]?.candidates).toBeUndefined();
    expect(tokens[1]?.candidates).toBeUndefined();
    // Position 2 unterscheidet sich → Kandidaten in Reihenfolge, dedupliziert:
    expect(tokens[2]?.candidates).toEqual(['heiser', 'reiser']);
  });

  it('ignoriert Alternativen mit abweichender Tokenzahl (keine Fehlausrichtung)', () => {
    const s: TranscriptSegment = {
      ...seg('guten tag'),
      alternatives: ['guten', 'guten tag zusammen', 'guten abend'],
    };
    const tokens = normalizeWithAlternatives(s, 's');
    // Nur "guten abend" ist deckungsgleich (2 Tokens):
    expect(tokens[0]?.candidates).toBeUndefined();
    expect(tokens[1]?.candidates).toEqual(['abend']);
  });

  it('reicht die Konfidenz an jedes Token durch', () => {
    const s: TranscriptSegment = { ...seg('hallo welt'), confidence: 0.77 };
    const tokens = normalizeWithAlternatives(s, 's');
    expect(tokens.every((t) => t.confidence === 0.77)).toBe(true);
  });
});
