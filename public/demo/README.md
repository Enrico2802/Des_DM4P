# Demo-Modus — DGS-Zeichen als `.mov`

Diese Dateien werden vom **Demo-Modus** abgespielt (Button „Demo abspielen" in der
Eingabezone). Der Demo-Modus läuft komplett offline — keine Spracherkennung, kein
Wörterbuch, keine API-Aufrufe. Die Reihenfolge ist in
[`src/app/services/demo.service.ts`](../../src/app/services/demo.service.ts)
festgelegt.

Hintergrund: Die Clips werden auf **schwarzem** Hintergrund gezeigt. Lege die
`.mov`-Dateien so an, dass der ausgekeyte Hintergrund schwarz ist (für die
Browser-Wiedergabe am besten H.264/AAC im `.mov`-Container).

## Erwartete Dateien

Glossen-Notation:
`Wie ich gedacht habe die Frage zeigt alle haben nicht verstanden | ich frage mich ob ihr zuhört`

| # | Zeichen      | Datei              |
|---|--------------|--------------------|
| 1 | Wie          | `wie.mov`          |
| 2 | ich          | `ich.mov`          |
| 3 | gedacht      | `gedacht.mov`      |
| 4 | habe         | `habe.mov`         |
| 5 | die          | `die.mov`          |
| 6 | Frage        | `frage.mov`        |
| 7 | zeigt        | `zeigt.mov`        |
| 8 | alle         | `alle.mov`         |
| 9 | haben        | `haben.mov`        |
| 10| nicht        | `nicht.mov`        |
| 11| verstanden   | `verstanden.mov`   |
| 12| ich          | `ich.mov` *(s. 2)* |
| 13| frage        | `frage.mov` *(s. 6)* |
| 14| mich         | `mich.mov`         |
| 15| ob           | `ob.mov`           |
| 16| ihr          | `ihr.mov`          |
| 17| zuhört       | `zuhoert.mov`      |

`ich.mov` und `frage.mov` werden jeweils zweimal verwendet — es genügt eine Datei.

Fehlt eine Datei, zeigt der Player für ihr Zeitfenster einfach Schwarz — die
Sequenz bleibt nicht hängen.

## Geschwindigkeit

Die gesamte Zeichenfolge läuft zeitgesteuert in ~10 Sekunden ab (jedes Zeichen
bekommt ein festes Fenster, das Video loopt darin). Anpassen über
`totalDurationMs` in
[`src/app/services/demo.service.ts`](../../src/app/services/demo.service.ts).
