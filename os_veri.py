"""Ofis bilgisayarı (BeyinOS) eklentisi (ofis.pyw > EKLER["os"]): /api/os/<alt_yol>. Okuma SALT-OKURDUR; vault'a bu eklenti hiçbir şey yazmaz.

  GET  ozet    {guncel, hedefler, fikirler, isler, bitenler, yapilanlar, posta, projeler, sayilar, kaynaklar}
  POST yenile  önbelleği atlayıp aynı özeti yeniden okur
  GET  ayar    {dogrudan}           POST ayar {dogrudan: bool}

Kaynaklar (genel bir beyin vault'u; yollar VERI/os.json ile değiştirilebilir, yoksa kendiliğinden bulunur):
  hedefler  bir klasördeki .md notları (ön yazı JSON ya da "anahtar: değer"; baslik/title, durum/status, son_tarih/due, oncelik, olcut); varsayılan notes/hedefler,
            yoksa notes/ altında (en çok 3 düzey) "hedefler" adlı ilk klasör
  fikirler  "## " başlıklı fikir listesi; varsayılan notes/fikirler.md
  posta     günlük posta/takvim özeti notu ("## " bölümleri, "- " maddeleri); varsayılan notes/posta/ozet.md (bir zamanlanmış görev yazar; ofis Gmail'e bağlanmaz)
  isler     tasks/*.md (JSON ön yazı); açıklar ve son bitenler
  yapilanlar companion klasöründeki Last-Session.md oturum kartları
  projeler  projeler/*/README.md (ilk başlık ve ilk paragraf)
Doğrudan yazma ayarı (VERI/os-ayar.json {"dogrudan": true}; VARSAYILAN KAPALI): açıkken bilgisayardaki Mesajlar uygulamasından gelen sohbetlerde ajanın kayıt önerisi
onay kartı beklemeden kaydedilir (ofis.pyw > sor; yalnız not/görev/nota ekleme, yalnız notes/ ve tasks/ altına; tablet kapısında hiçbir zaman).
Gizlilik: yalnız 127.0.0.1 anahtarlı API (tablet izin listesinde yok); ziyaret dinleyicisine hiçbir şey gitmez.
"""
import json
import os
import re
import threading
import time
from datetime import date, datetime, timedelta
from pathlib import Path

ONBELLEK_SN = 45
DOSYA_SINIR = 96 * 1024
BUYUK_SINIR = 512 * 1024
KAPALI = {"done", "cancelled", "canceled", "archived", "iptal", "bitti"}
HEDEF_BITTI = {"bitti", "tamam", "tamamlandi", "tamamlandı", "done", "arsiv", "arşiv", "iptal", "cancelled"}
SON_ALANLARI = ("son_tarih", "due", "due_date", "son", "deadline", "bitis")
TARIH_RE = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
ONYAZI_RE = re.compile(r"\A﻿?---\r?\n(.*?)\r?\n---\r?\n?", re.S)
KONTROL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
AYLAR = {"oca": 1, "şub": 2, "sub": 2, "mar": 3, "nis": 4, "may": 5, "haz": 6, "tem": 7, "ağu": 8, "agu": 8, "eyl": 9, "eki": 10, "kas": 11, "ara": 12}   # ay adının ilk üç harfi


def _temiz(s, n):
    s = KONTROL_RE.sub(" ", str(s if s is not None else "")).strip()
    s = re.sub(r"[ \t]+", " ", s)
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def _sade(s):
    s = re.sub(r"\*\*|__|`", "", str(s))
    s = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", s)
    return re.sub(r"\[\[([^\]|]*)(\|[^\]]*)?\]\]", r"\1", s)


def _tek(s, n):
    return _temiz(re.sub(r"\s+", " ", _sade(s)), n)


def _oku(yol, sinir=DOSYA_SINIR):
    with open(yol, "rb") as f:
        return f.read(sinir).decode("utf-8", errors="replace")


def _tarih(v):
    m = TARIH_RE.search(v) if isinstance(v, str) else None
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
    except ValueError:
        return None


