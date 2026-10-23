"""Dağıtım paketi: dist/Ofis-<sürüm>.zip (+ dist/SHA256SUMS). projeler/ofis-demo içinden ya da her yerden: `py -3 araclar/paketle.py [--tara] [--yasakli KELIME ...] [--vault KLASOR] [--veri KLASOR] [--cikti ZIP]`.
Sürüm `surum.json > surum`dan gelir (zip adı ve içindeki surum.json). SHA256SUMS yayına (GitHub Release) zip ile birlikte yüklenir; güncelleyici onsuz kurmaz.

Pakete giren: kod (.html .js .py .pyw .ps1 .bat .webmanifest), veri .js dosyaları (atlas, katalog, gardirop, harita), harita/ofis.tmj, yazi/ (Pixelify Sans .ttf + OFL.txt; dosyalar varsa), sesler/ (müzik ve efekt .mp3; dosyalar varsa), araclar/ (paketle.py hariç), moduller/,
README.md, MIMARI.md, SURPRIZLER.md, KURULUM.md, surum.json, LICENSE, Kur.bat ve varliklar/BURAYA.txt (varliklar/ başka hiçbir şey taşımaz).
Girmeyen: varliklar/ içeriği (LimeZu zip'leri ve onlardan üretilen PNG/ICO: lisans gereği dağıtılamaz), __pycache__, .claude, *-yedek, dist/, yedek/, DEVAM.md,
IYILESTIRME-RAPORU.md, TASARIM-*.md, secici2.html, araclar/katalog/, araclar/onizleme.png. Hangi yolun pakete girebileceğini araclar/guncelle.py > yol_incele belirler
(güncelleyicinin kuracağı izin listesiyle aynı); listeye uymayan her dosya hata sayılır (fail-safe), yani pakete giren her şey güncelleyiciden de geçer.

**Ad taraması zorunludur, geçilmeden zip yazılmaz.** Yasaklı adlar yerelde toplanır, pakete girmez:
  - vault notes/ag/kisiler/*.md ön bilgisindeki `ad:` alanları (tam ad + her kelime, en az 3 harf),
  - vault projeler/agim/tests/yerel_yasakli_adlar.txt (satır başına bir ad),
  - veri klasöründeki kisi.json: kullanici_adi, oyuncu_adi, oyuncu_tam_adi, gorev_sahibi,
  - --yasakli ile verilenler (deneme için).
Karşılaştırma iki tarafta da aynı biçimde normalleştirilir: NFKD + aksan/diyakritik silme, ı/İ/I/i -> i, büyük/küçük harf yok, sıfır genişlikli karakterler atılır (ELIF = Elif = elif, Sıbıboğa = Sibiboga,
NFD yazılmış ad, "Se<ZWSP>lin"). Kelime sınırı harf/rakam dışıdır: alt çizgi, nokta, tire ve camelCase bölünür (portre_ad, oyuncuAd, ad_x.js, ad.png). "AdSoyad" gibi bitişik tam ad da yakalanır.
Metin dosyaları BOM'lu/BOM'suz UTF-8, UTF-16/32 ve cp1254 olarak okunur; \\uXXXX kaçışları da çözülüp taranır. Windows kullanıcı adı ve ev klasörü adı da yasaklıdır.
Durum dosyaları (kisi.json, eslesmeler.json, duzen.json, gorunum.json, ziyaret.json, gunluk.txt, guncelleme*.json/log) hangi klasörde olursa olsun pakete hiç girmez.
Dosya içerikleri ve dosya yolları taranır. Eşleşme varsa dosya:satır listelenir ve zip yazılmaz.
Tek geniş istisna: LICENSE dosyasındaki telif satırı ("Copyright (c) YIL tekKelimeTakmaAd") taranmaz (kullanıcının bilerek yazdığı herkese açık kullanıcı adı); satır her çalıştırmada ekrana yazılır.
Dar istisnalar (yazıldığı gibi, harf büyüklüğü korunarak): küçük harfli "özel" (ve "ozel") sıradan bir sözcüktür; tanımlayıcı içindeki ASCII "Ozel" (diyalogOzel, OZEL_AG) sayılmaz, Python dosyalarında küçük harfli "elif" anahtar sözcüktür. Büyük/karışık harfli
"Özel", "ÖZEL", "Elif", "ELIF" ise yakalanır.
"""
import argparse
import codecs
import json
import os
import re
import sys
import unicodedata
import zipfile
import hashlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import guncelle   # izin listesi (yol_incele) ve durum dosyası adları güncelleyiciyle ortaktır

