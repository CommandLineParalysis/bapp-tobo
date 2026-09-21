#!/usr/bin/env python3
"""Zeichnet die Icon-Vorlagen von To Bo nach resources/.

   Ein Grimoire: Pergamentseiten mit Goldrahmen, ein Siegel auf der
   rechten Seite, ein Lesebändchen und eine Flamme darüber.

   Alle Töne entstehen als Mischung zweier Farben aus der Palette des
   B-Appiverse — nur so bleibt `npm run icons:check` grün.

   Aufruf aus dem Wurzelverzeichnis der App:  python3 werkzeug/icon-zeichnen.py
"""

import math
from PIL import Image, ImageDraw, ImageFilter

# Die verbindliche Palette des B-Appiverse
TRAEGER = (5, 7, 10)
GRUND   = (42, 19, 47)
TEAL    = (48, 243, 207)
ORANGE  = (254, 142, 62)
PINK    = (255, 61, 158)
WEISS   = (243, 233, 245)

def misch(a, b, t):
    """Abgeleitete Töne entstehen ausschließlich als Mischung zweier
       Palettenfarben — nur so bleibt das Farbschema prüfbar."""
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

PERGAMENT      = misch(WEISS, ORANGE, .34)    # helle Seite
PERGAMENT_TIEF = misch(WEISS, ORANGE, .52)    # Schattenseite am Falz
EINBAND        = misch(TRAEGER, PINK, .46)    # dunkelroter Deckel
EINBAND_HELL   = misch(TRAEGER, PINK, .62)
TINTE          = misch(TRAEGER, PINK, .22)    # Schrift und Zirkel
GOLD           = ORANGE
BAND           = misch(TRAEGER, PINK, .78)    # Lesebändchen
FLAMME_KERN    = misch(TEAL, WEISS, .72)
FLAMME         = TEAL
FLAMME_SPITZE  = misch(TEAL, PINK, .55)

S, SS = 1024, 4

