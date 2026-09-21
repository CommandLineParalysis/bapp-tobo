/* ============================================================
   storage.js — die gemeinsame Speicherschicht der B-Apps.

   Aus @bappiverse/scaffold kopiert. NICHT hier bearbeiten:
   Änderungen gehören ins Scaffold, dann `npm run sync:ui`.

   Zwei Betriebsarten, gleiche Schnittstelle nach außen:

   1. Auf dem Handy (Capacitor):
      - Bilder werden als echte .jpg-Dateien geschrieben, in den
        app-privaten Datenordner (Directory.Data). Kein anderer
        App kommt dort ran, und beim Deinstallieren wird alles
        mitgelöscht.
      - Die Metadaten (Titel, Tags, Ordner, Notizen, Challenges)
        liegen als vault.json daneben.

   2. Im Browser (zum Testen am Rechner):
      - Bilder als Blobs in IndexedDB, Metadaten ebenfalls.
      - Dadurch funktioniert die App auch ohne Handy, und du bist
        nicht mehr an das 5-MB-Limit von localStorage gebunden.

   Nach außen gibt es nur diese Funktionen:
      Store.loadVault()            -> {items, customTags, challenges}
      Store.saveVault(data)        -> speichert die Metadaten
      Store.saveImage(base64)      -> schreibt ein Bild, gibt eine Referenz zurück
      Store.imageUrl(ref)          -> anzeigbare URL für ein gespeichertes Bild
      Store.deleteImage(ref)
      Store.isNative               -> true, wenn wir auf dem Handy laufen
   ============================================================ */

const Store = (() => {

  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
                      && window.Capacitor.isNativePlatform());

  /* Der Name der Datenbank im Browser. Jede B-App bekommt ihre eigene,
     sonst teilen sich zwei Apps auf demselben Rechner einen Bestand.
     Gesetzt wird er im index.html: <html data-app="...">. */
  const APP_NAME = (document.documentElement.dataset.app || 'bapp');

  const IMAGE_DIR = 'images';
  const VAULT_FILE = 'vault.json';
  const DIRECTORY = 'DATA'; // app-privater Speicher

  function newId(){
    return 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  /* -------- Variante A: Handy, echtes Dateisystem -------- */

  const native = {
    async loadVault(){
      const Filesystem = Capacitor.Plugins.Filesystem;
      try {
        const res = await Filesystem.readFile({
          path: VAULT_FILE, directory: DIRECTORY, encoding: 'utf8',
        });
        return JSON.parse(res.data);
      } catch (e) {
        return null; // Datei existiert noch nicht -> erster Start
      }
    },

    async saveVault(data){
      const Filesystem = Capacitor.Plugins.Filesystem;
      await Filesystem.writeFile({
        path: VAULT_FILE, directory: DIRECTORY, encoding: 'utf8',
        data: JSON.stringify(data), recursive: true,
      });
    },

    async saveImage(base64, ext){
      const Filesystem = Capacitor.Plugins.Filesystem;
      const ref = newId() + '.' + (ext || 'jpg');
      await Filesystem.writeFile({
        path: IMAGE_DIR + '/' + ref,
        directory: DIRECTORY,
        data: base64,          // reines Base64, ohne data:-Präfix
        recursive: true,
      });
      return ref;
    },

    async saveImageRaw(ref, base64){
      const Filesystem = Capacitor.Plugins.Filesystem;
      await Filesystem.writeFile({
        path: IMAGE_DIR + '/' + ref, directory: DIRECTORY,
        data: base64, recursive: true,
      });
    },

    async readImageBase64(ref){
      const Filesystem = Capacitor.Plugins.Filesystem;
      const res = await Filesystem.readFile({
        path: IMAGE_DIR + '/' + ref, directory: DIRECTORY,
      });
      return res.data; // ohne encoding-Angabe liefert das Plugin Base64
    },

    async imageUrl(ref){
      const Filesystem = Capacitor.Plugins.Filesystem;
      const { uri } = await Filesystem.getUri({
        path: IMAGE_DIR + '/' + ref, directory: DIRECTORY,
      });
      // wandelt file:// in eine URL um, die die WebView anzeigen darf
      return Capacitor.convertFileSrc(uri);
    },

    async deleteImage(ref){
      const Filesystem = Capacitor.Plugins.Filesystem;
      try {
        await Filesystem.deleteFile({ path: IMAGE_DIR + '/' + ref, directory: DIRECTORY });
      } catch(e) { /* schon weg, egal */ }
    },
  };

  /* -------- Variante B: Browser, IndexedDB -------- */

  let dbPromise = null;
  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(APP_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  function idbGet(store, key){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const r = tx.objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }
  function idbPut(store, key, value){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const r = tx.objectStore(store).put(value, key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }));
  }
  function idbDelete(store, key){
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const r = tx.objectStore(store).delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }));
  }

  /* Bilder werden als ArrayBuffer abgelegt, nicht als Blob.
     Blobs in IndexedDB sind in älteren WebViews eine bekannte
     Fehlerquelle, und rohe Puffer überstehen jedes Klonen. Der
     Blob wird erst beim Anzeigen erzeugt. */
  function base64ToBytes(base64){
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToBase64(bytes){
    let bin = '';
    const chunk = 0x8000; // stückweise, sonst überläuft der Aufrufstapel
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function mimeForExt(ref){
    const ext = String(ref).split('.').pop().toLowerCase();
    return { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp' }[ext] || 'image/jpeg';
  }
  function asBytes(stored){
    if (stored instanceof Uint8Array) return stored;
    if (stored instanceof ArrayBuffer) return new Uint8Array(stored);
    if (stored && stored.buffer) return new Uint8Array(stored.buffer);
    throw new Error('UNLESBAR');
  }

  const objectUrls = new Map(); // ref -> blob-URL, damit wir nicht dauernd neue erzeugen

  const web = {
    async loadVault(){
      const v = await idbGet('meta', 'vault');
      return v || null;
    },
    async saveVault(data){
      await idbPut('meta', 'vault', data);
    },
    async saveImage(base64, ext){
      const ref = newId() + '.' + (ext || 'jpg');
      await idbPut('images', ref, base64ToBytes(base64));
      return ref;
    },
    async saveImageRaw(ref, base64){
      await idbPut('images', ref, base64ToBytes(base64));
    },
    async readImageBase64(ref){
      const stored = await idbGet('images', ref);
      if (!stored) throw new Error('NICHT_GEFUNDEN');
      return bytesToBase64(asBytes(stored));
    },
    async imageUrl(ref){
      if (objectUrls.has(ref)) return objectUrls.get(ref);
      const stored = await idbGet('images', ref);
      if (!stored) return null;
      const url = URL.createObjectURL(new Blob([asBytes(stored)], { type: mimeForExt(ref) }));
      objectUrls.set(ref, url);
      return url;
    },
    async deleteImage(ref){
      if (objectUrls.has(ref)) {
        URL.revokeObjectURL(objectUrls.get(ref));
        objectUrls.delete(ref);
      }
      await idbDelete('images', ref);
    },
  };

  const impl = isNative ? native : web;

  return {
    isNative,
    loadVault: () => impl.loadVault(),
    saveVault: (d) => impl.saveVault(d),
    saveImage: (b64, ext) => impl.saveImage(b64, ext),
    saveImageRaw: (ref, b64) => impl.saveImageRaw(ref, b64),
    readImageBase64: (ref) => impl.readImageBase64(ref),
    imageUrl: (ref) => impl.imageUrl(ref),
    deleteImage: (ref) => impl.deleteImage(ref),
    forgetUrl: (ref) => { if (!isNative && objectUrls.has(ref)) { URL.revokeObjectURL(objectUrls.get(ref)); objectUrls.delete(ref); } },
  };
})();

/* ============================================================
   Kamera / Galerie / Dateien.

   Auf dem Handy über das Capacitor-Camera-Plugin (echter
   Berechtigungsdialog von Android, und es liefert auch von
   HEIC-Fotos ein verwertbares JPEG zurück). Im Browser und für
   die FILES-Quelle über ein <input type="file">.

   Gibt {base64, mime} zurück, oder null bei Abbruch.
   ============================================================ */

/* Formate, die wir zum Auswählen anbieten. image/* steht am
   Ende als Auffangnetz, damit Dateiverwaltungen, die die
   einzelnen Typen nicht kennen, trotzdem alle Bilder zeigen. */
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/bmp', 'image/avif', 'image/heic', 'image/heif',
  'image/tiff', 'image/svg+xml', 'image/*',
].join(',');

