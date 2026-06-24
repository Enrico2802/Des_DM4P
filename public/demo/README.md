# Demo-Modus — ein DGS-Video als `.mov`

Diese Datei wird vom **Demo-Modus** abgespielt (Button „Demo abspielen" in der
Eingabezone). Der Demo-Modus läuft komplett offline — keine Spracherkennung, kein
Wörterbuch, keine API-Aufrufe. Glossen-Liste und Pfad sind in
[`src/app/services/demo.service.ts`](../../src/app/services/demo.service.ts)
festgelegt.

Hintergrund: Das Video wird auf **schwarzem** Hintergrund gezeigt. Lege die
`.mov`-Datei so an, dass der ausgekeyte Hintergrund schwarz ist (für die
Browser-Wiedergabe am besten H.264/AAC im `.mov`-Container).

## Erwartete Datei

Es gibt nur **eine** Datei, die die komplette gebärdete Phrase am Stück enthält:

| Datei      | Inhalt                                                                 |
|------------|------------------------------------------------------------------------|
| `demo.mov` | Die ganze Sequenz (~17 s), Glossen-Notation siehe unten                |

Glossen-Notation:
`Wie ich gedacht habe die Frage zeigt alle haben nicht verstanden | ich frage mich ob ihr zuhört`

Das `|` markiert nur die Phrasengrenze und ist kein eigenes Zeichen.

## Glossen unter dem Video

Die Labels darunter (`Wie`, `ich`, `gedacht`, … `zuhört`) werden **nicht** als
einzelne Clips abgespielt, sondern gleichmäßig über die **Videolänge** verteilt:
der Player liest die Wiedergabeposition (`currentTime / duration`) und hebt die
passende Glosse hervor. Bei 17 Glossen und ~17 s ist das grob eine pro Sekunde,
passt sich aber automatisch an die tatsächliche Länge der `demo.mov` an.

Die Glossen-Reihenfolge wird über das Array `glosses` in
[`src/app/services/demo.service.ts`](../../src/app/services/demo.service.ts)
gepflegt.
