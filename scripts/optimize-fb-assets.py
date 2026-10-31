#!/usr/bin/env python3
"""Flashcard Battle: Grafiken fürs Spiel verkleinern.

Originale liegen unter assets/_raw/flashcard-battle/{monsters,dungeons}/ (weder
committet noch deployt), das Ergebnis landet in games/flashcard-battle/assets/.
Aufruf aus dem Projektordner: python scripts/optimize-fb-assets.py

Neue oder geänderte Grafik: Original in den _raw-Ordner legen, Skript ausführen.
"""
from pathlib import Path
from PIL import Image

RAW = Path("assets/_raw/flashcard-battle")
OUT = Path("games/flashcard-battle/assets")

# Im Spiel: normal/selten 128 px, Boss 256 px, mit Reserve für hochauflösende Bildschirme
MONSTER_SIZE = 320
BOSS_SIZE = 512
BOSSES = {"wurzelhueter", "archivar", "urdrache"}
DUNGEON_WIDTH = 1024


def save_small(img, path):
    """Mit 256 Farben speichern, falls das Bild dadurch kleiner wird (Alpha bleibt erhalten)."""
    img.save(path, optimize=True)
    full = path.stat().st_size
    method = Image.Quantize.FASTOCTREE if img.mode == "RGBA" else Image.Quantize.MEDIANCUT
    img.quantize(256, method=method, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)
    return full, path.stat().st_size


def monsters():
    for src in sorted((RAW / "monsters").glob("*.png")):
        img = Image.open(src).convert("RGBA")
        # Fast unsichtbare Ränder abschneiden, damit das Monster seine Fläche ausfüllt
        box = img.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
        img = img.crop(box)
        size = BOSS_SIZE if src.stem in BOSSES else MONSTER_SIZE
        img.thumbnail((size, size), Image.Resampling.LANCZOS)
        full, final = save_small(img, OUT / "monsters" / src.name)
        print(f"{src.name}: {src.stat().st_size // 1024} KB -> {final // 1024} KB, {img.size} (ohne Farbreduktion {full // 1024} KB)")


def dungeons():
    for src in sorted((RAW / "dungeons").glob("*.png")):
        img = Image.open(src).convert("RGB")
        img.thumbnail((DUNGEON_WIDTH, DUNGEON_WIDTH), Image.Resampling.LANCZOS)
        full, final = save_small(img, OUT / "dungeons" / src.name)
        print(f"{src.name}: {src.stat().st_size // 1024} KB -> {final // 1024} KB, {img.size} (ohne Farbreduktion {full // 1024} KB)")


if __name__ == "__main__":
    monsters()
    dungeons()
