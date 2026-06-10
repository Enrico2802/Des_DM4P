# SignBridge — Speech Becomes Sign

Browser-basierte App, die gesprochene Sprache in Echtzeit in DGS-Gebärdenbilder
übersetzt. Umsetzung nach dem Logikbaustein-Konzept (Wilks / Müller / Brodtmann).

> **Fokus dieser Umsetzung:** der **Logikteil** (B0–B5) ist vollständig, isoliert
> und unit-getestet. Die UI (B6) ist eine bewusst schlanke Test-Oberfläche.

---

## Architektur — Bausteine B0–B8

```
┌──────────────────────────────────────────────────────────────────┐
│                     B7 SessionController                           │
│              (Orchestrierung + State Machine)                      │
│                useSignBridge()  ·  src/modules/session             │
└──────────────────────────────────────────────────────────────────┘
     │            │             │              │            │
┌─────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐ ┌──────────┐
│ B1      │→│ B2       │→│ B3         │→│ B5        │→│ B6       │
│ Speech  │ │ Text-    │ │ Sign-      │ │ Display-  │ │ Sign-    │
│ Capture │ │ Normali- │ │ Resolver   │ │ Queue     │ │ Renderer │
│ (STT)   │ │ zer      │ │            │ │ (Timing)  │ │ (UI)     │
└─────────┘ └──────────┘ └─────┬──────┘ └───────────┘ └──────────┘
                               │ Fallback
                         ┌─────▼──────┐      ┌────────────────────┐
                         │ B4 Finger- │      │ B0 Dictionary-     │
                         │ spelling   │      │ Loader (SignDict)  │
                         └────────────┘      └────────────────────┘
                                             ┌────────────────────┐
                                             │ B8 SettingsStore   │
                                             └────────────────────┘
```

**Grundprinzip:** Jeder Baustein hat eine definierte Ein-/Ausgabe und kennt die
anderen nicht. Gekoppelt wird nur über die Typen in [`src/types.ts`](src/types.ts);
verdrahtet wird ausschließlich vom SessionController (B7). Dadurch ist jeder
Baustein isoliert testbar und austauschbar (PNG → GIF → 3D-Avatar betrifft nur B6/B0).

| Baustein | Datei | Aufgabe | Browser-API? | Getestet |
|----------|-------|---------|:---:|:---:|
| **B0** DictionaryLoader | [`src/modules/dictionary`](src/modules/dictionary/index.ts) | JSON laden, validieren, O(1)-Index, IndexedDB-Cache | – | ✅ |
| **B1** SpeechCapture | [`src/modules/speech`](src/modules/speech/index.ts) | Web Speech API kapseln, Auto-Restart, stabile segmentId | ✅ | ✅ (Mock) |
| **B2** TextNormalizer | [`src/modules/normalizer`](src/modules/normalizer/index.ts) | Segment → Token[] (rein) | – | ✅ |
| **B3** SignResolver | [`src/modules/resolver`](src/modules/resolver/index.ts) | Token → SignItem, Lemma-Kaskade (rein) | – | ✅ |
| **B4** FingerspellingEngine | [`src/modules/fingerspelling`](src/modules/fingerspelling/index.ts) | Wort → Fingeralphabet (rein) | – | ✅ |
| **B5** DisplayQueue | [`src/modules/queue`](src/modules/queue/index.ts) | Timing, Backpressure, Interim-Korrektur | – | ✅ (Fake-Timer) |
| **B6** SignRenderer | [`src/components`](src/components/) | UI: Anzeige, Verlauf, Steuerung | ✅ | – |
| **B7** SessionController | [`src/modules/session`](src/modules/session/index.ts) | Orchestrierung, State Machine | ✅ | – |
| **B8** SettingsStore | [`src/modules/settings`](src/modules/settings/index.tsx) | Settings + localStorage | ✅ | – |

### Datenfluss

```
Mikrofon ─▶ B1 ─(TranscriptSegment, segmentId)─▶ B2 ─(Token[])─▶ B3 ─(SignItem)─▶ B5 ─▶ B6
                                                              └─miss─▶ B4 (Fingeralphabet)
```

Die `segmentId` wird durch die ganze Pipeline geführt: Die Web Speech API
korrigiert Interim-Ergebnisse rückwirkend, deshalb kann B5 über die segmentId die
noch nicht angezeigten Items eines Satzes ersetzen (`replaceSegment`).

---

## Setup

```bash
npm install
npm run generate:assets   # erzeugt Platzhalter-Bilder unter public/
npm run dev               # Dev-Server (Chrome/Edge für Mikrofon empfohlen)
```

Weitere Skripte:

```bash
npm test          # alle Unit-Tests (Vitest)
npm run test:watch
npm run typecheck # tsc --noEmit
npm run build     # Produktions-Build
```

### Testen ohne Mikrofon

- **Texteingabe:** Das Eingabefeld unten füttert dieselbe Pipeline wie das
  Mikrofon — ideal zum Testen der Logik im Browser.
- **Demo-Modus:** `http://localhost:5173/?demo=1` spielt eine deutsche
  Beispiel-Q&A zeitgesteuert ein (inkl. Interim-Korrektur und Fingerspelling
  eines unbekannten Namens).

---

## Bilddaten

Die mitgelieferten SVGs unter `public/signs/` und `public/alphabet/` sind
**beschriftete Platzhalter**, keine echten DGS-Gebärden — damit die Test-UI
offline voll funktioniert. Neu erzeugen mit `npm run generate:assets`.

**Echte SignDict-Daten einbinden:** PNG/SVG/Video nach `public/signs` legen und in
[`public/dictionary.json`](public/dictionary.json) die `imageUrl` darauf zeigen
lassen. Die Logik (B0–B5) bleibt unverändert. Fingeralphabet-Konvention:
`/alphabet/<zeichen>.svg` (inkl. `ä`, `ö`, `ü`, `ß`, `sch`, `ch`, `0`–`9`).

---

## Bekannte Browser-Einschränkungen

- **Web Speech API:** Voll unterstützt in **Chrome/Edge**. **Firefox** hat keine
  Unterstützung, **Safari** nur eingeschränkt. Nicht unterstützte Browser zeigen
  automatisch das Texteingabe-Fallback.
- Chrome beendet die Erkennung nach ~60 s Stille → B1 startet automatisch neu.
- Mikrofonzugriff erfordert HTTPS (oder `localhost`).

---

## Implementierungsreihenfolge (umgesetzt)

| Phase | Bausteine | Status |
|-------|-----------|:---:|
| 1 | B0 + B2 + B3 + B4 — Kernlogik ohne Browser-APIs | ✅ |
| 2 | B5 — Timing/Queue (Fake-Timer-Tests) | ✅ |
| 3 | B1 — Spracherkennung (Chrome/Edge) | ✅ |
| 4 | B7 + B6 + B8 — verdrahtet, lauffähige App | ✅ |
| 5 | Roadmap: imageUrl → GIF/Video → Three.js-Avatar | ⏳ (nur B6/B0) |
