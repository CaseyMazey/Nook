"""Erzeugt das Grafik-Set "Muster" (assets/themes/muster/).

Platzhalterbilder in genau der Größe, die Nook für eigene Bilder erwartet,
mit eingezeichneten Bereichen: was immer sichtbar bleibt, wo Text liegt,
was am Rand abgeschnitten werden kann. Wer eigene Bilder für ein Theme
macht, lädt das passende Muster herunter und malt darüber.

Aufruf:  python scripts/gen-muster-assets.py
Braucht Pillow. Die Maße müssen zu THEME_IMAGE_SLOTS in js/theme-engine.js
passen.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'themes', 'muster')
os.makedirs(OUT, exist_ok=True)


def font(size, bold=False):
    names = ['segoeuib.ttf' if bold else 'segoeui.ttf', 'arialbd.ttf' if bold else 'arial.ttf', 'DejaVuSans.ttf']
    for n in names:
        for d in [r'C:\Windows\Fonts', '/usr/share/fonts/truetype/dejavu', '/Library/Fonts']:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def dashed_rect(d, box, color, width=4, dash=22, gap=14):
    x0, y0, x1, y1 = box
    for (ax, ay, bx, by) in [(x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)]:
        length = max(abs(bx - ax), abs(by - ay))
        steps = int(length // (dash + gap)) + 1
        for i in range(steps):
            s = i * (dash + gap)
            e = min(s + dash, length)
            if s >= length:
                break
            fx = lambda t: ax + (bx - ax) * t / length
            fy = lambda t: ay + (by - ay) * t / length
            d.line([(fx(s), fy(s)), (fx(e), fy(e))], fill=color, width=width)


def grid(d, w, h, line, label, step=100):
    f = font(18)
    for x in range(0, w + 1, step):
        d.line([(x, 0), (x, h)], fill=line, width=1)
        if x and x < w:
            d.text((x + 4, 4), str(x), fill=label, font=f)
    for y in range(0, h + 1, step):
        d.line([(0, y), (w, y)], fill=line, width=1)
        if y and y < h:
            d.text((4, y + 2), str(y), fill=label, font=f)


def centered(d, xy, text, f, fill):
    x, y = xy
    b = d.textbbox((0, 0), text, font=f)
    d.text((x - (b[2] - b[0]) / 2, y - (b[3] - b[1]) / 2), text, font=f, fill=fill)


def palette(dark):
    if dark:
        return dict(bg=(34, 38, 48), line=(52, 58, 72), label=(110, 118, 136), ink=(225, 229, 238),
                    sub=(160, 168, 186), zone=(244, 190, 90), safe=(120, 210, 160), shade=(255, 255, 255, 38))
    return dict(bg=(236, 233, 226), line=(214, 210, 200), label=(150, 144, 132), ink=(52, 48, 42),
                sub=(110, 104, 94), zone=(198, 120, 40), safe=(46, 140, 96), shade=(255, 255, 255, 120))


def wide(name, title, tint, dark=False, right_label='Wetter, Mond, Saison'):
    """Kalenderbild bzw. Start-Banner: 2000 x 400 (5 : 1)."""
    w, h = 2000, 400
    p = palette(dark)
    img = Image.new('RGB', (w, h), tuple(int(p['bg'][i] * 0.8 + tint[i] * 0.2) for i in range(3)))
    d = ImageDraw.Draw(img, 'RGBA')
    grid(d, w, h, p['line'], p['label'])
    # linker Bereich: hier liegt Text, Nook hellt das Bild dort auf
    d.rectangle([0, 0, 760, h], fill=p['shade'])
    d.text((40, 150), 'Text (Monat / Begrüßung)', font=font(30, True), fill=p['sub'])
    d.text((40, 192), 'wird hier aufgehellt –', font=font(24), fill=p['sub'])
    d.text((40, 222), 'ruhige Fläche wählen', font=font(24), fill=p['sub'])
    # rechts: hier liegt die Wetterkarte über dem Bild
    d.rectangle([1440, 0, w, h], fill=p['shade'])
    d.text((1470, 150), right_label, font=font(30, True), fill=p['sub'])
    d.text((1470, 192), 'Karte liegt darüber –', font=font(24), fill=p['sub'])
    d.text((1470, 222), 'nichts Wichtiges hier', font=font(24), fill=p['sub'])
    # immer sichtbar (auch auf dem Handy)
    dashed_rect(d, (680, 20, 1320, h - 20), p['safe'], width=5)
    centered(d, (1000, 56), 'immer sichtbar (auch am Handy)', font(24, True), p['safe'])
    centered(d, (1000, 170), title, font(56, True), p['ink'])
    centered(d, (1000, 240), '2000 × 400 px  ·  Seitenverhältnis 5 : 1', font(30), p['ink'])
    centered(d, (1000, 290), 'oben/unten oder links/rechts wird je nach Breite angeschnitten', font(22), p['sub'])
    d.rectangle([0, 0, w - 1, h - 1], outline=p['zone'], width=6)
    img.save(os.path.join(OUT, name), optimize=True)


def background():
    w, h = 1920, 1080
    p = palette(False)
    img = Image.new('RGB', (w, h), p['bg'])
    d = ImageDraw.Draw(img, 'RGBA')
    grid(d, w, h, p['line'], p['label'], step=120)
    # Handy hochkant: nur ein schmaler Streifen in der Mitte
    dashed_rect(d, (960 - 250, 30, 960 + 250, h - 30), p['safe'], width=5)
    centered(d, (960, 80), 'Handy (hochkant): nur dieser Streifen', font(26, True), p['safe'])
    d.rounded_rectangle([560, 400, 1360, 730], radius=24, fill=p['bg'] + (235,), outline=p['line'], width=2)
    centered(d, (960, 470), 'Hintergrund', font(84, True), p['ink'])
    centered(d, (960, 570), '1920 × 1080 px  ·  16 : 9', font(40), p['ink'])
    centered(d, (960, 640), 'füllt den ganzen Bildschirm, Ränder werden angeschnitten', font(28), p['sub'])
    centered(d, (960, 690), 'liegt hinter den Karten – Tönung im Editor einstellbar', font(28), p['sub'])
    d.rectangle([0, 0, w - 1, h - 1], outline=p['zone'], width=8)
    img.save(os.path.join(OUT, 'background.png'), optimize=True)


def icon():
    s = 256
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=56, fill=(236, 233, 226, 255), outline=(198, 120, 40, 255), width=8)
    centered(d, (s / 2, 100), 'Icon', font(54, True), (52, 48, 42))
    centered(d, (s / 2, 160), '256 × 256', font(30), (52, 48, 42))
    centered(d, (s / 2, 200), 'wird ~32 px klein', font(20), (110, 104, 94))
    img.save(os.path.join(OUT, 'icon.png'), optimize=True)


wide('spring.png', 'Kalender · Frühling', (120, 190, 110))
wide('summer.png', 'Kalender · Sommer', (240, 200, 80))
wide('fall.png', 'Kalender · Herbst', (210, 120, 60))
wide('winter.png', 'Kalender · Winter', (120, 160, 220))
wide('banner-day.png', 'Start-Banner · Tag', (250, 220, 150), right_label='Wetter')
wide('banner-night.png', 'Start-Banner · Nacht', (60, 70, 120), dark=True, right_label='Wetter')
background()
icon()
print('Muster-Set geschrieben nach', os.path.abspath(OUT))
