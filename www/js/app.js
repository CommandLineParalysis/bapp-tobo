'use strict';

/* ============================================================
   To Bo — ein Grimoire für Vorsätze, Gewohnheiten und Pflichten.

   Sechs Bereiche, eine Währung: jedes abgehakte Ding bringt
   Zaubermünzen, und die gibt man im Belohnungsbereich wieder aus.
   Der Münzstand steht immer oben rechts, weil er der Punkt der
   ganzen App ist.
   ============================================================ */

/* ---------- Daten ---------- */

const WOCHENTAGE = ['MO','DI','MI','DO','FR','SA','SO'];
const WOCHENTAGE_LANG = ['MONTAG','DIENSTAG','MITTWOCH','DONNERSTAG','FREITAG','SAMSTAG','SONNTAG'];

function leererVault(){
  return {
    muenzen: 0,
    vorsaetze: { jahr: new Date().getFullYear(), bereiche: [] },
    habits: [],
    ziele: [],
    todo: { tage: {}, monate: {} },
    pflichten: [],
    belohnungen: [],
    theme: 'teal',
    backup: null,
  };
}

let DATA = leererVault();

const state = {
  screen: 'todo',
  woche: 0,            // 0 = diese Woche, -1 die vorige, …
  offen: null,         // { art, id } — welches Fenster offen ist
};

function vaultPayload(){
  return {
    muenzen: DATA.muenzen, vorsaetze: DATA.vorsaetze, habits: DATA.habits,
    ziele: DATA.ziele, todo: DATA.todo, pflichten: DATA.pflichten,
    belohnungen: DATA.belohnungen, theme: DATA.theme, backup: DATA.backup,
  };
}

function neueId(p){ return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7); }

/* Ein abhakbarer Punkt. Der Lohn steht am Punkt, nicht an einer
   globalen Einstellung: manches ist mehr wert als anderes. */
function neuerPunkt(text){
  return { id: neueId('p'), text: String(text || '').trim(), erledigt: false, lohn: 1 };
}

function punkteListe(liste){
  return (Array.isArray(liste) ? liste : []).map(p => ({
    id: p.id || neueId('p'),
    text: String(p.text || ''),
    erledigt: !!p.erledigt,
    lohn: Number.isFinite(p.lohn) ? p.lohn : 1,
  }));
}

function adoptVault(saved){
  const v = leererVault();
  if (!saved) return v;
  v.muenzen = Number.isFinite(saved.muenzen) ? saved.muenzen : 0;

  const vs = saved.vorsaetze || {};
  v.vorsaetze = {
    jahr: Number.isFinite(vs.jahr) ? vs.jahr : new Date().getFullYear(),
    bereiche: (vs.bereiche || []).map(b => ({
      id: b.id || neueId('b'), name: String(b.name || ''), punkte: punkteListe(b.punkte),
    })),
  };

  v.habits = (saved.habits || []).map(h => ({
    id: h.id || neueId('h'),
    name: String(h.name || ''),
    art: h.art === 'anzahl' ? 'anzahl' : 'takt',
    tage: Array.isArray(h.tage) ? h.tage.filter(t => t >= 0 && t <= 6) : [0,2,4],
    anzahl: Number.isFinite(h.anzahl) && h.anzahl > 0 ? h.anzahl : 2,
    zeitraum: h.zeitraum === 'woche' ? 'woche' : 'monat',
    lohn: Number.isFinite(h.lohn) ? h.lohn : 1,
    log: h.log && typeof h.log === 'object' ? h.log : {},
  }));

  v.ziele = (saved.ziele || []).map(z => ({
    id: z.id || neueId('z'), name: String(z.name || ''), text: String(z.text || ''),
    schritte: punkteListe(z.schritte),
  }));

  const td = saved.todo || {};
  v.todo = { tage: {}, monate: {} };
  Object.entries(td.tage || {}).forEach(([k, l]) => { v.todo.tage[k] = punkteListe(l); });
  Object.entries(td.monate || {}).forEach(([k, l]) => { v.todo.monate[k] = punkteListe(l); });

  v.pflichten = (saved.pflichten || []).map(p => ({
    id: p.id || neueId('f'), name: String(p.name || ''), notiz: String(p.notiz || ''),
  }));

  v.belohnungen = (saved.belohnungen || []).map(b => ({
    id: b.id || neueId('l'), name: String(b.name || ''), text: String(b.text || ''),
    preis: Number.isFinite(b.preis) && b.preis > 0 ? b.preis : 10,
    bild: b.bild || null,
  }));

  v.theme = ['teal','orange','pink'].includes(saved.theme) ? saved.theme : 'teal';
  v.backup = saved.backup || null;
  return v;
}

function allImageRefs(){
  return DATA.belohnungen.map(b => b.bild).filter(Boolean);
}

/* Ein fehlgeschlagenes Speichern darf die App nicht mitreißen — auf
   dem Gerät kann der Speicher voll sein, im Browser die Ablage
   gesperrt. Gesagt wird es einmal, danach läuft die Sitzung weiter. */
let speicherKlemmt = false;
async function persist(){
  try {
    await Store.saveVault(vaultPayload());
  } catch(e){
    console.warn('Konnte nicht speichern', e);
    if (!speicherKlemmt){
      speicherKlemmt = true;
      alert('Konnte nicht speichern. Ist der Gerätespeicher voll?');
    }
  }
}

/* ---------- Zaubermünzen ----------
   Abhaken bringt Münzen, Häkchen wieder wegnehmen zieht sie ab.
   Sonst ließe sich derselbe Punkt beliebig oft abkassieren. */

function muenzen(n){
  DATA.muenzen = Math.max(0, DATA.muenzen + n);
  const feld = document.getElementById('muenzzahl');
  if (feld) feld.textContent = DATA.muenzen;
  if (n > 0){
    const beutel = document.getElementById('beutel');
    if (beutel){
      beutel.classList.remove('gewinn');
      void beutel.offsetWidth;          // Neustart der Animation erzwingen
      beutel.classList.add('gewinn');
    }
  }
}

