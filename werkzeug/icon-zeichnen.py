#!/usr/bin/env python3
"""Zeichnet die Icon-Vorlagen von To Bo nach resources/.

   Ein Grimoire: Pergamentseiten mit Goldrahmen, ein Siegel auf der
   rechten Seite, ein Lesebändchen und eine Flamme darüber.

   Alle Töne entstehen als Mischung zweier Farben aus der Palette des
   B-Appiverse — nur so bleibt `npm run icons:check` grün.

   Aufruf aus dem Wurzelverzeichnis der App:  python3 werkzeug/icon-zeichnen.py
"""

import math
from PIL import Image, ImageDraw

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
GOLD           = ORANGE
BAND           = misch(TRAEGER, PINK, .78)    # Lesebändchen, der warme Akzent
# Petrol: dunkles Teal, gestaffelt. Der Grund bleibt das Violett der
# Familie; petrol ist das Buch — Einband, Rücken und Tinte.
EINBAND        = misch(TRAEGER, TEAL, .40)    # Deckel und Rücken
EINBAND_HELL   = misch(TRAEGER, TEAL, .56)    # Schnittkante des Buchblocks
TINTE          = misch(TRAEGER, TEAL, .20)    # Schrift und Siegel

S, SS = 1024, 4

def zeichne(groesse, hintergrund, mit_traeger):
    g = groesse * SS
    bild = Image.new('RGBA', (g, g), hintergrund)
    m = g / 1024.0
    d = ImageDraw.Draw(bild)

    if mit_traeger:
        r = 96 * m
        d.rounded_rectangle([r, r, g - r, g - r], radius=64 * m, fill=TRAEGER)

    mitte = g * 0.5
    # --- Der Einband, leicht größer als die Seiten ---
    oben_aussen, oben_innen = g*0.232, g*0.276
    unten_aussen, unten_innen = g*0.694, g*0.738
    links, rechts = g*0.120, g*0.880

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

    # --- Linke Seite: Schriftzeilen ---
    # Die Seite kippt nach außen. Waagrechte Zeilen sahen darauf
    # aufgeklebt aus; sie laufen deshalb parallel zu Ober- und
    # Unterkante der Seite.
    seite_links = -1
    aussen_l = mitte + seite_links * (mitte - links - rand)
    innen_l = mitte + seite_links * 8 * m
    neigung = (oben_aussen - oben_innen) / (aussen_l - innen_l)

    def hoehe_bei(x, anteil):
        """y auf der Seite: anteil 0 ist die Ober-, 1 die Unterkante."""
        oben = oben_innen + neigung * (x - innen_l)
        unten = unten_innen + neigung * (x - innen_l)
        return oben + (unten - oben) * anteil

    x_aussen = aussen_l + 74 * m
    x_innen = innen_l - 74 * m
    zeilen = 6
    dicke = 15 * m
    for i in range(zeilen):
        anteil = 0.19 + i * (0.62 / (zeilen - 1))
        kurz = (86 * m if i % 3 == 2 else 0)
        xa, xi = x_aussen, x_innen - kurz
        ya, yi = hoehe_bei(xa, anteil), hoehe_bei(xi, anteil)
        d.polygon([(xa, ya), (xi, yi), (xi, yi + dicke), (xa, ya + dicke)], fill=TINTE)

    # --- Rechte Seite: das Siegel ---
    zx, zy, zr = mitte + (rechts - mitte) * 0.50, (oben_innen + unten_innen) / 2 - 6*m, g*0.115
    d.ellipse([zx-zr, zy-zr, zx+zr, zy+zr], fill=TINTE)
    d.ellipse([zx-zr*.86, zy-zr*.86, zx+zr*.86, zy+zr*.86], outline=GOLD, width=int(5*m))
    # Ein Haken im Siegel: das Abhaken ist der Punkt der App.
    hd = zr * 0.62
    d.line([(zx - hd*0.78, zy + hd*0.02), (zx - hd*0.18, zy + hd*0.60),
            (zx + hd*0.80, zy - hd*0.62)],
           fill=GOLD, width=int(zr*0.30), joint='curve')
    for i in range(8):
        w = (i / 8) * math.pi * 2
        px, py = zx + math.cos(w) * zr * .94, zy + math.sin(w) * zr * .94
        d.ellipse([px-5*m, py-5*m, px+5*m, py+5*m], fill=GOLD)

    # --- Das Lesebändchen ---
    bx = mitte
    d.polygon([(bx - 28*m, unten_innen + 18*m), (bx + 28*m, unten_innen + 18*m),
               (bx + 28*m, g*0.886), (bx, g*0.844), (bx - 28*m, g*0.886)], fill=BAND)

    return bild.resize((groesse, groesse), Image.LANCZOS)

zeichne(1024, GRUND + (255,), True).convert('RGB').save('resources/icon.png')

# Das Adaptive Icon wird von Android beschnitten: sichtbar sind nur die
# inneren 72 von 108 Einheiten, verlässlich sogar nur 66. Das Motiv wird
# deshalb verkleinert eingesetzt — sonst fehlt die Flamme.
SICHER = 0.74
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