def _metin_tarih(s):
    """'25 Ekim 2026' ya da 2026-10-25 biçimindeki ilk tarih (fikir başlıkları için; ay adının ilk üç harfine bakılır)."""
    t = _tarih(s)
    if t:
        return t
    m = re.search(r"(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)\s+(\d{4})", s or "")
    ay = AYLAR.get(m.group(2).lower()[:3]) if m else None
    if ay:
        try:
            return date(int(m.group(3)), ay, int(m.group(1))).isoformat()
        except ValueError:
            return None
    return None


def _onyazi(metin):
    """(sözlük, gövde): JSON ön yazı ya da basit 'anahtar: değer' satırları."""
    m = ONYAZI_RE.match(metin)
    if not m:
        return {}, metin
    ham, govde = m.group(1), metin[m.end():]
    try:
        d = json.loads(ham)
        return (d if isinstance(d, dict) else {}), govde
    except ValueError:
        pass
    d = {}
    for s in ham.splitlines():
        k, sep, v = s.partition(":")
        if sep and re.fullmatch(r"[\w-]+", k.strip()):
            d[k.strip()] = v.strip().strip('"').strip("'")
    return d, govde


def _bolumler(govde):
    """'## ' başlıklarına göre [(başlık, gövde)]."""
    sonuc, bas, satirlar = [], None, []
    for s in govde.splitlines():
        if s.startswith("## "):
            if bas is not None:
                sonuc.append((bas, "\n".join(satirlar)))
            bas, satirlar = s[3:].strip(), []
        elif bas is not None:
            satirlar.append(s)
    if bas is not None:
        sonuc.append((bas, "\n".join(satirlar)))
    return sonuc


def _paragraf(govde, n):
    parca = []
    for s in govde.splitlines():
        t = s.strip()
        if not t:
            if parca:
                break
            continue
        if t.startswith(("#", "---", "|", "```", "<")):
            if parca:
                break
            continue
        parca.append(t.lstrip("-*• ").strip())
    return _tek(" ".join(parca), n)


