"""Tiled haritasını (harita/ofis.tmj) oyunun okuduğu harita.js'e çevirir. projeler/ofis-demo içinden: py -3 araclar/harita_yap.py
Haritayı Tiled'da (mapeditor.org) aç, nesneleri sürükle/kopyala/sil, kaydet, bu betiği çalıştır, oyunu yenile.

Katmanlar (hepsi nesne katmanı, birim piksel; karo 16 px):
  odalar    dikdörtgen: ad = oda adı; özellikler id, duvar (Room Builder duvar satırı), zemin ("sütun,satır"), rb ("f": ücretsiz set)
  kapilar   32x16 dikdörtgen: sol üst + 8 px = kapının karo konumu (2 karo genişlik, oda sınırında)
  noktalar  kahve, yazici, oyuncu (başlangıç): karo konumu
  mobilya   çizim sırası önemli (aynı alt kenarda önce eklenen arkada kalır). type:
            ekle: name = kaynak; x, y sol üst. Kaynak: atlas/ücretsiz set adı, "hk.<ad>" (paketin hareketli sayfası),
                  "C.<ad>(argümanlar)" (cizimler.js), "birlesik:a,b,c" (atlas parçaları yan yana), "masaKur:<tür>,<n>"
            masa: calismaMasasi; x, y = koltuk karosu × 16 (bölme, koltuk, masa, monitör ve masa üstü kendiliğinden)
            özellikler: ops (JSON: duvar, zemin, engel, golge, sira, kutu, w, h, anim), liste ("ekranlar:<tür>" | "sunucular"),
            davranis ("guguk" | "akvaryum"), monitor (JSON), koltuk ("x,y"), ustune (nesne: onun sırasının üstünde çizilir), siraArti
"""
import json
from pathlib import Path

T = 16
tmj = json.loads(Path("harita/ofis.tmj").read_text(encoding="utf-8"))
katman = {k["name"]: k["objects"] for k in tmj["layers"] if k["type"] == "objectgroup"}
oz = lambda o: {p["name"]: p["value"] for p in o.get("properties", [])}

odalar = []
for o in katman["odalar"]:
    p = oz(o)
    oda = {"id": p["id"], "ad": o["name"], "x": round(o["x"] / T), "y": round(o["y"] / T), "w": round(o["width"] / T), "h": round(o["height"] / T),
           "duvar": int(p["duvar"]), "zemin": [int(v) for v in str(p["zemin"]).split(",")]}
    if p.get("rb"): oda["rb"] = p["rb"]
    odalar.append(oda)
kapilar = [[round(o["x"] / T), round((o["y"] + 8) / T)] for o in katman["kapilar"]]
noktalar = {o["name"]: [round(o["x"] / T), round(o["y"] / T)] for o in katman["noktalar"]}

sira_no = {o["id"]: i for i, o in enumerate(katman["mobilya"])}
mobilya = []
for o in katman["mobilya"]:
    p = oz(o)
    m = {"t": o.get("type") or o.get("class") or "ekle", "k": o["name"]}
    if m["t"] == "masa":
        m.update(x=round(o["x"] / T), y=round(o["y"] / T))
    else:
        m.update(x=round(o["x"]), y=round(o["y"]))
    if p.get("ops"): m["ops"] = json.loads(p["ops"])
    for a in ("liste", "davranis", "koltuk"):
        if p.get(a): m[a] = p[a]
    if p.get("monitor"): m["monitor"] = json.loads(p["monitor"])
    if p.get("ustune"): m["ustune"] = sira_no[p["ustune"]]
    if p.get("siraArti"): m["siraArti"] = int(p["siraArti"])
    mobilya.append(m)

veri = {"odalar": odalar, "kapilar": kapilar, "noktalar": noktalar, "mobilya": mobilya}
Path("harita.js").write_text("// araclar/harita_yap.py üretir (kaynak: harita/ofis.tmj, Tiled); elle düzenleme.\nwindow.HARITA = "
                             + json.dumps(veri, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"harita.js: {len(odalar)} oda, {len(kapilar)} kapı, {len(mobilya)} mobilya")
