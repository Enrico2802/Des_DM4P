import { describe, it, expect } from 'vitest';
import { levenshtein, nearestKey, createCorrector, DEFAULT_CORRECTIONS } from './index';

describe('B3.5 Correction – levenshtein', () => {
  it('ist 0 bei Gleichheit und gleich der Länge bei leerem Gegenstück', () => {
    expect(levenshtein('haus', 'haus')).toBe(0);
    expect(levenshtein('', 'haus')).toBe(4);
    expect(levenshtein('haus', '')).toBe(4);
  });

  it('zählt Ersetzen/Einfügen/Löschen je als 1', () => {
    expect(levenshtein('haus', 'maus')).toBe(1); // ersetzen
    expect(levenshtein('hau', 'haus')).toBe(1); // einfügen
    expect(levenshtein('hauss', 'haus')).toBe(1); // löschen
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });

  it('respektiert das Frühabbruch-Limit (gibt limit+1 zurück)', () => {
    expect(levenshtein('abcdef', 'uvwxyz', 1)).toBe(2);
  });
});

describe('B3.5 Correction – nearestKey', () => {
  const keys = ['hallo', 'danke', 'haus', 'maus', 'lernen'];

  it('findet den eindeutig nächsten Schlüssel innerhalb der Distanz', () => {
    expect(nearestKey('hallu', keys, 1)).toBe('hallo');
    expect(nearestKey('lernem', keys, 1)).toBe('lernen');
  });

  it('gibt null bei Gleichstand zurück (mehrdeutig)', () => {
    // "haus" und "maus" sind beide Distanz 1 zu "naus":
    expect(nearestKey('naus', keys, 1)).toBeNull();
  });

  it('gibt null zurück, wenn das Wort selbst ein Schlüssel ist', () => {
    expect(nearestKey('haus', keys, 1)).toBeNull();
  });

  it('gibt null zurück, wenn nichts innerhalb der Distanz liegt', () => {
    expect(nearestKey('komplettanders', keys, 1)).toBeNull();
  });
});

describe('B3.5 Correction – createCorrector', () => {
  const keys = ['hallo', 'danke', 'lernen', 'universität'];

  it('wendet zuerst die feste Korrekturtabelle an', () => {
    const correct = createCorrector(keys);
    expect(correct('hello')).toBe('hallo');
    expect(correct('thanks')).toBe('danke');
  });

  it('eigene Map überschreibt die Defaults', () => {
    const correct = createCorrector(keys, { map: { hello: 'danke' } });
    expect(correct('hello')).toBe('danke');
  });

  it('fällt auf Fuzzy-Match zurück', () => {
    const correct = createCorrector(keys);
    expect(correct('lernem')).toBe('lernen');
    expect(correct('universitat')).toBe('universität'); // fehlender Umlaut, Distanz 1
  });

  it('korrigiert kurze Wörter nicht (unter fuzzyMinLength)', () => {
    const correct = createCorrector(['tag', 'tat']);
    expect(correct('tas')).toBeNull(); // 3 Zeichen < Default 4
  });

  it('lässt sich der Fuzzy-Match abschalten (fuzzyMaxDistance 0)', () => {
    const correct = createCorrector(keys, { fuzzyMaxDistance: 0 });
    expect(correct('lernem')).toBeNull();
    expect(correct('hello')).toBe('hallo'); // Tabelle wirkt weiter
  });

  it('gibt null für bereits bekannte Wörter zurück', () => {
    const correct = createCorrector(keys);
    expect(correct('lernen')).toBeNull();
  });

  it('DEFAULT_CORRECTIONS enthält dokumentierte Einträge', () => {
    expect(DEFAULT_CORRECTIONS['hello']).toBe('hallo');
  });
});
