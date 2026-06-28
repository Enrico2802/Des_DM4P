/**
 * B3 — SignResolver
 *
 * Token → SignItem. Reine Funktion mit injiziertem `lookup` (aus B0).
 *
 * Lookup-Kaskade:
 *   1. exakter Lookup der normalisierten Form,
 *   2. einfache deutsche Lemma-Heuristik (Flexionsendungen kürzen, erneut suchen),
 *   3. ASR-Alternativen (token.candidates): exakt + Lemma — wählt die Hypothese,
 *      die tatsächlich als Gebärde existiert (Qualitätsgewinn bei Homophonen),
 *   4. Korrektur/Fuzzy (B3.5) auf Primärform und Alternativen,
 *   5. Fallback an B4 (Fingeralphabet),
 *   6. sonst „unknown" (Wort enthält nicht buchstabierbare Zeichen).
 */
import type { LookupFn, SignItem, Token } from '../types';
import { fingerspell, isFingerspellable } from '../fingerspelling';

/**
 * Flexionsendungen, die für die Lemma-Heuristik schrittweise gekürzt werden.
 * Reihenfolge gemäß Konzept: längere/häufigere Endungen zuerst.
 */
const SUFFIXES: readonly string[] = ['en', 'er', 'es', 'e', 'st', 't', 'n'];

/** Mindestlänge des verbleibenden Stamms nach dem Kürzen. */
const MIN_STEM_LENGTH = 3;

function sign(token: Token, imageUrl: string): SignItem {
  return { kind: 'sign', token, imageUrl };
}

/**
 * Versucht, über das Kürzen einer Flexionsendung einen Wörterbuchtreffer zu
 * finden. Gibt den Treffer-`imageUrl` zurück oder null.
 */
function resolveByLemma(normalized: string, lookup: LookupFn): string | null {
  for (const suffix of SUFFIXES) {
    if (!normalized.endsWith(suffix)) continue;
    const stem = normalized.slice(0, normalized.length - suffix.length);
    if (stem.length < MIN_STEM_LENGTH) continue;
    const hit = lookup(stem);
    if (hit) return hit.imageUrl;
  }
  return null;
}

export interface ResolveOptions {
  /**
   * Korrektur-/Fuzzy-Funktion aus B3.5: normalisierte Form → korrigierte Form
   * (Wörterbuchschlüssel) oder null. Wird nur genutzt, wenn Primärform und
   * Alternativen keinen Treffer liefern.
   */
  correct?: (normalized: string) => string | null;
}

/** Versucht exakten und Lemma-Treffer für eine normalisierte Form. */
function lookupExactOrLemma(normalized: string, lookup: LookupFn): string | null {
  const exact = lookup(normalized);
  if (exact) return exact.imageUrl;
  return resolveByLemma(normalized, lookup);
}

/**
 * Löst ein Token zu einem SignItem auf.
 *
 * @param token   normalisiertes Token aus B2 (ggf. mit `candidates`).
 * @param lookup  Wörterbuch-Lookup aus B0 (case-insensitive erwartet).
 * @param options optionale Korrektur-Funktion (B3.5).
 */
export function resolve(token: Token, lookup: LookupFn, options: ResolveOptions = {}): SignItem {
  // 1) + 2) Primärform: exakt, dann Lemma-Heuristik.
  const primaryUrl = lookupExactOrLemma(token.normalized, lookup);
  if (primaryUrl) return sign(token, primaryUrl);

  // 3) ASR-Alternativen: erste Hypothese nehmen, die als Gebärde existiert.
  for (const candidate of token.candidates ?? []) {
    const candUrl = lookupExactOrLemma(candidate, lookup);
    if (candUrl) return sign(token, candUrl);
  }

  // 4) Korrektur/Fuzzy auf Primärform und Alternativen.
  if (options.correct) {
    for (const form of [token.normalized, ...(token.candidates ?? [])]) {
      const corrected = options.correct(form);
      if (corrected) {
        const hit = lookup(corrected);
        if (hit) return sign(token, hit.imageUrl);
      }
    }
  }

  // 5) Fingeralphabet-Fallback.
  if (isFingerspellable(token.normalized)) {
    return fingerspell(token);
  }

  // 6) Weder Gebärde noch buchstabierbar.
  return { kind: 'unknown', token };
}
