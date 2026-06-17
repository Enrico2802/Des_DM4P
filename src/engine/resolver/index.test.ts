import { describe, it, expect } from 'vitest';
import { resolve } from './index';
import type { DictEntry, LookupFn, Token } from '../types';

function tok(normalized: string, raw = normalized): Token {
  return { raw, normalized, segmentId: 's' };
}

/** Mini-Wörterbuch + case-insensitiver Lookup als Test-Double für B0. */
function makeLookup(words: Record<string, string>): LookupFn {
  const map = new Map<string, DictEntry>();
  for (const [word, imageUrl] of Object.entries(words)) {
    map.set(word.toLowerCase(), { word, imageUrl });
  }
  return (w) => map.get(w.toLowerCase()) ?? null;
}

describe('B3 SignResolver – resolve', () => {
  const lookup = makeLookup({
    hallo: '/signs/hallo.svg',
    frage: '/signs/frage.svg',
    lernen: '/signs/lernen.svg',
    haus: '/signs/haus.svg',
  });

  it('(1) findet die exakte Form', () => {
    const item = resolve(tok('hallo'), lookup);
    expect(item).toEqual({ kind: 'sign', token: tok('hallo'), imageUrl: '/signs/hallo.svg' });
  });

  it('(2) löst eine Flexionsform über die Lemma-Heuristik auf', () => {
    // "fragen" -> "-n" entfernen -> "frage" (im Dictionary)
    const item = resolve(tok('fragen'), lookup);
    expect(item.kind).toBe('sign');
    if (item.kind === 'sign') expect(item.imageUrl).toBe('/signs/frage.svg');
  });

  it('(2) probiert mehrere Endungen, bis ein Treffer kommt', () => {
    // "häuser" wäre Umlaut-Plural; teste stattdessen reguläre Endung:
    // "lernen" exakt vorhanden; "lernst" -> "-st" -> "lern" (kein Treffer)
    // -> daher buchstabieren, NICHT fälschlich auf "lernen" mappen.
    const item = resolve(tok('lernst'), lookup);
    expect(item.kind).toBe('fingerspell');
  });

  it('(2) respektiert die Mindest-Stammlänge (keine Über-Kürzung)', () => {
    const tiny = makeLookup({ is: '/signs/is.svg' });
    // "ist" -> "-t" -> "is" hätte Länge 2 (< 3) -> kein Lemma-Treffer -> buchstabieren
    const item = resolve(tok('ist'), tiny);
    expect(item.kind).toBe('fingerspell');
  });

  it('(3) buchstabiert unbekannte, aber buchstabierbare Wörter', () => {
    const item = resolve(tok('xyz'), lookup);
    expect(item.kind).toBe('fingerspell');
    if (item.kind === 'fingerspell') {
      expect(item.letters.map((l) => l.char)).toEqual(['x', 'y', 'z']);
    }
  });

  it('(4) liefert "unknown" für leere normalisierte Eingaben', () => {
    const item = resolve(tok('', 'ε'), lookup); // normalized leer
    expect(item.kind).toBe('unknown');
  });

  it('(4) liefert "unknown" für Wörter MIT nicht buchstabierbaren Zeichen', () => {
    // Der eigentliche Spec-Pfad: das Wort enthält nicht buchstabierbare Zeichen.
    expect(resolve(tok('café'), lookup).kind).toBe('unknown'); // é nicht im Fingeralphabet
    expect(resolve(tok('abc-def'), lookup).kind).toBe('unknown'); // Bindestrich
  });

  it('exakter Treffer schlägt Lemma-Heuristik (kein vorschnelles Kürzen)', () => {
    // "lernen" ist exakt vorhanden und darf nicht zu "lern..." gekürzt werden.
    const item = resolve(tok('lernen'), lookup);
    expect(item.kind).toBe('sign');
    if (item.kind === 'sign') expect(item.imageUrl).toBe('/signs/lernen.svg');
  });

  it('reicht das Original-Token unverändert durch', () => {
    const t = tok('hallo', 'Hallo');
    const item = resolve(t, lookup);
    expect(item.token).toBe(t);
  });
});