const Picker = {
  async pick(source){ // source: 'CAMERA' | 'GALLERY' | 'FILES'
    if (Store.isNative && window.Capacitor.Plugins.Camera && source !== 'FILES') {
      try {
        const photo = await Capacitor.Plugins.Camera.getPhoto({
          quality: 92,
          allowEditing: false,
          resultType: 'base64',
          source: source === 'CAMERA' ? 'CAMERA' : 'PHOTOS',
        });
        return {
          base64: photo.base64String,
          mime: 'image/' + (photo.format || 'jpeg'),
        };
      } catch (e) {
        const msg = String((e && e.message) || '');
        if (/denied|permission/i.test(msg)) throw new Error('PERMISSION_DENIED');
        return null; // Nutzerin hat abgebrochen
      }
    }
    return this.pickViaInput(source);
  },

  pickViaInput(source){
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPTED_IMAGE_TYPES;
      if (source === 'CAMERA') input.setAttribute('capture', 'environment');
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return resolve(null);
        // Manche Dateiverwaltungen melden keinen Typ. Dann entscheidet
        // später der Dekodierversuch, ob es ein Bild ist.
        if (file.type && !file.type.startsWith('image/')) {
          return reject(new Error('UNSUPPORTED_TYPE:' + file.type));
        }
        const r = new FileReader();
        r.onload = () => resolve({
          base64: String(r.result).split(',')[1],
          mime: file.type || guessMimeFromName(file.name),
        });
        r.onerror = () => reject(new Error('READ_FAILED'));
        r.readAsDataURL(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },

  /* Eine beliebige Datei einlesen, für die Backup-Wiederherstellung */
  pickFile(accept){
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve({ name: file.name, buffer: r.result });
        r.onerror = () => reject(new Error('READ_FAILED'));
        r.readAsArrayBuffer(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
};

function guessMimeFromName(name){
  const ext = String(name || '').split('.').pop().toLowerCase();
  return {
    jpg:'image/jpeg', jpeg:'image/jpeg', jpe:'image/jpeg',
    png:'image/png', webp:'image/webp', gif:'image/gif',
    bmp:'image/bmp', avif:'image/avif', heic:'image/heic',
    heif:'image/heif', tif:'image/tiff', tiff:'image/tiff',
    svg:'image/svg+xml',
  }[ext] || '';
}
