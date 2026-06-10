/**
 * Zentrale Datentypen — der Vertrag zwischen allen Bausteinen B0–B8.
 *
 * Jeder Baustein kennt nur diese Typen, nicht die anderen Bausteine. Die
 * Verdrahtung übernimmt ausschließlich der SessionController (B7). Dadurch ist
 * jeder Baustein isoliert testbar und austauschbar.
 *
 * (Entspricht Abschnitt 2 des Logikbaustein-Konzepts.)
 */

/** Ergebnis aus der Spracherkennung (B1 → B2). */
export interface TranscriptSegment {
  /** Erkannter Rohtext. */
  text: string;
  /** Web Speech API: interim (false) vs. final (true). */
  isFinal: boolean;
  /** Zeitstempel (ms seit Epoch) der Erkennung. */
  timestamp: number;
}

/** Normalisiertes Wort (B2 → B3). */
export interface Token {
  /** Original-Schreibweise, z. B. "Hörsäle". */
  raw: string;
  /** Lookup-Form (kleingeschrieben, NFC), z. B. "hörsäle". */
  normalized: string;
  /**
   * Zuordnung zum TranscriptSegment. Wird durch die ganze Pipeline geführt,
   * damit B5 bereits angezeigte Interim-Tokens gezielt ersetzen kann.
   */
  segmentId: string;
}

/** Ein einzelner Fingeralphabet-Buchstabe innerhalb eines fingerspell-Items. */
export interface FingerLetter {
  /** Das Zeichen, z. B. "a", "ä", "sch", "ch", "ß", "7". */
  char: string;
  /** Bildpfad, Konvention: /alphabet/<zeichen>.svg. */
  imageUrl: string;
}

/**
 * Auflösungs-Ergebnis (B3 → B5).
 *
 * Diskriminierte Union über `kind`:
 *  - "sign":        genau ein Wörterbuch-Bild.
 *  - "fingerspell": Buchstabenfolge aus dem DGS-Fingeralphabet.
 *  - "unknown":     weder Gebärde noch buchstabierbar.
 */
export type SignItem =
  | { kind: 'sign'; token: Token; imageUrl: string }
  | { kind: 'fingerspell'; token: Token; letters: FingerLetter[] }
  | { kind: 'unknown'; token: Token };

/** Wörterbuch-Eintrag (B0). */
export interface DictEntry {
  /** Normalisierte Grundform. */
  word: string;
  /** Flexionsformen, die auf diesen Eintrag zeigen. */
  variants?: string[];
  /** PNG/SVG; später: videoUrl / animationId (Roadmap). */
  imageUrl: string;
}

/** Lookup-Funktion, wie sie B0 bereitstellt und B3 injiziert bekommt. */
export type LookupFn = (word: string) => DictEntry | null;
