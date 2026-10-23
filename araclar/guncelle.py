"""Ofis güncelleyicisi (stdlib). Ayrı süreçte çalışır (guncelleme.py başlatır) ya da elle: `py -3 araclar/guncelle.py [--zip DOSYA | --internet | --denetle | --geri]`.

Ne yapar:
  --zip DOSYA   yerel sürüm zip'ini (paketle.py'nin ürettiği Ofis-<sürüm>.zip) kurar. İnternet gerekmez; arkadaşından aldığın zip de olur.
  --internet    surum.json > depo'daki GitHub Releases son sürümünü indirir ve kurar (depo boşsa çevrimiçi yol kapalıdır).
  --denetle     yalnız sorar: yeni sürüm var mı (hiçbir şey indirmez/kurmaz).
  --geri        son güncellemeyi geri alır (yedek/<sürüm>/ içindeki dosyalar yerine konur).
Ortak: --veri KLASOR (durum dosyası için), --port N, --yeniden-baslat (açık Ofis varsa kapatıp yenisini açar), --evet (sorma), --zorla (aynı/eski sürüm).

Güvenlik (Kut'un ag_guncelle.py deseni):
  - Ağ yalnız https ve ana makine izin listesiyle (api.github.com; indirme: github.com ve GitHub'ın release CDN adresleri); her yönlendirme adımı yeniden denetlenir;
    ana makine adı küresel (özel/yerel olmayan) adrese çözülmelidir; boyut sınırları vardır.
  - Çevrimiçi kurulumda sha256 ZORUNLUDUR (yayın varlığının `digest` alanı ya da yayındaki SHA256SUMS); yoksa ya da uyuşmazsa kurulmaz.
  - Zip-slip: mutlak yol, `..`, sürücü harfi, akış adı, sembolik bağ, yinelenen ad reddedilir. İzin listesi dışı tek dosya bile bulunursa güncelleme tümüyle reddedilir.
  - Yalnız kod dosyaları değişir (yol_incele): varliklar/, VERI (kisi.json, duzen.json...), kullanıcı json'ları, dist/, yedek/ asla.
  - Önceki dosyalar yedek/<sürüm>/ altına alınır; uygulama sırasında hata olursa hepsi geri konur; `--geri` ile sonradan da dönülür.
  - Hiçbir veri gönderilmez (istek yalnız sürüm bilgisi ve zip indirir).
"""
import argparse
import hashlib
import ipaddress
import json
import os
import re
import shutil
import socket
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
YEDEK = KOK / "yedek"

# ---- ağ kuralları (testte bu sabitler yerel sahte sunucuya çevrilir; üretimde değişmez) ----
SEMALAR = {"https"}
API_HOSTLAR = {"api.github.com"}
INDIRME_HOSTLAR = {"github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com", "github-releases.githubusercontent.com"}
DNS_DENETIMI = True
API_ADRES = "https://api.github.com/repos/{depo}/releases/latest"
INDIRME_ONEKI = "https://github.com/{depo}/releases/download/"
SAYFA_ONEKI = "https://github.com/{depo}/"
UA = "ofis-guncelleme"

API_AZAMI = 1_000_000
SUMS_AZAMI = 65_536
ZIP_AZAMI = 50_000_000          # indirilen zip
ACILMIS_AZAMI = 200_000_000     # zip içindeki toplam
DOSYA_AZAMI = 30_000_000        # tek dosya
DOSYA_SAYISI = 2000
ORAN_AZAMI = 400                # sıkıştırma oranı (küçük dosyalar hariç)

DEPO_RE = re.compile(r"^[A-Za-z0-9_.-]{1,60}/[A-Za-z0-9_.-]{1,100}$")
SHA_RE = re.compile(r"^[0-9a-fA-F]{64}$")
ZIP_AD_RE = re.compile(r"^Ofis-[0-9A-Za-z._-]{1,40}\.zip$")
SURUM_RE = re.compile(r"^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$")

# ---- izin listesi: hangi dosyalar paketlenir ve güncellenebilir (paketle.py de buna uyar) ----
HARIC_DURUM = {"kisi.json", "eslesmeler.json", "duzen.json", "gorunum.json", "ziyaret.json", "gunluk.txt",
               "guncelleme.json", "guncelleme-durum.json", "guncelleme.log"}   # kullanıcı durum dosyaları: hiçbir klasörde pakete girmez, güncelleme dokunmaz
