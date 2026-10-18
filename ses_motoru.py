"""Ajan sesleri (yerel TTS) sunucu tarafı: ofis.pyw bunu EKLER["ses"] olarak kurar, /api/ses/<alt_yol> isteklerini api() karşılar.

Motor: EMA Lightning (tek ses, Türkçe), ayrı bir Python ortamında çalışan kalıcı işçi süreçte (ses_isci.py). Motor adı `motor` ile değişir
(şimdilik yalnız "ema"). Python yolu sırası: VERI/ses.json > python -> <VAULT>/.claude/tools/ema/.venv/...
Hiçbiri yoksa ses kapalıdır (durum.var = false) ve istemci hiç istek atmaz. Dağıtılan kodda kullanıcıya özel yol yok.

Uçlar (anahtar denetimi çekirdekte):
  GET  durum                       -> {motor, var, hazir, yukleniyor, kuyruk, onbellek_mb, bosta_sn, hata}
  POST uret {metin, hiz?, bekle_sn?} -> 200 audio/wav  |  202 {bekle: true, yukleniyor}  |  4xx/5xx {hata}
  POST isit                        -> işçiyi arka planda yükler
  POST durdur                      -> işçiyi kapatır (GPU belleği boşalır)
Önbellek VERI/ses/<sha1>.wav (~300 MB üstünde eskiler silinir). Aynı anda tek üretim; kuyruk sınırlı; işçi çökerse bir kez yeniden açılır;
10 dk boşta kalırsa kapanır; ofis kapanınca (atexit, stdin EOF) işçi de kapanır. Metin sunucuda temizlenir (emoji/sembol atılır, <= 240 karakter).
"""
import atexit
import hashlib
import json
import os
import queue
import re
import subprocess
import threading
import time
import unicodedata
from pathlib import Path

MOTOR = "ema"
ENFAZLA_BAYT = 300 * 1024 * 1024     # önbellek bunu aşınca eskiler silinir
HEDEF_BAYT = 240 * 1024 * 1024       # ... şu boyuta inene dek
BOSTA_SN = 600                       # işçi bu kadar boşta kalırsa kapanır
YUKLEME_ZA = 240                     # model yükleme zaman aşımı (ilk yükleme yavaş)
URETIM_ZA = 60                       # tek üretim zaman aşımı
KUYRUK_ENFAZLA = 8
METIN_ENFAZLA = 240
BEKLE_VARSAYILAN = 6.0
PY_ALT = ("Scripts", "python.exe") if os.name == "nt" else ("bin", "python")


def metin_temizle(m):
    """Emoji/sembol/biçim işaretleri atılır; harf, rakam ve temel noktalama kalır. En çok 240 karakter (sözcük sınırında)."""
    if not isinstance(m, str):
        return ""
    m = m.replace("…", "...").replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
    m = re.sub(r"https?://\S+", " ", m)
    m = re.sub(r"[*_`~#>|\\{}\[\]<>^=+@$&/]+", " ", m)
    cikti = []
    for c in m:
        k = unicodedata.category(c)
        if k[0] in "LN" or c in " .,!?;:'\"()-%":
            cikti.append(c)
        elif k[0] == "M" and cikti:     # birleşik aksan (nadir)
            cikti.append(c)
        elif c in "\n\t":
            cikti.append(" ")
    m = re.sub(r"\s+", " ", "".join(cikti)).strip()
    m = re.sub(r"([.!?,;:])\1{3,}", r"\1\1\1", m)
    if len(m) > METIN_ENFAZLA:
        kes = m[:METIN_ENFAZLA]
        son = max(kes.rfind(". "), kes.rfind("! "), kes.rfind("? "))
        if son < METIN_ENFAZLA // 2:
            son = kes.rfind(" ")
        m = (kes[: son + 1] if son > 0 else kes).strip()
    return m if re.search(r"[^\W_]", m) else ""


class Is:
    __slots__ = ("anahtar", "metin", "hiz", "olay", "hata", "dosya")

    def __init__(self, anahtar, metin, hiz, dosya):
        self.anahtar, self.metin, self.hiz, self.dosya = anahtar, metin, hiz, dosya
        self.olay, self.hata = threading.Event(), ""


