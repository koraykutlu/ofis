# Ofis kurulum rehberi

Ofis, pikselli bir "yönetim ofisi" oyunudur: ajanlar masalarında çalışır, sen karakterinle ofiste gezersin ve asistanla
(varsayılan adı Ada) ikinci beynindeki notlar hakkında gerçekten sohbet edebilirsin. Oyun tarayıcıda çalışan ayrı bir pencerede açılır,
bilgisayarının dışına hiçbir şey göndermez (sohbet hariç: soruların Claude Code aboneliğinle Claude'a gider).

Kurulum için bir yapay zekâ ajanına gerek yok: `Kur.bat` her adımı Türkçe anlatır ve ne yapacağını sorar.

## Hazırlık (5 dakika)

1. **Windows 10 ya da 11** ve Edge ya da Chrome. Python'u sen kurmak zorunda değilsin: yoksa `Kur.bat` kurmayı önerir.
2. **LimeZu'nun dört piksel sanat paketi** (itch.io, yayıncı: LimeZu). Ofis'in görselleri bunlardan üretilir ve ücretlidir; lisansları yeniden dağıtımı yasakladığı için Ofis ile birlikte gelmez, her kullanıcı kendi paketlerini alır:
   - **Modern Interiors** (ücretli): https://limezu.itch.io/moderninteriors
   - **Modern Office** (ücretli): https://limezu.itch.io/modernoffice
   - **Modern User Interface** (ücretli): https://limezu.itch.io/modernuserinterface
   - **Modern Interiors Free** (ücretsiz): LimeZu'nun https://limezu.itch.io/ sayfasında "Modern Interiors - Free" adıyla bulunur.
   Her biri bir **zip** olarak iner. **Zip'leri açma**; olduğu gibi `Kur.bat`'ın bulunduğu klasöre, İndirilenler'e ya da Masaüstü'ne koy. Dosya adlarının önemi yok, `Kur.bat` zip'leri içeriğinden tanır.
3. **(İsteğe bağlı, asıl eğlence) Claude Code**: asistanla gerçek sohbet, ücretli bir Claude aboneliği ve kurulu, giriş yapılmış bir `claude` komutu ister
   (https://claude.com/claude-code). Komut satırında `claude` yazınca açılıyorsa hazırsın. Olmadan da Ofis kurulur ve çalışır; yalnız 🧠 ile asistana gerçek soru sorulamaz ve sohbet bunu söyler.
4. **İkinci beyin klasörü** (isteğe bağlı): asistanın okuyacağı not klasörün; içinde `...Companion` adlı bir klasör olmalı. Asistan salt-okur çalışır;
   not/görev kaydetme önerileri yalnız sen onaylarsan ve klasörde `beyin.py` varsa yazılır.

## Kurulum (3 adım)

1. Ofis zip'ini bir klasöre aç (örneğin `C:\Ofis`). Bu klasör kalıcı yerin olacak; silme ya da taşıma sonradan kısayolu bozar (taşırsan `Kur.bat`'ı yeniden çalıştır).
2. **`Kur.bat`**'a çift tıkla. Sırayla şunları yapar, her adımın başında `[n/6]` yazar:
   - **Python:** yoksa `winget install -e --id Python.Python.3.12` komutunu önerir, sen `E` dersen kurar (internet gerekir). `H` dersen python.org adresini gösterir.
   - **Pillow** (resim kütüphanesi): yoksa kurmayı sorar.
   - **LimeZu zip'leri:** önce Kur.bat'ın klasöründe, sonra İndirilenler'de ve Masaüstü'nde arar. Bulamadıklarını adıyla ve itch.io adresiyle söyler; zip'i klasöre koyup **Enter**'a basınca yeniden arar (başka bir klasörün yolunu yazabilir ya da `q` ile çıkabilirsin).
   - **Kişi soruları:** adın, oyundaki karakterinin adı, ofisinin adı, asistanının adı, ikinci beyin klasörün. Boş Enter = köşeli parantezdeki varsayılan. Cevaplar `%LOCALAPPDATA%\OfisDemo\kisi.json`'a yazılır; sonradan not defteriyle değiştirebilirsin.
   - **Görseller:** zip'leri `varliklar` klasörüne açar ve üretir (birkaç dakika sürer, eşya kataloğu adımı en uzunudur).
   - **Kısayol:** masaüstüne ve Başlat menüsüne **Ofis** kısayolu.
   - **Claude Code:** kurulu mu diye bakar. Yoksa oyun yine kurulmuştur, bunu söyler.
3. Sonunda "Ofis'i şimdi açayım mı?" sorusuna `E` de ya da **Ofis** kısayoluna çift tıkla. Ok tuşları ya da WASD ile yürü, bir ajanın yanında `E` ile konuş, `🧠` düğmesiyle asistana gerçek soru sor.

`Kur.bat`'ı istediğin kadar yeniden çalıştırabilirsin: bitmiş adımlar atlanır ve kişi soruları yeniden sorulmaz.
Seçenekler (komut satırında): `Kur.bat --kisi` kişi sorularını yeniden sorar, `Kur.bat --yeniden` her şeyi baştan yapar, `Kur.bat --varliklar KLASOR` zip'lerin yerini gösterir.

## Güncelleme

Yeni sürümü geçmek için üç yol var; hepsi kişi ayarını, düzenini, görünümünü ve ürettiğin görselleri korur.

1. **Ofis'in içinden (en kolayı):** ⚙️ **Ayarlar > Güncelleme > Denetle**; yeni sürüm varsa notları görünür, **Güncelle**'ye bas. Ofis indirilen dosyanın sağlama toplamını (SHA-256) doğrular,
   yalnız kod dosyalarını değiştirir, önceki sürümü `yedek` klasörüne alır ve kendiliğinden yeniden açılır. Beğenmezsen **Önceki sürüme dön**.
   *Günde bir kez denetle* kutusu varsayılan olarak kapalıdır; işaretlersen Ofis günde en çok bir kez yalnız son sürüm bilgisini sorar, hiçbir veri göndermez.
2. **Zip ile:** yeni sürüm zip'ini eski kurulumun **üstüne** aç (aynı klasör, "üzerine yaz") ve `Kur.bat`'ı çalıştır. Önceki kurulumu görür, soru sormadan güncelleme modunda çalışır;
   yalnız görsel üreticilerinin kodu değiştiyse görselleri yeniden üretir.
3. **İnternetsiz / arkadaşından zip:** `py -3 araclar\guncelle.py --zip Ofis-<sürüm>.zip` (ya da `Kur.bat --guncelle Ofis-<sürüm>.zip`). Zip'in yanında `SHA256SUMS` dosyası varsa doğrulanır; yoksa uyarır ve sorar.
   Bu yol, depo adı ayarlı olmasa da çalışır. Geri dönmek için: `py -3 araclar\guncelle.py --geri`.

Güvenlik: güncelleme yalnız `https` ile ve GitHub adreslerinden iner, sağlama toplamı yoksa ya da uyuşmazsa hiçbir şey kurulmaz, zip'te izin verilen kod dosyaları dışında (görseller, kişisel ayarlar, `varliklar`) bir şey bulunursa tümüyle reddedilir; hata olursa değişenler kendiliğinden geri konur.

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| "Python 3 bulunamadi" | `Kur.bat` winget ile kurmayı önerir; olmazsa https://www.python.org/downloads/ adresinden kur, "Add python.exe to PATH" kutusunu işaretle, `Kur.bat`'ı yeniden çalıştır. |
| "Eksik paket" | Mesajdaki paketi itch.io'dan indir, zip'i açmadan `Kur.bat`'ın klasörüne ya da İndirilenler'e koy, Enter'a bas. Zip'in bozuk ya da başka bir paket olması da bunu verir. |
| Pillow kurulamadı | İnternet bağlantını denetle; elle: `py -3 -m pip install --user pillow`. |
| Sohbet "Claude Code" ile ilgili bir şey der | `claude` komutunu kur ve bir kez komut satırından giriş yap; sonra Ofis'i kapatıp aç. Oyunun kendisi buna ihtiyaç duymaz. |
| Sohbet "vault" ile ilgili şikâyet eder / notları bulamaz | `%LOCALAPPDATA%\OfisDemo\kisi.json` içindeki `"vault"` değerinin ikinci beyin klasörünü gösterdiğinden emin ol (içinde `...Companion` klasörü olmalı). |
| Güncelleme "Yayın deposu ayarlanmadı" der | Bu kopyada çevrimiçi denetim kapalıdır; yeni sürümü zip olarak alıp yukarıdaki 2. ya da 3. yolla kur. |
| Güncelleme "Sağlama toplamı yok / uyuşmuyor" der | Güvenlik için kurulmadı. Biraz sonra yeniden dene; sürmezse sürüm sayfasından zip'i elle indirip 2. yolla kur. |
| Güncellemeden sonra bir şey bozuldu | Ayarlar > Güncelleme > Önceki sürüme dön, ya da `py -3 araclar\guncelle.py --geri`. |
| Ofis eski görünüyor | Pencereyi kapat; kısayoldan yeniden aç. |
| Kısayol oluşmadı | Elle aç: komut satırında Ofis klasöründe `py -3 ofis.pyw`. |

Kurulum bir adımda takılırsa mesajı olduğu gibi kurulumu gönderen kişiye ilet; `Kur.bat`'ı yeniden çalıştırmak güvenlidir.

## Wi-Fi ile ziyaret (isteğe bağlı)

Aynı Wi-Fi'deki iki Ofis birbirinin ofisini asansörle ziyaret edebilir. İki tarafta da **aynı sürüm** kurulu olmalı (farklıysa Ofis "iki taraf da aynı sürümü kursun" der).
1. Her iki tarafta ⚙️ **Ayarlar > Ziyaret (Wi-Fi) > "Ofisimi ziyarete aç"** kutusunu işaretle. Ofis o an ağa ayrı bir ziyaret kapısı (varsayılan 8545, keşif 8546) açar; kapalıyken hiçbir şey açılmaz.
2. **Windows güvenlik duvarı** ilk açılışta Python için bir soru sorar: **"özel ağlar"** kutusunu işaretleyip izin ver (genel ağlar kutusunu işaretleme). Soruyu kaçırdıysan: Windows Güvenliği >
   Güvenlik Duvarı > "Bir uygulamaya izin ver" > Python (python.exe / pythonw.exe) > özel (Private).
3. **Eşleşme (bir kez):** ev sahibi "Eşleşme kodu üret"e basar (6 hane, 5 dakika geçerli). Misafir "Yakındaki ofisler" listesinden ofisi seçer (görünmezse ev sahibinin IP'sini elle yazar:
   ev sahibinin Ayarlar'ında "Dinliyor: 192.168.x.x:8545" yazar), kodu girip **Eşleş**'e basar. 5 yanlış kod eşleşmeyi 5 dakika kilitler. Eşleşme karşılıklıdır; Ayarlar'dan "Kaldır"la silinir.
4. **Ziyaret:** misafir kendi ofisinde giriş asansörünün (haber merkezinin sağ ucu) önünde `E` → "Kat seç" → ofisi seçer. Ev sahibinin ekranında "... ofisine gelmek istiyor · Kabul / Reddet" çıkar
   (60 saniyede kendiliğinden ret); **her ziyarette onay gerekir**. Kabulde misafir ev sahibinin ofisinde asansörden çıkar. Dönmek için asansörde `E` > "Kendi ofisime dön" ya da `Esc`.
   Misafir yalnız gezer: gerçek sohbet, düzenleme, gardırop ve onay kartları kapalıdır, ev sahibinin notları ve görevleri karşıya gitmez.

**Ziyaret açıkken ofisinin adı yerel ağa yayınlanır** (UDP, ~3 sn'de bir; yalnız ad ve port, başka hiçbir bilgi). Ziyaret ağdaki herkese değil, yalnız eşleştiğin ofislere açıktır ve yalnız özel ağdan (ev/ofis Wi-Fi'si) gelen istekleri kabul eder. Trafik şifresizdir: tanımadığın ağlarda (kafe, otel) ziyareti açma.

## Gizlilik ve lisans

- Ofis yalnız bu bilgisayarda (127.0.0.1) çalışır; ağdan erişilemez. Tek istisna, sen açarsan **Wi-Fi ziyareti** (yukarıda): açıkken eşleştiğin ofislere ayrı, imzalı, dosya sunmayan bir kapı açılır. Sohbet soruların ve asistanın okuduğu notlar, Claude Code aboneliğin üzerinden Claude'a gider.
- İnternete yalnız şu durumlarda çıkılır: sohbet (Claude Code) ve sen **Denetle**'ye basarsan ya da *Günde bir kez denetle*'yi açarsan GitHub'a sürüm sorusu. Hiçbir kişisel veri gönderilmez.
- Notların salt-okurdur; asistan bir şey kaydetmek isterse bir onay kartı çıkar, sen "Onayla" demeden hiçbir şey yazılmaz.
- **LimeZu varlıkları Ofis ile birlikte gelmez ve paylaşılmaz.** Lisansları kullanımı (ticari dâhil) serbest bırakır, ama paketlerin ya da onlardan üretilen görsellerin
  (`varliklar` klasörü) başkasına verilmesini, yayımlanmasını yasaklar. Bu yüzden her kullanıcı kendi paketlerini satın alır/indirir. `varliklar` klasörünü kimseyle paylaşma,
  Ofis'i başkasına verirken yalnız sürüm zip'ini (içinde varlık yoktur) ver.
- Ofis'in kodu MIT lisanslıdır (`LICENSE`); LimeZu grafikleri bu lisansın dışındadır.
- Kişiselleştirme (oda adları, ajan adları/rolleri, tema, sınav tarihleri, gizli kelimeler) `kisi.json` içindeki isteğe bağlı alanlardır; alan listesi `MIMARI.md` > "Birleşik sürüm 0.10.0" > Kişisel katman.
- Kişisel ayarların (`kisi.json`), düzenin (`duzen.json`) ve görünümün (`gorunum.json`) hepsi `%LOCALAPPDATA%\OfisDemo` klasöründedir; Ofis klasörünü silsen de kalırlar.
