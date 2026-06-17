import { describe, it, expect } from 'vitest';
import { fingerspell, isFingerspellable, ALPHABET_BASE } from './index';
import type { Token } from '../types';

function tok(normalized: string): Token {
  return { raw: normalized, normalized, segmentId: 's' };
}

function chars(normalized: string): string[] {
  const item = fingerspell(tok(normalized));
  if (item.kind !== 'fingerspell') throw new Error('expected fingerspell');
  return item.letters.map((l) => l.char);
}

describe('B4 FingerspellingEngine – fingerspell', () => {
  it('buchstabiert ein einfaches Wort Zeichen für Zeichen', () => {
    expect(chars('haus')).toEqual(['h', 'a', 'u', 's']);
  });

  it('erkennt "sch" als eigene Gebärde', () => {
    expect(chars('schule')).toEqual(['sch', 'u', 'l', 'e']);
    expect(chars('tisch')).toEqual(['t', 'i', 'sch']);
  });

  it('erkennt "ch" als eigene Gebärde', () => {
    expect(chars('ich')).toEqual(['i', 'ch']);
    expect(chars('buch')).toEqual(['b', 'u', 'ch']);
  });

  it('bevorzugt "sch" gegenüber "ch" (greedy, längster Treffer)', () => {
    // "schach": sch | a | ch
    expect(chars('schach')).toEqual(['sch', 'a', 'ch']);
  });

  it('mappt Umlaute und ß als eigene Zeichen', () => {
    expect(chars('möüäß')).toEqual(['m', 'ö', 'ü', 'ä', 'ß']);
  });

  it('mappt Ziffern 0–9', () => {
    expect(chars('2026')).toEqual(['2', '0', '2', '6']);
  });

  it('erzeugt korrekte Bildpfade nach der Konvention /alphabet/<zeichen>.svg', () => {
    const item = fingerspell(tok('sch'));
    if (item.kind !== 'fingerspell') throw new Error('expected fingerspell');
    expect(item.letters[0]).toEqual({ char: 'sch', imageUrl: `${ALPHABET_BASE}/sch.svg` });
  });

  it('liefert das Token unverändert zurück', () => {
    const t = tok('abc');
    const item = fingerspell(t);
    expect(item.token).toBe(t);
  });

  it('liefert für leere Eingabe eine leere Buchstabenliste', () => {
    expect(chars('')).toEqual([]);
  });
});

describe('B4 – isFingerspellable', () => {
  it('akzeptiert Buchstaben, Umlaute, ß und Ziffern', () => {
    expect(isFingerspellable('haus')).toBe(true);
    expect(isFingerspellable('straße')).toBe(true);
    expect(isFingerspellable('über42')).toBe(true);
  });

  it('lehnt leere Strings und nicht buchstabierbare Zeichen ab', () => {
    expect(isFingerspellable('')).toBe(false);
    expect(isFingerspellable('a b')).toBe(false);
    expect(isFingerspellable('café')).toBe(false); // é ist nicht im DGS-Fingeralphabet
  });
});
