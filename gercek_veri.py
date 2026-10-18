"""Ofis gerçek veri eklentisi (ofis.pyw > EKLER["gercek"]): /api/gercek/<alt_yol>. SALT-OKUR: vault'a hiçbir şey yazılmaz.

  GET  ozet    {guncel, gorevler: [{id, baslik, durum, proje, yol, son, gecikti, bugun}], basliklar: [...], son_oturum: {baslik, ozet}, sayilar: {acik, bugun, gecikti}}
  POST yenile  önbelleği atlayıp aynı özeti yeniden okur

Kaynaklar (genel bir beyin vault'u): tasks/*.md (JSON ön yazı: id, title, status, project; varsa due/son tarih alanı), companion klasöründeki
Threads.md ("## Active Threads" altındaki "### " başlıkları) ve Last-Session.md (en üstteki "## " oturum kartı). Gövdeden tarih ayıklanmaz: yalnız yapısal alanlar.
Gizlilik: bu uç yalnız 127.0.0.1 anahtarlı API'dir; ziyaret dinleyicisine (ziyaret.py) hiçbir şey gitmez. Anahtar/Host/Origin denetimi çekirdekte yapılır.
"""
import json
import re
import threading
import time
from datetime import date, datetime
from pathlib import Path

ONBELLEK_SN = 60
DOSYA_SINIR = 64 * 1024          # bir görev dosyasından en çok bu kadar okunur (ön yazı başta)
OTURUM_SINIR = 256 * 1024        # Threads/Last-Session için
DOSYA_SAYI = 600                 # taranan görev dosyası üst sınırı
GOREV_SAYI = 40                  # cevaptaki görev üst sınırı
KAPALI = {"done", "cancelled", "canceled", "archived", "iptal", "bitti"}
SON_ALANLARI = ("due", "due_date", "son", "son_tarih", "deadline", "bitis")
TARIH_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")
ONYAZI_RE = re.compile(r"\A﻿?---\r?\n(.*?)\r?\n---", re.S)
KONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")


def _temiz(s, n):
    s = KONTROL_RE.sub(" ", str(s if s is not None else "")).replace("<", "").replace(">", "").strip()   # başlıklar sayfada metin olarak da basılır
    s = re.sub(r"\s+", " ", s)
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def _md_sade(s):
    s = re.sub(r"\*\*|__|`", "", s)
    return re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)


def _oku(yol, sinir):
    with open(yol, "rb") as f:
        return f.read(sinir).decode("utf-8", errors="replace")


def _tarih(v):
    """YYYY-MM-DD ile başlayan geçerli bir tarih ise 'YYYY-MM-DD' döner, değilse None."""
    if not isinstance(v, str):
        return None
    m = TARIH_RE.match(v.strip())
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
    except ValueError:
        return None