KOK = Path(__file__).resolve().parent.parent
DIST = KOK / "dist"

IZINLI = {".html", ".js", ".py", ".pyw", ".ps1", ".bat", ".md", ".txt", ".json", ".tmj", ".webmanifest"}   # içeriği taranan metin uzantıları
TELIF_SATIRI = re.compile(r"^Copyright \(c\) \d{4} \S+$")
DEPO_SATIRI = re.compile(r'^"depo": "[A-Za-z0-9-]+/[A-Za-z0-9._-]+",?$')   # surum.json yayın deposu: herkese açık GitHub adresi, bilerek yazılır
HARIC_DOSYA = {"DEVAM.md", "IYILESTIRME-RAPORU.md", "secici2.html", "araclar/paketle.py", "araclar/onizleme.png"}
HARIC_KLASOR = {"varliklar", "dist", "__pycache__", "katalog"}       # katalog: yalnız araclar/katalog (üretici önizlemeleri)
HARIC_ONEK = ("TASARIM-",)
HARIC_DURUM = guncelle.HARIC_DURUM                                   # kullanıcı durum dosyaları: hiçbir klasörden pakete girmez
SIFIR_GENISLIK = dict.fromkeys(map(ord, "\u200b\u200c\u200d\u200e\u200f\u2060\u2061\u2062\u2063\u2064\ufeff\u00ad\u180e\u034f"), None)
KIMLIK_OZEL = re.compile(r"(?<=[a-z0-9_])Ozel|Ozel(?=[A-Z_])|OZEL(?=_)|(?<=_)OZEL")
ORTAK_KELIME = {"ozel"}                                              # küçük harfle yazıldıysa sıradan sözcük (bkz. başlık)


def kucuk(s):
    return s.replace("I", "ı").replace("İ", "i").lower()


def norm(s):
    """Karşılaştırma biçimi: sıfır genişlikli karakterler atılır, NFKD + diyakritik silinir, ı/İ/I -> i, küçük harf."""
    s = unicodedata.normalize("NFKD", s.translate(SIFIR_GENISLIK))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.replace("ı", "i").replace("İ", "i").replace("I", "i").lower()


def kelimelere_bol(s):
    """[(özgün kelime, normalleştirilmiş kelime)]: harf/rakam dışı her şey ve camelCase sınır; NFD yazılmış harfler önce birleştirilir."""
    s = unicodedata.normalize("NFC", s.translate(SIFIR_GENISLIK))
    cikis, onceki = [], ""
    for c in s:
        if onceki and onceki.islower() and c.isupper():
            cikis.append(" ")
        cikis.append(c if (c.isalnum() or unicodedata.combining(c)) else " ")
        onceki = c
    return [(w, norm(w)) for w in "".join(cikis).split()]


# ---------------- dosya listesi ----------------
def dosyalar():
    """(mutlak yol, pakette göreli yol) çiftleri, izinli olanlar; izinsiz uzantı bulunursa SystemExit."""
    sonuc, sorunlu = [], []
    for yol in sorted(KOK.rglob("*")):
        if not yol.is_file():
            continue
        g = yol.relative_to(KOK)
        parcalar = g.parts
        if g.as_posix() == "varliklar/BURAYA.txt":
            sonuc.append((yol, g.as_posix()))
            continue
        if any(p.startswith(".") or p.endswith("-yedek") or p == "__pycache__" for p in parcalar):
            continue
        if parcalar[0] in ("varliklar", "dist", "yedek") or (parcalar[0] == "araclar" and len(parcalar) > 2 and parcalar[1] == "katalog"):
            continue
        if g.as_posix() in HARIC_DOSYA or parcalar[-1].startswith(HARIC_ONEK) and len(parcalar) == 1:
            continue
        if parcalar[-1].lower() in HARIC_DURUM:
            continue
        if guncelle.yol_incele(g.as_posix()) != "ok":
            sorunlu.append(g.as_posix())
            continue
        sonuc.append((yol, g.as_posix()))
    if sorunlu:
        raise SystemExit("Pakete girmemesi gereken ya da tanınmayan dosyalar var (uzantı izinli değil):\n  " + "\n  ".join(sorunlu))
    return sonuc