class OsVeri:
    def __init__(self, veri, vault, gunluk):
        self.veri = Path(veri)
        self.vault = Path(vault) if vault else None
        self.gunluk = gunluk
        self._kilit = threading.Lock()
        self._onbellek, self._zaman = None, 0.0

    # ---- ayar ----
    def _json(self, ad):
        try:
            d = json.loads((self.veri / ad).read_text(encoding="utf-8-sig"))
            return d if isinstance(d, dict) else {}
        except (OSError, ValueError):
            return {}

    def dogrudan(self):
        return self._json("os-ayar.json").get("dogrudan") is True

    def dogrudan_ayarla(self, acik):
        d = self._json("os-ayar.json")
        d["dogrudan"] = bool(acik)
        self.veri.mkdir(parents=True, exist_ok=True)
        gec = self.veri / "os-ayar.json.tmp"
        gec.write_text(json.dumps(d), encoding="utf-8")
        os.replace(gec, self.veri / "os-ayar.json")
        self.gunluk("bilgisayar: doğrudan yazma " + ("açıldı" if acik else "kapatıldı"))

    def _vault_yolu(self, g):
        """VERI/os.json'daki göreli yol: vault içinde kalmalı."""
        if not isinstance(g, str) or not g.strip() or ".." in g:
            return None
        p = (self.vault / g.strip().replace("\\", "/")).resolve()
        return p if p == self.vault.resolve() or self.vault.resolve() in p.parents else None

    def kaynaklar(self):
        """{hedefler, fikirler, posta}: (mutlak yol ya da None, vault'a göreli yazılış)."""
        ayar, sonuc = self._json("os.json"), {}
        for ad, varsayilan in (("hedefler", "notes/hedefler"), ("fikirler", "notes/fikirler.md"), ("posta", "notes/posta/ozet.md")):
            p = self._vault_yolu(ayar.get(ad)) or self._vault_yolu(varsayilan)
            if ad == "hedefler" and not (p and p.is_dir()):
                p = self._hedef_ara() or p
            sonuc[ad] = p
        return sonuc

    def _hedef_ara(self):
        kok = self.vault / "notes"
        try:
            for derinlik in ("*/hedefler", "*/*/hedefler"):
                for p in sorted(kok.glob(derinlik)):
                    if p.is_dir() and "arsiv" not in p.as_posix().lower():
                        return p
        except OSError:
            pass
        return None

    def goreli(self, p):
        try:
            return p.resolve().relative_to(self.vault.resolve()).as_posix() if p else None
        except ValueError:
            return None

    def baglam(self):
        """Mesajlar uygulamasından gelen sohbet için sistem istemine eklenen kısa kayıt rehberi."""
        k = self.kaynaklar()
        hedef = self.goreli(k["hedefler"]) or "notes/hedefler"
        fikir = self.goreli(k["fikirler"]) or "notes/fikirler.md"
        fikir_var = bool(k["fikirler"] and k["fikirler"].is_file())
        return (f"Bu mesaj ofisteki bilgisayarın Mesajlar uygulamasından geliyor: kısa ve iş odaklı cevap ver (1-4 cümle). Kayıt yerleri:\n"
                f"- Fikir: " + (f"`{fikir}` sonuna ekle (tur ekle; metin \"## <Kısa başlık> (<gün ay yıl>)\" satırıyla başlasın, altında 2-4 cümle).\n" if fikir_var
                                else f"`{fikir}` yok: fikri notes/ altında yeni bir not olarak kaydet.\n")
                + f"- Hedef: `{hedef}/<kisa-tireli-ad>.md` yeni not (tur not; metnin başında Durum, Son tarih, Ölçüt satırları, sonra \"## İlerleme\").\n"
                "- Görev / yapılacak iş: tasks/ altında yeni görev (tur gorev).\n"
                "Tür belirtilmemişse en uygun olanı seç ve hangisini seçtiğini söyle. Kayıt istenmiyorsa öneri bloğu koyma.\n")

    # ---- kaynak okuyucular ----
    def _hedefler(self, klasor, bugun):
        if not (klasor and klasor.is_dir()):
            return []
        liste = []
        for p in sorted(klasor.glob("*.md"))[:80]:
            try:
                d, govde = _onyazi(_oku(p))
            except OSError:
                continue
            baslik = d.get("baslik") or d.get("title") or next((s[2:] for s in govde.splitlines() if s.startswith("# ")), "") or p.stem.replace("-", " ")
            durum = _tek(d.get("durum") or d.get("status") or "", 20).lower()
            son = next((t for t in (_tarih(d.get(k)) for k in SON_ALANLARI) if t), None)
            ilerleme = []
            for bas, ic in _bolumler(govde):
                if bas.lower().startswith(("ilerleme", "progress")):
                    ilerleme = [_tek(s.lstrip("-*• "), 160) for s in ic.splitlines() if s.strip() and not s.strip().startswith("#")][-3:]
            try:
                oncelik = int(str(d.get("oncelik") or d.get("priority") or "9").strip() or 9)
            except ValueError:
                oncelik = 9
            kalan = (date.fromisoformat(son) - date.fromisoformat(bugun)).days if son else None
            liste.append({"baslik": _tek(baslik, 110), "durum": durum or "aktif", "tur": _tek(d.get("tur") or "", 20), "son": son, "kalan": kalan,
                          "oncelik": oncelik, "olcut": _tek(d.get("olcut") or "", 200), "neden": _tek(d.get("neden") or "", 200),
                          "ilerleme": ilerleme, "bitti": durum in HEDEF_BITTI, "yol": self.goreli(p)})
        sira = {"aktif": 0, "active": 0, "taslak": 1, "draft": 1}
        liste.sort(key=lambda h: (h["bitti"], sira.get(h["durum"], 2), h["kalan"] if h["kalan"] is not None and h["kalan"] >= 0 else 9999, h["oncelik"], h["baslik"]))
        return liste

    def _fikirler(self, dosya):
        if not (dosya and dosya.is_file()):
            return []
        try:
            _, govde = _onyazi(_oku(dosya, BUYUK_SINIR))
        except OSError:
            return []
        liste = []
        for bas, ic in _bolumler(govde):
            if not bas:
                continue
            baslik = re.sub(r"\s*\((\d{1,2}\s+\S+\s+\d{4}|\d{4}-\d{2}-\d{2})\)\s*$", "", bas)
            liste.append({"baslik": _tek(baslik, 100), "tarih": _metin_tarih(bas), "ozet": _paragraf(ic, 260),
                          "uygulandi": bool(re.search(r"uygulamaya geçti|uygulandı|hayata geçti", ic, re.I))})
        liste.reverse()   # dosyada eskiden yeniye yazılır; en yeni üstte
        return liste[:60]

    def _isler(self, bugun):
        klasor, acik, biten = self.vault / "tasks", [], []
        try:
            dosyalar = sorted(p for p in klasor.glob("*.md") if p.is_file())[:800]
        except OSError:
            return [], []
        for p in dosyalar:
            try:
                d, govde = _onyazi(_oku(p, 32 * 1024))
            except OSError:
                continue
            baslik = _tek(d.get("title") or "", 120)
            if not baslik:
                continue
            durum = _tek(d.get("status"), 20).lower() or "inbox"
            son = next((t for t in (_tarih(d.get(k)) for k in SON_ALANLARI) if t), None)
            try:
                degisti = p.stat().st_mtime
            except OSError:
                degisti = 0
            is_ = {"id": _tek(d.get("id") or p.stem, 80), "baslik": baslik, "durum": durum, "proje": _tek(d.get("project"), 40) or None,
                   "son": son, "gecikti": bool(son and son < bugun), "yol": f"tasks/{p.name}", "zaman": datetime.fromtimestamp(degisti).isoformat(timespec="minutes") if degisti else None}
            if durum in KAPALI:
                if durum in ("done", "bitti"):
                    biten.append((degisti, is_))
            else:
                is_["ozet"] = _paragraf(govde, 180)
                acik.append(is_)
        sira = {"active": 0, "doing": 0, "inbox": 1, "todo": 1, "waiting": 2, "blocked": 2}
        acik.sort(key=lambda g: (0 if g["gecikti"] else 1, sira.get(g["durum"], 1), g["son"] or "9999", g["baslik"]))
        biten.sort(key=lambda x: -x[0])
        return acik[:80], [b for _, b in biten[:40]]

    def _companion(self):
        try:
            return next((p for p in self.vault.iterdir() if p.is_dir() and p.name.endswith("Companion")), None)
        except OSError:
            return None

    def _yapilanlar(self):
        comp = self._companion()
        if not comp:
            return []
        try:
            metin = _oku(comp / "Last-Session.md", BUYUK_SINIR)
        except OSError:
            return []
        liste = []
        for bas, ic in _bolumler(metin):
            parca = [x.strip() for x in bas.split("·")]
            tarih = _tarih(parca[0])
            if not tarih:
                continue
            saat = re.search(r"\b(\d{1,2}:\d{2})\b", parca[0])
            m = re.search(r"\*\*Yapılan:\*\*\s*(.+?)(?=\n\s*\*\*|\Z)", ic, re.S)
            ozet = m.group(1) if m else next((s for s in ic.splitlines() if s.strip()), "")
            devam = len(re.findall(r"\*\*Devam", ic))
            liste.append({"tarih": tarih, "saat": saat.group(1) if saat else None, "etiket": _tek(parca[1] if len(parca) > 2 else (parca[1] if len(parca) > 1 else ""), 60),
                          "ozet": _tek(ozet, 320), "devam": devam})
            if len(liste) >= 30:
                break
        return liste

    def _posta(self, dosya):
        if not (dosya and dosya.is_file()):
            return {"var": False, "yol": self.goreli(dosya)}
        try:
            d, govde = _onyazi(_oku(dosya))
            degisti = datetime.fromtimestamp(dosya.stat().st_mtime)
        except OSError:
            return {"var": False, "yol": self.goreli(dosya)}
        bolumler = []
        for bas, ic in _bolumler(govde)[:8]:
            maddeler = [_tek(s.strip()[2:], 280) for s in ic.splitlines() if s.strip().startswith(("- ", "* "))][:25]
            bolumler.append({"baslik": _tek(_sade(bas), 60), "maddeler": maddeler, "metin": "" if maddeler else _paragraf(ic, 300)})
        return {"var": True, "yol": self.goreli(dosya), "guncel": degisti.isoformat(timespec="minutes"),
                "bayat": (datetime.now() - degisti) > timedelta(hours=30), "bolumler": bolumler}

    def _projeler(self):
        kok, liste = self.vault / "projeler", []
        try:
            klasorler = [p for p in kok.iterdir() if p.is_dir() and not p.name.startswith((".", "_")) and not p.name.endswith("-yedek")]
        except OSError:
            return []
        for p in klasorler:
            r = p / "README.md"
            if not r.is_file():
                continue
            try:
                metin, degisti = _oku(r, 24 * 1024), r.stat().st_mtime
                for alt in (p / "DEVAM.md",):
                    if alt.is_file():
                        degisti = max(degisti, alt.stat().st_mtime)
            except OSError:
                continue
            _, govde = _onyazi(metin)
            baslik = next((s[2:].strip() for s in govde.splitlines() if s.startswith("# ")), p.name)
            liste.append({"ad": _tek(baslik, 70), "klasor": p.name, "ozet": _paragraf(govde.split("\n", 1)[1] if "\n" in govde else govde, 200),
                          "zaman": datetime.fromtimestamp(degisti).date().isoformat()})
        liste.sort(key=lambda x: x["zaman"], reverse=True)
        return liste[:24]

    # ---- özet ----
    def _hesapla(self):
        bugun = date.today().isoformat()
        cevap = {"guncel": datetime.now().isoformat(timespec="seconds"), "hedefler": [], "fikirler": [], "isler": [], "bitenler": [], "yapilanlar": [],
                 "posta": {"var": False}, "projeler": [], "sayilar": {}, "kaynaklar": {}}
        if not self.vault or not self.vault.is_dir():
            cevap["uyari"] = "vault bulunamadı"
            return cevap
        k = self.kaynaklar()
        cevap["kaynaklar"] = {ad: self.goreli(p) for ad, p in k.items()}
        for ad, fn in (("hedefler", lambda: self._hedefler(k["hedefler"], bugun)), ("fikirler", lambda: self._fikirler(k["fikirler"])),
                       ("yapilanlar", self._yapilanlar), ("posta", lambda: self._posta(k["posta"])), ("projeler", self._projeler)):
            try:
                cevap[ad] = fn()
            except Exception as e:   # bir kaynağın bozukluğu bilgisayarın tamamını düşürmesin
                self.gunluk(f"os_veri {ad}: {type(e).__name__}: {e}")
        try:
            cevap["isler"], cevap["bitenler"] = self._isler(bugun)
        except Exception as e:
            self.gunluk(f"os_veri isler: {type(e).__name__}: {e}")
        gunler = sorted({y["tarih"] for y in cevap["yapilanlar"]}, reverse=True)
        seri, gun = 0, date.today()
        if gunler and gunler[0] < gun.isoformat():
            gun -= timedelta(days=1)   # bugün henüz oturum yoksa seri dünden sayılır
        while gun.isoformat() in gunler:
            seri, gun = seri + 1, gun - timedelta(days=1)
        posta_madde = sum(len(b["maddeler"]) for b in cevap["posta"].get("bolumler", []))
        cevap["sayilar"] = {"hedef": sum(not h["bitti"] for h in cevap["hedefler"]), "fikir": len(cevap["fikirler"]), "acik": len(cevap["isler"]),
                            "biten": len(cevap["bitenler"]), "oturum": len(cevap["yapilanlar"]), "seri": seri, "posta": posta_madde,
                            "gecikti": sum(i["gecikti"] for i in cevap["isler"])}
        return cevap

    def ozet(self, zorla=False):
        with self._kilit:
            if zorla or self._onbellek is None or time.time() - self._zaman > ONBELLEK_SN:
                self._onbellek, self._zaman = self._hesapla(), time.time()
            return self._onbellek

    def api(self, alt_yol, govde, yontem):
        alt = alt_yol.strip("/")
        try:
            if alt == "ozet" and yontem == "GET":
                return 200, self.ozet()
            if alt == "yenile" and yontem == "POST":
                return 200, self.ozet(zorla=True)
            if alt == "ayar" and yontem == "GET":
                return 200, {"dogrudan": self.dogrudan()}
            if alt == "ayar" and yontem == "POST":
                if isinstance((govde or {}).get("dogrudan"), bool):
                    self.dogrudan_ayarla(govde["dogrudan"])
                return 200, {"dogrudan": self.dogrudan()}
        except Exception as e:
            self.gunluk(f"os_veri: {type(e).__name__}: {e}")
            return 500, {"hata": "Bilgisayar verisi okunamadı."}
        return 404, {"hata": "yok"}


def kur(VERI, KOK, VAULT, KISI, gunluk):
    return OsVeri(VERI, VAULT, gunluk)