class GercekVeri:
    def __init__(self, vault, gunluk):
        self.vault = Path(vault) if vault else None
        self.gunluk = gunluk
        self._kilit = threading.Lock()
        self._onbellek = None
        self._zaman = 0.0

    # ---- kaynaklar ----
    def _companion(self):
        try:
            return next((p for p in self.vault.iterdir() if p.is_dir() and p.name.endswith("Companion")), None)
        except OSError:
            return None

    def _gorevler(self, bugun):
        klasor = self.vault / "tasks"
        liste = []
        try:
            dosyalar = sorted(p for p in klasor.glob("*.md") if p.is_file())[:DOSYA_SAYI]
        except OSError:
            return liste, 0
        for p in dosyalar:
            try:
                m = ONYAZI_RE.match(_oku(p, DOSYA_SINIR))
                d = json.loads(m.group(1)) if m else None
            except (OSError, ValueError):
                continue
            if not isinstance(d, dict):
                continue
            durum = _temiz(d.get("status"), 24).lower()
            baslik = _temiz(d.get("title"), 120)
            if not baslik or durum in KAPALI:
                continue
            son = next((t for t in (_tarih(d.get(k)) for k in SON_ALANLARI) if t), None)
            liste.append({"id": _temiz(d.get("id") or p.stem, 80), "baslik": baslik, "durum": durum or "inbox",
                          "proje": _temiz(d.get("project"), 40) or None, "yol": f"tasks/{p.name}", "son": son,
                          "gecikti": bool(son and son < bugun), "bugun": bool(son and son == bugun)})
        sira = {"active": 0, "doing": 0}
        liste.sort(key=lambda g: (0 if g["gecikti"] else 1 if g["bugun"] else 2, sira.get(g["durum"], 1), g["son"] or "9999", g["baslik"]))
        return liste, len(liste)

    def _basliklar(self, comp):
        try:
            metin = _oku(comp / "Threads.md", OTURUM_SINIR)
        except OSError:
            return []
        sonuc, icinde = [], False
        for s in metin.splitlines():
            if s.startswith("## "):
                icinde = s[3:].strip().lower().startswith("active")
            elif icinde and s.startswith("### "):
                b = _temiz(_md_sade(s[4:]), 80)
                if b:
                    sonuc.append(b)
                if len(sonuc) >= 6:
                    break
        return sonuc

    def _son_oturum(self, comp):
        try:
            metin = _oku(comp / "Last-Session.md", OTURUM_SINIR)
        except OSError:
            return None
        satirlar = metin.splitlines()
        bas = next((i for i, s in enumerate(satirlar) if s.startswith("## ")), None)
        if bas is None:
            return None
        son = next((i for i in range(bas + 1, len(satirlar)) if satirlar[i].startswith("## ")), len(satirlar))
        parcalar = [x.strip() for x in satirlar[bas][3:].split("·")]
        baslik = " · ".join(parcalar[:2]) if len(parcalar) >= 2 else parcalar[0]   # son parça oturum kimliği: gösterilmez
        govde = "\n".join(satirlar[bas + 1: son])
        m = re.search(r"\*\*Yapılan:\*\*\s*(.+?)(?=\n\s*\*\*|\Z)", govde, re.S)
        ozet = m.group(1) if m else next((s for s in govde.splitlines() if s.strip()), "")
        return {"baslik": _temiz(_md_sade(baslik), 90), "ozet": _temiz(_md_sade(ozet), 300)}

    # ---- özet ----
    def _hesapla(self):
        bugun = date.today().isoformat()
        cevap = {"guncel": datetime.now().isoformat(timespec="seconds"), "gorevler": [], "basliklar": [],
                 "son_oturum": None, "sayilar": {"acik": 0, "bugun": 0, "gecikti": 0}}
        if not self.vault or not self.vault.is_dir():
            cevap["uyari"] = "vault bulunamadı"
            return cevap
        gorevler, acik = self._gorevler(bugun)
        cevap["sayilar"] = {"acik": acik, "bugun": sum(g["bugun"] for g in gorevler), "gecikti": sum(g["gecikti"] for g in gorevler)}
        cevap["gorevler"] = gorevler[:GOREV_SAYI]
        comp = self._companion()
        if comp:
            cevap["basliklar"] = self._basliklar(comp)
            cevap["son_oturum"] = self._son_oturum(comp)
        return cevap

    def ozet(self, zorla=False):
        with self._kilit:
            if zorla or self._onbellek is None or time.time() - self._zaman > ONBELLEK_SN:
                self._onbellek = self._hesapla()
                self._zaman = time.time()
            return self._onbellek

    def api(self, alt_yol, govde, yontem):
        alt = alt_yol.strip("/")
        try:
            if alt == "ozet" and yontem == "GET":
                return 200, self.ozet()
            if alt == "yenile" and yontem == "POST":
                return 200, self.ozet(zorla=True)
        except Exception as e:
            self.gunluk(f"gercek_veri: {type(e).__name__}: {e}")
            return 500, {"hata": "Gerçek veri okunamadı."}
        return 404, {"hata": "yok"}


def kur(VERI, KOK, VAULT, KISI, gunluk):
    return GercekVeri(VAULT, gunluk)
