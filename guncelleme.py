"""Ofis güncelleme eklentisi (ofis.pyw > EKLER["guncelleme"]): /api/guncelleme/<alt_yol>. Ağ ve kurulum mantığı araclar/guncelle.py'dedir (stdlib, ayrı süreçte çalışır).

  GET  durum    kurulu sürüm, depo ayarlı mı, son denetim, bulunan yeni sürüm, otomatik denetim ayarı, geri dönüş var mı, süren işlem
  POST denetle  GitHub Releases `latest`'e sorar (depo: surum.json > depo; boşsa "yayın deposu ayarlanmadı")
  POST kur      guncelle.py --internet'i AYRI süreçte başlatır (indirme + sha256 + izin listesi + yedek + yeniden başlatma); ilerleme VERI/guncelleme-durum.json
  POST geri     guncelle.py --geri
  POST ayar     {"otomatik": true|false}: açılışta günde en çok bir kez sürüm bilgisi sorulur (kullanıcı açarsa; varsayılan kapalı). Hiçbir veri gönderilmez.
Anahtar/Host/Origin denetimi çekirdekte (ofis.pyw) yapılır; bu modül yalnız mantığı taşır.
"""
import importlib.util
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

GUN = 24 * 3600
ISLEM_ZAMAN = 1800   # durum dosyasındaki işlem bu süreden eskiyse "süren işlem" sayılmaz


def _yukle(kok):
    """araclar/guncelle.py'yi dosya yolundan yükler (araclar/ sys.path'te değil)."""
    yol = Path(kok) / "araclar" / "guncelle.py"
    if not yol.is_file():
        raise ImportError("araclar/guncelle.py yok")
    ozel = importlib.util.spec_from_file_location("ofis_guncelle", yol)
    m = importlib.util.module_from_spec(ozel)
    ozel.loader.exec_module(m)
    return m


