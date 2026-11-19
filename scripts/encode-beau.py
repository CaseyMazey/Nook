"""Baut aus den PNG-Frames von scripts/compose-beau.py die Web-Formate der
Beau-Animation (alle mit Alpha-Kanal, Endlosschleife, ohne Ton/Metadaten):

    python scripts/encode-beau.py <frames-512> <frames-768> <zielordner>

- beau-butterfly-<größe>.webm  VP9 mit Alpha (bevorzugt)
- beau-butterfly-<größe>.webp  Animated WebP mit Alpha
- beau-butterfly-320.apng      APNG (Fallback, 320 px / 12 fps — APNG kann zwischen gemalten
                               Frames kaum sparen und wäre sonst > 20 MB)

Braucht ffmpeg mit libvpx-vp9/libwebp (z.B. `pip install imageio-ffmpeg`).
"""
import os
import subprocess
import sys

import imageio_ffmpeg

FPS = 24
FF = imageio_ffmpeg.get_ffmpeg_exe()


def run(args):
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def encode(frames, size, out):
    src = ['-framerate', str(FPS), '-i', os.path.join(frames, 'f%04d.png')]
    base = os.path.join(out, f'beau-butterfly-{size}')
    clean = ['-map_metadata', '-1', '-an']
    # VP9 mit Alpha: yuva420p, auto-alt-ref aus (sonst geht Alpha verloren)
    run([*src, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '33',
         '-auto-alt-ref', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1', *clean, base + '.webm'])
    run([*src, '-c:v', 'libwebp_anim', '-pix_fmt', 'yuva420p', '-lossless', '0', '-quality', '72',
         '-compression_level', '6', '-loop', '0', *clean, base + '.webp'])
    if size == 512:
        run([*src, '-vf', r"select='not(mod(n\,2))',setpts=N/12/TB,scale=320:320:flags=lanczos", '-r', '12',
             '-c:v', 'apng', '-plays', '0', '-pred', 'mixed', *clean, '-f', 'apng',
             os.path.join(out, 'beau-butterfly-320.apng')])


def main():
    f512, f768, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    encode(f512, 512, out)
    encode(f768, 768, out)
    for name in sorted(os.listdir(out)):
        if name.startswith('beau-butterfly-') and not name.endswith('.js'):
            print(f'{name}: {os.path.getsize(os.path.join(out, name)) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
