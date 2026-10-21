"""
GEN-IMAGE.PY — Bild-Assets für Nook per Replicate-API erzeugen

Tooling, kein Teil der App (scripts/ steht in .assetsignore, wird nicht
deployt). Der API-Token kommt AUSSCHLIESSLICH aus der Windows-Umgebungs-
variable REPLICATE_API_TOKEN — niemals hier oder sonstwo im Repo eintragen.

Modi (aus der Endung von --out abgeleitet, oder per --mode):
  image  .webp/.png  Flux (fast = flux-schnell, pro = flux-1.1-pro),
                     optional --transparent: Hintergrund wird entfernt
  svg    .svg        Recraft V3 SVG — echte Vektorgrafik (Icons, Deko)

Rohdateien + Prompt-Log landen in assets/_raw/ (git- und deploy-ignoriert),
das fertige, verkleinerte Asset unter --out.

Beispiele:
  python scripts/gen-image.py "wooden tavern quest board texture, top-down, warm light" --out assets/questboard/board.webp --aspect 16:9 --max-size 1600
  python scripts/gen-image.py "treasure chest full of gold coins, storybook style" --out assets/questboard/chest.webp --transparent --max-size 256
  python scripts/gen-image.py "simple d20 dice icon, flat" --out assets/questboard/d20.svg
"""

import argparse
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

API = "https://api.replicate.com/v1"
MODELS = {
    "fast": "black-forest-labs/flux-schnell",
    "pro": "black-forest-labs/flux-1.1-pro",
    "svg": "recraft-ai/recraft-v3-svg",
    "remove_bg": "recraft-ai/recraft-remove-background",
}
ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "assets" / "_raw"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def die(msg):
    print(f"FEHLER: {msg}", file=sys.stderr)
    sys.exit(1)


def token():
    t = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not t:
        die("REPLICATE_API_TOKEN ist nicht gesetzt (setx REPLICATE_API_TOKEN \"r8_...\" und Claude/Terminal neu starten).")
    return t


def api(method, url, body=None, wait=False):
    headers = {"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}
    if wait:
        headers["Prefer"] = "wait=60"
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(6):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:500]
            # Gedrosselt (bei < 5 $ Guthaben nur ~6 Anfragen/Minute) → warten
            if e.code == 429 and attempt < 5:
                try:
                    wait_s = int(json.loads(detail).get("retry_after", 10))
                except ValueError:
                    wait_s = 10
                print(f"Gedrosselt, warte {wait_s + 1} s …")
                time.sleep(wait_s + 1)
                continue
            if e.code == 402:
                die("Kein Guthaben mehr auf Replicate (402). Unter replicate.com > Billing aufladen.")
            die(f"Replicate-API {e.code}: {detail}")
        except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
            # Kurzer Netzwerkaussetzer (z.B. Firmen-Proxy) → nochmal versuchen
            if attempt < 5:
                print(f"Verbindung unterbrochen ({e}), neuer Versuch …")
                time.sleep(3)
                continue
            die(f"Keine Verbindung zu Replicate: {e}")


def run(model, inputs):
    """Startet eine Vorhersage, wartet bis fertig, gibt die Output-URL(s) zurück."""
    pred = api("POST", f"{API}/models/{model}/predictions", {"input": inputs}, wait=True)
    started = time.time()
    while pred.get("status") not in ("succeeded", "failed", "canceled"):
        if time.time() - started > 300:
            die(f"Zeitüberschreitung bei {model}")
        time.sleep(2)
        pred = api("GET", pred["urls"]["get"])
    if pred["status"] != "succeeded":
        die(f"{model} fehlgeschlagen: {pred.get('error')}")
    out = pred["output"]
    return out if isinstance(out, list) else [out]


