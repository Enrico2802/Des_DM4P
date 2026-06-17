/**
 * B4 — FingerspellingEngine
 *
 * Wort → Buchstabenfolge aus dem DGS-Fingeralphabet.
 *
 * Abgedeckte Zeichen: A–Z, Ä, Ö, Ü, ß sowie Ziffern 0–9.
 * Die Digraphen „sch" und „ch" sind im DGS-Fingeralphabet eigene Gebärden und
 * werden erkannt, BEVOR einzelne Buchstaben gemappt werden.
 *
 * Reine Funktion. Bildpfad-Konvention: /alphabet/<zeichen>.svg
 */
import type { FingerLetter, SignItem, Token } from '../types';

/** Verzeichnis der Fingeralphabet-Bilder (unter dem Web-Root / `public/`). */
export const ALPHABET_BASE = '/alphabet';

/** Einzelzeichen, die das Fingeralphabet abdeckt (ohne Digraphen). */
const SPELLABLE_CHAR = /^[a-zäöüß0-9]$/;

/** Erkennt, ob ein (normalisiertes) Wort vollständig buchstabierbar ist. */
export function isFingerspellable(normalized: string): boolean {
  return normalized.length > 0 && /^[a-zäöüß0-9]+$/.test(normalized);
}

function letter(char: string): FingerLetter {
  return { char, imageUrl: `${ALPHABET_BASE}/${char}.svg` };
}

/**
 * Zerlegt ein Token in Fingeralphabet-Buchstaben.
 *
 * Erwartet eine normalisierte (kleingeschriebene, NFC) `token.normalized`-Form.
 * Nicht buchstabierbare Zeichen werden defensiv übersprungen (B3 entscheidet
 * anhand von {@link isFingerspellable}, ob stattdessen „unknown" gilt).
 */
export function fingerspell(token: Token): SignItem {
  const w = token.normalized;
  const letters: FingerLetter[] = [];

  for (let i = 0; i < w.length; ) {
    // Digraphen zuerst, „sch" vor „ch" (sch enthält ch).
    if (w.startsWith('sch', i)) {
      letters.push(letter('sch'));
      i += 3;
      continue;
    }
    if (w.startsWith('ch', i)) {
      letters.push(letter('ch'));
      i += 2;
      continue;
    }

    const ch = w[i];
    i += 1;
    if (ch && SPELLABLE_CHAR.test(ch)) {
      letters.push(letter(ch));
    }
    // sonst: nicht buchstabierbares Zeichen → überspringen.
  }

  return { kind: 'fingerspell', token, letters };
}