# ---------------- yasaklı adlar ----------------
def veri_klasoru(arg):
    if arg:
        return Path(os.path.expandvars(arg)).expanduser()
    return Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "OfisDemo"


def yasakli_adlar(vault_arg, veri_arg, ek):
    """(tam adlar, kelimeler, kaynak özeti)"""
    adlar, kaynak = set(), []
    kisi = {}
    try:
        kisi = json.loads((veri_klasoru(veri_arg) / "kisi.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        kaynak.append("kisi.json yok ya da okunamadı")
    vault = Path(os.path.expandvars(vault_arg)) if vault_arg else (Path(kisi["vault"]) if isinstance(kisi.get("vault"), str) and Path(kisi["vault"]).is_dir() else KOK.parent.parent)
    for alan in ("kullanici_adi", "oyuncu_adi", "oyuncu_tam_adi", "gorev_sahibi"):
        if isinstance(kisi.get(alan), str) and kisi[alan].strip():
            adlar.add(kisi[alan].strip())
    n = 0
    for f in sorted((vault / "notes" / "ag" / "kisiler").glob("*.md")):
        try:
            m = re.match(r"---\s*\n(.*?)\n---", f.read_text(encoding="utf-8-sig"), re.S)
        except OSError:
            continue
        for satir in (m.group(1).splitlines() if m else []):
            if satir.startswith("ad:"):
                ad = satir[3:].strip().strip("'\"")
                if ad:
                    adlar.add(ad)
                    n += 1
    kaynak.append(f"kisiler ad: {n}")
    try:
        satirlar = (vault / "projeler" / "agim" / "tests" / "yerel_yasakli_adlar.txt").read_text(encoding="utf-8-sig").splitlines()
        eklenen = [s.strip() for s in satirlar if s.strip() and not s.lstrip().startswith("#")]
        adlar.update(eklenen)
        kaynak.append(f"yerel_yasakli_adlar: {len(eklenen)}")
    except OSError:
        kaynak.append("yerel_yasakli_adlar.txt yok")
    adlar.update(a for a in ek if a.strip())
    for k in (os.environ.get("USERNAME"), os.environ.get("USER"), Path.home().name):   # makine yolundaki kullanıcı adı
        if k and len(k) >= 3:
            adlar.add(k)
    kaynak.append("makine kullanıcı adı")
    kelimeler = set()
    for ad in adlar:
        for _, w in kelimelere_bol(ad):
            if len(w) >= 3:
                kelimeler.add(w)
    return adlar, kelimeler, kaynak


def metin_oku(yol):
    """Dosyayı BOM'lu/BOM'suz UTF-8, UTF-16/32 (BOM'suzu NUL oranından), yoksa cp1254 olarak çözer."""
    b = yol.read_bytes()
    if b.startswith(codecs.BOM_UTF8):
        return b.decode("utf-8-sig", "replace")
    if b.startswith((codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)):
        return b.decode("utf-32", "replace")
    if b.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return b.decode("utf-16", "replace")
    if len(b) >= 4 and b.count(0) > len(b) // 4:   # BOM'suz UTF-16
        return b.decode("utf-16-be" if b[0] == 0 else "utf-16-le", "replace")
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return b.decode("cp1254", "replace")


def tara(liste, adlar, kelimeler):
    """[(göreli yol, satır no, eşleşen, satırdan kesit)]: içerikte ve dosya yolunda (normalleştirilmiş, camelCase/alt çizgi bölünmüş kelimeler)."""
    birlesik = {}   # "ad" + "soyad" bitişik yazımı: koraykutlu gibi
    for a in adlar:
        parcalar = [w for _, w in kelimelere_bol(a) if w]
        if len(parcalar) >= 2:
            birlesik["".join(parcalar)] = a
        if len(parcalar) == 1 and len(parcalar[0]) >= 3:
            birlesik.setdefault(parcalar[0], a)

    def satirda(metin, uzanti):
        bulunan = set()
        metin = KIMLIK_OZEL.sub(" ", metin)   # diyalogOzel, OZEL_AG gibi kod tanımlayıcı parçaları (dar istisna; bkz. başlık)
        for ozgun, n in kelimelere_bol(metin):
            if n in kelimeler or n in birlesik:
                if n in ORTAK_KELIME and ozgun == ozgun.lower() and ozgun in ("özel", "ozel"):
                    continue
                if n == "elif" and ozgun == "elif" and uzanti in (".py", ".pyw"):
                    continue
                bulunan.add(n)
        return bulunan

    kacis = re.compile(r"\\u([0-9a-fA-F]{4})")
    bulunan = []
    for yol, g in liste:
        for w in satirda(g, ""):
            bulunan.append((g, 0, w, "(dosya yolu)"))
        if yol.suffix.lower() not in IZINLI and yol.name != "LICENSE":
            continue
        try:
            metin = metin_oku(yol)
        except OSError:
            continue
        for no, satir in enumerate(metin.splitlines(), 1):
            if yol.name == "surum.json" and DEPO_SATIRI.match(satir.strip()):
                print(f"Bilgi: surum.json depo satırı taranmadı (herkese açık yayın deposu): {satir.strip()}")
                continue
            if yol.name == "LICENSE" and TELIF_SATIRI.match(satir.strip()):
                print(f"Bilgi: LICENSE telif satırı taranmadı (kullanıcının bilerek yazdığı herkese açık ad): {satir.strip()}")
                continue
            ws = satirda(satir, yol.suffix.lower())
            if "\\u" in satir:   # \u00f6 gibi kaçışlarla gizlenmiş adlar
                ws |= satirda(kacis.sub(lambda m: chr(int(m.group(1), 16)), satir), yol.suffix.lower())
            for w in ws:
                bulunan.append((g, no, w, satir.strip()[:110]))
    return bulunan


def main():
    a = argparse.ArgumentParser(description="Ofis dağıtım paketi")
    a.add_argument("--tara", action="store_true", help="yalnız ad taraması yap, zip yazma")
    a.add_argument("--yasakli", nargs="*", default=[], help="ek yasaklı ad(lar) (deneme)")
    a.add_argument("--vault")
    a.add_argument("--veri")
    a.add_argument("--cikti", help="zip yolu (varsayılan dist/Ofis-<sürüm>.zip)")
    args = a.parse_args()
    try:
        sys.stdout.reconfigure(errors="replace")
    except AttributeError:
        pass
    liste = dosyalar()
    adlar, kelimeler, kaynak = yasakli_adlar(args.vault, args.veri, args.yasakli)
    print(f"Paket ağacı: {len(liste)} dosya. Yasaklı ad kaynakları: {'; '.join(kaynak)}. Taranan: {len(adlar)} ad, {len(kelimeler)} kelime.")
    if not adlar:
        print("Uyarı: yasaklı ad listesi boş; tarama anlamsız. --vault/--veri doğru mu?")
        return 2
    bulunan = tara(liste, adlar, kelimeler)
    if bulunan:
        print(f"\nAD TARAMASI BAŞARISIZ: {len(bulunan)} eşleşme. Zip yazılmadı.")
        for g, no, w, kesit in bulunan[:60]:
            print(f"  {g}:{no}  [{w}]  {kesit}")
        if len(bulunan) > 60:
            print(f"  ... {len(bulunan) - 60} eşleşme daha")
        return 1
    print("Ad taraması temiz.")
    if args.tara:
        return 0
    surum, depo = guncelle.surum_oku(KOK)
    if surum == "0.0.0":
        print("surum.json okunamadı ya da sürüm geçersiz (örnek: 0.9.0); zip yazılmadı.")
        return 2
    DIST.mkdir(exist_ok=True)
    cikti = Path(args.cikti) if args.cikti else DIST / f"Ofis-{surum}.zip"
    with zipfile.ZipFile(cikti, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for yol, g in liste:
            z.write(yol, "Ofis/" + g)
    boyut = cikti.stat().st_size
    ozet = hashlib.sha256(cikti.read_bytes()).hexdigest()
    (cikti.parent / "SHA256SUMS").write_bytes(f"{ozet}  {cikti.name}".encode("utf-8") + b"\n")
    print(f"Yazıldı: {cikti} ({boyut / 1024:.0f} KB, {len(liste)} dosya, sürüm {surum})")
    print(f"Yazıldı: {cikti.parent / 'SHA256SUMS'} ({ozet[:12]}...). Release'e zip ile birlikte yükle; güncelleyici bunsuz kurmaz.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
