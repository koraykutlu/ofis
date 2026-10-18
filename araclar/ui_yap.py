"""Modern UI paketinden (varliklar/limezu-ui) arayüz parçalarını ve uygulama ikonunu üretir. projeler/ofis-demo içinden: py -3 araclar/ui_yap.py
Çıktılar (hepsi varliklar/ altında; lisans: yeniden dağıtılamaz, yayına konmaz):
  ui/cerceve-koyu.png, ui/cerceve-acik.png  9 dilimli panel çerçeveleri (24x25, kenar 4 px) · CSS border-image
  ui/portre-<id>.png  Portrait Generator katmanları: 10 kare x 3 satır (konuş, onayla, hayır), kare 32x32
  ofis.png (32x32, sekme ikonu) ve ofis.ico (16-256, masaüstü kısayolu)"""
from pathlib import Path
from PIL import Image

V = Path("varliklar")
UI = V / "limezu-ui/16x16"
PG = UI / "Portrait_Generator"
CIKIS = V / "ui"
CIKIS.mkdir(exist_ok=True)

stil2 = Image.open(UI / "Modern_UI_Style_2.png").convert("RGBA")
koyu = stil2.crop((12, 235, 36, 260)); koyu.save(CIKIS / "cerceve-koyu.png")
stil2.crop((60, 235, 84, 260)).save(CIKIS / "cerceve-acik.png")

# Portreler oyundaki karakterlere benzetildi: oyuncu karakter oluşturucudaki katmanlarıyla birebir (Body_03, Eyes_01, Hairstyle_02_04);
# Ada hazır karakter 02'ye yakın (açık ten, uzun kahküllü kahverengi saç)
# Diğerleri hazır karakterlerine göre yaklaşık: ten, göz, saç, isteğe bağlı aksesuar (şapka, gözlük)
PORTRELER = {
    "oyuncu": ("PG_Skin_3", "PG_Eyes_01", "PG_Hairstyle_02_4"), "ada": ("PG_Skin_2", "PG_Eyes_01", "PG_Hairstyle_15_3"),
    "muhabir1": ("PG_Skin_2", "PG_Eyes_01", "PG_Hairstyle_08_3"), "muhabir2": ("PG_Skin_1", "PG_Eyes_01", "PG_Hairstyle_10_3"),
    "postaci": ("PG_Skin_2", "PG_Eyes_01", "PG_Hairstyle_12_7", "PG_Accessory_04_Snapback_2"),
    "tarayici": ("PG_Skin_2", "PG_Eyes_01", "PG_Hairstyle_03_7"), "analist": ("PG_Skin_2", "PG_Eyes_01", "PG_Hairstyle_05_6"),
    "editor": ("PG_Skin_4", "PG_Eyes_01", "PG_Hairstyle_01_3"), "denetci": ("PG_Skin_1", "PG_Eyes_01", "PG_Hairstyle_12_5", "PG_Accessory_15_Glasses_1"),
    "sosyal": ("PG_Skin_1", "PG_Eyes_01", "PG_Hairstyle_16_2"), "spiker": ("PG_Skin_2", "PG_Eyes_01", "PG_Hairstyle_22_3"),
    "dagitici": ("PG_Skin_3", "PG_Eyes_01", "PG_Hairstyle_17_4"),
}
portre = {}
for ad, (ten, goz, sac, *aks) in PORTRELER.items():
    im = Image.new("RGBA", (320, 96))
    for p in (PG / "Skins" / f"{ten}.png", PG / "Eyes" / f"{goz}.png", PG / "Hairstyles" / f"{sac}.png", *[PG / "Accessories" / f"{a}.png" for a in aks]):
        im.alpha_composite(Image.open(p).convert("RGBA"))
    im.save(CIKIS / f"portre-{ad}.png"); portre[ad] = im


def dokuz(kaynak, w, h, k=4):
    """24x25 çerçeveyi köşeleri koruyarak w x h'ye büyütür."""
    sw, sh = kaynak.size; o = Image.new("RGBA", (w, h))
    xs = [(0, k, 0, k), (k, sw - k, k, w - 2 * k), (sw - k, sw, w - k, k)]
    ys = [(0, k, 0, k), (k, sh - k, k, h - 2 * k), (sh - k, sh, h - k, k)]
    for sx0, sx1, dx, dw in xs:
        for sy0, sy1, dy, dh in ys:
            o.alpha_composite(kaynak.crop((sx0, sy0, sx1, sy1)).resize((dw, dh), Image.NEAREST), (dx, dy))
    return o


# İkon: koyu panel üstünde oyuncunun portresi (yönetici ofisi)
ikon = dokuz(koyu, 32, 32)
yuz = portre["oyuncu"].crop((0, 0, 32, 32)); bb = yuz.getbbox(); yuz = yuz.crop(bb)
ikon.alpha_composite(yuz, ((32 - yuz.width) // 2, (32 - yuz.height) // 2 + 1))
ikon.save(V / "ofis.png")
# Küçük boyutlarda (16/24) çerçeve yüzü eziyor: yalnız yüz, ince kenarlı koyu zemin üstünde
kucuk = dokuz(koyu, 20, 20, k=3); kucuk.alpha_composite(yuz, ((20 - yuz.width) // 2, (20 - yuz.height) // 2))
gorseller = [kucuk.resize((16, 16), Image.LANCZOS), kucuk.resize((24, 24), Image.LANCZOS), ikon]
gorseller += [ikon.resize((s, s), Image.NEAREST) for s in (48, 64, 128, 256)]
gorseller[-1].save(V / "ofis.ico", sizes=[g.size for g in gorseller], append_images=gorseller[:-1])
print("ui parçaları ve ikon hazır:", sorted(p.name for p in CIKIS.iterdir()))
