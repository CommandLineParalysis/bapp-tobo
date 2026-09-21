/* Funktionstest für To Bo. Läuft auf dem Testgerüst des Scaffolds.

   jsdom kennt keine echten Maße — das Aussehen des Grimoires wird
   zusätzlich in Chromium geprüft, siehe bappiverse:bapp-check. */

const { buildSingleFile } = require('@bappiverse/scaffold/scripts/bundle');
const { starteApp, pruefliste } = require('@bappiverse/scaffold/test/harness');

(async () => {
  const p = pruefliste('To Bo');
  const { $, $$, click, doc, wait, setPrompts, errors, bruecke } = starteApp(buildSingleFile());

  await wait(60);
  const T = bruecke(['DATA','state','adoptVault','mergeVault','alsSchluessel','wochenstart',
                     'tageDerWoche','zeitraumSchluessel','standImZeitraum','muenzen']);

  const tab = name => $$('#nav .tab').find(t => t.dataset.screen === name);
  const muenzstand = () => Number($('#muenzzahl').textContent);

  /* --- Rahmen --- */

  await p.check('App startet ohne Fehler', () => { if (errors.length) throw new Error(errors[0]); });

  await p.check('Sechs Bereiche in der Fußzeile', () => {
    const namen = $$('#nav .tab').map(t => t.dataset.screen);
    const soll = ['vorsaetze','habits','ziele','todo','pflichten','belohnungen'];
    if (namen.join(',') !== soll.join(',')) throw new Error(namen.join(','));
    return namen.length + ' Bereiche';
  });

  await p.check('Der Münzstand steht oben rechts', () => {
    const beutel = $('header .headright #beutel');
    if (!beutel) throw new Error('Kein Beutel in der Kopfzeile');
    if (muenzstand() !== 0) throw new Error('Startstand: ' + muenzstand());
    return '0 Münzen';
  });

  /* --- Jahresvorsätze --- */

  await p.check('Lebensbereich anlegen zeichnet einen Knoten', async () => {
    click(tab('vorsaetze'));
    setPrompts(['Gesundheit']);
    click($('#neuerbereich'));
    await wait(30);
    if (T.DATA.vorsaetze.bereiche.length !== 1) throw new Error('nicht angelegt');
    const knoten = $$('.knoten:not(.mitte)');
    if (knoten.length !== 1) throw new Error('Knoten: ' + knoten.length);
    if (!$('.knoten.mitte')) throw new Error('Kein Jahr in der Mitte');
    return 'Gesundheit am Ring';
  });

  await p.check('Mehrere Bereiche verteilen sich im Kreis', async () => {
    for (const name of ['Arbeit','Menschen']){
      setPrompts([name]); click($('#neuerbereich')); await wait(20);
    }
    const knoten = $$('.knoten:not(.mitte)');
    if (knoten.length !== 3) throw new Error('Knoten: ' + knoten.length);
    const orte = knoten.map(k => k.getAttribute('style'));
    if (new Set(orte).size !== 3) throw new Error('Knoten liegen übereinander');
    if ($$('#kreisfeld svg line').length !== 3) throw new Error('Linien fehlen');
    return '3 Knoten, 3 Linien';
  });

  await p.check('Ein Klick auf den Knoten öffnet die Liste', async () => {
    click($$('.knoten:not(.mitte)')[0]);
    await wait(20);
    if ($('#modal').hidden) throw new Error('Fenster blieb zu');
    if (!/GESUNDHEIT|Gesundheit/.test($('#modalblatt').textContent)) throw new Error('falscher Bereich');
    return 'Fenster offen';
  });

  await p.check('Vorsatz eintragen und abhaken bringt eine Münze', async () => {
    setPrompts(['Dreimal die Woche laufen']);
    click($$('#modalblatt .knopf').find(b => b.textContent === '+ VORSATZ'));
    await wait(30);
    const vorher = muenzstand();
    click($('#modalblatt .haken'));
    await wait(30);
    if (muenzstand() !== vorher + 1) throw new Error('Münzen: ' + muenzstand());
    if (!T.DATA.vorsaetze.bereiche[0].punkte[0].erledigt) throw new Error('nicht abgehakt');
    return vorher + ' → ' + muenzstand();
  });

  await p.check('Häkchen wegnehmen nimmt die Münze wieder', async () => {
    const vorher = muenzstand();
    click($('#modalblatt .haken'));
    await wait(30);
    if (muenzstand() !== vorher - 1) throw new Error('Münzen: ' + muenzstand());
    return vorher + ' → ' + muenzstand();
  });

  await p.check('Derselbe Punkt zahlt nicht zweimal', async () => {
    const start = muenzstand();
    for (let i = 0; i < 6; i++){ click($('#modalblatt .haken')); await wait(15); }
    // gerade Anzahl -> wieder offen, also derselbe Stand
    if (muenzstand() !== start) throw new Error('Münzen: ' + start + ' → ' + muenzstand());
    click($('#modalblatt .haken')); await wait(20);
    if (muenzstand() !== start + 1) throw new Error('einmal abhaken bringt nicht 1');
    return 'sauber verrechnet';
  });

  await p.check('Der Lohn je Punkt lässt sich ändern', async () => {
    const vorher = muenzstand();
    setPrompts(['5']);
    click($('#modalblatt .lohn'));
    await wait(30);
    // Der Punkt war abgehakt: die Differenz wird nachgezahlt.
    if (muenzstand() !== vorher + 4) throw new Error('Münzen: ' + muenzstand());
    if (T.DATA.vorsaetze.bereiche[0].punkte[0].lohn !== 5) throw new Error('Lohn nicht gesetzt');
    click($('#modalblatt .haken')); await wait(20);
    if (muenzstand() !== vorher - 1) throw new Error('Rücknahme zahlt den falschen Betrag');
    click($('#modalblatt .schliessen'));
    await wait(20);
    return 'aus 1 wird 5, Rücknahme stimmt';
  });

  /* --- Habits --- */

  await p.check('Gewohnheit mit festen Tagen anlegen', async () => {
    click(tab('habits'));
    setPrompts(['Laufen']);
    click($('#neuerhabit'));
    await wait(40);
    if (T.DATA.habits.length !== 1) throw new Error('nicht angelegt');
    if ($('#modal').hidden) throw new Error('Einstellfenster kam nicht');
    if (T.DATA.habits[0].art !== 'takt') throw new Error('Art: ' + T.DATA.habits[0].art);
    click($('#modalblatt .schliessen'));
    await wait(20);
    return 'Takt als Voreinstellung';
  });

  await p.check('Nur vorgesehene Tage lassen sich abhaken', async () => {
    const hb = T.DATA.habits[0];
    const felder = $$('main .takt .tagfeld');
    if (felder.length !== 7) throw new Error('Felder: ' + felder.length);
    const ruhend = felder.filter(f => f.classList.contains('ruht'));
    if (ruhend.length !== 7 - hb.tage.length) throw new Error('Ruhende: ' + ruhend.length);
    if (!ruhend.every(f => f.hasAttribute('disabled'))) throw new Error('Ruhender Tag ist anklickbar');
    return hb.tage.length + ' von 7 vorgesehen';
  });

  await p.check('Ein Takt-Tag bringt eine Münze', async () => {
    const vorher = muenzstand();
    const frei = $$('main .takt .tagfeld').find(f => !f.classList.contains('ruht'));
    click(frei);
    await wait(30);
    if (muenzstand() !== vorher + 1) throw new Error('Münzen: ' + muenzstand());
    const wieder = $$('main .takt .tagfeld').find(f => f.classList.contains('an'));
    if (!wieder) throw new Error('Tag nicht markiert');
    click(wieder);
    await wait(30);
    if (muenzstand() !== vorher) throw new Error('Rücknahme stimmt nicht');
    return 'hin und zurück';
  });

  await p.check('Gewohnheit auf "so oft" umstellen', async () => {
    click($$('.seite .knopf').find(b => b.textContent === 'BEARBEITEN'));
    await wait(30);
    click($$('#modalblatt .knopf').find(b => b.textContent === 'SO OFT'));
    await wait(30);
    if (T.DATA.habits[0].art !== 'anzahl') throw new Error('Art: ' + T.DATA.habits[0].art);
    const anzahl = $('#habitanzahl');
    anzahl.value = '3'; anzahl.onchange();
    await wait(30);
    if (T.DATA.habits[0].anzahl !== 3) throw new Error('Anzahl: ' + T.DATA.habits[0].anzahl);
    click($('#modalblatt .schliessen'));
    await wait(20);
    return '3× pro Monat';
  });

  await p.check('Der Zähler zählt im Zeitraum hoch und runter', async () => {
    const hb = T.DATA.habits[0];
    const vorher = muenzstand();
    click($('#plus_' + hb.id)); await wait(25);
    click($('#plus_' + hb.id)); await wait(25);
    if (T.standImZeitraum(hb) !== 2) throw new Error('Stand: ' + T.standImZeitraum(hb));
    if (muenzstand() !== vorher + 2) throw new Error('Münzen: ' + muenzstand());
    click($('#minus_' + hb.id)); await wait(25);
    if (T.standImZeitraum(hb) !== 1) throw new Error('Stand nach minus: ' + T.standImZeitraum(hb));
    if (muenzstand() !== vorher + 1) throw new Error('Münzen nach minus: ' + muenzstand());
    return '2 hoch, 1 runter';
  });

  await p.check('Unter null geht der Zähler nicht', async () => {
    const hb = T.DATA.habits[0];
    click($('#minus_' + hb.id)); await wait(25);
    if (T.standImZeitraum(hb) !== 0) throw new Error('Stand: ' + T.standImZeitraum(hb));
    if (!$('#minus_' + hb.id).hasAttribute('disabled')) throw new Error('Minus ist noch anklickbar');
    return 'bei 0 gesperrt';
  });

  await p.check('Der Zeitraum trennt Woche und Monat', () => {
    const hb = T.DATA.habits[0];
    hb.zeitraum = 'woche';
    const wocheKey = T.zeitraumSchluessel(hb);
    hb.zeitraum = 'monat';
    const monatKey = T.zeitraumSchluessel(hb);
    if (wocheKey === monatKey) throw new Error('gleicher Schlüssel: ' + wocheKey);
    if (!wocheKey.startsWith('w') || !monatKey.startsWith('m')) throw new Error(wocheKey + ' / ' + monatKey);
    return wocheKey + ' ≠ ' + monatKey;
  });

  /* --- Ziele --- */

  await p.check('Ziel anlegen und Teilziele abhaken', async () => {
    click(tab('ziele'));
    setPrompts(['Buch schreiben']);
    click($('#neuesziel'));
    await wait(30);
    if ($$('.kachel').length !== 1) throw new Error('Kacheln: ' + $$('.kachel').length);
    click($('.kachel'));
    await wait(20);
    setPrompts(['Gliederung']);
    click($$('#modalblatt .knopf').find(b => b.textContent === '+ TEILZIEL'));
    await wait(30);
    const vorher = muenzstand();
    click($('#modalblatt .haken'));
    await wait(30);
    if (muenzstand() !== vorher + 1) throw new Error('Münzen: ' + muenzstand());
    return '1 Teilziel, abgehakt';
  });

  await p.check('Das Ziel hat oben ein Textfeld', () => {
    const feld = $('#zieltext');
    if (!feld) throw new Error('Kein Textfeld');
    const bloecke = [...$('#modalblatt').children];
    const textIndex = bloecke.findIndex(b => b.contains(feld));
    const hakenIndex = bloecke.findIndex(b => b.querySelector('.haken'));
    if (textIndex < 0 || hakenIndex < 0) throw new Error('Aufbau unerwartet');
    if (textIndex > hakenIndex) throw new Error('Text steht unter der Liste');
    return 'Text über den Schritten';
  });

  await p.check('Der Zieltext wird gespeichert', async () => {
    const feld = $('#zieltext');
    feld.value = 'Bis Ostern fertig.'; feld.oninput();
    await feld.onchange();
    await wait(30);
    const gespeichert = await T.DATA.ziele[0].text;
    if (gespeichert !== 'Bis Ostern fertig.') throw new Error('Text: ' + gespeichert);
    click($('#modalblatt .schliessen'));
    await wait(20);
    return 'gemerkt';
  });

  await p.check('Die Kachel zeigt den Fortschritt', () => {
    const kachel = $('.kachel');
    if (!/1 \/ 1 SCHRITTE/.test(kachel.textContent)) throw new Error(kachel.textContent.slice(0,60));
    const balken = kachel.querySelector('.balken i');
    if (!balken || balken.getAttribute('style') !== 'width:100%') throw new Error('Balken: ' + (balken && balken.getAttribute('style')));
    return 'voll';
  });

  /* --- To Do --- */

  await p.check('Die Woche zeigt sieben Tage von oben nach unten', () => {
    click(tab('todo'));
    const blaetter = $$('.seite');
    if (blaetter.length !== 7) throw new Error('Blätter: ' + blaetter.length);
    const tage = $$('.tagkopf .wt').map(e => e.textContent);
    if (tage[0] !== 'MONTAG' || tage[6] !== 'SONNTAG') throw new Error(tage.join(','));
    return tage.join(' ');
  });

  await p.check('Der heutige Tag ist hervorgehoben', () => {
    const heute = $$('.seite.heute');
    if (heute.length !== 1) throw new Error('hervorgehoben: ' + heute.length);
    return 'genau einer';
  });

  await p.check('To-do eintragen und abhaken', async () => {
    setPrompts(['Brot kaufen']);
    click($$('[data-tag]')[0]);
    await wait(30);
    const schluessel = T.alsSchluessel(T.tageDerWoche(0)[0]);
    if (T.DATA.todo.tage[schluessel].length !== 1) throw new Error('nicht eingetragen');
    const vorher = muenzstand();
    click($('.seite .haken'));
    await wait(30);
    if (muenzstand() !== vorher + 1) throw new Error('Münzen: ' + muenzstand());
    return 'Montag, 1 Eintrag';
  });

  await p.check('Blättern wechselt die Woche und behält den Eintrag', async () => {
    const spanne = $('#wochenspanne').textContent;
    click($('#wochevor'));
    await wait(25);
    if ($('#wochenspanne').textContent === spanne) throw new Error('Spanne unverändert');
    if ($$('.seite .haken').length) throw new Error('Einträge der Vorwoche stehen noch da');
    click($('#wochezurueck'));
    await wait(25);
    if ($('#wochenspanne').textContent !== spanne) throw new Error('nicht zurückgekehrt');
    if (!$('.seite .haken')) throw new Error('Eintrag verloren');
    return spanne;
  });

  await p.check('Der Monatsknopf öffnet die Monatsliste', async () => {
    click($('#monatsknopf'));
    await wait(25);
    if ($('#modal').hidden) throw new Error('Fenster blieb zu');
    setPrompts(['Steuer erledigen']);
    click($$('#modalblatt .knopf').find(b => b.textContent === '+ EINTRAG'));
    await wait(30);
    const monate = Object.values(T.DATA.todo.monate);
    if (!monate.length || monate[0].length !== 1) throw new Error('nicht eingetragen');
    click($('#modalblatt .schliessen'));
    await wait(20);
    return '1 Monatseintrag';
  });

  /* --- Verantwortung --- */

  await p.check('Bereich anlegen und Notiz schreiben', async () => {
    click(tab('pflichten'));
    setPrompts(['Wohnung']);
    click($('#neuepflicht'));
    await wait(30);
    click($('.kachel'));
    await wait(25);
    const feld = $('#pflichtnotiz');
    if (!feld) throw new Error('Kein Notizfeld');
    feld.value = 'Heizung jährlich warten lassen.'; feld.oninput();
    await feld.onchange();
    await wait(30);
    if (T.DATA.pflichten[0].notiz !== 'Heizung jährlich warten lassen.')
      throw new Error('Notiz: ' + T.DATA.pflichten[0].notiz);
    click($('#modalblatt .schliessen'));
    await wait(20);
    if (!/Heizung/.test($('.kachel').textContent)) throw new Error('Kachel zeigt die Notiz nicht');
    return 'Notiz gemerkt und sichtbar';
  });

  /* --- Belohnungen --- */

  await p.check('Belohnung anlegen', async () => {
    click(tab('belohnungen'));
    setPrompts(['Kinoabend']);
    click($('#neuebelohnung'));
    await wait(40);
    if (T.DATA.belohnungen.length !== 1) throw new Error('nicht angelegt');
    const preis = $('#lohnpreis');
    preis.value = '4'; await preis.onchange();
    await wait(30);
    if (T.DATA.belohnungen[0].preis !== 4) throw new Error('Preis: ' + T.DATA.belohnungen[0].preis);
    return '4 Münzen';
  });

  await p.check('Zu teuer lässt sich nicht einlösen', async () => {
    T.DATA.belohnungen[0].preis = 9999;
    T.state.offen = { art:'belohnung', id:T.DATA.belohnungen[0].id };
    click($('#modalblatt .schliessen'));
    await wait(20);
    click($('.kachel'));
    await wait(25);
    const btn = $('#einloesen');
    if (!btn.hasAttribute('disabled')) throw new Error('Knopf ist anklickbar');
    if (!/NOCH \d+ MÜNZEN/.test(btn.textContent)) throw new Error(btn.textContent);
    return btn.textContent;
  });

  await p.check('Einlösen zieht die Münzen ab', async () => {
    const stand = muenzstand();
    const preis = Math.max(1, stand - 1);
    T.DATA.belohnungen[0].preis = preis;
    click($('#modalblatt .schliessen'));
    await wait(20);
    click($('.kachel'));
    await wait(25);
    click($('#einloesen'));
    await wait(40);
    if (muenzstand() !== stand - preis) throw new Error('Münzen: ' + muenzstand());
    return stand + ' − ' + preis + ' = ' + muenzstand();
  });

  await p.check('Der Beutel wird nie negativ', async () => {
    T.muenzen(-99999);
    await wait(20);
    if (T.DATA.muenzen !== 0) throw new Error('Stand: ' + T.DATA.muenzen);
    return '0 ist die Grenze';
  });

  /* --- Bestand --- */

  await p.check('Alles überlebt das Laden', () => {
    const roh = JSON.parse(JSON.stringify({
      muenzen: 7,
      vorsaetze: { jahr: 2031, bereiche: [{ id:'b1', name:'Test', punkte:[{ id:'p1', text:'x', erledigt:true, lohn:3 }] }] },
      habits: [{ id:'h1', name:'H', art:'anzahl', anzahl:4, zeitraum:'woche', log:{} }],
      ziele: [{ id:'z1', name:'Z', text:'t', schritte:[] }],
      todo: { tage: { '2026-01-01': [{ id:'t1', text:'y' }] }, monate: {} },
      pflichten: [{ id:'f1', name:'P', notiz:'n' }],
      belohnungen: [{ id:'l1', name:'B', preis:12, bild:null }],
      theme: 'pink',
    }));
    const v = T.adoptVault(roh);
    if (v.muenzen !== 7) throw new Error('Münzen: ' + v.muenzen);
    if (v.vorsaetze.jahr !== 2031) throw new Error('Jahr: ' + v.vorsaetze.jahr);
    if (v.vorsaetze.bereiche[0].punkte[0].lohn !== 3) throw new Error('Lohn verloren');
    if (v.habits[0].zeitraum !== 'woche') throw new Error('Zeitraum verloren');
    if (v.todo.tage['2026-01-01'][0].lohn !== 1) throw new Error('Standardlohn fehlt');
    if (v.theme !== 'pink') throw new Error('Theme: ' + v.theme);
    return 'alle sechs Bereiche';
  });

  await p.check('Unsinn im Bestand wird auf gültige Werte gebracht', () => {
    const v = T.adoptVault({ muenzen:'viel', theme:'gold',
      habits:[{ id:'h', name:'x', art:'quatsch', anzahl:-3, tage:[9,1] }] });
    if (v.muenzen !== 0) throw new Error('Münzen: ' + v.muenzen);
    if (v.theme !== 'teal') throw new Error('Theme: ' + v.theme);
    if (v.habits[0].art !== 'takt') throw new Error('Art: ' + v.habits[0].art);
    if (v.habits[0].anzahl !== 2) throw new Error('Anzahl: ' + v.habits[0].anzahl);
    if (v.habits[0].tage.join() !== '1') throw new Error('Tage: ' + v.habits[0].tage.join());
    return 'abgefangen';
  });

  await p.check('Wiederherstellen führt zusammen statt zu ersetzen', () => {
    const vorherZiele = T.DATA.ziele.length;
    const bericht = T.mergeVault({
      ziele: [{ id:'fremd1', name:'Aus dem Backup', text:'', schritte:[] },
              { id:T.DATA.ziele[0].id, name:'Schon da', text:'', schritte:[] }],
      pflichten: [{ id:'fremd2', name:'Keller', notiz:'' }],
      todo: { tage: { '2026-03-03': [{ id:'fremdp', text:'z' }] }, monate:{} },
    });
    if (bericht.ziele !== 1) throw new Error('Ziele ergänzt: ' + bericht.ziele);
    if (bericht.pflichten !== 1) throw new Error('Pflichten ergänzt: ' + bericht.pflichten);
    if (bericht.punkte !== 1) throw new Error('To-dos ergänzt: ' + bericht.punkte);
    if (T.DATA.ziele.length !== vorherZiele + 1) throw new Error('Bestand: ' + T.DATA.ziele.length);
    return '3 ergänzt, 1 erkannt';
  });

  await p.check('Zweites Zusammenführen ändert nichts mehr', () => {
    const vorher = T.DATA.ziele.length + T.DATA.pflichten.length;
    T.mergeVault({
      ziele: [{ id:'fremd1', name:'Aus dem Backup', text:'', schritte:[] }],
      pflichten: [{ id:'fremd2', name:'Keller', notiz:'' }],
    });
    if (T.DATA.ziele.length + T.DATA.pflichten.length !== vorher) throw new Error('doppelt angelegt');
    return 'unverändert';
  });

  await p.check('Die Münzen bleiben beim Zusammenführen unberührt', () => {
    T.DATA.muenzen = 5;
    T.mergeVault({ muenzen: 9999, ziele: [] });
    if (T.DATA.muenzen !== 5) throw new Error('Münzen: ' + T.DATA.muenzen);
    return 'was ausgegeben ist, bleibt ausgegeben';
  });

  await p.check('Farbe umschalten wirkt und bleibt', async () => {
    click($('#settingsbtn'));
    await wait(25);
    click($$('#swatches .swatch').find(s => s.dataset.theme === 'orange'));
    await wait(30);
    if (doc.documentElement.dataset.theme !== 'orange') throw new Error('Thema nicht gesetzt');
    if (T.DATA.theme !== 'orange') throw new Error('nicht im Bestand');
    return 'orange';
  });

  process.exit(p.bericht(errors) ? 1 : 0);
})();
