# SignBridge — Sprache wird Gebärde

Browser-App, die gesprochene Sprache in Echtzeit in **DGS-Gebärdenbilder**
übersetzt. Umsetzung nach dem Logikbaustein-Konzept (Wilks / Müller / Brodtmann).

Dieses Repository enthält die **vollständige App**:

- den **Logikteil B0–B5 / B1** (`src/engine`) — reines, isoliert unit-getestetes
  TypeScript **ohne Framework**. Das ist der eigentliche Kern und die Priorität
  des Projekts.
- das **Angular-Frontend** (`src/app`) — die echte Benutzeroberfläche (Topbar,
  Eingabe, animierter Gebärden-Renderer mit anime.js, Themes, Sounds), die die
  Engine über schlanke Angular-Services nutzt.

> Früher gab es ein React-Mock-UI und ein separates Angular-Mock-Frontend. Beide
> Mocks sind abgelöst: Das Angular-Frontend ist hier ins Repo gezogen und nutzt
> jetzt die **echte** Engine (echtes deutsches Mikrofon, echte DGS-Auflösung mit
> echten Gebärden-SVGs, B5-Timing) statt seiner früheren Platzhalter-Services.

---

## Architektur — Bausteine B0–B8

**Grundprinzip:** Jeder Baustein hat eine definierte Ein-/Ausgabe und kennt die
anderen nicht. Gekoppelt wird nur über die Typen in
[`src/engine/types.ts`](src/engine/types.ts); verdrahtet wird ausschließlich vom
SessionController (B7). Dadurch ist jeder Baustein isoliert testbar und
austauschbar (PNG → GIF → 3D-Avatar betrifft nur B6/B0).

| Baustein | Ort | Aufgabe | Getestet |
|----------|-----|---------|:---:|
| **B0** DictionaryLoader | [`src/engine/dictionary`](src/engine/dictionary/index.ts) | JSON laden, validieren, O(1)-Index, IndexedDB-Cache | ✅ |
| **B1** SpeechCapture | [`src/engine/speech`](src/engine/speech/index.ts) | Web Speech API kapseln, Auto-Restart, stabile segmentId | ✅ (Mock) |
| **B2** TextNormalizer | [`src/engine/normalizer`](src/engine/normalizer/index.ts) | Segment → Token[] (rein) | ✅ |
| **B3** SignResolver | [`src/engine/resolver`](src/engine/resolver/index.ts) | Token → SignItem, Lemma-Kaskade (rein) | ✅ |
| **B4** FingerspellingEngine | [`src/engine/fingerspelling`](src/engine/fingerspelling/index.ts) | Wort → Fingeralphabet (rein) | ✅ |
| **B5** DisplayQueue | [`src/engine/queue`](src/engine/queue/index.ts) | Timing, Backpressure, Interim-Korrektur | ✅ |
| **B6** SignRenderer | [`src/app/components/output-zone`](src/app/components/output-zone/) | Angular-UI: Anzeige, Layouts, anime.js | – |
| **B7** SessionController | [`src/app/services/session.service.ts`](src/app/services/session.service.ts) | Orchestrierung B1→B2/B3/B4→B5 (Angular-Signals) | – |
| **B8** Settings/Theme | [`src/app/services`](src/app/services/) | Theme + Sounds (`theme.service`, `sound.service`) | – |

### Datenfluss

```
Mikrofon ─▶ B1 ─(TranscriptSegment, segmentId)─▶ B2 ─(Token[])─▶ B3 ─(SignItem)─▶ B5 ─▶ B6
                                                              └─miss─▶ B4 (Fingeralphabet)
Text/Upload ──────────────────────────────────▶ B2 ─▶ B3/B4 ─(SignItem[])────────────▶ B6 (Batch)
```

Die `segmentId` wird durch die ganze Pipeline geführt: Die Web Speech API
korrigiert Interim-Ergebnisse rückwirkend, deshalb ersetzt B5 über die segmentId
die noch nicht angezeigten Items eines Satzes (`replaceSegment`).

**Angular-Anbindung:**
[`SignPipelineService`](src/app/services/sign-pipeline.service.ts) kapselt
B0+B2+B3+B4 (`toSigns(text)`), [`RecognitionService`](src/app/services/recognition.service.ts)
kapselt B1, [`SessionService`](src/app/services/session.service.ts) verdrahtet
alles und stellt der UI Signals bereit.

---

## Setup

```bash
npm install        # bei Zertifikats-/Peer-Problemen: npm run install:legacy
npm start          # Dev-Server → http://localhost:4200 (Chrome/Edge fürs Mikrofon)
```

Weitere Skripte:

```bash
npm test           # Engine-Unit-Tests (Vitest, B0–B5/B1)
npm run test:watch
npm run typecheck  # tsc --noEmit (App + Engine)
npm run build      # Produktions-Build → dist/signbridge
npm run generate:assets   # Platzhalter-SVGs unter public/ neu erzeugen
```

### Testen ohne Mikrofon

- **Texteingabe:** Das Eingabefeld unter dem Mikrofon füttert dieselbe Pipeline —
  ideal zum Testen der Logik im Browser (z. B. „hallo danke", oder ein Name fürs
  Fingeralphabet).
- **Datei-Upload:** Eine `.txt`-Datei wird als Eingabe gelesen.

---

## Bilddaten

Die mitgelieferten SVGs unter `public/signs/` und `public/alphabet/` sind
**beschriftete Platzhalter**, keine echten DGS-Gebärden — damit die UI offline
voll funktioniert. Über die Angular-Asset-Pipeline (`angular.json`) werden sie
unter den absoluten Pfaden `/signs/…`, `/alphabet/…` und `/dictionary.json`
ausgeliefert, die die Engine erwartet.

**Echte SignDict-Daten einbinden:** PNG/SVG/Video nach `public/signs` legen und in
[`public/dictionary.json`](public/dictionary.json) die `imageUrl` darauf zeigen
lassen. Die Logik (B0–B5) bleibt unverändert.

---

## Bekannte Browser-Einschränkungen

- **Web Speech API:** Voll unterstützt in **Chrome/Edge**. **Firefox** hat keine
  Unterstützung, **Safari** nur eingeschränkt. Nicht unterstützte Browser zeigen
  automatisch den Texteingabe-Hinweis.
- Chrome beendet die Erkennung nach ~60 s Stille → B1 startet automatisch neu.
- Mikrofonzugriff erfordert HTTPS (oder `localhost`).
