import { describe, it, expect, vi } from 'vitest';
import { Dictionary, validateEntries, loadDictionary } from './index';
import type { DictEntry } from '../types';

const ENTRIES: DictEntry[] = [
  { word: 'hallo', imageUrl: '/signs/hallo.svg', variants: ['hi', 'hey'] },
  { word: 'universität', imageUrl: '/signs/uni.svg', variants: ['uni'] },
  { word: 'hey', imageUrl: '/signs/hey-eigen.svg' }, // Grundform kollidiert mit Variante oben
];

describe('B0 Dictionary – lookup & Varianten', () => {
  const dict = new Dictionary(ENTRIES);

  it('findet eine Grundform', () => {
    expect(dict.lookup('hallo')?.imageUrl).toBe('/signs/hallo.svg');
  });

  it('löst Varianten auf', () => {
    expect(dict.lookup('hi')?.word).toBe('hallo');
    expect(dict.lookup('uni')?.word).toBe('universität');
  });

  it('ist case-insensitive und umlaut-/NFC-stabil', () => {
    expect(dict.lookup('HALLO')?.word).toBe('hallo');
    expect(dict.lookup('Universität')?.word).toBe('universität');
  });

  it('gibt null für unbekannte Wörter zurück', () => {
    expect(dict.lookup('katze')).toBeNull();
  });

  it('Grundform gewinnt gegen die Variante eines anderen Eintrags', () => {
    // "hey" ist Variante von "hallo" UND eigene Grundform → Grundform gewinnt.
    expect(dict.lookup('hey')?.imageUrl).toBe('/signs/hey-eigen.svg');
  });
});

describe('B0 Dictionary – validateEntries', () => {
  it('akzeptiert gültige Einträge', () => {
    expect(validateEntries(ENTRIES)).toHaveLength(3);
  });

  it('wirft, wenn die Daten kein Array sind', () => {
    expect(() => validateEntries({ word: 'x' })).toThrow(/Array/);
  });

  it('wirft bei fehlendem word/imageUrl', () => {
    expect(() => validateEntries([{ imageUrl: '/x.svg' }])).toThrow(/word/);
    expect(() => validateEntries([{ word: 'x' }])).toThrow(/imageUrl/);
  });

  it('wirft bei ungültigen variants', () => {
    expect(() => validateEntries([{ word: 'x', imageUrl: '/x.svg', variants: [1, 2] }])).toThrow(
      /variants/,
    );
  });
});

describe('B0 loadDictionary – fetch + Validierung (ohne Cache)', () => {
  it('lädt, validiert und indiziert', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ENTRIES,
    } as Response);

    const dict = await loadDictionary('/dictionary.json', { fetchFn, useCache: false });
    expect(fetchFn).toHaveBeenCalledWith('/dictionary.json');
    expect(dict.lookup('hi')?.word).toBe('hallo');
  });

  it('wirft bei HTTP-Fehler', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(loadDictionary('/x.json', { fetchFn, useCache: false })).rejects.toThrow(/404/);
  });

  it('wirft bei ungültigem JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ not: 'an array' }),
    } as Response);
    await expect(loadDictionary('/x.json', { fetchFn, useCache: false })).rejects.toThrow(/Array/);
  });
});
