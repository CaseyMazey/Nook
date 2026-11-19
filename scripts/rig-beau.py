"""
RIG-BEAU.PY — zerlegt das gemalte Grundbild von Beau in bewegliche Ebenen

Tooling (scripts/ wird nicht deployt). Statt einzelner KI-Posen, zwischen denen
man jeden Wechsel sieht, wird EIN gemaltes Bild in Teile geschnitten, die
assets/themes/beau/beau-rig.js live (60 fps) bewegt. Die Teile sind echte
Bildausschnitte (PNG mit Alpha) — die gemalte Optik bleibt erhalten.

    python scripts/rig-beau.py [--debug <ordner>]

Eingabe:  assets/_raw/beau/base.png, fly_open.png  (aus gen-beau-frames.py)
Ausgabe:  assets/themes/beau/rig/*.png  +  assets/themes/beau/rig/rig-layout.js
          (window.BEAU_RIG_LAYOUT: Ausschnittpositionen, Drehpunkte; kein JSON,
          weil fetch() unter file:// nicht geht)

Ebenen (Zeichenreihenfolge):
  tail      Schwanz, liegt hinter dem Körper (Ansatz wird vom Körper verdeckt)
  hatback   Hutkrempe unterhalb des Kinns — liegt hinter dem Hals
  body      Körper; Hals nach oben mit Fell verlängert (Lücke beim Kopfneigen)
  head      Hut, Ohren, Kopf — Augen/Nase/Mund mit Fell übermalt
  features  Augen, Nase, Mund mit weichem Fellrand (verschiebt sich leicht → Kopfdrehung)
  iris_l/r  Augeninneres ohne Pupille (Pupille mit Gold aufgefüllt), Form = Maske
  pupil_l/r Pupille mit Glanzpunkten; wird im Auge verschoben (Blick)
  fly_*     Schmetterling: Flügel links/rechts, Körper
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "_raw" / "beau"
OUT = ROOT / "assets" / "themes" / "beau" / "rig"

# Handgemessene Punkte im 1024er-Grundbild (siehe Rasterausschnitte beim Bau)
NECK_CUT = 560          # Kinnlinie: darüber Kopf, darunter Körper
CUT_FEATHER = 9         # weicher Übergang Kopf/Körper (px je Seite)
NECK_X = (392, 632)     # Halsbreite auf Höhe der Kinnlinie
HEAD_PIVOT = (512, 585) # Drehpunkt Kopf (Halsansatz)
TAIL_X = 657            # ab hier Schwanz
TAIL_Y = (618, 795)
TAIL_PIVOT = (652, 752)
EYE_BOXES = {"l": (378, 396, 456, 474), "r": (506, 396, 590, 474)}
NOSE_BOX = (450, 462, 500, 498)
MOUTH_BOX = (448, 492, 506, 524)


def load(name):
    return np.array(Image.open(RAW / name).convert("RGBA")).astype(np.float32)


def save(arr, name, crop=True):
    """Speichert RGBA (float) beschnitten auf die Alpha-Box; gibt (x, y, w, h) zurück."""
    a = np.clip(arr, 0, 255).astype(np.uint8)
    a[a[..., 3] == 0, :3] = 0
    if crop:
        ys, xs = np.nonzero(a[..., 3] > 0)
        x0, x1 = max(0, xs.min() - 2), min(a.shape[1], xs.max() + 3)
        y0, y1 = max(0, ys.min() - 2), min(a.shape[0], ys.max() + 3)
    else:
        x0, y0, x1, y1 = 0, 0, a.shape[1], a.shape[0]
    Image.fromarray(a[y0:y1, x0:x1]).save(OUT / f"{name}.png", optimize=True)
    return [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]


def smooth(edge0, edge1, v):
    t = np.clip((v - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def feather(mask, grow, blur):
    m = ndi.binary_dilation(mask, iterations=grow) if grow > 0 else mask
    return np.clip(ndi.gaussian_filter(m.astype(np.float32), blur), 0, 1)


def inpaint(rgb, mask, radius=7):
    out = cv2.inpaint(np.clip(rgb, 0, 255).astype(np.uint8), mask.astype(np.uint8) * 255, radius, cv2.INPAINT_TELEA)
    return out.astype(np.float32)


def eye_parts(img, box):
    """Augeninneres, Pupillenscheibe, Iris ohne Pupille für ein Auge."""
    x0, y0, x1, y1 = box
    rgb = img[..., :3]
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    H, W = R.shape
    inbox = np.zeros((H, W), bool)
    inbox[y0:y1, x0:x1] = True
    warm = inbox & ((R - B) > 10) & (img[..., 3] > 200)
    lab, n = ndi.label(warm)
    sizes = ndi.sum(warm, lab, range(1, n + 1))
    eye = lab == (1 + int(np.argmax(sizes)))
    eye = ndi.binary_fill_holes(ndi.binary_closing(eye, iterations=2))
    interior = ndi.binary_erosion(eye, iterations=3)          # ohne die dunkle Kontur
    lum = 0.3 * R + 0.59 * G + 0.11 * B
    gold = interior & (R > 120) & ((R - B) > 70)
    dark = interior & (lum < 110) & ~gold
    lab, n = ndi.label(dark)
    sizes = ndi.sum(dark, lab, range(1, n + 1))
    pupil = ndi.binary_fill_holes(lab == (1 + int(np.argmax(sizes))))  # inkl. Glanzpunkte
    # dünne Konturreste (Sichel am Lidrand) weg: Öffnen mit einer Scheibe
    r = 7
    disk = (np.add.outer(np.arange(-r, r + 1) ** 2, np.arange(-r, r + 1) ** 2) <= r * r)
    pupil = ndi.binary_fill_holes(ndi.binary_opening(pupil, structure=disk))

    # Iris ohne Pupille: Goldverlauf je Zeile aus den sichtbaren Goldpixeln,
    # nach oben dunkler (Schatten des Lids) — dann an den Rändern mit Telea angleichen
    ys, xs = np.nonzero(interior)
    cy, cx = ys.mean(), xs.mean()
    rad = np.sqrt(((ys - cy) ** 2 + (xs - cx) ** 2).max())
    gy = np.nonzero(gold)[0]
    gold_rgb = rgb[gold]
    top_c = np.array([150, 88, 22], np.float32)    # gemessen am oberen Goldrand
    bot_c = np.array([248, 232, 100], np.float32)  # gemessen am unteren Goldrand
    fill = rgb.copy()
    yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip((yy - (cy - rad)) / (2 * rad), 0, 1)[..., None]
    grad = top_c * (1 - t) ** 1.4 + bot_c * (1 - (1 - t) ** 1.4)
    rim = np.clip(np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2) / rad, 0, 1)[..., None]
    grad = grad * (1 - 0.35 * smooth(0.7, 1.0, rim))
    hole = ndi.binary_dilation(pupil, iterations=2) & interior
    fill[hole] = grad[hole]
    # weiche Naht zwischen Verlauf und Originalgold
    blend = feather(hole, 0, 1.5)[..., None]
    soft = inpaint(fill, ndi.binary_dilation(hole, iterations=1) & ~ndi.binary_erosion(hole, iterations=2), 3)
    edge = (blend > 0.05) & (blend < 0.95)
    fill[edge[..., 0]] = soft[edge[..., 0]]
    _ = gy, gold_rgb
    return interior, pupil, fill, (cx, cy, rad)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--debug", type=Path)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    img = load("base.png")
    img[img[..., 3] <= 8] = 0   # Alpha-Rauschen der Freistellung
    rgb, A = img[..., :3], img[..., 3]
    H, W = A.shape
    yy, xx = np.mgrid[0:H, 0:W]
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    layout = {"size": [W, H], "layers": {}}

    def layer(name, arr, **extra):
        layout["layers"][name] = {"rect": save(arr, name), **extra}

    # ── Schwanz ───────────────────────────────────────────────
    tail_m = (xx >= TAIL_X - 8) & (yy >= TAIL_Y[0]) & (yy <= TAIL_Y[1])
    tail = img.copy()
    tail[..., 3] = A * tail_m
    layer("tail", tail, pivot=list(TAIL_PIVOT), baseY=TAIL_Y[1], tipY=TAIL_Y[0])
    in_tail_only = (xx >= TAIL_X) & (yy >= TAIL_Y[0]) & (yy <= TAIL_Y[1])

    # ── Augen, Nase, Mund ─────────────────────────────────────
    feat_core = np.zeros((H, W), bool)
    eyes = {}
    for side, box in EYE_BOXES.items():
        interior, pupil, iris_rgb, geo = eye_parts(img, box)
        eyes[side] = (interior, pupil, iris_rgb, geo)
        x0, y0, x1, y1 = box
        feat_core[y0:y1, x0:x1] |= (A[y0:y1, x0:x1] > 0)
    lum = 0.3 * R + 0.59 * G + 0.11 * B
    for (x0, y0, x1, y1) in (NOSE_BOX, MOUTH_BOX):
        sub = np.zeros((H, W), bool)
        sub[y0:y1, x0:x1] = True
        # Nase: rosa/braun; Mund: dunkle Linien heller Fellfläche gegenüber
        feat_core |= sub & (((R - B) > 18) | (lum < 26))
    # Augen als volle Ellipse inkl. Kontur
    for side, (interior, _, _, (cx, cy, rad)) in eyes.items():
        feat_core |= ((xx - cx) ** 2 + (yy - cy) ** 2) <= (rad + 7) ** 2
    feat_alpha = feather(feat_core, 5, 3.0)
    features = img.copy()
    features[..., 3] = A * feat_alpha
    feat_center = [float(np.mean([e[3][0] for e in eyes.values()])), float(np.mean([e[3][1] for e in eyes.values()]))]
    layer("features", features, center=feat_center)

    # ── Kopf (über Kinnlinie), Gesicht mit Fell übermalt ──────
    head_a = 1 - smooth(NECK_CUT - CUT_FEATHER, NECK_CUT + CUT_FEATHER, yy.astype(np.float32))
    orange = (R > 170) & ((R - B) > 100) & (G > 80) & (A > 0)   # nur die Krempe, nicht der braune Fellsaum
    below = yy >= NECK_CUT - CUT_FEATHER
    # Unter der Kinnlinie: jedes Pixel gehört zu dem, was ihm näher ist —
    # Krempe (orange) oder Fell. So bleibt die braune Fellkontur am Körper
    # und die Krempenkontur an der Krempe.
    fur = (np.abs(R - B) < 16) & (lum < 75) & (A > 200)
    d_or = ndi.distance_transform_edt(~orange)
    d_fur = ndi.distance_transform_edt(~fur)
    OVERLAP = 14   # Körper/Krempe reichen so weit unter den Kopf → keine Lücken beim Kippen
    zone = (yy >= NECK_CUT - CUT_FEATHER - OVERLAP) & (yy < 640) & (A > 0)
    hatback_m = zone & (d_or + 1.5 < d_fur) & (d_or <= 5) & ~in_tail_only
    head = img.copy()
    head[..., :3] = inpaint(rgb, ndi.binary_dilation(feat_core, iterations=3) & (A > 200), 9)
    # Krempe unten liegt zusätzlich voll in hatback (gleiche Bewegung) → keine Naht
    head[..., 3] = A * head_a * (yy < 640)
    layer("head", head, pivot=list(HEAD_PIVOT))
    hatback = img.copy()
    hatback[..., 3] = A * hatback_m
    layer("hatback", hatback, pivot=list(HEAD_PIVOT))

    # ── Körper: unter der Kinnlinie, Hals mit Fell nach oben verlängert ──
    body = img.copy()
    # Saum zur Krempe doppelt (Körper 3 px über die Krempe) → keine Lücke, wenn der Kopf kippt
    body_keep = ~hatback_m | (d_fur <= 3)
    body_a = A * (yy >= NECK_CUT - CUT_FEATHER - OVERLAP) * body_keep * ~in_tail_only
    # Hals-Füllung: Zeilen unter dem Schnitt nach oben gespiegelt, in einer Ellipse
    fill_h = 70
    src_rows = np.clip(2 * (NECK_CUT - CUT_FEATHER) - yy, NECK_CUT - CUT_FEATHER, H - 1)
    mirrored = rgb[src_rows, xx]
    ed = np.sqrt(((xx - 512) / ((NECK_X[1] - NECK_X[0]) / 2 - 30)) ** 2 + ((yy - (NECK_CUT - CUT_FEATHER)) / fill_h) ** 2)
    ell = (ed <= 1) & (yy < NECK_CUT - CUT_FEATHER)
    # nur nach oben/außen weich, unten nahtlos an den Körper
    ell_a = (1 - smooth(0.82, 1.0, ed)) * (yy < NECK_CUT - CUT_FEATHER)
    body[..., :3] = np.where(ell[..., None], mirrored, rgb)
    # leicht abdunkeln: liegt im Schatten unter dem Kopf
    body[..., :3] = np.where(ell[..., None], body[..., :3] * 0.85, body[..., :3])
    body[..., 3] = np.maximum(body_a, 255 * ell_a)
    layer("body", body)

    # ── Augen: Iris ohne Pupille + Pupille ────────────────────
    for side, (interior, pupil, iris_rgb, (cx, cy, rad)) in eyes.items():
        ia = feather(interior, 0, 0.7) * interior.astype(np.float32)
        iris = np.dstack([iris_rgb, 255 * np.clip(ndi.gaussian_filter(interior.astype(np.float32), 0.6), 0, 1) * interior])
        layer(f"iris_{side}", iris, center=[float(cx), float(cy)], radius=float(rad))
        # Pupille mit weichem Rand: im Randband Alpha aus der Helligkeit
        core = ndi.binary_erosion(pupil, iterations=2)
        band = ndi.binary_dilation(pupil, iterations=2) & ~core & interior
        lum_e = lum
        gold_l = 170.0
        pup_l = float(np.median(lum_e[core & (lum_e < 90)]))
        a_band = np.clip((gold_l - lum_e) / (gold_l - pup_l), 0, 1)
        pa = np.where(core, 1.0, np.where(band, a_band, 0.0))
        pup_col = np.median(rgb[core & (lum_e < 90)], axis=0)
        prgb = np.where(core[..., None], rgb, pup_col)
        pimg = np.dstack([prgb, 255 * pa])
        layer(f"pupil_{side}", pimg)
        _ = ia

    # ── Schmetterling: Flügel einzeln, damit sie um den Körper klappen ──
    fly = load("fly_open.png")
    fA = fly[..., 3]
    fyy, fxx = np.mgrid[0:fly.shape[0], 0:fly.shape[1]]
    axis = 512
    body_col = (np.abs(fxx - axis) <= 16) & (fyy >= 450) & (fyy <= 660)
    # Fühler im V zwischen den Flügeln
    v_gap = (fyy < 470) & (fyy > 340) & (np.abs(fxx - axis) < (470 - fyy) * 0.75 + 6)
    fbody_m = (body_col | v_gap) & (fA > 0)
    fb = fly.copy(); fb[..., 3] = fA * fbody_m
    wl = fly.copy(); wl[..., 3] = fA * (~fbody_m) * (fxx < axis + 2)
    wr = fly.copy(); wr[..., 3] = fA * (~fbody_m) * (fxx >= axis - 2)
    fl = {}
    for name, arr in (("fly_body", fb), ("fly_wing_l", wl), ("fly_wing_r", wr)):
        # auf 1/3 verkleinern — er fliegt klein durchs Bild
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        im = im.resize((im.width // 3, im.height // 3), Image.LANCZOS)
        a = np.array(im).astype(np.float32)
        fl[name] = {"rect": save(a, name)}
    layout["butterfly"] = {"scale": 1 / 3, "axis": axis / 3, "parts": fl}

    (OUT / "rig-layout.js").write_text(
        "// Erzeugt von scripts/rig-beau.py — nicht von Hand bearbeiten.\n"
        "window.BEAU_RIG_LAYOUT = " + json.dumps(layout, indent=1) + ";\n",
        encoding="utf-8",
    )
    print("Ebenen:", ", ".join(list(layout["layers"]) + list(fl)))

    if args.debug:
        args.debug.mkdir(parents=True, exist_ok=True)
        for name in list(layout["layers"]) + list(fl):
            im = Image.open(OUT / f"{name}.png").convert("RGBA")
            bg = Image.new("RGBA", im.size, (120, 200, 120, 255))
            bg.alpha_composite(im)
            bg.save(args.debug / f"dbg-{name}.png")


if __name__ == "__main__":
    main()
