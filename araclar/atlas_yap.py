"""Seçilen LimeZu tekil sprite'larını kırpıp tek atlasa (varliklar/atlas.png + atlas.js) toplar; oyuncuyu (varsayılan yönetici görünümü) parçalardan birleştirir."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

V = Path("varliklar")
O = V / "limezu-ofis/4_Modern_Office_singles/16x16/Modern_Office_Singles_{}.png"
TS = V / "limezu-tam/1_Interiors/16x16/Theme_Sorter_Singles"
TSG = V / "limezu-tam/1_Interiors/16x16/Theme_Sorter_Black_Shadow_Singles"
S = TS / "23_Television_and_Film_Studio_SIngles/Television_and_FIlm_Studio_Singles_{}.png"
C = TS / "13_Conference_Hall_Singles/Conference_Hall_Singles_{}.png"
K = TS / "12_Kitchen_Singles/Kitchen_Singles_{}.png"
SEC = {
    # ofis
    "masaGenis": (O, 248), "masaL": (O, 249), "masaBeyaz": (O, 263), "masaBeyazL": (O, 264), "masaKoyu": (O, 268), "masaKoyuL": (O, 269),
    "masaSol": (O, 179), "masaOrta": (O, 180), "masaSag": (O, 181), "masaSariSol": (O, 182), "masaSariOrta": (O, 183), "masaSariSag": (O, 184),
    "masaTuruncuSol": (O, 185), "masaTuruncuOrta": (O, 186), "masaTuruncuSag": (O, 187),
    "masaDesen": (O, 253), "masaDesenL": (O, 254), "masaKisa": (O, 247),
    "monitor": (O, 130), "monitorYan": (O, 131), "ikiliMonitor": (O, 277), "monitorKol": (O, 275), "laptop": (O, 136), "masaSeti": (O, 227),
    "masaSeti2": (O, 231), "klavye": (O, 128), "telefon": (O, 117), "lamba": (O, 141), "kagit": (O, 153), "kagitYigin": (O, 155), "evrak": (O, 113),
    "koltukOn": (O, 102), "koltukArka": (O, 101), "koltukTuruncuOn": (O, 108), "koltukTuruncuArka": (O, 107),
    "bitki1": (O, 98), "bitki2": (O, 99), "bitki3": (O, 100), "tablo1": (O, 96), "tablo2": (O, 97), "posterRenk": (O, 164),
    "yazici": (O, 149), "yazici2": (O, 150), "fotokopi": (O, 177), "sebil": (O, 173), "dolap": (O, 174), "otomat": (O, 175), "sunucu": (O, 176),
    "beyazTahta": (O, 170), "grafikTahta": (O, 171), "pastaTahta": (O, 172), "kanepe": (O, 200), "kanepeL": (O, 201), "kanepe2": (O, 205),
    "berjer": (O, 197), "berjer2": (O, 199), "camBolme": (O, 208), "cop": (O, 329), "cop2": (O, 333), "para": (O, 338),
    "dosyaDolabi": (O, 168), "dosyaDolabi2": (O, 169), "projektor": (O, 165), "evrakCanta": (O, 147),
    # masa üstü çeşitliliği
    "lamba2": (O, 143), "lamba3": (O, 145), "kagitDestesi": (O, 154), "foto1": (O, 161), "foto2": (O, 162), "foto3": (O, 163),
    "fotoAyakli": (O, 157), "fotoAyakli2": (O, 158), "telefon2": (O, 119), "kutuGri": (O, 241),
    # stüdyo
    "kamera": (S, 1), "kamera2": (S, 3), "kameraUzun": (S, 5), "isik": (S, 8), "isik2": (S, 10), "ekranSiyah": (S, 41),
    "haberEkrani": (S, 48), "haberEkrani2": (S, 50), "haberEkrani3": (S, 52), "spikerSol": (S, 54), "spikerOrta": (S, 55),
    "spikerLogo": (S, 57), "spikerSag": (S, 59), "kagitStudyo": (S, 72), "tabure": (S, 32), "koltukStudyo": (S, 29),
    # toplantı
    "konfMasa1": (C, 1), "konfMasa2": (C, 2), "konfMasa3": (C, 3), "konfMasa4": (C, 4), "konfMasa5": (C, 5), "konfMasa6": (C, 6),
    "bayrakKirmizi": (C, 60), "bayrakMavi": (C, 63), "yanginTupu": (C, 59), "perde1": (C, 66), "perde2": (C, 67), "perde3": (C, 68),
    "konfSandalye": (C, 37), "konfSandalye2": (C, 38), "portre1": (C, 54), "portre2": (C, 55),
    # mutfak
    "kahveMakinesi": (K, 177), "kahveMakinesi2": (K, 179), "buzdolabi": (K, 158), "mikrodalga": (K, 187), "mutfakMasa": (K, 310),
    "mutfakMasaCam": (K, 321), "mutfakSandalye": (K, 280), "mutfakSandalye2": (K, 284), "avize": (K, 203),
    # yönetim: gardırop (oyuncunun görünümü)
    "gardirop": (TSG / "4_Bedroom_Black_Shadow_SIngles_16x16/Bedroom_Black_Shadow_Singles_{}.png", 408),   # gölgeli dosyadan (düz setin numaraları farklı)
    "askilik": (TS / "21_Clothing_Store_Singles/Clothing_Store_Singles_{}.png", 429),
    "tezgahSol": (K, 1), "tezgahOrta": (K, 2), "tezgahSag": (K, 3), "tezgahUst": (K, 4),
}
# ---- yere düşen gölge: paketin Black_Shadow sürümlerinden alınır (düz sürümdeki opak pembe zemin lekesi yerine yarı saydam siyah gölge).
# Gölge hep orijinal kutunun içindedir; duvar eşyası ve masa üstü eşyası gölgesiz kalır ----
SG = {
    S: TSG / "23_Television_and_Film_Studio_Black_Shadow_Singles_16x16/Television_and_Film_Studio_Black_Shadow_Singles_{}.png",
    C: TSG / "13_Conference_Hall_Black_Shadow_Singles_16x16/Conference_Hall_Shadow_Singles_{}.png",
    K: TSG / "12_Kitchen_Black_Shadow_Singles_16x16/Kitchen_Shadow_Singles_{}.png",
}
OFIS_PLAIN = Image.open(V / "limezu-ofis/Modern_Office_16x16.png").convert("RGBA")
OFIS_GOLGE = Image.open(V / "limezu-ofis/2_Modern_Office_Black_Shadow/Modern_Office_Black_Shadow.png").convert("RGBA")
GOLGELI = {
    "masaSol", "masaOrta", "masaSag", "masaSariSol", "masaSariOrta", "masaSariSag", "masaTuruncuSol", "masaTuruncuOrta", "masaTuruncuSag",
    "koltukOn", "koltukArka", "koltukTuruncuOn", "koltukTuruncuArka", "bitki1", "bitki2", "bitki3", "yazici2", "fotokopi", "sebil", "dolap",
    "otomat", "sunucu", "kanepe", "kanepe2", "kanepeL", "berjer", "berjer2", "cop", "cop2", "dosyaDolabi", "dosyaDolabi2", "evrakCanta",
    "kagitYigin", "kamera", "kamera2", "kameraUzun", "isik", "isik2", "koltukStudyo", "tabure", "konfMasa1", "konfMasa2", "konfMasa3",
    "konfSandalye", "konfSandalye2", "yanginTupu", "buzdolabi", "mutfakMasa", "mutfakMasaCam", "mutfakSandalye", "mutfakSandalye2",
    "spikerSol", "spikerOrta", "spikerLogo", "spikerSag",
}
# Mutfak masalarında gölge masanın alt kısmını da örttüğü için eşleşme ~%80'de kalır; bunlar için eşik gevşek (gözle doğrulandı: 311, 322)
GEVSEK = {"mutfakMasa": 0.75, "mutfakMasaCam": 0.75}
def eslesme(orij, aday, dx, dy, opak):
    """orij'in opak piksellerinin aday içinde (dx, dy) kaymasıyla (küçük renk farkıyla) tuttuğu oran."""
    op = orij.load(); ap = aday.load()
    yakin = lambda a, b: a[3] == b[3] == 255 and max(abs(a[0] - b[0]), abs(a[1] - b[1]), abs(a[2] - b[2])) <= 8   # gölgeli set renkleri biraz oynatmış
    return sum(yakin(ap[x + dx, y + dy], op[x, y]) for x, y in opak) / len(opak)
