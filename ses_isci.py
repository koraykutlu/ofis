"""Ofis ses işçisi (EMA Lightning): modeli bir kez yükler, stdin'den satır satır JSON iş alır, WAV dosyası yazar, stdout'a JSON satırı döner.

ses_motoru.py bunu EMA ortamının Python'uyla başlatır:  <ema ortamı>/python.exe -I ses_isci.py
  stdin  : {"metin": "...", "hiz": 1.0, "cikti": "C:/.../x.wav"}
  stdout : {"hazir": true}  (açılışta, ısınmadan sonra)  ->  {"ok": true, "sure": 3.4}  ya da  {"ok": false, "hata": "..."}
Her şey bu bilgisayarda çalışır; model yalnız yerel önbellekten okunur (HF_HUB_OFFLINE=1). Stdin kapanınca (ofis kapandı) işçi de kapanır.
"""
import json
import os
import sys
import wave

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")
CEVAP = sys.stdout
sys.stdout = sys.stderr  # kütüphanelerin print'leri protokolü bozmasın

HZ = 24000


def yaz(o):
    CEVAP.write(json.dumps(o, ensure_ascii=False) + "\n")
    CEVAP.flush()


def hazirla():
    from ema_lightning import EMA
    import numpy as np

    ema = EMA()

    def uret(g):
        metin = str(g.get("metin") or "").strip()
        if not metin:
            raise ValueError("metin boş")
        hiz = min(1.6, max(0.6, float(g.get("hiz") or 1.0)))
        ses = ema.say(metin, speed=hiz, sample_rate=HZ)
        pcm = (np.clip(ses.audio, -1, 1) * 32767).astype("<i2").tobytes()
        cikti = str(g["cikti"])
        gecici = cikti + ".tmp"
        with wave.open(gecici, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(HZ)
            w.writeframes(pcm)
        os.replace(gecici, cikti)   # yarım dosya hiç görünmez
        return {"ok": True, "sure": round(float(ses.duration), 2)}

    uret({"metin": "Hazır.", "cikti": os.path.join(os.environ.get("TEMP", "."), f"ofis-ses-isinma-{os.getpid()}.wav")})   # ısınma: ilk gerçek istek beklemesin
    try:
        os.remove(os.path.join(os.environ.get("TEMP", "."), f"ofis-ses-isinma-{os.getpid()}.wav"))
    except OSError:
        pass
    return uret


def main():
    try:
        uret = hazirla()
    except Exception as e:  # noqa: BLE001
        yaz({"hazir": False, "hata": f"{type(e).__name__}: {e}"[:300]})
        return 1
    yaz({"hazir": True})
    for satir in sys.stdin:   # stdin kapanınca döngü biter: sahibi süreç gitti
        satir = satir.strip()
        if not satir:
            continue
        try:
            yaz(uret(json.loads(satir)))
        except Exception as e:  # noqa: BLE001
            yaz({"ok": False, "hata": f"{type(e).__name__}: {e}"[:300]})
    return 0


if __name__ == "__main__":
    sys.exit(main())