class Guncelleme:
    def __init__(self, veri, kok, gunluk):
        self.veri, self.kok, self.gunluk = Path(veri), Path(kok), gunluk
        self._baslat_kilit, self._baslatildi = threading.Lock(), 0.0   # kur/geri çift POST'u iki süreç başlatmasın
        self.g = _yukle(kok)
        self.ayar_dosya = self.veri / "guncelleme.json"
        self.durum_dosya = self.veri / "guncelleme-durum.json"
        self._kilit = threading.Lock()
        self._sorgu = False
        self._son_elle = 0.0

    # ---- ayar dosyası ----
    def _oku(self):
        try:
            d = json.loads(self.ayar_dosya.read_text(encoding="utf-8"))
            return d if isinstance(d, dict) else {}
        except (OSError, ValueError):
            return {}

    def _yaz(self, **kv):
        with self._kilit:
            d = self._oku()
            for k, v in kv.items():
                if v is None:
                    d.pop(k, None)
                else:
                    d[k] = v
            self.veri.mkdir(parents=True, exist_ok=True)
            gecici = self.ayar_dosya.with_name("guncelleme.json.tmp")
            gecici.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
            os.replace(gecici, self.ayar_dosya)

    def _islem(self):
        try:
            d = json.loads(self.durum_dosya.read_text(encoding="utf-8"))
            if isinstance(d, dict) and time.time() - float(d.get("zaman", 0)) < ISLEM_ZAMAN:
                return {"asama": str(d.get("asama", ""))[:20], "mesaj": str(d.get("mesaj", ""))[:600], "surum": str(d.get("surum", ""))[:20]}
        except (OSError, ValueError, TypeError):
            pass
        return None

    def _mesgul(self):
        i = self._islem()
        return bool(i and i["asama"] not in ("bitti", "hata", "yeniden"))

    # ---- durum ----
    def durum(self):
        g = self.g
        surum, depo = g.surum_oku(self.kok)
        a = self._oku()
        son = a.get("son") if isinstance(a.get("son"), dict) else None
        yeni = bool(son) and g.yeni_mi(son.get("surum"), self.kok)
        if self._otomatik_gerek(a, depo):
            self._arka_denetim()
        return {"surum": surum, "depo_ayarli": bool(depo), "otomatik": bool(a.get("otomatik")),
                "son_denetim": time.strftime("%Y-%m-%d %H:%M", time.localtime(a["son_denetim"])) if isinstance(a.get("son_denetim"), (int, float)) else "",
                "son_hata": str(a.get("son_hata") or "")[:200],
                "son": ({k: str(son.get(k) or "")[:1500] for k in ("surum", "notlar", "url", "yayin")} if son else None),
                "yeni": yeni, "geri_var": g.geri_var(), "islem": self._islem(), "mesgul": self._mesgul(),
                "mesaj": "" if depo else "Yayın deposu ayarlanmadı: çevrimiçi denetim kapalı. Yerel güncelleme için: py -3 araclar/guncelle.py --zip Ofis-x.zip"}

    def _otomatik_gerek(self, a, depo):
        if not depo or a.get("otomatik") is not True or self._sorgu:
            return False
        son = a.get("son_deneme")
        return not isinstance(son, (int, float)) or time.time() - son >= GUN

    def _arka_denetim(self):
        self._sorgu = True
        self._yaz(son_deneme=time.time())   # başarısız da olsa günde bir denemeden fazla yapılmaz

        def is_():
            try:
                self.denetle()
            except Exception as e:   # ağ yok vb.: sessiz geç, bir sonraki gün yeniden
                self.gunluk(f"güncelleme otomatik denetim: {e}")
            finally:
                self._sorgu = False
        threading.Thread(target=is_, daemon=True).start()

    def denetle(self):
        g = self.g
        depo = g.surum_oku(self.kok)[1]
        if not depo:
            raise ValueError("Yayın deposu ayarlanmadı.")
        try:
            son = g.denetle(depo)
        except ValueError as e:
            self._yaz(son_deneme=time.time(), son_hata=str(e))
            raise
        self._yaz(son_denetim=time.time(), son_deneme=time.time(), son_hata=None,
                  son={k: son[k] for k in ("surum", "notlar", "url", "yayin")})
        return son

    # ---- alt işlem ----
    def _baslat(self, arg):
        """guncelle.py'yi bu süreçten bağımsız (detached) başlatır: çıkınca bile işini bitirir (ofisi kapatıp yeniden açan odur)."""
        main = sys.modules.get("__main__")
        port = int(getattr(main, "PORT", 8540) or 8540)
        ofis_arg = [a for a in sys.argv[1:]]
        komut = [sys.executable, str(self.kok / "araclar" / "guncelle.py"), *arg, "--veri", str(self.veri), "--port", str(port),
                 "--yeniden-baslat", "--ofis-arg-json", json.dumps(ofis_arg)]
        self.veri.mkdir(parents=True, exist_ok=True)
        gunluk = open(self.veri / "guncelleme.log", "ab")
        kw = {"stdin": subprocess.DEVNULL, "stdout": gunluk, "stderr": gunluk, "close_fds": True, "cwd": str(self.kok)}
        if os.name == "nt":
            kw["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        else:
            kw["start_new_session"] = True
        try:
            subprocess.Popen(komut, **kw)
        finally:
            gunluk.close()

    def api(self, alt_yol, govde, yontem):
        alt = alt_yol.strip("/")
        if alt == "durum":
            return (200, self.durum()) if yontem == "GET" else (405, {"hata": "GET"})
        if yontem != "POST":
            return 405, {"hata": "POST"}
        if alt == "ayar":
            if not isinstance(govde.get("otomatik"), bool):
                return 400, {"hata": "otomatik: true/false olmalı."}
            self._yaz(otomatik=govde["otomatik"], son_deneme=None)   # yeni açıldıysa bir sonraki durum sorgusunda denetler
            return 200, self.durum()
        if alt == "denetle":
            if not self.g.surum_oku(self.kok)[1]:
                return 409, {**self.durum(), "hata": "Yayın deposu ayarlanmadı: çevrimiçi denetim kapalı."}
            if time.time() - self._son_elle < 5:   # art arda basışlar GitHub sınırına takılmasın
                return 200, self.durum()
            self._son_elle = time.time()
            try:
                self.denetle()
            except ValueError as e:
                return 502, {**self.durum(), "hata": str(e)}
            return 200, self.durum()
        if alt in ("kur", "geri"):
            with self._baslat_kilit:
                if time.time() - self._baslatildi < 15:
                    return 409, {**self.durum(), "hata": "Başka bir güncelleme işlemi sürüyor."}
                return self._kur_geri(alt)
        return 404, {"hata": "yok"}

    def _kur_geri(self, alt):
        if True:
            if self._mesgul():
                return 409, {**self.durum(), "hata": "Başka bir güncelleme işlemi sürüyor."}
            d = self.durum()
            if alt == "kur":
                if not d["depo_ayarli"]:
                    return 409, {**d, "hata": "Yayın deposu ayarlanmadı: çevrimiçi güncelleme kapalı."}
                if not d["yeni"]:
                    return 409, {**d, "hata": "Kurulacak yeni sürüm yok; önce Denetle."}
            elif not d["geri_var"]:
                return 409, {**d, "hata": "Geri dönülecek önceki sürüm yok."}
            try:
                self.durum_dosya.unlink()
            except OSError:
                pass
            self._baslat(["--internet"] if alt == "kur" else ["--geri"])
            self._baslatildi = time.time()
            self.gunluk(f"güncelleme: {alt} başlatıldı")
            return 200, {"ok": True, "baslatildi": alt}


def kur(VERI, KOK, VAULT, KISI, gunluk):
    nesne = Guncelleme(VERI, KOK, gunluk)
    depo = nesne.g.surum_oku(KOK)[1]
    if nesne._otomatik_gerek(nesne._oku(), depo):   # kullanıcı açtıysa ve son denemeden 24 saat geçtiyse açılışta bir kez
        nesne._arka_denetim()
    return nesne