def icerir(orij, aday, esik=0.9):
    """Gölgeli aday = orijinal + translucent gölge. Gölge pikselleri farklı olduğundan eşleşme oranla ölçülür; (dx, dy) ya da None."""
    ow, oh = orij.size; aw, ah = aday.size; op = orij.load()
    opak = [(x, y) for y in range(oh) for x in range(ow) if op[x, y][3] > 0]
    if not opak: return None
    ornek = opak[:: max(1, len(opak) // 24)]; en_iyi = None
    for dy in range(ah - oh + 1):
        for dx in range(aw - ow + 1):
            if eslesme(orij, aday, dx, dy, ornek) < min(0.8, esik - 0.15): continue   # örnekle hızlı eleme
            r = eslesme(orij, aday, dx, dy, opak)
            if r >= esik and (en_iyi is None or r > en_iyi[0]): en_iyi = (r, dx, dy)
    return en_iyi and (en_iyi[1], en_iyi[2])
_tema_onbellek = {}
def tema_golgesi(sablon, no, orij, esik=0.9):
    """Aynı numaralı gölgeli tekil orijinalle tutuyorsa onu, tutmuyorsa (mutfak numaraları farklı) klasörde eşleşme arayarak buluruz."""
    kalip = SG[sablon]; yol = Path(str(kalip).format(no)); bb = orij.getbbox()
    if yol.exists():
        aday = Image.open(yol).convert("RGBA")
        if aday.size == orij.size and (ofs := icerir(orij, aday, esik)): return aday, ofs
    if kalip not in _tema_onbellek: _tema_onbellek[kalip] = sorted(kalip.parent.glob("*.png"))
    kes = orij.crop(bb)
    for p in _tema_onbellek[kalip]:
        aday = Image.open(p).convert("RGBA")
        if aday.width < kes.width or aday.height < kes.height: continue
        if (ofs := icerir(kes, aday, esik)): return aday, (ofs[0] - bb[0], ofs[1] - bb[1])
    return None
def ofis_golgesi(no, orij):
    """Modern_Office sayfası ile gölgeli sayfa aynı yerleşimde: tekilin sayfadaki yerini bulup gölgeli kareyi alır."""
    w, h = orij.size; op = orij.load(); pp = OFIS_PLAIN.load(); en_iyi = (0, None)
    opak = [(x, y) for y in range(h) for x in range(w) if op[x, y][3] > 0]
    for y0 in range(0, OFIS_PLAIN.height - h + 1, 16):
        for x0 in range(0, OFIS_PLAIN.width - w + 1, 16):
            r = sum(pp[x0 + x, y0 + y] == op[x, y] for x, y in opak) / len(opak)
            if r > en_iyi[0]: en_iyi = (r, (x0, y0))
            if r == 1: break
    if en_iyi[0] < 0.75: return None   # bazı tekiller sayfadan biraz farklı (dosya dolapları); eşleşmezse gölgesiz kalır
    x0, y0 = en_iyi[1]; return OFIS_GOLGE.crop((x0, y0, x0 + w, y0 + h)), (0, 0)
parcalar, golgeli = {}, []
for ad, (sablon, no) in SEC.items():
    im = Image.open(str(sablon).format(no)).convert("RGBA"); bb = im.getbbox()
    parcalar[ad] = im.crop(bb)
    if ad not in GOLGELI: continue
    bulunan = ofis_golgesi(no, im) if sablon == O else tema_golgesi(sablon, no, im, GEVSEK.get(ad, 0.9))
    if not bulunan: print("gölge eşleşmedi, gölgesiz kaldı:", ad); continue
    gim, (dx, dy) = bulunan; golgeli.append(ad)
    parcalar[ad] = gim.crop((bb[0] + dx, bb[1] + dy, bb[2] + dx, bb[3] + dy))
print("gölgeli:", len(golgeli), "parça")
# ---- kompozit parçalar: toplantı projeksiyon perdesi ve duvar TV çerçeveleri ----
def tv_boyutla(kaynak, w, h, k=6):
    """Paketin siyah TV parçasını (ekranSiyah) 9 dilimli büyütür; alt orta çıkıntı (ayak) korunur."""
    sw, sh = kaynak.size; o = Image.new("RGBA", (w, h))
    xs, ys = [(0, k, 0, k), (k, sw - k, k, w - 2 * k), (sw - k, sw, w - k, k)], [(0, k, 0, k), (k, sh - k, k, h - 2 * k), (sh - k, sh, h - k, k)]
    for sx0, sx1, dx, dw in xs:
        for sy0, sy1, dy, dh in ys:
            o.alpha_composite(kaynak.crop((sx0, sy0, sx1, sy1)).resize((dw, dh), Image.NEAREST), (dx, dy))
    o.alpha_composite(kaynak.crop((sw // 2 - 4, sh - k, sw // 2 + 4, sh)), (w // 2 - 4, h - k))
    return o
parcalar["tvGundem"] = tv_boyutla(parcalar["ekranSiyah"], 84, 28)
parcalar["tvStudyo"] = tv_boyutla(parcalar["ekranSiyah"], 124, 28)
# perde: sol + orta + orta'nın 20 px'i + sağ = 96 px (eski ekran genişliği)
pg = Image.new("RGBA", (96, parcalar["perde1"].height))
for im_, x_ in ((parcalar["perde1"], 0), (parcalar["perde2"], 30), (parcalar["perde2"].crop((0, 0, 20, parcalar["perde2"].height)), 62), (parcalar["perde3"], 82)): pg.alpha_composite(im_, (x_, 0))
parcalar["perdeGenis"] = pg
# basit raf yerleştirme
EN, x, y, sat_h, kutular = 512, 0, 0, 0, {}
for ad, im in sorted(parcalar.items(), key=lambda kv: -kv[1].height):
    if x + im.width > EN: x, y, sat_h = 0, y + sat_h + 1, 0
    kutular[ad] = [x, y, im.width, im.height]; x += im.width + 1; sat_h = max(sat_h, im.height)
atlas = Image.new("RGBA", (EN, y + sat_h))
for ad, (ax, ay, w, h) in kutular.items(): atlas.paste(parcalar[ad], (ax, ay))
atlas.save(V / "atlas.png")
Path("atlas.js").write_text("// araclar/atlas_yap.py üretir; elle düzenleme.\nwindow.ATLAS = " + json.dumps(kutular) + ";\n", encoding="utf-8")

# Oyuncu: gövde + göz + kıyafet + saç
KG = V / "limezu-tam/2_Characters/Character_Generator"
katmanlar = [KG / "Bodies/16x16/Body_03.png", KG / "Eyes/16x16/Eyes_01.png", KG / "Outfits/16x16/Outfit_06_01.png", KG / "Hairstyles/16x16/Hairstyle_02_04.png"]
oyuncu = Image.new("RGBA", (896, 656))
for p in katmanlar: oyuncu.alpha_composite(Image.open(p).convert("RGBA").crop((0, 0, 896, 656)))
oyuncu.save(V / "oyuncu.png")

# önizleme
Z = 3; on = Image.new("RGBA", (1500, 10), (150, 160, 170, 255)); x, y, sat_h, ogeler = 6, 6, 0, []
for ad, im in parcalar.items():
    w, h = max(im.width * Z, 8 * len(ad)), im.height * Z + 14
    if x + w > 1494: x, y, sat_h = 6, y + sat_h + 8, 0
    ogeler.append((ad, im, x, y)); x += w + 8; sat_h = max(sat_h, h)
on = Image.new("RGBA", (1500, y + sat_h + 8), (150, 160, 170, 255)); d = ImageDraw.Draw(on)
for ad, im, xx, yy in ogeler:
    d.text((xx, yy), ad, fill=(0, 0, 0, 255)); on.alpha_composite(im.resize((im.width * Z, im.height * Z), Image.NEAREST), (xx, yy + 12))
kr = oyuncu.crop((0, 32, 16 * 24, 96)).resize((16 * 24 * Z, 64 * Z), Image.NEAREST)
on2 = Image.new("RGBA", (max(on.width, kr.width), on.height + kr.height + 10), (150, 160, 170, 255)); on2.alpha_composite(on); on2.alpha_composite(kr, (0, on.height + 5))
Path("araclar/katalog").mkdir(exist_ok=True); on2.save("araclar/katalog/secim.png"); print(len(parcalar), "parça, atlas", atlas.size)
