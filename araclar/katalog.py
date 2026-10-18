"""Tekil sprite klasöründen numaralı katalog sayfaları üretir: katalog.py <klasör> <çıktı_önek> [ölçek] [en]"""
import re, sys
from pathlib import Path
from PIL import Image, ImageDraw

klasor, onek = Path(sys.argv[1]), sys.argv[2]
Z = int(sys.argv[3]) if len(sys.argv) > 3 else 2
EN = int(sys.argv[4]) if len(sys.argv) > 4 else 1500
no = lambda p: int(m.group(1)) if (m := re.search(r"(\d+)\D*$", p.stem)) else 0
dosyalar = sorted(klasor.glob("*.png"), key=no)
sayfa, x, y, satir_h, sayfalar = [], 6, 6, 0, []
def bitir():
    if not sayfa: return
    H = max(yy + h for _, _, yy, _, h in sayfa) + 6
    on = Image.new("RGBA", (EN, H), (150, 160, 170, 255)); d = ImageDraw.Draw(on)
    for im, xx, yy, n, h in sayfa:
        on.alpha_composite(im, (xx, yy + 12)); d.rectangle([xx, yy, xx + 7 * len(str(n)) + 2, yy + 10], fill=(0, 0, 0, 255)); d.text((xx + 1, yy - 1), str(n), fill=(255, 255, 0, 255))
    on.save(f"{onek}_{len(sayfalar)}.png"); sayfalar.append(1)
for p in dosyalar:
    im = Image.open(p).convert("RGBA"); bb = im.getbbox()
    if not bb: continue
    im = im.crop(bb); im = im.resize((im.width * Z, im.height * Z), Image.NEAREST)
    w, h = max(im.width, 30), im.height + 12
    if x + w > EN - 6: x, y, satir_h = 6, y + satir_h + 6, 0
    if y + h > 1400: bitir(); sayfa.clear(); x, y, satir_h = 6, 6, 0
    sayfa.append((im, x, y, no(p), h)); x += w + 6; satir_h = max(satir_h, h)
bitir(); print(len(dosyalar), "sprite,", len(sayfalar), "sayfa")