class Ses:
    def __init__(self, VERI, KOK, VAULT, KISI, gunluk):
        self.VERI, self.KOK, self.VAULT, self.KISI, self.gunluk = Path(VERI), Path(KOK), Path(VAULT), KISI or {}, gunluk
        self.dizin = self.VERI / "ses"
        self.isci_dosya = self.KOK / "ses_isci.py"
        self.kilit = threading.Lock()          # işçi süreci üzerindeki işlemler
        self.ic = threading.Lock()             # iş sözlüğü ve sayaçlar
        self.p = None
        self.satirlar = queue.Queue()
        self.hazir = False
        self.yukleniyor = False
        self.son_hata = ""
        self.son = 0.0
        self.isler = {}                        # anahtar -> Is (üretimde ya da kuyrukta)
        self.kuyruk = queue.Queue()
        self.uretici = None
        self._py_onbellek = (0.0, None)
        threading.Thread(target=self._bekci, daemon=True).start()
        atexit.register(self.kapat)

    # ---------- ayar ve ortam ----------
    def _ayar(self):
        try:
            d = json.loads((self.VERI / "ses.json").read_text(encoding="utf-8"))
            return d if isinstance(d, dict) else {}
        except (OSError, ValueError):
            return {}

    def python_yolu(self):
        t, p = self._py_onbellek
        if time.time() - t < 5:
            return p
        adaylar = [self._ayar().get("python"), str(self.VAULT.joinpath(".claude", "tools", "ema", ".venv", *PY_ALT))]
        bulunan = next((a for a in adaylar if isinstance(a, str) and a and os.path.isfile(a)), None)
        self._py_onbellek = (time.time(), bulunan)
        return bulunan

    def var(self):
        return bool(self.python_yolu()) and self.isci_dosya.is_file()

    def _anahtar(self, metin, hiz):
        return hashlib.sha1(f"{MOTOR}|{hiz:.2f}|{metin}".encode("utf-8")).hexdigest()

    # ---------- işçi süreci ----------
    def _isci_ac(self):
        """kilit elde. Süreci açar ve 'hazir' satırını bekler."""
        py = self.python_yolu()
        if not py:
            raise RuntimeError("Ses motoru bulunamadı.")
        self.yukleniyor, self.hazir = True, False
        self.satirlar = queue.Queue()
        env = {**os.environ, "HF_HUB_OFFLINE": "1", "PYTHONIOENCODING": "utf-8"}
        hf = self._ayar().get("hf_home")   # ses.json: model önbelleği varsayılan yerde değilse (ör. Kut'un kurduğu ortam)
        if isinstance(hf, str) and hf and os.path.isdir(hf):
            env["HF_HOME"] = hf
        try:
            self.p = subprocess.Popen([py, "-I", str(self.isci_dosya)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                      cwd=str(self.KOK), env=env, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except OSError as e:
            self.yukleniyor = False
            raise RuntimeError(f"İşçi açılamadı: {e}")
        p, q = self.p, self.satirlar

        def oku():
            try:
                for ham in iter(p.stdout.readline, b""):
                    q.put(ham)
            except Exception:  # noqa: BLE001
                pass
            q.put(None)   # süreç bitti
        threading.Thread(target=oku, daemon=True).start()
        try:
            ilk = q.get(timeout=YUKLEME_ZA)
        except queue.Empty:
            self._isci_durdur()
            raise RuntimeError("Ses modeli zamanında yüklenemedi.")
        if ilk is None:
            self._isci_durdur()
            raise RuntimeError("Ses işçisi açılırken kapandı.")
        try:
            d = json.loads(ilk.decode("utf-8"))
        except ValueError:
            d = {}
        if not d.get("hazir"):
            self._isci_durdur()
            raise RuntimeError("Ses modeli yüklenemedi: " + str(d.get("hata", ""))[:200])
        self.hazir, self.yukleniyor = True, False

    def _isci_durdur(self):
        p, self.p = self.p, None
        self.hazir = self.yukleniyor = False
        if p and p.poll() is None:
            try:
                p.stdin.close()
                p.wait(timeout=5)
            except Exception:  # noqa: BLE001
                try:   # venv python'u bir kılıf: gerçek süreç çocuğu, ağaçla birlikte öldür
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], capture_output=True, timeout=10)
                    else:
                        p.kill()
                except Exception:  # noqa: BLE001
                    pass

    def kapat(self):
        with self.kilit:
            self._isci_durdur()

    def _istek(self, g):
        """kilit elde. Bir üretim isteği; süreç yoksa ya da çökmüşse bir kez yeniden açar."""
        for deneme in (0, 1):
            if not self.p or self.p.poll() is not None:
                self._isci_ac()
            try:
                self.p.stdin.write((json.dumps(g, ensure_ascii=False) + "\n").encode("utf-8"))
                self.p.stdin.flush()
                satir = self.satirlar.get(timeout=URETIM_ZA)
            except (OSError, ValueError):
                satir = None
            except queue.Empty:
                self._isci_durdur()
                raise RuntimeError("Üretim zaman aşımına uğradı.")
            if satir is None:   # çöktü: yeniden aç, bir kez daha dene
                self._isci_durdur()
                if deneme == 0:
                    self.gunluk("ses: işçi kapandı, yeniden açılıyor")
                    continue
                raise RuntimeError("Ses işçisi çöktü.")
            r = json.loads(satir.decode("utf-8"))
            if not r.get("ok"):
                raise RuntimeError(str(r.get("hata") or "Ses hatası")[:200])
            return r

    # ---------- üretici (aynı anda tek üretim) ----------
    def _uretici_dongu(self):
        while True:
            is_ = self.kuyruk.get()
            try:
                with self.kilit:
                    self.son = time.time()
                    if is_ is None:   # yalnız ısıtma
                        if not self.p or self.p.poll() is not None:
                            self._isci_ac()
                        continue
                    if not is_.dosya.is_file():
                        self.dizin.mkdir(parents=True, exist_ok=True)
                        self._istek({"metin": is_.metin, "hiz": is_.hiz, "cikti": str(is_.dosya)})
                        self._onbellek_buda(is_.dosya)
                    self.son = time.time()
                self.son_hata = ""
            except Exception as e:  # noqa: BLE001
                self.son_hata = str(e)[:200]
                self.gunluk("ses: " + self.son_hata)
                if is_ is not None:
                    is_.hata = self.son_hata
            finally:
                if is_ is not None:
                    with self.ic:
                        self.isler.pop(is_.anahtar, None)
                    is_.olay.set()

    def _uretici_baslat(self):
        with self.ic:
            if not self.uretici or not self.uretici.is_alive():
                self.uretici = threading.Thread(target=self._uretici_dongu, daemon=True)
                self.uretici.start()

    def _onbellek_buda(self, koru=None):
        try:
            dosyalar = [(f.stat().st_mtime, f.stat().st_size, f) for f in self.dizin.glob("*.wav")]
            toplam = sum(b for _, b, _ in dosyalar)
            if toplam <= ENFAZLA_BAYT:
                return
            for _, b, f in sorted(dosyalar, key=lambda x: x[0]):
                if koru is not None and f == koru:   # yeni üretilen dosya hiç silinmez
                    continue
                try:
                    f.unlink()
                except OSError:
                    continue
                toplam -= b
                if toplam <= HEDEF_BAYT:
                    break
        except OSError:
            pass

    def _onbellek_mb(self):
        try:
            return round(sum(f.stat().st_size for f in self.dizin.glob("*.wav")) / 1048576, 1)
        except OSError:
            return 0.0

    def _bekci(self):
        while True:
            time.sleep(15)
            if self.p and self.p.poll() is None and time.time() - self.son > BOSTA_SN and self.kilit.acquire(blocking=False):
                try:
                    if self.kuyruk.empty() and time.time() - self.son > BOSTA_SN:
                        self.gunluk("ses: boşta, işçi kapatılıyor")
                        self._isci_durdur()
                finally:
                    self.kilit.release()

    # ---------- API ----------
    def durum(self):
        p_var = bool(self.p and self.p.poll() is None)
        return {"motor": MOTOR, "var": self.var(), "hazir": p_var and self.hazir, "yukleniyor": self.yukleniyor, "kuyruk": self.kuyruk.qsize(),
                "onbellek_mb": self._onbellek_mb(), "bosta_sn": int(time.time() - self.son) if p_var else None, "hata": self.son_hata}

    def api(self, alt_yol, govde, yontem):
        alt_yol = alt_yol.strip("/")
        if alt_yol == "durum" and yontem == "GET":
            return 200, self.durum()
        if yontem != "POST":
            return 405, {"hata": "yöntem"}
        g = govde if isinstance(govde, dict) else {}
        if alt_yol == "durdur":
            self.kapat()
            return 200, self.durum()
        if not self.var():
            return 503, {"hata": "Ses motoru bulunamadı.", "yok": True}
        if alt_yol == "isit":
            self._uretici_baslat()
            if not self.hazir and not self.yukleniyor:
                self.kuyruk.put(None)
            return 200, self.durum()
        if alt_yol != "uret":
            return 404, {"hata": "yok"}
        metin = metin_temizle(g.get("metin"))
        if not metin:
            return 400, {"hata": "Metin boş."}
        try:
            hiz = round(min(1.6, max(0.6, float(g.get("hiz") or 1.0))) * 20) / 20
        except (TypeError, ValueError):
            hiz = 1.0
        try:
            bekle = min(40.0, max(0.0, float(g.get("bekle_sn", BEKLE_VARSAYILAN))))
        except (TypeError, ValueError):
            bekle = BEKLE_VARSAYILAN
        anahtar = self._anahtar(metin, hiz)
        dosya = self.dizin / (anahtar + ".wav")
        if dosya.is_file():
            return self._wav(dosya)
        with self.ic:
            is_ = self.isler.get(anahtar)
            if not is_:
                if self.kuyruk.qsize() >= KUYRUK_ENFAZLA:
                    return 429, {"hata": "Ses kuyruğu dolu.", "dolu": True}
                is_ = self.isler[anahtar] = Is(anahtar, metin, hiz, dosya)
                self.kuyruk.put(is_)
        self._uretici_baslat()
        if not self.hazir:
            self.yukleniyor = True   # işçi henüz yok: üretici açacak (202 cevabında istemci "yükleniyor" görsün)
        if not is_.olay.wait(bekle):
            return 202, {"bekle": True, "yukleniyor": self.yukleniyor}
        if dosya.is_file():
            return self._wav(dosya)
        return 500, {"hata": is_.hata or "Üretilemedi."}

    def _wav(self, dosya):
        try:
            os.utime(dosya, None)   # son kullanım: budama eskiden başlar
            return 200, ("audio/wav", dosya.read_bytes())
        except OSError:
            return 500, {"hata": "Önbellek okunamadı."}


def kur(VERI, KOK, VAULT, KISI, gunluk):
    return Ses(VERI, KOK, VAULT, KISI, gunluk)
