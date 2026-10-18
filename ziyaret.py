"""Asansörle Wi-Fi ziyareti: sunucu tarafı (ofis.pyw bu modülü içe aktarır). Ayrıntılı rehber: MIMARI.md > "Asansörle ziyaret".

Ağa açılan tek şey burada: ZİYARET DİNLEYİCİSİ. 127.0.0.1:8540'taki ana sunucuya dokunmaz.
- Varsayılan KAPALI (Ayarlar > Ziyaret: "Ofisimi ziyarete aç"; ayar VERI/ziyaret.json'da). Açıkken 0.0.0.0:<ziyaret-port> (varsayılan 8545) dinler.
- Dosya sunmaz: yalnız `/z/*` JSON uçları. Gövde en çok 16 KB, IP başına istek hız sınırı, eşzamanlı bağlantı sınırı, 5 sn okuma zaman aşımı,
  yalnız özel ağ (10/8, 172.16/12, 192.168/16, 169.254/16, 127/8 test) adreslerinden gelen istekler; `Origin` başlığı taşıyan (tarayıcı) istekler reddedilir.
- Keşif: ziyaret açıkken UDP yayını (varsayılan 8546, ~3 sn'de bir) `{tur:"ofis", id, ad, port, protokol}`; açık her ofis dinler. Aynı makinedeki
  iki örnek aynı keşif portunu SO_REUSEADDR ile paylaşır (yayın her ikisine ulaşır).
- Eşleşme: ev sahibi 6 haneli kod üretir (5 dk, tek kullanımlık); misafir `/z/esles`'e {kod, id, ad, port, protokol} yollar; doğruysa ev sahibi 32 baytlık
  ortak sır üretir, iki taraf VERI/eslesmeler.json'a yazar (atomik, sır arayüze ve loglara çıkmaz). 5 yanlış kod -> 5 dk kilit.
- Sonraki her istek imzalıdır: X-Ofis-Id, X-Zaman (ms), X-Imza = HMAC-SHA256(sır, yöntem\\nyol\\nzaman\\n + gövde); ±60 sn pencere, aynı imza ikinci kez geçmez;
  cevap da imzalıdır (X-Imza = HMAC(sır, "YANIT\\n" + istek imzası + "\\n" + gövde)). Eksik/yanlış/eski imza 403.
- Ziyaret: /z/istek (ev sahibinde onay kartı, 60 sn) -> /z/istek-durum -> /z/sahne (düzen, görünüm, adlar) -> /z/an (4 Hz: misafirin konumu gider, ev sahibinin
  anlık görüntüsü gelir) -> /z/ayril. Ev sahibinin gerçek verisi (brifing, onaylar, sohbet içeriği, vault yolu, kullanıcı adı, rol metinleri) hiçbir cevaba girmez.
- Sohbet (protokol 2): misafir -> ev sahibi imzalı `/z/mesaj` {ziyaret, n (artan sıra), tur m|r|b, t | k}; ev sahibi her mesaja kendi artan numarasını (s) verir, son 50'yi tutur
  ve misafirlere `/z/an` cevabında (`c`, istemcinin `gor` değerinden sonrakiler) dağıtır. Gönderen başına 3 mesaj / 5 sn, metin <= 200 karakter ve `_metin` temizliğinden geçer.
- Sohbet (protokol 2): misafir -> ev sahibi imzalı `/z/mesaj` {ziyaret, n (artan sıra), tur m|r|b, t | k}; ev sahibi her mesaja kendi artan numarasını (s) verir, son 50'yi tutar
  ve misafirlere `/z/an` cevabında (`c`, istemcinin `gor` değerinden sonrakiler) dağıtır. Gönderen başına 3 mesaj / 5 sn, metin <= 200 karakter, `_metin` temizliği.
- Misafir tarafı gelen her şeyi veri olarak doğrular (sahne_temizle / an_temizle); hedef adres yalnız özel ağdaki IPv4 sayısal adres olabilir (ad çözümlemesi yok,
  yönlendirme izlenmez).
"""
import hashlib
import hmac
import http.client
import ipaddress
import json
import os
import re
import secrets
import socket
import tempfile
import threading
import time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROTOKOL = 3              # 3: 0.10.0 birleşik sürüm (iki kolun birleşimi). 2: ziyaret sohbeti (/z/mesaj, /z/an cevabında c). Eski sürümle eşleşme/istek 409 `surum` (iki taraf da aynı sürümü kursun)
ZIYARET_PORT = 8545
KESIF_PORT = 8546
KOD_SURE = 300            # eşleşme kodu geçerlilik (sn)
KILIT_SURE = 300          # 5 yanlış koddan sonra kilit (sn)
ISTEK_SURE = 60           # ev sahibi onayı için bekleme (sn)
HAREKETSIZ_SURE = 30      # misafirden bu kadar sn konum gelmezse ziyaret biter
ZIYARET_SURE = 7200       # ziyaretin üst sınırı (sn)
ZAMAN_PENCERE = 60000     # imza zaman penceresi (ms)
GOVDE_SINIR = 16384       # gelen istek gövdesi (bayt)
YANIT_SINIR = 700000      # giden istekte okunacak cevap (bayt)
AN_ESKI = 12              # ev sahibi tarayıcısı bu kadar sn anlık görüntü yollamazsa ziyaret biter
EN_FAZLA_MISAFIR = 4
MESAJ_UZUNLUK = 200       # sohbet mesajı (karakter)
MESAJ_HIZ = (3, 5.0)      # gönderen başına en çok 3 mesaj / 5 sn
SOHBET_KUYRUK = 50        # ev sahibinde tutulan son mesaj sayısı
SOHBET_TESLIM = 30        # tek cevapta en çok mesaj
REAKSIYON = {1: "👋 Merhaba", 2: "😄", 3: "👍"}   # hızlı tepkiler (4: "Buraya gel" konum işareti)
TUR_RE = re.compile(r"[mrb]")
V_RE = re.compile(r"[A-Za-z0-9_-]{1,8}")
SAAT_RE = re.compile(r"\d\d:\d\d")
BAGLANTI_SURE = 8         # bir bağlantının toplam ömrü (sn): yavaş yavaş okuyan istemci (slowloris) iş parçacığını tutamaz
IP_BASINA_BAGLANTI = 6    # aynı IP'den eşzamanlı bağlantı
KESIF_EN_FAZLA = 64
OZEL_AG = [ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "127.0.0.0/8")]
ID_RE = re.compile(r"[0-9a-f]{16}")
AJAN_RE = re.compile(r"[a-z0-9]{2,20}")


def ozel_adres(s):
    """Sayısal IPv4 özel ağdaysa düzgün yazılışı, değilse None (ad, IPv6 ve genel adresler reddedilir)."""
    try:
        ip = ipaddress.IPv4Address(str(s).strip())
    except ValueError:
        return None
    return str(ip) if any(ip in n for n in OZEL_AG) else None


def _metin(v, azami, varsayilan=""):
    if not isinstance(v, str):
        return varsayilan
    v = v.encode("utf-8", "ignore").decode("utf-8")   # eşleşmemiş vekil (surrogate) karakterler atılır: JSON/günlük yazımı düşmesin
    v = re.sub(r"[\x00-\x1f\x7f<>\u200b-\u200f\u2028\u2029\ufeff]+", " ", v).strip()
    return v[:azami] if v else varsayilan


def _sayi(v, a, b, varsayilan=0.0):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:
        return varsayilan
    return round(max(a, min(b, float(v))), 2)


def _tam(v, a, b, varsayilan=0):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:
        return varsayilan
    return int(max(a, min(b, v)))


def ayrik_imza(sir, yontem, yol, zaman, govde):
    return hmac.new(bytes.fromhex(sir), f"{yontem}\n{yol}\n{zaman}\n".encode() + govde, hashlib.sha256).hexdigest()


def yanit_imza(sir, istek_imza, govde):
    return hmac.new(bytes.fromhex(sir), b"YANIT\n" + istek_imza.encode() + b"\n" + govde, hashlib.sha256).hexdigest()