async function punktSchalten(p){
  p.erledigt = !p.erledigt;
  muenzen(p.erledigt ? p.lohn : -p.lohn);
  await persist();
  render();
}

/* ---------- Datum ---------- */

function alsSchluessel(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function monatsSchluessel(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
}
/* Montag als erster Tag der Woche — getDay() zählt ab Sonntag. */
function wochenstart(versatz){
  const d = new Date();
  d.setHours(12,0,0,0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (versatz || 0) * 7);
  return d;
}
function tageDerWoche(versatz){
  const start = wochenstart(versatz);
  return Array.from({length:7}, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
function kurzDatum(d){
  return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + '.';
}

/* ---------- Bausteine ---------- */

function h(tag, attrs, ...kinder){
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})){
    if (v === null || v === undefined || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k === 'onclick') el.onclick = v;
    else if (k === 'oninput') el.oninput = v;
    else if (k === 'onchange') el.onchange = v;
    else if (k === 'style') el.setAttribute('style', v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  kinder.flat().forEach(kind => {
    if (kind === null || kind === undefined || kind === false) return;
    el.appendChild(typeof kind === 'string' ? document.createTextNode(kind) : kind);
  });
  return el;
}

function knopf(text, bei, art){
  return h('button', { class: 'knopf' + (art ? ' ' + art : ''), onclick: bei, text });
}

function seite(titel, meta, ...inhalt){
  const s = h('div', { class: 'seite' });
  if (titel){
    s.appendChild(h('div', { class: 'seitentitel' },
      h('span', { text: titel }), h('span', { class: 'zier' }),
      meta ? h('span', { class: 'seitenmeta', text: meta }) : null));
  }
  inhalt.flat().forEach(k => { if (k) s.appendChild(k); });
  return s;
}

/* Eine abhakbare Zeile. Der Lohn ist antippbar, das Löschen auch. */
function punktZeile(p, beiAenderung){
  const zeile = h('div', { class: 'punkt' + (p.erledigt ? ' erledigt' : '') });
  zeile.appendChild(h('button', {
    class: 'haken' + (p.erledigt ? ' an' : ''),
    'aria-label': p.erledigt ? 'Häkchen wegnehmen' : 'Abhaken',
    text: p.erledigt ? '✓' : '',
    onclick: () => punktSchalten(p),
  }));
  zeile.appendChild(h('span', {
    class: 'text', text: p.text || '…',
    onclick: async () => {
      const neu = prompt('Text ändern:', p.text);
      if (neu === null) return;
      p.text = neu.trim();
      await persist(); beiAenderung();
    },
  }));
  zeile.appendChild(h('span', {
    class: 'lohn', text: '◉' + p.lohn,
    title: 'Zaubermünzen für diesen Punkt',
    onclick: async () => {
      const neu = parseInt(prompt('Wie viele Zaubermünzen ist das wert?', p.lohn), 10);
      if (!Number.isFinite(neu) || neu < 0) return;
      // Ist der Punkt schon abgehakt, wird die Differenz nachgezahlt.
      if (p.erledigt) muenzen(neu - p.lohn);
      p.lohn = neu;
      await persist(); beiAenderung();
    },
  }));
  zeile.appendChild(h('button', {
    class: 'weg', text: '×', 'aria-label': 'Punkt löschen',
    onclick: async () => {
      if (!confirm('Diesen Punkt löschen?')) return;
      if (p.erledigt) muenzen(-p.lohn);
      p.geloescht = true;
      await persist(); beiAenderung();
    },
  }));
  return zeile;
}

/* Löschen markiert nur; ausgeräumt wird an einer Stelle. */
function aufraeumen(liste){
  for (let i = liste.length - 1; i >= 0; i--) if (liste[i].geloescht) liste.splice(i, 1);
}

function punkteBlock(liste, beiAenderung, platzhalter){
  aufraeumen(liste);
  const block = h('div', {});
  if (!liste.length) block.appendChild(h('div', { class:'leer', text: platzhalter || 'Noch nichts eingetragen.' }));
  liste.forEach(p => block.appendChild(punktZeile(p, beiAenderung)));
  return block;
}

function erledigtVon(liste){ return liste.filter(p => p.erledigt).length; }

function fortschritt(liste){
  const anteil = liste.length ? erledigtVon(liste) / liste.length : 0;
  return h('div', { class:'balken' }, h('i', { style: 'width:' + Math.round(anteil*100) + '%' }));
}

/* ---------- Fenster ---------- */

function fensterOeffnen(titel, aufbau){
  const modal = document.getElementById('modal');
  const blatt = document.getElementById('modalblatt');
  blatt.textContent = '';
  const kopf = h('div', { class:'modalkopf' },
    h('h2', { text: titel }),
    h('button', { class:'schliessen', text:'✕', 'aria-label':'Fenster schließen', onclick: fensterSchliessen }));
  blatt.appendChild(kopf);
  aufbau(blatt);
  modal.hidden = false;
  modal.onclick = ev => { if (ev.target === modal) fensterSchliessen(); };
}

function fensterSchliessen(){
  state.offen = null;
  document.getElementById('modal').hidden = true;
  render();
}

/* Das offene Fenster neu aufbauen, ohne es zu schließen. */
function fensterAuffrischen(){
  if (state.offen) zeigeFenster(state.offen);
}

/* ---------- Verteiler ---------- */

const TITEL = {
  vorsaetze:'JAHRESVORSÄTZE', habits:'HABITS', ziele:'ZIELE',
  todo:'TO DO', pflichten:'VERANTWORTUNG', belohnungen:'BELOHNUNGEN',
  einstellungen:'EINSTELLUNGEN',
};

function go(screen){
  state.screen = screen;
  if (screen !== 'todo') state.woche = 0;
  render();
}

function render(){
  const main = document.getElementById('main');
  main.textContent = '';
  const bauer = {
    vorsaetze: vorsaetzeSeite, habits: habitsSeite, ziele: zieleSeite,
    todo: todoSeite, pflichten: pflichtenSeite, belohnungen: belohnungenSeite,
    einstellungen: einstellungenSeite,
  }[state.screen] || todoSeite;
  main.appendChild(bauer());

  document.getElementById('kopftitel').textContent = TITEL[state.screen] || 'TO BO';
  document.getElementById('muenzzahl').textContent = DATA.muenzen;
  document.querySelectorAll('#nav .tab').forEach(t => t.classList.toggle('on', t.dataset.screen === state.screen));
  bilderAufloesen();
}

async function bilderAufloesen(){
  for (const img of [...document.querySelectorAll('img[data-ref]')]){
    const ref = img.dataset.ref;
    delete img.dataset.ref;
    try {
      const url = await Store.imageUrl(ref);
      if (url) img.src = url;
    } catch(e){ /* Bild fehlt — die Kachel bleibt leer, statt zu brechen */ }
  }
}

/* ---------- 1. Jahresvorsätze ----------
   Die Lebensbereiche liegen als Ring um das Jahr in der Mitte. Das
   ist die Mindmap: eine feste Anordnung statt frei geschobener
   Knoten — auf einem Handy trifft man Knoten sonst nicht. */

function vorsaetzeSeite(){
  const v = DATA.vorsaetze;
  const wurzel = h('div', {});

  const feld = h('div', { class:'kreisfeld', id:'kreisfeld' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  feld.appendChild(svg);

  const n = v.bereiche.length;
  const radius = n > 6 ? 37 : 34;
  v.bereiche.forEach((b, i) => {
    const winkel = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(winkel) * radius;
    const y = 50 + Math.sin(winkel) * radius;

    const linie = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    linie.setAttribute('x1', 50); linie.setAttribute('y1', 50);
    linie.setAttribute('x2', x);  linie.setAttribute('y2', y);
    linie.setAttribute('stroke', 'rgba(var(--primary-rgb),.5)');
    linie.setAttribute('stroke-width', '.6');
    linie.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(linie);

    feld.appendChild(h('button', {
      class:'knoten', style:'left:' + x + '%;top:' + y + '%',
      onclick: () => zeigeFenster({ art:'bereich', id:b.id }),
    },
      h('span', { class:'name', text: b.name || '…' }),
      h('span', { class:'stand', text: erledigtVon(b.punkte) + '/' + b.punkte.length })));
  });

  const gesamt = v.bereiche.reduce((s, b) => s + b.punkte.length, 0);
  const fertig = v.bereiche.reduce((s, b) => s + erledigtVon(b.punkte), 0);
  feld.appendChild(h('div', { class:'knoten mitte' },
    h('span', { class:'name', text: String(v.jahr) }),
    h('span', { class:'stand', text: gesamt ? fertig + '/' + gesamt : 'leer' })));

  wurzel.appendChild(feld);

  if (!n){
    wurzel.appendChild(seite(null, null,
      h('div', { class:'leer', text:'Noch keine Lebensbereiche. Leg unten den ersten an — Gesundheit, Arbeit, Menschen, was du willst.' })));
  }

  wurzel.appendChild(h('button', {
    class:'neu', id:'neuerbereich', text:'+ LEBENSBEREICH',
    onclick: async () => {
      const name = (prompt('Name des Lebensbereichs:') || '').trim();
      if (!name) return;
      DATA.vorsaetze.bereiche.push({ id: neueId('b'), name, punkte: [] });
      await persist(); render();
    },
  }));
  wurzel.appendChild(h('button', {
    class:'knopf still', id:'jahrbtn', style:'width:100%;margin-top:9px',
    text:'JAHR: ' + v.jahr,
    onclick: async () => {
      const j = parseInt(prompt('Welches Jahr?', v.jahr), 10);
      if (!Number.isFinite(j)) return;
      DATA.vorsaetze.jahr = j;
      await persist(); render();
    },
  }));
  return wurzel;
}

/* ---------- 3. Ziele ---------- */

function zieleSeite(){
  const wurzel = h('div', {});
  if (!DATA.ziele.length){
    wurzel.appendChild(seite(null, null, h('div', { class:'leer', text:'Noch kein Ziel gefasst.' })));
  } else {
    const gitter = h('div', { class:'kacheln', id:'zielkacheln' });
    DATA.ziele.forEach(z => {
      gitter.appendChild(h('button', {
        class:'kachel', onclick: () => zeigeFenster({ art:'ziel', id:z.id }),
      },
        h('h3', { text: z.name || 'Ohne Namen' }),
        h('div', { class:'zeile', text: erledigtVon(z.schritte) + ' / ' + z.schritte.length + ' SCHRITTE' }),
        fortschritt(z.schritte),
        z.text ? h('div', { class:'vorschau', text: z.text }) : null));
    });
    wurzel.appendChild(gitter);
  }
  wurzel.appendChild(h('button', {
    class:'neu', id:'neuesziel', text:'+ ZIEL',
    onclick: async () => {
      const name = (prompt('Wie heißt das Ziel?') || '').trim();
      if (!name) return;
      DATA.ziele.push({ id: neueId('z'), name, text:'', schritte: [] });
      await persist(); render();
    },
  }));
  return wurzel;
}

/* ---------- 5. Verantwortung ---------- */

function pflichtenSeite(){
  const wurzel = h('div', {});
  if (!DATA.pflichten.length){
    wurzel.appendChild(seite(null, null,
      h('div', { class:'leer', text:'Noch kein Bereich. Hier gehört hinein, wofür du geradestehst.' })));
  } else {
    const gitter = h('div', { class:'kacheln', id:'pflichtkacheln' });
    DATA.pflichten.forEach(p => {
      gitter.appendChild(h('button', {
        class:'kachel', onclick: () => zeigeFenster({ art:'pflicht', id:p.id }),
      },
        h('h3', { text: p.name || 'Ohne Namen' }),
        p.notiz ? h('div', { class:'vorschau', text: p.notiz })
                : h('div', { class:'zeile', text:'OHNE NOTIZ' })));
    });
    wurzel.appendChild(gitter);
  }
  wurzel.appendChild(h('button', {
    class:'neu', id:'neuepflicht', text:'+ BEREICH',
    onclick: async () => {
      const name = (prompt('Wofür stehst du gerade?') || '').trim();
      if (!name) return;
      DATA.pflichten.push({ id: neueId('f'), name, notiz:'' });
      await persist(); render();
    },
  }));
  return wurzel;
}

/* ---------- 4. To Do ----------
   Die Woche läuft von oben nach unten, ein Blatt je Tag. Der
   Monatszettel sitzt als farbiger Knopf darüber. */

function todoSeite(){
  const wurzel = h('div', {});
  const tage = tageDerWoche(state.woche);
  const von = kurzDatum(tage[0]), bis = kurzDatum(tage[6]);
  const heute = alsSchluessel(new Date());

  wurzel.appendChild(h('div', { class:'wochenkopf' },
    h('button', { class:'knopf still', id:'wochezurueck', text:'‹', onclick: () => { state.woche--; render(); } }),
    h('span', { class:'spanne', id:'wochenspanne', text: von + ' – ' + bis }),
    h('button', { class:'knopf still', id:'wochevor', text:'›', onclick: () => { state.woche++; render(); } })));

  wurzel.appendChild(h('button', {
    class:'monatsknopf', id:'monatsknopf',
    text:'MONATSLISTE · ' + monatsName(tage[3]),
    onclick: () => zeigeFenster({ art:'monat', id: monatsSchluessel(tage[3]) }),
  }));

  tage.forEach((d, i) => {
    const s = alsSchluessel(d);
    const liste = DATA.todo.tage[s] || (DATA.todo.tage[s] = []);
    aufraeumen(liste);
    const blatt = seite(null, null);
    if (s === heute) blatt.classList.add('heute');
    blatt.appendChild(h('div', { class:'tagkopf' },
      h('span', { class:'wt', text: WOCHENTAGE_LANG[i] }),
      h('span', { class:'dat', text: kurzDatum(d) }),
      h('span', { class:'zier', style:'flex:1;height:1px;background:rgba(46,36,24,.28)' }),
      h('span', { class:'dat', text: liste.length ? erledigtVon(liste) + '/' + liste.length : '' })));
    blatt.appendChild(punkteBlock(liste, render, 'Nichts vorgenommen.'));
    blatt.appendChild(h('div', { class:'reihe' },
      h('button', { class:'knopf', 'data-tag': s, text:'+ EINTRAG', onclick: async () => {
        const text = (prompt(WOCHENTAGE_LANG[i] + ' — was steht an?') || '').trim();
        if (!text) return;
        liste.push(neuerPunkt(text));
        await persist(); render();
      }})));
    wurzel.appendChild(blatt);
  });
  return wurzel;
}

function monatsName(d){
  const namen = ['JÄNNER','FEBRUAR','MÄRZ','APRIL','MAI','JUNI','JULI',
                 'AUGUST','SEPTEMBER','OKTOBER','NOVEMBER','DEZEMBER'];
  return namen[d.getMonth()] + ' ' + d.getFullYear();
}

/* ---------- 2. Habits ----------
   Zwei Arten, und sie unterscheiden sich wirklich:

   takt    an festen Wochentagen. Gezeigt wird die laufende Woche;
           Tage, die nicht vorgesehen sind, ruhen.
   anzahl  so und so oft je Woche oder Monat. Gezeigt wird ein
           Zähler; wann genau, ist gleichgültig.                  */

function habitsSeite(){
  const wurzel = h('div', {});
  if (!DATA.habits.length){
    wurzel.appendChild(seite(null, null,
      h('div', { class:'leer', text:'Noch keine Gewohnheit. Eine mit festen Tagen oder eine, die nur oft genug vorkommen soll.' })));
  }

  DATA.habits.forEach(hb => {
    const blatt = seite(hb.name || 'Ohne Namen', habitMeta(hb));
    blatt.appendChild(hb.art === 'takt' ? taktFelder(hb) : anzahlZaehler(hb));
    blatt.appendChild(h('div', { class:'reihe' },
      knopf('BEARBEITEN', () => zeigeFenster({ art:'habit', id:hb.id }), 'still')));
    wurzel.appendChild(blatt);
  });

  wurzel.appendChild(h('button', {
    class:'neu', id:'neuerhabit', text:'+ GEWOHNHEIT',
    onclick: async () => {
      const name = (prompt('Welche Gewohnheit?') || '').trim();
      if (!name) return;
      const neu = { id: neueId('h'), name, art:'takt', tage:[0,2,4], anzahl:2,
                    zeitraum:'monat', lohn:1, log:{} };
      DATA.habits.push(neu);
      await persist();
      zeigeFenster({ art:'habit', id:neu.id });
    },
  }));
  return wurzel;
}

function habitMeta(hb){
  return hb.art === 'takt'
    ? hb.tage.slice().sort().map(t => WOCHENTAGE[t]).join(' ')
    : hb.anzahl + '× PRO ' + (hb.zeitraum === 'woche' ? 'WOCHE' : 'MONAT');
}

function taktFelder(hb){
  const reihe = h('div', { class:'takt' });
  tageDerWoche(0).forEach((d, i) => {
    const s = alsSchluessel(d);
    const vorgesehen = hb.tage.includes(i);
    const getan = !!hb.log[s];
    reihe.appendChild(h('button', {
      class:'tagfeld' + (getan ? ' an' : '') + (vorgesehen ? '' : ' ruht'),
      disabled: !vorgesehen,
      'data-tag': s,
      onclick: () => habitSchalten(hb, s),
    },
      h('span', { text: WOCHENTAGE[i] }),
      h('span', { class:'zeichen', text: getan ? '✓' : (vorgesehen ? '·' : '') })));
  });
  return reihe;
}

/* Bei der Anzahl-Art zählt nur, wie oft im Zeitraum abgehakt wurde.
   Jedes Abhaken bekommt einen eigenen Schlüssel, damit sich auch
   mehrere am selben Tag zählen lassen. */
function zeitraumSchluessel(hb){
  const d = new Date();
  if (hb.zeitraum === 'woche') return 'w' + alsSchluessel(wochenstart(0));
  return 'm' + monatsSchluessel(d);
}

function standImZeitraum(hb){
  const p = zeitraumSchluessel(hb);
  return Object.keys(hb.log).filter(k => k.startsWith(p + '#') && hb.log[k]).length;
}

function anzahlZaehler(hb){
  const stand = standImZeitraum(hb);
  const reihe = h('div', { class:'zaehler' });
  reihe.appendChild(h('button', {
    class:'rundbtn', id:'minus_' + hb.id, text:'−', 'aria-label':'Eines wegnehmen',
    disabled: stand === 0,
    onclick: () => habitZaehlen(hb, -1),
  }));
  reihe.appendChild(h('span', { class:'stand', text: stand + ' / ' + hb.anzahl }));
  reihe.appendChild(h('span', { class:'von',
    text: hb.zeitraum === 'woche' ? 'DIESE WOCHE' : 'DIESEN MONAT' }));
  reihe.appendChild(h('button', {
    class:'rundbtn', id:'plus_' + hb.id, text:'+', 'aria-label':'Eines dazu',
    onclick: () => habitZaehlen(hb, 1),
  }));
  return reihe;
}

async function habitSchalten(hb, tag){
  if (hb.log[tag]){ delete hb.log[tag]; muenzen(-hb.lohn); }
  else { hb.log[tag] = true; muenzen(hb.lohn); }
  await persist();
  render();
}

async function habitZaehlen(hb, richtung){
  const p = zeitraumSchluessel(hb);
  const vorhanden = Object.keys(hb.log).filter(k => k.startsWith(p + '#') && hb.log[k]).sort();
  if (richtung > 0){
    hb.log[p + '#' + Date.now().toString(36)] = true;
    muenzen(hb.lohn);
  } else {
    if (!vorhanden.length) return;
    delete hb.log[vorhanden[vorhanden.length - 1]];
    muenzen(-hb.lohn);
  }
  await persist();
  render();
}

/* ---------- 6. Belohnungen ---------- */

function belohnungenSeite(){
  const wurzel = h('div', {});
  if (!DATA.belohnungen.length){
    wurzel.appendChild(seite(null, null,
      h('div', { class:'leer', text:'Noch keine Belohnung. Wofür soll sich das Sammeln lohnen?' })));
  } else {
    const gitter = h('div', { class:'kacheln', id:'lohnkacheln' });
    DATA.belohnungen.forEach(b => {
      const zuteuer = DATA.muenzen < b.preis;
      const kachel = h('button', {
        class:'kachel' + (zuteuer ? ' zuteuer' : ''),
        onclick: () => zeigeFenster({ art:'belohnung', id:b.id }),
      });
      kachel.appendChild(b.bild
        ? h('img', { class:'lohnbild', 'data-ref': b.bild, alt:'' })
        : h('div', { class:'lohnbild fehlt', text:'◈' }));
      kachel.appendChild(h('h3', { text: b.name || 'Ohne Namen', style:'margin-top:7px' }));
      if (b.text) kachel.appendChild(h('div', { class:'vorschau', text: b.text }));
      kachel.appendChild(h('div', { class:'preis' },
        h('span', { class:'muenze' }), h('span', { class:'zahl', text: b.preis })));
      gitter.appendChild(kachel);
    });
    wurzel.appendChild(gitter);
  }
  wurzel.appendChild(h('button', {
    class:'neu', id:'neuebelohnung', text:'+ BELOHNUNG',
    onclick: async () => {
      const name = (prompt('Wie heißt die Belohnung?') || '').trim();
      if (!name) return;
      const neu = { id: neueId('l'), name, text:'', preis:10, bild:null };
      DATA.belohnungen.push(neu);
      await persist();
      zeigeFenster({ art:'belohnung', id:neu.id });
    },
  }));
  return wurzel;
}

/* ---------- Die Fenster hinter den Kacheln ---------- */

function zeigeFenster(was){
  state.offen = was;
  const bau = {
    bereich: fensterBereich, ziel: fensterZiel, pflicht: fensterPflicht,
    monat: fensterMonat, habit: fensterHabit, belohnung: fensterBelohnung,
  }[was.art];
  if (bau) bau(was.id);
}

/* Ein Namensfeld mit Umbenennen und Löschen — in vier Fenstern gleich. */
function fensterKopfAktionen(blatt, objekt, liste, bezeichnung){
  blatt.appendChild(h('div', { class:'reihe' },
    knopf('UMBENENNEN', async () => {
      const neu = (prompt(bezeichnung + ' umbenennen:', objekt.name) || '').trim();
      if (!neu) return;
      objekt.name = neu;
      await persist(); fensterAuffrischen();
    }, 'still'),
    knopf('LÖSCHEN', async () => {
      if (!confirm(bezeichnung + ' „' + objekt.name + '" mitsamt Inhalt löschen?')) return;
      const i = liste.indexOf(objekt);
      if (i >= 0) liste.splice(i, 1);
      await persist(); fensterSchliessen();
    }, 'warn')));
}

function fensterBereich(id){
  const b = DATA.vorsaetze.bereiche.find(x => x.id === id);
  if (!b) return fensterSchliessen();
  fensterOeffnen(b.name || 'Lebensbereich', blatt => {
    blatt.appendChild(h('div', { class:'seitenmeta',
      text: erledigtVon(b.punkte) + ' VON ' + b.punkte.length + ' ERLEDIGT' }));
    blatt.appendChild(fortschritt(b.punkte));
    blatt.appendChild(punkteBlock(b.punkte, fensterAuffrischen, 'Noch kein Vorsatz.'));
    blatt.appendChild(h('div', { class:'reihe' },
      knopf('+ VORSATZ', async () => {
        const t = (prompt('Was nimmst du dir vor?') || '').trim();
        if (!t) return;
        b.punkte.push(neuerPunkt(t));
        await persist(); fensterAuffrischen();
      }, 'voll')));
    fensterKopfAktionen(blatt, b, DATA.vorsaetze.bereiche, 'Lebensbereich');
  });
}

function fensterZiel(id){
  const z = DATA.ziele.find(x => x.id === id);
  if (!z) return fensterSchliessen();
  fensterOeffnen(z.name || 'Ziel', blatt => {
    // Oben der freie Text, darunter die Schritte — so gewünscht.
    const feld = h('textarea', { id:'zieltext', placeholder:'Worum geht es? Was heißt „erreicht"?' });
    feld.value = z.text;
    feld.oninput = () => { z.text = feld.value; };
    feld.onchange = () => persist();
    blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'NOTIZ' }), feld));

    blatt.appendChild(h('div', { class:'seitenmeta', style:'margin-top:12px',
      text: erledigtVon(z.schritte) + ' VON ' + z.schritte.length + ' SCHRITTEN' }));
    blatt.appendChild(fortschritt(z.schritte));
    blatt.appendChild(punkteBlock(z.schritte, fensterAuffrischen, 'Noch kein Teilziel.'));
    blatt.appendChild(h('div', { class:'reihe' },
      knopf('+ TEILZIEL', async () => {
        const t = (prompt('Welcher Schritt?') || '').trim();
        if (!t) return;
        z.schritte.push(neuerPunkt(t));
        await persist(); fensterAuffrischen();
      }, 'voll')));
    fensterKopfAktionen(blatt, z, DATA.ziele, 'Ziel');
  });
}

