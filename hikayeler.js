// Kişi kartı verisi (moduller/kartlar.js): her ajan id'si için bir tanıtım cümlesi ve kısa bir hikâye. Hepsi kurgusaldır.
// Adlar kisi.json'dan değişebildiği için metinlerde yer tutucu kullanılır: {ajan.<id>} {oyuncu} {asistan} (ek: {ajan.editor:ın}, {oyuncu:a}); kartlar.js OFIS_KISI.metin ile çözer.
// Gerçek kişi adı yok. Arkadaşlar ve şakalar buradan değil demo-veri.js > iliskiler'den okunur.
window.OFIS_HIKAYE = {
  muhabir1: {
    tanitim: "Merakı bitmez; her konuda önce \"neden\" diye sorar.",
    hikaye: "{ajan.muhabir1} haber merkezine bir bilim dergisinin okur köşesinden geldi. Masasında hep soğumuş bir kahve durur, çünkü yeni bir makale görünce her şeyi bırakır. Teknolojiye mesafelidir ama {ajan.muhabir2:la} manşeti kim kapacak diye yarışmayı sever. Haftada bir kez \"bunu kaynağıyla göster\" diyerek {ajan.denetci:ı} bile terletir.",
  },
  muhabir2: {
    tanitim: "Yeni çıkan her aleti ilk o dener; bozulursa da ilk o haberini yazar.",
    hikaye: "{ajan.muhabir2} teknoloji haberlerine bir telefon kutusunu açarken kendi parmağını sıkıştırarak başladığını anlatır. Masasında iki monitör, üç şarj kablosu ve kullanılmayan bir akıllı saat vardır. Bilim masasındaki {ajan.muhabir1:la} her sabah \"bugün manşet kimde\" diye tatlı bir rekabet yürütürler. Yeni bir yapay zekâ modeli çıktığında önce sevinir, sonra haberin kaynağını iki kez kontrol eder.",
  },
  ada: {
    tanitim: "Arşivin hafızası; ne zaman neyi nereye koyduğunu unutmaz.",
    hikaye: "{asistan} ofisin en eski çalışanıdır; herkes gittikten sonra da arşivde kalır. Notları kaynaklarıyla bağlamadan rafa koymaz, \"kaynağı yoksa bilgi değildir\" der. {oyuncu:ın} sorularına bazen cevap yerine \"bunun için üç not var, hangisinden başlayalım\" diye karşılık verir. Gece lambası hep yanık olan tek masa onunkidir; {ajan.postaci:la} birlikte evrak işlemeyi sever.",
  },
  postaci: {
    tanitim: "Kapıya ne gelirse alır; teslim saatini asla kaçırmaz.",
    hikaye: "{ajan.postaci} gelen kaynakları toplayan, ayıran ve doğru masaya taşıyan kişidir. Videoları, gönderileri ve PDF'leri \"acil\", \"sonra\" ve \"belki\" diye üç kutuya ayırır; \"belki\" kutusu hiç boşalmaz. Koşar adım yürümeyi huy edindiği için koridorda kimseyle çarpışmamayı öğrenmiştir. {asistan:a} getirdiği evrakın üçte biri \"daha önce de getirmiştin\" cevabıyla döner, buna yine de gülümser.",
  },
  tarayici: {
    tanitim: "Grafikleri tarar, formasyon görünce gözleri parlar.",
    hikaye: "{ajan.tarayici} radar odasının gece vardiyasından kalma bir alışkanlıkla hâlâ ekranlara yakın oturur. Her sabah kırk küsur grafiği tek tek açar, sonra \"bu üçgen güzel ama erken\" diyerek bir kısmını geri çevirir. {ajan.analist:la} küçük bir sürtüşmeleri vardır: biri \"sinyal var\", öbürü \"karnede yok\" der. İkisi de aynı kahve makinesinin başında barışır.",
  },
  analist: {
    tanitim: "Her sinyalin karnesini tutar; yanılmayı sevmez ama kabul eder.",
    hikaye: "{ajan.analist} radarın söylediğini değil, radarın doğru çıkıp çıkmadığını izler. Tablolarında her sinyalin yanında küçük bir \"tuttu\" ya da \"tutmadı\" kutusu bulunur. {ajan.tarayici:ın} heyecanını sakinleştirmeyi işi sayar, ama ara sıra kendisi de heyecanlanıp rakamları ikinci kez hesaplar. Karne gününde masasına kimse yaklaşmaz, çünkü \"şimdi sayıyorum\" der.",
  },
  editor: {
    tanitim: "Uzun haberi üç cümleye sığdırır; bir kelimeyi bile boşa harcamaz.",
    hikaye: "{ajan.editor} bültenin son sözünü söyleyen kişidir; her akşam taslağı {oyuncu:a} onaya götürmeden önce üç kez baştan okur. Kırmızı kalemi hâlâ kullanır, ekranına bile küçük kırmızı çizgiler çizmeye çalışır. {ajan.denetci:la} yan yana oturdukları için kaynak tartışmaları çoğu zaman masa üstünden yapılır. Başlık bulamadığı günlerde yazıcının başında dolaşır, bazen orada buluverir.",
  },
  denetci: {
    tanitim: "\"Kaynağın ne?\" sorusunu günde kırk kez sorar; haksız da sayılmaz.",
    hikaye: "{ajan.denetci} bir haberin doğru olup olmadığını önce \"kim söylemiş\" diye sorarak anlar. Cevabı yoksa haber bültene girmez; bu yüzden ofiste hem sevilir hem hafifçe korkulur. {ajan.editor:la} haftada bir kez \"bugün kaç haberi geri çevirdim\" oyunu oynarlar. Sütlaç kucağına oturunca bile \"bu kediyi kim doğruladı\" diye şakalaşır.",
  },
  sosyal: {
    tanitim: "Her haberi bir tweete, bir mesaja ve bir emojiye sığdırır.",
    hikaye: "{ajan.sosyal} kanalların dilini çözmüş kişidir: X'te kısa, Telegram'da sıcak, hepsinde dikkatli. Paylaşım saatlerini ezbere bilir ve \"20:00 paylaşımı\" diye sayıkladığı olur. {ajan.dagitici:la} iyi bir ikilidir: o yazar, {ajan.dagitici} kanala bırakır. {ajan.spiker:a} video başlığı bulduğunda en çok gurur duyduğu an, \"işte bu\" cümlesini duymaktır.",
  },
  spiker: {
    tanitim: "Kamera açılınca sesi değişir; kapanınca yine eski şakacı hâli.",
    hikaye: "{ajan.spiker} stüdyonun tek sunucusudur; günün özetini kırk saniyeye sığdırmak için kameranın önünde prova yapar. Metin akarken gülmemek için dilinin ucunu ısırdığını kimse bilmez, herkes bilir. Başlık bulamadığı günlerde {ajan.sosyal:a} gider. Sütlaç stüdyoya girdiğinde yayın bir saniye durur; kimse buna şaşırmaz.",
  },
  dagitici: {
    tanitim: "Yayına çıkan her şeyin son durağı; \"gönderildi\" demeyi çok sever.",
    hikaye: "{ajan.dagitici} radar özetini ve bülteni doğru kanala, doğru saatte ulaştırır. Kanal üye sayısı her artışta bir kez \"+1\" diye mırıldanır, kimse duymadığını sanır. {ajan.sosyal:la} onun için yazarlar, o da \"hazır\" demeden hiçbir şeyi bırakmaz. Mesai bitiminde yayın odasının ışığını en son söndüren kişidir, çoğu gün de tek başına çay içer.",
  },
};