YASAK_KLASOR = {"varliklar", "dist", "yedek", "__pycache__"}
KOK_UZANTI = {".html", ".js", ".py", ".pyw", ".bat", ".ps1", ".md", ".webmanifest"}
KOK_ADLAR = {"surum.json", "LICENSE"}
ALT_KLASOR = {"moduller": {".js", ".css", ".html"}, "araclar": {".py", ".ps1", ".bat", ".json"}, "harita": {".tmj", ".json"}, "yazi": {".ttf", ".txt"},
              "sesler": {".mp3"}}   # yazi: Pixelify Sans (SIL OFL) + lisans metni; sesler: müzik ve efektler (ses.js)
URETICILER = ("atlas_yap.py", "katalog_yap.py", "gardirop_yap.py", "ui_yap.py")


class Hata(Exception):
    pass


def yaz(*a):
    print(*a, flush=True)


# ---------------- yol ve sürüm ----------------
def yol_incele(ad):
    """Paket içi göreli yol için karar: "ok" (kurulabilir), "atla" (sessizce geçilir) ya da hata nedeni ("gecersiz" / "yasak")."""
    g = str(ad).replace("\\", "/")
    if not g or g.startswith("/") or re.match(r"^[A-Za-z]:", g) or "\x00" in g or len(g) > 200:
        return "gecersiz"
    parcalar = g.split("/")
    for p in parcalar:
        if p in ("", ".", "..") or re.search(r'[<>:"|?*\x00-\x1f]', p) or p.endswith((" ", ".")):
            return "gecersiz"
    if g == "varliklar/BURAYA.txt":
        return "atla"
    kucuk = [p.lower() for p in parcalar]
    if kucuk[0] in YASAK_KLASOR or any(p.startswith(".") or p.endswith("-yedek") or p == "__pycache__" for p in kucuk):
        return "yasak"
    if kucuk[-1] in HARIC_DURUM:
        return "yasak"
    uzanti = Path(parcalar[-1]).suffix.lower()
    if len(parcalar) == 1:
        return "ok" if (parcalar[0] in KOK_ADLAR or uzanti in KOK_UZANTI) else "yasak"
    izinli = ALT_KLASOR.get(parcalar[0])
    if izinli is None or uzanti not in izinli or (kucuk[0] == "araclar" and kucuk[1] == "katalog"):
        return "yasak"
    return "ok"


def surum_ayristir(s):
    m = SURUM_RE.match(str(s or "").strip())
    if not m:
        raise ValueError("sürüm biçimi geçersiz")
    return tuple(int(x) for x in m.groups())


def surum_oku(kok=None):
    """(sürüm, depo) surum.json'dan; okunamazsa ("0.0.0", "")."""
    try:
        j = json.loads((Path(kok) if kok else KOK).joinpath("surum.json").read_text(encoding="utf-8-sig"))
        s = str(j.get("surum") or "")
        surum_ayristir(s)
        d = str(j.get("depo") or "").strip()
        return s, (d if DEPO_RE.match(d) else "")
    except (OSError, ValueError, AttributeError):
        return "0.0.0", ""


def sha_dosya(yol):
    h = hashlib.sha256()
    with open(yol, "rb") as f:
        while True:
            p = f.read(1 << 20)
            if not p:
                break
            h.update(p)
    return h.hexdigest()


# ---------------- ağ ----------------
def _izinli(url, hostlar):
    u = urllib.parse.urlparse(url or "")
    if u.scheme not in SEMALAR or (u.hostname or "").lower() not in hostlar:
        raise ValueError("adres izin listesinde değil")
    if DNS_DENETIMI:
        try:
            adresler = {a[4][0] for a in socket.getaddrinfo(u.hostname, u.port or 443, type=socket.SOCK_STREAM)}
        except (OSError, UnicodeError):
            raise ValueError("ana makine çözülemedi")
        if not adresler or not all(ipaddress.ip_address(a.split("%")[0]).is_global for a in adresler):
            raise ValueError("adres küresel değil")
    return url


def _acici(hostlar):
    class Y(urllib.request.HTTPRedirectHandler):
        max_redirections = 5

        def redirect_request(self, req, fp, code, msg, headers, newurl):
            try:
                _izinli(urllib.parse.urljoin(req.full_url, newurl), hostlar)
            except ValueError as e:
                raise urllib.error.URLError("yönlendirme reddedildi: " + str(e))
            return super().redirect_request(req, fp, code, msg, headers, newurl)
    return urllib.request.build_opener(Y)


