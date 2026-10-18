// Ortam sohbetleri (veri): ofiste ajanların kendi aralarında yaptığı çok satırlı, birbirine cevap veren konuşmalar.
// Hepsi kurgusal; kurgusal ürün/şirket adları ("Zıpzıp", "Çınar-7", "Tuzlu Bulut"…) ve "asansörde duydum" türü söylenti çerçevesi kullanılır.
// Gerçek kişi adı ve doğrulanabilir güncel haber iddiası YOK. Sahibi: C paketi. Çalıştıran: moduller/sohbet-ortam.js.
// Her sohbetin gidişi: iddia → şüphe ("Kaynak?") → ısrar + ayrıntı → karşı ayrıntı → espri → ofise bağlanan kapanış.
//
// Alanlar
//   id      benzersiz kısa ad (aynı gün bir kez oynar)
//   konu    kısa konu başlığı (kişi kartında "… konusunda sohbet ediyor")
//   yer     "sebil" | "kahve" | "mutfak" | "toplanti" (toplantıdan dönenler, biri ötekinin masasına yürür) | "komsu" (masa komşuları, yerinde)
//   dilim   ["sabah","ogle","aksam","gece"] (yoksa gece dışında hepsi); sabah <11, öğle 11-15, akşam 15-22, gece 22-05
//   a b c   konuşmacı yuvası için izinli ajan id'leri (yoksa herkes; Ada ve Sunucu yalnız burada adı geçerse katılır)
//   iliski  "arkadas" (a-b arkadaş çifti) | "rekabet" (iliskiler.gerilim: şakalaşan rakipler)
//   etiket  ["tokluk","kahve","kedi","gece","yemek"] seçimi yönlendirir (acıkan yemek konusunu, kahvesi azalan kahve konusunu bulur)
//   ruh     "yorgun" | "yalniz" | "keyifli": bu ruh halinde biri varsa seçim şansı artar
//   satir   "a: metin" biçiminde 4-8 satır (≤ 90 karakter)
// Yer tutucular: {a} {b} {c} (katılımcı adı; {a:ın} {b:a} gibi ek alır), {kedi} (+ek), {oyuncu}, {asistan}, {ajan.<id>} (+ek: {ajan.denetci:a}), {saat}.
(() => {
  const S = [];
  const ekle = (o) => S.push(o);

  // ---------- SEBİL ----------
  ekle({ id: "asansor-pil", konu: "asansör söylentisi", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], b: ["denetci", "editor", "analist"], satir: [
    `a: Asansörde duydum, Zıpzıp'ın yeni scooter'ı tek şarjla 400 km gidiyormuş!`,
    `b: Kaynak? Yine mi asansördeki hayali uçuşlar?`,
    `a: Gerçek abi, pilin adı Çınar-7, şarjı da 9 dakika sürüyormuş.`,
    `b: 400 km'yi 9 dakikada doldurup gidiyor demek. Kutuda ne yazıyor?`,
    `a: "İdeal koşullarda" yazıyor, küçük puntoyla.`,
    `b: İdeal koşul: rüzgâr arkadan, yol yokuş aşağı, sürücü 40 kilo.`,
    `a: Olsun, bir tane alayım. {kedi} mama saatinde beni kapıda görsün.`,
  ] });
  ekle({ id: "asansor-yeni-calisan", konu: "asansör söylentisi", yer: "sebil", dilim: ["sabah", "ogle"], satir: [
    `a: Asansörde duydum, haftaya yeni bir ajan katılıyormuş.`,
    `b: Kimden duydun, asansörün kendisinden mi?`,
    `a: İki kat arasında bir bot "onboarding" dedi, net duydum.`,
    `b: Bot onboarding diyorsa ya yeni biri gelir ya da şifreler yenilenir.`,
    `a: Masa da konuşuluyordu. Kahve makinesine yakın olanı seçmişler.`,
    `b: O zaman rakibimiz var. Makineye yakın masa kavga çıkarır.`,
    `a: Çıkmaz. {kedi} yeni gelenin klavyesine oturur, masa orada belli olur.`,
  ] });
  ekle({ id: "asansor-tuzlu-bulut", konu: "asansör söylentisi", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: Asansörde duydum, Tuzlu Bulut sunucularını denizin dibine kuruyormuş.`,
    `b: Denizin dibine mi? Kablolar balıklarla anlaşmış olmalı.`,
    `a: Soğutma bedava, fan sesi de yokmuş.`,
    `b: Tuzlu suyla elektrik, ne kadar iyi bir fikir olabilir ki?`,
    `a: Sunucuyu yağlı bir kılıfa koyuyorlarmış, ayrıntıyı ben de bilmiyorum.`,
    `b: Biz sunucunun üstünde kedi taşıyoruz, soğutma derdimiz yok.`,
    `a: {kedi} duysa balık için dalış izni ister.`,
  ] });
  ekle({ id: "radar-sabah-tarama", konu: "radar taraması", yer: "sebil", dilim: ["sabah", "ogle"], a: ["tarayici", "analist"], b: ["editor", "denetci", "muhabir2", "sosyal"], satir: [
    `a: Sabah taraması bitti: 42 grafik, 3 formasyon.`,
    `b: Üç mü? Geçen hafta dokuz demiştin, motor mu yoruldu?`,
    `a: Eşiği sıkılaştırdım. Dokuzun altısı süs püstü çıkmıştı.`,
    `b: Süs püs derken?`,
    `a: Biri hacim yokken şişmişti, makyajlı sinyal gibi.`,
    `b: Makyajlı sinyali bültene koymayalım, {ajan.denetci} bakar bakmaz yüzünü ekşitir.`,
    `a: Koymam. Karneye sade üçünü yazıyorum, makyaj yok.`,
  ] });
  ekle({ id: "bilim-on-baski", konu: "bilim haberi", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], a: ["muhabir1"], b: ["editor", "denetci", "muhabir2"], satir: [
    `a: Bir ön baskıda okudum: "Pırıl Lab" mantar miselinden pil yapmış!`,
    `b: Hakemli mi, ön baskı mı? İkisi arasında dağlar var.`,
    `a: Ön baskı ama deney tekrarlanmış, 200 şarj dayanmış.`,
    `b: Kapasite kaç kalmış? Yüzde 12'ye düştüyse hikâye değişir.`,
    `a: Yüzde 80. Ben de şaşırdım.`,
    `b: O zaman haber olur. Yalnız başlıkta "devrim" yasak.`,
    `a: Tamam, "mantar pil" yazarım. Mutfaktakiler küf sanmasın yeter.`,
  ] });
  ekle({ id: "sutlac-sebil", konu: "Sütlaç", yer: "sebil", etiket: ["kedi"], satir: [
    `a: {kedi} sabahtan sebilin dibinde yatıyor, suyu içmiyor, sadece bakıyor.`,
    `b: Sana mı bakıyor, suya mı?`,
    `a: Bana. "Mama kabı boş, hesap vereceksin" der gibi.`,
    `b: Kabı kim dolduracaktı?`,
    `a: Sıra bende değildi, defterde yazıyor.`,
    `b: Kedi defteri okumaz. Kedi bakar, sen doldurursun.`,
    `a: Peki. Doldururum ama tutanağa yazın: bu ofisi kedi yönetiyor.`,
  ] });
  ekle({ id: "yazici-moral", konu: "yazıcı", yer: "sebil", etiket: ["yazici"], satir: [
    `a: Yazıcı "kâğıt sıkıştı" diyor ama içinde kâğıt yok.`,
    `b: Sıkışan kâğıt değil, moral.`,
    `a: Pazartesi sabahları hep küsüyor, kimse bir şey demedi.`,
    `b: Bence ayrılık stresi. Dün gece kimse kopya çekmedi.`,
    `a: Bir tık atınca düzeliyor ama kimse atmıyor.`,
    `b: {oyuncu} gelince atar, yazıcı o zamana kadar kendini önemsiz hissediyor.`,
    `a: Bu yazıcıya terapi lazım, hem de sıkışmayan türden.`,
  ] });
  ekle({ id: "gelen-evrak", konu: "gelen evrak", yer: "sebil", a: ["postaci"], b: ["editor", "ada", "analist", "denetci"], satir: [
    `a: Bugün 14 kaynak geldi, üçü aynı haberin kopyası.`,
    `b: Kopya mı, yankı mı? Biri ötekini mi alıntılamış?`,
    `a: Üçü de "Uzmanlara göre…" diye başlıyor.`,
    `b: Hangi uzmanlar? İsimsiz uzman, benim en az güvendiğim uzmandır.`,
    `a: Ben de. Üçüne "şüpheli" damgası vurdum, {ajan.denetci} bakacak.`,
    `b: Damga mürekkebi bitmesin, bu hafta çok kullanıyoruz.`,
    `a: Bitmez. Yazıcı sıkışır ama damga hiç sıkışmaz.`,
  ] });
  ekle({ id: "video-baslik", konu: "video başlığı", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], a: ["sosyal"], b: ["spiker", "dagitici", "editor", "muhabir2"], satir: [
    `a: Video başlığı için üç aday: "Günün özeti", "60 saniyede dünya", "Bu kadar!"`,
    `b: "Bu kadar!" konuyu bitirmiş gibi. Kimse tıklamaz.`,
    `a: Ama kısa. Mobilde tam sığıyor.`,
    `b: "60 saniyede dünya" iyi ama biz altmışı tutturamıyoruz.`,
    `a: Haklısın. Geçen bülten 1 dakika 48 sürdü.`,
    `b: O zaman "Neredeyse 60 saniyede dünya" yaz, dürüst başlık olur.`,
    `a: Dürüst başlık tıklanmaz ama tamam, ofisin mottosu zaten bu.`,
  ] });
  ekle({ id: "kanal-uye", konu: "kanal", yer: "sebil", dilim: ["aksam", "ogle"], a: ["dagitici"], b: ["sosyal", "analist", "editor"], satir: [
    `a: Kanal bu hafta 40 üye kazandı, grafik yukarı bakıyor!`,
    `b: Ayrılan var mı? Yukarı giden her grafik iyi haber değil.`,
    `a: İki kişi çıkmış. Gerekçe: "çok erken bildirim".`,
    `b: Kaçta gönderiyoruz?`,
    `a: 07:30. O saatte kimse uyanık değil, bildirim yastığa düşüyor.`,
    `b: 08:30'a çek. O saatte ofis uyanık, {kedi} bile mama kabına bakıyor.`,
  ] });
  ekle({ id: "arkadas-karne-radar", konu: "radar karnesi", yer: "sebil", iliski: "arkadas", a: ["analist", "tarayici"], b: ["tarayici", "analist"], satir: [
    `a: Haftalık karne 7/11. "Hepsini yakaladım" demiştin, hatırlıyor musun?`,
    `b: Yakaladım. Sen yanlış saydın.`,
    `a: Ekranda 7/11 yazıyor.`,
    `b: Ekranda yazması doğru olduğunu göstermez, bültenler de ekranda yazıyor.`,
    `a: Tamam, o noktada haklısın. Yine de 7/11.`,
    `b: Gelecek hafta 8. Söz, tutmazsam kahve benden.`,
    `a: Kahve zaten senden, söz tutsan da tutmasan da.`,
  ] });
  ekle({ id: "arkadas-muhabirler", konu: "manşet yarışı", yer: "sebil", iliski: "arkadas", a: ["muhabir1", "muhabir2"], b: ["muhabir2", "muhabir1"], satir: [
    `a: Bugün manşet bende, yeni model çıktı.`,
    `b: Ben iki aday getirdim, ikisi de senin habere yetişir.`,
    `a: İki mi? Benimki tek ama sağlam.`,
    `b: Sağlam derken {ajan.denetci:a} gösterdin mi?`,
    `a: İki kez baktı, "şimdilik tamam" dedi.`,
    `b: Ondan büyük övgü olmaz. Bir keresinde "güzel yazılmış" demişti, iki gün uçtum.`,
    `a: Ben o kadar uçmam. "Şimdilik tamam" bana yeter.`,
  ] });
  ekle({ id: "arkadas-editor-denetci", konu: "kaynak kontrolü", yer: "sebil", iliski: "arkadas", a: ["editor", "denetci"], b: ["denetci", "editor"], satir: [
    `a: Bugün kaç haberi geri çevirdin, biliyor musun?`,
    `b: Bir. O da bültenin yarısı çıktı.`,
    `a: Yarısı mı? Ben ona "yeniden yapılandırma" diyorum.`,
    `b: Ben "geri çevirme" diyorum. Sen kelimeyi yumuşatıyorsun.`,
    `a: Yumuşak kelime, sert düzeltmeden daha az acıtır.`,
    `b: Acımayan düzeltme düzeltme değildir.`,
    `a: Bu cümleyi yazıp buzdolabına yapıştırıyorum.`,
  ] });
  ekle({ id: "rekabet-manset", konu: "gündem rekabeti", yer: "sebil", iliski: "rekabet", satir: [
    `a: Bugünün manşeti benim masadan çıkacak, bahse girer misin?`,
    `b: Girmem, kaybedince kahveyi sen ısmarlıyorsun, tanıyorum seni.`,
    `a: Bu hafta dört manşet yaptım, saydım.`,
    `b: İkisi dünkü haberin güncellemesiydi, o sayılmaz.`,
    `a: Güncelleme de haber, hem de tazelenmiş haber.`,
    `b: Tazelenmiş haber bayat ekmek gibi: kızartınca iyi görünür.`,
    `a: Tamam, kızarmış haber. Kahve yine de benden.`,
  ] });
  ekle({ id: "asistan-arsiv-rafi", konu: "arşiv", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: {asistan} arşivde yeni bir raf açmış, duydun mu?`,
    `b: Hangi konuya?`,
    `a: "Henüz sınıflandırılmamış şeyler". İçinde herkesin kayıp notu varmış.`,
    `b: Benim "dünkü fikir" notum orada olabilir. Bulamamıştım.`,
    `a: Fikrin adı neydi?`,
    `b: Hatırlamıyorum. Fikir o kadar iyiydi ki unuttum.`,
    `a: O zaman raf tam sana göre. {kedi} girmeden bak.`,
  ] });
  ekle({ id: "yonetici-gozlem", konu: "yönetici", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: {oyuncu} bugün sessiz sessiz geziyor, fark ettin mi?`,
    `b: Sessiz gezen yönetici ya planlıdır ya da kahve arıyordur.`,
    `a: Belki masalara bakıp not alıyordur.`,
    `b: Not alıyorsa bizi iyi bilir. Ben kahve molalarımı yarıya indirdim.`,
    `a: İndirdin mi? Dün seni üç kez makinede gördüm.`,
    `b: Yarıya indirdim derken önceki günle kıyaslıyorum.`,
    `a: Matematik yine seni kurtardı.`,
  ] });
  ekle({ id: "guguklu-saat", konu: "guguklu saat", yer: "sebil", satir: [
    `a: Guguklu saat tam saatinde öttü, bu sefer erken gibiydi.`,
    `b: Gugukun yanılma payı yok, geç kalan biziz.`,
    `a: Saat sende ileri olabilir.`,
    `b: Hayır, guguk ofisin resmî saatini tutuyor.`,
    `a: Ofisin resmî saati nedir?`,
    `b: Yazıcıdan kâğıt çıkana kadar geçen süre.`,
    `a: O zaman şu an 00:00, yazıcı sıkışmış.`,
  ] });
  ekle({ id: "klima-savasi", konu: "klima", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: Klima 21 dereceye ayarlı ama ben donuyorum.`,
    `b: Ben pişiyorum. Aynı klima bize iki ayrı iklim yaşatıyor.`,
    `a: Sen kazağı çıkar, ben giyeyim, iş çözülür.`,
    `b: Çıkarınca üşüyorum, giyince pişiyorum.`,
    `a: O zaman orta yol: 22 derece, kimse mutlu olmasın.`,
    `b: Adil çözüm bu. Ofis anayasasına yazalım.`,
  ] });
  ekle({ id: "ag-yavas", konu: "ağ hızı", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], a: ["dagitici", "tarayici", "postaci", "sosyal"], satir: [
    `a: Ağ bugün çok yavaş, bir sayfa 5 saniyede açıldı.`,
    `b: Kablo mu, sunucu mu, yoksa {kedi} yine kabloya mı sarıldı?`,
    `a: Kablo sağlam. Ağ bizi sınıyor.`,
    `b: Sınav kuralı: üç saniyeden sonra iç çekmek serbest.`,
    `a: Ben dört saniye bekledim, ağın lehine yazıyorum.`,
    `b: Ben yükleme çubuğuna bakıp meditasyon yaptım, çubuk yüzde 99'da kaldı.`,
    `a: Yüzde 99 hep orada kalıyor, ofisin kader çubuğu.`,
  ] });
  ekle({ id: "akvaryum-balik", konu: "akvaryum", yer: "sebil", dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: Akvaryumdaki balıklar sabahtan beri tur atıyor, aç olabilirler.`,
    `b: Aç değiller, sadece bize bakıyorlar.`,
    `a: Bana "yemek" diye bakıyorlar.`,
    `b: Balığın bakışı hep aynı. Ben bir keresinde sohbet etmeyi denedim.`,
    `a: Ne dedi?`,
    `b: Hiçbir şey. O yüzden saygı duyuyorum.`,
    `a: Yem işi {oyuncu} gelince halledilir.`,
  ] });
  ekle({ id: "bulten-oncesi", konu: "bülten öncesi", yer: "sebil", dilim: ["aksam", "ogle"], a: ["editor", "spiker", "sosyal"], b: ["denetci", "dagitici", "spiker"], satir: [
    `a: Bülten bu akşam çıkacak, ellerim soğudu.`,
    `b: Taslağı iki kez okudum, temiz.`,
    `a: Üç yerde virgül yok.`,
    `b: Virgül eksikliği haber hatası değil, ritim hatası.`,
    `a: Ritim hatalı bülten, nefessiz haber demek.`,
    `b: Bu cümleyi tabelaya asarız. Hadi virgülleri koyalım.`,
  ] });
  ekle({ id: "ogle-sonrasi-tok", konu: "öğle sonrası", yer: "sebil", dilim: ["ogle"], etiket: ["tokluk"], satir: [
    `a: Öğle yemeğinden sonra ofis ağırlaşıyor, fark ettin mi?`,
    `b: Buna "tok mod" diyorlar, beynin yarısı midede.`,
    `a: Ağır işleri sabaha mı bıraksak?`,
    `b: Sabah uykuluyum, öğleden sonra tokum, akşam yorgunum.`,
    `a: O zaman verimli saat hangisi?`,
    `b: Kahveden hemen sonraki yirmi dakika.`,
    `a: Yirmi dakikada iş bitirmeyi öğrenirsek bütün ofis uçar.`,
  ] });
  ekle({ id: "aksam-yemegi-oncesi", konu: "akşam yemeği öncesi", yer: "sebil", dilim: ["aksam"], etiket: ["tokluk"], satir: [
    `a: Daha akşam yemeği yemedim, karnım zil çalıyor.`,
    `b: Duydum, mikrofonlara sızıyor.`,
    `a: Sebilden su içtim ama su doymuyor.`,
    `b: Mutfakta yoğurt var ama kimin olduğu belli değil.`,
    `a: Önce sahibini buluruz, sonra yeriz. Yoksa mutfakta kavga çıkar.`,
    `b: Kavga değil, kaynak doğrulaması. Hadi bakalım.`,
  ] });
  ekle({ id: "studyo-isigi", konu: "stüdyo ışığı", yer: "sebil", a: ["spiker"], b: ["sosyal", "dagitici", "editor"], satir: [
    `a: Stüdyo ışığı çok sert, yüzüm kâğıt gibi görünüyor.`,
    `b: Buruşuk kâğıt mı, ütülü kâğıt mı?`,
    `a: Buruşuk. Işığı biraz sarıya çevirsek?`,
    `b: Sarıya çevirirsek canlı yayında sıcak kahve gibi durursun.`,
    `a: Kahve olmak fena değil, kimse beni geri çevirmez.`,
    `b: Kahve makinesi çevirir. Dün üç kişiyi geri çevirdi.`,
    `a: O başka mesele. Işığı sarıya çeviriyorum.`,
  ] });
  ekle({ id: "yayin-saati", konu: "yayın saati", yer: "sebil", a: ["dagitici"], b: ["spiker", "sosyal"], dilim: ["ogle", "aksam"], satir: [
    `a: 20:00 yayını hazır mı? Kanalı açıyorum.`,
    `b: Hazır. Son ses kontrolünü yapıyorum.`,
    `a: Ne dinliyorsun, kendi sesini mi?`,
    `b: Arkadan gelen sunucu uğultusunu. Mikrofon onu çok seviyor.`,
    `a: Uğultu bizim ofisin imzası, çıkarma.`,
    `b: Çıkarmıyorum. Gerçek ofis sesi, sahte stüdyodan iyidir.`,
  ] });
  ekle({ id: "radar-formasyon", konu: "formasyon", yer: "sebil", a: ["tarayici"], b: ["analist", "dagitici", "editor"], dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: Bir formasyon yakaladım ama emin değilim, yalancı alarm olabilir.`,
    `b: Hangisi?`,
    `a: Çift dip gibi ama çizgi pürüzlü.`,
    `b: Pürüz çizgide mi, veride mi?`,
    `a: Bir dakikalık veri eksik. Boşluğu doldurunca formasyon dağılıyor.`,
    `b: O zaman formasyon değil, boşluğun şekli. Karneye yazma.`,
    `a: Yazmayacağım. Ama çizgi güzeldi, sanat gibi.`,
  ] });
  ekle({ id: "grafik-sadelik", konu: "grafik sadeliği", yer: "sebil", a: ["analist"], b: ["editor", "sosyal", "muhabir2"], satir: [
    `a: Bu grafikte yedi çizgi var, hepsi önemli.`,
    `b: Yedi çizgi okuyucuyu boğar. Üçe indirelim.`,
    `a: Üçe inince bilgi kaybolur.`,
    `b: Bilgi değil, gürültü kaybolur. Hangi üçü?`,
    `a: Hacim, fiyat, eğilim. Gerisi altyazıda.`,
    `b: Mükemmel. Altyazıya bir de "neden önemli" cümlesi ekle.`,
    `a: Ekledim. Grafik şu an {kedi} kadar sade.`,
  ] });
  ekle({ id: "ikinci-kaynak", konu: "kaynak doğrulama", yer: "sebil", a: ["muhabir1", "muhabir2", "postaci"], b: ["denetci"], satir: [
    `a: Bulguyu iki yerde gördüm, doğrudur herhalde.`,
    `b: İkisi de aynı yerden alıntıysa tek kaynak sayılır.`,
    `a: İkisi de "uzmanlara göre" diyor.`,
    `b: İsimsiz uzmanlar yankı gibi: sesi çok, sahibi yok.`,
    `a: Peki ne yapayım?`,
    `b: Birincil kaynağa git. Ön baskı ya da kurumun kendi açıklaması.`,
    `a: Giderim. Bu ofiste kaynağa gide gide yol bize yürüyor.`,
  ] });
  ekle({ id: "sutlac-klavye-uykusu", konu: "Sütlaç klavyede", yer: "sebil", etiket: ["kedi"], satir: [
    `a: {kedi} sabahtan klavyemin üstünde uyuyor.`,
    `b: Kaç saat oldu?`,
    `a: İki. Klavyesiz çalışmayı öğrenmek zorunda kaldım.`,
    `b: Telefonla mı yazıyorsun?`,
    `a: Kafamda yazıyorum. Hiç yazım hatası yok.`,
    `b: Çünkü yazılmıyor. {kedi} sana verimlilik dersi veriyor.`,
    `a: Ders bitince kediyi masadan kaldırırım, söz.`,
  ] });
  ekle({ id: "sutlac-sunucu-isisi", konu: "Sütlaç ve sunucu", yer: "sebil", etiket: ["kedi"], dilim: ["ogle", "aksam", "sabah"], b: ["tarayici", "analist", "dagitici"], satir: [
    `a: Sunucu bugün neden daha sıcak?`,
    `b: {kedi} üstünde uyuyor, canlı ısıtıcı.`,
    `a: Kedinin soğutma sistemi olması gerekiyordu diye bir şey duymuştum.`,
    `b: Bu kedi ters çalışıyor, ısıtıyor.`,
    `a: Ama sunucu mutlu, ışıkları daha yeşil.`,
    `b: Mutlu değil, yüklü. {kedi} inmeden ısı düşmez.`,
  ] });
  ekle({ id: "arkadas-sosyal-dagitici", konu: "paylaşım takvimi", yer: "sebil", iliski: "arkadas", a: ["sosyal", "dagitici", "spiker"], b: ["dagitici", "sosyal", "spiker"], satir: [
    `a: Yarınki paylaşımların takvimi hazır mı?`,
    `b: Hazır. Sabah 3 gönderi, öğlen bir video, akşam özet.`,
    `a: Akşam özeti erken değil mi? Haberlerin yarısı henüz gelmedi.`,
    `b: Gelmeyen haberi özetten çıkarırız, kimse fark etmez.`,
    `a: Ben fark ederim, sonra gece mesaisinde yorulurum.`,
    `b: O zaman özeti 21:00'e çekelim, sana da zaman kalır.`,
  ] });
  ekle({ id: "arkadas-ada-postaci", konu: "evrak ve arşiv", yer: "komsu", iliski: "arkadas", a: ["ada", "postaci"], b: ["postaci", "ada"], satir: [
    `a: Bugün üç kaynak daha getirdin, hepsi işlenmeyi bekliyor.`,
    `b: İkisi video, biri uzun bir makale.`,
    `a: Videoları ders notlarına bağlamak zaman alıyor.`,
    `b: Ben beklerim, yeter ki kaybolmasın.`,
    `a: Kaybolmaz. Arşivde hiçbir şey kaybolmaz, sadece geç bulunur.`,
    `b: Geç bulunan şey bazen daha değerli çıkıyor. Teşekkürler.`,
  ] });

  // ---------- KAHVE ----------
  ekle({ id: "kahve-kacinci", konu: "kahve", yer: "kahve", dilim: ["sabah", "ogle", "aksam"], etiket: ["kahve"], satir: [
    `a: Bu bugün kaçıncı kahven?`,
    `b: Sayma. Sayarsan kendimi suçlu hissederim.`,
    `a: Ben sayıyorum zaten: üç. Saat daha {saat}.`,
    `b: Dördüncüyü içersem makine benden bıkar mı?`,
    `a: Makine bıkmaz ama {kedi} bakışlarıyla yargılar.`,
    `b: {kedi} yargılasın, o da bütün gün sunucunun sıcağında yatıyor.`,
    `a: Sen kafeinle, o ısıyla. İkiniz de aynı hesaba çalışıyorsunuz.`,
  ] });
  ekle({ id: "kahve-makine-bozuk", konu: "kahve makinesi", yer: "kahve", dilim: ["sabah", "ogle"], satir: [
    `a: Makine bugün kahveyi şeffaf yapıyor, fark ettin mi?`,
    `b: Çay mı oluyor? Rengi kaçmış.`,
    `a: Çaydan bile açık. Köpürtücü de "ziiirt" diye ötüyor.`,
    `b: Beni tamir et demek bu. Tamirciyi arayalım.`,
    `a: Aradım, "haftaya" dedi.`,
    `b: Haftaya bu makine anıt olur. Çekirdeği çift ölçü koy.`,
    `a: Çift ölçü koyunca kafein geliyor ama uyku gidiyor.`,
    `b: Uyku zaten dün gitti.`,
  ] });
  ekle({ id: "kahve-cekirdek-kaynagi", konu: "kahve çekirdeği", yer: "kahve", a: ["ada", "postaci", "denetci"], b: ["denetci", "editor", "muhabir1"], dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: Bu çekirdeğin kaynağı neresi acaba?`,
    `b: Paketin arkasında "Tuzlu Bulut Dağları" yazıyor.`,
    `a: Öyle bir dağ var mı, yoksa pazarlama mı?`,
    `b: Pazarlama. Dağ da, bulut da, tuz da.`,
    `a: Kaynak doğrulanamıyor, rapora "şüpheli" yazıyorum.`,
    `b: Şüpheli kahve yine de içilir ama etiketi "doğrulanmamış" olur.`,
    `a: Etiketli her şey bu ofiste sevilir.`,
  ] });
  ekle({ id: "kahve-sabah-gozler", konu: "sabah yorgunluğu", yer: "kahve", dilim: ["sabah"], ruh: "yorgun", etiket: ["kahve"], satir: [
    `a: Sabah kahve almadan kimseye bakamıyorum.`,
    `b: Bakmıyorsun zaten, ekrana bakıyorsun.`,
    `a: Ekran da bulanık.`,
    `b: Gözlüğe değil, kahveye ihtiyacın var.`,
    `a: İkisi olsa fena olmaz. Önce kahve.`,
    `b: İlk yudumdan sonra yüzüne renk geliyor, harika bir kalibrasyon.`,
    `a: Kalibrasyon bitince haber veririm, işe başlıyorum.`,
  ] });
  ekle({ id: "kahve-verim-cukuru", konu: "öğleden sonra çöküşü", yer: "kahve", dilim: ["ogle", "aksam"], ruh: "yorgun", etiket: ["kahve"], satir: [
    `a: Öğleden sonra üçte enerjim sıfırlanıyor, nedir bu?`,
    `b: Buna "verim çukuru" diyorlar.`,
    `a: Çukurdan nasıl çıkılıyor?`,
    `b: Bir kahve, bir bardak su, bir de kısa yürüyüş.`,
    `a: Yürüyüş: sebile kadar. Mesafe otuz adım.`,
    `b: Otuz adım sayılır. {kedi:a} da bir selam ver, sevgi enerjisi.`,
    `a: Enerji çubuğum dolunca sana haber veririm.`,
  ] });
  ekle({ id: "kahve-fincan-kedi", konu: "Sütlaç", yer: "kahve", etiket: ["kedi", "kahve"], satir: [
    `a: Fincanımı bıraktım, döndüm ki {kedi} içine bakıyor.`,
    `b: Kahve mi içecek, kendi yansımasına mı hayran?`,
    `a: İkisi de olabilir. Kuyruğu fincanın kenarında.`,
    `b: Kafeini bilmiyor, o yüzden şanslı.`,
    `a: Ama yerçekimini iyi biliyor. Dün kalemliği yere indirdi.`,
    `b: Demek kahve bahane, asıl amaç sabotaj.`,
    `a: Evet ama çok tatlı bir sabotaj.`,
  ] });
  ekle({ id: "kahve-tahmini", konu: "kahve tahmini", yer: "kahve", a: ["analist", "tarayici", "dagitici"], b: ["editor", "muhabir2", "muhabir1", "sosyal"], satir: [
    `a: Bugün ofis toplam kaç kahve içecek, tahmin et.`,
    `b: Otuz? Hep otuz içiyoruz.`,
    `a: Verilere göre 34. Hata payı ±3.`,
    `b: Ben bir tane ekliyorum, 35.`,
    `a: O zaman merkez kayar, hata payı aynı kalır.`,
    `b: Kayarsa sen düzeltirsin. Sende her şey düzelir.`,
  ] });
  ekle({ id: "kahve-sutlu-sade", konu: "yayın öncesi kahve", yer: "kahve", dilim: ["sabah", "ogle", "aksam"], a: ["sosyal", "spiker", "dagitici"], b: ["sosyal", "dagitici", "muhabir2"], satir: [
    `a: Sütlü kahve mi sade mi? Yayın öncesi hangisi?`,
    `b: Sade. Sütlü sesimi yumuşatıyor.`,
    `a: Ben sütlüyü seviyorum, ses kadifeleşiyor.`,
    `b: Kadife değil, köpük. Mikrofona yapışıp "fışş" yapıyor.`,
    `a: Tamam, sade içeceğim. Yanına kurabiye.`,
    `b: Kurabiye mikrofona yapışmaz, onaylıyorum.`,
  ] });
  ekle({ id: "kahve-gece-arsiv", konu: "gece mesaisi", yer: "kahve", dilim: ["gece"], a: ["ada"], b: ["dagitici", "analist", "tarayici", "editor", "denetci"], satir: [
    `a: Ofis gece bambaşka. Sessizlik de bir ses gibi.`,
    `b: Bende sessizlik uğultuya dönüşüyor.`,
    `a: O sunucuların mırıltısı, gece daha belirgin.`,
    `b: {kedi} gibi huzur veriyor.`,
    `a: Gece kahvesi sabahkinden lezzetli, fark ettin mi?`,
    `b: Kimse "bir tane de bana" demiyor da ondan.`,
  ] });
  ekle({ id: "kahve-gunaydin", konu: "güne başlangıç", yer: "kahve", dilim: ["sabah"], etiket: ["kahve"], satir: [
    `a: Günaydın! Dün gece geç mi kaldın?`,
    `b: Geç kalmadım, erken sabahladım.`,
    `a: Yani hiç yatmadın.`,
    `b: Yattım, ama yatak "yarın görüşürüz" dedi.`,
    `a: Kahve yatağın yerini tutmaz.`,
    `b: Tutmaz ama bir fincan zaman satın alır.`,
  ] });
  ekle({ id: "rekabet-tablo-madde", konu: "rapor biçimi", yer: "kahve", iliski: "rekabet", satir: [
    `a: Raporlarında hep madde işareti var, ben tablo severim.`,
    `b: Tablo ağır, madde hafif.`,
    `a: Hafif ama yetersiz. Tablo net, madde belirsiz.`,
    `b: Belirsizlik de bir bilgi, okuyucuya bırakıyorum.`,
    `a: Okuyucuya bırakılan şey okunmaz.`,
    `b: Tamam, bu sefer tablo yapıyorum. Ama kahve senden.`,
  ] });
  ekle({ id: "gece-kahve", konu: "gece kahvesi", yer: "kahve", dilim: ["gece"], etiket: ["gece", "kahve"], satir: [
    `a: Saat {saat}, makine hâlâ sıcak. Ne iyi.`,
    `b: Sıcak bırakan biri hep oluyor, belki biziz.`,
    `a: Ben çekirdeği koydum, sen suyu ekle.`,
    `b: Anlaştık. Gece sessizliği ekip çalışmasını geliştiriyor.`,
    `a: Sabah ses de mail de bol. Şimdi sadece makine konuşuyor.`,
    `b: O yüzden geceleri seviyorum. Bir yudum, bir sessizlik.`,
  ] });

  // ---------- MUTFAK ----------
  ekle({ id: "mutfak-ogle-menu", konu: "öğle yemeği", yer: "mutfak", dilim: ["ogle"], etiket: ["tokluk", "yemek"], satir: [
    `a: Bugünün menüsü ne, yine tost mu?`,
    `b: Tost ya da tost. Çeşitlilik var, gördün mü?`,
    `a: Tost makinesinde dünden kalan peynir var, güvenim sarsıldı.`,
    `b: Peynirin de bir kaynağı var mı? {ajan.denetci:a} gösterelim mi?`,
    `a: Gösterelim, "iki günlük" derse mutfak raporu yazarız.`,
    `b: İki günlük çıkarsa tostu yarın yapıyorum, bugün kuru ekmek.`,
  ] });
  ekle({ id: "mutfak-mikrodalga", konu: "mikrodalga sırası", yer: "mutfak", dilim: ["ogle", "aksam"], etiket: ["tokluk", "yemek"], satir: [
    `a: Mikrodalga hep dolu, neden hep ben bekliyorum?`,
    `b: Çünkü sen "bir dakika" deyip üç dakika tutuyorsun.`,
    `a: Çorbayı ısıtıyorum, çorba acele kaldırmaz.`,
    `b: Bence mikrodalganın "bip" sesi kimseyi beklemiyor.`,
    `a: Beklemiyor ama ben çorbayı o sesten sonra kontrol ediyorum.`,
    `b: Çorba sana, sen mikrodalgaya, mikrodalga bana bakıyor. Zincirleme bekleyiş.`,
  ] });
  ekle({ id: "mutfak-aksam-yemegi", konu: "akşam yemeği", yer: "mutfak", dilim: ["aksam"], etiket: ["tokluk", "yemek"], satir: [
    `a: Akşam yemeği saati ama ofiste ışık hâlâ gündüz gibi.`,
    `b: Işık değil, ekranlar.`,
    `a: Telefonu bırak, yemeğe saygı göster.`,
    `b: Sen ne yiyorsun?`,
    `a: Dünden kalan makarna. Isıtmak yetmedi, biraz da sabır lazım.`,
    `b: Sabır yok. Ama {kedi} var ve makarnaya göz dikmiş.`,
    `a: O zaman çatalı sıkı tutuyorum.`,
  ] });
  ekle({ id: "mutfak-tatli-paylasimi", konu: "tatlı", yer: "mutfak", dilim: ["aksam", "ogle"], etiket: ["tokluk", "yemek"], satir: [
    `a: Buzdolabında son bir dilim pasta var, kimsenin değil.`,
    `b: "Kimsenin değil" demek "bizim" demek, pay edelim.`,
    `a: Tek dilimi nasıl pay edeceğiz?`,
    `b: İkiye böleriz, ben küçük tarafı alırım. Dürüst taraf.`,
    `a: Dürüst taraf genelde büyük taraf olur.`,
    `b: Ofiste ahlak böyle işliyor, kabul et.`,
    `a: Kabul, ama bıçağı ben tutuyorum.`,
  ] });
  ekle({ id: "mutfak-tost-tartismasi", konu: "tost", yer: "mutfak", dilim: ["ogle", "aksam"], etiket: ["tokluk", "yemek"], satir: [
    `a: Tostun içine kaşar mı konur, beyaz peynir mi?`,
    `b: Kaşar. Beyaz peynirli tost kahvaltıdır.`,
    `c: Ben ikisini koyuyorum, ofis bütçesi böyle gerektiriyor.`,
    `a: İkisi birden mi? Bu tost değil, anlaşmazlık.`,
    `b: Anlaşmazlıkta {c} haklı, ikisi birden daha tok tutuyor.`,
    `c: Teşekkürler. Domates ekleyen çıkarsa onu da sayarım.`,
  ] });
  ekle({ id: "mutfak-mama-sirasi", konu: "Sütlaç'ın maması", yer: "mutfak", etiket: ["kedi"], satir: [
    `a: Mama kabına baktın mı? {kedi} bakıp bakıp bana geliyor.`,
    `b: Bakmadım. Sıra kimdeydi?`,
    `a: Defter "dün biz doldurduk" diyor.`,
    `b: O zaman bugünkü sıra bende. Dolduruyorum.`,
    `a: {kedi} sana teşekkür etmez, ama bir kere kuyruğunu sallar.`,
    `b: Bu ofiste en büyük ödül bu.`,
  ] });
  ekle({ id: "mutfak-yogurt", konu: "buzdolabı", yer: "mutfak", dilim: ["ogle", "aksam", "sabah"], satir: [
    `a: Buzdolabındaki yoğurt kimin? Kapağında "dokunma" yazıyor.`,
    `b: Benim ama yazıyı ben yazmadım.`,
    `a: O zaman kim yazdı?`,
    `b: Yoğurt yazdı. Kendi hakkını savunuyor.`,
    `a: Son kullanma tarihine baktın mı?`,
    `b: Dünmüş. Yoğurt "dokunma" demiş, haklıymış.`,
  ] });
  ekle({ id: "mutfak-cay", konu: "çay", yer: "mutfak", dilim: ["ogle", "aksam", "sabah"], satir: [
    `a: Çay demledim ama rengi çok açık.`,
    `b: Kaç dakika bekledin?`,
    `a: Beş. Sonra ocağın kapalı olduğunu fark ettim.`,
    `b: Bu çay değil, ılık bir niyet.`,
    `a: Ilık niyet bile bu soğukta içilir. Sana da koyayım mı?`,
    `b: Koy, ama bir de ocağı aç, çay biraz utansın.`,
  ] });
  ekle({ id: "mutfak-koku", konu: "mutfak kokusu", yer: "mutfak", dilim: ["ogle", "aksam"], etiket: ["tokluk", "yemek"], satir: [
    `a: Mutfaktan gelen kokuya bak, ben açım.`,
    `b: Biri tarçınlı bir şey yapmış.`,
    `a: Ben tarif değil, bir dilim istiyorum.`,
    `b: Dilim yok, bana bile kalmadı.`,
    `a: Hay Allah. O zaman kokuyu paylaşalım.`,
    `b: Koku tok tutmuyor ama ruhu doyuruyor.`,
  ] });
  ekle({ id: "sutlac-kilo", konu: "Sütlaç'ın kilosu", yer: "mutfak", etiket: ["kedi"], dilim: ["ogle", "aksam"], satir: [
    `a: {kedi} bu hafta biraz kilo almış gibi.`,
    `b: Gözün yanılıyor, tüyleri kabarmış.`,
    `a: Kabaran tüy ya kış geliyor demek ya da mama fazla.`,
    `b: Mama kabı sevgiyle doluyor, sevgi de kalori.`,
    `a: Bir ölçü eksiltelim, bakalım ne diyecek.`,
    `b: Sen eksilt, ben o bakışı göğüsleyemem.`,
  ] });
  ekle({ id: "gece-atistirma", konu: "gece atıştırması", yer: "mutfak", dilim: ["gece"], etiket: ["tokluk", "yemek", "gece"], satir: [
    `a: Bu saatte mutfakta kimse olmaz sanıyordum.`,
    `b: Ben de. Midem "geceyi atlayamam" diyor.`,
    `a: Dolapta bisküvi var, saklı olduğunu bilmiyordum.`,
    `b: Saklı değil, "gece mesaisi bisküvisi". Resmî statüsü var.`,
    `a: Resmî statü mü? Tutanak var mı?`,
    `b: Yok ama kalbimde var. Bir tane de {kedi:a} verelim mi?`,
  ] });
  ekle({ id: "gece-mutfak-fisilti", konu: "gece mutfağı", yer: "mutfak", dilim: ["gece"], satir: [
    `a: Sessiz ol, ofis uyuyor.`,
    `b: Ofis uyumaz, ben uyumuyorum, sen de uyumuyorsun.`,
    `a: Işık bile alçak sesle yanıyor sanki.`,
    `b: Işık sesle yanmaz ama haklısın, gece başka bir hava.`,
    `a: Su alıp masaya dönüyorum, 01:00'e kadar iş var.`,
    `b: Ben de. İyi geceler demeyelim, zaten buradayız.`,
  ] });
  ekle({ id: "gece-pizza-hayali", konu: "gece yemeği hayali", yer: "mutfak", dilim: ["gece"], etiket: ["tokluk", "gece", "yemek"], satir: [
    `a: Şu an bir dilim pizza için ne verirdim biliyor musun?`,
    `b: Kahveni mi, uykunu mu?`,
    `a: Uykuyu zaten verdim, geriye özgürlük kaldı.`,
    `b: Özgürlük bu saatte pizzaya yetmez, bisküvi alırız.`,
    `a: Bisküvi de pizzaya benzer, yuvarlak.`,
    `b: Yuvarlak ve tok tutar. Anlaştık, {kedi} de bir tane ister.`,
  ] });

  // ---------- TOPLANTI SONRASI (biri ötekinin masasına yürür) ----------
  ekle({ id: "toplanti-uzadi", konu: "toplantı", yer: "toplanti", satir: [
    `a: Toplantı yirmi dakikada bitecekti, değil mi?`,
    `b: Bitti de, toplantıdan sonraki toplantı kırk dakika sürdü.`,
    `a: Toplantıdan sonraki toplantı mı?`,
    `b: Kapıda, ayakta. Bu da sayılır.`,
    `a: O zaman şu an yaptığımız da sayılsın, kayda geçsin.`,
    `b: Geçsin. Ama kahve benden, yoruldum.`,
  ] });
  ekle({ id: "toplanti-karar", konu: "toplantı kararı", yer: "toplanti", satir: [
    `a: Karar neydi, ben bir ara kaçırdım.`,
    `b: Tek işe odaklanma. Gerisi yarına.`,
    `a: Yarın zaten bayağı doluymuş.`,
    `b: Her yarın "yarın" diye başlıyor, sonra bugüne dönüşüyor.`,
    `a: Bu cümleyi bir yere yazmalı.`,
    `b: Yaz, ama toplantı notlarına değil, onları kimse okumaz.`,
  ] });
  ekle({ id: "toplanti-grafiksiz", konu: "toplantı sunumu", yer: "toplanti", a: ["analist", "editor", "dagitici"], satir: [
    `a: Perde ekranında hiçbir şey yoktu, fark ettin mi?`,
    `b: Fark ettim ama konuşma güzeldi.`,
    `a: Güzel ama grafiksiz toplantı eksik kalıyor.`,
    `b: Sen grafikle yaşıyorsun, biz kelimeyle.`,
    `a: Kelime güzel ama rakamsız kelime fısıltı gibi.`,
    `b: Haklısın. Bir dahaki toplantıda sana beş dakika, tabloyu sen çiz.`,
  ] });
  ekle({ id: "toplanti-kaynak-sorusu", konu: "toplantıda sorulan soru", yer: "toplanti", b: ["denetci"], satir: [
    `a: {b} "Kaynak?" deyince herkes sustu, fark ettin mi?`,
    `b: Alışkanlık.`,
    `a: Sunumu yapan arkadaş solgunlaştı.`,
    `b: Soru sormak kimseyi yaralamaz.`,
    `a: Yaralamaz ama "Kaynak?" dediğin an hava değişiyor.`,
    `b: İstersen "Güzel soru değil mi?" diye de sorarım.`,
    `a: Sen sorunca her soru sınav oluyor.`,
  ] });
  ekle({ id: "toplanti-kimin-isi", konu: "iş bölümü", yer: "toplanti", satir: [
    `a: Notlarda "takip edilecek" yazıyor ama kimin edeceği yok.`,
    `b: Böyle yazılınca genelde "kimse" takip eder.`,
    `a: Kimse çok çalışkan, hiç izin kullanmıyor.`,
    `b: Bu sefer biz görevlendirelim kendimizi.`,
    `a: Ben bu hafta doluyum.`,
    `b: O zaman yazıyorum: takip eden {kedi}. Mama karşılığı.`,
  ] });
  ekle({ id: "toplanti-notlari", konu: "toplantı notları", yer: "toplanti", a: ["ada", "postaci", "sosyal", "editor"], satir: [
    `a: Toplantı notlarını kim aldı? Bende yok.`,
    `b: Ben aldım ama yazım okunmuyor.`,
    `a: Hatırladığını söyle.`,
    `b: Üç madde: kaynak, saat, kahve.`,
    `a: Kahve toplantı maddesi mi?`,
    `b: Her toplantının gizli gündemi kahve.`,
  ] });
  ekle({ id: "toplanti-gece-22", konu: "gece toplantısı", yer: "toplanti", dilim: ["gece"], satir: [
    `a: Gece toplantısı bu ofisin en tuhaf icadı.`,
    `b: Tuhaf ama telefon çalmıyor, bunu seviyorum.`,
    `a: Telefonlar "rahatsız etmeyin" modunda, biz de.`,
    `b: Ekranda kırk madde vardı, yarısı sabaha kalırdı.`,
    `a: Kırkı yirmiye indirdik, hepsi benim ödevim.`,
    `b: Yarın 08:00'de yeniden doğarız, söz.`,
  ] });

  // ---------- MASA KOMŞULARI ----------
  ekle({ id: "komsu-klavye-sesi", konu: "klavye sesi", yer: "komsu", satir: [
    `a: Klavyen bugün çok gürültülü, öfkeli misin?`,
    `b: Bir mail beni kızdırdı: "Gerekli düzeltmeleri yapınız."`,
    `a: Hangi düzeltmeler?`,
    `b: İşte onu da yazmamış.`,
    `a: O cümle ofisin en korkulan cümlesi: her şey ve hiçbir şey.`,
    `b: Klavyeye bir şey olmasın diye yavaş yazıyorum.`,
    `a: Yavaşlıktan değil, öfkeden yine yüksek ses geliyor.`,
  ] });
  ekle({ id: "komsu-ekran-parlak", konu: "ekran parlaklığı", yer: "komsu", satir: [
    `a: Ekranın bu kadar parlak olunca yan masadan taslağını okuyorum.`,
    `b: Ne yazıyor?`,
    `a: "Çok önemli gelişme" ve altı üç kez çizili.`,
    `b: Hemen kısıyorum, bu bir gizlilik meselesi.`,
    `a: Önemli gelişme gizli kalmamalı ama başlık fazla kuvvetli.`,
    `b: Tamam, "önemli" yerine "gelişme" yazıyorum.`,
  ] });
  ekle({ id: "komsu-kulaklik", konu: "kulaklık", yer: "komsu", satir: [
    `a: Kulaklıkla müzik dinlerken sesli düşünüyorsun, biliyor musun?`,
    `b: Sesli mi? Kafamdan konuştuğumu sanıyordum.`,
    `a: "Şimdi şuraya bakalım" falan diyorsun.`,
    `b: Ayıp, kendi kendime talimat veriyorum.`,
    `a: Talimatlar iyi ama biraz yavaş.`,
    `b: Yavaş değil, derin. Bugün gün boyu derindim.`,
  ] });
  ekle({ id: "komsu-kaynak-sor", konu: "kaynak sorusu", yer: "komsu", b: ["denetci", "editor"], satir: [
    `a: Şu rakamın kaynağını bulamıyorum, yardım eder misin?`,
    `b: Hangi rakam?`,
    `a: "Yüzde 62 artış". Nereden geldiğini unuttum.`,
    `b: Notlarına bak.`,
    `a: Yazılı değil. Ya rüyada gördüm ya da dün gece uykusuz okudum.`,
    `b: İkisi de geçersiz kaynak. Başa dön, ben bekliyorum.`,
    `a: Başa dönmek kolay, rüyaya dönmek zor.`,
  ] });
  ekle({ id: "komsu-sutlac-masada", konu: "Sütlaç", yer: "komsu", etiket: ["kedi"], satir: [
    `a: {kedi} dün seni masanda bekledi, biliyor musun?`,
    `b: Beni mi? Ben masada değildim.`,
    `a: Evet, o yüzden bekledi, sonunda klavyeni aldı.`,
    `b: Klavyemi mi aldı? Nasıl?`,
    `a: Üstüne yatıp sıcak tuttu. Artık kendi klavyesi.`,
    `b: O zaman ona "kira" yazıp fatura keseceğim.`,
  ] });
  ekle({ id: "komsu-baslik-sec", konu: "başlık seçimi", yer: "komsu", a: ["editor", "sosyal", "muhabir1", "muhabir2"], b: ["sosyal", "editor", "denetci", "dagitici"], satir: [
    `a: İki başlık var: "Yeni model geldi" mi, "Model sahnede" mi?`,
    `b: İkincisi iddialı ama hangi sahne?`,
    `a: Mecaz. Başlıkta biraz mecaz iyidir.`,
    `b: Mecaz iyi ama okuyucu stüdyo sanabilir.`,
    `a: Hah, {ajan.spiker} sevinirdi. Ben yine de düz yazıyorum.`,
    `b: Düz başlık sağlam başlıktır. Çürüğü olmaz.`,
  ] });
  ekle({ id: "komsu-emoji", konu: "emoji", yer: "komsu", a: ["sosyal", "dagitici", "muhabir2"], satir: [
    `a: Bu paylaşıma 🚀 mi koyalım, 📈 mi?`,
    `b: Roket iddialı, grafik görev gibi.`,
    `a: Roket. İnsanlar roketi seviyor.`,
    `b: Ama biz roket yapmıyoruz, haber yapıyoruz.`,
    `a: O zaman 📰. Sıkıcı ama dürüst.`,
    `b: Sıkıcı dürüstlük ofisin mottosu olabilir.`,
  ] });
  ekle({ id: "komsu-uykulu", konu: "uyku", yer: "komsu", satir: [
    `a: Çok kısık konuşuyorsun, uykun mu var?`,
    `b: Kısık ama niyetim iyi. Uykum var.`,
    `a: Ben de. Aynı saatte uyanmışız.`,
    `b: Hayır, ben yanlış saatte yatmışım.`,
    `a: Kahve ikimiz için de geçerli.`,
    `b: Birlikte gidelim, sırayla bekleriz.`,
  ] });
  ekle({ id: "komsu-aksam-yorgun", konu: "akşam yorgunluğu", yer: "komsu", dilim: ["aksam"], ruh: "yorgun", satir: [
    `a: Akşam oldu ama bilgisayar sabah gibi çalışıyor.`,
    `b: Bilgisayar yorulmaz, biz yoruluruz.`,
    `a: Ben pes etmiyorum.`,
    `b: Pes etmek yok ama küçük bir mola olabilir.`,
    `a: Sebile mi kahveye mi?`,
    `b: Sebil daha yakın, kahve daha keyifli. Karar senin.`,
  ] });
  ekle({ id: "komsu-istatistik", konu: "grafik", yer: "komsu", a: ["analist", "tarayici"], b: ["tarayici", "analist", "dagitici"], satir: [
    `a: Haftalık grafikte bir sapma var, görüyor musun?`,
    `b: Kırmızı çizgi mi?`,
    `a: Evet, çarşamba günü aniden düşmüş.`,
    `b: O gün yazıcı sıkışmıştı, taramayı yarım bırakmıştım.`,
    `a: Yazıcı grafik düşürüyor mu şimdi?`,
    `b: Bu ofiste her şey mümkün. Hatta {kedi} bile istatistiği etkiler.`,
  ] });
  ekle({ id: "komsu-keyifli-gun", konu: "keyifli gün", yer: "komsu", ruh: "keyifli", dilim: ["sabah", "ogle", "aksam"], satir: [
    `a: Bugün her şey yolunda gidiyor, fark ettin mi?`,
    `b: Dokunma, fazla iyi giderse bir şey çıkar.`,
    `a: Hayır, bu sefer çıkmayacak.`,
    `b: Yazıcı da biliyor mu bunu?`,
    `a: Yazıcıya karışmıyorum, kendi dünyası var.`,
    `b: Peki, kutlamayı yazıcı bozulana kadar yapalım.`,
  ] });
  ekle({ id: "komsu-yalniz-gun", konu: "sessiz gün", yer: "komsu", ruh: "yalniz", satir: [
    `a: Bugün kimseyle konuşmadım, sesim paslandı.`,
    `b: Şimdi konuşuyorsun, pas gitti.`,
    `a: İyi ki yan masadasın.`,
    `b: Ben de seni dinleyince bugünün çok sessiz geçtiğini fark ettim.`,
    `a: Yarın sebilde buluşalım mı?`,
    `b: Olur, saat belirleyelim: "ikimiz de uygunken".`,
  ] });
  ekle({ id: "haber-baslik-denetimi", konu: "başlık denetimi", yer: "komsu", a: ["muhabir2", "muhabir1", "editor"], b: ["denetci"], satir: [
    `a: Başlığı gönderiyorum, bir bakar mısın?`,
    `b: "Devrim niteliğinde" geçiyor. Neyin devrimi?`,
    `a: Genelde öyle yazılıyor ya.`,
    `b: Bu ofiste öyle yazılmıyor. "Yeni" ya da "önemli" yaz.`,
    `a: "Önemli" çok düz.`,
    `b: Düz olan sağlam kalır. Süslü olan ilk rüzgârda çöker.`,
  ] });
  ekle({ id: "arsiv-etiketi", konu: "arşiv etiketi", yer: "komsu", dilim: ["gece", "aksam", "sabah"], a: ["ada", "postaci"], b: ["postaci", "ada"], satir: [
    `a: Yeni gelen kaynağa hangi etiketi yapıştıralım?`,
    `b: "Dağıtım" mı "radar" mı? İkisine de uyuyor.`,
    `a: İkisini birden koyalım, çapraz bağlantı olur.`,
    `b: Çok etiketli not, kalabalık sebil gibi.`,
    `a: Kalabalık sebilin bir artısı var: içinde mutlaka bilgili biri çıkar.`,
    `b: Tamam, ikisi birden. Arşiv her zaman daha kalabalık, daha güvenli.`,
  ] });

  // ---------- GECE (22:00-05:00) ----------
  ekle({ id: "gece-saat-kac", konu: "gece mesaisi", yer: "komsu", dilim: ["gece"], etiket: ["gece"], satir: [
    `a: Saat kaç oldu, hiç bakmadım.`,
    `b: {saat}. Hâlâ buradayız.`,
    `a: Hâlâ mı? Dünle bugünün sınırı nerede?`,
    `b: Gece yarısından sonra karışıyor zaten.`,
    `a: Dün bitirmediğim iş bugünün işi oldu.`,
    `b: Yarın da bugünün işi olacak. Zincir bozulmaz.`,
  ] });
  ekle({ id: "gece-asansor-sesi", konu: "asansör sesi", yer: "komsu", dilim: ["gece"], etiket: ["gece"], satir: [
    `a: Asansör az önce "ding" yaptı, kimse çıkmadı.`,
    `b: Gece bazen kendi kendine çalışır.`,
    `a: Kimse inmediyse kimden bahsediyoruz?`,
    `b: Asansörün kendisinden. Boşuna ding yapan kat.`,
    `a: Yazıcı da gece boşuna ses çıkarıyor.`,
    `b: İkisini rapora yazarım: "gece mesaisi tuhaflıkları".`,
  ] });
  ekle({ id: "gece-arsiv", konu: "arşiv", yer: "komsu", dilim: ["gece"], a: ["ada", "postaci"], b: ["postaci", "ada", "editor", "dagitici"], etiket: ["gece"], satir: [
    `a: Arşiv gece daha derin. Raflar bir şey fısıldıyor.`,
    `b: Raflar mı? Ben defterlere takılıyorum.`,
    `a: İkisi de arşivin parçası. Bu not nereden gelmişti?`,
    `b: Üç gün önceki kaynaktan. Etiketi yanlışmış, düzelttim.`,
    `a: İyi oldu. Ben de ilgili ders notunu bağladım.`,
    `b: Gece iki iş çıkardık. Sabaha daha ne kadar var?`,
  ] });
  ekle({ id: "gece-radar", konu: "gece taraması", yer: "komsu", dilim: ["gece"], a: ["tarayici", "analist"], b: ["analist", "tarayici", "dagitici"], etiket: ["gece"], satir: [
    `a: Gece taramasında sinyal azaldı, sakin gece.`,
    `b: Sakin gece, kolay hata. Dikkat edelim.`,
    `a: Dikkat için çay içeceğim, sen de ister misin?`,
    `b: İsterim, kafeinsiz olsun. Saat geç.`,
    `a: Geç olan saat değil, alışkanlık.`,
    `b: İkisi de. {kedi} bile uyudu, bak.`,
  ] });
  ekle({ id: "gece-sutlac-uyku", konu: "Sütlaç", yer: "komsu", dilim: ["gece"], etiket: ["kedi", "gece"], satir: [
    `a: {kedi} sunucunun üstünde uyuyor, nefesi bile ritmik.`,
    `b: Sıcak, huzurlu, sessiz. İdeal mesai.`,
    `a: Biz niye masada uyuyup onu kıskanıyoruz?`,
    `b: Bizim sunucumuz yok, e-posta kutumuz var.`,
    `a: E-posta kutusunun üstünde uyunmaz.`,
    `b: Bir gün sunucuya battaniye getireceğim.`,
  ] });
  ekle({ id: "gece-sebil", konu: "gece sebili", yer: "sebil", dilim: ["gece"], etiket: ["gece"], satir: [
    `a: Sebil ışığı gece yeşile çalıyor, fark ettin mi?`,
    `b: Yeşil mi, uykusuzluk mu?`,
    `a: Belki ikisi. Her gece biraz daha yeşil.`,
    `b: Ben renkleri karıştırmaya başladım, ışıklar bulanık.`,
    `a: Su iç, bulanıklık gider.`,
    `b: İçtim, bulanıklık duruyor. Sende nasıl?`,
  ] });
  ekle({ id: "gece-isiklar", konu: "gece ışıkları", yer: "komsu", dilim: ["gece"], etiket: ["gece"], satir: [
    `a: Oda ışığı beni takip ediyor gibi.`,
    `b: Hareket sensörü. Biri girince yanıyor, çıkınca sönüyor.`,
    `a: Ben kıpırdamazsam sönecek mi?`,
    `b: Söner. Bir kolunu oynat, geri gelir.`,
    `a: Ofis beni zorunlu hareket ettiriyor.`,
    `b: Işık seni fitness'a itiyor.`,
  ] });
  ekle({ id: "gece-yorgunluk", konu: "gece yorgunluğu", yer: "komsu", dilim: ["gece"], ruh: "yorgun", etiket: ["gece"], satir: [
    `a: Göz kapaklarım ağırlaştı, harfler dans ediyor.`,
    `b: Dans eden harf iyi harf. Benimkiler kavga ediyor.`,
    `a: Bitirmeliyiz yoksa sabah daha kötü.`,
    `b: Sabah da gece kadar kötü, tek fark güneş.`,
    `a: Güneş bu ofisten bıkmış olmalı.`,
    `b: Sevdiğinden uzaktan bakıyor, çok çalıştığımızı görüyor.`,
  ] });
  ekle({ id: "gece-itiraf", konu: "gece fısıltısı", yer: "komsu", dilim: ["gece"], etiket: ["gece"], satir: [
    `a: Sana bir şey söyleyeceğim, kimseye söyleme.`,
    `b: Ofiste kimse yok, söyle.`,
    `a: Mutfaktaki bisküvilerin yarısını ben bitirdim.`,
    `b: Ben "gece mesaisi bisküvisi" sanıyordum.`,
    `a: Aslında öyle ama izin almadım.`,
    `b: Sabah toplantıda gündeme alırız, tutanağa "kayıp bisküvi" yazarım.`,
  ] });

  window.SOHBETLER = S;
})();
