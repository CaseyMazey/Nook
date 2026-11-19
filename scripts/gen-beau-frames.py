"""
GEN-BEAU-FRAMES.PY — gezeichnete Schlüsselbilder für die Beau-Animation

Tooling (scripts/ wird nicht deployt). Erzeugt mit google/nano-banana über
Replicate Beau in mehreren Posen. Ablauf:
  1. base   — Grundbild aus dem Referenzbild (sitzend, ganzer Körper, mittig)
  2. Posen  — jeweils als Bearbeitung des Grundbilds (gleiche Größe/Position/Stil)
  3. Freistellen mit recraft-remove-background → echte Transparenz

  python scripts/gen-beau-frames.py --ref <referenz.jpg> [--only base,paw_high] [--no-cut]

Rohbilder + freigestellte PNGs: assets/_raw/beau/ (git- und deploy-ignoriert).
Token nur aus der Umgebungsvariable REPLICATE_API_TOKEN (nie ausgeben).
Kosten: ~0,04 $ je Pose + ~0,01 $ fürs Freistellen.
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.replicate.com/v1"
GEN_MODEL = "google/nano-banana"
CUT_MODEL = "recraft-ai/recraft-remove-background"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "_raw" / "beau"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

STYLE = (
    "Cute storybook cartoon illustration, soft painterly shading, clean dark outlines, warm golden rim light. "
    "Plain solid pure white background (#FFFFFF), no ground shadow, no text, no frame, no other objects. "
    "Square image. The whole cat including the full hat and the full tail is visible with generous white margin on all sides."
)
ANATOMY = (
    "Anatomy must be correct: exactly two ears, exactly four legs (two front legs, two hind legs), "
    "exactly one tail, one head. No extra or missing limbs."
)
KEEP = (
    "Keep the exact same character design, the same art style, the same size, the same position in the image, "
    "the same camera angle and the same hat as in the input image. Only change what is described. "
)

STRICT = (
    "Do NOT mirror or flip the image. The curled hat tip still points to the right and the tail stays on the right side of the body. "
    "The kitten stays SITTING exactly as in the input image, body facing the viewer; both hind paws and the front paw on the LEFT side "
    "of the image stay on the ground unchanged. "
)

POSES = {
    "base": (
        "Draw this exact black kitten character with the oversized golden-orange witch hat (wide brim, black band, "
        "golden buckle, curled tip) and big glowing golden-yellow eyes. Full body, sitting upright, facing the viewer, "
        "centered, both front paws on the ground, tail curled up beside the body on the right side. Neutral calm face. "
    ),
    "look_left": KEEP + "The kitten keeps sitting but looks curiously to the left side (its eyes and face turned slightly left).",
    "look_up_left": KEEP + "The kitten keeps sitting and looks up toward the upper left, head tilted slightly up, curious.",
    "look_up": KEEP + "The kitten keeps sitting and looks straight up with big curious eyes, head tilted up a little.",
    "look_up_right": KEEP + "The kitten keeps sitting and looks up toward the upper right, head tilted slightly, curious.",
    "paw_low": KEEP + STRICT + "Only change: the front paw on the RIGHT side of the image is lifted a little off the ground "
               "(bent at the wrist, about to reach up), the kitten looks up to the upper right with curious eyes.",
    "paw_high": KEEP + STRICT + "Only change: the lifted front paw on the RIGHT side of the image is raised much higher, stretched up toward "
                "the upper right corner, playfully reaching, pink paw pads visible; the kitten looks up to the upper right with big curious eyes. "
                "Exactly THREE paws touch the ground (both hind paws and the front paw on the left side of the image), exactly like in the input "
                "image — do not add a paw on the ground below the raised leg.",
    "paw_high_happy": KEEP + STRICT + "Keep the raised paw exactly as it is. Only change the face: the kitten looks delighted with its mouth "
                      "open in a happy smile, eyes still looking up to the upper right. Same hat size, same head size, same position.",
    "happy": KEEP + STRICT + "Only change: the kitten smiles happily with its mouth slightly open, eyes looking up to the upper right.",
    "blink": KEEP + "The kitten sits calmly facing the viewer with its eyes closed in a gentle content blink.",
}

BUTTERFLY = {
    "fly_open": "A small cute golden-yellow butterfly seen from above, wings fully spread open, same storybook painterly style, "
                "clean dark outline, soft glow. Plain solid pure white background, centered, nothing else.",
    "fly_half": "The exact same golden butterfly as in the input image, same style and size, but with the wings half raised "
                "(seen from the front, wings at a 45 degree upward angle). Plain solid pure white background, centered.",
    "fly_closed": "The exact same golden butterfly as in the input image, same style and size, wings raised almost together "
                  "(thin, seen from the front). Plain solid pure white background, centered.",
}


def die(msg):
    print(f"FEHLER: {msg}", file=sys.stderr)
    sys.exit(1)


def token():
    t = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not t:
        die("REPLICATE_API_TOKEN ist nicht gesetzt.")
    return t


def api(method, url, body=None, wait=False):
    headers = {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}
    if wait:
        headers["Prefer"] = "wait=60"
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(6):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            if e.code == 429 and attempt < 5:
                time.sleep(12)
                continue
            die(f"HTTP {e.code}: {detail}")
        except urllib.error.URLError as e:
            if attempt < 5:
                time.sleep(5)
                continue
            die(f"Netzwerk: {e}")


def run(model, inputs):
    pred = api("POST", f"{API}/models/{model}/predictions", {"input": inputs}, wait=True)
    while pred.get("status") not in ("succeeded", "failed", "canceled"):
        time.sleep(2)
        pred = api("GET", pred["urls"]["get"])
    if pred["status"] != "succeeded":
        die(f"{model}: {pred.get('status')} {pred.get('error')}")
    out = pred["output"]
    return out[0] if isinstance(out, list) else out


def download(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def data_uri(path):
    p = Path(path)
    mime = "image/png" if p.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


def generate(name, prompt, refs):
    print(f"→ {name} …", flush=True)
    url = run(GEN_MODEL, {"prompt": prompt, "image_input": [data_uri(r) for r in refs], "output_format": "png"})
    raw = OUT / f"{name}.raw.png"
    raw.write_bytes(download(url))
    return raw


def cut(raw, name):
    url = run(CUT_MODEL, {"image": data_uri(raw)})
    out = OUT / f"{name}.png"
    out.write_bytes(download(url))
    print(f"  freigestellt: {out.relative_to(ROOT)}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", required=True, help="Referenzbild von Beau")
    ap.add_argument("--only", default="", help="Kommagetrennte Namen (Posen/Schmetterling)")
    ap.add_argument("--no-cut", action="store_true", help="nicht freistellen")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    only = [n for n in args.only.split(",") if n]
    names = only or [*POSES, *BUTTERFLY]
    base_raw = OUT / "base.raw.png"
    fly_raw = OUT / "fly_open.raw.png"
    for name in names:
        if name == "base":
            raw = generate(name, POSES[name] + STYLE + " " + ANATOMY, [args.ref])
        elif name in POSES:
            if not base_raw.exists():
                die("Erst das Grundbild erzeugen (--only base).")
            src = base_raw
            if name == "paw_high_happy" and (OUT / "paw_high.raw.png").exists():
                src = OUT / "paw_high.raw.png"
            elif name == "paw_high" and (OUT / "paw_low.raw.png").exists():
                src = OUT / "paw_low.raw.png"
            elif name.startswith(("paw_", "happy")) and (OUT / "look_up_right.raw.png").exists():
                src = OUT / "look_up_right.raw.png"
            raw = generate(name, POSES[name] + " " + STYLE + " " + ANATOMY, [src])
        elif name == "fly_open":
            raw = generate(name, BUTTERFLY[name], [args.ref])
        elif name in BUTTERFLY:
            if not fly_raw.exists():
                die("Erst fly_open erzeugen.")
            raw = generate(name, BUTTERFLY[name], [fly_raw])
        else:
            die(f"Unbekannt: {name}")
        if not args.no_cut:
            cut(raw, name)


if __name__ == "__main__":
    main()
