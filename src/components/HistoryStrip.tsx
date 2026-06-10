/**
 * B6 — Verlaufsstreifen.
 *
 * Horizontaler, scrollender Streifen der zuletzt angezeigten Items.
 */
import type { SignItem } from '../types';

interface HistoryStripProps {
  history: SignItem[];
}

function shortLabel(item: SignItem): string {
  if (item.kind === 'fingerspell') return item.token.raw;
  return item.token.raw;
}

export function HistoryStrip({ history }: HistoryStripProps) {
  if (history.length === 0) return null;

  return (
    <section aria-label="Verlauf" className="w-full">
      <h2 className="mb-1 text-center text-xs font-semibold uppercase tracking-widest opacity-50">
        Verlauf
      </h2>
      <ol className="flex justify-center gap-2 overflow-x-auto pb-1">
        {history.map((item, i) => (
          <li
            key={`${item.token.segmentId}-${i}`}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
              item.kind === 'sign'
                ? 'bg-brand/15 text-brand'
                : item.kind === 'fingerspell'
                  ? 'bg-accent/15 text-accent'
                  : 'bg-black/10 opacity-70 dark:bg-white/10'
            }`}
            title={item.kind}
          >
            <span aria-hidden className="text-xs">
              {item.kind === 'sign' ? '✋' : item.kind === 'fingerspell' ? '🔤' : '?'}
            </span>
            {shortLabel(item)}
          </li>
        ))}
      </ol>
    </section>
  );
}
