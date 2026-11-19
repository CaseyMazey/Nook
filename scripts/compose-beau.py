"""
COMPOSE-BEAU.PY — setzt die gezeichneten Schlüsselbilder (scripts/gen-beau-frames.py)
zur Animation „Beau spielt mit einem Schmetterling“ zusammen.

    python scripts/compose-beau.py <ausgabe-768> <ausgabe-512>

- Beau: Posen nach Zeitplan (POSES), kurze Überblendung beim Wechsel, leichtes Atmen
- Schmetterling: gezeichnetes Sprite auf einer geschlossenen, weichen Flugbahn
  (FLIGHT), Flügelschlag 5×/s, Neigung in Flugrichtung
- 18 s, 24 fps, alle Perioden teilen 18 s → nahtloser Loop
Ergebnis: PNG-Frames f0000.png … mit Alpha-Kanal; danach scripts/encode-beau.py.
"""
import math
import os
import sys
from pathlib import Path

from PIL import Image

RAW = Path(__file__).resolve().parent.parent / "assets" / "_raw" / "beau"
DUR, FPS, SIZE = 18.0, 24, 768
K = SIZE / 512  # Koordinaten unten sind für 512 px angegeben

# Beau: Ausschnitt der 1024er-Bilder → Zielfläche (unten mittig, Rand frei für den Schmetterling)
SRC_CX, SRC_BOTTOM = 523.5, 909      # Mitte/Unterkante des Motivs in den Rohbildern
SCALE = 0.48 * K * 1024 / 1024      # Rohpixel → Zielpixel
DST_CX, DST_BOTTOM = 256 * K, 492 * K

# (Startzeit, Pose) — jede Pose gilt bis zur nächsten
POSES = [
    (0.0, "look_left"), (1.2, "blink"), (1.4, "look_left"), (2.6, "look_up_left"), (4.2, "look_up"),
    (5.6, "look_up_right"), (6.6, "paw_low"), (7.0, "paw_high"), (7.9, "paw_low"), (9.0, "paw_high"),
    (9.4, "paw_high_happy"), (11.0, "happy"), (12.4, "look_up"), (13.6, "look_up_left"),
    (15.0, "blink"), (15.2, "look_left"),
]
FADE = 0.12  # Sekunden Überblendung beim Posenwechsel (Blinzeln: kürzer)

# Flugbahn (Sekunde, x, y) in 512er-Koordinaten, geschlossen (nach 18 s wieder Punkt 0)
FLIGHT = [
    (0.0, 56, 380), (1.4, 70, 342), (2.6, 52, 242), (3.6, 92, 142), (4.6, 190, 62), (5.6, 300, 50),
    (6.4, 420, 112), (7.0, 470, 228), (7.5, 462, 262), (8.1, 478, 172), (8.9, 468, 250), (9.3, 460, 268),
    (10.0, 472, 152), (11.0, 440, 72), (12.4, 330, 42), (13.6, 190, 52), (14.6, 90, 132), (15.6, 48, 250),
    (16.8, 52, 342),
]
FLY_W = 62  # Spannweite des Schmetterlings in 512er-Pixeln


def flight(t):
    t %= DUR
    n = len(FLIGHT)

    def pt(i):
        k, wrap = i % n, i // n
        return (FLIGHT[k][0] + wrap * DUR, FLIGHT[k][1], FLIGHT[k][2])

    i = max(k for k in range(n) if FLIGHT[k][0] <= t)
    p0, p1, pm, pp = pt(i), pt(i + 1), pt(i - 1), pt(i + 2)
    dt = p1[0] - p0[0]
    u = (t - p0[0]) / dt
    m0 = [(p1[j] - pm[j]) / (p1[0] - pm[0]) for j in (1, 2)]
    m1 = [(pp[j] - p0[j]) / (pp[0] - p0[0]) for j in (1, 2)]
    h00, h10 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u
    h01, h11 = -2 * u**3 + 3 * u**2, u**3 - u**2
    x = h00 * p0[1] + h10 * dt * m0[0] + h01 * p1[1] + h11 * dt * m1[0]
    y = h00 * p0[2] + h10 * dt * m0[1] + h01 * p1[2] + h11 * dt * m1[1]
    y += math.sin(2 * math.pi * t / 1.5) * 4 + math.sin(2 * math.pi * t / 0.75 + 1) * 2
    x += math.sin(2 * math.pi * t / 3) * 3
    return x, y


