/**
 * B6 — SignRenderer (Hauptanzeige)
 *
 * Große aktuelle Gebärde (~2/3 der Bildschirmhöhe) + Wort als Untertitel;
 * Fingeralphabet als Buchstaben-Sequenz; "unknown" als Textkarte. Lädt die
 * Bilder der nächsten Items vor und respektiert aria-live für Screenreader.
 */
import { useEffect } from 'react';
import type { SignItem } from '../types';
import { SignImage } from './SignImage';

interface SignDisplayProps {
  current: SignItem | null;
  /** Nächste wartende Items — für Bild-Preloading. */
  upcoming: SignItem[];
  className?: string;
}

/** Sammelt alle Bild-URLs eines Items (Gebärde oder Buchstaben). */
function imageUrls(item: SignItem): string[] {
  if (item.kind === 'sign') return [item.imageUrl];
  if (item.kind === 'fingerspell') return item.letters.map((l) => l.imageUrl);
  return [];
}

export function SignDisplay({ current, upcoming, className = '' }: SignDisplayProps) {
  // Bilder der nächsten Items vorladen (Prompt 6: nächste ~5 Items).
  useEffect(() => {
    const urls = [...(current ? imageUrls(current) : []), ...upcoming.flatMap(imageUrls)];
    for (const url of urls) {
      const img = new Image();
      img.src = url;
    }
  }, [current, upcoming]);

  return (
    <section
      aria-label="Aktuelle Gebärde"
      className={`relative flex flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl border border-black/5 bg-white/70 p-4 shadow-xl ring-1 ring-black/5 backdrop-blur sm:p-8 dark:border-white/10 dark:bg-white/[0.04] ${className}`}
    >
      {/* Bühne: nimmt den Hauptteil der Höhe ein. */}
      <div className="flex w-full flex-1 items-center justify-center">
        {!current && (
          <div className="flex flex-col items-center gap-4 text-center opacity-50">
            <span aria-hidden className="text-7xl">
              🤟
            </span>
            <p className="text-xl font-medium">Bereit. Starte die Aufnahme oder gib Text ein.</p>
          </div>
        )}

        {current?.kind === 'sign' && (
          <SignImage
            src={current.imageUrl}
            alt={`Gebärde: ${current.token.raw}`}
            label={current.token.raw}
            className="h-[58vh] max-h-[620px] w-auto drop-shadow-lg"
          />
        )}

        {current?.kind === 'fingerspell' && (
          <div className="flex max-h-full flex-wrap items-end justify-center gap-3 sm:gap-4">
            {current.letters.map((letter, i) => (
              <figure key={`${letter.char}-${i}`} className="flex flex-col items-center">
                <SignImage
                  src={letter.imageUrl}
                  alt={`Fingeralphabet: ${letter.char}`}
                  label={letter.char.toUpperCase()}
                  className="h-[22vh] max-h-44 w-auto drop-shadow-md"
                />
                <figcaption className="mt-1 text-base font-bold uppercase tracking-wide">
                  {letter.char}
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {current?.kind === 'unknown' && (
          <div className="rounded-2xl border-2 border-dashed border-current/30 px-10 py-12 text-center">
            <p className="text-sm uppercase tracking-widest opacity-50">nicht darstellbar</p>
            <p className="mt-2 text-4xl font-bold">{current.token.raw}</p>
          </div>
        )}
      </div>

      {/* Wort als Untertitel. */}
      {current && (
        <p
          aria-live="polite"
          className="max-w-full truncate text-center text-4xl font-extrabold tracking-wide sm:text-5xl"
        >
          {current.token.raw}
        </p>
      )}
    </section>
  );
}