class Hiz:
    """Anahtar başına (IP) kova: saniyede `oran` jeton, en çok `kapasite`."""

    def __init__(self, oran, kapasite):
        self.oran, self.kapasite, self.k, self.son_temizlik = oran, kapasite, {}, time.time()

    def izin(self, anahtar):
        t = time.time()
        if t - self.son_temizlik > 60:
            self.k = {a: v for a, v in self.k.items() if t - v[1] < 120}
            self.son_temizlik = t
        jeton, son = self.k.get(anahtar, (self.kapasite, t))
        jeton = min(self.kapasite, jeton + (t - son) * self.oran)
        if jeton < 1:
            self.k[anahtar] = (jeton, t)
            return False
        self.k[anahtar] = (jeton - 1, t)
        return True


# ---------------- dinleyici (ağa açılan tek parça) ----------------
class _ZSunucu(ThreadingHTTPServer):
    allow_reuse_address = False
    daemon_threads = True
    request_queue_size = 16

    def __init__(self, adres, isleyici, z):
        self.z = z
        self.sem = threading.Semaphore(24)   # eşzamanlı bağlantı sınırı
        self.ip_say, self.ip_kilit = {}, threading.Lock()
        super().__init__(adres, isleyici)

    def server_bind(self):
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):   # Windows: port özel
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

    def process_request(self, request, client_address):
        ip = client_address[0]
        with self.ip_kilit:
            if self.ip_say.get(ip, 0) >= IP_BASINA_BAGLANTI or not self.sem.acquire(blocking=False):
                self.shutdown_request(request)
                return
            self.ip_say[ip] = self.ip_say.get(ip, 0) + 1
        try:
            super().process_request(request, client_address)
        except BaseException:
            self._birak(ip)
            raise

    def _birak(self, ip):
        self.sem.release()
        with self.ip_kilit:
            n = self.ip_say.get(ip, 1) - 1
            if n > 0:
                self.ip_say[ip] = n
            else:
                self.ip_say.pop(ip, None)

    def process_request_thread(self, request, client_address):
        def kes():   # toplam süre aşıldı: soketi kapat, bekleyen okuma hata verip iş parçacığı biter
            try:
                request.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                request.close()
            except OSError:
                pass
        sayac = threading.Timer(BAGLANTI_SURE, kes)
        sayac.daemon = True
        sayac.start()
        try:
            super().process_request_thread(request, client_address)
        finally:
            sayac.cancel()
            self._birak(client_address[0])


class _ZIsleyici(BaseHTTPRequestHandler):
    timeout = 5
    server_version = "Ofis"
    sys_version = ""

    def log_message(self, *a):
        pass

    def _json(self, kod, veri, sir=None, istek_imza=None):
        b = json.dumps(veri, ensure_ascii=True).encode("ascii")   # \uXXXX kaçışları: hiçbir metin yazımı düşürmez
        self.send_response(kod)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        if sir and istek_imza:
            self.send_header("X-Imza", yanit_imza(sir, istek_imza, b))
        self.end_headers()
        self.wfile.write(b)

    def _ortak(self):
        """Ortak denetimler; sorun varsa cevabı yollayıp False döner."""
        z = self.server.z
        ip = self.client_address[0]
        if not ozel_adres(ip):
            self._json(403, {"hata": "ag"})
            return False
        if self.headers.get("Origin") is not None:   # tarayıcıdan gelen istek (CSRF / DNS rebinding)
            self._json(403, {"hata": "origin"})
            return False
        if "?" in self.path or ".." in self.path or len(self.path) > 64:
            self._json(400, {"hata": "yol"})
            return False
        if not z.hiz.izin(ip):
            self._json(429, {"hata": "hiz"})
            return False
        return True

    def do_GET(self):
        if not self._ortak():
            return
        if self.path == "/z/kimlik":
            return self._json(200, self.server.z.z_kimlik())
        self._json(404, {"hata": "yok"})

    def do_POST(self):
        try:
            self._post()
        except (OSError, ValueError, RecursionError):   # kopan/yarım istek ya da kötü biçim: iş parçacığı sessizce biter, kimseyi düşürmez
            try:
                self._json(400, {"hata": "istek"})
            except OSError:
                pass

    def _post(self):
        if not self._ortak():
            return
        z, ip = self.server.z, self.client_address[0]
        try:
            n = int(self.headers.get("Content-Length") or -1)
        except ValueError:
            n = -1
        if n < 0:
            return self._json(411, {"hata": "uzunluk"})
        if n > GOVDE_SINIR:
            return self._json(413, {"hata": "boyut"})
        ham = self.rfile.read(n)
        if self.path == "/z/esles":   # tek imzasız uç: kodla korunur
            if not z.hiz_hassas.izin(ip):
                return self._json(429, {"hata": "hiz"})
            try:
                g = json.loads(ham or b"{}")
            except (ValueError, RecursionError):
                return self._json(400, {"hata": "json"})
            kod, veri = z.z_esles(g if isinstance(g, dict) else {}, ip)
            return self._json(kod, veri)
        kim = self.headers.get("X-Ofis-Id", "")
        imza = self.headers.get("X-Imza", "")
        sir = z.dogrula("POST", self.path, kim, self.headers.get("X-Zaman", ""), imza, ham)
        if not sir:
            return self._json(403, {"hata": "imza"})
        if self.path == "/z/istek" and not z.hiz_hassas.izin(ip):
            return self._json(429, {"hata": "hiz"})
        try:
            g = json.loads(ham or b"{}")
        except (ValueError, RecursionError):
            return self._json(400, {"hata": "json"}, sir, imza)
        yol = self.path[3:].replace("-", "_")
        isle = getattr(z, "z_" + yol, None) if re.fullmatch(r"[a-z_]{2,20}", yol) and yol not in ("kimlik", "esles") else None
        if not isle:
            return self._json(404, {"hata": "yok"}, sir, imza)
        try:
            kod, veri = isle(kim, g if isinstance(g, dict) else {}, ip)
        except Exception as e:   # beklenmeyen hata sızdırmadan
            z.gunluk(f"ziyaret: {self.path} hata {type(e).__name__}")
            kod, veri = 500, {"hata": "sunucu"}
        self._json(kod, veri, sir, imza)


