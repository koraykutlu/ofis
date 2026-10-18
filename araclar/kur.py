"""Ofis kurulumu (Windows, Python 3.8+). Kur.bat bunu çağırır; elle: `py -3 araclar/kur.py [bayraklar]`.

Ne yapar (her adım tekrar çalıştırılabilir; hazır olanı atlar, `--yeniden` hepsini baştan yapar):
  1. Python ve Pillow'u denetler (Pillow yoksa `pip install --user pillow` yapar).
  2. LimeZu paketlerinin zip'lerini bir klasörde bulur ve **içeriğine göre** tanır (dosya adına bakmaz): Modern Interiors, Modern Office,
     Modern User Interface, Modern Interiors Free. Eksik olanı adı ve adresiyle söyler.
  3. Kişi sorularını sorar (adın, oyundaki adın, ofis ve asistan adı, ikinci beyin klasörün) ve VERI/kisi.json'a yazar.
  4. Zip'leri varliklar/ altına açar (limezu-tam, limezu-ofis, limezu-ui, limezu-free) ve üreticileri çalıştırır:
     atlas_yap, katalog_yap, gardirop_yap, ui_yap (atlas.png, katalog/, gardirop/, ui/, oyuncu.png, ofis.png, ofis.ico).
  5. Masaüstü ve Başlat menüsü kısayolunu kurar (kisayol_kur.ps1).
  6. Claude Code'u denetler (yoksa oyun yine kurulur; yalnız asistanla gerçek sohbet çalışmaz) ve istersen Ofis'i açar.
Varlıklar lisans gereği paketle gelmez; hepsi senin indirdiğin zip'lerden üretilir ve bu bilgisayarda kalır.

Güncelleme: yeni sürüm zip'ini eski kurulumun üstüne açıp Kur.bat'ı çalıştırmak yeter. Hazır paketler, kişi ayarı ve veri korunur, soru sorulmaz;
yalnız görsel üreticilerinin kodu değiştiyse görseller yeniden üretilir (varliklar/.uretim.json damgası). Uygulama içinden: Ayarlar > Güncelleme.

Bayraklar (test ve sessiz kurulum için):
  --sessiz            soru sorma; varsayılanları ya da aşağıdaki bayrakları kullan, eksik paket varsa hata ver
  --varliklar KLASOR  zip'lerin bulunduğu klasör (varsayılan: sorar; İndirilenler ve varliklar/ önerilir)
  --veri KLASOR       kisi.json'un yazılacağı veri klasörü (varsayılan %LOCALAPPDATA%\\OfisDemo; ofis.pyw --veri ile aynı)
  --kisayolsuz        kısayol adımını atla
  --yeniden           hazır görünen açma ve üretim adımlarını da baştan yap (kişi sorularını da yeniden sorar)
  --kisi              yalnız kişi sorularını yeniden sor (varsayılan: mevcut kisi.json korunur, sorulmaz)
  --uret              yalnız görsel üreticilerini gerekiyorsa çalıştır (güncelleyici kullanır; soru yok, varlık yoksa atlar)
  --guncelle ZIP      yerel sürüm zip'ini kur (araclar/guncelle.py --zip ile aynı)
  --kullanici-adi, --oyuncu-adi, --oyuncu-tam-adi, --ofis-adi, --asistan-adi, --vault   kişi alanları (sessiz kurulumda soru yerine)
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent          # ofis klasörü
V = KOK / "varliklar"
ARAC = KOK / "araclar"
DAMGA = V / ".uretim.json"                            # üretici betiklerinin son çalışan özetleri (güncellemede değişeni anlamak için)
ADIM = 6

# LimeZu paketleri: zip'in içindeki işaret dosyalarına göre tanınır. isaret: hepsi bulunmalı. ac: açılacak önekler (None = hepsi).
PAKETLER = [
    {"anahtar": "tam", "klasor": "limezu-tam", "ad": "Modern Interiors", "adres": "https://limezu.itch.io/moderninteriors",
     "isaret": ["1_Interiors/16x16/Theme_Sorter_Singles/", "2_Characters/Character_Generator/", "3_Animated_objects/16x16/spritesheets/"],
     "ac": ["1_Interiors/16x16/", "2_Characters/Character_Generator/", "3_Animated_objects/16x16/", "LICENSE.txt", "READ_ME.txt"],   # 32/48 px ve eski setler gerekmez
     "hazir": ["1_Interiors/16x16/Theme_Sorter_Singles", "3_Animated_objects/16x16/spritesheets/animated_door_glass_double.png",
               "2_Characters/Character_Generator/0_Premade_Characters/16x16/Premade_Character_01.png"]},
    {"anahtar": "ofis", "klasor": "limezu-ofis", "ad": "Modern Office", "adres": "https://limezu.itch.io/modernoffice",
     "isaret": ["Modern_Office_16x16.png", "4_Modern_Office_singles/16x16/", "1_Room_Builder_Office/Room_Builder_Office_16x16.png"], "ac": None,
     "hazir": ["Modern_Office_16x16.png", "1_Room_Builder_Office/Room_Builder_Office_16x16.png", "4_Modern_Office_singles/16x16"]},
    {"anahtar": "ui", "klasor": "limezu-ui", "ad": "Modern User Interface", "adres": "https://limezu.itch.io/modernuserinterface",
     "isaret": ["16x16/Portrait_Generator/Skins/", "16x16/Modern_UI_Style_2.png"], "ac": None,
     "hazir": ["16x16/Modern_UI_Style_2.png", "16x16/Portrait_Generator/Skins"]},
    {"anahtar": "free", "klasor": "limezu-free", "ad": "Modern Interiors Free (ücretsiz sürüm)", "adres": "https://limezu.itch.io/ (Modern Interiors - Free)",
     "isaret": ["Modern tiles_Free/Interiors_free/16x16/Interiors_free_16x16.png", "Modern tiles_Free/Interiors_free/16x16/Room_Builder_free_16x16.png"], "ac": None,
     "hazir": ["Modern tiles_Free/Interiors_free/16x16/Interiors_free_16x16.png"]},
]

# Üreticiler (sırayla) ve çıktıları: dosya ya da dolu klasör
URETICILER = [
    ("atlas_yap.py", "ofis eşyaları atlası ve varsayılan oyuncu görünümü", ["varliklar/atlas.png", "varliklar/oyuncu.png", "atlas.js"]),
    ("katalog_yap.py", "Düzenle modunun eşya kataloğu (yaklaşık 1 dakika)", ["varliklar/katalog", "katalog.js"]),
    ("gardirop_yap.py", "gardırop küçük resimleri", ["varliklar/gardirop", "gardirop.js"]),
    ("ui_yap.py", "arayüz çerçeveleri, portreler ve uygulama ikonu", ["varliklar/ui/cerceve-koyu.png", "varliklar/ui/portre-oyuncu.png", "varliklar/ofis.png", "varliklar/ofis.ico"]),
]


def yaz(*a):
    print(*a, flush=True)


def baslik(n, metin):
    yaz(f"\n[{n}/{ADIM}] {metin}" if isinstance(n, int) else f"\n[{n}] {metin}")


def ozet_dosya(yol):
    return hashlib.sha256(Path(yol).read_bytes()).hexdigest()


def damga_oku():
    try:
        d = json.loads(DAMGA.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def surum_metni():
    try:
        return str(json.loads((KOK / "surum.json").read_text(encoding="utf-8-sig")).get("surum") or "")
    except (OSError, ValueError, AttributeError):
        return ""


class Hata(Exception):
    pass


def sor(soru, varsayilan="", sessiz=False):
    """Soru sorar; sessizde ya da boş cevapta varsayılan döner."""
    if sessiz:
        return varsayilan
    try:
        c = input(f"  {soru}" + (f" [{varsayilan}]" if varsayilan else "") + ": ").strip()
    except EOFError:
        return varsayilan
    return c or varsayilan


def evet_mi(soru, varsayilan=True, sessiz=False):
    if sessiz:
        return varsayilan
    c = sor(soru + (" (E/h)" if varsayilan else " (e/H)"), "", False).lower()
    return varsayilan if not c else c.startswith(("e", "y"))


# ---------------- 1. Python ve Pillow ----------------
def python_pillow(sessiz):
    baslik(1, "Python ve Pillow denetleniyor")
    if sys.version_info < (3, 8):
        raise Hata(f"Python {sys.version.split()[0]} çok eski; 3.8 ya da yenisi gerekir (python.org/downloads).")
    yaz(f"  Python {sys.version.split()[0]} uygun.")
    try:
        import PIL  # noqa: F401
        yaz(f"  Pillow {PIL.__version__} kurulu.")
        return
    except ImportError:
        pass
    yaz("  Pillow (resim kütüphanesi) kurulu değil; görselleri üretmek için gerekir.")
    if not evet_mi("Şimdi kurayım mı? (pip install --user pillow; internet gerekir)", True, sessiz):
        raise Hata("Pillow olmadan kurulum yapılamaz. Elle: py -3 -m pip install --user pillow")
    p = subprocess.run([sys.executable, "-m", "pip", "install", "--user", "pillow"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise Hata("Pillow kurulamadı (internet bağlantısı var mı?).\n" + (p.stderr or p.stdout)[-400:])
    try:
        import importlib
        importlib.invalidate_caches()
        import PIL  # noqa: F401,F811
    except ImportError:
        raise Hata("Pillow kuruldu ama bu oturumda yüklenemedi; Kur.bat'ı yeniden çalıştır.")
    yaz("  Pillow kuruldu.")


# ---------------- 2. LimeZu zip'lerini bul ----------------
def zip_tani(zip_yolu):
    """Zip'in hangi LimeZu paketi olduğunu içeriğinden bulur: (paket, önek) ya da None. önek: zip kökünde sarmalayıcı klasör varsa o."""
    try:
        with zipfile.ZipFile(zip_yolu) as z:
            adlar = z.namelist()
    except (zipfile.BadZipFile, OSError):
        return None
    for paket in PAKETLER:
        onekler = set()
        for isaret in paket["isaret"]:
            bulunan = next((a for a in adlar if isaret in a and (a.endswith(isaret) or isaret.endswith("/"))), None)
            if bulunan is None:
                break
            onekler.add(bulunan[:bulunan.index(isaret)])
        else:
            if len(onekler) == 1:
                return paket, onekler.pop()
    return None


