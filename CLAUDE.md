# To Bo

Eine Offline-App des B-Appiverse. **Lies vor jeder Codeänderung den Skill
`bappiverse:konventionen`.**

To Bo hält Vorsätze, Gewohnheiten, Ziele, To-dos und Verantwortungsbereiche
fest und zahlt für jedes Abgehakte Zaubermünzen aus, die sich gegen selbst
angelegte Belohnungen tauschen lassen. Sie erinnert an nichts, schickt keine
Benachrichtigungen und wertet nichts aus — sie zählt nur, was getan ist.

## Eigenheiten, die beim Ändern wichtig sind

- **Die Münzen sind die eine Wahrheit der App.** Abhaken zahlt aus, Häkchen
  wegnehmen zieht ab. Alles geht über `muenzen(n)`; wer woanders an
  `DATA.muenzen` schreibt, bricht die Kopfzeile und die Abrechnung. Ändert
  sich der Lohn eines bereits abgehakten Punktes, wird die Differenz
  nachgezahlt. Unter null geht der Beutel nie.
- **Zwei Arten von Gewohnheit, wirklich verschieden.** `takt` hängt an festen
  Wochentagen und schreibt Datumsschlüssel ins `log`; `anzahl` zählt nur, wie
  oft im Zeitraum, und schreibt `w…#…` bzw. `m…#…`. Deshalb der eigene
  Schlüssel je Mal — sonst ließe sich nicht zweimal am selben Tag zählen.
- **Gelöscht wird zweistufig.** `punktZeile` markiert nur `geloescht`,
  `aufraeumen` räumt die Liste. Sonst verschöbe sich beim Löschen mitten im
  Aufbau die Liste unter den Händen.
- **Die Mindmap ist ein fester Ring**, kein frei geschobener Graph: auf einem
  Handy trifft man geschobene Knoten nicht zuverlässig. Der Jahresknoten
  braucht `left:50%;top:50%` — ohne das klebt er in der Ecke.
- **Belohnungsbilder bleiben PNG.** Als JPEG umgewandelt bekäme ein
  freigestelltes Bild einen schwarzen Grund.
- **Zwei Modi, ein Farbvorrat.** Standard ist Pergament, der dunkle Modus
  tauscht denselben Satz Tokens (`--grund`, `--blatt`, `--tinte`, `--siegel`,
  …) über `[data-modus="dunkel"]` aus. Wer eine Farbe fest verdrahtet statt
  ein Token zu nehmen, bricht einen der beiden Modi — und zwar den, den man
  gerade nicht ansieht.
- **Die Münze ist eine einzige Gravur.** Sie steht als `<defs><g id="muenzform">`
  im `index.html`; Kopfzeile, Preis und Leiste verweisen nur darauf. Eine
  zweite Zeichnung anzulegen hieße, dass die Münze an drei Stellen
  auseinanderläuft.
- **Gebrochene Schrift verträgt keine Versalien.** Überschriften stehen
  deshalb gemischt („Jahresvorsätze"), nicht in Großbuchstaben. Versalien
  bleiben den Mono-Marken vorbehalten.
- **Der Habit-Verlauf liest die Log-Schlüssel rückwärts**: `2026-09-21` beim
  Takt, `w2026-09-21#ab` oder `m2026-09#ab` bei der Anzahl. `habitBeginn`
  normalisiert das; wer das Schlüsselformat ändert, muss dort nachziehen.
- **Das Pentagramm liegt im Ring, nicht in der Mitte** — unter dem
  Jahresknoten wäre es schlicht nicht zu sehen.