def pose_at(t):
    t %= DUR
    idx = max(i for i, (s, _) in enumerate(POSES) if s <= t)
    start, name = POSES[idx]
    prev = POSES[idx - 1][1]  # idx 0 → letzte Pose (Loop)
    fade = 0.06 if "blink" in (name, prev) else FADE
    a = min(1.0, (t - start) / fade) if (t - start) < fade else 1.0
    return prev, name, a


def load_cat(name, cache={}):
    if name not in cache:
        im = Image.open(RAW / f"{name}.png").convert("RGBA")
        bbox = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        # an der Hutoberkante/-mitte des Grundbilds ausrichten (Abweichung der Rohbilder ≤ 3 px)
        dx = (162 + 885) / 2 - (bbox[0] + bbox[2]) / 2
        dy = 118 - bbox[1]
        w = round(im.width * SCALE)
        im = im.resize((w, w), Image.LANCZOS)
        ox = DST_CX - (SRC_CX - dx) * SCALE
        oy = DST_BOTTOM - (SRC_BOTTOM - dy) * SCALE
        cache[name] = (im, ox, oy)
    return cache[name]


def cat_layer(name, breath):
    im, ox, oy = load_cat(name)
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    # Atmen: leicht in die Höhe, verankert an der Unterkante
    h = round(im.height * (1 + breath))
    sq = im.resize((im.width, h), Image.BICUBIC) if h != im.height else im
    layer.alpha_composite(sq, (round(ox), round(oy - (h - im.height) * (DST_BOTTOM - oy) / im.height)))
    return layer


FLY_SRC = None


def butterfly_sprite(t):
    global FLY_SRC
    if FLY_SRC is None:
        im = Image.open(RAW / "fly_open.png").convert("RGBA")
        im = im.crop(im.getchannel("A").point(lambda v: 255 if v > 30 else 0).getbbox())
        w = round(FLY_W * K)
        FLY_SRC = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    flap = 0.22 + 0.78 * abs(math.cos(math.pi * 5 * t))  # 5 Schläge/s → 90 je Durchlauf
    w = max(2, round(FLY_SRC.width * flap))
    spr = FLY_SRC.resize((w, FLY_SRC.height), Image.BICUBIC)
    x0, _ = flight(t - 0.04)
    x1, _ = flight(t + 0.04)
    tilt = max(-22, min(22, (x1 - x0) * 1.4))
    return spr.rotate(-tilt, resample=Image.BICUBIC, expand=True)


def frame(t):
    prev, name, a = pose_at(t)
    breath = 0.007 * math.sin(2 * math.pi * t / 3.6)
    cat = cat_layer(name, breath)
    if a < 1:
        cat = Image.blend(cat_layer(prev, breath), cat, a)
    out = cat
    spr = butterfly_sprite(t)
    x, y = flight(t)
    out.alpha_composite(spr, (round(x * K - spr.width / 2), round(y * K - spr.height / 2)))
    return out


def main():
    out768, out512 = Path(sys.argv[1]), Path(sys.argv[2])
    out768.mkdir(parents=True, exist_ok=True)
    out512.mkdir(parents=True, exist_ok=True)
    total = int(DUR * FPS)
    for i in range(total):
        im = frame(i / FPS)
        im.save(out768 / f"f{i:04d}.png", optimize=False)
        im.resize((512, 512), Image.LANCZOS).save(out512 / f"f{i:04d}.png", optimize=False)
        if i % 48 == 0:
            print(f"{i}/{total}", flush=True)
    print("fertig")


if __name__ == "__main__":
    main()