def download(url):
    req = urllib.request.Request(url, headers={"User-Agent": "nook-gen-image"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def log_prompt(entry):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with open(RAW_DIR / "prompts.log", "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def save_raster(data, out, max_size, quality):
    from PIL import Image  # nur für Rastergrafik nötig

    img = Image.open(io.BytesIO(data))
    img.load()
    if max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.suffix.lower() == ".webp":
        img.save(out, "WEBP", quality=quality, method=6)
    else:
        img.save(out, optimize=True)
    return img.size


def main():
    p = argparse.ArgumentParser(description="Bild-Asset für Nook per Replicate erzeugen.")
    p.add_argument("prompt", help="Bildbeschreibung (Englisch liefert meist bessere Ergebnisse)")
    p.add_argument("--out", required=True, help="Zielpfad relativ zum Repo, z.B. assets/questboard/chest.webp")
    p.add_argument("--mode", choices=["image", "svg"], help="Standard: aus der Endung von --out")
    p.add_argument("--quality", choices=["fast", "pro"], default="fast",
                   help="fast = flux-schnell (sehr günstig, zum Ausprobieren), pro = flux-1.1-pro (beste Qualität)")
    p.add_argument("--aspect", default="1:1", help="Seitenverhältnis, z.B. 1:1, 16:9, 3:4")
    p.add_argument("--transparent", action="store_true", help="Hintergrund entfernen (nur image)")
    p.add_argument("--max-size", type=int, default=1024, help="längste Kante des fertigen Assets in px (0 = Original)")
    p.add_argument("--webp-quality", type=int, default=85)
    p.add_argument("--style", default="any", help="nur svg: any, engraving, line_art, line_circuit, linocut")
    p.add_argument("--seed", type=int, help="für reproduzierbare Ergebnisse")
    args = p.parse_args()

    out = (ROOT / args.out).resolve()
    if ROOT not in out.parents:
        die("--out muss innerhalb des Nook-Repos liegen")
    mode = args.mode or ("svg" if out.suffix.lower() == ".svg" else "image")
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    if mode == "svg":
        if out.suffix.lower() != ".svg":
            die("Für --mode svg muss --out auf .svg enden")
        model = MODELS["svg"]
        inputs = {"prompt": args.prompt, "style": args.style}
        if args.aspect != "1:1":
            inputs["aspect_ratio"] = args.aspect
        print(f"Erzeuge SVG mit {model} …")
        data = download(run(model, inputs)[0])
        (RAW_DIR / f"{out.stem}-{stamp}.svg").write_bytes(data)
        # Recraft bettet ein großes C2PA-Herkunftsmanifest als <metadata> ein —
        # für die App unnötig; im Rohordner bleibt das Original erhalten.
        data = re.sub(rb"<metadata>.*?</metadata>", b"", data, flags=re.S)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        print(f"Fertig: {out.relative_to(ROOT)} ({len(data) // 1024} KB)")
    else:
        model = MODELS[args.quality]
        inputs = {"prompt": args.prompt, "aspect_ratio": args.aspect, "output_format": "png"}
        if args.seed is not None:
            inputs["seed"] = args.seed
        print(f"Erzeuge Bild mit {model} …")
        url = run(model, inputs)[0]
        raw = download(url)
        (RAW_DIR / f"{out.stem}-{stamp}.png").write_bytes(raw)
        if args.transparent:
            print(f"Entferne Hintergrund mit {MODELS['remove_bg']} …")
            raw = download(run(MODELS["remove_bg"], {"image": url})[0])
            (RAW_DIR / f"{out.stem}-{stamp}-transparent.png").write_bytes(raw)
        w, h = save_raster(raw, out, args.max_size, args.webp_quality)
        print(f"Fertig: {out.relative_to(ROOT)} ({w}x{h}, {out.stat().st_size // 1024} KB)")

    log_prompt({"time": stamp, "out": args.out, "mode": mode, "quality": args.quality,
                "prompt": args.prompt, "aspect": args.aspect, "transparent": args.transparent,
                "seed": args.seed})


if __name__ == "__main__":
    main()