def _ac(url, hostlar, zaman):
    _izinli(url, hostlar)
    return _acici(hostlar).open(urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/vnd.github+json, application/octet-stream"}), timeout=zaman)


def _ag_oku(url, azami, hostlar, zaman=10):
    with _ac(url, hostlar, zaman) as y:
        ham = y.read(azami + 1)
    if len(ham) > azami:
        raise OSError("yanıt çok büyük")
    return ham


def _indir(url, hedef, azami, zaman=30):
    """url'yi hedef dosyaya yazar (azami aşılırsa durur); (boyut, sha256) döner."""
    h, n = hashlib.sha256(), 0
    with _ac(url, INDIRME_HOSTLAR, zaman) as y, open(hedef, "wb") as f:
        while True:
            p = y.read(65536)
            if not p:
                break
            n += len(p)
            if n > azami:
                raise OSError("dosya çok büyük")
            h.update(p)
            f.write(p)
    return n, h.hexdigest()


def sums_coz(ham, ad):
    """SHA256SUMS metninden `ad` dosyasının sha256'sı (yoksa None). "<hex>  <ad>" ya da "<hex> *<ad>" biçimi."""
    metin = ham.decode("utf-16", "ignore") if ham[:2] in (b"\xff\xfe", b"\xfe\xff") else ham.decode("utf-8-sig", "ignore")
    for satir in metin.splitlines():
        p = satir.strip().split()
        if len(p) >= 2 and SHA_RE.match(p[0]) and p[-1].lstrip("*").replace("\\", "/").split("/")[-1].lower() == ad.lower():
            return p[0].lower()
    return None


def surum_coz(j, depo):
    """GitHub 'releases/latest' cevabından yalnız gereken alanlar (not metni veridir, kırpılır)."""
    if not isinstance(j, dict):
        raise ValueError("beklenmeyen cevap")
    etiket = str(j.get("tag_name") or "")
    s = ".".join(str(x) for x in surum_ayristir(etiket))
    zipv, sums = None, None
    for a in j.get("assets") or []:
        if not isinstance(a, dict):
            continue
        ad, url = a.get("name"), a.get("browser_download_url")
        if not isinstance(ad, str) or not isinstance(url, str):
            continue
        if ZIP_AD_RE.match(ad) and (zipv is None or ad == f"Ofis-{s}.zip"):
            d = a.get("digest")
            sha = d[7:].lower() if isinstance(d, str) and d.lower().startswith("sha256:") and SHA_RE.match(d[7:]) else None
            zipv = {"ad": ad, "url": url, "boyut": a.get("size") if isinstance(a.get("size"), int) else None, "sha256": sha}
        elif ad == "SHA256SUMS":
            sums = {"ad": ad, "url": url}
    sayfa = str(j.get("html_url") or "")
    if not sayfa.startswith(SAYFA_ONEKI.format(depo=depo)):
        sayfa = SAYFA_ONEKI.format(depo=depo) + "releases"
    return {"surum": s, "etiket": etiket, "notlar": str(j.get("body") or "")[:1500], "url": sayfa,
            "yayin": str(j.get("published_at") or "")[:10], "zip": zipv, "sums": sums}


def denetle(depo):
    """GitHub'dan son sürüm bilgisini alır (ValueError: okunur Türkçe ileti)."""
    if not DEPO_RE.match(depo or ""):
        raise ValueError("Yayın deposu ayarlanmadı.")
    try:
        j = json.loads(_ag_oku(API_ADRES.format(depo=depo), API_AZAMI, API_HOSTLAR))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise ValueError("Henüz yayınlanmış bir sürüm yok.")
        raise ValueError("GitHub isteği reddetti" + (" (istek sınırı; sonra dene)" if e.code in (403, 429) else f" ({e.code})") + ".")
    except (OSError, ValueError):
        raise ValueError("Güncelleme sunucusuna ulaşılamadı.")
    try:
        return surum_coz(j, depo)
    except ValueError:
        raise ValueError("Sürüm bilgisi okunamadı.")


def yeni_mi(surum, kok=None):
    try:
        return surum_ayristir(surum) > surum_ayristir(surum_oku(kok)[0])
    except ValueError:
        return False


def beklenen_sha(son, depo):
    """Yayın için beklenen sha256: varlık digest'i ve/veya SHA256SUMS. İkisi de varsa uyuşmalı; hiçbiri yoksa ValueError (kurulmaz)."""
    z = son.get("zip") or {}
    adaylar = []
    if z.get("sha256"):
        adaylar.append(z["sha256"])
    s = son.get("sums")
    if s and s.get("url"):
        if not str(s["url"]).startswith(INDIRME_ONEKI.format(depo=depo)):
            raise ValueError("Sağlama dosyası adresi bu deponun yayınında değil.")
        try:
            h = sums_coz(_ag_oku(s["url"], SUMS_AZAMI, INDIRME_HOSTLAR), z.get("ad", ""))
        except (OSError, ValueError):
            raise ValueError("Sağlama dosyası (SHA256SUMS) indirilemedi.")
        if h:
            adaylar.append(h)
    if not adaylar:
        raise ValueError("Bu yayında sağlama toplamı (digest ya da SHA256SUMS) yok; güvenlik için kurulmadı.")
    if len(set(adaylar)) > 1:
        raise ValueError("Yayındaki iki sağlama toplamı birbirini tutmuyor; kurulmadı.")
    return adaylar[0]


# ---------------- durum dosyası (arayüz okur) ----------------
_DURUM = {"dosya": None}


def asama(ad, mesaj="", **ek):
    yaz(f"[{ad}] {mesaj}" if mesaj else f"[{ad}]")
    d = _DURUM["dosya"]
    if d:
        try:
            Path(d).parent.mkdir(parents=True, exist_ok=True)
            Path(d).write_text(json.dumps({"asama": ad, "mesaj": mesaj, "zaman": time.time(), **ek}, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass


# ---------------- kilit ve yedek kayıtları ----------------
class Kilit:
    def __enter__(self):
        YEDEK.mkdir(exist_ok=True)
        self.yol = YEDEK / ".kilit"
        for _ in range(2):
            try:
                fd = os.open(str(self.yol), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.write(fd, str(os.getpid()).encode())
                os.close(fd)
                return self
            except FileExistsError:
                try:
                    if time.time() - self.yol.stat().st_mtime > 1800:   # eski/ölü kilit
                        self.yol.unlink()
                        continue
                except OSError:
                    pass
                break
        raise Hata("Başka bir güncelleme işlemi sürüyor.")

    def __exit__(self, *a):
        try:
            self.yol.unlink()
        except OSError:
            pass


def _json_yaz(yol, veri):
    gecici = Path(str(yol) + ".tmp")
    gecici.write_text(json.dumps(veri, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(gecici, yol)


def gecmis_oku():
    try:
        g = json.loads((YEDEK / "gecmis.json").read_text(encoding="utf-8"))
        return [x for x in g if isinstance(x, str) and re.fullmatch(r"[0-9A-Za-z._-]{1,60}", x) and (YEDEK / x / "yedek.json").is_file()]
    except (OSError, ValueError):
        return []


def geri_var():
    return bool(gecmis_oku())


# ---------------- uygulama ----------------
def zip_incele(z):
    """Zip'i denetler: (önek, {göreli yol: ZipInfo}, yeni sürüm metni). Uygun değilse Hata."""
    bilgiler = [b for b in z.infolist() if not b.filename.endswith("/")]
    if not bilgiler:
        raise Hata("Zip boş.")
    if len(bilgiler) > DOSYA_SAYISI:
        raise Hata("Zip beklenenden çok dosya içeriyor; kurulmadı.")
    adlar = [b.filename.replace("\\", "/") for b in bilgiler]
    ilkler = {a.split("/", 1)[0] for a in adlar if "/" in a}
    if "surum.json" in adlar:
        onek = ""
    elif len(ilkler) == 1 and all("/" in a for a in adlar) and f"{next(iter(ilkler))}/surum.json" in adlar:
        onek = next(iter(ilkler)) + "/"
    else:
        raise Hata("Bu zip bir Ofis sürüm paketi değil (surum.json bulunamadı).")
    harita, goruldu, toplam = {}, set(), 0
    for b, a in zip(bilgiler, adlar):
        g = a[len(onek):]
        if not a.startswith(onek):
            raise Hata(f"Zip düzeni tutarsız: {a}")
        if b.flag_bits & 0x1:
            raise Hata("Zip şifreli; kurulmadı.")
        if stat.S_ISLNK(b.external_attr >> 16):
            raise Hata(f"Zip sembolik bağ içeriyor: {a}")
        karar = yol_incele(g)
        if karar == "atla":
            continue
        if karar != "ok":
            raise Hata(f"Zip izin verilmeyen bir yol içeriyor ({'güvensiz' if karar == 'gecersiz' else 'izin listesi dışı'}): {a}. Güncelleme reddedildi.")
        anahtar = g.lower()
        if anahtar in goruldu:
            raise Hata(f"Zip aynı dosyayı iki kez içeriyor: {a}")
        goruldu.add(anahtar)
        if b.file_size > DOSYA_AZAMI:
            raise Hata(f"Zip içindeki dosya çok büyük: {a}")
        if b.file_size > 100_000 and b.file_size > ORAN_AZAMI * max(1, b.compress_size):
            raise Hata(f"Zip sıkıştırma oranı şüpheli: {a}")
        toplam += b.file_size
        harita[g] = b
    if toplam > ACILMIS_AZAMI:
        raise Hata("Zip açılınca beklenenden büyük; kurulmadı.")
    for gerekli in ("surum.json", "ofis.pyw", "index.html"):
        if gerekli not in harita:
            raise Hata(f"Pakette {gerekli} yok; eksik ya da bozuk zip.")
    try:
        j = json.loads(z.read(harita["surum.json"]).decode("utf-8-sig"))
        yeni = str(j.get("surum") or "")
        surum_ayristir(yeni)
    except (ValueError, AttributeError, UnicodeDecodeError):
        raise Hata("Pakettaki surum.json geçersiz.")
    return harita, yeni


def _cikar(z, bilgi, hedef):
    h, n = hashlib.sha256(), 0
    hedef.parent.mkdir(parents=True, exist_ok=True)
    with z.open(bilgi) as k, open(hedef, "wb") as c:
        while True:
            p = k.read(1 << 16)
            if not p:
                break
            n += len(p)
            if n > bilgi.file_size:
                raise Hata(f"Zip içindeki dosya bildirdiğinden büyük: {bilgi.filename}")
            h.update(p)
            c.write(p)
    return h.hexdigest()


def _kopya_koy(kaynak, hedef):
    """Dosyayı hedefe atomik yerleştirir (aynı birimde geçici dosya + os.replace)."""
    hedef.parent.mkdir(parents=True, exist_ok=True)
    gecici = hedef.with_name(hedef.name + ".gnc-yeni")
    try:
        shutil.copyfile(kaynak, gecici)
        os.replace(gecici, hedef)
    except BaseException:
        try:
            gecici.unlink()
        except OSError:
            pass
        raise


def geri_koy(klasor, manifest, sadece=None):
    """Yedekten dosyaları yerine koyar, bu güncellemenin eklediklerini siler (sadece: yalnız bu kümedekiler). Hatalar toplanır; kısmi geri dönüş sessiz kalmaz."""
    hatalar = []
    for g in manifest.get("degisen", []):
        if sadece is not None and g not in sadece:
            continue
        try:
            _kopya_koy(klasor / "dosyalar" / g, KOK / g)
        except OSError as e:
            hatalar.append(f"{g}: {e}")
    for g in manifest.get("yeni", []):
        if sadece is not None and g not in sadece:
            continue
        try:
            if yol_incele(g) == "ok" and (KOK / g).is_file():
                (KOK / g).unlink()
        except OSError as e:
            hatalar.append(f"{g}: {e}")
    return hatalar


def uretimi_yenile():
    """Üretici betikleri değiştiyse görselleri yeniden üretir (kur.py --uret; varliklar yoksa atlar). (ok, çıktı)"""
    kur = KOK / "araclar" / "kur.py"
    if not kur.is_file():
        return True, ""
    try:
        p = subprocess.run([sys.executable, str(kur), "--uret"], cwd=str(KOK), capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=1800, env=dict(os.environ, PYTHONIOENCODING="utf-8"))
    except (subprocess.TimeoutExpired, OSError) as e:
        return False, f"görsel üretimi çalışmadı ({type(e).__name__})"
    return p.returncode == 0, (p.stdout + p.stderr).strip()[-600:]


def zip_kur(zip_yolu, zorla=False):
    """Yerel zip'i kurar. Dönüş: {"eski", "yeni", "degisen", "yedek"}; sorunlarda Hata."""
    try:
        z = zipfile.ZipFile(zip_yolu)
    except (zipfile.BadZipFile, OSError):
        raise Hata("Zip açılamadı (bozuk ya da eksik indirilmiş).")
    with z:
        asama("dogrulama", "Zip denetleniyor...")
        harita, yeni = zip_incele(z)
        eski = surum_oku()[0]
        if surum_ayristir(yeni) <= surum_ayristir(eski) and not zorla:
            raise Hata(f"Pakettaki sürüm ({yeni}) kurulu sürümden ({eski}) yeni değil. Yine de kurmak için --zorla.")
        gecici = YEDEK / f".gecici-{os.getpid()}"
        with Kilit():
            try:
                if gecici.exists():
                    shutil.rmtree(gecici, ignore_errors=True)
                gecici.mkdir(parents=True, exist_ok=True)
                degisen, yeni_dosya, hazir = [], [], {}
                for g, b in sorted(harita.items()):
                    hedef = gecici / g
                    sha = _cikar(z, b, hedef)
                    if g.endswith((".py", ".pyw")):
                        try:
                            compile(hedef.read_bytes(), g, "exec")
                        except (SyntaxError, ValueError) as e:
                            raise Hata(f"Paketteki {g} geçerli bir Python dosyası değil ({e}); kurulmadı.")
                    mevcut = KOK / g
                    if mevcut.is_file():
                        if sha_dosya(mevcut) == sha:
                            continue   # aynı içerik: dokunma
                        degisen.append(g)
                    else:
                        yeni_dosya.append(g)
                    hazir[g] = hedef
                asama("yedek", f"Önceki sürüm ({eski}) yedekleniyor, {len(hazir)} dosya değişecek...")
                ad = eski if re.fullmatch(r"[0-9A-Za-z._-]{1,40}", eski) else "onceki"
                klasor, n = YEDEK / ad, 2
                while klasor.exists():
                    klasor = YEDEK / f"{ad}-{n}"
                    n += 1
                for g in degisen:
                    (klasor / "dosyalar" / Path(g).parent).mkdir(parents=True, exist_ok=True)
                    shutil.copy2(KOK / g, klasor / "dosyalar" / g)
                # degisen: yedeği alınan eski dosyalar; yeni: bu güncellemenin eklediği dosyalar (geri dönüşte silinir)
                manifest = {"eski": eski, "yeni_surum": yeni, "tarih": time.strftime("%Y-%m-%d %H:%M:%S"), "degisen": degisen, "yeni": yeni_dosya}
                _json_yaz(klasor / "yedek.json", manifest)
                uygulananlar = []
                try:
                    asama("uygulama", "Dosyalar yerleştiriliyor...")
                    for g in degisen + yeni_dosya:
                        _kopya_koy(hazir[g], KOK / g)
                        uygulananlar.append(g)
                    asama("uretim", "Görsel üreticileri denetleniyor...")
                    ok, cikti = uretimi_yenile()
                    if not ok:
                        raise Hata("Görseller yeniden üretilemedi:\n" + cikti)
                except BaseException as e:
                    asama("geri", "Hata oluştu, önceki dosyalar geri konuyor...")
                    hatalar = geri_koy(klasor, manifest, set(uygulananlar))
                    shutil.rmtree(klasor, ignore_errors=True)
                    if isinstance(e, PermissionError):
                        raise Hata("Ofis klasörüne yazılamıyor (izin yok ya da dosya kullanımda). Hiçbir şey değişmedi." + (" Geri koyarken sorun: " + "; ".join(hatalar) if hatalar else ""))
                    if isinstance(e, Hata):
                        raise Hata(str(e) + (" (geri dönüşte sorun: " + "; ".join(hatalar) + ")" if hatalar else " Önceki sürüm geri kondu."))
                    raise
                g = gecmis_oku()
                g.append(klasor.name)
                for eskisi in g[:-3]:   # son 3 yedek kalır
                    shutil.rmtree(YEDEK / eskisi, ignore_errors=True)
                _json_yaz(YEDEK / "gecmis.json", g[-3:])
            finally:
                shutil.rmtree(gecici, ignore_errors=True)
    return {"eski": eski, "yeni": yeni, "degisen": len(degisen) + len(yeni_dosya), "yedek": str(klasor)}


def internetten_kur(zorla=False):
    depo = surum_oku()[1]
    if not depo:
        raise Hata("Yayın deposu ayarlanmadı (surum.json > depo boş); çevrimiçi güncelleme kapalı. Elle: --zip Ofis-x.zip")
    asama("denetim", "Son sürüm soruluyor...")
    try:
        son = denetle(depo)
    except ValueError as e:
        raise Hata(str(e))
    if not yeni_mi(son["surum"]) and not zorla:
        raise Hata(f"Zaten en son sürümdesin ({surum_oku()[0]}).")
    z = son.get("zip") or {}
    try:
        beklenen = beklenen_sha(son, depo)
    except ValueError as e:
        raise Hata(str(e))
    url = z.get("url", "")
    if not str(url).startswith(INDIRME_ONEKI.format(depo=depo)):
        raise Hata("Zip adresi bu deponun yayınında değil; kurulmadı.")
    if isinstance(z.get("boyut"), int) and z["boyut"] > ZIP_AZAMI:
        raise Hata("Zip beklenenden büyük; kurulmadı.")
    YEDEK.mkdir(exist_ok=True)
    hedef = YEDEK / f".indirilen-{os.getpid()}.zip"
    try:
        asama("indirme", f"Ofis {son['surum']} indiriliyor...")
        try:
            boyut, ozet = _indir(url, hedef, ZIP_AZAMI)
        except (OSError, ValueError):
            raise Hata("Zip indirilemedi.")
        if ozet != beklenen or (isinstance(z.get("boyut"), int) and z["boyut"] != boyut):
            raise Hata("Sağlama toplamı uyuşmuyor; indirilen dosya silindi, kurulmadı.")
        s = zip_kur(hedef, zorla)
        if s["yeni"] != son["surum"]:
            geri_al_son(sessiz=True)
            raise Hata("Zip içindeki sürüm yayın etiketiyle tutmuyor; geri alındı.")
        return s
    finally:
        try:
            hedef.unlink()
        except OSError:
            pass


def geri_al_son(sessiz=False):
    with Kilit():
        g = gecmis_oku()
        if not g:
            raise Hata("Geri dönülecek önceki sürüm yedeği yok.")
        klasor = YEDEK / g[-1]
        try:
            manifest = json.loads((klasor / "yedek.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            raise Hata("Yedek kaydı okunamadı.")
        if not sessiz:
            asama("geri", f"Sürüm {manifest.get('yeni_surum', '?')} geri alınıyor, {manifest.get('eski', '?')} yerine konuyor...")
        hatalar = geri_koy(klasor, manifest)
        if hatalar:
            raise Hata("Geri dönüş tamamlanamadı: " + "; ".join(hatalar))
        shutil.rmtree(klasor, ignore_errors=True)
        _json_yaz(YEDEK / "gecmis.json", g[:-1])
    ok, cikti = uretimi_yenile()
    return {"eski": manifest.get("yeni_surum", ""), "yeni": manifest.get("eski", ""), "uyari": "" if ok else cikti}


# ---------------- yeniden başlatma ----------------
def _yerel(url, veri=None, baslik=None, zaman=3):
    ac = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    return ac.open(urllib.request.Request(url, data=veri, headers=baslik or {}, method="POST" if veri is not None else "GET"), timeout=zaman)


def ofis_acik_mi(port):
    try:
        with _yerel(f"http://127.0.0.1:{port}/api/kimlik") as r:
            return json.load(r).get("uygulama") == "ofis"
    except (OSError, ValueError):
        return False


def yeniden_baslat(port, ofis_arg):
    """Açık Ofis varsa kapatır (POST /api/kapat), yenisini pencere açmadan başlatır (açık pencere kendini yeniler). True: yeniden başlatıldı."""
    if not ofis_acik_mi(port):
        return False
    asama("yeniden", "Ofis yeniden başlatılıyor...")
    try:
        _yerel(f"http://127.0.0.1:{port}/api/kapat", b"", {"X-Ofis-Kapat": "1"}).read()
    except OSError:
        pass
    for _ in range(80):
        if not ofis_acik_mi(port):
            break
        time.sleep(0.25)
    else:
        raise Hata("Açık Ofis kapanmadı; yeni sürüm hazır, Ofis'i kapatıp kısayoldan aç.")
    exe = sys.executable
    pw = Path(exe).with_name("pythonw.exe")
    if os.name == "nt" and Path(exe).name.lower() == "python.exe" and pw.is_file():
        exe = str(pw)
    arg = [a for a in ofis_arg if a != "--tarayicisiz"] + ["--tarayicisiz"]
    kw = {"stdin": subprocess.DEVNULL, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL, "close_fds": True, "cwd": str(KOK)}
    if os.name == "nt":
        kw["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        kw["start_new_session"] = True
    subprocess.Popen([exe, str(KOK / "ofis.pyw"), *arg], **kw)
    for _ in range(60):
        if ofis_acik_mi(port):
            return True
        time.sleep(0.5)
    raise Hata("Yeni sürüm kuruldu ama Ofis kendiliğinden açılmadı; kısayoldan aç.")


# ---------------- komut satırı ----------------
def veri_klasoru(arg):
    if arg:
        return Path(os.path.expandvars(arg)).expanduser()
    return Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "OfisDemo"


def zip_sha_bul(zip_yolu, verilen):
    """--zip için sağlama toplamı: --sha256, yanındaki SHA256SUMS ya da <zip>.sha256. Yoksa None."""
    if verilen:
        if not SHA_RE.match(verilen):
            raise Hata("--sha256 değeri 64 haneli onaltılık olmalı.")
        return verilen.lower()
    z = Path(zip_yolu)
    try:
        h = sums_coz((z.parent / "SHA256SUMS").read_bytes(), z.name)
        if h:
            return h
    except OSError:
        pass
    try:
        p = (Path(str(z) + ".sha256")).read_text(encoding="utf-8-sig").split()
        if p and SHA_RE.match(p[0]):
            return p[0].lower()
    except OSError:
        pass
    return None


def main(argv=None):
    a = argparse.ArgumentParser(description="Ofis güncelleyicisi")
    g = a.add_mutually_exclusive_group(required=True)
    g.add_argument("--zip")
    g.add_argument("--internet", action="store_true")
    g.add_argument("--denetle", action="store_true")
    g.add_argument("--geri", action="store_true")
    a.add_argument("--sha256")
    a.add_argument("--evet", action="store_true", help="sağlama toplamı yoksa sormadan kur (yalnız --zip)")
    a.add_argument("--zorla", action="store_true")
    a.add_argument("--veri")
    a.add_argument("--port", type=int, default=8540)
    a.add_argument("--yeniden-baslat", action="store_true")
    a.add_argument("--ofis-arg-json", help="açık Ofis'in başlatma bağımsız değişkenleri (JSON listesi)")
    args = a.parse_args(argv)
    try:
        sys.stdout.reconfigure(errors="replace")
    except AttributeError:
        pass
    _DURUM["dosya"] = str(veri_klasoru(args.veri) / "guncelleme-durum.json")
    try:
        if args.denetle:
            depo = surum_oku()[1]
            if not depo:
                yaz("Yayın deposu ayarlanmadı (surum.json > depo boş); çevrimiçi denetim kapalı.")
                return 1
            try:
                son = denetle(depo)
            except ValueError as e:
                yaz(str(e))
                return 1
            yaz(f"Kurulu: {surum_oku()[0]} · Son yayın: {son['surum']} " + ("(yeni sürüm var)" if yeni_mi(son["surum"]) else "(güncelsin)"))
            return 0
        if args.geri:
            s = geri_al_son()
            asama("bitti", f"Sürüm {s['yeni']} geri yüklendi.", surum=s["yeni"])
            if s["uyari"]:
                yaz("Uyarı: görseller yenilenemedi: " + s["uyari"])
        else:
            if args.zip:
                zp = Path(os.path.expandvars(args.zip)).expanduser()
                if not zp.is_file():
                    raise Hata(f"Zip bulunamadı: {zp}")
                sha = zip_sha_bul(zp, args.sha256)
                if sha:
                    if sha_dosya(zp) != sha:
                        raise Hata("Sağlama toplamı uyuşmuyor; zip bozuk ya da değiştirilmiş. Kurulmadı.")
                    yaz("Sağlama toplamı doğrulandı.")
                else:
                    yaz("Uyarı: bu zip için sağlama toplamı verilmedi (--sha256 ya da yanında SHA256SUMS yok); bütünlüğü doğrulanamıyor.")
                    if not args.evet:
                        try:
                            c = input("Yine de kurulsun mu? (e/H): ").strip().lower()
                        except EOFError:
                            c = ""
                        if not c.startswith(("e", "y")):
                            raise Hata("Vazgeçildi.")
                s = zip_kur(zp, args.zorla)
            else:
                s = internetten_kur(args.zorla)
            asama("bitti", f"Ofis {s['eski']} -> {s['yeni']} güncellendi ({s['degisen']} dosya). Önceki sürüm: yedek/ klasöründe; geri dönmek için: --geri", surum=s["yeni"])
        if args.yeniden_baslat:
            ofis_arg = json.loads(args.ofis_arg_json) if args.ofis_arg_json else ["--port", str(args.port)] + (["--veri", args.veri] if args.veri else [])
            if not (isinstance(ofis_arg, list) and all(isinstance(x, str) for x in ofis_arg)):
                raise Hata("--ofis-arg-json geçersiz.")
            if yeniden_baslat(args.port, ofis_arg):
                asama("yeniden", "Ofis yeni sürümle açıldı.")
        elif ofis_acik_mi(args.port):
            yaz("Ofis açık görünüyor: değişikliklerin tam gelmesi için kapatıp yeniden aç.")
        return 0
    except Hata as e:
        asama("hata", str(e))
        return 1
    except KeyboardInterrupt:
        asama("hata", "Yarıda kesildi.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
