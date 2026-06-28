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
  /** Erkannter Rohtext (beste Hypothese der API). */
  text: string;
  /** Web Speech API: interim (false) vs. final (true). */
  isFinal: boolean;
  /** Zeitstempel (ms seit Epoch) der Erkennung. */
  timestamp: number;
  /**
   * Weitere ganze Erkennungs-Hypothesen der API (best-first, OHNE die Primär-
   * hypothese `text`), sofern `maxAlternatives > 1` gesetzt ist. Wird von B2 pro
   * Token-Position ausgewertet, damit B3 bei einem Fehlgriff eine Hypothese
   * wählen kann, die als Gebärde existiert (z. B. „heiser" statt „Häuser").
   */
  alternatives?: string[];
  /**
   * Konfidenz der Primärhypothese (0..1), wie sie die API für FINALE Ergebnisse
   * liefert. Bei Interim-Ergebnissen meist 0/undefined. Niedrige Werte sind ein
   * Signal für unsichere Erkennung.
   */
  confidence?: number;
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
  /**
   * Alternative normalisierte Formen für DIESE Wortposition, abgeleitet aus den
   * Erkennungs-Alternativen der API (best-first, ohne `normalized`). B3 probiert
   * sie, falls die Primärform keine Gebärde trifft.
   */
  candidates?: string[];
  /** Konfidenz der Erkennung (0..1), vom Segment durchgereicht. */
  confidence?: number;
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