function fensterPflicht(id){
  const p = DATA.pflichten.find(x => x.id === id);
  if (!p) return fensterSchliessen();
  fensterOeffnen(p.name || 'Bereich', blatt => {
    const feld = h('textarea', { id:'pflichtnotiz', placeholder:'Was ist hier zu wissen?', style:'min-height:190px' });
    feld.value = p.notiz;
    feld.oninput = () => { p.notiz = feld.value; };
    feld.onchange = () => persist();
    blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'NOTIZEN' }), feld));
    fensterKopfAktionen(blatt, p, DATA.pflichten, 'Bereich');
  });
}

function fensterMonat(schluessel){
  const liste = DATA.todo.monate[schluessel] || (DATA.todo.monate[schluessel] = []);
  aufraeumen(liste);
  const d = new Date(schluessel + '-15T12:00:00');
  fensterOeffnen('Monatsliste · ' + monatsName(d), blatt => {
    blatt.appendChild(h('div', { class:'seitenmeta',
      text: erledigtVon(liste) + ' VON ' + liste.length + ' ERLEDIGT' }));
    blatt.appendChild(punkteBlock(liste, fensterAuffrischen, 'Für diesen Monat steht nichts an.'));
    blatt.appendChild(h('div', { class:'reihe' },
      knopf('+ EINTRAG', async () => {
        const t = (prompt('Was steht diesen Monat an?') || '').trim();
        if (!t) return;
        liste.push(neuerPunkt(t));
        await persist(); fensterAuffrischen();
      }, 'voll')));
  });
}

