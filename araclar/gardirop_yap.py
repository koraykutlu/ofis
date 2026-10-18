"""Gardırobun parça listesini (gardirop.js) ve küçük resim sayfalarını (varliklar/gardirop/*.png) Character Generator klasöründen üretir.
projeler/ofis-demo içinden: py -3 araclar/gardirop_yap.py

Katman sırası paketin kılavuzundaki gibi: gövde + göz + kıyafet + saç + aksesuar. Oyun seçilen parçaların tam sayfalarını tarayıcıda
üst üste birleştirir; burada yalnız seçim ızgarası için önden duruş karesi (bekleme satırı, 19. kare) kesilir. Küçük resimler okunur olsun diye
parça varsayılan gövdenin üstüne giydirilir (saç ve aksesuar: gövde + göz + varsayılan kıyafet). Varlıklar yeniden dağıtılamaz: çıktılar yerelde kalır.
"""
import json
import re
from pathlib import Path
from PIL import Image

V = Path("varliklar")
KG = V / "limezu-tam/2_Characters/Character_Generator"
CIKTI = V / "gardirop"
PG = V / "limezu-ui/16x16/Portrait_Generator"   # konuşan portre: aynı ten/göz/saç/aksesuar numaraları (kıyafet yok)
KARE = (18 * 16, 32, 19 * 16, 64)   # bekleme satırı, öne bakan ilk kare
SATIR = 32                          # küçük resim sayfasında satır başına kare
VARSAYILAN = {"govde": 3, "goz": 1, "kiyafet": "06_01", "sac": "02_04", "aksesuar": None}   # oyuncunun ilk görünümü

def ac(klasor, ad):
    return Image.open(KG / klasor / "16x16" / f"{ad}.png").convert("RGBA").crop(KARE)

def grupla(klasor, onek):
    """'Outfit_06_01' gibi dosyaları modele göre toplar: [[model, [renk, ...]], ...] (model '06' ya da aksesuarda '03_Backpack')."""
    gr = {}
    for p in sorted((KG / klasor / "16x16").glob(f"{onek}_*.png")):
        m = re.fullmatch(onek + r"_(.+)_(\d+)", p.stem)
        if m: gr.setdefault(m.group(1), []).append(m.group(2))
    return [[k, sorted(v, key=int)] for k, v in sorted(gr.items(), key=lambda kv: int(kv[0].split("_")[0]))]

def sayfa(kareler, ad):
    s = Image.new("RGBA", (16 * min(SATIR, len(kareler)), 32 * ((len(kareler) + SATIR - 1) // SATIR)))
    for i, k in enumerate(kareler): s.alpha_composite(k, ((i % SATIR) * 16, (i // SATIR) * 32))
    s.save(CIKTI / f"{ad}.png")

def ust(*katmanlar):
    o = Image.new("RGBA", (16, 32))
    for k in katmanlar: o.alpha_composite(k)
    return o

CIKTI.mkdir(exist_ok=True)
govdeler = sorted(int(p.stem.split("_")[1]) for p in (KG / "Bodies/16x16").glob("Body_*.png"))
gozler = sorted(int(p.stem.split("_")[1]) for p in (KG / "Eyes/16x16").glob("Eyes_*.png"))
kiyafet, sac, aksesuar = grupla("Outfits", "Outfit"), grupla("Hairstyles", "Hairstyle"), grupla("Accessories", "Accessory")

g0 = ac("Bodies", f"Body_{VARSAYILAN['govde']:02d}")
goz0 = ac("Eyes", f"Eyes_{VARSAYILAN['goz']:02d}")
k0 = ac("Outfits", f"Outfit_{VARSAYILAN['kiyafet']}")
sayfa([ust(ac("Bodies", f"Body_{n:02d}"), goz0) for n in govdeler], "govde")
sayfa([ust(g0, ac("Eyes", f"Eyes_{n:02d}")) for n in gozler], "goz")
sayfa([ust(g0, goz0, ac("Outfits", f"Outfit_{m}_{r}")) for m, rr in kiyafet for r in rr], "kiyafet")
sayfa([ust(g0, goz0, k0, ac("Hairstyles", f"Hairstyle_{m}_{r}")) for m, rr in sac for r in rr], "sac")
sayfa([ust(g0, goz0, k0, ac("Hairstyles", f"Hairstyle_{VARSAYILAN['sac']}"), ac("Accessories", f"Accessory_{m}_{r}")) for m, rr in aksesuar for r in rr], "aksesuar")

# Portresi olan aksesuar modelleri (arı, sırt çantası, eldiven, aşçı şapkasının portresi yok; "_Small" sürümleri kullanılmıyor)
portre_aks = [m for m, rr in aksesuar if all((PG / "Accessories" / f"PG_Accessory_{m}_{int(r)}.png").exists() for r in rr)]
assert all((PG / "Hairstyles" / f"PG_Hairstyle_{m}_{int(r)}.png").exists() for m, rr in sac for r in rr), "portre saçı eksik"
veri = {"portre_aksesuar": portre_aks, "govde": govdeler, "goz": gozler, "kiyafet": kiyafet, "sac": sac, "aksesuar": aksesuar, "varsayilan": VARSAYILAN, "satir": SATIR}
Path("gardirop.js").write_text("// araclar/gardirop_yap.py üretir; elle düzenleme.\nwindow.GARDIROP = " + json.dumps(veri, ensure_ascii=False) + ";\n", encoding="utf-8")
print(f"gövde {len(govdeler)}, göz {len(gozler)}, kıyafet {len(kiyafet)} model / {sum(len(r) for _, r in kiyafet)}, "
      f"saç {len(sac)} / {sum(len(r) for _, r in sac)}, aksesuar {len(aksesuar)} / {sum(len(r) for _, r in aksesuar)}")
