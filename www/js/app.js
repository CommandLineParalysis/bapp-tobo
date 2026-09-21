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
const WOCHENTAGE_LANG = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

function leererVault(){
  return {
    muenzen: 0,
    vorsaetze: { jahr: new Date().getFullYear(), bereiche: [] },
    habits: [],
    ziele: [],
    skills: [],
    todo: { tage: {}, monate: {} },
    pflichten: [],
    belohnungen: [],
    getilgt: [],
    modus: 'hell',
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
    ziele: DATA.ziele, skills: DATA.skills, todo: DATA.todo, pflichten: DATA.pflichten,
    belohnungen: DATA.belohnungen, getilgt: DATA.getilgt, modus: DATA.modus, backup: DATA.backup,
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
    fertigSeit: typeof z.fertigSeit === 'string' ? z.fertigSeit : null,
  }));

  /* Ein Skill trägt mehrere Listen, jede mit eigenem Namen — das ist
     der Unterschied zum Ziel, das genau eine Liste hat. */
  v.skills = (saved.skills || []).map(k => ({
    id: k.id || neueId('k'), name: String(k.name || ''), text: String(k.text || ''),
    listen: (k.listen || []).map(l => ({
      id: l.id || neueId('li'), name: String(l.name || ''), punkte: punkteListe(l.punkte),
    })),
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

  v.getilgt = (saved.getilgt || []).filter(x => typeof x === 'string');
  v.modus = saved.modus === 'dunkel' ? 'dunkel' : 'hell';
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

/* ---------- Was von selbst verschwindet ----------

   Ein erreichtes Ziel bleibt dreißig Tage stehen und wird dann
   getilgt. Vergangene Wochen im To-Do fallen mit dem Wochenwechsel
   weg. Beides landet in DATA.getilgt, damit ein altes Backup es nicht
   wieder hereinträgt — sonst wäre „gelöscht" nur eine Frage der Zeit
   bis zur nächsten Wiederherstellung.                              */

const HALTEFRIST_TAGE = 30;

function zielFertig(z){ return z.schritte.length > 0 && z.schritte.every(p => p.erledigt); }

/* Setzt oder löscht den Zeitpunkt, seit dem ein Ziel erreicht ist.
   Zurück kommt, ob sich etwas geändert hat. */
function zielStandPflegen(){
  let geaendert = false;
  DATA.ziele.forEach(z => {
    const fertig = zielFertig(z);
    if (fertig && !z.fertigSeit){ z.fertigSeit = new Date().toISOString(); geaendert = true; }
    if (!fertig && z.fertigSeit){ z.fertigSeit = null; geaendert = true; }
  });
  return geaendert;
}

function tageSeit(iso){
  const d = new Date(iso);
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function tilgen(id){
  if (!DATA.getilgt.includes(id)) DATA.getilgt.push(id);
}

/* Läuft beim Start. Zurück kommt ein Bericht, oder null. */
function abgelaufenesRaeumen(){
  const bericht = { ziele:0, tage:0 };

  DATA.ziele = DATA.ziele.filter(z => {
    if (z.fertigSeit && tageSeit(z.fertigSeit) >= HALTEFRIST_TAGE){
      tilgen(z.id);
      bericht.ziele++;
      return false;
    }
    return true;
  });

  const diesewoche = alsSchluessel(wochenstart(0));
  Object.keys(DATA.todo.tage).forEach(k => {
    if (k >= diesewoche) return;
    DATA.todo.tage[k].forEach(pt => tilgen(pt.id));
    delete DATA.todo.tage[k];
    bericht.tage++;
  });

  return (bericht.ziele || bericht.tage) ? bericht : null;
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
  zielStandPflegen();
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

/* Die Zaubermünze. Gezeichnet ist sie einmal im index.html; hier wird
   nur noch darauf verwiesen, damit Kopfzeile, Preis und Leiste
   garantiert dasselbe Stück zeigen. */
function muenzZeichen(klasse){
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', klasse || 'muenze');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#muenzform');
  svg.appendChild(use);
  return svg;
}

/* Ein kleines Arkanzeichen, wie es in der Vorlage neben dem Text
   steht. Es liegt hinter dem Inhalt und nimmt keine Tipps an — Zierrat
   darf die Bedienung nicht in die Quere kommen. */
const EMBLEME = [
  'M20 3 L37 20 L20 37 L3 20 Z M20 9 L31 20 L20 31 L9 20 Z',
  'M20 4 A16 16 0 1 0 20 36 A16 16 0 1 0 20 4 Z M8 20 H32 M20 8 V32',
  'M5 12 H35 M5 20 H35 M5 28 H35 M12 5 V35 M28 5 V35',
  'M20 4 L34 28 H6 Z M20 14 L27 26 H13 Z',
  'M6 6 H34 V34 H6 Z M6 6 L34 34 M34 6 L6 34',
];
function emblem(i){
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'emblem');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('aria-hidden', 'true');
  const pfad = document.createElementNS(NS, 'path');
  pfad.setAttribute('d', EMBLEME[Math.abs(i) % EMBLEME.length]);
  pfad.setAttribute('fill', 'none');
  pfad.setAttribute('stroke', 'currentColor');
  pfad.setAttribute('stroke-width', '1.6');
  svg.appendChild(pfad);
  return svg;
}

function knopf(text, bei, art){
  return h('button', { class: 'knopf' + (art ? ' ' + art : ''), onclick: bei, text });
}

let emblemZaehler = 0;
function seite(titel, meta, ...inhalt){
  const s = h('div', { class: 'seite' });
  s.appendChild(emblem(emblemZaehler++));
  if (titel){
    s.appendChild(h('div', { class: 'seitentitel' },
      h('span', { text: titel }), h('span', { class: 'zier' }),
      meta ? h('span', { class: 'seitenmeta', text: meta }) : null));
  }
  inhalt.flat().forEach(k => { if (k) s.appendChild(k); });
  return s;
}

/* Eine abhakbare Zeile. Der Lohn ist antippbar, das Löschen auch. */
function punktZeile(p, beiAenderung, zusatz){
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
  const lohnfeld = h('span', {
    class: 'lohn', title: 'Zaubermünzen für diesen Punkt',
    onclick: async () => {
      const neu = parseInt(prompt('Wie viele Zaubermünzen ist das wert?', p.lohn), 10);
      if (!Number.isFinite(neu) || neu < 0) return;
      // Ist der Punkt schon abgehakt, wird die Differenz nachgezahlt.
      if (p.erledigt) muenzen(neu - p.lohn);
      p.lohn = neu;
      await persist(); beiAenderung();
    },
  }, muenzZeichen('muenze'), h('span', { text: String(p.lohn) }));
  zeile.appendChild(lohnfeld);
  if (zusatz) zeile.appendChild(zusatz);
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

function punkteBlock(liste, beiAenderung, platzhalter, zusatzFuer){
  aufraeumen(liste);
  const block = h('div', {});
  if (!liste.length) block.appendChild(h('div', { class:'leer', text: platzhalter || 'Noch nichts eingetragen.' }));
  liste.forEach(p => block.appendChild(punktZeile(p, beiAenderung, zusatzFuer && zusatzFuer(p))));
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

/* Gebrochene Schrift liest sich in Versalien schlecht — deshalb hier
   gemischt statt durchgehend groß. */
const TITEL = {
  vorsaetze:'Jahresvorsätze', habits:'Habits', ziele:'Ziele', skills:'Skills',
  todo:'To Do', pflichten:'Verantwortung', belohnungen:'Belohnungen',
  einstellungen:'Einstellungen',
};

function go(screen){
  state.screen = screen;
  if (screen !== 'todo') state.woche = 0;
  render();
}

function render(){
  const main = document.getElementById('main');
  main.textContent = '';
  emblemZaehler = 0;
  const bauer = {
    vorsaetze: vorsaetzeSeite, habits: habitsSeite, ziele: zieleSeite, skills: skillsSeite,
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

  const n = v.bereiche.length;
  const radius = n > 6 ? 37 : 34;
  const feld = h('div', { class:'kreisfeld', id:'kreisfeld' });
  feld.appendChild(zirkel(v.bereiche.map((_, i) => winkelFuer(i, n)), radius));
  emblemZaehler++;

  v.bereiche.forEach((b, i) => {
    const w = winkelFuer(i, n);
    feld.appendChild(h('button', {
      class:'knoten',
      style:'left:' + (50 + Math.cos(w)*radius) + '%;top:' + (50 + Math.sin(w)*radius) + '%',
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
    class:'neu', id:'neuerbereich', text:'+ Lebensbereich',
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

function winkelFuer(i, n){ return (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2; }

/* Der Magiezirkel unter den Knoten: zwei Ringe, ein Zeichenkranz,
   ein Pentagramm und je eine Speiche zu jedem Lebensbereich. Alles
   gezeichnet, nichts nachgeladen. */
const ZIRKELZEICHEN = ['☉','☾','☿','♀','♁','♃','♄','⚹','✶','⚶','☌','✷'];

function zirkel(winkel, radius){
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'zirkel');
  svg.setAttribute('viewBox', '0 0 100 100');
  const el = (name, attrs) => {
    const e = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    svg.appendChild(e);
    return e;
  };

  /* Kräftigere Linien als zuvor, und die Töne gestaffelt: außen das
     Mittelblau, innen das hellere Türkis. Die Farben stehen als Klassen
     im Stylesheet, damit sie im dunklen Modus mitwandern. */
  [[radius + 9, 'stark', 2.2], [radius + 5.5, 'fein', 1.1],
   [radius - 12, 'fein', 1.4], [13, 'stark', 1.8]].forEach(([r, klasse, dicke]) => {
    el('circle', { cx:50, cy:50, r, fill:'none', class: klasse,
                   'stroke-width': dicke, 'vector-effect':'non-scaling-stroke' });
  });

  // Der Zeichenkranz zwischen den beiden äußeren Ringen
  const kranz = radius + 7.2;
  ZIRKELZEICHEN.forEach((z, i) => {
    const w = (i / ZIRKELZEICHEN.length) * Math.PI * 2 - Math.PI / 2;
    const t = el('text', {
      x: 50 + Math.cos(w) * kranz, y: 50 + Math.sin(w) * kranz,
      class:'zeichen', 'font-size': 4.2, 'text-anchor':'middle', 'dominant-baseline':'central',
    });
    t.textContent = z;
  });

  /* Das Pentagramm liegt im Ring um die Mitte, nicht in ihr: unter dem
     Jahresknoten wäre es schlicht nicht zu sehen. Seine Spitzen sitzen
     auf dem inneren Kreis. */
  const stern = radius - 12;
  const p = [];
  for (let i = 0; i < 5; i++){
    const w = (i * 2 / 5) * Math.PI * 2 - Math.PI / 2;
    p.push((50 + Math.cos(w) * stern).toFixed(2) + ',' + (50 + Math.sin(w) * stern).toFixed(2));
  }
  el('polygon', { points: p.join(' '), fill:'none', class:'stern', 'stroke-width':1.6,
                  'stroke-linejoin':'round', 'vector-effect':'non-scaling-stroke' });

  // Die Speichen zu den Knoten, mit einem Ring dort, wo sie den
  // inneren Kreis durchstoßen
  winkel.forEach(w => {
    el('line', { x1: 50 + Math.cos(w) * 13, y1: 50 + Math.sin(w) * 13,
                 x2: 50 + Math.cos(w) * radius, y2: 50 + Math.sin(w) * radius,
                 class:'speiche', 'stroke-width':1.3, 'vector-effect':'non-scaling-stroke' });
    el('circle', { cx: 50 + Math.cos(w) * (radius - 12), cy: 50 + Math.sin(w) * (radius - 12),
                   r:2.2, fill:'none', class:'fein', 'stroke-width':1.3,
                   'vector-effect':'non-scaling-stroke' });
  });
  // Ein paar Strahlen zwischen den Speichen, wie in der Vorlage
  for (let i = 0; i < 24; i++){
    const w = (i / 24) * Math.PI * 2;
    el('line', { x1: 50 + Math.cos(w) * (radius + 5.5), y1: 50 + Math.sin(w) * (radius + 5.5),
                 x2: 50 + Math.cos(w) * (radius + 9), y2: 50 + Math.sin(w) * (radius + 9),
                 class:'fein', 'stroke-width': i % 2 ? .7 : 1.4, 'vector-effect':'non-scaling-stroke' });
  }
  return svg;
}

/* ---------- 3. Ziele ---------- */

function zieleSeite(){
  const wurzel = h('div', {});
  if (!DATA.ziele.length){
    wurzel.appendChild(seite(null, null, h('div', { class:'leer', text:'Noch kein Ziel gefasst.' })));
  } else {
    const gitter = h('div', { class:'kacheln', id:'zielkacheln' });
    DATA.ziele.forEach(z => {
      const rest = z.fertigSeit ? HALTEFRIST_TAGE - tageSeit(z.fertigSeit) : null;
      gitter.appendChild(h('button', {
        class:'kachel' + (z.fertigSeit ? ' erreicht' : ''),
        onclick: () => zeigeFenster({ art:'ziel', id:z.id }),
      },
        emblem(emblemZaehler++),
        h('h3', { text: z.name || 'Ohne Namen' }),
        h('div', { class:'zeile', text: z.fertigSeit
          ? 'ERREICHT · NOCH ' + Math.max(0, rest) + ' TAGE'
          : erledigtVon(z.schritte) + ' / ' + z.schritte.length + ' SCHRITTE' }),
        fortschritt(z.schritte),
        z.text ? h('div', { class:'vorschau', text: z.text }) : null));
    });
    wurzel.appendChild(gitter);
  }
  wurzel.appendChild(h('button', {
    class:'neu', id:'neuesziel', text:'+ Ziel',
    onclick: async () => {
      const name = (prompt('Wie heißt das Ziel?') || '').trim();
      if (!name) return;
      DATA.ziele.push({ id: neueId('z'), name, text:'', schritte: [] });
      await persist(); render();
    },
  }));
  return wurzel;
}

/* ---------- 4. Skills ----------
   Ein Regal, in dem für jeden Skill ein Buch steht. Die Rücken sind
   verschieden breit und hoch, damit das Regal nach Sammlung aussieht
   und nicht nach Tabelle; Breite und Farbe hängen an der Kennung,
   damit sie beim Neuzeichnen nicht springen. */

const BUCHFARBEN = [
  ['#7A2E2A','#C8A44A'], ['#1F4F63','#9FD8E2'], ['#3E5D2E','#D2C07A'],
  ['#4A2C5C','#C9A6DE'], ['#8A4B1E','#EBC98A'], ['#23404F','#79C2CF'],
];

/* FNV-1a statt der einfachen Summe: bei kurzen, ähnlichen Kennungen
   ("k1", "k2", …) lagen die oberen Bits der Summe alle gleich, und
   damit bekamen alle Bücher denselben Rücken. */
function streuung(text){
  let h = 2166136261;
  for (let i = 0; i < text.length; i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function buchZuschnitt(id){
  const h = streuung(id);
  return {
    breite: 22 + (h % 4) * 5,
    hoehe: 78 + ((h >>> 5) % 5) * 6,
    farben: BUCHFARBEN[(h >>> 11) % BUCHFARBEN.length],
    neigung: ((h >>> 17) % 5) - 2,
  };
}

function skillsSeite(){
  const wurzel = h('div', {});
  const regal = h('div', { class:'regal', id:'regal' });

  // Die Bücher werden auf Bretter verteilt, damit das Regal mitwächst.
  const proBrett = 5;
  const bretter = [];
  DATA.skills.forEach((k, i) => {
    if (i % proBrett === 0) bretter.push([]);
    bretter[bretter.length - 1].push(k);
  });
  // Mindestens zwei Bretter: ein einzelnes Brett sieht nach Ablage aus,
  // zwei nach Regal.
  while (bretter.length < 2) bretter.push([]);

  bretter.forEach((buecher, bi) => {
    const brett = h('div', { class:'brett' });
    const reihe = h('div', { class:'buchreihe' });
    buecher.forEach(k => {
      const z = buchZuschnitt(k.id);
      const offen = k.listen.reduce((n, l) => n + l.punkte.length, 0);
      const fertig = k.listen.reduce((n, l) => n + erledigtVon(l.punkte), 0);
      reihe.appendChild(h('button', {
        class:'buch', 'data-skill': k.id,
        style:'width:' + z.breite + 'px;height:' + z.hoehe + 'px;' +
              '--ruecken:' + z.farben[0] + ';--praegung:' + z.farben[1] + ';' +
              'transform:rotate(' + z.neigung + 'deg)',
        title: k.name + ' — ' + fertig + '/' + offen,
        onclick: () => zeigeFenster({ art:'skill', id:k.id }),
      },
        h('span', { class:'titel', text: k.name || '…' }),
        h('span', { class:'marke', text: offen ? fertig + '/' + offen : '' })));
    });
    // Auf dem letzten Brett steht die Deko neben den Büchern.
    if (bi === bretter.length - 1) reihe.appendChild(regalDeko());
    brett.appendChild(reihe);
    brett.appendChild(h('div', { class:'brettkante' }));
    regal.appendChild(brett);
  });

  wurzel.appendChild(regal);
  if (!DATA.skills.length){
    wurzel.appendChild(seite(null, null,
      h('div', { class:'leer', text:'Noch kein Buch im Regal. Was willst du lernen?' })));
  }
  wurzel.appendChild(h('button', {
    class:'neu', id:'neuerskill', text:'+ Skill',
    onclick: async () => {
      const name = (prompt('Welcher Skill?') || '').trim();
      if (!name) return;
      const neu = { id: neueId('k'), name, text:'',
                    listen: [{ id: neueId('li'), name:'Grundlagen', punkte: [] }] };
      DATA.skills.push(neu);
      await persist();
      zeigeFenster({ art:'skill', id:neu.id });
    },
  }));
  return wurzel;
}

/* Die drei Stücke, die im Regal stehen: eine Topfpflanze, eine
   Pergamentrolle und ein Frosch. Reiner Zierrat, nicht anklickbar. */
function regalDeko(){
  const deko = h('div', { class:'deko', 'aria-hidden':'true' });
  deko.innerHTML = `
    <svg viewBox="0 0 34 64" class="pflanze">
      <path d="M17 44 C17 30 9 28 7 18 C15 21 17 30 17 36" fill="none" stroke="var(--mittel)" stroke-width="2.4"/>
      <path d="M17 44 C17 32 25 29 28 20 C20 23 18 31 18 38" fill="none" stroke="var(--hell)" stroke-width="2.4"/>
      <circle cx="7" cy="17" r="3.1" fill="var(--schimmer)"/>
      <circle cx="28" cy="19" r="2.6" fill="var(--schimmer)"/>
      <path d="M7 44 H27 L25 60 H9 Z" fill="#8A5B2E"/>
      <path d="M6 42 H28 V47 H6 Z" fill="#A9743E"/>
    </svg>
    <svg viewBox="0 0 46 30" class="rolle">
      <rect x="5" y="7" width="36" height="16" rx="2" fill="#E9DCB8"/>
      <path d="M9 12 H33 M9 15.5 H30 M9 19 H27" stroke="#8B7A55" stroke-width="1.2"/>
      <circle cx="5" cy="15" r="5" fill="#CDBA8E"/><circle cx="41" cy="15" r="5" fill="#CDBA8E"/>
      <circle cx="5" cy="15" r="1.7" fill="#8B7A55"/><circle cx="41" cy="15" r="1.7" fill="#8B7A55"/>
    </svg>
    <svg viewBox="0 0 40 32" class="frosch">
      <path d="M4 30 C4 14 11 7 20 7 C29 7 36 14 36 30 Z" fill="#5A3A2E"/>
      <ellipse cx="20" cy="25" rx="10" ry="6" fill="#E8DCC0"/>
      <circle cx="12" cy="9" r="5" fill="#5A3A2E"/><circle cx="28" cy="9" r="5" fill="#5A3A2E"/>
      <circle cx="12" cy="8" r="3.2" fill="#E8913C"/><circle cx="28" cy="8" r="3.2" fill="#E8913C"/>
      <circle cx="12" cy="8" r="1.3" fill="#20120C"/><circle cx="28" cy="8" r="1.3" fill="#20120C"/>
      <path d="M14 20 H26" stroke="#20120C" stroke-width="1.6"/>
    </svg>`;
  return deko;
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
        emblem(emblemZaehler++),
        h('h3', { text: p.name || 'Ohne Namen' }),
        p.notiz ? h('div', { class:'vorschau', text: p.notiz })
                : h('div', { class:'zeile', text:'OHNE NOTIZ' })));
    });
    wurzel.appendChild(gitter);
  }
  wurzel.appendChild(h('button', {
    class:'neu', id:'neuepflicht', text:'+ Bereich',
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
    text:'Monatsliste · ' + monatsName(tage[3]),
    onclick: () => zeigeFenster({ art:'monat', id: monatsSchluessel(tage[3]) }),
  }));

  tage.forEach((d, i) => {
    const s = alsSchluessel(d);
    const liste = DATA.todo.tage[s] || (DATA.todo.tage[s] = []);
    aufraeumen(liste);
    const blatt = seite(null, null);
    if (s === heute){
      blatt.classList.add('heute');
      blatt.appendChild(h('span', { class:'baendchen', 'aria-hidden':'true' }));
    }
    blatt.appendChild(h('div', { class:'tagkopf' },
      h('span', { class:'wt', text: WOCHENTAGE_LANG[i] }),
      h('span', { class:'dat', text: kurzDatum(d) }),
      h('span', { class:'zier', style:'flex:1;height:1px;background:rgba(46,36,24,.28)' }),
      h('span', { class:'dat', text: liste.length ? erledigtVon(liste) + '/' + liste.length : '' })));
    blatt.appendChild(punkteBlock(liste, render, 'Nichts vorgenommen.', pt => h('button', {
      class:'schieben', text:'›', 'aria-label':'Auf morgen verschieben',
      title:'Auf ' + WOCHENTAGE_LANG[(i + 1) % 7] + ' verschieben',
      onclick: () => punktVerschieben(pt, s),
    })));
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

/* Einen Eintrag auf den nächsten Tag schieben. Die Kennung bleibt, der
   Haken auch — verschoben wird die Aufgabe, nicht ihr Zustand. */
async function punktVerschieben(p, vonSchluessel){
  const quelle = DATA.todo.tage[vonSchluessel] || [];
  const i = quelle.indexOf(p);
  if (i < 0) return;
  const d = new Date(vonSchluessel + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  const ziel = alsSchluessel(d);
  quelle.splice(i, 1);
  (DATA.todo.tage[ziel] || (DATA.todo.tage[ziel] = [])).push(p);
  await persist();
  render();
}

function monatsName(d){
  const namen = ['Jänner','Februar','März','April','Mai','Juni','Juli',
                 'August','September','Oktober','November','Dezember'];
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
    const blatt = seite(null, null);
    blatt.appendChild(h('button', {
      class:'seitentitel', 'data-habit': hb.id,
      style:'background:none;border:none;padding:0;width:100%;cursor:pointer;text-align:left',
      onclick: () => zeigeFenster({ art:'habit', id:hb.id }),
    },
      h('span', { text: hb.name || 'Ohne Namen' }),
      h('span', { class:'zier' }),
      h('span', { class:'seitenmeta', text: habitMeta(hb) })));
    blatt.appendChild(hb.art === 'takt' ? taktFelder(hb) : anzahlZaehler(hb));
    wurzel.appendChild(blatt);
  });

  wurzel.appendChild(h('button', {
    class:'neu', id:'neuerhabit', text:'+ Gewohnheit',
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

/* ---------- Verlauf seit Beginn der Aufzeichnung ----------
   Bewusst klein gerastert: der Blick soll bei heute bleiben und den
   Verlauf nur nebenbei mitnehmen. */

/* Der erste Tag, an dem überhaupt etwas eingetragen wurde. Die
   Schlüssel sehen je Art anders aus: '2026-09-21' beim Takt,
   'w2026-09-21#ab' oder 'm2026-09#ab' bei der Anzahl. */
function habitBeginn(hb){
  const tage = Object.keys(hb.log).filter(k => hb.log[k]).map(k => {
    const roh = k.replace(/^[wm]/, '').split('#')[0];
    return roh.length === 7 ? roh + '-01' : roh;
  }).sort();
  if (!tage.length) return null;
  const d = new Date(tage[0] + 'T12:00:00');
  return isNaN(d) ? null : d;
}

function habitVerlauf(hb){
  const beginn = habitBeginn(hb);
  if (!beginn) return null;

  if (hb.art === 'takt'){
    // Spalten sind Wochen, Zeilen die sieben Tage.
    const erste = new Date(beginn);
    erste.setDate(erste.getDate() - ((erste.getDay() + 6) % 7));
    const heute = new Date(); heute.setHours(12,0,0,0);
    const wochen = [];
    for (let w = new Date(erste); w <= heute; w.setDate(w.getDate() + 7)){
      const spalte = [];
      for (let i = 0; i < 7; i++){
        const d = new Date(w); d.setDate(w.getDate() + i);
        const s = alsSchluessel(d);
        spalte.push({
          schluessel: s,
          kuenftig: d > heute || d < beginn,
          vorgesehen: hb.tage.includes(i),
          getan: !!hb.log[s],
        });
      }
      wochen.push(spalte);
    }
    return { art:'takt', spalten: wochen, beginn };
  }

  // Bei der Anzahl ist jede Spalte ein Zeitraum.
  const perioden = [];
  const heute = new Date(); heute.setHours(12,0,0,0);
  if (hb.zeitraum === 'woche'){
    const lauf = new Date(beginn);
    lauf.setDate(lauf.getDate() - ((lauf.getDay() + 6) % 7));
    for (; lauf <= heute; lauf.setDate(lauf.getDate() + 7)){
      perioden.push('w' + alsSchluessel(new Date(lauf)));
    }
  } else {
    const lauf = new Date(beginn.getFullYear(), beginn.getMonth(), 15, 12);
    for (; lauf <= heute; lauf.setMonth(lauf.getMonth() + 1)){
      perioden.push('m' + monatsSchluessel(lauf));
    }
  }
  return {
    art:'anzahl', beginn,
    spalten: perioden.map(pr => ({
      schluessel: pr,
      stand: Object.keys(hb.log).filter(k => k.startsWith(pr + '#') && hb.log[k]).length,
    })),
  };
}

function verlaufBlock(hb){
  const v = habitVerlauf(hb);
  if (!v) return h('div', { class:'leer', style:'font-size:18px;padding:12px 6px',
                            text:'Noch nichts aufgezeichnet.' });

  const feld = h('div', { class:'verlauf', id:'verlauf' });
  const gitter = h('div', { class:'verlaufgitter' + (v.art === 'anzahl' ? ' perioden' : '') });

  if (v.art === 'takt'){
    v.spalten.forEach(spalte => spalte.forEach(tag => {
      const klassen = ['zelle'];
      if (tag.getan) klassen.push('getan');
      else if (!tag.kuenftig && tag.vorgesehen) klassen.push('verpasst');
      if (!tag.vorgesehen || tag.kuenftig) klassen.push('ausserhalb');
      gitter.appendChild(h('div', { class: klassen.join(' '), title: tag.schluessel }));
    }));
  } else {
    v.spalten.forEach(pr => {
      const erreicht = pr.stand >= hb.anzahl;
      gitter.appendChild(h('div', {
        class: 'zelle' + (erreicht ? ' getan' : (pr.stand ? '' : ' ausserhalb')),
        title: pr.schluessel.slice(1) + ': ' + pr.stand + ' von ' + hb.anzahl,
        text: pr.stand + '/' + hb.anzahl,
      }));
    });
  }
  feld.appendChild(gitter);

  const seit = v.beginn.toLocaleDateString('de-AT', { day:'2-digit', month:'2-digit', year:'numeric' });
  const gesamt = v.art === 'takt'
    ? v.spalten.flat().filter(t => t.getan).length
    : v.spalten.reduce((n, pr) => n + pr.stand, 0);
  feld.appendChild(h('div', { class:'verlauflegende' },
    h('span', { text: 'SEIT ' + seit }),
    h('span', { text: gesamt + '× GETAN' }),
    h('span', { text: v.spalten.length + (v.art === 'takt' ? ' WOCHEN' : ' ZEITRÄUME') })));
  return feld;
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
        muenzZeichen('muenze'), h('span', { class:'zahl', text: b.preis })));
      gitter.appendChild(kachel);
    });
    wurzel.appendChild(gitter);
  }
  wurzel.appendChild(h('button', {
    class:'neu', id:'neuebelohnung', text:'+ Belohnung',
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
    skill: fensterSkill,
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

function fensterSkill(id){
  const k = DATA.skills.find(x => x.id === id);
  if (!k) return fensterSchliessen();
  fensterOeffnen(k.name || 'Skill', blatt => {
    const feld = h('textarea', { id:'skilltext', placeholder:'Worum geht es? Woran merkst du, dass du es kannst?' });
    feld.value = k.text;
    feld.oninput = () => { k.text = feld.value; };
    feld.onchange = () => persist();
    blatt.appendChild(h('div', { class:'feld' }, h('label', { text:'NOTIZ' }), feld));

    k.listen.forEach(liste => {
      aufraeumen(liste.punkte);
      const kopf = h('div', { class:'listenkopf' },
        h('button', {
          class:'listenname', text: liste.name || 'Ohne Namen',
          onclick: async () => {
            const neu = (prompt('Liste umbenennen:', liste.name) || '').trim();
            if (!neu) return;
            liste.name = neu;
            await persist(); fensterAuffrischen();
          },
        }),
        h('span', { class:'seitenmeta', text: erledigtVon(liste.punkte) + '/' + liste.punkte.length }),
        h('button', {
          class:'weg', text:'×', 'aria-label':'Liste löschen',
          onclick: async () => {
            if (!confirm('Liste „' + liste.name + '" mitsamt Punkten löschen?')) return;
            liste.punkte.filter(pt => pt.erledigt).forEach(pt => muenzen(-pt.lohn));
            k.listen = k.listen.filter(l => l !== liste);
            await persist(); fensterAuffrischen();
          },
        }));
      blatt.appendChild(kopf);
      blatt.appendChild(fortschritt(liste.punkte));
      blatt.appendChild(punkteBlock(liste.punkte, fensterAuffrischen, 'Noch nichts in dieser Liste.'));
      blatt.appendChild(h('div', { class:'reihe' },
        knopf('+ SCHRITT', async () => {
          const t = (prompt(liste.name + ' — welcher Schritt?') || '').trim();
          if (!t) return;
          liste.punkte.push(neuerPunkt(t));
          await persist(); fensterAuffrischen();
        })));
    });

    blatt.appendChild(h('div', { class:'reihe' },
      knopf('+ LISTE', async () => {
        const name = (prompt('Wie heißt die neue Liste?') || '').trim();
        if (!name) return;
        k.listen.push({ id: neueId('li'), name, punkte: [] });
        await persist(); fensterAuffrischen();
      }, 'voll')));

    fensterKopfAktionen(blatt, k, DATA.skills, 'Skill');
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
    blatt.appendChild(h('div', { class:'seitenmeta', text:'VERLAUF SEIT BEGINN' }));
    blatt.appendChild(verlaufBlock(hb));

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

  const licht = h('div', { class:'abschnitt' }, h('h3', { text:'Licht' }));
  licht.appendChild(h('p', { class:'hinweis',
    text: DATA.modus === 'dunkel'
      ? 'Das Buch liegt im Dunkeln. Der Mond oben schaltet zurück aufs Pergament.'
      : 'Pergament bei Tageslicht. Der Mond oben legt das Buch ins Dunkel.' }));
  licht.appendChild(h('div', { class:'reihe' },
    knopf(DATA.modus === 'dunkel' ? '☀ PERGAMENT' : '☾ DUNKEL', modusSchalten)));
  wurzel.appendChild(licht);

  const muenz = h('div', { class:'abschnitt' }, h('h3', { text:'Zaubermünzen' }));
  muenz.appendChild(h('p', { class:'hinweis',
    text:'Im Beutel liegen ' + DATA.muenzen + '. Jeder abgehakte Punkt bringt, was an ihm steht — '
       + 'eine, wenn du nichts anderes einstellst. Tipp im Text auf die Zahl hinter einem Punkt, um sie zu ändern.' }));
  wurzel.appendChild(muenz);

  const sicherung = h('div', { class:'abschnitt' }, h('h3', { text:'Sicherung' }));
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
  const bericht = { bereiche:0, habits:0, ziele:0, skills:0, pflichten:0, belohnungen:0, punkte:0 };
  const fremd = adoptVault(manifest);

  const getilgt = new Set(DATA.getilgt);
  const dazu = (hier, dort, zaehler) => {
    const bekannt = new Set(hier.map(x => x.id));
    dort.forEach(x => {
      if (bekannt.has(x.id) || getilgt.has(x.id)) return;
      hier.push(x);
      bericht[zaehler]++;
    });
  };
  dazu(DATA.vorsaetze.bereiche, fremd.vorsaetze.bereiche, 'bereiche');
  dazu(DATA.habits, fremd.habits, 'habits');
  dazu(DATA.ziele, fremd.ziele, 'ziele');
  dazu(DATA.skills, fremd.skills, 'skills');
  dazu(DATA.pflichten, fremd.pflichten, 'pflichten');
  dazu(DATA.belohnungen, fremd.belohnungen, 'belohnungen');

  const diesewoche = alsSchluessel(wochenstart(0));
  for (const [wo, quelle] of [['tage', fremd.todo.tage], ['monate', fremd.todo.monate]]){
    Object.entries(quelle).forEach(([k, liste]) => {
      if (wo === 'tage' && k < diesewoche) return;   // vergangene Wochen sind erledigt
      const hier = DATA.todo[wo][k] || (DATA.todo[wo][k] = []);
      const bekannt = new Set(hier.map(p => p.id));
      liste.forEach(p => {
        if (bekannt.has(p.id) || getilgt.has(p.id)) return;
        hier.push(p);
        bericht.punkte++;
      });
    });
  }
  return bericht;
}

function berichtText(b, bilder){
  const teile = [];
  if (b.bereiche) teile.push(b.bereiche + ' Lebensbereiche');
  if (b.habits) teile.push(b.habits + ' Gewohnheiten');
  if (b.ziele) teile.push(b.ziele + ' Ziele');
  if (b.skills) teile.push(b.skills + ' Skills');
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

async function modusSchalten(){
  DATA.modus = DATA.modus === 'dunkel' ? 'hell' : 'dunkel';
  modusAnwenden();
  await persist();
  render();
}

function modusAnwenden(){
  document.documentElement.dataset.modus = DATA.modus;
  const btn = document.getElementById('modusbtn');
  btn.textContent = DATA.modus === 'dunkel' ? '☀' : '☾';
  btn.setAttribute('aria-label', DATA.modus === 'dunkel' ? 'Heller Modus' : 'Dunkler Modus');
}

function bindeRahmen(){
  document.querySelectorAll('#nav .tab').forEach(t => { t.onclick = () => go(t.dataset.screen); });
  document.getElementById('settingsbtn').onclick = () => go('einstellungen');
  document.getElementById('beutel').onclick = () => go('belohnungen');
  document.getElementById('modusbtn').onclick = modusSchalten;
}

async function start(){
  bindeRahmen();
  try {
    DATA = adoptVault(await Store.loadVault());
  } catch(e){
    console.warn('Bestand nicht lesbar', e);
    DATA = leererVault();
  }
  modusAnwenden();
  zielStandPflegen();
  const geraeumt = abgelaufenesRaeumen();
  if (geraeumt) await persist();
  render();

  if (Store.isNative && window.Capacitor.Plugins.App){
    Capacitor.Plugins.App.addListener('pause', () => { runAutoBackup(false); });
  }
}

start();
