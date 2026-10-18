# Ofis: ortak geliştirme kuralları (insanlar ve yapay zekâ ajanları için)

Bu depoda birden çok kişi ve onların ajanları çalışır. Önce `MIMARI.md`'yi oku; dosya düzeni, kancalar ve test yolları orada.

## Akış
- `main` korumalıdır: doğrudan push yok. Her iş kendi dalında (`ad/kisa-konu`, ör. `deniz/tablet-duzeltme`) yapılır ve Pull Request ile gelir.
- PR açıklamasında: ne değişti, neden, nasıl denendi, denenmeyenler. Bir PR tek konu.
- Birleştirmeden önce `main`'i dalına al (`git pull --rebase origin main` ya da merge) ve çakışmaları kendin çöz.
- Depo sahibi PR'ı gözden geçirip birleştirir. Sürüm yayını (etiket + Release) yalnız depo sahibinin işidir.

## Her PR'dan önce
- Her değişen `.js` için `node --check`, her `.py`/`.pyw` için `py -3 -m py_compile`.
- `py -3 araclar/paketle.py --tara`: gerçek kişi adı taraması temiz olmalı.
- Davranış değiştiyse oyunu aç ve dene (`py -3 ofis.pyw --tarayicisiz --port <boş port> --veri %TEMP%\ofis-test`); kendi `%LOCALAPPDATA%\OfisDemo` verine test yazma.
- Yeni özellik `moduller/` altında modül olarak eklenir; çekirdeğe (`ofis.js`) yalnız gerekli küçük kanca. `MIMARI.md`'ye kısa bölüm ekle.

## Asla depoya girmez
- LimeZu görselleri ve üretilmiş görseller (`varliklar/` içi; lisans yeniden dağıtımı yasaklar).
- Kişisel veri: `kisi.json`, düzen/görünüm/eşleşme/tablet/panel dosyaları, gerçek kişi adları, ders/sınav bilgisi, not içerikleri, vault yolları. Kişiye özel her şey `kisi.json` (`%LOCALAPPDATA%\OfisDemo`) üzerinden gelir; kodda yalnız genel varsayılanlar ve kurgusal örnek adlar (Deniz Demo, Selin Hoca, Baran Sanalıoğlu, Mert Kurgusal, Ayla Kurgu).
- Gizli değerler (PIN, anahtar, token).

## Uyumluluk
- Wi-Fi ziyareti iki tarafın aynı sürümde olmasını ister (`ziyaret.PROTOKOL`, harita/atlas/katalog özeti). Protokolü ya da haritayı değiştiren PR bunu açıklamasında belirtir.
- Güncelleyici yalnız izin listesindeki kod dosyalarını değiştirir (`araclar/guncelle.py > yol_incele`); yeni dosya türü ya da klasör eklersen listeyi ve `paketle.py`'yi güncelle.