def zipleri_bul(klasorler):
    """Verilen klasörlerdeki (üst düzey) *.zip dosyalarını tanır: {anahtar: (zip yolu, önek)}"""
    bulunan = {}
    for kl in klasorler:
        if not kl.is_dir():
            continue
        for z in sorted(kl.glob("*.zip")):
            t = zip_tani(z)
            if t and t[0]["anahtar"] not in bulunan:
                bulunan[t[0]["anahtar"]] = (z, t[1])
    return bulunan


def hazir_mi(paket):
    return all((V / paket["klasor"] / h).exists() for h in paket["hazir"])


def paketleri_topla(args, sessiz):
    baslik(2, "LimeZu paketleri aranıyor")
    # Sırayla bakılan yerler: --varliklar, Kur.bat'ın klasörü, İndirilenler, Masaüstü (OneDrive'lı olanı da), varliklar/
    adaylar = []
    if args.varliklar:
        adaylar.append(Path(os.path.expandvars(args.varliklar)).expanduser())
    ev = Path.home()
    onedrive = os.environ.get("OneDrive")
    adaylar += [KOK, ev / "Downloads", ev / "Desktop"] + ([Path(onedrive) / "Desktop", Path(onedrive) / "Masaüstü"] if onedrive else [])
    ilk = True
    while True:
        gorulen, tekil = set(), []
        for k in adaylar + [V]:
            try:
                anahtar = str(k.resolve()).lower()
            except OSError:
                continue
            if anahtar not in gorulen:
                gorulen.add(anahtar)
                tekil.append(k)
        bulunan = zipleri_bul(tekil)
        eksik = [p for p in PAKETLER if p["anahtar"] not in bulunan and (args.yeniden or not hazir_mi(p))]
        for p in PAKETLER:
            if p["anahtar"] in bulunan:
                yaz(f"  {p['ad']}: bulundu ({bulunan[p['anahtar']][0]})")
            elif p in eksik:
                yaz(f"  {p['ad']}: BULUNAMADI")
            else:
                yaz(f"  {p['ad']}: zaten açılmış, zip gerekmiyor")
        if not eksik:
            return bulunan
        yaz("\n  Eksik paketler. LimeZu'nun bu paketleri itch.io'da satılır; satın alıp zip olarak indir (zip'i açma):")
        for p in eksik:
            yaz(f"    - {p['ad']}: {p['adres']}")
        if sessiz:
            raise Hata("Eksik paket var. Zip'lerin klasörünü --varliklar KLASOR ile ver.")
        if ilk:
            yaz(f"\n  İndirdiğin zip'i şu klasöre koyman yeterli: {KOK}")
            yaz("  (İndirilenler ve Masaüstü'ne koyduysan zaten oradan bulurum; dosya adı önemli değil.)")
            ilk = False
        try:
            c = input("  Zip'i koyduysan Enter'a bas, yeniden arayayım. Başka bir klasörü de taramamı istersen yolunu yaz. Çıkmak için q yaz: ").strip()
        except EOFError:
            c = "q"
        if c.lower() in ("q", "çık", "cik"):
            raise Hata("Eksik paketler olmadan devam edilemez. Zip'leri indirdikten sonra Kur.bat'ı yeniden çalıştır; biten adımlar atlanır.")
        if c:
            yeni = Path(os.path.expandvars(c.strip('"'))).expanduser()
            if yeni.is_dir():
                adaylar.insert(0, yeni)
            else:
                yaz(f"  Böyle bir klasör yok: {yeni}")


