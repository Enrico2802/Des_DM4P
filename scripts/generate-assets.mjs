/**
 * Erzeugt Platzhalter-Bilder für SignBridge.
 *
 * Das sind KEINE echten DGS-Gebärden, sondern saubere, beschriftete Platzhalter,
 * damit die Test-UI offline voll funktioniert. Für echte Gebärden später einfach
 * SignDict-PNG/SVG/Video nach public/signs bzw. public/alphabet legen und
 * public/dictionary.json darauf zeigen lassen — die Logik (B0–B5) bleibt gleich.
 *
 *   npm run generate:assets
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');

const WORD_COLOR = '#0b7285'; // teal — Wörterbuch-Gebärden
const LETTER_COLOR = '#9c4221'; // burnt orange — Fingeralphabet

/** Escapt die fünf XML-Sonderzeichen für sichere Text-Interpolation. */
function xml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Stilisierte Hand, damit die Platzhalter als „Gebärde" lesbar sind. */
function handGlyph(color) {
  return `
    <g transform="translate(100 96)" fill="${color}" opacity="0.9">
      <rect x="-34" y="-6" width="68" height="58" rx="22" />
      <rect x="-30" y="-54" width="13" height="60" rx="6" />
      <rect x="-13" y="-66" width="13" height="72" rx="6" />
      <rect x="4"   y="-64" width="13" height="70" rx="6" />
      <rect x="21"  y="-50" width="13" height="56" rx="6" />
      <rect x="-52" y="-2" width="40" height="13" rx="6" transform="rotate(-35 -32 4)" />
    </g>`;
}

function wordSvg(label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img" aria-label="Gebärde ${xml(label)}">
  <rect width="200" height="240" rx="18" fill="#ffffff" stroke="${WORD_COLOR}" stroke-width="3"/>
  <rect x="10" y="10" width="180" height="160" rx="12" fill="#e6fcf5"/>
  <rect x="14" y="16" width="44" height="20" rx="10" fill="${WORD_COLOR}"/>
  <text x="36" y="31" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">DGS</text>
  ${handGlyph(WORD_COLOR)}
  <text x="100" y="208" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="${WORD_COLOR}" text-anchor="middle">${xml(label)}</text>
</svg>
`;
}

function letterSvg(label) {
  const size = label.length > 1 ? 40 : 64; // SCH/CH kleiner als Einzelbuchstaben
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img" aria-label="Fingeralphabet ${xml(label)}">
  <rect width="200" height="240" rx="18" fill="#ffffff" stroke="${LETTER_COLOR}" stroke-width="3"/>
  <rect x="10" y="10" width="180" height="150" rx="12" fill="#fff4e6"/>
  ${handGlyph(LETTER_COLOR)}
  <text x="100" y="150" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="800" fill="${LETTER_COLOR}" text-anchor="middle">${xml(label)}</text>
  <text x="100" y="206" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600" fill="${LETTER_COLOR}" text-anchor="middle">Fingeralphabet</text>
</svg>
`;
}

async function writeSvg(absPath, contents) {
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, contents, 'utf8');
}

// Fingeralphabet: Dateiname = das Zeichen selbst (Konvention /alphabet/<zeichen>.svg).
const ALPHABET = [
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  'ä',
  'ö',
  'ü',
  'ß',
  'sch',
  'ch',
  ...'0123456789'.split(''),
];

async function main() {
  let count = 0;

  // 1) Fingeralphabet.
  for (const char of ALPHABET) {
    await writeSvg(resolve(PUBLIC, 'alphabet', `${char}.svg`), letterSvg(char.toUpperCase()));
    count += 1;
  }

  // 2) Wörterbuch-Gebärden (Pfade direkt aus dictionary.json).
  const dictRaw = await readFile(resolve(PUBLIC, 'dictionary.json'), 'utf8');
  const entries = JSON.parse(dictRaw);
  for (const entry of entries) {
    const rel = String(entry.imageUrl).replace(/^\/+/, ''); // "/signs/x.svg" -> "signs/x.svg"
    await writeSvg(resolve(PUBLIC, rel), wordSvg(entry.word));
    count += 1;
  }

  console.log(`Generated ${count} Platzhalter-Bilder unter public/alphabet/ und public/signs/.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
