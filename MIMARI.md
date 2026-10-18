# Yönetim Ofisi: mimari rehberi (geliştiriciler ve ajanlar için)

Tarayıcıda çalışan, derleme adımı olmayan tek sayfa. Sunucu: `py -3 -m http.server 8539 --directory <ofis klasörü>` (ya da gerçek: `py -3 ofis.pyw`)
(önbelleği atlatmak için `?v=<sayı>` ekle).

## Dosyalar
- `index.html` arayüz, CSS, sağ panel (brifing, onaylar, seçili ajan, günlük), diyalog kutusu. Betik sırası:
  `demo-veri.js` → `atlas.js` → `katalog.js` → `harita.js` → `kisi.js` → `gardirop.js` (veri) → `cizimler.js` → `ses.js` → `ofis.js` → `sohbet.js` → `moduller/*.js`
  (ihtiyac, diyalog, isik, mini-harita, ayarlar, surprizler, sutlac, duzenle, gardirop, ziyaret, …, bilgisayar; `gardirop.js` veri dosyası harita.js'ten sonra; `surprizler` `sutlac`'tan önce: E noktalarının sırası; `ziyaret` `gardirop`'tan sonra: `OFIS_GARDIROP` ister).
- `ziyaret.py` asansörle ziyaretin sunucu tarafı (dinleyici, keşif, eşleşme, imza; `ofis.pyw` içe aktarır), `moduller/ziyaret.js` istemci (bkz. "Asansörle ziyaret").
- `guncelleme.py` güncelleme eklentisi (`EKLER["guncelleme"]`), `araclar/guncelle.py` bağımsız uygulayıcı, `moduller/guncelleme.js` Ayarlar bölümü, `surum.json` sürüm + yayın deposu (bkz. "Güncelleme"). `LICENSE` MIT, `.gitignore` yayın ağacı kuralları.
- `ofis.js` çekirdek (tek IIFE, ~1.330 satır): harita, yol bulma, ajanlar, senaryo, diyalog, rutin, görevler, çizim, etkileşim.
  Bölümler `// ---------- ad ----------` başlıklarıyla ayrılır. Zayıf bağlı sistemler `moduller/` altında (bkz. "Modüller ve harita").
- `kisi.js` `window.OFIS_KISI`: kişi ayarı (aşağıda "Kişi ayarı"); ofis.js'ten önce yüklenir, adları DEMO/HARITA'ya yerleştirir.
- `demo-veri.js` `window.DEMO`: ajanlar, senaryo olayları, diyaloglar, onaylar, brifing, manşetler. **Hepsi kurgusal.**
- `cizimler.js` `window.CIZIM`: pakette olmayan, kodla çizilmiş sprite'lar (ekran, kapı, bölme, saat, klima, tezgah, kupa…).
- `ses.js` `window.SES`: Web Audio ile sentezlenen sesler. `SES.cal(ad, ...arg)`; yeni ses = `calgilar` nesnesine fonksiyon.
- `atlas.js` + `varliklar/atlas.png`: `araclar/atlas_yap.py` üretir (`py -3 araclar/atlas_yap.py`, projeler/ofis-demo içinden).
  Yeni parça: `SEC` sözlüğüne `"ad": (KAYNAK, numara)` ekle, betiği çalıştır. Atlas adları `A["ad"] = [x, y, w, h]`.
- `araclar/katalog.py <klasör> <çıktı_önek> [ölçek]` tekil sprite klasöründen numaralı katalog PNG'si üretir (inceleme için).
- `araclar/katalog_yap.py` Düzenle modunun kataloğu: Modern Office tekilleri + Modern Interiors gölgeli tema tekilleri (25 kategori, ~5.600 parça)
  → `varliklar/katalog/<kategori>.png` + `katalog.js` (`window.KATALOG`, kutular). Eşya kimliği `kat:<kategori>/<dosya no>`; ~1 dk sürer.
- Varlıklar: `varliklar/limezu-tam/` (Modern Interiors tam), `varliklar/limezu-ofis/` (Modern Office), `varliklar/limezu-free/`.
  **Lisans: yeniden dağıtılamaz; hiçbir yere yayınlanmaz.**

## Koordinatlar ve çizim
- Karo `T = 16` px; harita `GEN 48 × YUK 32` karo = `W 768 × H 512` dünya pikseli.
- Ajan konumu karo cinsinden (kesirli olabilir). Karakter sprite'ı 16×32; çizim `px = x*T`, `py = y*T - T`; ayak `y*T + T`.
- Çizim zinciri: `statik` tuval (zemin, duvar, `zeminler` listesi) → `kare` tuvaline `canliCiz()` (kapılar, sunucu ışıkları,
  monitör yazıları, ekranlar) → `nesneler` + ajanlar + kedi `sira` (alt kenar y'si) ile sıralanıp çizilir → ana tuval `g`'ye
  kamera ölçeğiyle (`kam.o`, `kam.x/y`) basılır → `geceCiz` (isik.js kancası) → `ustKatman()` (yazılar, balonlar, ipuçları, HUD, mini harita kancası).
- Ana tuval ekran çözünürlüğündedir (`boyutla()`); ekran yazılarında boyutları `yo` (piksel yoğunluğu) ile çarp.
  Dünya → ekran: `ex(px)`, `ey(py)`. Ekran → dünya: `dunya(e)`.
- `ekle(k, x, y, ops)` nesne ekler (k: atlas/PK adı ya da tuval/Image). `ops`: `duvar`/`zemin` (statik katman), `engel:false`,
  `sira`, hareketli için `kutu, w, h, anim:{n, fps | kare(), hiz()}`. `koy(k, x, alt, ops)` alt kenara göre yerleştirir.
  `calismaMasasi(tx, ty, ops)` bölme + koltuk + parçalı masa + monitör + masa üstü eşyası kurar; koltuk karosu `koltuklar`'a girer.
- Gölge: paket parçaları atlasa gölgeli sürümleriyle girer (`atlas_yap.py` `GOLGELI`). Gölgeli eşi olmayanlara `ekle(..., { golge: true })`:
  `golgeEkle` siluetin alt kısmını sağ-alta 2 px kaydırıp statik katmana (halılardan sonra, duvar eşyalarından önce) çizer.
- `parcaBirlestir([...adlar])` atlas parçalarını yan yana tek tuvale birleştirir (masa: `masaSol/Orta/Sag`, `masaSari*`, `masaTuruncu*`).

## Dünya kuralları
- `ODALAR` (dikdörtgenler; ilk 2 satır duvar), `KAPILAR` ([x, sınır y]; 2 karo genişlik). `odaNo[y][x]` oda indeksi.
- `yurur[y][x]` yürünebilirlik; nesneler alt şeritleriyle engel olur. `gecebilir()` odalar arası geçişe yalnız kapıdan izin verir.
- `yolBul(bas, hedef)` A*; `gonder(a, hedef, sonraFn)` (oturuyorsa önce kalkar); `eveDon(a)`; `yanKaro(h)`; `enYakinYurur(x, y)`.

## Oyun durumu
- `zaman` (sn, döngü `DONGU` sn `GUN_DK` dakikayı kapsar; `dakika()` = `ACILIS` (08:00) + zaman×GUN_DK/DONGU, gece yarısından sonra 1440'ı geçer (01:00 = 1500); `gecelik()` 17:00 sonrası 0→1). `hiz` 1/2/4 (yalnız hızlı günde).
- **Gerçek saat (varsayılan, `GERCEK`):** `DONGU` 86400, `GUN_DK` 1440: ofis günü açılıştan (`ACILIS`, varsayılan 08:00) ertesi açılışa, `zaman` bilgisayarın saatini izler
  (`gercekZaman()`; açılış saatinden önceki saatler önceki güne aittir; hızlı gün `GUN_DK` 1080 = 08:00 → 02:00). Her karede `gercekAdim()`: saat 3 sn'den fazla ilerlemişse (sekme arkadaydı, uyku)
  `gercegeAtla(t)` aradakini oynatmadan atlar: geçmiş olaylar işaretlenir, yalnız masaya bırakılanlar (onay kartı, brifing) eklenir, `rutinSenkron` ajanları yerleştirir;
  açılış saatinde `bastan(false)` (yeni gün, ofis açık). `rs(hizli, gercek)` gerçek saatte uzayan süreler: toplantı 2 dk önce toplanır, oyuncuyu 10 dk bekler; öğle ve akşam yemeğinde oturanlar yemek bitimine dek,
  kahveciler 5-10 dk; mola 2,5-5 dk, telefon ×8, kahve denetimi ×4, dedikodu 4-10 dk, yazıcı ilk 09:30-11:00, sonra 1-2,5 saatte bir; Sütlaç klavyeye 20-50 dk,
  mama istemeye 10-20 dk'da bir. Giriş `rutin.gelis.gercek` (açılıştan 4 dk arayla, 08:00-08:44); `rutin.geceKalan` (Ada) eve gitmez, gün dönünce de yerinde kalır (her iki modda).
  Test: `__ofis.saat()`, `zamanAyarla(t)` ve `ilerle(sn, adim)` gerçek saatte `saatOfset` ile saati de kaydırır (`ilerle(3600, 0.1)` bir saati ~0,1 sn'de sınar).
- `ajanlar[]`: `{id, ad, rol, karakter, koltuk:[x,y], x, y, yol[], yon (0 sağ,1 yukarı,2 sol,3 aşağı), balon, balonSon, sonra,
  vurgu, yazSon, telefonSon, ozel, oyuncu, konusuyor, oturak, gecis, rezerve, perde, disarda, cikti, rut, hizK}`. Oyuncu: id `oyuncu`, bayrak `oyuncu: true`
  (çekirdekteki `oyuncu` değişkeni bu nesnedir). `bul(id)`.
  `yerinde(a)` masasında mı, `mesgul(a)`.
- Karakter sayfası satırları: 1 bekleme, 2 yürüme, 4 yandan oturma (0-5 sağ, 6-11 sol), 6 telefon. Her yön 6 kare.
- Senaryo: `V.olaylar` (`olay()`), `ortam()` (kahve, telefon, mola), sürprizler (`moduller/surprizler.js`), `bekleyen` + `sonra(sn, fn)`.
- Etkileşim: `yakinHedef()` en yakın ajan/kedi/oturak/nesne → `etkiles(h)`. `NESNELER` (E ile kullanılan noktalar; modüller `basla`'da ekler),
  `OTURAKLAR` + `oturt(a, o)` / `kalk(a)`, `EYLEMLER` (diyalog seçenekleri), `diyalogAc/secim/diyalogKapat`.
- `kedi` (Sütlaç) verisi çekirdekte (çizim sırası `kediSira`, kapılar, balonlar, etkileşim okur); davranışı `moduller/sutlac.js`
  (`kediGuncelle/kediCiz/kediSev` kancaları). Parçacıklar: `parcacik({...})`, `kalpler(h, n)`.
- Panel: `gunluk(metin, soluk)`, `brifingGoster()`, `onayEkle(k)`, `secAjan(a)`.
- `bastan(tam)` her döngüde (tam=false) ve "Baştan oynat"ta (tam=true) durumu sıfırlar; yeni durum ekleyen buraya da ekler.
  `zaman` her gün 0'a döner: `zaman + n` ile tutulan bitiş damgaları (`balonSon`, `telefonSon`, `kedi.takipSon`, `balikSon`…) da burada sıfırlanmalı,
  yoksa önceki günün değeri yeni günün büyük kısmında "süresi dolmamış" görünür (17 Ekim denetiminde balon ve karne böyle taşıyordu).
- Masaya oturma/kalkma `a.oturK` (0..1) ile yumuşar; çizimde iniş `5×oturK` px, bacak kırpması `8×oturK` px.
- Yön tuşu aynı karede basılıp bırakılsa da `tekAdim` bir adım attırır; Enter odaktaki düğmeye bırakılır.

## Gün planı (rutin) · `ofis.js` "gün planı" bölümü, veri `V.rutin`
- Gün açılıştan (08:00) kapanışa kadar: toplantılar 10:00, 15:00, 22:00; öğle 12:00-13:00; akşam yemeği 19:30-20:30 (`rut: "aksam"`, mutfak, öğle mantığı: `V.rutin.ogle`/`aksam`,
  `OGUNLER`, tetik anahtarı `yemek:<ad>` (surprizler `"aksam"` anahtarını kullanıyor); C tokluğu `rut === "ogle" || "aksam"` okur). Günde bir döngü: herkes dışarıda başlar (`bastan` → `a.disarda = true`). Giriş noktası `V.rutin.giris` (haber merkezinin sağ ucundaki
  asansör, `C.asansor()`; kanatlar `asansorCiz()` ile canlı). `a.disarda` (ofiste değil), `a.cikti` (bugün çıktı), `a.rut`
  (`gelis | toplanti | ogle | aksam | cikis`). `mesgul()` hepsini meşgul sayar; ofiste olmayan çizilmez, konuşmaz, diyalog açmaz, kapı açmaz.
- Sabah: `gelis.sira` sırasıyla (gerçek saatte 4 dk, hızlı günde 0.6 sn arayla) asansörden çıkıp masaya yürür (`gelisBasla`).
- **Ofisi kapat / aç** (`ofisKapat`, `ofisAc`, `ofisDurum`: `acik | kapaniyor | kapali`): header "🌙 Ofisi kapat" onay kutusu sorar (`#kapatOnay`) → `ofisKapat`: karne gösterilir (`karneGoster`, başlıkta
  kapanış saati), `cikis.sira` sırasıyla (gerçek saatte 4 sn sonra, 9 sn arayla; hızlı günde 1 sn sonra, 0.35 sn arayla) asansöre yürürler (`cikisT/cikisVar` kapanışta hesaplanır, `rutinPlanla` Infinity yapar);
  Ada (`geceKalan`) kalır. Herkes çıkınca `kapali`: `#kapaliKart` ("Ofis kapalı · 08:00'de açılır", **Ofisi şimdi aç**; oyuncu gezebilir, Ada ile konuşabilir), HUD "OFİS KAPALI", odalar boş olduğundan kararır.
  **Yedek otomatik kapanış** (`otoKapanisZamani`): gerçek saatte Ayarlar > Otomatik kapanış (kapalı/02:00-05:00, varsayılan 04:00; `OTO_KAPAT`), hızlı günde gün bitmeden `DONGU - max(15, DONGU×0.12)` sn'de.
  `ofisAc` ekibi sabahki gibi sırayla (10 sn arayla) getirir ve o gün otomatik kapanmayı kapatır (`otoErtele`). Açılış saati ayarı (07/08/09/10) `ofisAyari` ile `ACILIS`'ı değiştirir, gün baştan başlar.
  Kalıcılık: kapatma/elle açma `localStorage["ofis-demo-ofis-1"]` = `{gun: "YYYY-A-G" (günün başladığı tarih), z, acik}` (try/catch); `durumSenkron` (`rutinSenkron` içinde, açılış ve `gercegeAtla`) o günün kaydına ya da otomatik kapanış
  saatine bakıp durumu atlatır: kapatılmış gün yenilenince kapalı kalır, açılış saati geçmişse yeni gün açık başlar (`bastan(false)` kaydı siler). Uzak modda düğme/kart gizli.
- Toplantı (`toplantiKontrol`): 10:00, 15:00 ve 22:00 (gece vardiyası), `V.rutin.toplantilar`. Üyeler "toplantı koltuğu"na oturur; oyuncu da oturursa
  sırayla `raporlar[id]` söylenir (balon + günlük), perde ekranı konuyu gösterir; `t0 + 12` sn'ye kadar gelmezse dağılırlar.
- Öğle ve akşam yemeği (`ogleKontrol`, 12:00-13:00 ve 19:30-20:30): `otur` mutfak sandalyesine, `kahve` kahve makinesine gider, sonra masasına döner.
- `olay()` ofiste olmayan/rutindeki ajanı bekletir (`sonra(1.5, ...)`), gün için çıktıysa atlar. Rutine alma yalnız `rutinMusait`
  ajanı alır (olay/gorev/dedikodu sürerken beklenir). Eski zamanlayıcılar rutindekini masaya yollamasın diye `eveDon` `a.rut`'ta durur.
- `sonra()` artık zamanlayıcı içinden de çağrılabilir (`adimla` vadesi gelenleri ayırıp çalıştırır).

## Günün işleri ve gün karnesi · "günün işleri" bölümü, veri `V.gorevler`
- Her döngü 6 görev: `sabit` olanlar + havuzdan rastgele (`gorevleriYenile`). Sağ panelde "Günün işleri" kartı; `gorevBitir(id)` çağrılınca
  işaretlenir, ses ("gorev") ve kalp çıkar. Kancalar: `karar` (bulten/radar onayı), `yaziciKullan`, `mama` (Sütlaç yedi), `EYLEMLER.brifing/video/tarama`,
  `kahveAl`, `balikBesle`, oyuncu toplantı koltuğuna oturunca (`oturt`).
- Toplantı görevi: toplantı sürerken koltuğa oturmak; iki toplantı da kaçtıysa son toplantıdan sonra koltuğa oturmak da sayılır (`toplantiKoltugu`).
  Ada'nın senaryodaki otomatik brifingi de brifing görevini tamamlar.
- Mama kabı (`moduller/sutlac.js`): mutfakta `NESNELER` girişi (E), `mamaVer` → `kediMamayaGit` → `yemeBitti`; durum `mama` çekirdekte (gün sonu sıfırlar).
  Sütlaç sabahtan aç miyavlar (`kediKarar`).
- Kapanışta (`ofisKapat`) `karneGoster`: `#karne` kutusu (tuval üstü) + panelde "Gün karnesi" kartı. Ofis morali = 30 + 9×iş + 8×toplantı + sevgi (≤10);
  Sütlaç memnuniyeti = 25 + mama 40 + sevgi (≤35). `stat` sayaçları ve `gun` her döngüde sıfırlanır/artar (`bastan`).

## Mini harita, ayarlar, ışık ve ses (`moduller/mini-harita.js`, `ayarlar.js`, `isik.js`; ses.js)
- **Gün süresi** ayardan Gerçek (varsayılan; `gunSuresi(0)`) ya da hızlı gün 2/4/6 dk (`DONGU` 120/240/360). `dakika()` ve `dkT()` DONGU'ya göre; `V.olaylar[].t` 120 sn'lik senaryo saniyesidir,
  `adimla` içinde `olcek()` ile çarpılır (hızlı günde DONGU/120, gerçek saatte 360: açılıştan 6 dk × t). Rutin/görev saatleri dakika tabanlı olduğundan kendiliğinden uyar. Gerçek saniyede kalanlar:
  yürüme hızı, `ortam()` aralıkları, toplantı/öğle bekleme süreleri, giriş sırası (`gelis`), sürpriz zamanlayıcıları. Değişince çekirdeğin `gunSuresi(sn)`'i
  `rutinPlanla(); bastan(true)` yapar.
- **Ayarlar**: header'da ⚙️, `#ayarPanel`; `ayar` nesnesi `localStorage["ofis-demo-ayar-1"]` (try/catch). `yaziK` → `yo` çarpanı, `yurumeK` (oyuncu), `kameraK`
  (yakın kamera; üçü çekirdekte, modül `OFIS_IC` setter'larıyla yazar), ses seviyeleri `SES.seviye(genel|ambiyans|efekt, 0..1.5)`. Uygulayınca `ayarUygulandi(ayar)`
  yayınlar; başka modül `ayarKaydet(k, v)` ile yazar. Panel alanlarındayken oyun tuşları kapalıdır (`keydown` INPUT/SELECT'i geçer).
- **Mini harita** `miniCiz()` (ustKatman sonu, HUD'un üstü): odalar, oyuncu, ajanlar, Sütlaç, yapılmamış görevlerin yeri (`GOREV_YERI`, ünlem). Odaya tıklama
  `miniGit(i)` (odanın ortasına en yakın erişilebilir karo, A* + `gonder`); diyalog açıkken yok sayılır; M gizler/gösterir (`ayar.mini`).
- **Işık**: sabah `huzmeleriCiz()` (pencere eşyalarından, 07:00-16:00 söner, `f` tuvalinde nesnelerin altında); akşam `geceCiz()` içinde `lambalar` (lamba
  eşyaları: koni + hale) ve `KORIDOR_LAMBALARI`. **Aydınlık gece / oda ışıkları:** gece örtüsü hafif (`gecelik()`×0,10), her oda dikdörtgeni için `oda[i]` 0..1 (`odaGuncelle`, `guncelle`/`uzakGuncelle` kancası:
  içinde oyuncu, ajan, ziyaretçi ya da Sütlaç varsa ~0,3 sn'de yanar, boşalınca ~0,6 sn'de söner); boş oda `(1-d)×(0,10 + 0,34×gece)` koyulaşır (gündüz de hafif loş), dolu oda geceleyin sıcak beyaz düz bir aydınlık alır
  (glow yok); lamba/monitör ışığı odanın ışığıyla çarpılır, koridor lambaları en az %35. Oda kimlikleri `gundem, yonetim, beyin (arşiv), radar, merkez, mutfak, toplanti, studyo, yayin`. Test: `__ofis.odaIsik()`. Gradyanlar `isikLekesi/isikKonisi/huzme` sprite önbelleğinden (`isikOnbellek`), karede yeniden yaratılmaz.
- **Ses**: `ses.js` grafiği efektler→`efektBus`, ambiyans→`ambBus`→`ana`→sıkıştırıcı. `SES.oda(id)` oyuncunun odasına göre katman karışımı (stüdyo sessiz, mutfak
  buzdolabı, radar/yayın sunucu fanı, haber merkezi uğultu + uzak klavye). Konumlu ses: `SES.calKonum(ad, panX, uzaklik, ...arg)`; `ofis.js`'te `sesKonum(ad, x, y, ...arg)`
  oyuncuya göre pan/uzaklık hesaplar (başka oda +6 karo). `SES.cal` imzası aynı. Test: `__ofis.sesDene()`, `sesDurum()`, `isik()`, `ayar()`, `mini()`, `miniEkran(odaId)`, `miniGit(odaId)`
  (son beşi modüllerin `test` alanından `__ofis`'e eklenir).

## Test
- `node --check ofis.js` (sözdizimi). Tarayıcı konsolu: `window.__ofis` kancaları — `ilerle(sn)` (simülasyonu ilerletir),
  `durum()`, `oyuncu()`, `isinla(x, y)`, `e()` (E'ye basmak), `kedi()`, `parti()`, `zamanAyarla(t)` (ajanları o saatte olmaları gereken yere
  de koyar), `mola()`, `oturaklar()`, `yanina(id)`, `gorevler()` (`[id, bitti]`), `gorevBitir(id)`, `rutin()` (gün, saat, toplantı, her ajanın durumu,
  planlı giriş/çıkış saatleri, karne), `karne()` (karneyi şimdi göster), `yerlesimOzet()` (harita dökümü), `parti()`, `sutlac()`, `klavye()`, `yazici()` (sıkışık mı).
- Gece sürümü A paketi doğrulaması (18 Ekim): gerçek saatte 07:55 → 08:00 yeni gün + 4 dk arayla girişler, 10/15/22 toplantıları (5'er üye), öğle ve akşam yemeği, 01:00 `ofisKapat` → karne → ~2 dk'da 10 çıkış → kapalı (Ada kalır);
  04:00 yedek kapanış; sayfa yenilenince kapalı kalır; ertesi 08:00 açılış; 2 ve 4 dk'lık hızlı günde tam döngü; boş düzende `yerlesimOzet()` 9296 / 90542092. Test kancaları: `ofisKapat()`, `ofisAc()`, `ofisDurum()`, `odaIsik()`.
- Çekirdek bölme doğrulaması (17 Ekim): `yerlesimOzet()` uzunluk + özet aynı; Ayarlar > Gün süresi 2 ve 4 dk'da `ilerle` ile gün sonuna kadar 11/11 çıkış,
  iki toplantı, öğle, 18:30 karnesi; E noktaları, sürprizler, Sütlaç, mini harita, ayarlar elle sınandı. Tarayıcı bölmesi gizliyken `requestAnimationFrame` durur:
  testte kare beklemek yerine `ilerle` kullan.
- Arka plandaki sekmede `requestAnimationFrame` durabilir; test için `ilerle` kullan.

## Kurallar
- Türkçe adlandırma ve kısa Türkçe yorum; mevcut üslupla aynı yoğunluk.
- Senaryo verisi kurgusal kalır; gerçek veri yalnız salt-okur: `gercek_veri.py` (vault'a yazılmaz, ziyarete gitmez).
- **Kodda, belgede, örnekte gerçek kişi adı yok** (dağıtılan her şey `araclar/paketle.py` ad taramasından geçer); kişiye özel her şey `kisi.json`'dadır.

## Gerçek beyin sohbeti (ofis.pyw, sohbet.js)
- `ofis.pyw` (pythonw, kısayol `araclar/kisayol_kur.ps1`): 127.0.0.1:8540'ta statik dosya + API. Açılışta rastgele anahtar üretir, `index.html`deki
  `<meta name="ofis-anahtar" content="">` içine gömer; /api uçları anahtar + Host + Origin ister. Pencere: Edge/Chrome `--app` (ayrı profil `%LOCALAPPDATA%\OfisDemo\profil`).
  Sayfa 20 sn'de bir `/api/nabiz`; 3 dk gelmezse ve soru sürmüyorsa sunucu kapanır. Port doluysa ve Ofis'se yalnız pencere açılır. Günlük: `%LOCALAPPDATA%\OfisDemo\gunluk.txt`.
- `/api/sor` NDJSON akışı: `claude -p --output-format stream-json --verbose --include-partial-messages --model <takma ad> --effort <düzey>
  --add-dir <vault> --allowedTools Read Grep Glob` (yazan araçlar kapalı), cwd boş `calisma` klasörü (vault hook'ları/CLAUDE.md yüklenmez),
  `ANTHROPIC_API_KEY` ortamdan silinir (abonelik). Olaylar: `basla`, `arac {ad, hedef}`, `metin {parca}`, `bitti {oturum, metin, oneriler}`, `hata`.
  Ada'nın kimliği `sistem_istemi()`nde (Core.md + Kurallar.md ile `companion_ozeti()`: en üst Last-Session kartı ve Threads başlıkları eklenir; Claude hook'suz, boş klasörde açıldığı için "geçen sefer ne yapıyorduk" sorusu buradan cevaplanır; yollar `COMPANION`'dan bulunur, sabit değildir). Oturum devamı `--resume` yalnız bu sunucunun açtığı oturumlara.
- Onaylı yazma: Ada cevabın sonuna `<oneri>{tur: not|gorev|ekle, yol, baslik, metin, proje}</oneri>` koyar; `oneri_dogrula` (notes/ ya da tasks/, .md,
  vault içi, not/görevde dosya yok, eklemede var) → jetonla bekler → `/api/onay` evet: `beyin.py note-create` / `task-create` / dosya sonuna ekleme + `sync`.
- Oyun tarafı `window.OFIS_AI` (ofis.js): `arac()` Ada'yı arşiv rafına (`enYakinYurur(29, 4)`) yollar, `ozel = "beyin"` (olay ve rutin beklemez/almaz);
  `bitti()` oyuncuya getirip masasına döndürür. `sohbet.js` kutuyu, model/efor seçimini (`localStorage["ofis-sohbet-1"]`) ve öneri kartlarını yönetir.
- Modern UI: `araclar/ui_yap.py` → `varliklar/ui/cerceve-koyu.png` (9 dilimli, `.cerceve` sınıfı `border-image`), `portre-oyuncu/ada.png` (10 kare × 3 satır:
  konuş, onayla, hayır; 32×32), `varliklar/ofis.png` + `ofis.ico`. Diyalog `portreCiz` portresi olanları konuşma animasyonuyla çizer.

## Düzenle modu (`moduller/duzenle.js`, 17 Ekim gecesi)
- Header'da 🛠️ Düzenle → solda `#duzenPanel` (Modern UI): katman (Eşya: engel · Üst: masa üstü, engelsiz, altındaki eşyanın üstünde çizilir · Halı: zemin ·
  Duvar), kategori (bu ofisteki atlas parçaları + katalog), eşya ızgarası. Açılınca kamera tüm ofise geçer, kapanınca eski hâline döner; ızgara çizilir.
- Fare: eşya seç → haritaya tıkla (yatayda 8 px, altta karo kenarına oturur; Alt: serbest); haritadaki eşyaya tıkla → elde taşı, tıkla bırak, Esc eski yerine;
  sağ tık / Del kaldırır; oklar son yerleşeni 1 px (Shift 8 px) kaydırır; Ctrl+Z / "Geri al" (60 adım); "Ofisin ilk düzenine dön".
- Veri: çekirdekte `duzen = { eklenen: [{k, x, y, katman}], silinen: [temel eşya imzası "k@x,y"] }`. `yerlesim()` temel haritadan silinenleri atlar,
  eklenenleri sonra kurar (`kullaniciEsyasi`; nesnede `kullanici` / temelde `taban` 1 tabanlı sıra). Boş düzende yerleşim temel haritayla birebir aynı.
  Her değişiklikte `yerlesimYenile()` her şeyi veriden yeniden kurar (yürünebilirlik, statik katman, oturak yaklaşma noktaları; `yerlesimYenilendi` kancası:
  ışık modülü pencereleri yeniden bulur). `k` atlas adı, `kat:...` ya da temel haritadaki kaynak dizesi olabilir (taşınan temel eşyalar).
- Kurallar: oda içinde; eşyanın alt şeridi boş zeminde ve koltuk/kahve/yazıcı/giriş/oturak yaklaşma karosunda değil; halı zeminde, duvar eşyası duvarda.
  Sonra `erisimDenetle()`: girişten her masaya, oyuncunun masasına, kahveye, yazıcıya, mama kabına, oturaklara ve kapılara BFS; ulaşılamayan varsa
  değişiklik geri alınır ve panel sebebini söyler. `korunanMi(i)`: masa, ekran, sunucu, monitör, koltuk, davranışlı, `hk.*`, asansör, saat, tezgah, sebil,
  üstünde eşya duran ve oturak/etkileşim noktası taşıyan temel eşyalar taşınmaz/silinmez (üzerine gelince kırmızı kesik çerçeve).
- Kayıt: `ofis.pyw` `GET/POST /api/duzen` (anahtar + Host + Origin; `duzen_dogrula` biçimi denetler, en çok 2000 eşya) → `%LOCALAPPDATA%\OfisDemo\duzen.json`
  (`--duzen DOSYA` ile değişir; testler `--veri` ile geçici bir klasör ya da `%TEMP%/ofis-test-duzen.json` kullanır). Düz http.server'da `localStorage["ofis-duzen-1"]`.
  Açılışta çekirdek düzeni okur, gereken katalog sayfalarını (`katYukle`) yükler, sonra `yerlesim()`.
- Test: `__ofis.duzen()`, `duzenAc()`, `duzenYerlestir(k, katman, x, y)`, `duzenAlti(wx, wy)`, `duzenSil(wx, wy)`, `duzenTasi(wx, wy, hx, hy)`, `duzenGeri()`, `duzenMesaj()`.

## Gardırop (`moduller/gardirop.js`, 17 Ekim gecesi)
- Yönetim odasının sol üstünde açık dolap (`gardirop`, Bedroom gölgeli tekil 408; düz setin numaraları farklı olduğundan gölgeli dosyadan) ve askılık
  (`askilik`, Clothing Store 429); ikisi `harita/ofis.tmj`'de. Dolabın önünde E → sağda Modern UI paneli: Ten / Göz / Kıyafet / Saç / Aksesuar, model ızgarası,
  çok renkli modelde Renk satırı, Saç ve Aksesuarda "Yok", dönen önizleme (←/→), 🎲 Rastgele, İlk görünüm, Vazgeç (Esc, haritaya tıklama), Giy.
- Birleştirme tarayıcıda: seçilen parçaların tam sayfaları (896×656) paketin sırasıyla (gövde, göz, kıyafet, saç, aksesuar) tek tuvale çizilir,
  `img.k.oyuncu` o tuval olur; çizim kodu değişmedi. Açılışta varsayılan görünüm `varliklar/oyuncu.png` ile birebir aynı (piksel karşılaştırması 0 fark).
- Veri: `araclar/gardirop_yap.py` → `gardirop.js` (`window.GARDIROP`: gövde 9, göz 7, kıyafet 33 model/132, saç 29/200, aksesuar 19/84, varsayılan) ve
  `varliklar/gardirop/<kat>.png` (öne bakan duruş karesi, varsayılan gövdeye giydirilmiş küçük resimler). Paket güncellenirse betiği yeniden çalıştır.
- Kayıt: `ofis.pyw` `/api/gorunum` (GET/POST, anahtar gerekli) → `%LOCALAPPDATA%\OfisDemo\gorunum.json` (`--gorunum` ile değişir; launch.json testi temp
  dosya kullanır). Sunucu yalnız parça adlarını kabul eder (`06_01`, `15_Glasses_02`); yol ya da bilinmeyen biçim 400. İstemci listede olmayan parçayı varsayılana çevirir.
- **Konuşan portre:** aynı seçim Portrait Generator parçalarıyla (`varliklar/limezu-ui/16x16/Portrait_Generator/`: `PG_Skin_<n>`, `PG_Eyes_<nn>`, `PG_Hairstyle_<mm>_<r>`,
  `PG_Accessory_<mm>_<Ad>_<r>`; renk numarası sıfırsız, kıyafet yok) 320×96 tuvale birleşir → `img.portre.oyuncu` (diyalog kutusu) ve `OFIS_PORTRE.ayarla`
  (sohbet.js: oyuncunun mesaj portreleri). Arı, sırt çantası, eldiven, aşçı şapkasının portresi yok (`GARDIROP.portre_aksesuar`); seçilince panel söyler.
  Varsayılan portre `varliklar/ui/portre-oyuncu.png` ile aynı. Uygulama ikonu (`ofis.ico`) sabit kalır.
- Dolap E noktası taşıdığı için Düzenle'de korunur. Test: `__ofis.gardirop()`, `gardiropAc()`,
  `gardiropSec(kat, değer)`, `gardiropGiy()`, `gardiropVazgec()`, `gardiropRastgele()`, `gardiropOzet()`, `gardiropPortreOzet()`, `gardiropMesaj()`.

## Modüller ve harita (17 Ekim akşamı)
- **Çekirdek + modüller:** sistemler `moduller/*.js` (index.html'de ofis.js'ten sonra) `window.OFIS_MODULLER`'e `{kanca: fn, test: {...}}` olarak kayıt olur.
  Çekirdek kancaları `MOD(ad, ...)` ile çağırır (ilk tanımlı dönüş kullanılır: olay tüketen kancalar tüketmeyince `undefined` döner, `false` değil);
  modüller birbirine de `OFIS_IC.MOD` ile seslenir. Modüller çekirdeğe `window.OFIS_IC` üzerinden erişir (görseller yüklenip `yerlesim()` bittikten ve
  DOMContentLoaded'dan sonra kurulur; değişen durum getter, ayar çarpanları setter). `test` alanı `__ofis`'e eklenir. Kancalar:
  - yaşam: `basla, bastan(tam), guncelle(dt), kahveAdayi(bos) (null = kimse), kahveSozu, kahveIcti, dedikoduCifti(bos) → {a, b, sozler}, sohbetEtti(a, b),
    konustu(a), kediFavori(adaylar), ajanHtml(a), selam(a, metin), cevap(a, secenek), toplantiKarar(T_, bitir)` (true dönerse toplantı "karar"da bekler, modül bitir()'i çağırır).
  - çizim: `zeminIsik` (kare tuvali, nesnelerin altı), `canliCiz(t)` (asansörden sonra), `kediCiz`, `geceCiz` (ana tuval), `ustKatmanSon(hudUst)`.
  - güncelleme: `kediGuncelle(dt)`, `surprizGuncelle` (adimla'da eski yerlerinde: sıra korunur).
  - girdi: `fareHareket(e)`, `tikla(e)`, `tus(e)` (true = tüketti), `tusGozle(e)` (her tuş, tüketmez), `oyuncuTiklandi`, `kediSev`.
  - modüller arası: `ayarUygulandi(ayar)`, `ayarKaydet(k, v)`, `klavyedenIn(tesekkur)`, `sutlacCagir`, `partiBasladi`.
- Paylaşılan durum çekirdekte kalır, modül yazar: `efekt` (`parti, kafein, balik, sonDakika` süre damgaları; çizim ve hareket okur, `bastan` sıfırlar),
  `kedi`, `mama`, `stat`, `NESNELER`, `kayitSon` (getter/setter). Yeni süre damgası eklersen `bastan`'daki sıfırlamaya da ekle.
- `moduller/isik.js` (hüzme, gece, lamba, disko), `mini-harita.js` (çizim, tıkla-git, M), `ayarlar.js` (panel, localStorage, gün süresi), `surprizler.js`
  (E noktaları, yazıcı sıkışması, son dakika, guguk, akşam selamı, dedikodu, Konami, "sütlaç", oyuncuya 10 tık), `sutlac.js` (kedi davranışı, sprite'lar, mama kabı).
- `moduller/ihtiyac.js`: `a.ih = {enerji, sosyal, kahve, tokluk}` (0-100, oyun dakikasıyla: enerji saatte ~7, gece ~10; sosyallik ~4; kahve ~10; tokluk ~6; kahve içince kahve +60 ve enerji +35,
  sohbet +35, oyuncu +12; `a.rut === "ogle" || "aksam"` tokluk +1,2/dk ve enerji/sosyal doldurur, toplantı sosyal doldurur). Enerji < 30 ya da kahve < 12 olan zamanlayıcıyı beklemeden kahveye gider
  (makinede tek kişi, `kahveAdayi` kahvesi/enerjisi en az olanı seçer); tokluk < 20 olan (ajan başına 40 oyun dakikasında bir) mutfağa atıştırmaya gider (`ozel = "atistirma"`, tokluk +35).
  İlişkiler `demo-veri.js > iliskiler` (arkadas, sakalar "a|b" sıralı anahtar, gerilim = şakalaşan rakipler, kediFavori). `window.OFIS_YASAM`: `ruhHali(a)` → yorgun / aç / yalnız / keyifli / normal,
  `ihtiyaclar(a)` → `[{id, ad, deger, renk}]` (Kahve, Tokluk, Enerji; kişi kartı), `doldur(a, {kahve, tokluk, enerji, sosyal})`, `arkadaslari(id)`, `rakipleri(id)`, `sohbette(a)`, `odaGunlugu(odaId, n)` (son ikisi sohbet-ortam.js).
- `moduller/diyalog.js`: soru hafızası (aynı gün / dün), ruh haline (yorgun, aç, yalnız, keyifli), tokluk/kahve durumuna ("Daha akşam yemeği yemedim…", "Kahve seviyem kritik"), gece saatine ve bugünkü gelişe göre selam, toplantı kararı (`diyalogOzel` ile, 40 oyun dakikası
  cevapsız kalırsa "plana devam"). Seçeneklerde `alt: [...]` alt dal açar ("↩ Geri"), `fn` özel davranıştır (metni kendisi kurar).
- **Harita:** `harita/ofis.tmj` (Tiled JSON; katmanlar odalar, kapilar, noktalar, mobilya) kaynak; `araclar/harita_yap.py` → `harita.js` (`window.HARITA`).
  Biçim betiğin başında. `yerlesim()` mobilyayı sırayla kurar (`kaynak()`: atlas adı, `hk.`, `C.ad(arg)`, `birlesik:`, `masaKur:`; `DAVRANIS`: guguk, akvaryum).
  Dönüşüm doğrulandı: `__ofis.yerlesimOzet()` (nesneler, zeminler, ekranlar, monitörler, koltuklar, yürünebilirlik) eski koddakiyle birebir aynı.
- **Ajan sohbeti:** `OFIS_AI.sohbetBasla/Bitti(id)` ajanı yerinde tutar (`konusuyor` + `ozel = "beyin"`); `dusun/arac/bitti` yalnız balon. Kutu kapanırsa
  ya da başka ajana geçilirse serbest kalır (masasında değilse 0,8 sn sonra döner). `ofis.pyw > ROLLER` ajan → ad, rol, kimlik, odak klasörleri.
- **Balonlar:** dar tuvalde (`cv.width / yo < 760`) en önemli 3 balon (oyuncu, konuşulan, yakın ve yeni), boyut tuval genişliğiyle küçülür; yer yoksa atlanır.
- **Tek örnek:** `ofis.pyw` portu özel bağlar (Windows `SO_EXCLUSIVEADDRUSE`); `/api/kimlik` sürüm (dosya özeti) döner, farklıysa yeni başlatıcı `/api/kapat` ile eskisini kapatır.
- Çekirdek bölündü (17 Ekim gecesi): ışık, mini harita, ayarlar, sürprizler, Sütlaç modülde; `ofis.js` ~1.785 → ~1.330 satır. Çekirdekte kalanlar sıkı bağlı:
  harita/yerleşim, A*, ajan hareketi, senaryo/olay, diyalog, rutin, görevler/karne, çizim, etkileşim. Sonraki aday: görevler/karne (`gorevBitir` kancaları
  pek çok yerde) ve rutin (toplantı/öğle); ikisi de testli, ayrı iş. Yeni işler modül olarak eklenmeli.

## Kişi ayarı, `--veri`, kurulum ve paketleme (17 Ekim, 3. aşama)
- **`kisi.json`** (`VERI` klasöründe; varsayılan `%LOCALAPPDATA%\OfisDemo\kisi.json`; paketle gitmez). Hepsi isteğe bağlı, `ofis.pyw > kisi_dogrula` doğrular
  (yalnız bilinen alanlar, metinler kısaltılır, geçersiz değer varsayılana düşer, dosya yok/bozuksa genel varsayılanlar; 0.10.0 ile gelen kişisel katman alanları "Birleşik sürüm 0.10.0" bölümünde):
  `kullanici_adi` (yapay zekâ isteminde kullanıcı; "Ad Soyad" ise konuşma dilinde ilk kelime, varsayılan "Kullanıcı"), `oyuncu_adi` (oyundaki görünen ad,
  varsayılan "Yönetici"), `oyuncu_tam_adi` (başlık ve odada; varsayılan oyuncu_adi), `ofis_adi` ("Yönetim Ofisi"), `oda_adi` (yönetim odası tabelası; varsayılan
  "<TAM AD BÜYÜK> · YÖNETİM"), `asistan_adi` ("Ada"), `vault` (ikinci beyin klasörü, var olan klasör olmalı; varsayılan ofis klasörünün iki üstü), `roller`
  (ajan id → `{ad, rol, kimlik, odak, koltuk, ayakta}`, eksik alan varsayılandan), `gorev_sahibi` (task-create `owner`, varsayılan kullanici_adi).
  Varsayılan roller `ROLLER_VARSAYILAN` (genel bir beyin vault'u: companion, knowledge, notes, tasks, daily, projeler).
- **Akış:** sunucu açılışta `kisi_yukle()` → `VAULT`, `COMPANION`, `ROLLER`, `KISI`. `index.html` sunulurken `<meta name="ofis-kisi" content="">` doğrulanmış görünür
  ayarlarla (JSON, HTML-kaçışlı) doldurulur; aynı veri `/api/durum` cevabında `kisi` alanıdır (yol ya da kullanıcı adı içermez). `kisi.js` meta'yı okur, ofis.js'ten önce
  `DEMO.ajanlar` adlarını/rollerini ve "yonetim" odasının tabelasını yerleştirir, DEMO metinlerindeki ve sayfadaki yer tutucuları çözer. Düz `http.server`'da meta boştur: varsayılanlar.
- **Yer tutucular** (index.html ve DEMO metinleri): `{oyuncu}` `{tam}` `{asistan}` `{ofis}` `{ajan.<id>}`; ek için `{asistan:ın}` (Ada'nın) `{oyuncu:a}` `{oyuncu:ı}` `{asistan:dan}` `{asistan:la}`.
  Kodda: `OFIS_KISI.ek(ad, "ın"|"ı"|"a"|"da"|"dan"|"la")` (ünlü uyumu + kaynaştırma; sunucuda aynı mantık `tr_ek`), `OFIS_KISI.ad/.tam/.ofis/.asistan/.oda`, `buyuk(s)` (tr büyük harf).
  Modüller `const KISI = window.OFIS_KISI` ile alır; yeni görünen metinde kişi adı yazma, bunları kullan.
- **Oyuncu kimliği:** oyuncunun ajan id'si `oyuncu` (`DEMO.ajanlar[0]`, bayrak `oyuncu: true`; çekirdekte `oyuncu` değişkeni, `OYUNCU_BAS`, `OFIS_IC.oyuncu`, MOD kancası
  `oyuncuTiklandi`, `img.k.oyuncu`, `img.portre.oyuncu`, `__ofis.oyuncu()`, harita noktası `noktalar.oyuncu`, monitör `sahip: "oyuncu"`, `varliklar/oyuncu.png`,
  `varliklar/ui/portre-oyuncu.png`, sohbette `.msj.oyuncu`). Eski oyuncu adı takma ad olarak bile yok. Kayıtlı `gorunum.json`/`duzen.json` biçimi değişmedi (parça adları
  ve eşya imzaları id içermez), eski kayıtlar olduğu gibi çalışır.
- **`--veri KLASOR`** (`ofis.pyw`): `VERI` ve altı (`kisi.json`, `duzen.json`, `gorunum.json`, `gunluk.txt`, `calisma/`, `profil/`) oradan; `--duzen`/`--gorunum` sonra gelip ayrıca üzerine yazabilir.
  Testlerde her zaman farklı `--port`, `--tarayicisiz` ve geçici `--veri` kullan. Ziyaret/eşleşme dosyaları (`ziyaret.json`, `eslesmeler.json`) da `VERI`'ye yazılır.
- **Kurulum** (`Kur.bat` → `araclar/kur.py`): Python/Pillow denetimi; LimeZu zip'lerini **içeriğine göre** tanır (Modern Interiors: `1_Interiors/16x16/Theme_Sorter_Singles/` +
  `2_Characters/Character_Generator/` + `3_Animated_objects/16x16/spritesheets/`; Modern Office: `Modern_Office_16x16.png`; Modern User Interface: `16x16/Portrait_Generator/Skins/`;
  Free: `Modern tiles_Free/Interiors_free/16x16/`), `varliklar/limezu-tam|ofis|ui|free` altına açar (Modern Interiors'ta yalnız 16x16 klasörleri, karakter oluşturucu ve animasyonlar;
  zip-slip denetimli), kişi sorularını sorup `kisi.json` yazar, üreticileri (atlas_yap, katalog_yap, gardirop_yap, ui_yap) çalıştırıp çıktıları denetler, `kisayol_kur.ps1` ile kısayol kurar.
  Bayraklar: `--sessiz`, `--varliklar KLASOR`, `--veri KLASOR`, `--kisayolsuz`, `--yeniden`, `--kisi`, `--uret`, `--guncelle ZIP`, `--kullanici-adi/--oyuncu-adi/--oyuncu-tam-adi/--ofis-adi/--asistan-adi/--vault`.
  Üreticiler proje klasöründen (cwd) çalışır; çıktılar kaynak sürümle birebir aynıdır (gerçek projede karşılaştırıldı).
  **Tek tık akışı (18 Ekim, F paketi):** `Kur.bat` (saf ASCII) çalışan bir Python 3.8+ arar (`py -3`, `python`, `python3`; Microsoft Store'un boş kısayolu sayılmaz, çünkü gerçekten çalıştırılıp sınanır;
  winget sonrası PATH yenilenmediği için bilinen kurulum yollarına da bakar). Yoksa `winget install -e --id Python.Python.3.12` önerir (E/H). Zip'ler sırayla `--varliklar`, Kur.bat klasörü, İndirilenler, Masaüstü
  (OneDrive'lı olanı da), `varliklar/` içinde aranır; bulunamayanlar adı + itch.io adresiyle yazılır, kullanıcı zip'i koyup Enter'a basınca yeniden aranır (`q` çıkar). **Güncelleme modu:** hazır paketler ve mevcut
  `kisi.json` varsa soru sorulmaz (kişiyi yeniden sormak: `--kisi`; her şeyi baştan: `--yeniden`). Üreticiler `varliklar/.uretim.json` damgasıyla (betik sha256) yalnız çıktısı eksikse **ya da betiği değiştiyse** yeniden çalışır;
  damga yoksa (eski kurulum) bir kez yeniden üretilir. `--uret` yalnız bu adımdır (güncelleyici çağırır; varlık/Pillow yoksa uyarıp çıkar, hata sayılmaz). Claude Code yoksa (`which` + bilinen yollar) oyun yine kurulur ve bu söylenir.
  İnteraktif kurulum sonunda "Ofis'i şimdi açayım mı?" sorar.
- **Paketleme** (`araclar/paketle.py`): `dist/Ofis-<sürüm>.zip` (kök klasör `Ofis/`; sürüm `surum.json`dan) + `dist/SHA256SUMS` (Release'e zip ile yüklenir); `varliklar/` yalnız `BURAYA.txt` taşır; PNG/ICO/zip yok. Pakete girebilecek yollar `araclar/guncelle.py > yol_incele` ile belirlenir (güncelleyiciyle aynı izin listesi); listeye uymayan dosya hata. `LICENSE` metin olarak taranır, yalnız telif satırı (`Copyright (c) YIL tekKelime`) muaftır ve her çalıştırmada yazdırılır. **Ad taraması** zip'ten önce zorunlu
  (kaynaklar paketle.py başlığında: vault kişi notlarındaki `ad:` alanları, yerel yasaklı ad listesi, kisi.json adları); eşleşmede dosya:satır listelenir, zip yazılmaz. `--tara` yalnız tarar,
  `--yasakli ADI` denemek içindir. Küçük harfli ortak sözcük "özel" ve Python dosyalarındaki küçük harfli anahtar sözcük (koşul dalı) sayılmaz. Yeni dosya/örnek eklerken gerçek ad kullanma: yalnız Deniz Demo, Selin Hoca, Baran Sanalıoğlu, Mert Kurgusal, Ayla Kurgu.

## Güncelleme (18 Ekim, F paketi: `guncelleme.py`, `araclar/guncelle.py`, `moduller/guncelleme.js`, `surum.json`)
- **Sürüm kaynağı:** `surum.json` (`{"surum": "0.9.0", "depo": ""}`). `depo` = `sahip/ad` (GitHub); boşsa çevrimiçi denetim kapalıdır ("yayın deposu ayarlanmadı"), `--zip` ile yerel güncelleme yine çalışır. Yayında depo adı doldurulur.
- **Yayın düzeni (Release):** `py -3 araclar/paketle.py` → `dist/Ofis-<sürüm>.zip` + `dist/SHA256SUMS`; GitHub Release etiketi `v<sürüm>` (zip içindeki `surum.json` ile aynı olmalı), iki dosya varlık olarak yüklenir. Güncelleyici digest/SHA256SUMS olmayan yayını kurmaz.
- **Uçlar** (`/api/guncelleme/*`, anahtar+Host+Origin çekirdekte; `ofis.pyw` `EKLER["guncelleme"]`): `GET durum`, `POST denetle`, `POST kur`, `POST geri`, `POST ayar {otomatik}`. Durum `VERI/guncelleme.json` (otomatik ayar, son denetim/deneme, bulunan sürüm; paketle/güncelleyici dokunmaz),
  süren işlemin ilerlemesi `VERI/guncelleme-durum.json`. Otomatik denetim yalnız kullanıcı açarsa (varsayılan kapalı), açılışta/durum sorgusunda, `son_deneme`den 24 saat geçtiyse ve yalnız bir kez (başarısız denemeler de sayılır); istek yalnız sürüm bilgisidir.
- **Kurulum** `guncelle.py --internet` ile **ayrı, bağımsız süreçte** (sunucu kendini kapatacağı için): GitHub'a sorar → zip indirir (≤ 50 MB) → sha256 (varlık `digest` ve/veya `SHA256SUMS`; ikisi de varsa tutmalı, hiçbiri yoksa red) → zip denetimi (zip-slip, mutlak/sürücü/akış adı,
  sembolik bağ, şifreli, yinelenen ad, boyut/oran/sayı sınırı; **izin listesi dışı tek dosya bile varsa tümü reddedilir**) → `.py/.pyw` derlenir → önceki dosyalar `yedek/<sürüm>/dosyalar/` + `yedek.json` → atomik değiştirme → `kur.py --uret` (üretici betikleri değiştiyse görselleri yeniler)
  → hata olursa uygulananlar geri konur → `POST /api/kapat` ile açık ofis kapatılır, `ofis.pyw` aynı bağımsız değişkenlerle `--tarayicisiz` yeniden açılır. Açık sayfa (`guncelleme.js`) `/api/kimlik`i yoklar; sunucu düşüp dönünce `location.reload()` yapar (yeni pencere açılmaz).
  Ağ: yalnız https; `api.github.com` (API) ve `github.com` + GitHub release CDN'leri (indirme), her yönlendirme adımı yeniden denetlenir, ana makine küresel adrese çözülmeli. Sabitler (`SEMALAR`, `*_HOSTLAR`, `API_ADRES`) testte sahte yerel sunucuya çevrilir, üretimde değişmez.
- **Kurulacak dosyalar (`yol_incele`):** kökte `.html .js .py .pyw .bat .ps1 .md`, `surum.json`, `LICENSE`; `moduller/` (`.js .css .html`), `araclar/` (`.py .ps1 .bat .json`, `araclar/katalog/` hariç), `harita/` (`.tmj .json`). Asla: `varliklar/` (yalnız `BURAYA.txt` sessizce atlanır), `dist/`, `yedek/`, noktayla başlayanlar, `*-yedek`,
  durum dosyaları (`kisi/eslesmeler/duzen/gorunum/ziyaret/guncelleme*.json`, `gunluk.txt`). Zip'te olmayan eski dosyalar silinmez. Yedek en çok 3 sürüm tutulur; `--geri` son güncellemeyi geri alır (yeni eklenen dosyalar silinir, üretici damgası yeniden kontrol edilir).
- **El yolu:** `py -3 araclar/guncelle.py --zip Ofis-x.zip [--sha256 HEX]` (yanında `SHA256SUMS` ya da `<zip>.sha256` varsa doğrulanır; yoksa uyarı + onay, `--evet` atlar), `--denetle`, `--geri`, `--zorla`, `--yeniden-baslat [--port N]`. Yeni sürüm zip'ini eski kurulumun üstüne açıp `Kur.bat` çalıştırmak da güncellemedir (damgalı üretim).
- **Yayına hazırlık:** `.gitignore` (LimeZu/üretilen görseller, `dist/`, `yedek/`, kişisel json'lar, geliştirici notları `DEVAM/IYILESTIRME/TASARIM-*`), `LICENSE` (MIT), README başında yayın bölümü. Push/Release kullanıcı onayıyla.

## Asansörle ziyaret (ziyaret.py, moduller/ziyaret.js; 17 Ekim, 4. aşama)
İki ofis aynı Wi-Fi'de eşleşir; biri öbürünün giriş asansöründen ofisine "ziyarete" gider: ev sahibi onaylar, misafir ev sahibinin ofisini (düzeni, oyuncu görünümü,
ajanlar, kedi, saat) kendi karakteriyle gezer, ev sahibi de misafiri görür. Ofisin görünen verisi dışında hiçbir gerçek veri (brifing, onay kartı, sohbet içeriği, vault
yolu, `kullanici_adi`, roller metni) karşıya gitmez. Tasarım: `TASARIM-KURULUM-ZIYARET.md` B bölümü.

**Ağ ve güvenlik (ziyaret.py)**
- 127.0.0.1:8540 ana sunucusu aynı kalır (anahtar + Host + Origin). Ağa açılan TEK şey ayrı **ziyaret dinleyicisi** `0.0.0.0:<--ziyaret-port, 8545>`: varsayılan KAPALI
  (Ayarlar > Ziyaret > "Ofisimi ziyarete aç", `VERI/ziyaret.json`), dosya sunmaz, yalnız `/z/*` JSON; gövde en çok 16 KB (411/413), IP başına hız sınırı (429; 40/sn, eşleşme/istek
  uçları ayrıca dakikada ~10), en çok 24 eşzamanlı bağlantı ve IP başına en çok 6, bağlantı başına 5 sn okuma zaman aşımı + 8 sn toplam ömür (yavaş yavaş gönderen kesilir), yalnız özel ağdan (10/8, 172.16/12, 192.168/16, 169.254/16, 127/8 test) gelen istek,
  `Origin` başlıklı (tarayıcı) istek 403, `SO_EXCLUSIVEADDRUSE`; derin iç içe/bozuk JSON 400 (iş parçacığı düşmez). Giden istekte hedef yalnız bu aralıklardan sayısal IPv4 olabilir (ad çözümleme yok, yönlendirme izlenmez: `http.client`).
- **Keşif:** UDP yayını `--kesif-port` (8546) üzerinde ~3 sn'de bir `{tur:"ofis", id, ad, port, protokol}` (255.255.255.255 + arayüz /24 yayını; ağ yoksa 127.255.255.255),
  dinleme `SO_REUSEADDR` ile: aynı makinedeki iki örnek aynı keşif portunu paylaşır, yayın ikisine de ulaşır (Windows'ta sınandı); kendi kimliğin yok sayılır, 20 sn görülmeyen düşer.
  Yayın yoksa elle IP + port girilir. Keşif tablosu en çok 64 kayıt, IP başına tek kayıt, ad temizlenir. Keşif yalnız ipucudur: kayıtlı adrese ulaşılamazsa ve keşifte aynı kimlik başka adreste
  görüldüyse o adrese imzalı `/z/ping` atılır; cevabın imzası sırla doğrulanırsa (yalnız gerçek eşleşme imzalayabilir) adres kalıcı güncellenir, sahte paket adresi değiştiremez.
- **Eşleşme:** ev sahibi "Eşleşme kodu üret": 6 haneli (`secrets`), 5 dk, tek kullanımlık. Misafir `/z/esles`'e `{kod, id, ad, port, protokol}` yollar; doğruysa ev sahibi 32 baytlık
  ortak sır üretir ve cevapta verir; iki taraf `VERI/eslesmeler.json`'a `{id, ad, sir, adres, port, tarih}` yazar (atomik: aynı klasörde `mkstemp` + `os.replace`; sır arayüze, sayfaya
  ya da günlüğe çıkmaz; `/api/ziyaret/durum` sır döndürmez). 5 yanlış kod → 5 dk kilit (kod da düşer, doğru kod da reddedilir, yeni kod üretilemez). Aynı kimlikle ikinci eşleşme mevcut kaydı ezmez (409 `var`: önce kaldır). Eşleşme karşılıklıdır;
  Ayarlar'dan "Kaldır" iki tarafta da siler (karşıya imzalı `/z/kaldir`, en iyi çaba).
- **İmza:** `/z/esles` ve `/z/kimlik` dışındaki her istek imzalıdır: `X-Ofis-Id`, `X-Zaman` (ms), `X-Imza = HMAC-SHA256(sır, "POST\n<yol>\n<zaman>\n" + gövde)` (hex);
  ±60 sn penceresi, aynı imza ikinci kez geçmez (tekrar oynatma önbelleği). Cevap da imzalıdır: `X-Imza = HMAC(sır, "YANIT\n" + istek imzası + "\n" + gövde)`, istemci doğrular.
  Eksik/yanlış/eski/tekrarlanan imza 403.
- **Her ziyarette onay:** `/z/istek` {ad, görünüm, protokol, özet} → ev sahibi tarayıcısında "<ad> ofisine gelmek istiyor · Kabul / Reddet" (60 sn sonra kendiliğinden ret) →
  `/z/istek-durum` → kabulde `/z/sahne` (bir kez: ofis/oda/oyuncu adı, ajan id/ad/rol/karakter, düzen, görünüm) → `/z/an` (~4 Hz: misafir konumu gider, ev sahibi anlık görüntüsü +
  diğer misafirler gelir) → `/z/ayril`. Ziyaret süresi en çok 2 saat; misafirden 30 sn konum gelmezse ya da ev sahibi tarayıcısı 12 sn anlık görüntü yollamazsa biter.
  Ev sahibi başka bir ofisi ziyaret ediyorsa ya da ekranı açık değilse istek otomatik reddedilir; ev sahibi bir ofise giderse ona gelen misafirler uğurlanır. En çok 4 misafir.
- **Sürüm:** `protokol` numarası (`ziyaret.PROTOKOL`) + `harita.js`/`atlas.js`/`katalog.js` özeti (`ozet`); uyuşmazsa `/z/istek` 409 `surum`: "iki taraf da aynı sürümü kursun".
- **Güvenilmez veri:** misafir tarafı gelen sahneyi/anlık görüntüyü doğrular (`_sahne_temizle`, `_an_temizle`: kimlik düzeni, metin uzunluğu, sayı aralığı, `duzen_dogrula`,
  `gorunum_dogrula`); istemcide ayrıca düzen yalnız bu ofisin tanıdığı eşya kimliklerini (atlas, `kat:`, temel harita kaynakları) kabul eder (`duzenGuvenli`: `kaynak()` "C.ad(args)"
  dizelerini çalıştırdığı için). Ev sahibi tarayıcısının anlık görüntüsü de yalnız sayıdır (`_an_dogrula`).
- **Bilinen açıklar:** (1) trafik şifresiz HTTP: eşleşme anında sır düz metin gider (kod tek kullanımlık ve kısa ömürlü, ama aynı ağı dinleyen biri eşleşme sırasında sırrı görebilir;
  güvenilen ağda eşleş), sonrası imzalıdır ama içerik (konumlar, adlar) şifresizdir; (2) 6 haneli kod 5 yanlışta kilitler ama kilit geneldir (ağdaki biri eşleşmeyi kasten kilitleyebilir);
  (3) 24 bağlantı sınırı IP başına 6 ve 8 sn ile sınırlı ama çok sayıda IP'den hâlâ doldurulabilir; (4) keşif paketi sahtelenebilir (yalnız liste bilgisi; adres değişimi imzalı doğrulama ister); (5) ziyarete açıkken ofis adı yerel ağa UDP ile yayınlanır.

**Dosyalar:** `VERI/ziyaret.json` (`{id, acik}`; id kalıcı 16 hex), `VERI/eslesmeler.json` (id → kayıt; bozuk/özel ağ dışı kayıt yüklenmez). Bayraklar: `--ziyaret-port`, `--kesif-port`.
Yerel API (anahtarlı, 127.0.0.1): `GET /api/ziyaret/durum` (tek GET; yan etkili uçların hepsi POST, GET 405); `POST ayar {acik}`, `kod`, `tara` (eşleşmelerin çevrimiçi denetimi), `esles {adres, port, kod}`, `kaldir {id}`,
`yoklama {an, uzakta}` (ev sahibi tarayıcısı: anlık görüntü yollar; bekleyen istekler, misafirler, olaylar alır), `karar {istek, evet}`, `ugurla {v|ziyaret}`; misafir: `git {id, gorunum}`,
`giden` (onay yoklaması; kabulde sahne), `iptal`, `hareket {x, y, yon, yu}` (4 Hz; anlık görüntü döner; `bitti` sebepleri: ugurlandi, hareketsiz, sure, ofis, uzakta, kapandi, baglanti), `don`.

**İstemci (moduller/ziyaret.js):** (1) Ayarlar > Ziyaret bölümü (`#zAyar`): aç/kapat, kod üret, yakındaki ofisler (tıklayınca IP/port dolar), elle IP+kod ile eşleş, eşleşmeler. (2) Ev sahibi:
~4 Hz `anYap()` (yalnız sayılar: `[id, x, y, yon, yürüyor, oturak no, ofiste değil, telefonda, yazıyor, balon 0/1/2]`, kedi, saat, karakter no) → `yoklama`; onay kartı (`#ziyaretKarti`),
yan kart "Ziyaret" (misafirler + Uğurla), misafirler `ekKarakterler` olarak çizilir (görünüm `OFIS_GARDIROP.tuvalYap`). (3) Misafir: giriş asansöründe E → "Kat seç" paneli (`#ziyaretPanel`:
Kendi ofisim + eşleşmiş ofisler çevrimiçi/çevrimdışı) → istek → onay beklerken geri sayım, Vazgeç → kabulde `OFIS_IC.uzakGir`. Dönüş: asansörde E → "Kendi ofisime dön" (asansöre
girip çıkar), yan kart düğmesi ve Esc paneli (anında), uğurlama ya da bağlantı kopması (kendiliğinden; mesaj günlükte ve balonda).

**Çekirdek kancaları (ofis.js, küçük):** `ekKarakterler` (simülasyonda olmayan çizilen karakterler: sıralı çizim, ad etiketi, balon, kapıları açar; `ajanCiz` aynı), `uzak` durumu ve `OFIS_IC.uzakGir(sahne)` /
`uzakAn(an)` / `uzakCik()`, `OFIS_IC.asansorAc/yukle/gecis`. **Uzak mod:** kendi simülasyonun DURUR (`adimla` → `uzakAdimla`: zaman yalnız animasyon için, olay/rutin/kedi/senaryo/sürpriz yok);
`dakika()` ev sahibinin saatidir; `yakinHedef()` yalnız modülün `uzakHedef` kancasını (asansör, selam) kullanır; `bastan/gunSuresi/diyalogAc/tusGozle/canliCiz` kapalı; tıklama yalnız zemin;
`dongu` gerçek saate atlamaz. `uzakGir` kendi durumunu saklar (zaman, düzen, her ajanın alanları `UZAK_ALAN`, kedi, efekt, asansör, oda adı, ajan görselleri), ev sahibinin düzenini/adlarını/karakterlerini
uygular (`yerlesimYenile`), oyuncuyu asansörden çıkarır; `uzakCik` hepsini aynen geri yükler (gerçek saatte `gercekAdim` açılıştaki gibi saate atlar). `body.uzak` sınıfı: 🧠, Düzenle, Baştan oynat,
hız, günün işleri/brifing/onaylar/seçili ajan/günlük kartları, gün süresi ayarı gizli; Düzenle/gardırop `ic.uzak` ise açılmaz ve kaydetmez, `sohbet.js` düğmesi çalışmaz. Modül kancaları:
`basla, guncelle, uzakGuncelle, uzakHedef, tus (panel, Esc), tikla`. `moduller/gardirop.js` `window.OFIS_GARDIROP` {tuvalYap(görünüm), temizle, gorunum()} sunar (başkasının görünümü ayrı tuvale).

**Test:** aynı makinede iki örnek: `py -3 ofis.pyw --tarayicisiz --port 8571 --veri %TEMP%\ofis-z-a --ziyaret-port 8575` ve `--port 8572 --veri %TEMP%\ofis-z-b --ziyaret-port 8576`
(keşif portu varsayılan 8546, ikisi paylaşır). Test kancaları (`__ofis`): `ziyaretDurum()`, `ziyaretTik()` (bir ağ turu), `ziyaretPanel(a)`, `ziyaretKatSec(ad)`, `ziyaretKarar(evet)`,
`ziyaretDon(hizli)`, `ziyaretUgurla()`, `ziyaretAyar(acik)`, `ziyaretKod()`, `ziyaretEsles(adres, port, kod)`, `ziyaretSunucu()`.
17 Ekim doğrulaması: sunucu 60 uç testi (imza/zaman/tekrar/sürüm/kod kilidi/özel ağ/gövde/hız/Origin/dosya sunmama/sızıntı yok/kopma), 15 süre testi (kod ve istek süresi, hareketsizlik,
bayat anlık görüntü, kalıcılık, bozuk dosya) ve iki pencereli başsız Edge ile 52 uçtan uca adım; ziyaret hiç kullanılmadığında `yerlesimOzet()` önceki halle birebir (9296 / 90542092) ve 2 dk günde 11/11 çıkış + karne.

**Ziyaret sohbeti (18 Ekim, paket E; `ziyaret.PROTOKOL` = 2)**
- **Kullanım:** ziyaret sürerken (iki tarafta da) Enter ya da T sohbet satırını açar (`#zSohbetKutu`: Modern UI küçük kutu, ≤ 200 karakter, Enter gönderir, Esc kapatır; kutudayken oyun tuşları kapalı); kutu kapalıyken
  1 👋 Merhaba, 2 😄, 3 👍, 4 📍 Buraya gel (göndericinin konumunda ~6 sn işaret, `duzenCiz` kancası). Mesaj göndericinin karakterinde ~5 sn balon (gerçek süre: hızlı günde de), sağ panelde "Ziyaret sohbeti" kartı
  (`#zSohbetKart`: saat · ad · metin; geldi/ayrıldı satırları da). Ev sahibinde balon `konusmaSatiri` ile oda günlüğüne gider (`sesli:false`; sesi aşağıdaki çağrı verir), gelen mesaj `OFIS_SES_AJAN.konus("misafir:<id>", metin, {x, y, oncelik})`
  ile seslendirilir (yoksa atlanır). Ziyaret yokken Enter/T/1-4 eski davranışta (Enter = E). Ziyarette Enter sohbeti açar (E yine etkileşir); Düzenle/gardırop/diyalog/🧠 açıkken kapalı. Misafir gelince/gidince iki tarafta `bildirim` sesi + günlük satırı ("<ad> ofise geldi / ofisten ayrıldı").
- **Taşıma:** misafir → ev sahibi yeni imzalı `/z/mesaj` `{ziyaret, n, tur: m|r|b, t | k}`; ev sahibi kendi artan sıra numarasını (`s`) verir, son 50 mesajı tutar (`sohbet`), misafirlere `/z/an` cevabında dağıtır (`c`: istemcinin
  `gor` değerinden sonrakiler, en çok 30, `ben` = misafirin kısa kimliği; misafir sunucusu `gor`u tutar). Ev sahibi tarayıcısı `yoklama {gor}` ile alır (`c`, `cs`). Gönderici adı ve konumu (b) sunucudan gelir, istemcinin ilanı yok;
  gönderen başına 3 mesaj / 5 sn (429; hız reddinde sıra no harcanmaz), `n` ≤ son n ise `tekrar` (gösterilmez), `_metin` temizliği, tepkiler sabit tablodan. Misafir tarafı gelen listeyi `_mesajlar_temizle` ile doğrular (biçim, uzunluk, artan sıra, `<>`);
  istemci tekrar sıra numarasını (`s`) göstermez ve metni `textContent` ile basar. Yerel uç: `POST /api/ziyaret/mesaj {tur, t | k, x, y}` (ev sahibi yalnız ofiste misafir varken).
- **Sürüm:** protokol 1 ↔ 2 eşleşemez ve ziyaret edemez (`/z/esles` 409 ya da `/z/istek` 409 `surum` → "iki taraf da aynı sürümü kursun"); mevcut eşleşmeler (sırlar) korunur, iki taraf güncelleyince çalışır.
- **Test kancaları:** `ziyaretSohbet()`, `ziyaretYaz(metin)`, `ziyaretTepki(1-4)`. Doğrulama (portlar 8611/8612, ziyaret 8615/8616, keşif 8617): `ofis.pyw` iki örnek + doğrudan imzalı istekler (78 sunucu/birim kontrolü), iki başsız Edge ile 26 uçtan uca kontrol
  (gerçek tuşlar, balon, kart, HTML, hız sınırı, ayrılma, konsol temiz). Çekirdekte değişiklik yok; `ofis.pyw`'de tek satır: `Sunucu.request_queue_size = 128` (sayfa açılışında Windows'ta ERR_CONNECTION_REFUSED).

### Bağlantı denetimi ve dayanıklılık (ziyaret.py > `a_doktor`; Ayarlar > Ziyaret > "Bağlantıyı denetle")
- `a_doktor` hiçbir ayarı değiştirmez; maddeler `{ad, durum: ok|uyari|hata, ayrinti, cozum}`: ziyaret açık/dinliyor, ağ adresi, UDP keşif, Windows ağ profili (Public uyarısı), eşleşmiş her ofisle imzalı `/z/ping` (ulaşım, imza/saat, protokol, harita-atlas-katalog dosya farkı, saat farkı, Ofis sürümü, farklı ağ).
- `yerel_adresler`: varsayılan yolun adresi başta (UDP `connect` ile kaynak adres seçilir), Tailscale (100.64/10) dahil; 169.254 yalnız başka adres yoksa. Ad çözümlemesi tek başına yanlış sırada ve eksik dönüyordu.
- `OZEL_AG`'a 100.64.0.0/10 (Tailscale) eklendi: uzaktaki ofisle elle IP girerek eşleşme/ziyaret; kod, imza ve onay şartları aynen sürer.
- Sürüm özeti: `ozet` (ham, eski eşler) yanında `ozet_n` (satır sonları LF'ye çevrilmiş) gönderilir; `_ozet_uyumlu` ikisini de kabul eder, CRLF/LF farkı "sürüm farklı" yapmaz. `z_ping`/`z_kimlik` ek alanlar (`dosyalar`, `t`, `uygulama_surumu`) eski eşlerce yok sayılır.

## 17 Ekim denetim düzeltmeleri (4. aşama sonrası)
- **Sürüm devri / `/api/kapat`:** artık yalnız `POST`, Host denetimli, `Origin` başlığı varsa 403 ve özel başlık `X-Ofis-Kapat: 1` ister (web sayfası sunucuyu kapatamaz). Yeni başlatıcı eskisini önce POST ile
  kapatır; eski sürümler (GET bilen) 403 verirse tek seferlik GET'e geri düşer. İkisi de sınandı: eski yedek kodu açıkken yeni başlatıcı devraldı; yeni→yeni devir POST ile.
- **Sözlük bakışları:** çekirdekte `sahip(obj, anahtar)` (`hasOwnProperty`): `spr/kaynak/kullaniciEsyasi` ve ziyaret `duzenGuvenli` prototip adlarını (`constructor`, `__proto__`…) tanımaz; `dongu` her karede
  `try/finally` ile rAF'i yeniden kurar (hata konsola bir kez yazılır). Sunucuda `duzen_dogrula` eşya anahtarını desenle (`kat:<kategori>/<no>`, atlas adı, `hk.`, `C.ad(arg)`, `birlesik:`, `masaKur:`) sınırlar,
  `__` ve prototip adlarını reddeder.
- **Metin temizliği:** sunucuda `_metin` (ofis.pyw ve ziyaret.py) eşleşmemiş vekil karakterleri, kontrol/sıfır genişlikli karakterleri ve `<>`'ü atar; JSON cevapları `ensure_ascii=True`; günlük `errors="replace"`;
  `kisi.js` adları aynı şekilde temizler ve `secAjan` HTML kaçışı yapar.
- **Paketleme taraması (`araclar/paketle.py`):** iki taraf NFKD + diyakritik silme + ı/İ/I→i ile normalleştirilir, sıfır genişlikli karakterler atılır, kelime sınırı harf/rakam dışıdır ve camelCase bölünür
  (`portre_ad`, `oyuncuAd`, `ad_x.js`, bitişik tam ad); dosyalar BOM/UTF-16/32/cp1254 tespitiyle okunur, `\uXXXX` kaçışları çözülür; Windows kullanıcı adı ve ev klasörü adı yasaklıdır; durum dosyaları
  (kisi/eslesmeler/duzen/gorunum/ziyaret .json, gunluk.txt) hiç pakete girmez. Dar istisnalar (ortak sözcük, Python anahtar sözcüğü, tanımlayıcı parçası) `araclar/paketle.py` başlığında yazılıdır.
- **Kurulum:** `kur.py` bozuk `kisi.json`'u `kisi.json.bozuk-<zaman>` olarak saklar; geçersiz `--vault` eski geçerli değeri silmez. `Kur.bat` kur.py'nin çıkış kodunu korur.

## Kişi ve oda kartları (`moduller/kartlar.js`, `hikayeler.js`; 18 Ekim gecesi, paket B)
- **Kişi kartı:** ajana (oyuncu ve Sütlaç hariç) tıklayınca haritanın sol üstünde `#kisiKart` (Modern UI `.cerceve`, kabuk `index.html`'de, içerik JS'te) açılır; aynı anda tek kart (oda kartı gizlenir).
  Portre (`img.portre[id]` ya da sprite karesi; konuşurken Ada/oyuncu portresi animasyonlu), ad, rol, "ruh hali · şu an ne yapıyor", **kamera takibi** düğmesi, tanıtım cümlesi,
  açılır "Hikâyesi ve ilişkileri", ihtiyaç çubukları, "Konuş". Değerler ~2 Hz canlı. Eski tıkla-yürü-konuş artık "Konuş" düğmesinde (`ic.gonder` + `ic.diyalogAc`); E tuşu aynı kaldı.
- **"Ne yapıyor"** (`OFIS_KART.durum(a)`): çekirdek durumundan hesaplanır, öncelik: `disarda/cikti` → `a.rut` (gelis/toplanti/ogle/aksam/cikis) → `OFIS_YASAM.sohbette` (+ yakındaki eş) → `a.konusuyor` →
  `a.ozel` (kahve, mola + oturak, dedikodu=sebil, beyin, olay/gorev: yolun son karosundan "yazıcıya/kahveye/X'in yanına/<oda>ya gidiyor") → `telefonSon` → kedi klavyede → `a.oturak` → yürüyor (hedef) → `yerinde` (masasında çalışıyor/yazıyor).
  Yeni `rut`/`ozel` adı eklenirse bu fonksiyona bir satır ekle; bilinmeyen değer sessizce bir sonraki kurala düşer.
- **Kamera takibi:** kart açılınca (yakın kamera kapalıysa açarak) `OFIS_IC.kameraTakip = ajan`; düğme aç/kapat, kart kapanınca (✕, Esc, başka kart, "Konuş"), oyuncu hareket tuşuna basınca (`tusGozle`)
  ya da zemine tıklayınca bırakılır; kartın açtığı yakın kamera geri kapatılır. Uzak modda takip yok.
- **Hikâye verisi:** `hikayeler.js` `window.OFIS_HIKAYE[ajanId] = {tanitim, hikaye}`; metinde `{ajan.<id>[:ek]}`, `{oyuncu}`, `{asistan}` (kartlar `OFIS_KISI.metin` ile çözer; gerçek kişi adı yok). Arkadaşlar/şakalar/kedi gözdesi
  `OFIS_YASAM.arkadaslari` ve `DEMO.iliskiler`'den okunur. Çubuklar `OFIS_YASAM.ihtiyaclar(a)` (yoksa `a.ih` enerji/sosyallik).
- **Oda kartı:** `#odaKart`; oda **duvar şeridi** (ilk 2 satır, yürünemeyen karo), odanın sol altında yazan **ad tabelası** ya da **mini haritada** odaya tıklayınca açılır (imleç pointer olur). Canlı görüntü: `OFIS_IC.f.canvas`
  (kare tuvali) oda dikdörtgeni ~4 Hz kırpılır (dar/uzun odada ajanlar renkli nokta, yeterince büyükse ad; `__ofis.odaIsik()` varsa o kadar karartılır). İÇERİDE listesi (oyuncu "(sen)", ajanlar, Sütlaç; ada tıklayınca kişi kartı),
  yönetim odasında "Masada bekleyen onay: N", oda günlüğü (`OFIS_YASAM.odaGunlugu(id, 30)`; yoksa/boşsa "Henüz konuşma yok."), "Oraya git" (`OFIS_MINI.git`, mini-harita.js). Oda kimlikleri gerçekte `beyin` (Arşiv) ve `merkez` (Haber merkezi);
  tasarım adları `arsiv`/`haber` takma ad olarak kabul edilir. Ses motoru açıksa "Ekrandaki konuşmalar sırayla sesli…" satırı görünür (`OFIS_SES_AJAN.acik()`).
- **Bağlantı:** yalnız MOD kancaları `tikla, fareHareket, tus, tusGozle`; `moduller/mini-harita.js` tıklamayı `e.miniTik` bayrağıyla işaretler (kartlar aynı tıklamada haritanın altındaki ajanı okumasın) ve `window.OFIS_MINI.git` sunar.
  Düzenle/Gardırop/Sohbet/Ziyaret paneli açıkken kart açılmaz, açıksa kapanır. `window.OFIS_KART` {kisiAc, odaAc, kapat, kisi, oda, renk, durum}. Çekirdekte tek satır: `OFIS_IC`'ye `diyalogAc` eklendi.
  Uzak modda ev sahibinin ajanları için kart açılır; hikâye, çubuk, günlük, takip ve Konuş gizli/kapalı; uzak durum değişirse kart kapanır.
- **Test:** `__ofis.kartKisi(id)`, `kartOda(id)`, `kartKapat()`, `kartOzet()` (ad, rol, durum, takip, çubuklar, içeridekiler, görünüm özeti, `sigar`: kart sahne içinde ve yatay taşma yok). 18 Ekim: 11 ajanın kartı, 9 oda, gerçek fare tıklamaları
  (ajan, duvar, tabela, mini harita), takip aç/kapat/Esc/W tuşu/zemin tıklaması, 800x700/800x520/600x600 pencere, sentetik uzak mod (`uzakGir/uzakAn/uzakCik`) hatasız.

## Ajan sesleri (yerel TTS; gece sürümü, paket D)
- **Sunucu** `ses_motoru.py` (`kur(VERI, KOK, VAULT, KISI, gunluk)` → `api(alt_yol, govde, yontem)`; `ofis.pyw` `EKLER["ses"]` olarak kurar): `GET /api/ses/durum`, `POST uret {metin, hiz?, bekle_sn?}` (200 `audio/wav` ya da 202 `{bekle, yukleniyor}`),
  `POST isit`, `POST durdur`. Motor EMA Lightning, kalıcı işçi `ses_isci.py` (EMA venv'inin Python'uyla, `-I`, `HF_HUB_OFFLINE=1`; stdin JSON satırı → 24 kHz WAV dosyası → stdout JSON satırı; model ilk istekte yüklenir, ~20 sn).
  Python yolu: `KISI["ses_python"]` (kisi_dogrula bilinmeyen alanı attığından pratikte yok) → `VERI/ses.json > python` → `<VAULT>/.claude/tools/ema/.venv/Scripts/python.exe`; hiçbiri yoksa `durum.var=false`, istemci hiç istek atmaz.
  Önbellek `VERI/ses/<sha1(motor|hiz|metin)>.wav` (300 MB üstünde en eskiler 240 MB'a dek silinir, yeni dosya korunur); metin `metin_temizle` (emoji/sembol/biçim atılır, ≤ 240 karakter); tek üretici iş parçacığı + kuyruk (en çok 8, aynı metin aynı işe katılır);
  çöken işçi bir kez yeniden açılır; 10 dk boşta kapanır; ofis kapanınca (atexit ya da stdin EOF) işçi de kapanır. Hata/zaman aşımı JSON.
- **İstemci** `moduller/konusma-ses.js`: `konusmaSatiri` kancasını dinler, **yalnız kamera görüşündeki** satırları alır (alırsa `ajan.sesli = true`; çekirdek `konus()` o satır için sentez mırıltısını çalmaz, ses gelmezse eski mırıltıya düşer),
  tek ses sırayla, bekleyen ≤ 3, 8 sn'den bayat atlanır; ses önceden üretilir. Ses `SES.baglanti()` (ses.js, `{ctx, cikis: ana}`) ile ana bus'a bağlanır: kaynak → alçak raf → tiz raf → alçak geçiren → kazanç → StereoPanner.
  Kazanç dinleyiciye (`OFIS_IC.dinleyici()`) uzaklıkla: ≤ 3 karo 1,0, sonra `1/(1+(m-3)·0,16)`; başka oda ×0,4 ve 1,3 kHz alçak geçiren; pan `dx/14·0,9`; konuşan yürürken 90 ms'de bir güncellenir; konuşurken balon sürer.
  Ayarlar > "Ajan sesleri" (aç/kapat, seviye, gerçek sohbet cevaplarını sesli oku; `localStorage["ofis-konusma-ses-1"]`). Ses motoru yoksa bölüm "bulunamadı" der. Header'daki "Sesi aç" kapalıysa ajanlar sessiz.
- **Profil** (`PROFIL`; perde = `playbackRate`, tempo = net konuşma hızı, sunucuya istenen hız `tempo/perde`; ton/parlak = alçak/tiz raf dB): ada 1,00/1,00 (doğal), oyuncu 0,93, muhabir1 1,05, muhabir2 1,14, postaci 1,10, tarayici 0,90, analist 0,94, editor 0,98,
  denetci 0,87, sosyal 1,12, spiker 0,96, dagitici 1,03; bilinmeyen (`misafir:<id>`) kimlikten türetilmiş sapmalı varsayılan misafir profili.
- **Dışa açılan** `window.OFIS_SES_AJAN = {konus(ajanId, metin, {x, y, oda, oncelik}), acik(), durum(), cevap(ajanId, metin)}` (ziyaret sohbeti `konus`'u, `sohbet.js` bitince `cevap`'ı çağırır; `oncelik > 0` görüş denetimini atlar ve sıranın önüne geçer; `kanal` verilirse aynı kanaldaki sıradaki satır atılır, çalan satır kısa sönümle durur).
- **Diyalog kutusu** (`E`): `ofis.js > diyalogSesi(a, metin)` selamı, seçenek cevabını ve özel diyalog metnini `konus(a.id, metin, {x, y, oncelik: 1, kanal: "diyalog"})` ile seslendirir (yeni seçim eski cevabı keser); ses modülü satırı almazsa eski `konus` mırıltısı.
- Çekirdekte iki küçük değişiklik: `ofis.js > konus()` mırıltıyı `MOD("konusmaSatiri")`'ndan sonra ve yalnız `!a.sesli` iken çalar; `ses.js` `baglanti()`. `__ofis` kancaları: `sesAjanDurum()`, `sesAjanDene(id, metin, zorla)`, `sesAjanAyar(k, v)`, `sesAjanProfil(id)`, `sesAjanYokla()`.
- Test: `py -3 ofis.pyw --tarayicisiz --port 8604 --veri %TEMP%\ofis-D` (sunucu 3 dk sayfadan nabız gelmezse kapanır); başsız Edge ile `SES.ac()` sonra `OFIS_IC.konus(ajan, metin)`. Ölçüm (RTX 3060): soğuk ilk üretim ~22 sn (model yükleme), sıcak ~0,3-0,4 sn/cümle, önbellek isabeti ~20 ms; sayfadan ilk satır ~0,9 sn, önbellekli ~0,16 sn.

## Ofis bilgisayarı: BeyinOS (`os_veri.py`, `moduller/bilgisayar.js`; 18 Ekim)
- **Açılış (mizansen):** oyuncunun masasında (`HARITA.noktalar.oyuncu`, r 1,35) E → "💻 Bilgisayarı aç": oyuncu sandalyeye yürür, monitöre döner, `yazSon` ile klavyede yazar; ekran `.sahne` üstünde oyuncunun monitöründen büyür
  (`transform-origin` = `monitorler` içindeki `sahip: "oyuncu"` ekranı), açılış sesi (ses.js ana bus'ında sentez), sayfa başına bir kez BIOS benzeri açılış ekranı (gerçek sayılarla), sonra piksel masaüstü. Esc pencereyi, sonra bilgisayarı kapatır (CRT kapanma animasyonu).
  Açıkken oyun tuşları tüketilir (`tus` kancası true). Masanın önündeki "Odak başlat" noktası (18, 7,6) yerinde; Odak ayrıca bir uygulama. Ziyaretteyken (`body.uzak`) açılmaz.
- **Masaüstü:** simgeler (sayaç rozetleri), sağda profil kartı (seviye/XP: biten iş ×20, oturum ×10, fikir ×4, aktif hedef ×6, seri ×15; seviye = ⌊√(XP/60)⌋+1; yalnız gösterim, hiçbir yere yazılmaz), "günün görevleri" (gecikmiş/süren iş, en yakın hedef, posta, ekibe mesaj), rozetler, özet; alt çubuk (Kapat, açık uygulama, 🔔 → Posta, saat).
  Yerleşim bilgisayar ekranının kendi genişliğine göre (`container: boscam`): < 860 px pencere tam genişlik, < 620 px yan kartlar gizli.
- **Uygulamalar:** Hedefler (kalan gün, ölçüt, son ilerleme satırı, "Sıradaki adım?"), İşler (filtre: hepsi/süren/gelen/biten; projeye göre gruplu), Fikirler (arama, "hayata geçti" rozeti), Yaptıklarım (seri, Last-Session kartları güne göre, son biten işler),
  Posta (özet notu bölümleri; her madde "Ne yapayım?" / "Göreve çevir"), Mesajlar, Projeler (`projeler/*/README.md`), Odak (`MOD("odakBaslat")`), Ayarlar (doğrudan kayıt anahtarı, kaynak yolları). "💬" düğmeleri Mesajlar'ı ilgili ajan ve hazır metinle açar.
- **Sunucu** `os_veri.py` (`EKLER["os"]`, salt-okur): `GET /api/os/ozet` → `{hedefler, fikirler, isler, bitenler, yapilanlar, posta, projeler, sayilar {hedef, fikir, acik, biten, oturum, seri, posta, gecikti}, kaynaklar}` (45 sn önbellek), `POST /api/os/yenile`,
  `GET/POST /api/os/ayar {dogrudan}`. Kaynak yolları `VERI/os.json {hedefler, fikirler, posta}` (vault içi göreli); yoksa `notes/hedefler` (bulunamazsa `notes/` altında 3 düzeye kadar ilk `hedefler` klasörü), `notes/fikirler.md` ("## Başlık (tarih)" bölümleri, en yeni üstte), `notes/posta/ozet.md`.
  Hedef ön yazısı JSON ya da "anahtar: değer" (baslik/title, durum, son_tarih/due, oncelik, olcut, tur, neden; gövdede "## İlerleme"). `/api/os` tablet izin listesinde yok.
- **Mesajlar:** ajana `/api/sor` `{kaynak: "os"}`; sunucu sistem istemine `OsVeri.baglam()` (kayıt yerleri: fikir → fikir dosyasına `ekle`, hedef → hedef klasörüne `not`, iş → `tasks/`) ekler. **Doğrudan kayıt** (`VERI/os-ayar.json {"dogrudan": true}`, VARSAYILAN KAPALI; tablette ve tam yetenek kipinde uygulanmaz):
  öneri onay kartı beklemeden `oneri_uygula` ile yazılır (en çok 3; `oneri_dogrula` aynı: yalnız notes/ ve tasks/, üzerine yazmadan), imza "ofis bilgisayarından; <ad> mesajla istedi", `bitti.oneriler[] = {kaydedildi, tur, yol, baslik}`. Kapalıyken onay kartı (`/api/onay`).
  Kayıt olunca XP uçar, veri yenilenir; ajan müsaitse "📄 Kaydettim" deyip oyuncunun masasına yürür, "Masana bıraktım" der, yerine döner. Konuşmalar ajan başına `localStorage["ofis-bilgisayar-mesaj-1"]` (son 30), oturum devamı sayfa açık oldukça.
- **Posta özeti:** ofis Gmail'e bağlanmaz. Claude masaüstündeki zamanlanmış bir görev (kişiye özel, depoda değil) her sabah Gmail'i salt-okur tarayıp `notes/posta/ozet.md`'yi yazar: JSON ön yazı + "## Cevap bekleyenler / Son tarihli işler / Takvim / Bilgi" bölümleri, "- " maddeleri. 30 saatten eski özet "eski" diye işaretlenir.
- **Görünüm (piksel-modern):** Ayarlar > Görünüm (`localStorage["ofis-bilgisayar-gorunum-1"] {tema, yazi, duvar}`): tema koyu / açık / otomatik (ofis saati `dakika()`: gün ve şafak açık, akşam ve gece koyu),
  yazı modern (gövde Segoe UI / system-ui, başlıklar Pixelify Sans) ya da piksel (her şey Pixelify + CRT tarama çizgileri), duvar kâğıdı saate göre gök (gece yıldız + ay, şafak, gün + güneş, akşam; `clip-path` ile basamaklı piksel tepeler) ya da düz.
  Renkler `#bos` üzerindeki `--os-*` değişkenlerinden (`data-tema`), vurgu ofis temasının `--vurgu`'su. `saatYaz` (15 sn) temayı ve gökü yeniler.
- **Modern OS:** alt ortada cam dock (başlat/ara, uygulamalar: açık = nokta, öndeki = vurgu çizgisi, tıkla aç / öne getir / küçült; tema düğmesi, zil, saat, kapat); masaüstü bileşenleri saat, profil, sıradaki iş
  (geciken + süren ilk 3), günün görevleri, odak (25 dk), rozetler. Birden çok pencere (`pencereler` Map; `uygulama` = öndeki): başlıktan sürükle, – küçült, ▢ / başlığa çift tık büyüt, ✕ kapat; her pencere tam ekran (büyütülmüş) açılır, ▢ / çift tık küçük boyuta alır.
  Arama Ctrl+Space / Ctrl+K (ya da dock): uygulamalar + yüklü `/api/os/ozet` verisi (hedef, iş, biten, fikir, proje, yaptıklarım, posta maddesi; sunucuya ayrı istek yok), ↑↓ Enter; son satır "Ada'ya sor" mesajı gönderir.
  Bildirimler: sağ üstten kayan baloncuk (ajan cevabı okunmuyorsa, kayıt, açılışta geciken iş / posta) + zil menüsü (son 20, sayfa oturumuyla sınırlı). Esc sırası: arama → zil menüsü → öndeki pencere → bilgisayar.
- **Terminal** (`terminalCiz`, `termGonder`): Ada'ya `/api/sor` (ajan ada, ayrı oturum, model seçilebilir); `basla` → model satırı, `arac` → "↳ Read …" log satırı, metin akarak yazılır; öneri kartı (`/api/onay`) ve tam yetenek kipinde
  kritik iş kartı ("⚠ Emin misin?", `/api/kritik`; Evet → işi aynen yeniden iste) satır içinde. Komutlar: yardım, temizle (Ctrl+L), yeni, model <ad>; ↑↓ geçmiş, Ctrl+C `/api/iptal`. Tema ne olursa olsun koyu.
- **Sütlaç Koşusu** (`oyunCiz`): 22×14 karo yılan; Sütlaç başı, fareler, yumak gövde; yön tuşları/WASD, Boşluk/P başla-duraklat, pencere küçülünce duraklar; rekor `localStorage["ofis-sutlac-rekor"]`.
- **Sürprizler:** soluk "çok gizli" masaüstü klasörü (dock'ta yok, aramada yalnız "gizli" yazınca; şifre "Sütlaç", yanlışta artan ipuçları; içinde ajan adlarıyla kurgusal komik notlar); ekran koruyucu (boşta gece 02-05 25 sn,
  gündüz 3 dk; yüzen Sütlaç; hareket/tuş kapatır); 02:00-05:00 açılışta (gecede bir kez, `localStorage["ofis-gece-uyari-<gün>"]`) Ada bildirim + oyunda "Uyuman lazım", 10 sn sonra koruyucu; bilgisayar açıkken ~2,5 dk'da bir
  %10 olasılıkla Sütlaç oyuncunun klavyesine çıkar (`MOD("kediOyuncuKlavye", masa)` → sutlac.js), "🐾 Sütlaç klavyenin üstünde" kartı anlamsız harfler yazar, öndeki pencerenin yazı alanına da ekler (göndermez); "Sev ve indir" ya da süre bitince iner.
- Dışa: `window.OFIS_BILGISAYAR {ac, kapat, acik, uygulama(id)}`. Test: `__ofis.bilgisayar()`, `bilgisayarAc()`, `bilgisayarKapat()`, `bilgisayarUyg(id)`, `bilgisayarYenile()`, `bilgisayarAra(q)`, `bilgisayarGorunum(k, v)`, `bilgisayarBildir(b, m)`, `bilgisayarKoruyucu(acik)`, `bilgisayarPati()`, `bilgisayarGece()`, `bilgisayarTerminal(metin)`, `bilgisayarMesaj(ajan, metin)`.

## Ortam sohbetleri (`sohbetler.js`, `moduller/sohbet-ortam.js`; 18 Ekim gecesi, paket C)
- `sohbetler.js` `window.SOHBETLER`: 87 çok satırlı (4-8 satır, ≤ 90 karakter) kurgusal sohbet; alanlar dosya başında: `yer` (sebil, kahve, mutfak, toplanti, komsu), `dilim` (sabah/ogle/aksam/gece),
  `a b c` rol yuvaları (ajan id listesi), `iliski` (arkadas | rekabet = `iliskiler.gerilim`), `etiket`, `ruh`, satırlar `"a: metin"`. Yer tutucular `{a} {b} {c} {kedi} {saat}` (+ek: `{kedi:a}`) ve KISI'nin `{oyuncu} {asistan} {ajan.id:ek}`.
- Modül: aralıklarla (hızlı gün 12-26 sn, gerçek saat 10-22 dk, gece 25-50 sn / 25-55 dk) boştaki 2-3 ajanı seçer (`ata`: yuva, ilişki, masa komşuluğu; `skor`: tokluk/kahve/ruh ağırlığı, son konuşanlar geride),
  `ozel = "sohbet"` ile meşgul eder, buluşturur (sebil/kahve/mutfak noktaları; toplantı sonrası biri ötekinin masasına yürür; komşular yerinde), satırları 2-4 sn arayla `konus(…, true)` ile söyletir,
  sonunda `MOD("sohbetEtti")` + kahve/yemek doldurur, masaya döndürür. Rutin, olay ya da oyuncu diyaloğu ajanı alırsa sohbet kesilir (rutin ise kalan biri "sonra devam" der). Aynı sohbet günde bir kez (`bastan` sıfırlar).
  Sebil dedikodusuyla (surprizler.js) ayrı: `mesgul` ile aynı ajanı almaz, yakınında dedikodu/sohbet varsa yer değiştirir.
- `OFIS_YASAM`: `sohbette(a)` (konu | null), `sohbetOrtaklari(a)`, `odaGunlugu(odaId, n)` (`konusmaSatiri` kancası; oda kimlikleri gerçek: `beyin`, `merkez`…; `arsiv`/`haber` takma olarak kabul), `gunAyraci()`
  ("— gün bitti —"; `bastan` ve `ofisKapandi` kancasında da çağrılır). Test: `sohbetBaslat(id?)`, `sohbetler()`, `odaGunlugu(id)`, `ihtiyac(id)`, `ihtiyacAyarla(id, {…})`, `sohbetDurum()`, `sohbetSayac(n)`, `sohbetDogrula()` (tüm veride yer tutucu/uzunluk denetimi).
- `ihtiyac.js` bekçisi: işsiz ama masasından kesirli konumda takılan ajanı (surprizler.js dedikodu dönüşündeki çifte `eveDon` boş A* yolu verir) ~7 sn sonra masasına oturtur.
- 18 Ekim doğrulaması: gerçek saatte 08:00→01:30 tam gün 62 sohbet, tekrar 0, sızan `ozel` 0, takılı ajan 0, toplantılar 10/15/22, akşam yemeği; hızlı 2 dk günde sohbetler, oda günlüğü ve ayraçlar; konsol temiz.

## Gerçek veri (salt-okur, 18 Ekim)
- `gercek_veri.py` (`EKLER["gercek"]`): `GET /api/gercek/ozet` → `{guncel, gorevler[{id, baslik, durum, proje, yol, son, gecikti, bugun}], basliklar (Threads.md "Active Threads" altındaki ### başlıkları, ≤6),
  son_oturum {baslik, ozet ≤300} (Last-Session.md'deki en üst kart), sayilar {acik, bugun, gecikti}}`, `POST /api/gercek/yenile` önbelleği atlar. Önbellek 60 sn; görev dosyası ≤64 KB, ≤600 dosya, cevapta ≤40 görev;
  hata `{hata}`. Kaynaklar: `tasks/*.md` (JSON ön yazı; ön yazısı olmayan/bozuk dosya atlanır; done/cancelled sayılmaz), companion klasörü (`...Companion`, `kisi_yukle` gibi bulunur). Son tarih yalnız
  yapısal alanlardan (`due, due_date, son, son_tarih, deadline, bitis`; YYYY-MM-DD ile başlamalı); gövdeden tarih ayıklanmaz. Bu vault'ta görevlerde tarih alanı yok: gecikti/bugün 0, "süren iş" = `active`/`doing`.
- `moduller/gercek.js`: açılışta ve 5 dk'da çeker (anahtar meta yoksa = düz http.server, ya da `body.uzak`: hiç çalışmaz, kart gizli). Panelde "Günün işleri"nin üstünde "Bugün (gerçek)" kartı (gecikmiş/bugün/süren, ≤6 satır; tıklayınca
  tam başlık + dosya yolu). Sabah brifingi: çekirdek `brifingGoster` `MOD("brifingVeri")` sonucunu `V.brifing`'e tercih eder (modül HTML kaçışlar; veri/ayar yoksa `undefined` → kurgusal). Gün başına bir evrak uyarısı
  (`localStorage["ofis-gercek-uyari-1"]`): gecikmiş/bugün biten görev varsa uygun ajan (radar/chart projesi → `tarayici`, değilse `postaci`, ikisi de meşgulse `ada`) oyuncuya yürür, balonda "<başlık> bugün bitiyor / süresi geçti".
  Oda kartı (Gündem masası) "Masada bekleyen iş: N" (`OFIS_GERCEK.sayi()`). Ayarlar > "Gerçek veri": aç/kapat (`localStorage["ofis-gercek-1"]`, varsayılan açık), "Şimdi yenile". Test: `__ofis.gercek()`, `gercekYenile()`, `gercekUyari()`.
- Gizlilik: gerçek metin yalnız yerel ekrana ve yerel oda günlüğü/sese gider; `ziyaret.js > anYap` yalnız sayı/kimlik taşır (balon 0/1/2, görev/brifing yok), ziyaret dinleyicisine hiçbir gerçek veri gitmez.

## Birleşik sürüm 0.10.0 (iki geliştirme kolunun birleşimi: arayüz/etkileşim kolu + gece sürümü; ziyaret protokolü 3)
İki sürüm (arayüz, tablet ve etkileşim kolu ile gece sürümü) ortak ataktan ayrılmıştı; 0.10.0 ikisini birleştirir. Birleştirme kararları (`KARAR-LISTESI.md`): tek "Bugün" kartı, Ofisi kapat öncesi gün kapatma konuşması,
ikinci beyne yazma ayarı (varsayılan kapalı), tablet kapısı (varsayılan kapalı), nabız 30 dk, varsayılan model Haiku, yerel pano. Kişiye özel her şey çekirdekten çıktı (aşağıda "Kişisel katman").
**Ziyaret için iki tarafın da 0.10.0 olması gerekir** (`ziyaret.PROTOKOL = 3`; harita özeti de değişti: monitör arkası ve toplantı koltuğu hizası `harita/ofis.tmj` içinde kalıcı).

- **Bugün kartı** (`moduller/panel.js` + `moduller/gercek.js` + `panel.py`): tek kart, iki kaynak. İş listesi HER ZAMAN dosyadan gelir (`gercek_veri.py`: vault `tasks/`, ücretsiz). Maddeye (kutuya) dokununca tik atılır;
  tik sunucuda `VERI/panel-isaret.json`'da tutulur (`g:<iş id>` anahtarıyla, yalnız o gün için geçerli; `panel.py > Panel.isaretle` bilinen işlere yazar). **Haiku katmanı** (`panel.py`, Ayarlar > İkinci beyin >
  "Haiku ile brifing ve konuşmalar", `VERI/panel-ayar.json {"acik": true}`; VARSAYILAN KAPALI): açıksa `claude -p --model haiku` (salt-okur Read/Grep/Glob) 4 saatte bir ya da kaynak notlar değişince çalışır ve
  `VERI/panel.json` + `konusma.json` yazar; brifinge ek satırlar, TV manşeti, çalışan diyalogları (eylem seçenekleri korunur) ve ortam sohbetlerine "taze konu" (`window.SOHBETLER_TAZE`; `sohbet-ortam.js > liste()`
  elle yazılmış havuza ekler, `skor` 2,5 kat ağırlık verir) eklenir. Dosyadan iş yoksa Haiku'nun işleri listeyi doldurur. Elle yazılmış `sohbetler.js` her zaman temel kalır (Claude'suz ofis sessiz kalmaz).
  Haiku süreci `Panel.kapat()` ile (atexit ve sunucu kapanışı) sonlandırılır. Yasak konular genel varsayılan; kişiye özelleştirme `kisi.json > panel_yasak_konular`.
- **Gün kapatma** (`moduller/etkilesim.js > gunKapatma`, çekirdek `ofis.js` "🌙 Ofisi kapat" düğmesi): düğme önce `MOD("gunKapatma", bitir)` çağırır; Ada oyuncunun yanına gelir, "Bugün" kartındaki biten işleri ve yarının ilk adımını söyler.
  "Tamam, ofisi kapat" (ya da seçim yapmadan konuşmayı geçmek) `ofisKapat("kullanici")`: karne, çıkış, kapalı. "Biraz daha kalayım" vazgeçirir. Ada yoksa/meşgulse eski onay kutusu açılır. Yedek otomatik kapanışta (`ofisKapat("oto")`) konuşma yoktur.
  **Saat ayarı** (`saatAyarla/saatSifirla`, Ayarlar > "Ofis saatini ayarla (test)"): gerçek saatte `saatOfset`'i kaydırır (test kancası `__ofis.zamanAyarla` ile aynı mekanizma), açılış saati (`ACILIS`) ve gece yarısından sonrası (01:00 = 1500) ile uyumlu.
- **İkinci beyne kayıt** (`ofis.pyw > ofis_notu_ekle`, `sohbet_kaydet`, `olay_kaydet`): sohbet, odak, gün kapatma ve tik olayları `notes/ofis-sohbet/<gün>.md` dosyasına (yalnız ekleme, ham kayıt) YALNIZ Ayarlar > "Konuşmaları ikinci beyne kaydet" açıksa
  (`VERI/sohbet-kayit.json {"acik": true}`; varsayılan KAPALI; sunucu tarafı da kapalıyken yazmaz). İki anahtar `GET/POST /api/ayar-sunucu` ile yönetilir (tablet kapısından erişilemez).
- **Tam yetenek kipi** (`ofis.pyw > tam_acik`, `tam_ayarla`, `sor(..., tablet)`): VARSAYILAN KAPALI (`VERI/tam-yetenek.json {"acik": true}`; Ayarlar > "Tam yetenek", onay penceresiyle). Açıkken YALNIZ yerel pencereden gelen sohbetlerde `claude` vault klasöründe (cwd = VAULT; AGENTS.md ve kancalar yüklenir) ve varsayılan Sonnet ile çalışır; Edit/Write/Bash/WebFetch/WebSearch açılır, onay kartı (`<oneri>`) kullanılmaz. `TabletIsleyici.TABLET_KAPISI = True` olduğundan tablet kapısından gelen `/api/sor` kısıtlı kipte kalır; ancak ayrı "Tabletten de tam yetenek" anahtarı (`tam-yetenek.json` > `tablet`, varsayılan KAPALI, onay penceresiyle) açıldıysa o da tam yetenek alır (PIN'i bilen herkes komut çalıştırabilir). Oturumlar cwd'ye bağlı olduğundan `_tam_oturumlar` ile kipler arası `--resume` yapılmaz. Sistem istemine her iki kipte de "Şu an: gün tarih saat" satırı eklenir.
- **Kritik iş kilidi** (`araclar/kritik_kanca.py`, `ofis.pyw > kritik_ayar, kritik_bekleyen, kritik_karar`, `/api/kritik`, `sohbet.js > kritikKart`): tam kipte `claude`'a `--settings VERI/kritik-ayar.json` ile PreToolUse kancası verilir.
  Kanca Bash/PowerShell'de silme (rm, del, Remove-Item, `-delete`…), git push/reset/clean/rebase/config/commit --amend, ağa çıkan komut (curl, wget, Invoke-WebRequest, ssh, scp…), `gh` yazma işleri, paket yayınlama/kurma, sistem komutları ve satır içi kod (`py -c`, `cmd /c`, `powershell -Command`…); Write/Edit'te vault dışına yazmayı REDDEDER
  ve `VERI/kritik.json > bekleyen`'e (çağrı kimliği `OFIS_KOSU` ile) yazar. Sohbet bitince `bitti.kritik` gelir, sohbette "⚠ Emin misin?" kartı komutu/yolu birebir gösterir. "Evet, eminim": `/api/kritik` işin özetini (araç + birebir metin, sha256) `onayli`'ya koyar, iş 10 dk içinde BİR KEZ geçer
  ve sohbet "Onayladım…" mesajıyla kendiliğinden sürer; "Hayır": çalışmaz. Tablet kapısından `/api/kritik` yalnız "Tabletten de tam yetenek" açıksa. En iyi çaba kilidi: kazara ya da dosyadaki gizli talimatla yapılan kritik işi durdurur, modelin yazıp çalıştırdığı betiğin içini denetlemez.
- **Tablet / telefon kapısı** (`ofis.pyw > TabletSunucu, TabletIsleyici, tablet_*`): ayrı dinleyici `0.0.0.0:8547`, yalnız özel ağ ve Tailscale adresleri (10/8, 172.16/12, 192.168/16, 100.64/10), 6 haneli PIN, Ayarlar > Tablet / telefon (VARSAYILAN KAPALI).
  Ziyaret dinleyicisinden alınan denetimler: özel ağ denetimi, IP başına istek hız sınırı (`ziyaret.Hiz`: oturumlu 30/sn kapasite 600; girişsiz ve `/giris` 3 sn'de 1), toplam (48) ve IP başına (16) eşzamanlı bağlantı sınırı, 15 sn okuma zaman aşımı (slowloris),
  gövde sınırı (`/giris` 2 KB, diğerleri 200 KB), `Origin` denetimi (`/giris` dahil), yalnız IP ile `Host` (DNS yeniden bağlama), PIN `compare_digest`, 5 yanlışta 5 dk kilit, çerez `HttpOnly; SameSite=Strict` (ömür 14 gün; PIN yenilenince tüm oturumlar düşer),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`. API **izin listesi** (`TABLET_IZINLI_API`): durum, sor, iptal, onay, duzen, gorunum, nabiz, pano, panel, gercek, ofis-kayit. `/api/tablet`, `/api/kapat`, `/api/ziyaret`, `/api/guncelleme`, `/api/ses`,
  `/api/ayar-sunucu` tablette yoktur. `manifest.webmanifest` + simgeler (`varliklar/ofis-*.png`, yoksa simgesiz) ana ekrana ekleme içindir.
- **Dokunmatik ve Apple Pencil** (`moduller/dokunmatik.js`, `ofis.js > tiklaIsle`): `pointerup` ile hemen işlenir, aynı dokunuştan gelen `click` 600 ms yok sayılır, 14 px'ten fazla sürükleme tıklama sayılmaz; haritaya dokun = yürü, eşyaya/oturağa dokun = yanına gidip kullan,
  karaktere ya da E etiketine dokun = E. Dokunmatikte mini harita varsayılan kapalı; `html.dokunmatik` sınıfı büyük hedefler ve güvenli alan boşlukları verir. Yapay `PointerEvent` ile test edilir (touch/pen).
- **Etkileşimler ve odak modu** (`moduller/etkilesim.js`): cozy mod (lamba/şömine/ışık dizisi), kitaplık, çerçeve, buzdolabı, mikrodalga, sunum ekranı (yaklaşan tarihler), tahta, telsiz, halıda dinlenme, gizli kelimeler (liste `SURPRIZLER.md` 23-38).
  Odak modu (pomodoro, 18 Ekim): 25 dk odak → 5 dk mola, 4 turda bir 15 dk uzun mola (`odak {faz: odak|mola, tur, uzun, bitis, gorev}`, `localStorage["ofis-odak"]`, yenilemede sürer). Başlarken oyuncu masasına oturur,
  cozy lamba + odak müziği, masanın üstünde "ODAKTA"/"MOLA" tabelası (`canliCiz`), ekip ~70 sn'de bir fısıldar, Sütlaç masanın yanına gelip uyur (`MOD("odakBasladi", masa)` → sutlac.js). Tur bitince "ne oldu?":
  İlerledim / Bitirdim (iş "Bugün"de tiklenir) / Takıldım (küçük adım önerisi); sonra mola: oyuncu kahveye yürür, 1 (uzun molada 3) ajan gelip sohbet eder, uzun molada parti. Mola bitince "Tur n başlat / Başka işe geç / Bugünlük yeter".
  Başka sekmeden 30 sn+ sonra dönünce Ada kaldığın yeri söyler (ceza yok). Sayaç başlıkta (`#odakSaat`: "⏱ 12:34 · 2/4" / "☕ mola"). İstatistik `localStorage["ofis-odak-istatistik"] {YYYY-AA-GG: {tur, dk, notlar}}` (120 gün);
  `window.OFIS_ODAK {durum(), istatistik() → {bugun, hafta[7], seri, toplamTur}, baslat()}` BeyinOS Odak uygulaması ve XP için. Test: `odakBasla(g, tur)`, `odakBitir()`, `molaBitir()`, `odakIstatistik()`.
- **Arayüz** (`moduller/arayuz.js`): sağ panel aç/kapa (hatırlanır), tam ekran, Ayarlar'dan "Ofisi düzenle". **Düzenle çekmecesi** (`duzenle.js`): üstten yüzer, eşya seçince toplanır, eşya kaldır/geri al/eski yerine.
- **Odak/pano/performans:** `moduller/pano.js` yerel "Bir ara yapalım" panosu (`VERI/pano.json`, `/api/pano`; ortak pano ziyaret kanalıyla sonra). Performans (`ofis.js`): kare sınırlayıcı (~60 kare/sn, 4 ms tolerans), tuval DPR en çok 1,5, saat yazısı yalnız değişince,
  yönü anında değiştirme, F3 tanı paneli, başlıkta fps. Müzik/ses (`ses.js`): Atölye'de kodla üretilen lofi/caz/piyano (Ayarlar), cozy modda şömine çıtırtısı, `odakMuzigi`.
- **Monitör arkası:** masada oturan çalışan ekrana bakar, kameraya monitörün/dizüstünün ARKASI döner (`cizimler.js > monitorArka, laptopArka`; `ofis.js > calismaMasasi`); oyuncunun masası ve toplantı koltuğu hizası `harita/ofis.tmj` içinde
  (`py -3 araclar/harita_yap.py` → `harita.js`). Ayakta duran çalışan: `kisi.json > roller.<id>.ayakta` (oturmaz) ve `koltuk`. Yazı tipi Pixelify Sans (SIL OFL): `yazi/PixelifySans.ttf` + `yazi/OFL.txt` (depoya konabilir; yoksa 'Ink Free'/sistem yazı tipine düşülür).
- **Nabız ve kapanış:** sayfa 10 sn'de bir ve görünür/odaklı/çevrimiçi olunca hemen `/api/nabiz` atar (arka planda tarayıcı zamanlayıcıları dakikada bire düşer ya da pencere donar); `NABIZ_SURE` 30 dk (eskiden 180 sn; ara sürümde 30 gün).
  Sunucu kapanınca (`serve_forever` biter) `Panel.kapat()`, `tablet_durdur()` ve ses işçisinin `atexit`/stdin EOF yolu çalışır. Sunucuya 3 ardışık nabız ulaşmazsa olay günlüğüne bir uyarı düşer.
- **Kişisel katman** (`kisi.json`, hepsi isteğe bağlı; `ofis.pyw > kisi_dogrula` doğrular, `kisi.js` uygular; kodda kişi adı/ders/oda adı yok): `roller.<id> {ad, rol, kimlik, odak, koltuk:[x,y], ayakta}`, `oda_adlari {oda id: "Ad" | {ad, mini}}`
  (oda id'leri: gundem, yonetim, beyin, radar, merkez, mutfak, toplanti, studyo, yayin), `gunaydin [metin]`, `tema {ton:"r,g,b", seviye, hali:[3 renk], renkler:{zemin,panel,cizgi,yazi,soluk,vurgu,iyi,kotu,kenar,dugme,kutu,kutuKenar}}`,
  `tv {gundem_ust, gundem_alt, studyo, studyo_kayit, yayin, yer, yer_ek}`, `etkilesim {tarihler:[{ad,tarih,not}], kitaplar, kanallar, gizli_kelimeler:[{kelime,mesaj}], hali:[x1,y1,x2,y2], uyku_hedefi, cerceve_notlari}`, `panel_yasak_konular`.
  Hiçbiri yoksa genel haber ofisi görünümü. Ziyaretçilere yalnız ofis/oyuncu adı gider (`ziyaret.py` yalnız `ofis_adi`, `oyuncu_adi` okur); etkileşim içeriği ve tarihler hiçbir cevaba girmez.