# ---------------- ana sınıf ----------------
class Ziyaret:
    def __init__(self, veri, kok, port=ZIYARET_PORT, kesif_port=KESIF_PORT, kisi=None, duzen=None, gorunum=None,
                 duzen_dogrula=None, gorunum_dogrula=None, gunluk=None):
        self.veri, self.kok = Path(veri), Path(kok)
        self.port, self.kesif_port = int(port), int(kesif_port)
        self.kisi_fn, self.duzen_fn, self.gorunum_fn = kisi, duzen, gorunum
        self.duzen_dogrula, self.gorunum_dogrula = duzen_dogrula or (lambda x: None), gorunum_dogrula or (lambda x: None)
        self.gunluk = gunluk or (lambda m: None)
        self.k = threading.RLock()
        self.ayar_dosya, self.esles_dosya = self.veri / "ziyaret.json", self.veri / "eslesmeler.json"
        self.hiz, self.hiz_hassas = Hiz(40, 80), Hiz(1 / 6, 10)   # 4 misafir x 4 Hz
        self.ozet = self._ozet()
        self.id, self.acik, self.hata = secrets.token_hex(8), False, ""
        self.eslesmeler = {}
        self.kod = None                  # {kod, bitis}
        self.yanlis, self.kilit_bitis = 0, 0.0
        self.istekler, self.ziyaretler = {}, {}   # ev sahibi: bekleyen istekler ve süren ziyaretler
        self.an, self.an_zaman, self.son_yoklama, self.uzakta = {}, 0.0, 0.0, False
        self.olaylar = []                # ev sahibi tarayıcısına: geldi / ayrıldı
        self.sohbet, self.sohbet_s = deque(maxlen=SOHBET_KUYRUK), 0   # ziyaret sohbeti: son mesajlar ve ev sahibinin artan sıra numarası
        self.ev_mt = deque()                                         # ev sahibinin kendi mesaj zamanları (hız sınırı)
        self.kesif = {}                  # id -> {id, ad, adres, port, protokol, son}
        self.giden = None                # misafir: {id, ad, istek, ziyaret, durum, sahne, hata_say, t}
        self.goruldu = {}                # imza -> bitiş (tekrar oynatma)
        self.sunucu = self.sunucu_is = None
        self.durdur = threading.Event()
        self._yukle()
        if self.acik:
            self.baslat()

    # ----- dosyalar -----
    def _ozet(self):
        h = hashlib.sha1(str(PROTOKOL).encode())
        for ad in ("harita.js", "atlas.js", "katalog.js"):
            try:
                h.update((self.kok / ad).read_bytes())
            except OSError:
                h.update(b"?")
        return h.hexdigest()[:10]

    def _yaz(self, hedef, veri):
        """Atomik yazım: aynı klasörde geçici dosya (mkstemp: yalnız sahibine açık), sonra os.replace."""
        hedef.parent.mkdir(parents=True, exist_ok=True)
        fd, gecici = tempfile.mkstemp(dir=str(hedef.parent), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(veri, f, ensure_ascii=True, indent=1)
            try:
                os.chmod(gecici, 0o600)
            except OSError:
                pass
            os.replace(gecici, hedef)
        except BaseException:
            try:
                os.unlink(gecici)
            except OSError:
                pass
            raise

    def _yukle(self):
        try:
            a = json.loads(self.ayar_dosya.read_text(encoding="utf-8-sig"))
            if isinstance(a.get("id"), str) and ID_RE.fullmatch(a["id"]):
                self.id = a["id"]
            self.acik = a.get("acik") is True
        except (OSError, ValueError, AttributeError):
            pass
        try:
            e = json.loads(self.esles_dosya.read_text(encoding="utf-8-sig"))
            for i, v in (e.items() if isinstance(e, dict) else []):
                if (isinstance(v, dict) and ID_RE.fullmatch(i) and isinstance(v.get("sir"), str) and re.fullmatch(r"[0-9a-f]{64}", v["sir"])
                        and ozel_adres(v.get("adres")) and isinstance(v.get("port"), int) and 1024 <= v["port"] <= 65535):
                    self.eslesmeler[i] = {"id": i, "ad": _metin(v.get("ad"), 40, "Ofis"), "sir": v["sir"], "adres": ozel_adres(v["adres"]),
                                          "port": v["port"], "tarih": _metin(v.get("tarih"), 30)}
        except (OSError, ValueError):
            pass

    def _ayar_yaz(self):
        self._yaz(self.ayar_dosya, {"id": self.id, "acik": self.acik})

    def _esles_yaz(self, d=None):
        self._ayar_yaz()   # kimlik (id) kalıcı olsun: eşleşme dosyası onunla anlamlı
        alanlar = ("id", "ad", "sir", "adres", "port", "tarih")   # çalışma anı bayrakları (çevrimiçi vb.) diske yazılmaz
        self._yaz(self.esles_dosya, {i: {k: e[k] for k in alanlar} for i, e in (self.eslesmeler if d is None else d).items()})

    # ----- dinleyici yaşam döngüsü -----
    def baslat(self):
        with self.k:
            if self.sunucu:
                return True
            try:
                self.sunucu = _ZSunucu(("0.0.0.0", self.port), _ZIsleyici, self)
            except OSError as e:
                self.sunucu, self.hata = None, f"Port dolu: {self.port} numaralı port açılamadı ({e.__class__.__name__}); başka bir ofis ya da program kullanıyor olabilir. Tercihin (açık) korunur."
                return False   # kalıcı tercih (acik) bozulmaz: port boşalınca bir sonraki açılışta dinler
            self.hata = ""
            self.durdur = threading.Event()
            threading.Thread(target=lambda: self.sunucu.serve_forever(poll_interval=0.1), daemon=True).start()
            for hedef in (self._yayin_dongu, self._dinle_dongu, self._bekci):
                threading.Thread(target=hedef, args=(self.durdur,), daemon=True).start()
            self.gunluk(f"ziyaret dinleyicisi açıldı :{self.port}")
            return True

    def durdur_hepsi(self):
        with self.k:
            self.durdur.set()
            self._misafirleri_bitir("kapandi")
            s, self.sunucu = self.sunucu, None
            self.kod, self.istekler, self.kesif = None, {}, {}
        if s:
            s.shutdown()      # eşzamanlı: port serbest kalmadan açma isteği gelirse bind çakışmasın
            s.server_close()
            self.gunluk("ziyaret dinleyicisi kapandı")

    def ayarla(self, acik):
        if acik:
            with self.k:
                self.acik = True
            self.baslat()
            with self.k:
                self._ayar_yaz()
        else:
            with self.k:
                self.acik = False
                self._ayar_yaz()
            self.durdur_hepsi()

    # ----- yerel adresler -----
    def yerel_adresler(self):
        if time.time() - getattr(self, "_adres_t", 0) < 30:
            return list(self._adres_onbellek)
        sonuc = []
        try:
            for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
                if ozel_adres(ip) and not ip.startswith("127.") and ip not in sonuc:
                    sonuc.append(ip)
        except OSError:
            pass
        self._adres_t, self._adres_onbellek = time.time(), sonuc
        return list(sonuc)

    # ----- keşif (UDP) -----
    def _yayin_dongu(self, dur):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        try:
            while not dur.wait(3.0):
                paket = json.dumps({"tur": "ofis", "id": self.id, "ad": self._ofis_adi(), "port": self.port, "protokol": PROTOKOL}, ensure_ascii=False).encode()
                hedefler = ["255.255.255.255"] + [ip.rsplit(".", 1)[0] + ".255" for ip in self.yerel_adresler()]
                gitti = 0
                for h in dict.fromkeys(hedefler):
                    try:
                        s.sendto(paket, (h, self.kesif_port))
                        gitti += 1
                    except OSError:
                        pass
                if not gitti:   # ağ yok: aynı makinedeki örnekler için döngü geri adresi
                    try:
                        s.sendto(paket, ("127.255.255.255", self.kesif_port))
                    except OSError:
                        pass
        finally:
            s.close()

    def _dinle_dongu(self, dur):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("0.0.0.0", self.kesif_port))
        except OSError:
            s.close()
            return
        s.settimeout(1.0)
        try:
            while not dur.is_set():
                try:
                    veri, kaynak = s.recvfrom(512)
                except socket.timeout:
                    continue
                except OSError:
                    break
                adres = ozel_adres(kaynak[0])
                try:
                    d = json.loads(veri)
                except (ValueError, RecursionError):
                    continue
                if (not adres or not isinstance(d, dict) or d.get("tur") != "ofis" or not isinstance(d.get("id"), str) or not ID_RE.fullmatch(d["id"])
                        or d["id"] == self.id or not isinstance(d.get("port"), int) or not 1024 <= d["port"] <= 65535):
                    continue
                with self.k:
                    for i in [i for i, v in self.kesif.items() if v["adres"] == adres and i != d["id"]]:   # IP başına tek kayıt
                        del self.kesif[i]
                    if d["id"] not in self.kesif and len(self.kesif) >= KESIF_EN_FAZLA:   # sınırsız büyümez: en eski düşer
                        del self.kesif[min(self.kesif, key=lambda i: self.kesif[i]["son"])]
                    self.kesif[d["id"]] = {"id": d["id"], "ad": _metin(d.get("ad"), 40, "Ofis"), "adres": adres, "port": d["port"],
                                           "protokol": _tam(d.get("protokol"), 0, 999), "son": time.time()}
        finally:
            s.close()

    def _bekci(self, dur):
        while not dur.wait(1.0):
            with self.k:
                self._temizle()

    def _ofis_adi(self):
        try:
            return _metin(self.kisi_fn()["ofis_adi"], 40, "Ofis")
        except Exception:
            return "Ofis"

    # ----- dinleyici: imza -----
    def dogrula(self, yontem, yol, kim, zaman, imza, govde):
        """İmza geçerliyse eşleşmenin sırrını (hex) döndürür, değilse None."""
        with self.k:
            e = self.eslesmeler.get(kim) if ID_RE.fullmatch(kim or "") else None
            if not e or not re.fullmatch(r"\d{10,16}", zaman or "") or not re.fullmatch(r"[0-9a-f]{64}", imza or ""):
                return None
            if abs(int(time.time() * 1000) - int(zaman)) > ZAMAN_PENCERE:
                return None
            if not hmac.compare_digest(ayrik_imza(e["sir"], yontem, yol, zaman, govde), imza):
                return None
            t = time.time()
            if imza in self.goruldu:   # aynı imza ikinci kez geçmez
                return None
            if len(self.goruldu) > 4000:
                self.goruldu = {a: b for a, b in self.goruldu.items() if b > t}
            self.goruldu[imza] = t + 130
            return e["sir"]

    def _temizle(self):
        t = time.time()
        for j, i in list(self.istekler.items()):
            if i["durum"] == "bekliyor" and t > i["bitis"]:
                i["durum"] = "zaman"
            if t > i["bitis"] + 120:
                del self.istekler[j]
        for j, z in list(self.ziyaretler.items()):
            if z["bitti"]:
                if t > z["bitti_t"] + 20:
                    del self.ziyaretler[j]
            elif t - z["son"] > HAREKETSIZ_SURE:
                self._bitir(z, "hareketsiz")
            elif t - z["bas"] > ZIYARET_SURE:
                self._bitir(z, "sure")
            elif self.an_zaman and t - self.an_zaman > AN_ESKI and t - z["bas"] > AN_ESKI:
                self._bitir(z, "ofis")
        if self.kod and t > self.kod["bitis"]:
            self.kod = None
        for i in [i for i, v in self.kesif.items() if t - v["son"] > 20]:
            del self.kesif[i]

    def _bitir(self, z, sebep):
        if z["bitti"]:
            return
        z["bitti"], z["bitti_t"] = sebep, time.time()
        if z["goruldu"]:
            self.olaylar.append({"tur": "ayrildi", "ad": z["ad"], "sebep": sebep})
        self.gunluk(f"ziyaret: {z['ad']} ayrıldı ({sebep})")

    def _misafirleri_bitir(self, sebep):
        for z in self.ziyaretler.values():
            self._bitir(z, sebep)

    # ----- dinleyici uçları (ev sahibi) -----
    def z_kimlik(self):
        return {"uygulama": "ofis", "protokol": PROTOKOL, "id": self.id, "ad": self._ofis_adi(), "ozet": self.ozet}

    def z_esles(self, g, ip):
        with self.k:
            t = time.time()
            self._temizle()
            if t < self.kilit_bitis:
                return 423, {"hata": "kilit", "kalan": int(self.kilit_bitis - t)}
            if not self.kod:
                return 403, {"hata": "kod"}                    # kod yokken sayılmaz: kilitlenme tuzağı olmasın
            girilen = g.get("kod")
            if not isinstance(girilen, str) or not hmac.compare_digest(girilen.encode("utf-8"), self.kod["kod"].encode()):
                self.yanlis += 1
                if self.yanlis >= 5:
                    self.yanlis, self.kod, self.kilit_bitis = 0, None, t + KILIT_SURE
                    self.gunluk("ziyaret: eşleşme 5 yanlış kodla kilitlendi")
                    return 423, {"hata": "kilit", "kalan": KILIT_SURE}
                return 403, {"hata": "kod"}
            kim, port = g.get("id"), g.get("port")
            if not isinstance(kim, str) or not ID_RE.fullmatch(kim) or kim == self.id or not isinstance(port, int) or isinstance(port, bool) or not 1024 <= port <= 65535:
                return 400, {"hata": "istek"}
            if g.get("protokol") != PROTOKOL:
                return 409, {"hata": "surum", "protokol": PROTOKOL}
            if kim in self.eslesmeler:   # aynı kimlikle ikinci eşleşme mevcut kaydı (sırrı) ezemez: önce Ayarlar'dan kaldırılmalı
                self.kod, self.yanlis = None, 0
                return 409, {"hata": "var"}
            sir = secrets.token_hex(32)
            ad = _metin(g.get("ad"), 40, "Ofis")
            yeni = dict(self.eslesmeler)
            yeni[kim] = {"id": kim, "ad": ad, "sir": sir, "adres": ozel_adres(ip), "port": port, "tarih": time.strftime("%Y-%m-%d %H:%M")}
            self._esles_yaz(yeni)          # önce diske; yazım düşerse bellek ve kod olduğu gibi kalır
            self.eslesmeler = yeni
            self.kod, self.yanlis = None, 0
            self.gunluk(f"ziyaret: {ad} ile eşleşildi")
            return 200, {"ok": True, "id": self.id, "ad": self._ofis_adi(), "sir": sir, "protokol": PROTOKOL}

    def z_ping(self, kim, g, ip):
        """İmzalı yoklama: cevabın imzası sırla doğrulandığı için yalnız gerçek eşleşme cevaplayabilir (adres değişimini doğrulamada kullanılır)."""
        return 200, {"ok": True, "protokol": PROTOKOL, "ozet": self.ozet}

    def z_kaldir(self, kim, g, ip):
        with self.k:
            if kim in self.eslesmeler:
                yeni = dict(self.eslesmeler)
                del yeni[kim]
                self._esles_yaz(yeni)
                self.eslesmeler = yeni
                for z in self.ziyaretler.values():
                    if z["kim"] == kim:
                        self._bitir(z, "eslesme")
        return 200, {"ok": True}

    def _surum_uyar(self, g):
        if g.get("protokol") != PROTOKOL or g.get("ozet") != self.ozet:
            return 409, {"hata": "surum", "protokol": PROTOKOL}
        return None

    def z_istek(self, kim, g, ip):
        with self.k:
            self._temizle()
            s = self._surum_uyar(g)
            if s:
                return s
            bekleyen = [i for i in self.istekler.values() if i["durum"] == "bekliyor"]
            if any(i["kim"] == kim for i in bekleyen):
                return 409, {"hata": "bekliyor"}
            if self.uzakta or time.time() - self.son_yoklama > 15:   # ofis başka yerde ya da kimse ekranda değil: onaylayacak kimse yok
                return 200, {"durum": "red", "sebep": "uzakta" if self.uzakta else "cevrimdisi"}
            if len(bekleyen) >= 4 or sum(1 for z in self.ziyaretler.values() if not z["bitti"]) >= EN_FAZLA_MISAFIR:
                return 200, {"durum": "red", "sebep": "dolu"}
            ad = self.eslesmeler[kim]["ad"]   # karta kayıtlı eşleşme adı yazılır; misafirin her seferinde ilan ettiği ad güvenilmez
            jeton = secrets.token_urlsafe(12)
            self.istekler[jeton] = {"kim": kim, "ad": ad, "gorunum": self.gorunum_dogrula(g.get("gorunum")), "bas": time.time(),
                                    "bitis": time.time() + ISTEK_SURE, "durum": "bekliyor", "ziyaret": None}
            self.gunluk(f"ziyaret: {ad} gelmek istiyor")
            return 202, {"istek": jeton, "kalan": ISTEK_SURE}

    def z_istek_durum(self, kim, g, ip):
        with self.k:
            self._temizle()
            i = self.istekler.get(g.get("istek"))
            if not i or i["kim"] != kim:
                return 404, {"hata": "yok"}
            d = {"durum": i["durum"], "kalan": max(0, int(i["bitis"] - time.time()))}
            if i["durum"] == "kabul":
                d["ziyaret"] = i["ziyaret"]
            return 200, d

    def z_iptal(self, kim, g, ip):
        with self.k:
            i = self.istekler.get(g.get("istek"))
            if i and i["kim"] == kim and i["durum"] == "bekliyor":
                i["durum"] = "iptal"
        return 200, {"ok": True}

    def _ziyaret_bul(self, kim, g):
        z = self.ziyaretler.get(g.get("ziyaret"))
        return z if z and z["kim"] == kim else None

    def sahne(self):
        k = self.kisi_fn()
        kar = self.an.get("kar") or {}
        return {"protokol": PROTOKOL, "ozet": self.ozet, "ofis_adi": k["ofis_adi"], "oda_adi": k["oda_adi"], "oyuncu_adi": k["oyuncu_adi"],
                "ajanlar": [{"id": i, "ad": v["ad"], "rol": v["rol"], "karakter": kar.get(i)} for i, v in k["ajanlar"].items()],
                "duzen": self.duzen_fn(), "gorunum": self.gorunum_fn()}

    def z_sahne(self, kim, g, ip):
        with self.k:
            z = self._ziyaret_bul(kim, g)
            if not z or z["bitti"]:
                return 404, {"hata": "yok"}
            return 200, self.sahne()

    def z_an(self, kim, g, ip):
        with self.k:
            self._temizle()
            z = self._ziyaret_bul(kim, g)
            if not z:
                return 404, {"hata": "yok"}
            if z["bitti"]:
                return 200, {"durum": "bitti", "sebep": z["bitti"]}
            z["son"] = time.time()
            z["konum"] = [_sayi(g.get("x"), -2, 50), _sayi(g.get("y"), -2, 34), _tam(g.get("yon"), 0, 3), _tam(g.get("yu"), 0, 1)]
            if not z["goruldu"]:
                z["goruldu"] = True
                self.olaylar.append({"tur": "geldi", "ad": z["ad"]})
                self.gunluk(f"ziyaret: {z['ad']} geldi")
            diger = [{"v": j[:6], "ad": y["ad"], "gorunum": y["gorunum"], "p": y["konum"]} for j, y in self.ziyaretler.items()
                     if y is not z and not y["bitti"] and y["goruldu"]]
            gor = _tam(g.get("gor"), 0, 2**31)
            return 200, {"durum": "surer", "an": {**self.an, "m": diger}, "ben": z["jeton"][:6], "c": self._sohbet_sonrasi(max(z["bas_s"], gor))}

    # ----- ziyaret sohbeti -----
    def _hiz_izin(self, kuyruk, t):
        """Gönderen başına kayan pencere: son MESAJ_HIZ[1] sn içinde en çok MESAJ_HIZ[0] mesaj. İzin varsa şimdiyi yazar."""
        while kuyruk and t - kuyruk[0] > MESAJ_HIZ[1]:
            kuyruk.popleft()
        if len(kuyruk) >= MESAJ_HIZ[0]:
            return False
        kuyruk.append(t)
        return True

    def _mesaj_govde(self, g, p_varsayilan):
        """Mesaj gövdesini (tur m|r|b) temizler: (tur, metin, p); gövde kötüyse (hata_kodu, cevap, None)."""
        tur = g.get("tur")
        if tur == "b":
            return "b", "Buraya gel", p_varsayilan
        if tur == "r":
            k = g.get("k")
            m = REAKSIYON.get(k) if isinstance(k, int) and not isinstance(k, bool) else None
            return ("r", m, None) if m else (400, {"hata": "tepki"}, None)
        if tur not in (None, "m"):
            return 400, {"hata": "tur"}, None
        metin = _metin(g.get("t"), MESAJ_UZUNLUK)
        return ("m", metin, None) if metin else (400, {"hata": "bos"}, None)

    def _sohbet_ekle(self, v, ad, tur, metin, p):
        self.sohbet_s += 1
        m = {"s": self.sohbet_s, "v": v, "ad": ad, "tur": tur, "t": metin, "p": p, "saat": time.strftime("%H:%M"), "zt": time.time()}
        self.sohbet.append(m)
        return m

    def _mesaj_acik(self, m):
        """Dışarı giden biçim: kimlik (v), ad, metin, sıra (s) ve yaş; iç zaman damgası çıkmaz."""
        return {"s": m["s"], "v": m["v"], "ad": m["ad"], "tur": m["tur"], "t": m["t"], "p": m["p"], "saat": m["saat"], "yas": max(0, int(time.time() - m["zt"]))}

    def _sohbet_sonrasi(self, s0, n=SOHBET_TESLIM):
        return [self._mesaj_acik(m) for m in self.sohbet if m["s"] > s0][-n:]

    def z_mesaj(self, kim, g, ip):
        """Misafir -> ev sahibi: imzalı mesaj. Gönderici kimliği imzadan (kim) ve ziyaret jetonundan gelir; adı ev sahibi yazar, istemcinin ilan ettiği ad kullanılmaz."""
        with self.k:
            z = self._ziyaret_bul(kim, g)
            if not z or z["bitti"] or not z["goruldu"]:
                return 404, {"hata": "yok"}
            n = g.get("n")
            if not isinstance(n, int) or isinstance(n, bool) or not 1 <= n <= 2**31:
                return 400, {"hata": "sira"}
            if n <= z["mesaj_n"]:   # artan sıra: aynı ya da eski numara tekrar gösterilmez
                return 200, {"ok": True, "tekrar": True}
            tur, metin, p = self._mesaj_govde(g, z["konum"][:2])
            if isinstance(tur, int):
                return tur, metin
            if not self._hiz_izin(z["mt"], time.time()):
                return 429, {"hata": "hiz"}
            z["mesaj_n"] = n
            m = self._sohbet_ekle(z["jeton"][:6], z["ad"], tur, metin, p)
            return 200, {"ok": True, "m": self._mesaj_acik(m)}

    def z_ayril(self, kim, g, ip):
        with self.k:
            z = self._ziyaret_bul(kim, g)
            if z:
                self._bitir(z, "ayrildi")
        return 200, {"ok": True}

    # ----- yerel arayüz API'si (127.0.0.1, anahtarlı; ofis.pyw yönlendirir) -----
    def api(self, ad, g, yontem="POST"):
        f = getattr(self, "a_" + ad, None) if re.fullmatch(r"[a-z]{2,12}", ad) else None
        if not f:
            return 404, {"hata": "yok"}
        if yontem != "POST" and ad != "durum":   # yan etkili uçlar yalnız POST
            return 405, {"hata": "yalnız POST"}
        try:
            return f(g if isinstance(g, dict) else {})
        except Exception as e:
            self.gunluk(f"ziyaret api {ad}: {type(e).__name__}")
            return 500, {"hata": "ziyaret hatası"}

    def _canli(self, e):
        """Kayıtlı adres (keşif paketleri yalnız ipucudur: adres ancak imzalı doğrulamadan sonra değişir, bkz. _cagir)."""
        return (e["adres"], e["port"])

    def _cagir(self, e, yol, govde, zaman_asimi=3.0):
        """Eşleşmiş ofise imzalı POST. Kayıtlı adrese ulaşılamazsa ve keşifte aynı kimlik başka adreste görüldüyse (DHCP değişimi) o adrese imzalı `/z/ping`
        atılır; cevabın imzası sırla doğrulanırsa (yalnız gerçek eşleşme imzalayabilir) adres kalıcı güncellenir ve istek orada yinelenir."""
        try:
            return self._cagir_adres(e, e["adres"], e["port"], yol, govde, zaman_asimi)
        except OSError:
            with self.k:
                k = self.kesif.get(e["id"])
                aday = (k["adres"], k["port"]) if k and time.time() - k["son"] < 20 and (k["adres"], k["port"]) != (e["adres"], e["port"]) else None
            if not aday:
                raise
            kod, _ = self._cagir_adres(e, aday[0], aday[1], "/z/ping", {}, 2.0)   # imza geçersizse ValueError, ulaşılamazsa OSError yükselir
            if kod != 200:
                raise OSError("doğrulanamadı")
            with self.k:
                if e["id"] in self.eslesmeler:
                    e["adres"], e["port"] = aday
                    self._esles_yaz()
            return self._cagir_adres(e, aday[0], aday[1], yol, govde, zaman_asimi)

    def _cagir_adres(self, e, adres, port, yol, govde, zaman_asimi=3.0):
        adres = ozel_adres(adres)
        if not adres:
            raise ValueError("adres özel ağda değil")
        ham = json.dumps(govde, ensure_ascii=False).encode("utf-8")
        zaman = str(int(time.time() * 1000))
        imza = ayrik_imza(e["sir"], "POST", yol, zaman, ham)
        c = http.client.HTTPConnection(adres, port, timeout=zaman_asimi)
        try:
            c.request("POST", yol, ham, {"Content-Type": "application/json", "Content-Length": str(len(ham)), "X-Ofis-Id": self.id, "X-Zaman": zaman, "X-Imza": imza})
            r = c.getresponse()
            b = r.read(YANIT_SINIR + 1)
            if len(b) > YANIT_SINIR:
                raise ValueError("cevap çok büyük")
            baslik = r.getheader("X-Imza")
            if baslik:
                if not hmac.compare_digest(yanit_imza(e["sir"], imza, b), baslik):
                    raise ValueError("cevap imzası geçersiz")
            elif r.status in (200, 202, 404, 409):   # başarı/uygulama cevapları imzasız olamaz (403/429/413 dinleyicinin kendi reddidir)
                raise ValueError("imzasız cevap")
            try:
                return r.status, (json.loads(b) if b else {})
            except RecursionError:
                raise ValueError("cevap çok iç içe")
        finally:
            c.close()

    def _acik_kimlik(self, adres, port, zaman_asimi=1.5):
        c = http.client.HTTPConnection(adres, port, timeout=zaman_asimi)
        try:
            c.request("GET", "/z/kimlik")
            r = c.getresponse()
            b = r.read(4096)
            d = json.loads(b)
            return d if r.status == 200 and isinstance(d, dict) and d.get("uygulama") == "ofis" else None
        finally:
            c.close()

    def a_durum(self, g):
        adresler = self.yerel_adresler()   # ad çözümleme kilidin dışında: takılırsa kimseyi tutmaz
        with self.k:
            self._temizle()
            t = time.time()
            kod = {"kod": self.kod["kod"], "kalan": int(self.kod["bitis"] - t)} if self.kod else None
            esli = [{"id": i, "ad": e["ad"], "adres": self._canli(e)[0], "port": self._canli(e)[1], "tarih": e["tarih"],
                     "gorunur": i in self.kesif, "cevrimici": e.get("cevrimici")} for i, e in self.eslesmeler.items()]
            yakin = [{"id": i, "ad": v["ad"], "adres": v["adres"], "port": v["port"], "protokol": v["protokol"], "eslesti": i in self.eslesmeler}
                     for i, v in self.kesif.items()]
            return 200, {"acik": self.acik, "dinliyor": bool(self.sunucu), "hata": self.hata, "id": self.id, "port": self.port, "kesif_port": self.kesif_port,
                         "adresler": adresler, "protokol": PROTOKOL, "kod": kod, "kilit": max(0, int(self.kilit_bitis - t)),
                         "eslesmeler": esli, "yakin": yakin, "giden": self._giden_ozet()}

    def a_ayar(self, g):
        self.ayarla(g.get("acik") is True)
        return self.a_durum({})

    def a_kod(self, g):
        with self.k:
            if not self.sunucu:
                return 409, {"hata": "Önce ofisini ziyarete aç."}
            if time.time() < self.kilit_bitis:
                return 423, {"hata": "Çok fazla yanlış deneme: birkaç dakika bekle.", "kalan": int(self.kilit_bitis - time.time())}
            self.kod = {"kod": f"{secrets.randbelow(10**6):06d}", "bitis": time.time() + KOD_SURE}
            self.yanlis = 0
        return self.a_durum({})

    def a_tara(self, g):
        """Eşleşmiş ofislerin ulaşılabilirliğini yoklar (kısa zaman aşımı, paralel)."""
        with self.k:
            liste = list(self.eslesmeler.values())

        def yokla(e):
            try:
                kod, d = self._cagir(e, "/z/ping", {}, 2.0)   # imzalı: kimliği ve sırrı da doğrular
                e["cevrimici"] = kod == 200
                e["surum_uyumlu"] = kod == 200 and d.get("protokol") == PROTOKOL and d.get("ozet") == self.ozet
            except (OSError, ValueError):
                e["cevrimici"] = False
        isler = [threading.Thread(target=yokla, args=(e,), daemon=True) for e in liste]
        for i in isler:
            i.start()
        for i in isler:
            i.join(2.5)
        return self.a_durum({})

    def a_esles(self, g):
        adres, port, kod = ozel_adres(g.get("adres")), g.get("port"), str(g.get("kod") or "").strip()
        if not adres:
            return 400, {"hata": "Adres özel ağda (örn. 192.168.x.x) bir IP olmalı."}
        port = port if isinstance(port, int) and 1024 <= port <= 65535 else ZIYARET_PORT
        if not re.fullmatch(r"\d{6}", kod):
            return 400, {"hata": "Kod 6 haneli bir sayıdır."}
        ham = json.dumps({"kod": kod, "id": self.id, "ad": self._ofis_adi(), "port": self.port, "protokol": PROTOKOL}).encode()
        c = http.client.HTTPConnection(adres, port, timeout=4)
        try:
            c.request("POST", "/z/esles", ham, {"Content-Type": "application/json", "Content-Length": str(len(ham))})
            r = c.getresponse()
            b = r.read(8192)
            d = json.loads(b) if b else {}
        except (OSError, ValueError, RecursionError):
            return 502, {"hata": "O ofise ulaşılamadı: adres, port ya da 'Ofisimi ziyarete aç' ayarı ve güvenlik duvarı (özel ağlar) denetlenmeli."}
        finally:
            c.close()
        if r.status == 423:
            return 423, {"hata": "O ofis çok fazla yanlış kod aldığı için kilitli; birkaç dakika sonra dene."}
        if r.status == 409:
            if d.get("hata") == "var":
                return 409, {"hata": "Karşı ofiste bu ofisle zaten bir eşleşme kayıtlı: iki tarafta da Ayarlar'dan eşleşmeyi kaldırıp yeniden dene."}
            return 409, {"hata": "Sürüm uyuşmuyor: iki taraf da aynı sürümü kursun."}
        if r.status == 403:
            return 403, {"hata": "Kod yanlış ya da süresi dolmuş."}
        if r.status != 200 or not isinstance(d, dict) or not isinstance(d.get("id"), str) or not ID_RE.fullmatch(d["id"]) or not isinstance(d.get("sir"), str) \
                or not re.fullmatch(r"[0-9a-f]{64}", d["sir"]) or d["id"] == self.id:
            return 502, {"hata": "Beklenmeyen cevap."}
        with self.k:
            yeni = dict(self.eslesmeler)
            yeni[d["id"]] = {"id": d["id"], "ad": _metin(d.get("ad"), 40, "Ofis"), "sir": d["sir"], "adres": adres, "port": port, "tarih": time.strftime("%Y-%m-%d %H:%M")}
            self._esles_yaz(yeni)
            self.eslesmeler = yeni
        self.gunluk(f"ziyaret: {self.eslesmeler[d['id']]['ad']} ile eşleşildi")
        return self.a_durum({})

    def a_kaldir(self, g):
        with self.k:
            e = self.eslesmeler.get(g.get("id"))
        if e:
            try:
                self._cagir(e, "/z/kaldir", {}, 2.0)   # karşı taraf da bilsin (en iyi çaba)
            except (OSError, ValueError):
                pass
            with self.k:
                yeni = dict(self.eslesmeler)
                yeni.pop(e["id"], None)
                self._esles_yaz(yeni)
                self.eslesmeler = yeni
        return self.a_durum({})

    # --- ev sahibi tarayıcısı ---
    def a_yoklama(self, g):
        with self.k:
            t = time.time()
            self.son_yoklama = t
            self.uzakta = g.get("uzakta") is True
            if self.uzakta:
                self._misafirleri_bitir("uzakta")
                for i in self.istekler.values():
                    if i["durum"] == "bekliyor":
                        i["durum"] = "red"
            an = self._an_dogrula(g.get("an"))
            if an and self.sunucu:
                self.an, self.an_zaman = an, t
            self._temizle()
            bekleyen = [{"istek": j, "ad": i["ad"], "kalan": max(0, int(i["bitis"] - t))} for j, i in self.istekler.items() if i["durum"] == "bekliyor"]
            misafirler = [{"v": j[:6], "ziyaret": j, "ad": z["ad"], "gorunum": z["gorunum"], "p": z["konum"]} for j, z in self.ziyaretler.items()
                          if not z["bitti"] and z["goruldu"]]
            olaylar, self.olaylar = self.olaylar, []
            return 200, {"acik": self.acik and bool(self.sunucu), "bekleyen": bekleyen, "misafirler": misafirler, "olaylar": olaylar,
                         "c": self._sohbet_sonrasi(_tam(g.get("gor"), 0, 2**31)), "cs": self.sohbet_s}

    def _an_dogrula(self, a):
        """Ev sahibi tarayıcısının anlık görüntüsü: yalnız sayı ve kısa kod; ad, metin ya da yol taşımaz."""
        if not isinstance(a, dict):
            return None
        out = {"d": _sayi(a.get("d"), 0, 4000)}
        out["a"] = []
        for r in (a.get("a") if isinstance(a.get("a"), list) else [])[:32]:
            if isinstance(r, list) and len(r) == 10 and isinstance(r[0], str) and AJAN_RE.fullmatch(r[0]):
                out["a"].append([r[0], _sayi(r[1], -2, 50), _sayi(r[2], -2, 34), _tam(r[3], 0, 3), _tam(r[4], 0, 1), _tam(r[5], -1, 80), _tam(r[6], 0, 1),
                                 _tam(r[7], 0, 1), _tam(r[8], 0, 1), _tam(r[9], 0, 2)])
        o = a.get("o")
        out["o"] = [_sayi(o[0], -2, 50), _sayi(o[1], -2, 34), _tam(o[2], 0, 3), _tam(o[3], 0, 1), _tam(o[4], -1, 80)] if isinstance(o, list) and len(o) == 5 else None
        k = a.get("k")
        if isinstance(k, dict):
            u = k.get("u")
            out["k"] = {"x": _sayi(k.get("x"), -2, 50), "y": _sayi(k.get("y"), -2, 34), "b": -1 if _sayi(k.get("b"), -1, 1) < 0 else 1,
                        "d": k.get("d") if k.get("d") in ("otur", "gez", "yat", "klavye", "ye") else "otur", "yu": _tam(k.get("yu"), 0, 1),
                        "h": _sayi(k.get("h"), 0, 12), "u": [_sayi(u[0], -64, 900), _sayi(u[1], -64, 600), _sayi(u[2], 0, 2000)] if isinstance(u, list) and len(u) == 3 else None}
        else:
            out["k"] = None
        kar = a.get("kar")
        out["kar"] = {i: _tam(v, 1, 99) for i, v in list(kar.items())[:32] if isinstance(i, str) and AJAN_RE.fullmatch(i)} if isinstance(kar, dict) else {}
        return out

    def a_karar(self, g):
        with self.k:
            i = self.istekler.get(g.get("istek"))
            if not i or i["durum"] != "bekliyor":
                return 404, {"hata": "İstek bulunamadı ya da süresi doldu."}
            if g.get("evet") is True and sum(1 for z in self.ziyaretler.values() if not z["bitti"]) < EN_FAZLA_MISAFIR:
                j = secrets.token_urlsafe(12)
                self.ziyaretler[j] = {"kim": i["kim"], "ad": i["ad"], "gorunum": i["gorunum"], "bas": time.time(), "son": time.time(), "konum": [46, 12, 3, 0],
                                      "goruldu": False, "bitti": None, "bitti_t": 0, "jeton": j, "bas_s": self.sohbet_s, "mesaj_n": 0, "mt": deque()}
                i["durum"], i["ziyaret"] = "kabul", j
                self.gunluk(f"ziyaret: {i['ad']} kabul edildi")
            else:
                i["durum"] = "red"
                self.gunluk(f"ziyaret: {i['ad']} reddedildi")
        return 200, {"ok": True}

    def a_ugurla(self, g):
        with self.k:
            for j, z in self.ziyaretler.items():
                if j == g.get("ziyaret") or j[:6] == g.get("v"):
                    self._bitir(z, "ugurlandi")
        return 200, {"ok": True}

    # --- misafir tarayıcısı ---
    def _giden_ozet(self):
        d = self.giden
        return {"id": d["id"], "ad": d["ad"], "durum": d["durum"]} if d else None

    def a_git(self, g):
        with self.k:
            e = self.eslesmeler.get(g.get("id"))
            if not e:
                return 404, {"durum": "yetki", "mesaj": "Bu ofisle eşleşme yok."}
            g0 = self.giden
            if g0 and g0["durum"] in ("bekliyor", "surer") and time.time() - g0["t"] < (80 if g0["durum"] == "bekliyor" else 10):
                return 409, {"durum": "hata", "mesaj": "Zaten bir ziyaret sürüyor."}
            self.giden = None
        govde = {"ad": _metin((self.kisi_fn() or {}).get("oyuncu_adi"), 40, "Misafir"), "gorunum": self.gorunum_dogrula(g.get("gorunum")),
                 "protokol": PROTOKOL, "ozet": self.ozet}
        try:
            kod, d = self._cagir(e, "/z/istek", govde)
        except (OSError, ValueError):
            return 200, {"durum": "cevrimdisi", "mesaj": f"{e['ad']} ofisine ulaşılamadı: ofis kapalı, ziyarete açık değil ya da güvenlik duvarı engelliyor olabilir."}
        if kod == 403:
            return 200, {"durum": "yetki", "mesaj": "Karşı taraf eşleşmeyi tanımıyor; eşleşmeyi kaldırıp yeniden eşleş."}
        if kod == 409 and d.get("hata") == "surum":
            return 200, {"durum": "surum", "mesaj": "Sürüm uyuşmuyor: iki taraf da aynı sürümü kursun."}
        if kod == 200 and d.get("durum") == "red":
            sebep = {"uzakta": "ev sahibi şu an başka bir ofiste", "cevrimdisi": "ev sahibinin ekranı açık değil", "dolu": "ofis dolu"}.get(d.get("sebep"), "reddedildi")
            return 200, {"durum": "red", "mesaj": f"Ziyaret olmadı: {sebep}."}
        if kod != 202 or not isinstance(d.get("istek"), str):
            return 200, {"durum": "hata", "mesaj": "Beklenmeyen cevap."}
        with self.k:
            self.giden = {"id": e["id"], "ad": e["ad"], "istek": d["istek"], "ziyaret": None, "durum": "bekliyor", "sahne": None, "hata_say": 0, "t": time.time(),
                          "n": 0, "gor": 0, "mt": deque()}
        return 200, {"durum": "bekliyor", "kalan": ISTEK_SURE}

    def a_giden(self, g):
        with self.k:
            d = self.giden
            if not d:
                return 200, {"durum": "yok"}
            if d["durum"] != "bekliyor":
                return 200, {"durum": d["durum"], "ad": d["ad"]}
            e = self.eslesmeler.get(d["id"])
        if not e:
            self.giden = None
            return 200, {"durum": "yetki", "mesaj": "Eşleşme kaldırıldı."}
        try:
            kod, r = self._cagir(e, "/z/istek-durum", {"istek": d["istek"]})
        except (OSError, ValueError):
            self.giden = None
            return 200, {"durum": "cevrimdisi", "mesaj": "Ev sahibine ulaşılamadı."}
        if kod != 200:
            self.giden = None
            return 200, {"durum": "hata", "mesaj": "Ziyaret isteği kayboldu."}
        if r.get("durum") == "bekliyor":
            return 200, {"durum": "bekliyor", "kalan": _tam(r.get("kalan"), 0, ISTEK_SURE)}
        if r.get("durum") != "kabul" or not isinstance(r.get("ziyaret"), str):
            self.giden = None
            return 200, {"durum": "zaman" if r.get("durum") == "zaman" else "red",
                         "mesaj": {"zaman": "Ev sahibi zamanında yanıt vermedi.", "iptal": "İstek iptal edildi."}.get(r.get("durum"), "Ev sahibi ziyareti kabul etmedi.")}
        d["ziyaret"] = r["ziyaret"]
        try:
            kod, s = self._cagir(e, "/z/sahne", {"ziyaret": d["ziyaret"]}, 5.0)
        except (OSError, ValueError):
            self.giden = None
            return 200, {"durum": "cevrimdisi", "mesaj": "Ev sahibine ulaşılamadı."}
        sahne = self._sahne_temizle(s) if kod == 200 else None
        if not sahne:
            self.giden = None
            return 200, {"durum": "surum", "mesaj": "Sürüm uyuşmuyor ya da sahne okunamadı: iki taraf da aynı sürümü kursun."}
        d["durum"], d["t"] = "surer", time.time()
        return 200, {"durum": "kabul", "sahne": sahne, "ad": d["ad"]}

    def a_iptal(self, g):
        d = self.giden
        if d and d["durum"] == "bekliyor":
            e = self.eslesmeler.get(d["id"])
            if e:
                try:
                    self._cagir(e, "/z/iptal", {"istek": d["istek"]}, 2.0)
                except (OSError, ValueError):
                    pass
            self.giden = None
        return 200, {"ok": True}

    def _sahne_temizle(self, s):
        """Ev sahibinden gelen sahne (güvenilmez veri): biçim ve sürüm denetimi, metinler kısaltılır, düzen/görünüm doğrulanır."""
        if not isinstance(s, dict) or s.get("protokol") != PROTOKOL or s.get("ozet") != self.ozet:
            return None
        ajanlar = []
        for a in (s.get("ajanlar") if isinstance(s.get("ajanlar"), list) else [])[:32]:
            if isinstance(a, dict) and isinstance(a.get("id"), str) and AJAN_RE.fullmatch(a["id"]):
                ajanlar.append({"id": a["id"], "ad": _metin(a.get("ad"), 40, a["id"]), "rol": _metin(a.get("rol"), 80),
                                "karakter": _tam(a["karakter"], 1, 99) if isinstance(a.get("karakter"), int) else None})
        return {"ofis_adi": _metin(s.get("ofis_adi"), 60, "Ofis"), "oda_adi": _metin(s.get("oda_adi"), 60, "YÖNETİM"), "oyuncu_adi": _metin(s.get("oyuncu_adi"), 40, "Ev sahibi"),
                "ajanlar": ajanlar, "duzen": self.duzen_dogrula(s.get("duzen")) or {"eklenen": [], "silinen": []}, "gorunum": self.gorunum_dogrula(s.get("gorunum"))}

    def _an_temizle(self, a):
        if not isinstance(a, dict):
            return None
        out = self._an_dogrula(a) or {}
        out["m"] = []
        for m in (a.get("m") if isinstance(a.get("m"), list) else [])[:8]:
            p = m.get("p") if isinstance(m, dict) else None
            if isinstance(p, list) and len(p) == 4 and isinstance(m.get("v"), str):
                out["m"].append({"v": _metin(m["v"], 8), "ad": _metin(m.get("ad"), 40, "Misafir"), "gorunum": self.gorunum_dogrula(m.get("gorunum")),
                                 "p": [_sayi(p[0], -2, 50), _sayi(p[1], -2, 34), _tam(p[2], 0, 3), _tam(p[3], 0, 1)]})
        return out

    def _mesajlar_temizle(self, liste, onceki):
        """Ev sahibinden gelen mesajlar (güvenilmez veri): biçim/uzunluk/aralık denetimi, metin temizliği, yalnız `onceki`den büyük ve artan sıra numaraları."""
        out, son = [], onceki
        for m in (liste if isinstance(liste, list) else [])[:SOHBET_TESLIM]:
            if not isinstance(m, dict):
                continue
            s, v, tur = m.get("s"), m.get("v"), m.get("tur")
            if (not isinstance(s, int) or isinstance(s, bool) or not son < s <= 2**31 or not isinstance(v, str) or not V_RE.fullmatch(v)
                    or not isinstance(tur, str) or not TUR_RE.fullmatch(tur)):
                continue
            metin = _metin(m.get("t"), MESAJ_UZUNLUK)
            p = m.get("p")
            p = [_sayi(p[0], -2, 50), _sayi(p[1], -2, 34)] if tur == "b" and isinstance(p, list) and len(p) >= 2 else None
            saat = m.get("saat")
            if not metin or (tur == "b" and not p):
                continue
            out.append({"s": s, "v": v, "ad": _metin(m.get("ad"), 40, "Misafir"), "tur": tur, "t": metin, "p": p,
                        "saat": saat if isinstance(saat, str) and SAAT_RE.fullmatch(saat) else "", "yas": _tam(m.get("yas"), 0, 86400)})
            son = s
        return out

    def a_mesaj(self, g):
        """Yerel arayüz: mesaj gönder. Ziyaretteki misafir ev sahibine imzalı /z/mesaj yollar; ev sahibi kendi kuyruğuna yazar (yalnız ofiste misafir varken)."""
        d = self.giden
        t = time.time()
        if d and d["durum"] == "surer":   # --- misafir
            e = self.eslesmeler.get(d["id"])
            if not e:
                return 409, {"hata": "Eşleşme kaldırıldı."}
            tur, metin, _ = self._mesaj_govde(g, [0, 0])   # yerel ön denetim: kötü gövde ağa çıkmaz
            if isinstance(tur, int):
                return tur, metin
            with self.k:
                if not self._hiz_izin(d["mt"], t):
                    return 429, {"hata": "hiz"}
                d["n"] += 1
                n = d["n"]
            govde = {"ziyaret": d["ziyaret"], "n": n, "tur": tur}
            if tur == "m":
                govde["t"] = metin
            elif tur == "r":
                govde["k"] = g.get("k")
            try:
                kod, r = self._cagir(e, "/z/mesaj", govde, 3.0)
            except (OSError, ValueError):
                return 502, {"hata": "baglanti"}
            if kod != 200 or not isinstance(r, dict):
                return (kod if kod in (404, 429) else 502), {"hata": "hiz" if kod == 429 else "yok" if kod == 404 else "baglanti"}
            m = self._mesajlar_temizle([r.get("m")], 0)
            return 200, {"ok": True, "m": m[0] if m else None}
        with self.k:   # --- ev sahibi
            if not self.sunucu or not any(not z["bitti"] and z["goruldu"] for z in self.ziyaretler.values()):
                return 409, {"hata": "Ofiste misafir yok."}
            ben = _metin((self.kisi_fn() or {}).get("oyuncu_adi"), 40, "Ev sahibi")
            tur, metin, p = self._mesaj_govde(g, [_sayi(g.get("x"), -2, 50), _sayi(g.get("y"), -2, 34)])
            if isinstance(tur, int):
                return tur, metin
            if not self._hiz_izin(self.ev_mt, t):
                return 429, {"hata": "hiz"}
            return 200, {"ok": True, "m": self._mesaj_acik(self._sohbet_ekle("ev", ben, tur, metin, p))}

    def a_hareket(self, g):
        d = self.giden
        if not d or d["durum"] != "surer":
            return 200, {"durum": "bitti", "sebep": "yok", "mesaj": "Ziyaret sürmüyor."}
        e = self.eslesmeler.get(d["id"])
        if not e:
            self.giden = None
            return 200, {"durum": "bitti", "sebep": "eslesme", "mesaj": "Eşleşme kaldırıldı."}
        try:
            kod, r = self._cagir(e, "/z/an", {"ziyaret": d["ziyaret"], "x": g.get("x"), "y": g.get("y"), "yon": g.get("yon"), "yu": g.get("yu"), "gor": d["gor"]}, 3.0)
        except (OSError, ValueError):
            d["hata_say"] += 1
            if d["hata_say"] >= 3:
                self.giden = None
                return 200, {"durum": "bitti", "sebep": "baglanti", "mesaj": "Bağlantı koptu: kendi ofisine döndün."}
            return 200, {"durum": "bekle", "hata": d["hata_say"]}
        if kod == 429:   # dinleyici hız sınırı: geçici, ziyareti bitirme
            return 200, {"durum": "bekle", "hata": 0}
        d["hata_say"], d["t"] = 0, time.time()
        if kod != 200 or r.get("durum") == "bitti":
            self.giden = None
            sebep = r.get("sebep") if kod == 200 else "yok"
            mesaj = {"ugurlandi": "Ev sahibi seni uğurladı.", "hareketsiz": "Uzun süre hareket gelmediği için ziyaret bitti.", "sure": "Ziyaret süresi doldu.",
                     "ofis": "Ev sahibinin ofisi yanıt vermiyor: kendi ofisine döndün.", "uzakta": "Ev sahibi başka bir ofise gitti.", "kapandi": "Ev sahibi ofisini kapattı.",
                     "eslesme": "Eşleşme kaldırıldı."}.get(sebep, "Ziyaret bitti.")
            return 200, {"durum": "bitti", "sebep": sebep, "mesaj": mesaj}
        an = self._an_temizle(r.get("an"))
        c = self._mesajlar_temizle(r.get("c"), d["gor"])
        if c:
            d["gor"] = c[-1]["s"]
        ben = r.get("ben")
        return 200, {"durum": "surer", "an": an, "c": c, "ben": ben if isinstance(ben, str) and V_RE.fullmatch(ben) else ""}

    def a_don(self, g):
        d = self.giden
        if d:
            e = self.eslesmeler.get(d["id"])
            if e and d.get("ziyaret"):
                try:
                    self._cagir(e, "/z/ayril", {"ziyaret": d["ziyaret"]}, 2.0)
                except (OSError, ValueError):
                    pass
            self.giden = None
        return 200, {"ok": True}