# ---------------- 3. Kişi ayarı ----------------
def veri_klasoru(args):
    if args.veri:
        return Path(os.path.expandvars(args.veri)).expanduser().resolve()
    return Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "OfisDemo"


def vault_gecerli(yol):
    try:
        return yol.is_dir() and any(c.is_dir() and c.name.endswith("Companion") for c in yol.iterdir())
    except OSError:
        return False


def kisi_ayari(args, sessiz):
    baslik(3, "Kişi ayarı")
    sorulsun = args.yeniden or args.kisi
    veri = veri_klasoru(args)
    dosya = veri / "kisi.json"
    mevcut = {}
    try:
        mevcut = json.loads(dosya.read_text(encoding="utf-8-sig"))
        if not isinstance(mevcut, dict):
            raise ValueError("nesne değil")
    except FileNotFoundError:
        mevcut = {}
    except (OSError, ValueError, RecursionError):
        mevcut = {}
        yedek = dosya.with_name(f"kisi.json.bozuk-{time.strftime('%Y%m%d-%H%M%S')}")   # bozuk dosya ezilmeden önce saklanır
        try:
            shutil.copy2(dosya, yedek)
            yaz(f"  Uyarı: {dosya} okunamadı; bozuk dosya {yedek.name} olarak saklandı, yenisi yazılacak.")
        except OSError:
            yaz(f"  Uyarı: {dosya} okunamadı ve yedeklenemedi; üzerine yazılmıyor.")
            return dosya
    bayrak = {"kullanici_adi": args.kullanici_adi, "oyuncu_adi": args.oyuncu_adi, "oyuncu_tam_adi": args.oyuncu_tam_adi,
              "ofis_adi": args.ofis_adi, "asistan_adi": args.asistan_adi, "vault": args.vault}
    bayrak = {k: v for k, v in bayrak.items() if v}
    if mevcut and not bayrak and (sessiz or not sorulsun):
        # güncelleme ya da yeniden çalıştırma: kişi ayarı sorulmaz (değiştirmek için Kur.bat --kisi)
        yaz(f"  Mevcut ayar korunuyor ({dosya}). Değiştirmek için: Kur.bat --kisi")
        return dosya
    yeni = dict(mevcut)
    yeni.update(bayrak)
    if not sessiz and not bayrak:
        yaz("  Birkaç kısa soru. Boş bırakırsan köşeli parantezdeki değer kullanılır.")
        yeni["kullanici_adi"] = sor("Adın (yapay zekâ sana böyle hitap eder)", mevcut.get("kullanici_adi", "")) or yeni.get("kullanici_adi", "")
        ilk = (yeni.get("kullanici_adi") or "").split()[0] if yeni.get("kullanici_adi") else ""
        yeni["oyuncu_adi"] = sor("Oyundaki karakterinin adı (kısa)", mevcut.get("oyuncu_adi", ilk)) or ""
        yeni["oyuncu_tam_adi"] = sor("Oda tabelasında ve başlıkta görünecek tam ad", mevcut.get("oyuncu_tam_adi", yeni.get("kullanici_adi") or yeni["oyuncu_adi"])) or ""
        yeni["ofis_adi"] = sor("Ofisinin adı", mevcut.get("ofis_adi", "Yönetim Ofisi"))
        yeni["asistan_adi"] = sor("Beyin arşivcisi asistanının adı", mevcut.get("asistan_adi", "Ada"))
        while True:
            v = sor("İkinci beyin klasörün (içinde '...Companion' klasörü olan; boş bırak = sonra eklerim)", mevcut.get("vault", ""))
            if not v:
                yaz("  Klasör verilmedi: sohbet için sonra kisi.json'daki \"vault\" alanını doldur.")
                break
            yol = Path(os.path.expandvars(v)).expanduser()
            if vault_gecerli(yol):
                yeni["vault"] = str(yol.resolve())
                break
            yaz("  Bu klasör yok ya da içinde '...Companion' klasörü bulunmuyor; yeniden dene.")
    elif "vault" in bayrak and not vault_gecerli(Path(os.path.expandvars(bayrak["vault"])).expanduser()):
        yaz("  Uyarı: verilen vault klasörü yok ya da içinde '...Companion' klasörü bulunmuyor; önceki ayar (varsa) korunuyor.")
        if mevcut.get("vault"):
            yeni["vault"] = mevcut["vault"]   # geçersiz bayrak eski geçerli değeri silmesin
        else:
            yeni.pop("vault", None)
    yeni = {k: v for k, v in yeni.items() if v not in ("", None)}
    veri.mkdir(parents=True, exist_ok=True)
    dosya.write_text(json.dumps(yeni, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    yaz(f"  Yazıldı: {dosya}")
    return dosya


# ---------------- 4. Aç ve üret ----------------
def guvenli_ac(zip_yolu, onek, paket, hedef):
    """Zip'i hedefe açar: sarmalayıcı önek atılır, yol dışına çıkan girdiler (../ ya da mutlak yol) reddedilir."""
    kok = hedef.resolve()
    sayi = 0
    with zipfile.ZipFile(zip_yolu) as z:
        for bilgi in z.infolist():
            ad = bilgi.filename.replace("\\", "/")
            if not ad.startswith(onek):
                continue
            goreli = ad[len(onek):]
            if not goreli or goreli.endswith("/"):
                continue
            if paket["ac"] is not None and not any(goreli.startswith(o) or goreli == o for o in paket["ac"]):
                continue
            yol = (kok / goreli).resolve()
            if kok != yol and kok not in yol.parents:
                raise Hata(f"Zip güvenli değil (klasör dışına çıkan girdi): {ad}")
            yol.parent.mkdir(parents=True, exist_ok=True)
            with z.open(bilgi) as kaynak, open(yol, "wb") as cikti:
                while True:
                    parca = kaynak.read(1 << 20)
                    if not parca:
                        break
                    cikti.write(parca)
            sayi += 1
    return sayi


def ac_ve_uret(bulunan, args):
    baslik(4, "Paketler açılıyor")
    V.mkdir(exist_ok=True)
    for p in PAKETLER:
        hedef = V / p["klasor"]
        if hazir_mi(p) and not args.yeniden:
            yaz(f"  {p['ad']}: hazır, atlandı.")
            continue
        if p["anahtar"] not in bulunan:
            raise Hata(f"{p['ad']} zip'i bulunamadı.")
        z, onek = bulunan[p["anahtar"]]
        yaz(f"  {p['ad']}: açılıyor ({z.name}) ...")
        n = guvenli_ac(z, onek, p, hedef)
        if not hazir_mi(p):
            raise Hata(f"{p['ad']} açıldı ama beklenen dosyalar yok; zip başka bir sürüm olabilir.")
        yaz(f"    {n} dosya açıldı.")
    uret(args.yeniden)


def uret(yeniden):
    """Görsel üreticilerini çalıştırır. Bir üretici şu durumlarda koşar: çıktısı yok, betiği son çalıştırdığından beri değişmiş (damga), ya da --yeniden."""
    baslik("4b", "Görseller üretiliyor")
    (ARAC / "katalog").mkdir(exist_ok=True)   # atlas_yap önizlemeyi buraya yazar
    ortam = dict(os.environ, PYTHONIOENCODING="utf-8")
    damga = damga_oku()
    for betik, aciklama, ciktilar in URETICILER:
        # atlas.js/katalog.js/gardirop.js pakette gelir; "hazır" saymak için asıl görsel çıktılar yeterli
        gorsel = [c for c in ciktilar if not c.endswith(".js")]
        hazir = all((KOK / c).is_file() or ((KOK / c).is_dir() and any((KOK / c).iterdir())) for c in gorsel)
        ozet = ozet_dosya(ARAC / betik)
        if hazir and not yeniden and damga.get(betik) == ozet:
            yaz(f"  {betik}: çıktılar hazır ve güncel, atlandı.")
            continue
        yaz(f"  {betik}: {aciklama} ...")
        p = subprocess.run([sys.executable, str(ARAC / betik)], cwd=str(KOK), env=ortam, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if p.returncode != 0:
            raise Hata(f"{betik} hata verdi:\n" + (p.stderr or p.stdout)[-800:])
        son = (p.stdout.strip().splitlines() or [""])[-1]
        eksik = [c for c in ciktilar if not (KOK / c).exists()]
        if eksik:
            raise Hata(f"{betik} çalıştı ama şu çıktılar yok: {', '.join(eksik)}")
        damga[betik] = ozet
        try:
            V.mkdir(exist_ok=True)
            DAMGA.write_text(json.dumps(damga, indent=1), encoding="utf-8")
        except OSError:
            pass
        yaz(f"    tamam. {son[:100]}")


def sadece_uret():
    """--uret: güncelleyicinin çağırdığı mod. Soru yok; varlıklar kurulu değilse ya da Pillow yoksa uyarıp çıkar (hata sayılmaz)."""
    if not all(hazir_mi(p) for p in PAKETLER):
        yaz("  Varlıklar kurulu değil; görsel üretimi atlandı (Kur.bat ile kurulum yapınca üretilir).")
        return
    try:
        import PIL  # noqa: F401
    except ImportError:
        yaz("  Uyarı: Pillow kurulu değil; görseller yenilenemedi. Kur.bat'ı çalıştırınca tamamlanır.")
        return
    uret(False)


# ---------------- 5. Kısayol ----------------
def kisayol(args):
    baslik(5, "Kısayol")
    if args.kisayolsuz:
        yaz("  Atlandı (--kisayolsuz).")
        return
    if args.veri:
        yaz("  Atlandı: --veri verildi; kısayol varsayılan veri klasörüyle açar. Elle: py -3 ofis.pyw --veri KLASOR")
        return
    if os.name != "nt":
        yaz("  Windows değil; kısayol atlandı. Ofis'i açmak için: python3 ofis.pyw")
        return
    p = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ARAC / "kisayol_kur.ps1")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        yaz("  Kısayol kurulamadı (pythonw bulunamadı olabilir). Ofis'i yine de açabilirsin: py -3 ofis.pyw")
        yaz("  " + (p.stdout or p.stderr).strip()[-300:])
        return
    for satir in p.stdout.strip().splitlines():
        yaz("  " + satir)


# ---------------- 6. Claude Code ----------------
def claude_bul():
    k = shutil.which("claude")
    if k:
        return k
    ev = Path.home()
    for a in (ev / ".local" / "bin" / "claude.exe", ev / ".local" / "bin" / "claude", ev / ".claude" / "local" / "claude",
              Path(os.environ.get("APPDATA", "")) / "npm" / "claude.cmd"):
        if a.is_file():
            return str(a)
    return None


def claude_denetle():
    baslik(6, "Claude Code denetleniyor")
    k = claude_bul()
    if k:
        yaz(f"  Claude Code bulundu ({k}). Asistanla gerçek sohbet çalışır; giriş yapılmış olmalı (komut satırında `claude` yaz, açılıyorsa hazırsın).")
    else:
        yaz("  Claude Code kurulu değil. Sorun değil: Ofis'in tamamı yine çalışır, yalnız 🧠 ile asistana gerçek soru sorulamaz")
        yaz("  (sohbet bunu kendisi söyler). İstersen sonra kurarsın: https://claude.com/claude-code")


def ofis_ac(args):
    """Kurulum bitince Ofis'i başlatır (yalnız etkileşimli kurulumda ve kullanıcı isterse)."""
    exe = Path(sys.executable)
    if os.name == "nt" and exe.with_name("pythonw.exe").is_file():
        exe = exe.with_name("pythonw.exe")
    komut = [str(exe), str(KOK / "ofis.pyw")] + (["--veri", str(veri_klasoru(args))] if args.veri else [])
    kw = {"cwd": str(KOK), "close_fds": True}
    if os.name == "nt":
        kw["creationflags"] = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    try:
        subprocess.Popen(komut, **kw)
        yaz("  Ofis açılıyor...")
    except OSError as e:
        yaz(f"  Ofis açılamadı ({e}); kısayoldan ya da `py -3 ofis.pyw` ile aç.")


def main():
    a = argparse.ArgumentParser(description="Ofis kurulumu", add_help=True)
    a.add_argument("--sessiz", action="store_true")
    a.add_argument("--varliklar")
    a.add_argument("--veri")
    a.add_argument("--kisayolsuz", action="store_true")
    a.add_argument("--yeniden", action="store_true")
    a.add_argument("--kisi", action="store_true")
    a.add_argument("--uret", action="store_true")
    a.add_argument("--guncelle", metavar="ZIP")
    for k in ("kullanici-adi", "oyuncu-adi", "oyuncu-tam-adi", "ofis-adi", "asistan-adi", "vault"):
        a.add_argument("--" + k)
    args = a.parse_args()
    try:
        sys.stdout.reconfigure(errors="replace")
    except AttributeError:
        pass
    if args.guncelle:
        sys.path.insert(0, str(ARAC))
        import guncelle
        return guncelle.main(["--zip", args.guncelle] + (["--veri", args.veri] if args.veri else []))
    if args.uret:
        try:
            sadece_uret()
        except Hata as e:
            yaz(f"Görsel üretimi başarısız: {e}")
            return 1
        return 0
    surum = surum_metni()
    mevcut_kurulum = all(hazir_mi(p) for p in PAKETLER) and (veri_klasoru(args) / "kisi.json").is_file() and not args.yeniden
    yaz("Ofis kurulumu" + (f" · sürüm {surum}" if surum else ""))
    yaz(f"Klasör: {KOK}")
    if mevcut_kurulum:
        yaz("Önceki kurulum bulundu: güncelleme modu. Paketlerin, kişi ayarın ve verin olduğu gibi kalır; soru sorulmaz.")
    try:
        python_pillow(args.sessiz)
        bulunan = paketleri_topla(args, args.sessiz)
        kisi_ayari(args, args.sessiz)
        ac_ve_uret(bulunan, args)
        kisayol(args)
        claude_denetle()
    except Hata as e:
        yaz(f"\nKurulum tamamlanamadı: {e}")
        yaz("Kur.bat'ı yeniden çalıştırmak güvenlidir; biten adımlar atlanır. Sorun sürerse bu mesajı kurulumu gönderen kişiye ilet.")
        return 1
    except KeyboardInterrupt:
        yaz("\nKurulum yarıda kesildi. Kur.bat'ı yeniden çalıştırabilirsin; biten adımlar atlanır.")
        return 1
    yaz("\nKurulum tamam.")
    yaz("Ofis'i açmak için masaüstündeki Ofis kısayolunu kullan" + ("" if not args.kisayolsuz and not args.veri else " ya da: py -3 ofis.pyw" + (f' --veri "{veri_klasoru(args)}"' if args.veri else "")) + ".")
    yaz("Sonraki sürümler için: Ofis'te Ayarlar > Güncelleme, ya da yeni zip'i bu klasörün üstüne açıp Kur.bat'ı yeniden çalıştır.")
    if not args.sessiz and sys.stdin.isatty() and evet_mi("Ofis'i şimdi açayım mı?", True):
        ofis_ac(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
