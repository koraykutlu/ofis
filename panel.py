"""Canlı panel (isteğe bağlı Haiku katmanı): sabah brifingi, TV manşeti ve çalışan konuşmaları ikinci beynin son durumuna göre kendiliğinden güncellenir.
"Bugün" kartındaki iş LİSTESİ her zaman dosyadan gelir (gercek_veri.py, ücretsiz); bu modül yalnız Ayarlar'dan açıksa (varsayılan KAPALI) brifing, manşet ve konuşmaları ekler
ve kullanıcının tiklerini saklar. Kullanıcı tiki hem Haiku'nun hem dosyadaki işler için VERI/panel-isaret.json'dadır.

- Haiku (claude -p, salt-okur: Read/Grep/Glob, vault --add-dir) vault'taki companion notlarını (Last-Session, Threads, Journal), haftalık planı ve
  alınan receipt'leri okuyup STRICT JSON üretir. Vault'a HİÇBİR ŞEY yazılmaz; sonuç yalnız VERI/panel.json'a gider.
- Ne zaman çalışır: son güncellemeden 4 saat geçince ya da kaynak notlar değişince (en sık 30 dakikada bir, 10 dk bekleyip birleştirir); yalnız Ofis açıkken.
- Tikler: Haiku "bitti" işaretini yalnız kaynakta açıkça yazıyorsa koyar ve nedenini söyler (🤖 otomatik, tahmini); kullanıcının kendi tiki her zaman üstündür
  ve VERI/panel-isaret.json'da durur (otomatik güncelleme onu ezmez).
- Maliyet: Claude aboneliğinden küçük bir Haiku çağrısı (günde en çok ~6-10). VARSAYILAN KAPALI; Ayarlar'dan ya da VERI/panel-ayar.json: {"acik": true} ile açılır.
- Ofis kapanınca (atexit / panel.kapat) süren Haiku süreci de sonlandırılır.
"""
import atexit
import json
import os
import re
import subprocess
import tempfile
import threading
import time
from datetime import datetime
from pathlib import Path

ARALIK = 4 * 3600          # en geç bu sürede bir güncelle
DEGISIM_BEKLE = 600        # kaynak değiştikten sonra bu kadar bekle (art arda değişiklikleri birleştirir)
EN_SIK = 1800              # iki çalışma arası en az
ZAMAN_ASIMI = 240
KAYNAKLAR = ("Last-Session.md", "Threads.md", "Journal.md", "Kurallar.md")   # companion klasöründeki izlenen dosyalar
PLAN_GLOB = "knowledge/plan/haftalik-plan-v*.md"
TEMIZ_RE = re.compile(r"[\x00-\x1f\x7f<>​-‏  ﻿]+")
ID_RE = re.compile(r"[a-z0-9-]{2,40}")


# Haiku'nun asla konuşma/brifing/liste metnine koymayacağı konular: genel varsayılan; kişiye özel liste kisi.json "panel_yasak_konular" ile gelir (Kurallar.md düzeltmelerinden)
YASAK_VARSAYILAN = """Yasak konular (hiçbir metinde geçmesin): sağlık, para ve maaş, ilişkiler, kişisel duygular, "durum kötü/uyarı sınırı" gibi yargılar,
bilgisayar/sistem bakımı (RAM, yeniden başlatma, sekme sayısı). Olumsuz yargı yok; yalnız somut iş, plan, tarih ve proje."""


def _metin(v, azami, varsayilan=""):
    if not isinstance(v, str):
        return varsayilan
    v = TEMIZ_RE.sub(" ", v.encode("utf-8", "ignore").decode("utf-8")).strip()
    return v[:azami] if v else varsayilan