function fensterHabit(id){
  const hb = DATA.habits.find(x => x.id === id);
  if (!hb) return fensterSchliessen();
  fensterOeffnen(hb.name || 'Gewohnheit', blatt => {
    const art = h('div', { class:'reihe' });
    [['takt','FESTE TAGE'], ['anzahl','SO OFT']].forEach(([wert, beschriftung]) => {
      art.appendChild(h('button', {
        class:'knopf' + (hb.art === wert ? ' voll' : ' still'), text: beschriftung,
        onclick: async () => { hb.art = wert; await persist(); fensterAuffrischen(); },
      }));
    });
    blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'ART' }), art));

    if (hb.art === 'takt'){
      const tage = h('div', { class:'takt', id:'taktwahl' });
      WOCHENTAGE.forEach((name, i) => {
        tage.appendChild(h('button', {
          class:'tagfeld' + (hb.tage.includes(i) ? ' an' : ''), 'data-wt': i, text: name,
          onclick: async () => {
            hb.tage = hb.tage.includes(i) ? hb.tage.filter(t => t !== i) : hb.tage.concat(i);
            await persist(); fensterAuffrischen();
          },
        }));
      });
      blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'AN DIESEN TAGEN' }), tage));
    } else {
      const wie = h('input', { type:'number', id:'habitanzahl', min:'1', value: hb.anzahl });
      wie.onchange = async () => {
        const n = parseInt(wie.value, 10);
        if (Number.isFinite(n) && n > 0){ hb.anzahl = n; await persist(); fensterAuffrischen(); }
      };
      const raum = h('select', { id:'habitzeitraum' });
      [['woche','pro Woche'], ['monat','pro Monat']].forEach(([w, t]) => {
        const o = h('option', { value:w, text:t });
        if (hb.zeitraum === w) o.setAttribute('selected', '');
        raum.appendChild(o);
      });
      raum.onchange = async () => { hb.zeitraum = raum.value; await persist(); fensterAuffrischen(); };
      blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'WIE OFT' }),
        h('div', { class:'reihe', style:'align-items:center;margin-top:0' }, wie, raum)));
    }

    const lohn = h('input', { type:'number', id:'habitlohn', min:'0', value: hb.lohn });
    lohn.onchange = async () => {
      const n = parseInt(lohn.value, 10);
      if (Number.isFinite(n) && n >= 0){ hb.lohn = n; await persist(); fensterAuffrischen(); }
    };
    blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'ZAUBERMÜNZEN JE MAL' }), lohn));

    fensterKopfAktionen(blatt, hb, DATA.habits, 'Gewohnheit');
  });
}

