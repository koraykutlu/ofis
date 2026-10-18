// Kurgusal demo verisi. Hiçbir gerçek sisteme bağlı değil; senaryo döngüde yeniden oynar.
// koltuk: ajanın masadaki karo konumu (x, y). karakter: LimeZu hazır karakter numarası (oyuncu kendi sayfasını kullanır).
window.DEMO = {
  ajanlar: [
    { id: "oyuncu",   ad: "Yönetici",    rol: "Yönetici",              karakter: 0,   koltuk: [18, 4],  oyuncu: true },
    { id: "muhabir1", ad: "Deniz",       rol: "Muhabir · bilim",       karakter: 3,   koltuk: [3, 5] },
    { id: "muhabir2", ad: "Ela",         rol: "Muhabir · teknoloji",   karakter: 6,   koltuk: [8, 5] },
    { id: "ada",      ad: "Ada",         rol: "Beyin arşivcisi",       karakter: 2, koltuk: [29, 6] },
    { id: "postaci",  ad: "Yakala",      rol: "Gelen evrak",           karakter: 7, koltuk: [33, 8] },
    { id: "tarayici", ad: "Tarayıcı",    rol: "Radar botu",            karakter: 5, koltuk: [41, 5] },
    { id: "analist",  ad: "Analist",     rol: "Radar karnesi",         karakter: 9,   koltuk: [45, 8] },
    { id: "editor",   ad: "Editör",      rol: "Seçer ve özetler",      karakter: 13,   koltuk: [4, 15] },
    { id: "denetci",  ad: "Doğrulayıcı", rol: "Kaynağı kontrol eder",  karakter: 14, koltuk: [10, 15] },
    { id: "sosyal",   ad: "Sosyal",      rol: "X ve Telegram metinleri", karakter: 10, koltuk: [23, 15] },
    { id: "spiker",   ad: "Sunucu",      rol: "Video bülten",          karakter: 1, koltuk: [29, 26] },
    { id: "dagitici", ad: "Dağıtıcı",    rol: "Yayın ve kanal",        karakter: 17,   koltuk: [43, 28] },
  ],

  // İlişkiler (moduller/ihtiyac.js): arkadaşlar sebil sohbetinde birbirini çağırır; çiftlerin kendi şakaları; Sütlaç'ın favorileri
  iliskiler: {
    arkadas: [["analist", "tarayici"], ["muhabir1", "muhabir2"], ["editor", "denetci"], ["sosyal", "dagitici"], ["spiker", "sosyal"], ["ada", "postaci"]],
    sakalar: {
      "analist|tarayici": [["Formasyonların yine kusursuz mu?", "Kusursuz. Karnen yanılıyor."], ["Bu hafta kaç sinyal tuttu, tahmin et.", "Hepsi. Sen yanlış saydın."]],
      "muhabir1|muhabir2": [["Bilim mi teknoloji mi, bugün kim manşet?", "Teknoloji tabii, yeni model çıktı."], ["Kaynağını Doğrulayıcı'ya gösterdin mi?", "İki kez. Yine de baktı."]],
      "denetci|editor": [["Bugün kaç haberi geri çevirdim, biliyor musun?", "Bir. Ben de onu bültenden çıkardım zaten."]],
      "ada|postaci": [["Yine evrak mı getirdin?", "Üç kaynak, hepsi işlenmeyi bekliyor."]],
      "dagitici|sosyal": [["20:00 paylaşımı hazır mı?", "Hazır, kanala sen bırakıyorsun."]],
      "sosyal|spiker": [["Video için başlık lazım.", "\"30 saniyede günün özeti\" nasıl?"]],
    },
    // şakalaşan rakipler: ortam sohbetleri (sohbetler.js, iliski: "rekabet") bu çiftleri tatlı bir çekişmeyle konuşturur
    gerilim: [["muhabir1", "editor"], ["denetci", "muhabir2"], ["analist", "sosyal"], ["tarayici", "dagitici"]],
    kediFavori: ["ada", "denetci"],
  },

  // t: senaryo saniyesi (döngü 120 sn, 1 sn = 6 dk; 07:00 = 0). git: hedef ajanın masasına yürü, konuş, dön.
  // Ajanlar 07:00-08:00 arası girişten gelir (en geç ~15. sn'de masada); toplantı (≈26-45, ≈75-95) ve öğle (≈49-60) pencerelerinde
  // olaylar ilgili ajanları bekler (ofis.js > olay). Sıralar ve içerikler eski senaryoyla aynı, yalnız saatler kaydı.
  olaylar: [
    { t: 12, kim: "postaci",  soz: "3 yeni kaynak geldi: 2 X gönderisi, 1 video.", ses: "bildirim" },
    { t: 16, kim: "postaci",  git: "ada", soz: "{asistan}, işlenecek evrak bıraktım." },
    { t: 23, kim: "ada",      soz: "Okudum. 2 ders 'dağıtım' notuna bağlandı.", kayit: "Beyin: 3 kaynak işlendi, 2 ders kaydedildi." },
    { t: 13, kim: "tarayici", soz: "Tarama bitti: 42 grafik, 3 formasyon." },
    { t: 17, kim: "tarayici", git: "analist", soz: "Üçünü karneye işle." },
    { t: 25, kim: "analist",  soz: "İşlendi. Bu hafta 7/11 hedefe ulaştı.", kayit: "Radar: 3 yeni sinyal, haftalık karne 7/11." },
    { t: 27, kim: "analist",  git: "dagitici", soz: "Kanala hazır, yayınla." },
    { t: 40, kim: "dagitici", soz: "Telegram'a gönderildi. Kanal +18 üye.", ses: "bildirim" },
    { t: 15, kim: "muhabir1", soz: "arXiv ve 3 basın bülteninden 8 bilim haberi.", yaz: 6 },
    { t: 16, kim: "muhabir2", soz: "Teknolojide 4 aday: 2 model, 2 donanım.", yaz: 6 },
    { t: 17.5, kim: "muhabir1", git: "editor", soz: "Editör, 8 bilim adayı sende." },
    { t: 19.5, kim: "muhabir2", git: "editor", soz: "Benimkiler de geldi." },
    { t: 24, kim: "editor",   soz: "En iyi 5'i seçtim, Türkçe özetliyorum.", yaz: 5 },
    { t: 27.5, kim: "editor",  git: "denetci", soz: "Doğrulayıcı, birincil kaynakları kontrol et." },
    { t: 33, kim: "denetci",  soz: "1 haberin birincil kaynağı yok. Reddediyorum.", tartisma: "editor", ses: "ret" },
    { t: 36.5, kim: "editor",  soz: "Haklısın, çıkardım. 4 haber kaldı.", kayit: "Haber: 12 aday → 4 onaylı, 1 kaynak eksik diye elendi." },
    { t: 38.5, kim: "editor",  yazdir: true, soz: "Bülten taslağı yazıcıda." },
    { t: 44, kim: "sosyal",   soz: "4 haber için X ve Telegram metni hazırlıyorum.", yaz: 6 },
    { t: 46, kim: "spiker",   soz: "60 saniyelik video bülteni kaydediyorum.", kayit: "Stüdyo: video bülten kaydı başladı." },
    { t: 29, kim: "ada",      git: "oyuncu", soz: "Sabah brifingin hazır.", brifing: true },
    { t: 55, kim: "editor",   git: "oyuncu", soz: "Bülten taslağı onayını bekliyor.", onay: "bulten" },
    { t: 64, kim: "dagitici", git: "oyuncu", soz: "Haftalık radar özeti hazır.", onay: "radar" },
  ],

  // Gün planı (ofis.js > gün planı): saatler dakika cinsinden (08:00 = 480, 10:00 = 600, 22:00 = 1320); gece yarısından sonrası 24 saat eklenir (01:00 = 1500).
  // Ofis günü açılış saatinde (varsayılan 08:00) başlar; kapanış "Ofisi kapat" ile ya da yedek otomatik kapanışla olur (ofis.js > ofisKapat).
  rutin: {
    giris: [46, 13],   // haber merkezinin sağ ucundaki giriş asansörünün önü (karo)
    // Sabah girişi: sırayla, `aralik` sn arayla; uzak masalar önde (yürüyüş uzun sürer)
    gelis: { sira: ["muhabir1", "muhabir2", "editor", "denetci", "sosyal", "spiker", "dagitici", "ada", "postaci", "tarayici", "analist"], bas: 0.4, aralik: 0.6,
      gercek: { bas: 0, aralik: 4 } },   // gerçek saatte: açılış saatinden (bas dk sonra) 4 dk arayla
    geceKalan: ["ada"],   // eve gitmez, ofis kapalıyken de arşivde kalır (gece de asistanla konuşulabilir)
    gunaydin: ["Günaydın!", "Günaydın ekip.", "Kahve var mı?", "Trafik yine rezaletti.", "Asansör bugün de bendeydi.", "Erken geldim sanırım."],
    toplantilar: [
      { dk: 600, saat: "10:00", konu: "Günün öncelikleri", risk: "Bülten onayı ve radar taraması aynı saate sıkıştı; biri gecikebilir.",
        uyeler: ["postaci", "tarayici", "sosyal", "spiker", "muhabir1"],
        acilis: "Günaydın ekip, sırayla 1'er cümle alalım.",
        raporlar: {
          postaci: "Gece 3 yeni kaynak düştü; {asistan:a} ilettim.",
          tarayici: "Tarama temiz: 42 grafik, 3 formasyon.",
          sosyal: "X ve Telegram metinleri bülten onayını bekliyor.",
          spiker: "Video bülten metni hazır, kayda her an girerim.",
          muhabir1: "Bilimde 8 aday var; uyku ve bellek çalışması öne çıkıyor.",
        } },
      { dk: 900, saat: "15:00", konu: "Gün sonu özeti", risk: "Akşam paylaşımı yayın kontrolü bitmeden çıkarsa hata riski var.",
        uyeler: ["ada", "analist", "denetci", "muhabir2", "sosyal"],
        acilis: "Gün bitmeden özet alalım; herkes 1 cümle.",
        raporlar: {
          ada: "Arşive 3 yeni kavram notu eklendi, 'Okul' bölgesi hâlâ bayat.",
          analist: "Haftalık karne 7/11; düşüş sinyallerini ayrı etiketleyeceğim.",
          denetci: "Birincil kaynak kuralı işledi, bugün tek ret çıktı.",
          muhabir2: "Yeni dil modeli Türkçede iyi; yarına 2 haber hazır.",
          sosyal: "Akşam 20:00 paylaşımı için metinler kuyrukta.",
        } },
      { dk: 1320, saat: "22:00", konu: "Gece vardiyası", risk: "Gece yarısından sonra dikkat dağılır; son kontrolü atlamayalım.",
        uyeler: ["ada", "editor", "denetci", "tarayici", "dagitici"],
        acilis: "Gece vardiyası, sırayla 1'er cümle alalım.",
        raporlar: {
          ada: "Arşiv gece de açık; bugünün notları sıraya girdi.",
          editor: "Yarınki bülten için 3 aday ayırdım, sabaha özet hazır.",
          denetci: "Akşam gelen iki kaynağı kontrol ediyorum, biri şüpheli.",
          tarayici: "Gece taraması yarım saatte bir koşuyor, şimdilik sakin.",
          dagitici: "Kanal kuyruğu boş, sabah paylaşımları zamanlandı.",
        } },
    ],
    // Öğle arası: oturanlar mutfak sandalyesine, kahveciler kahve makinesine gider
    ogle: { dk: 720, bitis: 780, otur: ["denetci", "muhabir2"], kahve: ["muhabir1", "sosyal"],
      sozler: ["Öğle arası, ne güzel.", "Mercimek çorbası kokusu geliyor.", "Beş dakika sessizlik.", "Sütlaç görünce mamasını da sorarım."] },
    // Akşam yemeği (öğle mantığıyla; tokluğu doldurur: rut "aksam")
    aksam: { dk: 1170, bitis: 1230, otur: ["editor", "tarayici"], kahve: ["dagitici", "spiker", "analist", "muhabir2"],
      sozler: ["Akşam yemeği, ne güzel.", "Bugün tavuk var galiba.", "Ekranlardan beş dakika uzaklaşalım.", "Sütlaç'ın mamasını kim verdi acaba?"] },
    // Kapanış: "Ofisi kapat" (ya da yedek otomatik kapanış) anından sonra bu sırayla, birkaç sn arayla asansöre yürürler (saatleri ofis.js > ofisKapat hesaplar); Ada kalır
    cikis: { sira: ["muhabir1", "muhabir2", "denetci", "sosyal", "spiker", "dagitici", "postaci", "tarayici", "analist", "editor", "ada"],
      sozler: ["İyi akşamlar!", "Yarın görüşürüz.", "Ben kaçtım.", "Kapıyı kapatan olsun."] },
    karneYorum: {
      yuksek: ["Ofis uçuyor. Yarın bütçe istesek bile verirler.", "Rekor gün. Yazıcı bile sustu.", "Sütlaç raporu imzaladı."],
      orta: ["İdare eder: kahve bitti ama moral bitmedi.", "Fena değil. Yarın yazıcıyla barışırız.", "Yarım gün yarım mutluluk."],
      dusuk: ["Zor gün. Yarın herkes erken ve kahveli gelsin.", "Bugün ofisin tek mutlu üyesi kediydi.", "Yarın daha iyi olur; kötüsü zor."],
    },
  },

  // Günün işleri: her döngüde `sabit` olanlar + havuzdan rastgele seçilenler (toplam 6). Hepsi o gün yapılabilir.
  gorevler: [
    { id: "bulten",   ad: "Bülten taslağını onayla", ipucu: "Editör onay kartını getirince Onayla'ya bas.", sabit: true },
    { id: "mama",     ad: "Sütlaç'ı besle", ipucu: "Mutfaktaki mama kabında E.", sabit: true },
    { id: "brifing",  ad: "{asistan:dan} brifingi al", ipucu: "{asistan:la} konuş, 'Brifingi ver'.", sabit: true },
    { id: "toplanti", ad: "Toplantıya katıl", ipucu: "Toplantı odasında boş koltuğa otur (10:00, 15:00 ya da 22:00).", sabit: true },
    { id: "yazici",   ad: "Yazıcıyı düzelt", ipucu: "Sıkışınca yazıcıda E." },
    { id: "kayit",    ad: "Stüdyoda kayda başlat", ipucu: "Sunucu'yla konuş, 'Kayda başla'." },
    { id: "radar",    ad: "Radar özetini onayla", ipucu: "Dağıtıcı özeti getirince Onayla'ya bas." },
    { id: "tarama",   ad: "Radar taramasını başlat", ipucu: "Tarayıcı'yla konuş, 'Yeni tarama başlat'." },
    { id: "balik",    ad: "Balıkları besle", ipucu: "Haber merkezinin sağ ucundaki akvaryumda E." },
    { id: "kahve",    ad: "Kahve molası ver", ipucu: "Mutfakta kahve makinesinde E." },
  ],
  gorevSayisi: 6,

  // Senaryo dışı küçük hayat: kahve molası, telefon. kim boşsa rastgele seçilir.
  ortam: { kahveAralik: [14, 24], telefonAralik: [18, 30] },

  // Oyuncunun ajanlarla konuşmaları ({oyuncu} ve {asistan} kisi.js'te yüklenirken çözülür). Hepsi kurgusal; gerçek sistemlere bağlı değil.
  // eylem: ofiste görünür bir şey başlatır (ofis.js > EYLEMLER).
  diyaloglar: {
    ada: { selam: "Günaydın {oyuncu}. Arşivde 214 not, 5 açık konu var.", secenekler: [
      { etiket: "Dün ne öğrendik?", cevap: "11 kaynaktan 3 yeni kavram notu çıktı: dağıtım kanalları, ajan talimatları, oyun üretimi." },
      { etiket: "Bayat kalan ne var?", cevap: "'Okul' ve 'Spor' bölgelerine 9 gündür dokunulmadı. Brifinge ekledim." },
      { etiket: "Brifingi ver", cevap: "Hemen. Sağdaki panele bıraktım.", eylem: "brifing" },
      { etiket: "25 dakikalık odak başlat", cevap: "Başlayalım. Küçük bir ilk adım yeter; süre bitince haber veririm.", eylem: "odak" },
      { etiket: "Yakalananları işlet", cevap: "Yakala'ya haber veriyorum, evrakı getirsin.", eylem: "yakalaIsle" },
      { etiket: "Sütlaç nerede?", cevap: "Genelde radar sunucularının yanında uyur; sıcak seviyor. Akşamları koşturur." },
    ] },
    postaci: { selam: "Gelen kutusunda 3 yeni kaynak var.", secenekler: [
      { etiket: "Neler geldi?", cevap: "2 X gönderisi (dağıtım, oyun) ve 1 YouTube videosu (yapay zekâ araçları)." },
      { etiket: "{asistan:a} götür", cevap: "Tamam, şimdi götürüyorum.", eylem: "yakalaIsle" },
    ] },
    tarayici: { selam: "Son tarama 07:04'te bitti: 42 grafik, 3 formasyon.", secenekler: [
      { etiket: "Hangi formasyonlar?", cevap: "BTC 4s Gartley, ETH 1g Bat, XAU 4s AB=CD. (Demo verisi.)", alt: [
        { etiket: "BTC'yi aç", cevap: "Gartley, D noktası 0.786'da. Onay mumu bekliyoruz; stop/hedef vermiyoruz, bağlam veriyoruz." },
        { etiket: "Neden Gartley?", cevap: "XA bacağının 0.618 geri çekilmesi B'de tuttu, oranlar tolerans içinde. Analist karnede ayrıca bakacak." },
      ] },
      { etiket: "Yeni tarama başlat", cevap: "Başlatıyorum, ekranı izle.", eylem: "tarama" },
      { etiket: "Sütlaç klavyene çıktı mı?", cevap: "Dün 'ffffffff' diye bir tarama başlattı. Sonuç: 0 formasyon, 1 mutlu kedi." },
    ] },
    analist: { selam: "Haftalık karne: 11 sinyalden 7'si hedefe ulaştı.", secenekler: [
      { etiket: "Ayrıntı ver", cevap: "Yükseliş sinyalleri iyi gidiyor, düşüş sinyalleri zayıf. Düşüşleri ayrıca etiketlemeyi öneririm.", alt: [
        { etiket: "Düşüşler neden zayıf?", cevap: "Piyasa rejimi yükselişteydi; düşüş sinyalleri trende karşı. Rejim filtresi eklersek ayıklanır." },
        { etiket: "Tarayıcı ne diyor?", cevap: "Kendi formasyonlarının kusursuz olduğunu. Her hafta aynı tartışma, her hafta ben kazanıyorum." },
      ] },
      { etiket: "Premium'a ne ekleyelim?", cevap: "Bağlam satalım: rejim, karne, uyarı. Stop/hedef vermeyelim." },
    ] },
    editor: { selam: "Bülten taslağı hazır: 4 haber.", secenekler: [
      { etiket: "Taslağı göster", cevap: "Mars'ta yeni su izi · Kuantum hata düzeltmede eşik · Uyku ve bellek · Yeni antibiyotik adayı." },
      { etiket: "Onaya gönder", cevap: "Onay kartını paneline koydum.", eylem: "bultenOnay" },
      { etiket: "Yazdır", cevap: "Yazıcıya gidiyorum.", eylem: "yazdir" },
    ] },
    denetci: { selam: "Bugün 1 haberi reddettim.", secenekler: [
      { etiket: "Neden?", cevap: "Birincil kaynağı yoktu; başka bir haber sitesini aktarıyordu.", alt: [
        { etiket: "Kaynağı bulsak?", cevap: "Bulursak geri alırım. Editör'e not düştüm; makale yayımlanınca yeniden bakarız." },
        { etiket: "Muhabir üzüldü mü?", cevap: "{ajan.muhabir2} biraz bozuldu ama haklı olduğumu biliyor. Öğlen çay ısmarlayacağım." },
      ] },
      { etiket: "Kuralın ne?", cevap: "Her haberin altında birincil kaynak olmalı: makale, basın bülteni ya da veri." },
      { etiket: "Sütlaç'ın kaynağı?", cevap: "Sokaktan geldi, mama kabından doğrulandı. Birincil kaynak: kendisi." },
    ] },
    muhabir1: { selam: "Bilimde 8 aday topladım.", secenekler: [
      { etiket: "En ilginci?", cevap: "Uyku sırasında belleğin nasıl sağlamlaştığını gösteren yeni bir çalışma." },
      { etiket: "Kaynakların?", cevap: "arXiv, iki üniversite basın bülteni, bir dergi. (Demo verisi.)" },
    ] },
    muhabir2: { selam: "Teknolojide 4 aday var.", secenekler: [
      { etiket: "Öne çıkan?", cevap: "Türkçe testlerde öne çıkan yeni bir dil modeli." },
      { etiket: "Kahve molası ver", cevap: "Harika fikir, 5 dakika!", eylem: "kahve" },
    ] },
    sosyal: { selam: "X ve Telegram metinleri hazır.", secenekler: [
      { etiket: "X taslağını oku", cevap: "\"Bugün bilimde 4 haber, hepsi birincil kaynaklı 👇\"" },
      { etiket: "Ne zaman paylaşalım?", cevap: "Akşam 20:00 en iyi saat görünüyor. (Demo verisi.)", alt: [
        { etiket: "Telegram'a da mı?", cevap: "Evet, Dağıtıcı aynı anda kanala bırakır. Metni kısaltıp görselli yapacağım." },
        { etiket: "Şimdi atalım", cevap: "Şimdi atarsak öğle sessizliğine denk gelir; ama sen bilirsin, hazır bekliyor." },
      ] },
    ] },
    spiker: { selam: "Video bülten için hazırım.", secenekler: [
      { etiket: "Kayda başla", cevap: "Işıklar yanıyor, kayıttayız!", eylem: "video" },
      { etiket: "Metni oku", cevap: "\"Günaydın, KK Haber'de bugün dört başlık var…\"" },
    ] },
    dagitici: { selam: "Kanal bu hafta +18 üye.", secenekler: [
      { etiket: "Radar özetini yayınla", cevap: "Gönderiyorum.", eylem: "yayinla" },
      { etiket: "İstatistik", cevap: "Telegram 1.240 üye, X 3.100 takipçi. (Demo verisi.)" },
    ] },
  },

  onaylar: {
    bulten: { baslik: "Bilim bülteni #7 (4 haber)", detay: "Mars'ta yeni su izi · Kuantum hata düzeltmede eşik · Uyku ve bellek · Yeni antibiyotik adayı" },
    radar:  { baslik: "Haftalık radar özeti", detay: "11 sinyal, 7'si hedefe ulaştı (kurgusal sayı). Kanala gönderilsin mi?" },
  },

  brifing: [
    "Beyin: dün 3 kaynak işlendi; 'Okul' bölgesine 9 gündür dokunulmadı.",
    "Radar: 3 sinyal yayınlandı, kanal bu hafta +18 üye.",
    "Haber: 4 haber onaylı, 1'i kaynak eksik diye elendi.",
    "Onay bekleyen: 2 iş (bülten, radar özeti).",
  ],

  manset: [
    "GÜNDEM · Mars'ta yeni su izi bulundu",
    "TEKNOLOJİ · Yeni dil modeli Türkçe testlerde öne çıktı",
    "BİLİM · Uyku belleği nasıl sağlamlaştırıyor?",
    "RADAR · Bu hafta 3 yeni formasyon",
  ],
};