class Panel:
    def __init__(self, veri, vault_fn, companion_fn, claude_fn, kisi_fn, gunluk, kilit=None, calisma=None, roller_fn=None, gercek_fn=None, yasak_fn=None):
        self.veri = Path(veri)
        self.gercek_fn = gercek_fn or (lambda: set())          # dosyadaki (gercek_veri) iş kimlikleri: kullanıcı tiki yalnız bunlara ve Haiku işlerine yazılır
        self.yasak_fn = yasak_fn or (lambda: "")
        self._surec = None                                     # süren claude süreci (kapat() sonlandırır)
        self._kapandi = False
        atexit.register(self.kapat)
        self.dosya, self.isaret_dosya, self.ayar_dosya = self.veri / "panel.json", self.veri / "panel-isaret.json", self.veri / "panel-ayar.json"
        self.konusma_dosya = self.veri / "konusma.json"
        self.roller_fn = roller_fn or (lambda: {})
        self.vault_fn, self.companion_fn, self.claude_fn, self.kisi_fn, self.gunluk = vault_fn, companion_fn, claude_fn, kisi_fn, gunluk
        self.kilit = threading.RLock()
        self.calisiyor = False
        self.son_deneme = 0.0
        self.son_hata = ""
        self.calisma = Path(calisma) if calisma else self.veri / "calisma"

    # ---------- dosyalar ----------
    def _oku(self, yol, varsayilan):
        try:
            return json.loads(Path(yol).read_text(encoding="utf-8-sig"))
        except (OSError, ValueError):
            return varsayilan

    def _yaz(self, yol, veri):
        yol = Path(yol)
        yol.parent.mkdir(parents=True, exist_ok=True)
        fd, gecici = tempfile.mkstemp(dir=str(yol.parent), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(veri, f, ensure_ascii=False, indent=1)
            os.replace(gecici, yol)
        except BaseException:
            try:
                os.unlink(gecici)
            except OSError:
                pass
            raise

    def acik_mi(self):
        return self._oku(self.ayar_dosya, {}).get("acik") is True      # varsayılan KAPALI (Haiku kotası harcar, vault'u okur)

    def ayarla(self, acik):
        with self.kilit:
            self._yaz(self.ayar_dosya, {"acik": bool(acik)})
        self.gunluk("panel (Haiku) " + ("açıldı" if acik else "kapatıldı"))

    def yasak(self):
        return self.yasak_fn() or YASAK_VARSAYILAN

    def kapat(self):
        """Ofis kapanırken: süren Haiku sürecini sonlandır, zamanlayıcı yeni iş başlatmasın."""
        self._kapandi = True
        s = self._surec
        if s is not None and s.poll() is None:
            try:
                s.kill()
            except OSError:
                pass

    def _calistir(self, arg, istem, cwd, ortam):
        """claude'u çalıştırır (kapat() öldürebilsin diye Popen); stdout baytlarını döndürür. Zaman aşımında TimeoutExpired."""
        if self._kapandi:
            raise RuntimeError("panel kapandı")
        p = subprocess.Popen(arg, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, env=ortam,
                             creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        self._surec = p
        try:
            cikti, _ = p.communicate(istem, timeout=ZAMAN_ASIMI)
        except subprocess.TimeoutExpired:
            p.kill()
            p.communicate()
            raise
        finally:
            self._surec = None
        return cikti

    def durum(self):
        """Sayfaya giden görünüm: panel + kullanıcı tikleri birleşik (görev başına bitti, kim işaretledi)."""
        with self.kilit:
            p = self._oku(self.dosya, None)
            isaret = self._oku(self.isaret_dosya, {})
        gorevler = []
        for g in (p or {}).get("gorevler", []):
            i = isaret.get(g["id"])
            bitti, kim = g.get("bitti", False), ("otomatik" if g.get("bitti") else "")
            if isinstance(i, dict) and i.get("tarih") == (p or {}).get("tarih"):   # kullanıcı tiki yalnız o günün listesi için geçerli
                bitti, kim = bool(i.get("bitti")), "sen"
            gorevler.append({**g, "bitti": bitti, "kim": kim})
        bugun = datetime.now().strftime("%Y-%m-%d")   # dosyadaki işlerin tikleri ("g:<id>"): yalnız bugün için geçerli
        gercek_isaret = {k[2:]: bool(v.get("bitti")) for k, v in isaret.items() if k.startswith("g:") and isinstance(v, dict) and v.get("tarih") == bugun}
        return {"var": bool(p), "acik": self.acik_mi(), "claude": bool(self.claude_fn()), "gercek_isaret": gercek_isaret,
                "calisiyor": self.calisiyor, "guncelleme": (p or {}).get("guncelleme", ""),
                "tarih": (p or {}).get("tarih", ""), "gorevler": gorevler, "brifing": (p or {}).get("brifing", []), "manset": (p or {}).get("manset", []),
                "konusma": self._oku(self.konusma_dosya, {}), "hata": self.son_hata}

    def isaretle(self, gid, bitti):
        """gid: Haiku işinin kimliği ya da "g:<id>" (dosyadaki iş, gercek_veri). Bilinmeyen kimlik reddedilir; eski günlerin tikleri temizlenir."""
        if not isinstance(gid, str) or len(gid) > 90:
            return False
        p = self._oku(self.dosya, None)
        bugun = datetime.now().strftime("%Y-%m-%d")
        if gid.startswith("g:"):
            if gid[2:] not in self.gercek_fn():
                return False
            tarih = bugun
        else:
            if not p or not any(g["id"] == gid for g in p.get("gorevler", [])):
                return False
            tarih = p.get("tarih")
        with self.kilit:
            isaret = self._oku(self.isaret_dosya, {})
            isaret = {k: v for k, v in isaret.items() if not (k.startswith("g:") and isinstance(v, dict) and v.get("tarih") != bugun)}
            isaret[gid] = {"bitti": bool(bitti), "tarih": tarih, "zaman": datetime.now().isoformat(timespec="seconds")}
            self._yaz(self.isaret_dosya, isaret)
        return True

    # ---------- üretim ----------
    def _istem(self, onceki):
        simdi = datetime.now()
        gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
        kisi = self.kisi_fn()
        eski = json.dumps([{"id": g["id"], "ad": g["ad"]} for g in (onceki or {}).get("gorevler", [])], ensure_ascii=False)
        comp = self.companion_fn()
        comp_ad = comp.name if comp else "companion klasörü"
        return f"""Sen {kisi['asistan_adi']}'nın arka plan yardımcısısın. Görevin: {kisi['kullanici_adi']} için BUGÜNÜN canlı panelini, vault'taki notlara bakarak üretmek.
Bugün: {simdi:%Y-%m-%d} {gunler[simdi.weekday()]}, saat {simdi:%H:%M}. Vault'a YAZMA; yalnız oku.

Şunları OKU (varsa): `{comp_ad}/Last-Session.md` (en üstteki kartlar en yeni), `{comp_ad}/Threads.md`, `{comp_ad}/Journal.md` (son girişler), `{comp_ad}/Kurallar.md` (kullanıcının düzeltmeleri),
en yeni `knowledge/plan/haftalik-plan-v*.md` (bugünün günü için slotlar) ve `receipts/` içindeki son birkaç receipt. Başka dosya okuma, uzun gezinme.

Çıktı: YALNIZCA şu JSON, başka hiçbir metin, kod bloğu yok:
{{"gorevler":[{{"id":"kisa-slug","ad":"...","ipucu":"...","bitti":false,"neden":"","kaynak":"dosya/yolu.md"}}],"brifing":["..."],"manset":["..."]}}

Takvim (gün adlarını YALNIZ buradan al, kendin hesaplama):
{self._takvim()}

Kurallar:
- gorevler: bugün için 4-7 somut iş (plan slotları, açık konular, bekleyen küçük adımlar). ad en çok 60 karakter. ipucu: tek, kısa, somut ilk adım (en çok 90 karakter, tek cümle).
- Önceki listedeki aynı işi AYNI id ile koru: {eski}
- bitti:true yalnızca kaynak notta bugün yapıldığı ya da bitirildiği AÇIKÇA yazıyorsa (ör. Last-Session'daki oturum kartı); neden alanına tek cümleyle ne okuduğunu yaz. Emin değilsen false. Çıkarım yapma, uydurma.
- brifing: 3-4 satır, doğrudan {kisi['kullanici_adi'].split()[0]}'e ("sen" diliyle), her biri en çok 180 karakter: "Öncelik: ...", "Takvim: ...", "Plan: ...", "Proje: ...". Yalnız iş, teslim/toplantı tarihi, plan ve projeler; tarih ve sayıları kaynaktan al.
- manset: ofisin TV bandı için 3-4 kısa başlık, her biri en çok 80 karakter, "ETİKET · cümle" biçiminde (ETİKET: PLAN, PROJE, TAKVİM, GÜNDEM). Olumlu ve nötr, üçüncü şahıstan değil; tahmin ya da yorum yok.
- Türkçe, sıcak ama net bir dil; suçlama yok.
- Kişisel/özel ayrıntıları listeye koyma; yalnız iş ve plan.
{self.yasak()}
Dosya tarihleri (çelişki olursa daha yeni tarihli dosya geçerli):
{self._dosya_tarihleri()}
"""

    @staticmethod
    def _takvim():
        """Önümüzdeki 10 günün tarih ve gün adı (modelin gün adı hesaplamasında hata yapmaması için)."""
        gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]
        t0 = datetime.now()
        return "\n".join(f"- {datetime.fromordinal(t0.toordinal() + i):%Y-%m-%d} {gunler[(t0.weekday() + i) % 7]}" for i in range(10))

    def _claude(self, istem):
        """Haiku'yu salt-okur çalıştırır, modelin metin cevabını döndürür (hata: istisna)."""
        exe, vault = self.claude_fn(), self.vault_fn()
        if not exe:
            raise RuntimeError("Claude Code bulunamadı.")
        arg = [exe, "-p", "--output-format", "json", "--model", "haiku", "--effort", "low", "--add-dir", str(vault),
               "--allowedTools", "Read", "Grep", "Glob",
               "--disallowedTools", "Bash", "Edit", "Write", "WebFetch", "WebSearch", "NotebookEdit", "Task"]
        self.calisma.mkdir(parents=True, exist_ok=True)
        ortam = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
        cikti = self._calistir(arg, istem.encode("utf-8"), str(self.calisma), ortam).decode("utf-8", "replace")
        try:
            sonuc = json.loads(cikti)
            return sonuc.get("result", "") if isinstance(sonuc, dict) else ""
        except ValueError:
            return cikti

    def _dosya_tarihleri(self):
        """Modelin eski/yeni ayrımı yapabilmesi için ana kaynakların son değişiklik tarihleri (en yeni plan dosyası işaretli)."""
        comp, vault = self.companion_fn(), Path(self.vault_fn())
        satir = []
        for a in ([comp / k for k in KAYNAKLAR] if comp else []):
            try:
                satir.append(f"- {a.parent.name}/{a.name}: {datetime.fromtimestamp(a.stat().st_mtime):%Y-%m-%d %H:%M}")
            except OSError:
                pass
        planlar = sorted(vault.glob(PLAN_GLOB), key=lambda p: p.stat().st_mtime if p.exists() else 0)
        for i, a in enumerate(planlar):
            try:
                satir.append(f"- knowledge/plan/{a.name}: {datetime.fromtimestamp(a.stat().st_mtime):%Y-%m-%d %H:%M}" + (" (EN YENİ PLAN: yalnız bu geçerli; eski planlardan söz etme)" if i == len(planlar) - 1 else " (eski)"))
            except OSError:
                pass
        return "\n".join(satir)

    def konusma_istemi(self):
        kisi, roller = self.kisi_fn(), self.roller_fn()
        comp = self.companion_fn(); comp_ad = comp.name if comp else "companion klasörü"
        satirlar = "\n".join(f"- {i}: {v[0]} ({v[1]}). {v[2]} Alanı: {v[3]}" for i, v in roller.items())
        kisa = kisi["kullanici_adi"].split()[0]
        return f"""Sen {kisi['asistan_adi']}'nın arka plan yardımcısısın. Görevin: {kisi['kullanici_adi']}'in piksel ofis oyunundaki çalışanlarının (aşağıdaki ajanlar) konuşma metinlerini, vault'taki GERÇEK notlara dayanarak yazmak.
Vault'a YAZMA; yalnız oku. Bugün: {datetime.now():%Y-%m-%d}, saat {datetime.now():%H:%M}.

Şunları OKU (varsa): `{comp_ad}/Last-Session.md` (en üstteki kartlar en yeni), `{comp_ad}/Threads.md`, `{comp_ad}/Journal.md`, `{comp_ad}/Kurallar.md`,
en yeni `knowledge/plan/haftalik-plan-v*.md` (varsa), `knowledge/` altındaki takvim/konu notları ve `receipts/` içindeki son birkaç receipt. Uzun gezinme.

Dosya tarihleri (çelişki olursa DAHA YENİ tarihli dosya geçerlidir; eski bir dosyadaki "onay bekliyor" gibi ifadeler bayat olabilir):
{self._dosya_tarihleri()}

Ajanlar (id: ad (rol)):
{satirlar}

{self.yasak()}

Çıktı: YALNIZCA şu JSON, başka metin yok, kod bloğu yok:
{{"ajanlar":{{"<id>":{{"selam":"...","secenekler":[{{"etiket":"...","cevap":"..."}}]}}}},"toplanti":{{"10:00":{{"<id>":"..."}},"15:00":{{"<id>":"..."}},"22:00":{{"<id>":"..."}}}}}}

Kurallar:
- Her ajan için: selam (en çok 130 karakter, tek cümle) ve 2 seçenek: etiket {kisa}'in o ajana sorabileceği kısa soru (en çok 40 karakter), cevap 1-2 cümle (en çok 200 karakter). Soru işaretiyle biten cümle kurma, "nasılsın" gibi dolgu yok.
- "Dün/bugün/geçen gün" gibi zaman ifadelerini yalnız dosyadaki tarihe göre kur; emin değilsen tarihi yaz ya da zaman belirtme.
- SADECE notlarda yazan şeyleri söyle. Sayı, tarih, ders adı, "bugün şunu yaptık" gibi her iddia bir dosyadan gelmeli. Notlarda yoksa o ajan kendi alanında genel ve dürüst konuşur
  ("Bununla ilgili notlarda henüz bir şey yok") ya da {kisa}'i "🧠 Gerçekten sor"a yönlendirir. ASLA uydurma; yapılmamış bir işi yapılmış gibi söyleme.
  ("Bugün diferansiyel çalıştık" gibi bir şeyi yalnız Last-Session'da bugün için açıkça yazıyorsa söyle.)
- Her ajan kendi alanından konuşur (yukarıdaki "Alanı"): ada son oturumlar ve açık konular, diğerleri rollerine uygun iş.
- toplanti: 10:00, 15:00 ve 22:00 toplantıları için her ajanın tek cümlelik raporu (en çok 150 karakter), yine yalnız notlardan.
- Türkçe, sıcak ama net; suçlama yok. Yalnız iş, plan, proje; hassas konulara girme.
"""

    def _konusma_ayikla(self, metin):
        i, j = metin.find("{"), metin.rfind("}")
        if i < 0 or j <= i:
            return None
        try:
            d = json.loads(metin[i:j + 1])
        except ValueError:
            return None
        roller = dict(self.roller_fn())
        ajanlar = {}
        for aid, a in (d.get("ajanlar") or {}).items() if isinstance(d.get("ajanlar"), dict) else []:
            if aid not in roller or not isinstance(a, dict):
                continue
            secenekler = []
            for o in (a.get("secenekler") if isinstance(a.get("secenekler"), list) else [])[:3]:
                if isinstance(o, dict) and _metin(o.get("etiket"), 48) and _metin(o.get("cevap"), 300):
                    secenekler.append({"etiket": _metin(o.get("etiket"), 48), "cevap": _metin(o.get("cevap"), 300)})
            if _metin(a.get("selam"), 160) or secenekler:
                ajanlar[aid] = {"selam": _metin(a.get("selam"), 160), "secenekler": secenekler}
        if not ajanlar:
            return None
        toplanti = {}
        for saat, rapor in (d.get("toplanti") or {}).items() if isinstance(d.get("toplanti"), dict) else []:
            if saat in ("10:00", "15:00", "22:00") and isinstance(rapor, dict):
                toplanti[saat] = {aid: _metin(t, 190) for aid, t in rapor.items() if aid in roller and _metin(t, 190)}
        return {"tarih": datetime.now().strftime("%Y-%m-%d"), "guncelleme": datetime.now().isoformat(timespec="seconds"), "model": "haiku",
                "ajanlar": ajanlar, "toplanti": toplanti}

    def konusma_guncelle(self):
        """Ofis çalışanlarının diyalogları (selam, soru-cevap, toplantı raporları) vault'a dayanarak yeniden yazılır; hata olursa eski kalır."""
        try:
            veri = self._konusma_ayikla(self._claude(self.konusma_istemi()))
            if not veri:
                self.gunluk("konuşma: geçersiz çıktı")
                return False
            self._yaz(self.konusma_dosya, veri)
            self.gunluk(f"konuşma metinleri güncellendi ({len(veri['ajanlar'])} ajan)")
            return True
        except subprocess.TimeoutExpired:
            self.gunluk("konuşma: zaman aşımı")
        except Exception as e:
            self.gunluk(f"konuşma: hata {e!r}"[:200])
        return False

    def guncelle(self, zorla=False):
        """Bir güncelleme turu. True: yazıldı. Çalışıyorsa ya da kapalıysa hiçbir şey yapmaz."""
        if not zorla and not self.acik_mi():
            return False
        with self.kilit:
            if self.calisiyor:
                return False
            self.calisiyor = True
        self.son_deneme = time.time()
        try:
            exe = self.claude_fn()
            vault = self.vault_fn()
            if not exe:
                self.son_hata = "Claude Code bulunamadı."
                return False
            onceki = self._oku(self.dosya, None)
            arg = [exe, "-p", "--output-format", "json", "--model", "haiku", "--effort", "low", "--add-dir", str(vault),
                   "--allowedTools", "Read", "Grep", "Glob",
                   "--disallowedTools", "Bash", "Edit", "Write", "WebFetch", "WebSearch", "NotebookEdit", "Task"]
            self.calisma.mkdir(parents=True, exist_ok=True)
            ortam = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
            cikti = self._calistir(arg, self._istem(onceki).encode("utf-8"), str(self.calisma), ortam).decode("utf-8", "replace")
            try:
                sonuc = json.loads(cikti)
                metin = sonuc.get("result", "") if isinstance(sonuc, dict) else ""
            except ValueError:
                metin = cikti
            veri = self._ayikla(metin, onceki)
            if not veri:
                self.son_hata = "Haiku geçerli bir liste üretmedi."
                self.gunluk("panel: geçersiz çıktı " + metin[:120].replace("\n", " "))
                return False
            self._yaz(self.dosya, veri)
            self.son_hata = ""
            self.gunluk(f"panel güncellendi ({len(veri['gorevler'])} iş)")
            self.konusma_guncelle()   # ikinci Haiku çağrısı: çalışanların konuşmaları da notlara göre taze olsun
            return True
        except subprocess.TimeoutExpired:
            self.son_hata = "Haiku zaman aşımına uğradı."
            self.gunluk("panel: zaman aşımı")
            return False
        except Exception as e:   # arka plan işi uygulamayı düşürmesin
            self.son_hata = f"Hata: {str(e)[:120]}"
            self.gunluk(f"panel: hata {e!r}"[:200])
            return False
        finally:
            self.calisiyor = False

    def _ayikla(self, metin, onceki):
        """Modelin metninden JSON'u çıkarır ve doğrular; geçersizse None."""
        i, j = metin.find("{"), metin.rfind("}")
        if i < 0 or j <= i:
            return None
        try:
            d = json.loads(metin[i:j + 1])
        except ValueError:
            return None
        if not isinstance(d, dict) or not isinstance(d.get("gorevler"), list):
            return None
        gorevler, gorulen = [], set()
        for g in d["gorevler"][:8]:
            if not isinstance(g, dict):
                continue
            ad = _metin(g.get("ad"), 80)
            gid = _metin(g.get("id"), 40).lower()
            gid = re.sub(r"[^a-z0-9-]+", "-", gid).strip("-")[:40]
            if not ad or not ID_RE.fullmatch(gid or "") or gid in gorulen:
                continue
            gorulen.add(gid)
            gorevler.append({"id": gid, "ad": ad, "ipucu": _metin(g.get("ipucu"), 140), "bitti": g.get("bitti") is True,
                             "neden": _metin(g.get("neden"), 160), "kaynak": _metin(g.get("kaynak"), 120)})
        if not gorevler:
            return None
        satirlar = lambda x, n, u: [_metin(s, u) for s in (x if isinstance(x, list) else [])[:n] if _metin(s, u)]
        return {"tarih": datetime.now().strftime("%Y-%m-%d"), "guncelleme": datetime.now().isoformat(timespec="seconds"), "model": "haiku",
                "gorevler": gorevler, "brifing": satirlar(d.get("brifing"), 5, 220), "manset": satirlar(d.get("manset"), 5, 100)}

    # ---------- zamanlayıcı ----------
    def _kaynak_zamani(self):
        en = 0.0
        comp, vault = self.companion_fn(), Path(self.vault_fn())
        adaylar = [comp / k for k in KAYNAKLAR] if comp else []
        adaylar += sorted(vault.glob(PLAN_GLOB))
        for a in adaylar:
            try:
                en = max(en, a.stat().st_mtime)
            except OSError:
                pass
        return en

    def zamanlayici(self):
        """Ofis açıkken 5 dakikada bir bakar: 4 saat geçtiyse ya da kaynaklar (10 dk önce) değiştiyse günceller."""
        time.sleep(20)
        while not self._kapandi:
            try:
                if self.acik_mi() and not self.calisiyor and time.time() - self.son_deneme > EN_SIK:
                    p = self._oku(self.dosya, None)
                    son = 0.0
                    if p and p.get("guncelleme"):
                        try:
                            son = datetime.fromisoformat(p["guncelleme"]).timestamp()
                        except ValueError:
                            pass
                    kaynak = self._kaynak_zamani()
                    gun_degisti = bool(p) and p.get("tarih") != datetime.now().strftime("%Y-%m-%d")
                    if not p or time.time() - son > ARALIK or gun_degisti or (kaynak > son and time.time() - kaynak > DEGISIM_BEKLE):
                        self.guncelle()
            except Exception as e:
                self.gunluk(f"panel zamanlayıcı: {e!r}"[:200])
            time.sleep(300)

    def baslat(self):
        threading.Thread(target=self.zamanlayici, daemon=True).start()