function fensterBelohnung(id){
  const b = DATA.belohnungen.find(x => x.id === id);
  if (!b) return fensterSchliessen();
  fensterOeffnen(b.name || 'Belohnung', blatt => {
    blatt.appendChild(b.bild
      ? h('img', { class:'lohnbild', 'data-ref': b.bild, alt:'', style:'max-height:210px' })
      : h('div', { class:'lohnbild fehlt', style:'height:150px;aspect-ratio:auto', text:'◈' }));

    const text = h('textarea', { id:'lohntext', placeholder:'Wofür genau?', style:'min-height:70px' });
    text.value = b.text;
    text.oninput = () => { b.text = text.value; };
    text.onchange = () => persist();
    blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'BESCHREIBUNG' }), text));

    const preis = h('input', { type:'number', id:'lohnpreis', min:'1', value: b.preis });
    preis.onchange = async () => {
      const n = parseInt(preis.value, 10);
      if (Number.isFinite(n) && n > 0){ b.preis = n; await persist(); fensterAuffrischen(); }
    };
    blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'PREIS IN ZAUBERMÜNZEN' }), preis));

    const reichtNicht = DATA.muenzen < b.preis;
    blatt.appendChild(h('div', { class:'reihe' },
      h('button', {
        class:'knopf voll', id:'einloesen', disabled: reichtNicht,
        text: reichtNicht ? 'NOCH ' + (b.preis - DATA.muenzen) + ' MÜNZEN' : 'EINLÖSEN',
        onclick: async () => {
          if (DATA.muenzen < b.preis) return;
          if (!confirm('„' + b.name + '" für ' + b.preis + ' Zaubermünzen einlösen?')) return;
          muenzen(-b.preis);
          await persist();
          alert('Eingelöst. Viel Freude damit.');
          fensterSchliessen();
        },
      }),
      knopf(b.bild ? 'BILD TAUSCHEN' : '+ BILD', () => lohnBildWaehlen(b), 'still')));

    fensterKopfAktionen(blatt, b, DATA.belohnungen, 'Belohnung');
  });
}

