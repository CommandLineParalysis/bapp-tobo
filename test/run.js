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
                     'tageDerWoche','zeitraumSchluessel','standImZeitraum','muenzen',
                     'habitVerlauf','habitBeginn','monatsSchluessel','zielStandPflegen',
                     'abgelaufenesRaeumen','HALTEFRIST_TAGE','buchZuschnitt','render',
                     'vorsatzJahr','verschieben','skillAufgaben','brettBreite']);

  const tab = name => $$('#nav .tab').find(t => t.dataset.screen === name);
  const muenzstand = () => Number($('#muenzzahl').textContent);

  /* --- Rahmen --- */

  await p.check('App startet ohne Fehler', () => { if (errors.length) throw new Error(errors[0]); });

  await p.check('Fünf Bereiche in der Fußzeile', () => {
    const namen = $$('#nav .tab').map(t => t.dataset.screen);
    const soll = ['vorsaetze','habits','ziele','skills','todo'];
    if (namen.join(',') !== soll.join(',')) throw new Error(namen.join(','));
    return namen.join(' · ');
  });

  await p.check('Der Belohnungsladen hängt am Münzbeutel', async () => {
    click(tab('todo'));
    await wait(20);
    click($('#beutel'));
    await wait(25);
    if (T.state.screen !== 'belohnungen') throw new Error('Bildschirm: ' + T.state.screen);
    if (!$('#zurueck')) throw new Error('Kein Rückweg');
    click($('#zurueck'));
    await wait(20);
    if (T.state.screen !== 'todo') throw new Error('nicht zurück: ' + T.state.screen);
    return 'Beutel → Belohnungen → zurück';
  });

  await p.check('Verantwortung hängt am Knopf über den Habits', async () => {
    click(tab('habits'));
    await wait(20);
    const knopf = $('#pflichtknopf');
    if (!knopf) throw new Error('Kein Knopf auf der Habit-Seite');
    click(knopf);
    await wait(25);
    if (T.state.screen !== 'pflichten') throw new Error('Bildschirm: ' + T.state.screen);
    click($('#zurueck'));
    await wait(20);
    if (T.state.screen !== 'habits') throw new Error('nicht zurück: ' + T.state.screen);
    return 'Habits → Verantwortung → zurück';
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
    if (T.vorsatzJahr().length !== 1) throw new Error('nicht angelegt');
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
    if ($$('#kreisfeld svg .speiche').length !== 3) throw new Error('Speichen fehlen');
    return '3 Knoten, 3 Speichen';
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
    if (!T.vorsatzJahr()[0].punkte[0].erledigt) throw new Error('nicht abgehakt');
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
    if (T.vorsatzJahr()[0].punkte[0].lohn !== 5) throw new Error('Lohn nicht gesetzt');
    click($('#modalblatt .haken')); await wait(20);
    if (muenzstand() !== vorher - 1) throw new Error('Rücknahme zahlt den falschen Betrag');
    click($('#modalblatt .schliessen'));
    await wait(20);
    return 'aus 1 wird 5, Rücknahme stimmt';
  });

  await p.check('Unter den Knoten liegt ein Magiezirkel', () => {
    const svg = $('#kreisfeld svg.zirkel');
    if (!svg) throw new Error('Kein Zirkel');
    if (svg.querySelectorAll('circle').length < 4) throw new Error('Ringe fehlen');
    if (!svg.querySelector('polygon')) throw new Error('Pentagramm fehlt');
    const zeichen = svg.querySelectorAll('text');
    if (zeichen.length < 8) throw new Error('Zeichenkranz: ' + zeichen.length);
    const speichen = svg.querySelectorAll('.speiche');
    if (speichen.length !== T.vorsatzJahr().length)
      throw new Error('Speichen: ' + speichen.length);
    if (!svg.querySelector('.stern')) throw new Error('Pentagramm ohne Farbklasse');
    const duenn = [...svg.querySelectorAll('circle,.speiche,.stern')]
      .filter(e => Number(e.getAttribute('stroke-width')) < 1);
    if (duenn.length) throw new Error(duenn.length + ' Linien dünner als 1');
    return svg.querySelectorAll('circle').length + ' Ringe, ' + zeichen.length + ' Zeichen, '
         + speichen.length + ' Speichen, alle Linien ≥ 1';
  });

  await p.check('Der Jahrgang lässt sich aufklappen und wechseln', async () => {
    const wahl = $('#jahrwahl');
    if (!wahl) throw new Error('Kein Aufklappmenü');
    if (wahl.tagName !== 'SELECT') throw new Error('kein echtes Menü: ' + wahl.tagName);
    const jetzt = T.DATA.vorsaetze.jahr;
    const bisher = T.vorsatzJahr().length;
    if (!bisher) throw new Error('Testaufbau: keine Bereiche im laufenden Jahr');

    // Ein neues Jahr über den letzten Eintrag anlegen …
    setPrompts([String(jetzt + 1)]);
    wahl.value = 'neu'; await wahl.onchange();
    await wait(30);
    if (T.DATA.vorsaetze.jahr !== jetzt + 1) throw new Error('Jahr: ' + T.DATA.vorsaetze.jahr);
    if (T.vorsatzJahr().length !== 0) throw new Error('Der neue Jahrgang ist nicht leer');
    if ($$('.knoten:not(.mitte)').length !== 0) throw new Error('Knoten aus dem alten Jahr');
    if ($('.knoten.mitte .name').textContent !== String(jetzt + 1)) throw new Error('Mitte zeigt das alte Jahr');

    // … und zurückwechseln, ohne dass dort etwas fehlt.
    const zurueck = $('#jahrwahl');
    if ([...zurueck.options].length !== 3) throw new Error('Jahre im Menü: ' + zurueck.options.length);
    zurueck.value = String(jetzt); await zurueck.onchange();
    await wait(30);
    if (T.vorsatzJahr().length !== bisher) throw new Error('Bereiche verloren: ' + T.vorsatzJahr().length);
    return jetzt + ' ⇄ ' + (jetzt + 1) + ', je eigene Bereiche';
  });

  await p.check('Alte Bestände ohne Jahrgänge wandern in ihr Jahr', () => {
    const v = T.adoptVault({ vorsaetze: { jahr: 2024,
      bereiche: [{ id:'b9', name:'Alt', punkte:[{ id:'p9', text:'x' }] }] } });
    if (!v.vorsaetze.jahre['2024']) throw new Error('Jahrgang 2024 fehlt');
    if (v.vorsaetze.jahre['2024'][0].name !== 'Alt') throw new Error('Bereich verloren');
    if (v.vorsaetze.bereiche) throw new Error('alte Form blieb stehen');
    return 'flacher Bestand → Jahrgang 2024';
  });

  await p.check('Die Münze steht als eine Gravur im Dokument', () => {
    const stempel = $('#muenzstempel #muenzform');
    if (!stempel) throw new Error('Keine Gravur im Dokument');
    const kopf = $('#beutel .muenze use');
    if (!kopf || kopf.getAttribute('href') !== '#muenzform') throw new Error('Kopfzeile zeigt etwas anderes');
    return 'Kopfzeile verweist darauf';
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
    click($('[data-habit]'));
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

  await p.check('Der Verlauf reicht bis zum ersten Eintrag zurück', () => {
    const hb = T.DATA.habits[0];
    hb.art = 'takt'; hb.tage = [0,1,2,3,4,5,6];
    const frueher = new Date(); frueher.setDate(frueher.getDate() - 20);
    hb.log[T.alsSchluessel(frueher)] = true;
    const v = T.habitVerlauf(hb);
    if (!v) throw new Error('Kein Verlauf');
    if (v.art !== 'takt') throw new Error('Art: ' + v.art);
    if (v.spalten.length < 3) throw new Error('Wochen: ' + v.spalten.length);
    if (v.spalten.some(sp => sp.length !== 7)) throw new Error('Spalte ohne sieben Tage');
    const getan = v.spalten.flat().filter(t => t.getan).length;
    if (getan < 1) throw new Error('nichts als getan erkannt');
    return v.spalten.length + ' Wochen, ' + getan + '× getan';
  });

  await p.check('Ohne Aufzeichnung gibt es keinen Verlauf', () => {
    if (T.habitVerlauf({ art:'takt', tage:[0], log:{} }) !== null) throw new Error('Verlauf erfunden');
    return 'null';
  });

  await p.check('Bei "so oft" ist jede Spalte ein Zeitraum', () => {
    const hb = { art:'anzahl', anzahl:2, zeitraum:'monat', tage:[], log:{} };
    const jetzt = 'm' + T.monatsSchluessel(new Date());
    const vorigerMonat = new Date(); vorigerMonat.setMonth(vorigerMonat.getMonth() - 2);
    hb.log['m' + T.monatsSchluessel(vorigerMonat) + '#a'] = true;
    hb.log[jetzt + '#b'] = true;
    hb.log[jetzt + '#c'] = true;
    const v = T.habitVerlauf(hb);
    if (v.art !== 'anzahl') throw new Error('Art: ' + v.art);
    if (v.spalten.length !== 3) throw new Error('Zeiträume: ' + v.spalten.length);
    const letzte = v.spalten[v.spalten.length - 1];
    if (letzte.stand !== 2) throw new Error('Stand im letzten Zeitraum: ' + letzte.stand);
    return v.spalten.length + ' Monate, zuletzt 2/2';
  });

  await p.check('Der Verlauf steht im Fenster der Gewohnheit', async () => {
    click(tab('habits'));
    await wait(25);
    click($('[data-habit]'));
    await wait(30);
    if (!$('#verlauf')) throw new Error('Kein Verlauf im Fenster');
    if (!$('#verlauf .zelle')) throw new Error('Keine Zellen');
    if (!/SEIT /.test($('#verlauf').textContent)) throw new Error('Keine Angabe seit wann');
    click($('#modalblatt .schliessen'));
    await wait(20);
    return $$('#verlauf .zelle').length ? 'gezeichnet' : 'leer';
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

  await p.check('Ein erreichtes Ziel zeigt seine Restfrist', () => {
    const kachel = $('.kachel');
    if (!kachel.classList.contains('erreicht')) throw new Error('nicht als erreicht markiert');
    if (!/ERREICHT · NOCH 30 TAGE/.test(kachel.textContent)) throw new Error(kachel.textContent.slice(0,70));
    const balken = kachel.querySelector('.balken i');
    if (balken.getAttribute('style') !== 'width:100%') throw new Error('Balken: ' + balken.getAttribute('style'));
    return '30 Tage Frist';
  });

  /* --- Skills --- */

  await p.check('Das Regal steht leer, bis ein Skill angelegt ist', () => {
    click(tab('skills'));
    if ($$('.buch').length) throw new Error('Bücher ohne Skill');
    if (!$('#regal')) throw new Error('Kein Regal');
    return 'leeres Brett';
  });

  await p.check('Im Regal steht je Skill genau ein Buch', async () => {
    for (const name of ['Aquarell','Gitarre','Japanisch']){
      setPrompts([name]);
      click($('#neuerskill'));
      await wait(30);
      click($('#modalblatt .schliessen'));
      await wait(20);
    }
    if (T.DATA.skills.length !== 3) throw new Error('Skills: ' + T.DATA.skills.length);
    const buecher = $$('.buch');
    if (buecher.length !== 3) throw new Error('Bücher: ' + buecher.length);
    const breiten = buecher.map(b => b.getAttribute('style'));
    if (new Set(breiten).size < 2) throw new Error('Alle Rücken gleich');
    return '3 Bücher, verschiedene Rücken';
  });

  await p.check('Ein Buchrücken springt beim Neuzeichnen nicht', () => {
    const a = T.buchZuschnitt('k1'), b = T.buchZuschnitt('k1'), c = T.buchZuschnitt('k2');
    if (a.breite !== b.breite || a.hoehe !== b.hoehe) throw new Error('zappelt');
    if (a.breite === c.breite && a.hoehe === c.hoehe && a.farben[0] === c.farben[0])
      throw new Error('alle gleich');
    // Kurze, benachbarte Kennungen sind der harte Fall: sie dürfen
    // nicht denselben Rücken bekommen.
    const ruecken = ['k1','k2','k3','k4','k5','k6'].map(x => T.buchZuschnitt(x).farben[0]);
    if (new Set(ruecken).size < 4) throw new Error('Rücken zu ähnlich: ' + [...new Set(ruecken)].length);
    return a.breite + '×' + a.hoehe + ' vs ' + c.breite + '×' + c.hoehe;
  });

  await p.check('Im Regal steht auch Deko', () => {
    const links = $('#regal .brett:first-child .deko.links');
    if (!links) throw new Error('Keine Pflanze links oben');
    if (!links.querySelector('.rankpflanze')) throw new Error('Rankpflanze fehlt');

    const unten = $('#regal .brett:last-child .deko:not(.links)');
    if (!unten) throw new Error('Keine Deko auf dem untersten Brett');
    for (const teil of ['pflanze','frosch']){
      if (!unten.querySelector('.' + teil)) throw new Error(teil + ' fehlt');
    }
    if ($('#regal .rolle')) throw new Error('Die Pergamentrolle steht noch da');
    [links, unten].forEach(d => {
      if (d.getAttribute('aria-hidden') !== 'true') throw new Error('Deko nicht als Zierrat gekennzeichnet');
    });
    return 'Rankpflanze links oben, Topfpflanze und Frosch unten';
  });

  await p.check('Unter dem Regal steht kein Textblatt', () => {
    const blaetter = $$('main .seite');
    if (blaetter.length) throw new Error(blaetter.length + ' Blätter unter dem Regal');
    return 'nur das Regal und der Knopf';
  });

  await p.check('Die Eckzeichen sind Zeichen aus der Vorlage', () => {
    click(tab('todo'));
    const zeichen = $$('main .seite > .emblem');
    if (!zeichen.length) throw new Error('Keine Eckzeichen');
    zeichen.forEach(z => {
      if (z.getAttribute('aria-hidden') !== 'true') throw new Error('Zeichen nicht als Zierrat gekennzeichnet');
      const d = z.querySelector('path').getAttribute('d');
      if (!d || d.length < 20) throw new Error('Leeres Zeichen');
    });
    // Mehrere Blätter nebeneinander sollen nicht dasselbe Zeichen tragen.
    const formen = zeichen.map(z => z.querySelector('path').getAttribute('d'));
    if (new Set(formen).size < Math.min(4, zeichen.length))
      throw new Error('zu wenig verschiedene: ' + new Set(formen).size);
    click(tab('skills'));   // die folgenden Prüfungen arbeiten im Regal weiter
    return zeichen.length + ' Zeichen, ' + new Set(formen).size + ' verschiedene';
  });

  await p.check('Ein Skill trägt mehrere große Ziele', async () => {
    click($('[data-skill]'));
    await wait(25);
    const k = T.DATA.skills.find(x => x.id === $('[data-skill]').dataset.skill);
    if (k.listen.length !== 1) throw new Error('Große Ziele: ' + k.listen.length);
    setPrompts(['Technik']);
    click($$('#modalblatt .knopf').find(b => b.textContent === '+ GROSSES ZIEL'));
    await wait(30);
    if (k.listen.length !== 2) throw new Error('zweites Ziel fehlt');
    if ($$('#modalblatt .listenkopf.gross').length !== 2) throw new Error('nur eines gezeigt');
    return '2 große Ziele';
  });

  await p.check('Unter dem großen Ziel stehen Teilziele, darunter erst Aufgaben', async () => {
    const k = T.DATA.skills[0];
    // Erst ein Teilziel je großem Ziel …
    for (const [i, name] of [[0,'Lasur'],[1,'Pinsel']]){
      setPrompts([name]);
      click($$('#modalblatt .knopf').filter(b => b.textContent === '+ TEILZIEL')[i]);
      await wait(30);
    }
    if (k.listen[0].teilziele.length !== 1 || k.listen[1].teilziele.length !== 1)
      throw new Error('Teilziele landeten am selben Ziel');
    // … und darunter die Aufgaben.
    const aufgabeKnoepfe = $$('#modalblatt .knopf').filter(b => b.textContent === '+ AUFGABE');
    if (aufgabeKnoepfe.length !== 2) throw new Error('Aufgaben-Knöpfe: ' + aufgabeKnoepfe.length);
    setPrompts(['Nass in nass üben']);
    click(aufgabeKnoepfe[0]);
    await wait(30);
    if (k.listen[0].teilziele[0].punkte.length !== 1) throw new Error('Aufgabe fehlt');
    if (k.listen[1].teilziele[0].punkte.length !== 0) throw new Error('Aufgabe im falschen Ziel');
    // Die Aufgabe hängt unter dem Teilziel, nicht direkt am großen Ziel.
    if (!$('#modalblatt .teilziele .punkt')) throw new Error('Aufgabe steht nicht unter dem Teilziel');
    return '3 Ebenen: Ziel → Teilziel → Aufgabe';
  });

  await p.check('Abhaken wirkt sofort im offenen Fenster', async () => {
    const vorher = muenzstand();
    const kaestchen = $('#modalblatt .teilziele .haken');
    if (kaestchen.classList.contains('an')) throw new Error('schon abgehakt');
    click(kaestchen);
    await wait(30);
    // Ohne das Fenster zu schließen: Haken sichtbar, Münze gezählt.
    if ($('#modalblatt')?.hidden === true) throw new Error('Fenster schloss sich');
    const jetzt = $('#modalblatt .teilziele .haken');
    if (!jetzt.classList.contains('an')) throw new Error('Kästchen blieb leer');
    if (jetzt.textContent !== '✓') throw new Error('kein Haken zu sehen');
    if (muenzstand() !== vorher + 1) throw new Error('Münzen: ' + muenzstand());
    return 'Haken und Münze ohne Schließen';
  });

  await p.check('Große Ziele und Teilziele lassen sich umordnen', async () => {
    const k = T.DATA.skills[0];
    const namen = () => k.listen.map(l => l.name).join(',');
    const vorher = namen();
    const runter = $$('#modalblatt .listenkopf.gross .ordnen')
      .filter(b => b.getAttribute('aria-label') === 'Nach unten');
    click(runter[0]);
    await wait(30);
    if (namen() === vorher) throw new Error('nichts verschoben');
    if (namen() !== vorher.split(',').reverse().join(',')) throw new Error('falsch verschoben: ' + namen());
    // Am Rand passiert nichts — der oberste Eintrag springt nicht ans Ende.
    const hoch = $$('#modalblatt .listenkopf.gross .ordnen')
      .filter(b => b.getAttribute('aria-label') === 'Nach oben');
    if (!hoch[0].classList.contains('aus')) throw new Error('oberster Pfeil nicht abgeblendet');
    if (!T.verschieben(k.listen, k.listen[0], -1)) { /* liefert false — richtig */ }
    else throw new Error('Umlauf über den Rand');
    click($('#modalblatt .schliessen'));
    await wait(20);
    return vorher + ' → ' + namen();
  });

  await p.check('Ein Brett wird voll, bevor das nächste anfängt', async () => {
    for (const name of ['Töpfern','Klettern','Schach','Nähen','Kochen','Segeln','Imkern']){
      setPrompts([name]);
      click($('#neuerskill'));
      await wait(30);
      click($('#modalblatt .schliessen'));
      await wait(20);
    }
    // Dieselbe Brettbreite, mit der die Seite rechnet — sie hängt am
    // Bildschirm, und hier soll die Aufteilungsregel geprüft werden,
    // nicht eine bestimmte Zahl.
    const PLATZ = T.brettBreite(), PFLANZE = 47, ABSTAND = 3;
    const breiteVon = b => Number(/width:(\d+)px/.exec(b.getAttribute('style'))[1]);
    const belegung = [...$$('#regal .brett')].map((brett, i) => {
      const buecher = [...brett.querySelectorAll('.buch')];
      return { buecher,
               belegt: buecher.reduce((n, b) => n + breiteVon(b) + ABSTAND, 0) + (i === 0 ? PFLANZE : 0),
               platz: PLATZ };
    });
    const bestueckt = belegung.filter(b => b.buecher.length);
    if (bestueckt.length < 2) throw new Error('nur ' + bestueckt.length + ' bestücktes Brett');

    bestueckt.forEach((b, i) => {
      if (b.belegt > b.platz) throw new Error('Brett ' + (i+1) + ' läuft über: ' + b.belegt + 'px');
      // Das entscheidende: das erste Buch des nächsten Bretts hätte
      // hier nicht mehr hingepasst — sonst wäre zu früh umgebrochen.
      const naechstes = bestueckt[i + 1];
      if (!naechstes) return;
      const braucht = breiteVon(naechstes.buecher[0]) + ABSTAND;
      if (b.belegt + braucht <= b.platz)
        throw new Error('Brett ' + (i+1) + ' war erst bei ' + b.belegt + ' von ' + b.platz
                      + 'px, das nächste Buch (' + braucht + 'px) hätte noch gepasst');
    });

    // Die Rücken behalten ihre eigene Breite, sie werden nicht gedehnt.
    const gedehnt = $$('#regal .buch').filter(b => /flex:\s*\d/.test(b.getAttribute('style')));
    if (gedehnt.length) throw new Error(gedehnt.length + ' Rücken werden in die Breite gezogen');

    if ($$('#regal .buch').length !== T.DATA.skills.length)
      throw new Error('Bücher: ' + $$('#regal .buch').length + ' für ' + T.DATA.skills.length + ' Skills');
    return bestueckt.map(b => b.buecher.length + ' (' + b.belegt + '/' + b.platz + 'px)').join(', ');
  });

  /* --- To Do --- */

  await p.check('Die Woche zeigt sieben Tage von oben nach unten', () => {
    click(tab('todo'));
    const blaetter = $$('.seite');
    if (blaetter.length !== 7) throw new Error('Blätter: ' + blaetter.length);
    const tage = $$('.tagkopf .wt').map(e => e.textContent);
    if (tage[0] !== 'Montag' || tage[6] !== 'Sonntag') throw new Error(tage.join(','));
    return tage.join(' ');
  });

  await p.check('Der heutige Tag ist hervorgehoben', () => {
    const heute = $$('.seite.heute');
    if (heute.length !== 1) throw new Error('hervorgehoben: ' + heute.length);
    return 'genau einer';
  });

  await p.check('To-do eintragen und abhaken', async () => {
    setPrompts(['Brot kaufen']);
    click($$('main [data-tag]')[0]);
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

  await p.check('Knopf und Fenster nennen nur den Monat', async () => {
    const aufschrift = $('#monatsknopf').textContent.trim();
    if (/Monatsliste/.test(aufschrift)) throw new Error('Knopf: ' + aufschrift);
    if (!/^[A-ZÄÖÜ][a-zäöü]+ \d{4}$/.test(aufschrift)) throw new Error('Aufschrift: ' + aufschrift);
    click($('#monatsknopf'));
    await wait(25);
    const titel = $('#modalblatt h2').textContent.trim();
    if (/Monatsliste/.test(titel)) throw new Error('Fenstertitel: ' + titel);
    if (titel !== aufschrift) throw new Error(titel + ' ≠ ' + aufschrift);
    click($('#modalblatt .schliessen'));
    await wait(20);
    return aufschrift;
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

  await p.check('Ein To-do lässt sich auf den nächsten Tag schieben', async () => {
    click(tab('todo'));
    await wait(25);
    const montag = T.alsSchluessel(T.tageDerWoche(0)[0]);
    const dienstag = T.alsSchluessel(T.tageDerWoche(0)[1]);
    const vorherMo = T.DATA.todo.tage[montag].length;
    const vorherDi = (T.DATA.todo.tage[dienstag] || []).length;
    const text = T.DATA.todo.tage[montag][0].text;
    click($('.seite .schieben'));
    await wait(30);
    if (T.DATA.todo.tage[montag].length !== vorherMo - 1) throw new Error('bleibt am Montag');
    if (T.DATA.todo.tage[dienstag].length !== vorherDi + 1) throw new Error('kommt nicht am Dienstag an');
    if (T.DATA.todo.tage[dienstag].slice(-1)[0].text !== text) throw new Error('falscher Eintrag verschoben');
    return '„' + text + '" Mo → Di';
  });

  await p.check('Verschieben behält den Haken', async () => {
    const dienstag = T.alsSchluessel(T.tageDerWoche(0)[1]);
    const pt = T.DATA.todo.tage[dienstag].slice(-1)[0];
    pt.erledigt = true;
    const stand = muenzstand();
    T.render();
    await wait(20);
    const zeilen = $$('.seite .punkt');
    const treffer = zeilen.find(z => z.textContent.includes(pt.text));
    click(treffer.querySelector('.schieben'));
    await wait(30);
    const mittwoch = T.alsSchluessel(T.tageDerWoche(0)[2]);
    const jetzt = T.DATA.todo.tage[mittwoch].slice(-1)[0];
    if (!jetzt.erledigt) throw new Error('Haken verloren');
    if (muenzstand() !== stand) throw new Error('Münzen verändert: ' + muenzstand());
    return 'Haken und Münzen unberührt';
  });

  /* --- Verantwortung --- */

  await p.check('Bereich anlegen und Notiz schreiben', async () => {
    click(tab('habits'));
    await wait(20);
    click($('#pflichtknopf'));
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
    click($('#beutel'));
    setPrompts(['Kinoabend']);
    click($('#neuebelohnung'));
    await wait(40);
    if (T.DATA.belohnungen.length !== 1) throw new Error('nicht angelegt');
    const preis = $('#lohnpreis');
    preis.value = '4'; await preis.onchange();
    await wait(30);
    if (T.DATA.belohnungen[0].preis !== 4) throw new Error('Preis: ' + T.DATA.belohnungen[0].preis);
    click($('#modalblatt .schliessen'));
    await wait(20);
    // Auch am Preis hängt dieselbe Gravur wie oben in der Kopfzeile.
    const muenzen = $$('.preis .muenze use');
    if (!muenzen.length) throw new Error('Keine Münze am Preis');
    if (muenzen.some(u => u.getAttribute('href') !== '#muenzform'))
      throw new Error('Ein Preis zeigt eine andere Münze');
    return '4 Münzen, gleiche Gravur';
  });

  await p.check('Zu teuer lässt sich nicht einlösen', async () => {
    T.DATA.belohnungen[0].preis = 9999;
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

  await p.check('Die Belohnungen stehen nach Preis aufsteigend', async () => {
    click($('#modalblatt .schliessen'));
    await wait(20);
    T.DATA.belohnungen.length = 0;
    // Bewusst unsortiert eingetragen — die Seite soll das richten.
    [['Kino',12],['Kuchen',3],['Wochenende',40],['Kaffee',3]].forEach(([name, preis]) => {
      T.DATA.belohnungen.push({ id:'l_'+name, name, text:'', preis, bild:null });
    });
    T.render();
    await wait(30);
    const preise = $$('#lohnkacheln .preis .zahl').map(z => Number(z.textContent));
    if (preise.join(',') !== '3,3,12,40') throw new Error('Reihenfolge: ' + preise.join(','));
    const namen = $$('#lohnkacheln .kachel h3').map(n => n.textContent);
    if (namen[0] !== 'Kaffee') throw new Error('gleicher Preis nicht alphabetisch: ' + namen.join(','));
    // Sortiert wird nur die Anzeige; der Bestand bleibt, wie er steht.
    if (T.DATA.belohnungen[0].name !== 'Kino') throw new Error('Bestand umgestellt');
    return namen.join(' < ');
  });

  await p.check('Der Beutel wird nie negativ', async () => {
    T.muenzen(-99999);
    await wait(20);
    if (T.DATA.muenzen !== 0) throw new Error('Stand: ' + T.DATA.muenzen);
    return '0 ist die Grenze';
  });

  /* --- Was von selbst verschwindet --- */

  await p.check('Ein erreichtes Ziel merkt sich, seit wann', () => {
    const z = { id:'zx', name:'X', text:'', schritte:[{ id:'a', text:'x', erledigt:true, lohn:1 }], fertigSeit:null };
    T.DATA.ziele.push(z);
    T.zielStandPflegen();
    if (!z.fertigSeit) throw new Error('kein Zeitpunkt gesetzt');
    z.schritte[0].erledigt = false;
    T.zielStandPflegen();
    if (z.fertigSeit) throw new Error('Zeitpunkt blieb trotz offenem Schritt');
    z.schritte[0].erledigt = true;
    T.zielStandPflegen();
    return 'gesetzt und wieder gelöscht';
  });

  await p.check('Ein Ziel ohne Schritte gilt nicht als erreicht', () => {
    const z = { id:'zleer', name:'Leer', text:'', schritte:[], fertigSeit:null };
    T.DATA.ziele.push(z);
    T.zielStandPflegen();
    if (z.fertigSeit) throw new Error('leeres Ziel wurde als erreicht gewertet');
    T.DATA.ziele = T.DATA.ziele.filter(x => x !== z);
    return 'zu Recht offen';
  });

  await p.check('Nach dreißig Tagen wird das Ziel getilgt', () => {
    const z = T.DATA.ziele.find(x => x.id === 'zx');
    const lange = new Date(); lange.setDate(lange.getDate() - T.HALTEFRIST_TAGE - 1);
    z.fertigSeit = lange.toISOString();
    const bericht = T.abgelaufenesRaeumen();
    if (!bericht || bericht.ziele !== 1) throw new Error('nicht geräumt: ' + JSON.stringify(bericht));
    if (T.DATA.ziele.some(x => x.id === 'zx')) throw new Error('Ziel steht noch');
    if (!T.DATA.getilgt.includes('zx')) throw new Error('kein Grabstein');
    return 'weg und vermerkt';
  });

  await p.check('Einen Tag vorher bleibt es stehen', () => {
    const z = { id:'zy', name:'Y', text:'', schritte:[{ id:'b', text:'y', erledigt:true, lohn:1 }] };
    const knapp = new Date(); knapp.setDate(knapp.getDate() - T.HALTEFRIST_TAGE + 1);
    z.fertigSeit = knapp.toISOString();
    T.DATA.ziele.push(z);
    T.abgelaufenesRaeumen();
    if (!T.DATA.ziele.some(x => x.id === 'zy')) throw new Error('zu früh getilgt');
    T.DATA.ziele = T.DATA.ziele.filter(x => x.id !== 'zy');
    return 'Frist eingehalten';
  });

  await p.check('Vergangene Wochen bleiben stehen', () => {
    const alt = '2026-01-05';
    T.DATA.todo.tage[alt] = [{ id:'altp', text:'vorbei', erledigt:false, lohn:1 }];
    T.abgelaufenesRaeumen();
    if (!T.DATA.todo.tage[alt]) throw new Error('alte Woche wurde geräumt');
    if (T.DATA.getilgt.includes('altp')) throw new Error('alte Woche wurde vermerkt');
    return 'zum Zurückblättern da';
  });

  await p.check('Zurückblättern zeigt sie auch', async () => {
    click(tab('todo'));
    await wait(25);
    const spanne = $('#wochenspanne').textContent;
    click($('#wochezurueck'));
    await wait(25);
    if ($('#wochenspanne').textContent === spanne) throw new Error('Spanne unverändert');
    click($('#wochevor'));
    await wait(25);
    return 'blättert';
  });

  await p.check('Ein Backup bringt ein getilgtes Ziel nicht zurück', () => {
    const vorher = T.DATA.ziele.length;
    T.mergeVault({ ziele: [{ id:'zx', name:'Wieder da?', text:'', schritte:[] }] });
    if (T.DATA.ziele.length !== vorher) throw new Error('getilgtes Ziel kam zurück');
    return 'Grabstein hält';
  });

  await p.check('Eine alte Woche kommt aus dem Backup zurück', () => {
    delete T.DATA.todo.tage['2026-02-02'];
    T.mergeVault({ todo: { tage: { '2026-02-02': [{ id:'altbackup', text:'von früher' }] }, monate:{} } });
    if (!T.DATA.todo.tage['2026-02-02']) throw new Error('alte Woche wurde übersprungen');
    return 'ergänzt';
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
      modus: 'dunkel',
    }));
    const v = T.adoptVault(roh);
    if (v.muenzen !== 7) throw new Error('Münzen: ' + v.muenzen);
    if (v.vorsaetze.jahr !== 2031) throw new Error('Jahr: ' + v.vorsaetze.jahr);
    if (v.vorsaetze.jahre['2031'][0].punkte[0].lohn !== 3) throw new Error('Lohn verloren');
    if (v.habits[0].zeitraum !== 'woche') throw new Error('Zeitraum verloren');
    if (v.todo.tage['2026-01-01'][0].lohn !== 1) throw new Error('Standardlohn fehlt');
    if (v.modus !== 'dunkel') throw new Error('Modus: ' + v.modus);
    return 'alle sechs Bereiche';
  });

  await p.check('Unsinn im Bestand wird auf gültige Werte gebracht', () => {
    const v = T.adoptVault({ muenzen:'viel', modus:'gold',
      habits:[{ id:'h', name:'x', art:'quatsch', anzahl:-3, tage:[9,1] }] });
    if (v.muenzen !== 0) throw new Error('Münzen: ' + v.muenzen);
    if (v.modus !== 'hell') throw new Error('Modus: ' + v.modus);
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
      todo: { tage: { [T.alsSchluessel(T.tageDerWoche(0)[4])]: [{ id:'fremdp', text:'z' }] }, monate:{} },
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

  await p.check('Der dunkle Modus lässt sich schalten und bleibt', async () => {
    if (doc.documentElement.dataset.modus !== 'hell') throw new Error('Start: ' + doc.documentElement.dataset.modus);
    click($('#modusbtn'));
    await wait(30);
    if (doc.documentElement.dataset.modus !== 'dunkel') throw new Error('nicht umgeschaltet');
    if (T.DATA.modus !== 'dunkel') throw new Error('nicht im Bestand');
    click($('#modusbtn'));
    await wait(30);
    if (doc.documentElement.dataset.modus !== 'hell') throw new Error('nicht zurück');
    return 'Pergament ⇄ Dunkel';
  });

  await p.check('Pergament ist die Voreinstellung', () => {
    const v = T.adoptVault({});
    if (v.modus !== 'hell') throw new Error('Modus: ' + v.modus);
    if (T.adoptVault({ modus:'lila' }).modus !== 'hell') throw new Error('Unsinn nicht abgefangen');
    if (T.adoptVault({ modus:'dunkel' }).modus !== 'dunkel') throw new Error('dunkel nicht übernommen');
    return 'hell';
  });

  process.exit(p.bericht(errors) ? 1 : 0);
})();
