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
- **Das Pergament ist app-eigen**, die Leuchtfarben kommen aus `tokens.css`.
  Auf Pergament gehört Tinte: `.seite .knopf` färbt die Knöpfe darin um.
