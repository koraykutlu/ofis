# Ofis

İkinci beynin için pikselli bir yönetim ofisi: ajanlar masalarında çalışır, toplantıya girer, kahve molası verir; sen karakterinle ofiste gezer, ajanlarla konuşur ve
asistanla (varsayılan adı Ada) not klasörün hakkında **gerçekten** sohbet edersin. Tarayıcıda çalışır, yerel bir Python sunucusu kullanır, bilgisayarının dışına bir şey göndermez
(sohbet hariç: soruların kendi Claude Code aboneliğinle Claude'a gider).

<!-- Ekran görüntüsü yeri: docs/ekran-ofis.png ekleyip aşağıdaki satırı açın (oyundan alınmış görüntü; LimeZu zip'inin kendisi ya da ham sprite sayfası değil)
![Ofis](docs/ekran-ofis.png)
-->
*(Ekran görüntüsü yakında.)*

## Özellikler

- 9 odalı bir ofis (Gündem, yönetim, arşiv, radar, haber, mutfak, toplantı, stüdyo, yayın), 12 ajan, kedi Sütlaç; gün boyu süren bir iş akışı (sabah gelişi, toplantılar, yemek arası, günün karnesi).
- Oynanabilir karakter: yürü, ajanlarla konuş, nesnelerle etkileşime gir; **Düzenle** modu (eşya yerleştir) ve **Gardırop** (karakterini giydir).
- Gece mesaisi ve "Ofisi kapat / aç", boş odada sönen ışıklar; kişi kartı ve oda kartı (ne yapıyor, ihtiyaçları, oda günlüğü); ajanlar arası doğal sohbetler.
- İsteğe bağlı yerel ajan sesleri (kendi bilgisayarında çalışan konuşma motoru; kapalıyken hiçbir şey çalışmaz).
- **Gerçek beyin sohbeti:** asistan, not klasörünü salt-okunur tarar ve cevap verir; bir şey kaydetmek isterse yalnız senin onayınla yazar. Claude Code gerektirir (yoksa oyun yine çalışır).
- **Wi-Fi ziyareti:** aynı ağdaki iki Ofis, eşleşip birbirinin ofisini asansörle ziyaret edebilir (varsayılan kapalı, her ziyarette onay).
- Her şey kişiselleştirilebilir: adın, karakterin, ofisin ve asistanın adı, ikinci beyin klasörün (`kisi.json`). Kodda ya da pakette kişisel veri yoktur.
- Uygulama içinden güncelleme ve önceki sürüme dönme.
- **Bugün kartı:** vault görevlerin dosyadan listelenir (tik atılır); isteğe bağlı Haiku katmanı (Ayarlar, varsayılan kapalı) brifing, TV manşeti ve çalışan konuşmalarını notlarına göre tazeler.
- **Ofisi kapat:** önce Ada günü seninle kapatır (biten işler, yarının ilk adımı), sonra karne ve ekibin eve gidişi. Odak modu (25 dk), cozy mod, dokunmatik ve Apple Pencil desteği, yerel pano.
- **Tablet kapısı** (isteğe bağlı, varsayılan kapalı): aynı Wi-Fi'den PIN'le iPad/telefondan oyna. İkinci beyne konuşma kaydı da isteğe bağlıdır (varsayılan kapalı).
- Yazı tipi: Pixelify Sans (SIL OFL). Dosyayı [Google Fonts](https://fonts.google.com/specimen/Pixelify+Sans)'tan indirip `yazi/PixelifySans.ttf` olarak koy (lisans metni `yazi/OFL.txt`); yoksa oyun yedek yazı tipiyle açılır.

## Grafikler: LimeZu paketlerini kendin al

Ofis'in görselleri [LimeZu](https://limezu.itch.io/)'nun piksel sanat paketlerinden üretilir. Bu paketler ücretlidir ve lisansları yeniden dağıtımı yasaklar,
bu yüzden **bu depoda ve sürüm zip'lerinde hiçbir LimeZu görseli bulunmaz**. Her kullanıcı kendi paketlerini itch.io'dan alır; `Kur.bat` zip'leri bulup görselleri bilgisayarında üretir:

- [Modern Interiors](https://limezu.itch.io/moderninteriors) (ücretli)
- [Modern Office](https://limezu.itch.io/modernoffice) (ücretli)
- [Modern User Interface](https://limezu.itch.io/modernuserinterface) (ücretli)
- Modern Interiors Free: LimeZu'nun [itch.io sayfasında](https://limezu.itch.io/) "Modern Interiors - Free" adıyla (ücretsiz)

Zip'leri açma; olduğu gibi `Kur.bat`'ın klasörüne ya da İndirilenler'e koy (dosya adı önemli değil, içerikten tanınır). Üretilen görselleri (`varliklar/`) kimseyle paylaşma.

## Kurulum (3 adım, Windows)

1. Sürüm sayfasından (**Releases**) son `Ofis-<sürüm>.zip` dosyasını indirip bir klasöre aç (örneğin `C:\Ofis`); LimeZu zip'lerini de aynı klasöre ya da İndirilenler'e koy.
2. **`Kur.bat`**'a çift tıkla. Python yoksa kurulmasını önerir (winget), kalan her şeyi kendisi yapar: Pillow, zip'leri bulma, birkaç kişisel soru (boş Enter = varsayılan), görsel üretimi, kısayol.
3. Masaüstündeki **Ofis** kısayolundan aç.

Ayrıntı ve sorun giderme: [KURULUM.md](KURULUM.md).

## Güncelleme

- **Uygulama içinden:** ⚙️ Ayarlar > Güncelleme > *Denetle* > *Güncelle*. İndirilen dosyanın sağlama toplamı (SHA-256) doğrulanır, yalnız kod dosyaları değişir, önceki sürüm `yedek/` klasörüne alınır, Ofis kendiliğinden yeniden açılır. *Önceki sürüme dön* ile geri alınır.
- **Zip ile:** yeni sürüm zip'ini eski kurulumun üstüne açıp `Kur.bat`'ı çalıştır (kişi ayarın, düzenin ve görsellerin korunur, soru sorulmaz) ya da `py -3 araclar\guncelle.py --zip Ofis-<sürüm>.zip`.
- Otomatik denetim isteğe bağlıdır ve varsayılan kapalıdır; açıksa günde en çok bir kez yalnız sürüm bilgisini sorar, hiçbir veri göndermez.

## Lisans

Kod [MIT](LICENSE) lisanslıdır. LimeZu grafikleri MIT kapsamında **değildir**; kendi lisanslarına tabidir (kullanım serbest, yeniden dağıtım yasak, kredi gerekli).

---

# Yönetim Ofisi · demo (geliştirici notları)

Kişisel bir yönetim ofisi fikrinin görsel demosu (16 Ekim 2026, ikinci sürüm). 9 oda (Gündem masası,
yönetim odası, Beyin arşivi, Radar odası, Haber merkezi, Mutfak, Toplantı, Stüdyo, Yayın odası),
12 ajan, A* ile yürüyüş, gün boyu senaryo (evrak taşıma, doğrulayıcı reddi, yazıcı, Ada brifingi, onay kartları),
kendiliğinden kahve molası ve telefon. **Bütün veri kurgusal** (`demo-veri.js`); hiçbir gerçek sisteme bağlı değil.

**Oyuncu karakteri oynanabilir:** ok tuşları/WASD ile yürür, haritaya tıklayınca oraya gider, bir ajana tıklayınca
yanına gidip konuşur; yakındaki ajanla `E`, seçenekler `1-9`, `Esc` kapatır, `Z` yakın kamera / tüm ofis.
Diyaloglar (`demo-veri.js > diyaloglar`) sistemlerimizi andırır ama kurgusaldır; bazı seçenekler ofiste olay başlatır
(Yakala evrakı Ada'ya götürür, radar taraması, bülten onayı, yazıcı, stüdyo kaydı, kanal yayını, kahve molası).
**Cila (17 Ekim):** Sütlaç (ofisin beyaz kısa tüylü kedisi; yürüme/oturma kodla çizildi, uzanma paketteki kedinin beyaza boyanmışı),
07:00→19:00 gün akışı (120 sn) ve akşam ışıkları, paketin hareketli nesneleri (haber TV'si, kontrol odası ekranları, kahve,
akvaryum, guguklu saat), nesne etkileşimleri (E), onay tepkileri, kalp/konfeti/buhar parçacıkları. Gizli sürprizler:
`SURPRIZLER.md` (spoiler).
**Bir günlük ofis (17 Ekim, 3. sürüm):** herkes sabah asansörden gelir, masasına oturur; 10:00 ve 15:00'te toplantı
(oyuncu toplantı koltuğuna oturursa ekip sırayla rapor verir), 12:00-13:00 öğle arası, akşam herkes asansörle çıkar (Ada en son).
Sağ panelde **Günün işleri** (her gün 6 görev: bülten onayı, Sütlaç'ın maması, brifing, toplantı, yazıcı, stüdyo kaydı…) ve
18:30'da **gün karnesi** (biten işler, ofis morali, Sütlaç memnuniyeti, toplantı katılımı). **Mini harita** (`M`; odaya tıklayınca
karakterin oraya yürür, yapılmamış işler ünlemle görünür) ve **⚙️ Ayarlar**: ses seviyeleri, yazı boyutu, yürüme hızı, yakın kamera,
gün süresi 2/4/6 dk (tarayıcıda saklanır). Sabah pencerelerden ışık hüzmesi, akşam lambalar; ses odaya göre değişir, sağ/sol konumludur.
Mobilyalar paketin gölgeli sürümünden, masadaki ajanlar oturur.
**Asistanla gerçek beyin sohbeti (17 Ekim):** masaüstündeki **Ofis** kısayolu (`ofis.pyw`) oyunu yerel bir sunucuyla
(127.0.0.1:8540) bir uygulama penceresinde açar. Ada'ya `E` → "Beyne sor (gerçek)" ya da üstteki 🧠 düğmesi: soru Claude Code
aboneliğiyle (`claude -p`, API anahtarı yok) cevaplanır, Ada vault'u salt-okur araçlarla (Read/Grep/Glob) tarar ve ararken ofiste
arşiv rafına yürür. Model (Haiku/Sonnet/Opus/Fable) ve efor (düşükten en yükseğe) sohbet kutusunun başlığından seçilir.
**Yazma yalnız onayla:** Ada bir not, görev ya da nota ekleme önerirse kart çıkar; "Onayla" deyince `beyin.py note-create/task-create`
(üzerine yazmaz) ya da ekleme yapılır. Arayüz çerçeveleri ve konuşan portreler **LimeZu Modern User Interface** paketinden
(`araclar/ui_yap.py` → `varliklar/ui/`, ikon `varliklar/ofis.ico`; lisans: kredi gerekli, yeniden dağıtılamaz). Kısayolu yeniden kurmak:
`powershell -ExecutionPolicy Bypass -File araclar\kisayol_kur.ps1`. Düz `http.server` ile açılırsa oyun çalışır, sohbet çalışmaz.
**17 Ekim akşamı:** artık **her ajan kendi rolüyle** gerçek cevap verir (`E` → "🧠 Gerçekten sor"; Tarayıcı radar projelerine, Sosyal x-içeriğe,
Analist bulgulara… bakar; eşleme `ofis.pyw > ROLLER`). Konuşurken ajan **yerinde durur**, ne aradığını başının üstünde "💭" balonuyla söyler.
Sağ panel ve düğmeler de Modern UI çerçevesinde, her ajanın konuşan portresi var. **Oynanış:** ajanların enerji ve sosyallik ihtiyacı
(yorulan kahveye, yalnız kalan arkadaşını sebile çağırır; arkadaş çiftlerinin şakaları; Sütlaç'ın favorileri; seçili ajan panelinde çubuklar),
toplantı sonunda ekip senden **karar** ister (dallı "en büyük risk ne?"), ajanlar sorulanı **hatırlar** ve ruh haline göre selamlar,
bazı seçenekler alt dallara açılır. **Harita Tiled'da:** `harita/ofis.tmj` (mapeditor.org ile aç, mobilyayı sürükle, kaydet) →
`py -3 araclar/harita_yap.py` → `harita.js`. Yeni sistemler `moduller/` altında (bkz. MIMARI).
**Not:** bu, "demo gerçek sistemlerden ayrı" kararının ilk esnemesidir; ofis artık gerçek notları okur, hiçbir yere yayınlanmaz.
**Karar (16 Ekim):** demo şimdilik gerçek sistemlerden (beyin, radar, Kut) tamamen ayrı kalır; bağlama en son yapılır.

Çalıştırma: `py -3 -m http.server 8539 --directory projeler/ofis-demo` → http://localhost:8539
(Claude oturumunda `.claude/launch.json` içindeki `ofis-demo`).

- `ofis.js` çekirdek: harita, yerleşim, yol bulma, senaryo, rutin, çizim · `moduller/` ihtiyaçlar, diyalog, ışık, mini harita,
  ayarlar, sürprizler, Sütlaç, Düzenle (🛠️ eşya yerleştirme; katalog `araclar/katalog_yap.py` → `katalog.js`) · `cizimler.js` pakette olmayan ofis eşyaları (bilgisayar,
  ofis koltuğu, yazıcı, sunucu, stüdyo, kapı…) kodla çizilmiş piksel sprite · `ses.js` Web Audio ile sentezlenen
  ofis sesleri (oda tonu, klavye, adım, konuşma, telefon, yazıcı, kahve, bildirim) · `demo-veri.js` ajanlar ve senaryo.
- Grafikler (17 Ekim'den beri): Kullanıcının satın aldığı **LimeZu Modern Interiors + Modern Office** (limezu.itch.io).
  Lisans ticari kullanıma izin veriyor ama varlıkların yeniden dağıtılmasını yasaklıyor: `varliklar/` hiçbir herkese açık
  depoya ya da siteye konmamalı. Kullanılan parçalar `araclar/atlas_yap.py` ile `varliklar/atlas.png` + `atlas.js`
  atlasına toplanır (adı → kutu). Oyuncu, karakter oluşturucu parçalarından birleştirilir (`varliklar/oyuncu.png`:
  Body_03 + Eyes_01 + Outfit_06_01 + Hairstyle_02_04); diğer ajanlar paketteki hazır karakterler (`demo-veri.js > karakter`).
  Karakter sayfası: satır 1 bekleme, 2 yürüme, 6 telefon. Zemin/duvar: ofis Room Builder (mutfak hâlâ ücretsiz set).
- `araclar/katalog.py` tekil sprite klasöründen numaralı katalog üretir (`araclar/katalog/`).
- `araclar/nesne_bul.py` sprite sayfasındaki nesneleri numaralar (`interiors_nesneler.json`); `secici2.html?u=<png>` ızgara.
- `varliklar/kenney_*` ilk denemeden kaldı, artık kullanılmıyor.

**Kişiselleştirme ve kurulum (17 Ekim, 3. aşama):** kişiye özel her şey (adın, oyundaki adın, ofis ve oda adı, asistanın adı, ikinci beyin klasörü,
ajan rolleri) `%LOCALAPPDATA%\OfisDemo\kisi.json` dosyasındadır (`kisi.js` + `ofis.pyw`; alanlar MIMARI'de); kodda kişi adı yoktur. Başkasının bilgisayarına
kurmak için `py -3 araclar/paketle.py` paketi (`dist/Ofis-<tarih>.zip`) üretir, karşı taraf `KURULUM.md`'yi izleyip `Kur.bat`'ı çalıştırır (`araclar/kur.py`:
kendi LimeZu zip'lerinden görselleri üretir, kişi sorularını sorar, kısayol kurar). `py -3 ofis.pyw --veri KLASOR` verinin başka bir klasörde tutulmasını sağlar.

**Asansörle Wi-Fi ziyareti (17 Ekim, 4. aşama):** aynı Wi-Fi'deki iki Ofis eşleşip birbirinin ofisine giriş asansöründen "ziyarete" gidebilir. Ayarlar > Ziyaret'ten
"Ofisimi ziyarete aç" (varsayılan kapalı), ev sahibi bir kod üretir, misafir kodla eşleşir; sonra asansörde `E` → "Kat seç". Ev sahibi **her ziyarette** Kabul/Reddet der; misafir ev sahibinin
ofisini (onun düzeni, onun görünümü, ajanlar, Sütlaç, saat) kendi karakteriyle gezer, ev sahibi de onu görür; 🧠, Düzenle, gardırop ve onay kartları misafirde kapalıdır. Dönmek için asansörde
`E` ("Kendi ofisime dön") ya da `Esc`; ev sahibi "Uğurla" diyebilir, bağlantı koparsa kendiliğinden kendi ofisine dönersin. Windows güvenlik duvarı ilk açılışta sorarsa **özel ağlar**a izin ver
(`KURULUM.md`). Ana sunucu (127.0.0.1) aynı kalır; ağa yalnız bu ayar açıkken ayrı bir ziyaret ucu (`ziyaret.py`, JSON, imzalı) açılır. Ayrıntı: `MIMARI.md` > Asansörle ziyaret.

En son adım (demo bitince): `demo-veri.js` yerine gerçek günlüklerden olay üreten okuyucu.
