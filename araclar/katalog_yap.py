"""Düzenle modunun eşya kataloğu: LimeZu tekil sprite'larını (Modern Office + Modern Interiors gölgeli tema klasörleri) kategori başına
tek sayfaya toplar. Çıktı: varliklar/katalog/<kategori>.png ve katalog.js (window.KATALOG). projeler/ofis-demo içinden: py -3 araclar/katalog_yap.py

Eşya kimliği "kat:<kategori>/<dosya numarası>"; numara paketteki dosya adından gelir, böylece betik yeniden çalışsa da kayıtlı düzenler bozulmaz.
Varlıklar lisans gereği yeniden dağıtılamaz: varliklar/ ve onun ürettiği sayfalar hiçbir yere yayınlanmaz; katalog.js yalnız kutu koordinatlarıdır.
"""
import json
import re
from pathlib import Path
from PIL import Image

V = Path("varliklar")
CIKTI = V / "katalog"
TSG = V / "limezu-tam/1_Interiors/16x16/Theme_Sorter_Black_Shadow_Singles"
GEN = 1024   # sayfa genişliği

# (kimlik, görünen ad, klasör) — sıra panelde de bu
KATEGORILER = [("ofis", "Ofis", V / "limezu-ofis/4_Modern_Office_singles/16x16")]
ADLAR = {"LivingRoom": ("salon", "Oturma odası"), "Bathroom": ("banyo", "Banyo"), "Bedroom": ("yatak", "Yatak odası"),
         "Classroom": ("sinif", "Sınıf ve kütüphane"), "Music": ("muzik", "Müzik ve spor"), "Art": ("sanat", "Sanat"), "Gym": ("spor", "Spor salonu"),
         "Fishing": ("balik", "Balıkçılık"), "Birthday": ("dogumgunu", "Doğum günü"), "Halloween": ("cadilar", "Cadılar bayramı"),
         "Kitchen": ("mutfak", "Mutfak"), "Conference": ("konferans", "Konferans salonu"), "Basement": ("bodrum", "Bodrum"),
         "Christmas": ("yilbasi", "Yılbaşı"), "Grocery": ("market", "Market"), "Jail": ("hapis", "Hapishane"), "Hospital": ("hastane", "Hastane"),
         "Japanese": ("japon", "Japon iç mekân"), "Clothing": ("giyim", "Giyim mağazası"), "Museum": ("muze", "Müze"),
         "Television": ("studyo", "TV ve film stüdyosu"), "Ice": ("dondurma", "Dondurmacı"), "Shooting": ("poligon", "Atış poligonu"),
         "Condominium": ("apartman", "Apartman")}
for d in sorted(TSG.iterdir(), key=lambda p: int(p.name.split("_")[0])):
    anahtar = d.name.split("_")[1]
    if anahtar in ADLAR:
        KATEGORILER.append((*ADLAR[anahtar], d))

def numara(p):
    m = re.search(r"_(\d+)\.png$", p.name)
    return int(m.group(1)) if m else None

CIKTI.mkdir(exist_ok=True)
ozet, ogeler = [], {}
for kid, ad, klasor in KATEGORILER:
    parcalar = []
    for p in klasor.glob("*.png"):
        no = numara(p)
        if no is None:
            continue
        im = Image.open(p).convert("RGBA"); bb = im.getbbox()
        if not bb:
            continue
        parcalar.append((no, im.crop(bb)))
    parcalar.sort(key=lambda t: t[0])
    # raf yerleştirme: numara sırasıyla, satır dolunca alta geç (panelde de bu sırayla görünür)
    x = y = raf = 0; kutular = []
    for no, im in parcalar:
        w, h = im.size
        if x + w > GEN:
            x, y, raf = 0, y + raf + 1, 0
        kutular.append((no, x, y, w, h)); x += w + 1; raf = max(raf, h)
    sayfa = Image.new("RGBA", (GEN, y + raf + 1))
    for (no, im), (_, kx, ky, _, _) in zip(parcalar, kutular):
        sayfa.alpha_composite(im, (kx, ky))
    sayfa.save(CIKTI / f"{kid}.png", optimize=True)
    ozet.append({"id": kid, "ad": ad, "n": len(kutular)})
    ogeler[kid] = [list(k) for k in kutular]
    print(f"{kid:10} {len(kutular):4} parça  {sayfa.size[0]}x{sayfa.size[1]}")

js = ("// araclar/katalog_yap.py üretir; elle düzenleme. Öğe: [dosya no, x, y, w, h] (varliklar/katalog/<id>.png içinde)\n"
      "window.KATALOG = " + json.dumps({"kategoriler": ozet, "ogeler": ogeler}, separators=(",", ":")) + ";\n")
Path("katalog.js").write_text(js, encoding="utf-8")
print("toplam", sum(k["n"] for k in ozet), "parça;", len(js) // 1024, "KB katalog.js")