/* Ein PNG mit durchsichtigem Grund bleibt PNG — als JPEG umgewandelt
   bekäme es einen schwarzen Hintergrund. */
async function lohnBildWaehlen(b){
  try {
    const gewaehlt = await Picker.pick('GALLERY');
    if (!gewaehlt) return;
    const alt = b.bild;
    const ext = (gewaehlt.mime || '').includes('png') ? 'png' : 'jpg';
    b.bild = await Store.saveImage(gewaehlt.base64, ext);
    if (alt) await Store.deleteImage(alt);
    await persist();
    fensterAuffrischen();
  } catch(e){
    alert('Das Bild ließ sich nicht laden.');
  }
}

/* ---------- Einstellungen ---------- */

function einstellungenSeite(){
  const wurzel = h('div', {});

  const farben = h('div', { class:'abschnitt' }, h('h3', { text:'FARBE' }));
  const wahl = h('div', { class:'swatches', id:'swatches', role:'group', 'aria-label':'Primärfarbe wählen' });
  ['teal','orange','pink'].forEach(t => {
    wahl.appendChild(h('button', {
      class:'swatch' + (DATA.theme === t ? ' on' : ''), 'data-theme':t,
      'aria-label':'Primärfarbe ' + t,
      onclick: async () => {
        DATA.theme = t;
        document.documentElement.dataset.theme = t;
        await persist(); render();
      },
    }, h('i', {})));
  });
  farben.appendChild(wahl);
  wurzel.appendChild(farben);

  const muenz = h('div', { class:'abschnitt' }, h('h3', { text:'ZAUBERMÜNZEN' }));
  muenz.appendChild(h('p', { class:'hinweis',
    text:'Im Beutel liegen ' + DATA.muenzen + '. Jeder abgehakte Punkt bringt, was an ihm steht — '
       + 'eine, wenn du nichts anderes einstellst. Tipp im Text auf die Zahl hinter einem Punkt, um sie zu ändern.' }));
  wurzel.appendChild(muenz);

  const sicherung = h('div', { class:'abschnitt' }, h('h3', { text:'SICHERUNG' }));
  sicherung.appendChild(h('p', { class:'hinweis', text: DATA.backup
    ? 'Zuletzt gesichert am ' + new Date(DATA.backup.at).toLocaleDateString('de-AT')
      + ' — der Ordner „' + BACKUP_DIR + '" in den Dokumenten wird beim Schließen nachgezogen.'
    : 'Beim Schließen der App wird der Ordner „' + BACKUP_DIR + '" in den Dokumenten nachgezogen.' }));
  sicherung.appendChild(h('div', { class:'reihe' },
    h('button', { class:'knopf', id:'backupbtn', text:'JETZT SICHERN', onclick: async () => {
      alert(await runAutoBackup(true));
      render();
    }}),
    h('button', { class:'knopf still', id:'restorebtn', text:'ZUSAMMENFÜHREN', onclick: restoreAusOrdner })));
  wurzel.appendChild(sicherung);

  wurzel.appendChild(h('div', { class:'reihe' },
    knopf('← ZURÜCK', () => go('todo'), 'still')));
  return wurzel;
}

