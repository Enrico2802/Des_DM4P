/**
 * B3 — SignResolver
 *
 * Token → SignItem. Reine Funktion mit injiziertem `lookup` (aus B0).
 *
 * Lookup-Kaskade:
 *   1. exakter Lookup der normalisierten Form,
 *   2. einfache deutsche Lemma-Heuristik (Flexionsendungen kürzen, erneut suchen),
 *   3. Fallback an B4 (Fingeralphabet),
 *   4. sonst „unknown" (Wort enthält nicht buchstabierbare Zeichen).
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

/**
 * Löst ein Token zu einem SignItem auf.
 *
 * @param token  normalisiertes Token aus B2.
 * @param lookup Wörterbuch-Lookup aus B0 (case-insensitive erwartet).
 */
export function resolve(token: Token, lookup: LookupFn): SignItem {
  // 1) Exakter Treffer.
  const exact = lookup(token.normalized);
  if (exact) return sign(token, exact.imageUrl);

  // 2) Lemma-Heuristik.
  const lemmaUrl = resolveByLemma(token.normalized, lookup);
  if (lemmaUrl) return sign(token, lemmaUrl);

  // 3) Fingeralphabet-Fallback.
  if (isFingerspellable(token.normalized)) {
    return fingerspell(token);
  }

  // 4) Weder Gebärde noch buchstabierbar.
  return { kind: 'unknown', token };
}
