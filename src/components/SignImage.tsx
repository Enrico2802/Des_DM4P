/**
 * Bild einer Gebärde/eines Buchstabens mit onError-Fallback auf eine Textkarte.
 * (Teil von B6 — SignRenderer.)
 */
import { useEffect, useState } from 'react';

interface SignImageProps {
  src: string;
  alt: string;
  /** Text, der angezeigt wird, falls das Bild nicht lädt. */
  label: string;
  className?: string;
}

export function SignImage({ src, alt, label, className = '' }: SignImageProps) {
  const [failed, setFailed] = useState(false);

  // Fehlerzustand zurücksetzen, wenn sich die Quelle ändert.
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center rounded-xl border-2 border-dashed border-current/40 bg-black/5 p-4 text-center font-bold uppercase ${className}`}
      >
        {label}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