/* ---------- Sicherung ----------
   Dieselbe Form wie in den übrigen B-Apps: ein Ordner im
   Dokumente-Ordner, beim Schließen werden nur die Änderungen
   nachgezogen. Wiederherstellen führt zusammen, es ersetzt nicht. */

const BACKUP_DIR = 'ToBo-Backup';
let backupLaeuft = false;

async function runAutoBackup(manuell){
  if (!Store.isNative) return 'Im Browser gibt es keinen Dokumente-Ordner.';
  if (backupLaeuft) return 'Läuft bereits.';
  backupLaeuft = true;
  try {
    const FS = Capacitor.Plugins.Filesystem;
    try {
      const st = await FS.checkPermissions();
      if (st && st.publicStorage !== 'granted') await FS.requestPermissions();
    } catch(e){ /* ältere Plugin-Versionen kennen die Methoden nicht */ }

    const gebraucht = allImageRefs();
    const gesichert = new Set((DATA.backup && DATA.backup.files) || []);

    await FS.writeFile({
      path: BACKUP_DIR + '/vault.json', directory:'DOCUMENTS', encoding:'utf8',
      data: JSON.stringify(vaultPayload()), recursive: true,
    });

    let neu = 0;
    for (const ref of gebraucht){
      if (gesichert.has(ref)) continue;
      try {
        const b64 = await Store.readImageBase64(ref);
        await FS.writeFile({ path: BACKUP_DIR + '/images/' + ref, directory:'DOCUMENTS',
                             data: b64, recursive: true });
        neu++;
      } catch(e){ console.warn('Bild nicht sicherbar:', ref); }
    }

    let weg = 0;
    const jetzt = new Set(gebraucht);
    for (const ref of gesichert){
      if (jetzt.has(ref)) continue;
      try { await FS.deleteFile({ path: BACKUP_DIR + '/images/' + ref, directory:'DOCUMENTS' }); } catch(e){}
      weg++;
    }

    DATA.backup = { at: new Date().toISOString(), files: gebraucht };
    await persist();
    return neu || weg ? `Backup nachgezogen: ${neu} neu, ${weg} entfernt.` : 'Backup war schon aktuell.';
  } catch(e){
    console.warn('Backup fehlgeschlagen', e);
    return 'Backup fehlgeschlagen.';
  } finally {
    backupLaeuft = false;
  }
}