def zeichne(groesse, hintergrund, mit_traeger):
    g = groesse * SS
    bild = Image.new('RGBA', (g, g), hintergrund)
    m = g / 1024.0
    d = ImageDraw.Draw(bild)

    if mit_traeger:
        r = 96 * m
        d.rounded_rectangle([r, r, g - r, g - r], radius=64 * m, fill=TRAEGER)

    # --- Der Schein hinter dem Buch ---
    schein = Image.new('RGBA', (g, g), (0, 0, 0, 0))
    ImageDraw.Draw(schein).ellipse(
        [g*0.33, g*0.06, g*0.67, g*0.40], fill=misch(TEAL, TRAEGER, .55) + (190,))
    bild.alpha_composite(schein.filter(ImageFilter.GaussianBlur(int(34 * m))))

    mitte = g * 0.5
    # --- Der Einband, leicht größer als die Seiten ---
    oben_aussen, oben_innen = g*0.300, g*0.340
    unten_aussen, unten_innen = g*0.690, g*0.730
    links, rechts = g*0.135, g*0.865

    for seite in (-1, 1):
        aussen = mitte + seite * (mitte - links)
        d.polygon([(mitte, oben_innen - 14*m), (aussen, oben_aussen - 14*m),
                   (aussen, unten_aussen + 26*m), (mitte, unten_innen + 26*m)],
                  fill=EINBAND)
    # Die Kante des Buchblocks
    d.polygon([(links, unten_aussen + 8*m), (mitte, unten_innen + 8*m),
               (rechts, unten_aussen + 8*m), (rechts, unten_aussen + 26*m),
               (mitte, unten_innen + 26*m), (links, unten_aussen + 26*m)],
              fill=EINBAND_HELL)

    # --- Die beiden Seiten ---
    rand = 26 * m
    for seite in (-1, 1):
        aussen = mitte + seite * (mitte - links - rand)
        innen = mitte + seite * 8 * m
        ecken = [(innen, oben_innen), (aussen, oben_aussen),
                 (aussen, unten_aussen), (innen, unten_innen)]
        d.polygon(ecken, fill=PERGAMENT)
        # Goldrahmen, doppelt wie in der Vorlage
        for zug, dicke in ((30 * m, 5 * m), (46 * m, 2.5 * m)):
            schrumpf = [(x + (mitte - x) * 0 + (zug if seite > 0 else -zug) * (-1 if x == aussen else 1) * 0, y)
                        for x, y in ecken]
            innen_rahmen = [
                (innen + seite * zug, oben_innen + zug),
                (aussen - seite * zug, oben_aussen + zug),
                (aussen - seite * zug, unten_aussen - zug),
                (innen + seite * zug, unten_innen - zug)]
            d.polygon(innen_rahmen, outline=GOLD, width=int(dicke))

    # Der Falz in der Mitte
    d.polygon([(mitte - 9*m, oben_innen), (mitte + 9*m, oben_innen),
               (mitte + 9*m, unten_innen), (mitte - 9*m, unten_innen)],
              fill=PERGAMENT_TIEF)

    # --- Linke Seite: Schriftzeilen, genau zwischen den Goldrahmen ---
    zeile_x0 = links + rand + 74*m
    zeile_x1 = mitte - 74*m
    oben_feld = oben_aussen + 78*m
    unten_feld = unten_aussen - 78*m
    zeilen = 6
    abstand = (unten_feld - oben_feld) / (zeilen - 1)
    for i in range(zeilen):
        y = oben_feld + i * abstand
        kurz = (78*m if i % 3 == 2 else 0)
        # Die Seite kippt nach außen: jede Zeile folgt der Neigung.
        versatz = (oben_innen - oben_aussen) * (1 - i / (zeilen - 1)) * 0.5
        d.rounded_rectangle([zeile_x0, y + versatz, zeile_x1 - kurz, y + versatz + 15*m],
                            radius=8*m, fill=TINTE)

    # --- Rechte Seite: das Siegel ---
    zx, zy, zr = mitte + (rechts - mitte) * 0.50, (oben_innen + unten_innen) / 2 - 6*m, g*0.115
    d.ellipse([zx-zr, zy-zr, zx+zr, zy+zr], fill=TINTE)
    d.ellipse([zx-zr*.86, zy-zr*.86, zx+zr*.86, zy+zr*.86], outline=GOLD, width=int(5*m))
    p = []
    for i in range(5):
        w = (i * 2 / 5) * math.pi * 2 - math.pi / 2
        p.append((zx + math.cos(w) * zr * .62, zy + math.sin(w) * zr * .62))
    d.polygon(p, outline=GOLD, width=int(6*m))
    d.ellipse([zx-zr*.26, zy-zr*.26, zx+zr*.26, zy+zr*.26], fill=GOLD)
    for i in range(8):
        w = (i / 8) * math.pi * 2
        px, py = zx + math.cos(w) * zr * .94, zy + math.sin(w) * zr * .94
        d.ellipse([px-5*m, py-5*m, px+5*m, py+5*m], fill=GOLD)

    # --- Das Lesebändchen ---
    bx = mitte
    d.polygon([(bx - 26*m, unten_innen + 18*m), (bx + 26*m, unten_innen + 18*m),
               (bx + 26*m, g*0.868), (bx, g*0.828), (bx - 26*m, g*0.868)], fill=BAND)

    # --- Die Flamme über dem Buch ---
    # Ein Tropfen mit leicht geschwungenen Flanken: eine gerade Raute
    # sah nach Kristall aus, nicht nach Feuer.
    fx, fy = mitte, g*0.205
    def flammenform(breite, hoehe, neigung):
        # Stützstellen der Silhouette: unten schmal, Bauch bei knapp
        # einem Drittel, dann lang auslaufend. Ein gleichmäßiger Tropfen
        # sah nach Wasser aus, nicht nach Feuer.
        profil = [(0.00, .30), (0.10, .78), (0.28, 1.00), (0.46, .82),
                  (0.62, .56), (0.78, .32), (0.90, .15), (1.00, .0)]
        def weite(t):
            for i in range(len(profil) - 1):
                t0, w0 = profil[i]; t1, w1 = profil[i + 1]
                if t0 <= t <= t1:
                    k = (t - t0) / (t1 - t0)
                    return w0 + (w1 - w0) * k
            return 0.0
        links_s, rechts_s = [], []
        schritte = 40
        for i in range(schritte + 1):
            t = i / schritte
            w = breite * weite(t)
            y = fy + hoehe * 0.42 - t * hoehe * 1.24
            # Die Spitze legt sich zur Seite, wie eine Kerzenflamme im Zug
            versatz = neigung * breite * (t ** 1.8) * 2.4
            links_s.append((fx - w + versatz, y))
            rechts_s.append((fx + w + versatz, y))
        return links_s + rechts_s[::-1]

    d.polygon(flammenform(g*0.050, g*0.190, .34), fill=FLAMME_SPITZE)
    d.polygon(flammenform(g*0.035, g*0.148, .28), fill=FLAMME)
    d.polygon(flammenform(g*0.017, g*0.082, .20), fill=FLAMME_KERN)

    return bild.resize((groesse, groesse), Image.LANCZOS)

zeichne(1024, GRUND + (255,), True).convert('RGB').save('resources/icon.png')

# Das Adaptive Icon wird von Android beschnitten: sichtbar sind nur die
# inneren 72 von 108 Einheiten, verlässlich sogar nur 66. Das Motiv wird
# deshalb verkleinert eingesetzt — sonst fehlt die Flamme.
SICHER = 0.58
voll = zeichne(1024, (0, 0, 0, 0), False)
klein = voll.resize((int(1024 * SICHER), int(1024 * SICHER)), Image.LANCZOS)
vordergrund = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
versatz = (1024 - klein.width) // 2
vordergrund.alpha_composite(klein, (versatz, versatz))
vordergrund.save('resources/icon-foreground.png')
Image.new('RGB', (1024, 1024), GRUND).save('resources/icon-background.png')
sp = Image.new('RGBA', (2732, 2732), GRUND + (255,))
k = voll.resize((900, 900), Image.LANCZOS)
sp.alpha_composite(k, ((2732-900)//2, (2732-900)//2))
sp.convert('RGB').save('resources/splash.png')
print('gezeichnet')