/* Erkannt wird über die Kennungen. Nichts wird überschrieben, nichts
   gelöscht — es kommt nur dazu, was hier fehlt. Die Münzen bleiben,
   wie sie hier stehen: was ausgegeben wurde, ist ausgegeben. */
function mergeVault(manifest){
  const bericht = { bereiche:0, habits:0, ziele:0, pflichten:0, belohnungen:0, punkte:0 };
  const fremd = adoptVault(manifest);

  const dazu = (hier, dort, zaehler) => {
    const bekannt = new Set(hier.map(x => x.id));
    dort.forEach(x => { if (!bekannt.has(x.id)){ hier.push(x); bericht[zaehler]++; } });
  };
  dazu(DATA.vorsaetze.bereiche, fremd.vorsaetze.bereiche, 'bereiche');
  dazu(DATA.habits, fremd.habits, 'habits');
  dazu(DATA.ziele, fremd.ziele, 'ziele');
  dazu(DATA.pflichten, fremd.pflichten, 'pflichten');
  dazu(DATA.belohnungen, fremd.belohnungen, 'belohnungen');

  for (const [wo, quelle] of [['tage', fremd.todo.tage], ['monate', fremd.todo.monate]]){
    Object.entries(quelle).forEach(([k, liste]) => {
      const hier = DATA.todo[wo][k] || (DATA.todo[wo][k] = []);
      const bekannt = new Set(hier.map(p => p.id));
      liste.forEach(p => { if (!bekannt.has(p.id)){ hier.push(p); bericht.punkte++; } });
    });
  }
  return bericht;
}

function berichtText(b, bilder){
  const teile = [];
  if (b.bereiche) teile.push(b.bereiche + ' Lebensbereiche');
  if (b.habits) teile.push(b.habits + ' Gewohnheiten');
  if (b.ziele) teile.push(b.ziele + ' Ziele');
  if (b.pflichten) teile.push(b.pflichten + ' Bereiche');
  if (b.belohnungen) teile.push(b.belohnungen + ' Belohnungen');
  if (b.punkte) teile.push(b.punkte + ' To-dos');
  if (bilder) teile.push(bilder + ' Bilder');
  return teile.length ? 'Ergänzt: ' + teile.join(', ') + '.' : 'Nichts zu ergänzen — alles war schon da.';
}

async function restoreAusOrdner(){
  if (!Store.isNative){ alert('Im Browser gibt es keinen Dokumente-Ordner.'); return; }
  const btn = document.getElementById('restorebtn');
  if (btn) btn.textContent = 'LESE BACKUP-ORDNER…';
  try {
    const FS = Capacitor.Plugins.Filesystem;
    const roh = await FS.readFile({ path: BACKUP_DIR + '/vault.json', directory:'DOCUMENTS', encoding:'utf8' });
    const manifest = JSON.parse(roh.data);
    if (!manifest || typeof manifest !== 'object') throw new Error('KEIN_MANIFEST');

    const vorhanden = new Set(allImageRefs());
    const bericht = mergeVault(manifest);

    let n = 0;
    for (const name of allImageRefs()){
      if (vorhanden.has(name)) continue;
      try {
        const bild = await FS.readFile({ path: BACKUP_DIR + '/images/' + name, directory:'DOCUMENTS' });
        await Store.saveImageRaw(name, bild.data);
        n++;
      } catch(e){ console.warn('Bild fehlt im Backup:', name); }
    }

    await persist();
    alert(berichtText(bericht, n));
    render();
  } catch(e){
    console.warn(e);
    alert('Im Dokumente-Ordner liegt kein lesbares Backup.');
    if (btn) btn.textContent = 'ZUSAMMENFÜHREN';
  }
}

/* ---------- Start ---------- */

function bindeRahmen(){
  document.querySelectorAll('#nav .tab').forEach(t => { t.onclick = () => go(t.dataset.screen); });
  document.getElementById('settingsbtn').onclick = () => go('einstellungen');
  document.getElementById('beutel').onclick = () => go('belohnungen');
}

async function start(){
  bindeRahmen();
  try {
    DATA = adoptVault(await Store.loadVault());
  } catch(e){
    console.warn('Bestand nicht lesbar', e);
    DATA = leererVault();
  }
  document.documentElement.dataset.theme = DATA.theme;
  render();

  if (Store.isNative && window.Capacitor.Plugins.App){
    Capacitor.Plugins.App.addListener('pause', () => { runAutoBackup(false); });
  }
}

start();
