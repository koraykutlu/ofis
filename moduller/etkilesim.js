// Ek etkileşimler ve gizli sürprizler: cozy mod (lamba + şömine + ışık dizisi), buzdolabı (mutfaktakinden yemek önerisi), mikrodalga,
// kitaplık, çerçeve (gizli not), toplantı ekranında yaklaşan tarihler, tahtada "tek küçük adım", telsiz masasında kanal gezintisi, halıda dinlenmek,
// odak modu, "Ofisi kapat" gün kapatma konuşması ve yazılan gizli kelimeler (selam, pembe, uyku, kahve, somine). Çekirdeğe MOD kancalarıyla bağlanır (window.OFIS_IC).
// Gizli şeylerin listesi: SURPRIZLER.md ("Yeni sürprizler" bölümü).
// Kişiye özel içerik kodda değil kisi.json "etkilesim" alanındadır (kisi.js > OFIS_KISI.etkilesim): tarihler (sınav/teslim), kitaplar, kanallar, gizli_kelimeler,
// hali (halıda dinlenme bölgesi), uyku_hedefi (gece hatırlatması), cerceve_notlari. Hiçbiri yoksa genel varsayılanlar kullanılır.
(() => {
  const I = () => window.OFIS_IC;
  const KISI = window.OFIS_KISI, OAD = KISI.ad;
  const rast = (l) => l[Math.floor(Math.random() * l.length)];
  const sade = (k) => ({ ü: "u", ç: "c", ş: "s", ı: "i", ö: "o", ğ: "g" })[k] || k;
  let cozy = false, cozyBas = 0, kediGonderildi = false, somineSon = 0;
  let halidaSure = 0, halidaKalpSon = 0, cerceveTik = 0, cerceveSon = 0, kanalNo = -1, kanalTur = 0, harfler = "", pembeBitis = 0, geceUyarisi = "";

  // ---------- veriler: genel varsayılanlar; kişiye özel olanlar kisi.json "etkilesim" ile gelir ----------
  const E = KISI.etkilesim || {};
  const TARIHLER = (E.tarihler || []).map((x) => ({ ad: x.ad, t: new Date(x.tarih), not: x.not || "" })).filter((x) => !isNaN(x.t));
  const KANALLAR = E.kanallar && E.kanallar.length ? E.kanallar : [
    "Kanal 1 · Kule · 118.800 AM", "Kanal 2 · Yer · 121.750 AM", "Kanal 3 · Hava durumu · 128.550 AM",
    "Kanal 4 · Gemi · 156.800 FM", "Kanal 5 · İstasyon · 145.800 FM", "Kanal 6 · Boş frekans · 433.920 FM",
  ];
  const HALI = Array.isArray(E.hali) ? E.hali : null;           // [x1, y1, x2, y2] karo; yoksa halıda dinlenme yok
  const UYKU = E.uyku_hedefi || "";                             // boşsa uyku hatırlatması ve "uyku" kelimesi genel kalır
  const KUCUK_ADIMLAR = [
    "Defteri aç, tarihi yaz. Hepsi bu.", "Tek bir örnek seç, yalnız ilk satırı yaz.", "10 dakikalık bir sayaç kur, sonra karar ver.",
    "Bir bardak su iç, sonra tek soru.", "Formül kartının ilk satırına bak.", "Telefonu başka odaya bırak, 5 dakika dene.",
    "Dünkü son soruyu yeniden oku, çözme.", "Masaya otur. Başlamak zorunda değilsin, sadece otur.",
  ];
  const CERCEVE_NOTLARI = E.cerceve_notlari && E.cerceve_notlari.length ? E.cerceve_notlari.map((t) => `Çerçevenin arkasında bir not: "${t}"`) : [
    "Çerçevenin arkasında bir not: \"Bugün küçük bir adım yeter.\"", "Bir not düştü: \"Dünün yorgunluğu bugünün sınavı değil.\"",
    "Arkasında sararmış bir kâğıt: \"Başladığın an en zor kısım biter.\"", "Not: \"Başlamak, bitirmenin yarısı değil ama en zor kısmı.\"",
  ];
  const KITAPLAR = [
    ...(E.kitaplar || []),
    { ad: "Not defterin (boş sayfa)", ipucu: "Bugünün tek hedefini en üste yaz, altı kendiliğinden gelir." },
    ...(E.kitaplar && E.kitaplar.length ? [] : [{ ad: "Kitaplıktaki eski bir kitap", ipucu: "Bir sayfa oku, sonra bırak. Merak kendiliğinden devam eder." }]),
  ];
  const MALZEMELER = ["yumurta", "domates", "peynir", "makarna", "ekmek", "mercimek", "biber", "süt", "yoğurt", "zeytin", "soğan", "patates"];
  function yemekOner(s) {
    const v = (m) => s.includes(m);
    if (v("yumurta") && v("domates")) return "Menemen: soğan/biber varsa önce onları kavur, domates, sonra yumurta. 12 dakika, tek tava.";
    if (v("yumurta") && v("peynir")) return "Peynirli omlet: yumurtayı çırp, peyniri ortaya koy, katla. 8 dakika.";
    if (v("makarna") && (v("domates") || v("biber"))) return "Sebzeli makarna: tek tencere, makarnayı haşla, domatesli sosla karıştır. 15 dakika.";
    if (v("ekmek") && v("peynir")) return "Tost ya da peynirli ekmek dilimi: tavada iki yüzü de çevir. 6 dakika.";
    if (v("mercimek")) return "Mercimek çorbası: mercimek, soğan, patates, su. 25 dakika, yarısını yarına sakla.";
    if (v("patates") && v("yumurta")) return "Patatesli yumurta: patatesi küp doğra, tavada pişir, üstüne yumurta kır. 15 dakika.";
    if (v("yoğurt")) return "Yoğurtlu bir şey: yanına ekmek ya da makarna, üstüne zeytinyağı. Pişirme yok, 5 dakika.";
    return "Elindekileri tek tavada kavur, tuz ve biberle, üstüne yumurta ya da peynir ekle. Az bulaşık, tek tabak.";
  }

  // ---------- etkileşim noktaları (karo koordinatı; r: erişim yarıçapı) ----------
  const NOKTALAR = [
    { x: 22.9, y: 8.3, r: 1.7, etiket: () => (cozy ? "Cozy modunu kapat" : "Cozy modunu aç (lamba)"), fn: () => cozyDegis() },
    { x: 18, y: 7.6, r: 1.9, etiket: () => (odak ? "Odağı bırak" : `Odak başlat (${ODAK_DK} dk)`), fn: () => odakBaslat() },
    { x: 13.9, y: 6.5, r: 1.7, etiket: () => (cozy ? "Şöminenin başına otur" : "Şöminenin yanında dur"), fn: somineTemas },
    { x: 16, y: 3.4, r: 2.2, etiket: () => "Kitaplığa bak", fn: kitaplik },
    { x: 23.2, y: 2.4, r: 2.0, etiket: () => "Çerçevelere bak", fn: cerceve },
    { x: 2.2, y: 25, r: 1.6, etiket: () => "Buzdolabını aç", fn: buzdolabi },
    { x: 9.6, y: 25, r: 1.7, etiket: () => "Mikrodalgayı çalıştır", fn: mikrodalga },
    { x: 17.4, y: 24.9, r: 1.9, etiket: () => "Sunum ekranına bak", fn: sinavSayaci },
    { x: 27.3, y: 13.7, r: 2.2, etiket: () => "Tahtaya yaz", fn: tahta },
    { x: 43, y: 29.6, r: 2.4, etiket: () => "Telsizi dinle", fn: telsiz },
  ];
  const konus = (a, t) => I().konus(a, t, true);
  const tonSeviye = () => I().TON_TABAN + (cozy ? 0.06 : 0);   // ışık tonu: tema tabanı + cozy mod'un sıcaklığı
  const sor = (metin, secenekler) => I().diyalogOzel(I().oyuncu, metin, secenekler);
  const kapat = () => I().diyalogKapat();

  function cozyDegis(sessiz) {
    const ic = I(); cozy = !cozy; cozyBas = ic.zaman; ic.ses("tak");
    ic.ton = tonSeviye();
    if (window.SES && window.SES.somine) window.SES.somine(cozy, Math.hypot(ic.oyuncu.x - 13.9, ic.oyuncu.y - 5.8));   // şömine çıtırtısı
    if (cozy) {
      if (sessiz !== true) {
        konus(ic.oyuncu, "Lambayı açtım. Şömine de yanıyor, ışıklar da.");
        const ada = ic.bul("ada"); if (ada && !ada.disarda) ic.sonra(2.2, () => konus(ada, "Çok güzel oldu. Bir şeyler çalışacaksan şimdi tam zamanı."));
      }
      ic.gunluk("Cozy mod açıldı: lamba, şömine ve ışık dizisi.", true); ic.kalpler(ic.oyuncu, 2);
      kediGonderildi = false;
    } else { if (sessiz !== true) konus(ic.oyuncu, "Işıkları kıstım."); ic.gunluk("Cozy mod kapandı.", true); }
  }

  // ---------- odak modu: 25 dakika, cozy mod açılır, bitince Ofis kutlar ve seçtiğin iş tiklenir ----------
  // Ofisteki olaylar ikinci beyne kaydolur (sunucu: notes/ofis-sohbet/<gün>.md); sunucu yoksa sessizce atlanır
  const kayit = (metin) => { try { fetch("/api/ofis-kayit", { method: "POST", headers: { "X-Ofis-Anahtar": I().ANAHTAR, "Content-Type": "application/json" }, body: JSON.stringify({ metin }) }).catch(() => {}); } catch (e) { /* yoksay */ } };
  const ODAK_DK = 25, ODAK_DEPO = "ofis-odak";
  let odak = null, odakZ = 0;
  const odakKaydet = () => { try { if (odak) localStorage.setItem(ODAK_DEPO, JSON.stringify(odak)); else localStorage.removeItem(ODAK_DEPO); } catch (e) { /* depolama kapalı */ } };
  const iki = (n) => String(n).padStart(2, "0");
  function odakChip() {
    const c = document.getElementById("odakSaat"); if (!c) return;
    if (!odak) { c.hidden = true; return; }
    const kalan = Math.max(0, odak.bitis - Date.now());
    c.textContent = `⏱ ${iki(Math.floor(kalan / 60000))}:${iki(Math.floor((kalan % 60000) / 1000))}`; c.hidden = false;
  }
  function odakSor() {
    sor(`Odak sürüyor${odak && odak.gorev ? ": " + odak.gorev.ad : ""}. Bırakmak mı istiyorsun?`, [
      { etiket: "Devam et", fn: kapat }, { etiket: "Odağı bırak", fn: () => { kapat(); odakBirak(); } },
    ]);
  }
  function odakBaslat() {
    if (odak) return odakSor();
    const P = window.OFIS_PANEL, acik = P ? P.acikGorevler().slice(0, 4) : [];
    const sec = acik.map((g) => ({ etiket: g.ad.length > 36 ? g.ad.slice(0, 35) + "…" : g.ad, fn: () => odakBasla(g) }));
    sor(`${ODAK_DK} dakikalık odak. Neye başlıyoruz? Küçük bir ilk adım yeter.`, [...sec, { etiket: "Serbest odak", fn: () => odakBasla(null) }, { etiket: "Vazgeç", fn: kapat }]);
  }
  function odakBasla(gorev) {
    const ic = I(); kapat();
    odak = { bitis: Date.now() + ODAK_DK * 60000, sure: ODAK_DK, gorev: gorev ? { id: gorev.id, ad: gorev.ad } : null };
    odakKaydet(); if (!cozy) cozyDegis(true); if (window.SES && window.SES.odakMuzigi) window.SES.odakMuzigi(true);
    ic.ses("gorev"); ic.kalpler(ic.oyuncu, 1);
    konus(ic.oyuncu, gorev && gorev.ipucu ? `${ODAK_DK} dakika başladı. İlk adım: ${gorev.ipucu}` : `${ODAK_DK} dakika başladı. Sadece başla.`);
    const ada = ic.bul("ada"); if (ada && !ada.disarda) ic.sonra(2.5, () => konus(ada, "Ben yanındayım. Süre bitince haber veririm."));
    ic.gunluk(`Odak başladı (${ODAK_DK} dk${gorev ? ": " + gorev.ad : ""}).`, true); kayit(`Odak başladı (${ODAK_DK} dk): ${gorev ? gorev.ad : "serbest"}`);
    odakDon();
  }
  function odakDon() { clearInterval(odakZ); odakChip(); odakZ = setInterval(() => { if (!odak) return clearInterval(odakZ); odakChip(); if (Date.now() >= odak.bitis) odakBitir(); }, 1000); }
  function odakBirak() { kayit(`Odak yarıda bırakıldı${odak && odak.gorev ? ": " + odak.gorev.ad : ""}`); odak = null; odakKaydet(); odakChip(); clearInterval(odakZ); if (window.SES && window.SES.odakMuzigi) window.SES.odakMuzigi(false); konus(I().oyuncu, "Odağı bıraktım. Gerekirse yeniden başlarız."); I().gunluk("Odak bırakıldı.", true); }
  function odakBitir() {
    const ic = I(), g = odak && odak.gorev; odak = null; odakKaydet(); odakChip(); clearInterval(odakZ); if (window.SES && window.SES.odakMuzigi) window.SES.odakMuzigi(false);
    ic.efekt.parti = Math.max(ic.efekt.parti, ic.zaman + 6); ic.ses("karne"); ic.ses("parti"); ic.kalpler(ic.oyuncu, 6);
    ic.gunluk(`Odak bitti${g ? ": " + g.ad : ""}. Tebrikler!`, true); kayit(`Odak tamamlandı (${ODAK_DK} dk): ${g ? g.ad + " (listede tiklendi)" : "serbest"}`);
    const oncekiBaslik = document.title; document.title = "✅ Odak bitti · " + oncekiBaslik; setTimeout(() => { document.title = oncekiBaslik; }, 20000);
    for (const a of ic.ajanlar) if (!a.oyuncu && !a.disarda && !a.konusuyor) ic.sonra(Math.random() * 1.2, () => konus(a, rast(["Başardın!", "Harika odak!", "Tebrikler!", "Alkışlar sana 👏"])));
    if (g && window.OFIS_PANEL) window.OFIS_PANEL.isaretle(g.id, true);
    sor(`${ODAK_DK} dakika tamam!${g ? " \"" + g.ad + "\" listede tiklendi." : ""} Kendine kısa bir mola hak ettin.`, [
      { etiket: "Bir tur daha", fn: () => { kapat(); odakBasla(g); } },
      { etiket: "Mola veriyorum", fn: () => { kapat(); konus(ic.oyuncu, "5 dakika mola. Su iç, biraz hareket et."); } },
    ]);
  }
  function odakDevam() {   // sayfa yenilenirse süren odak kaldığı yerden devam eder; süresi dolmuşsa sessizce silinir (tik atılmaz)
    try {
      const k = JSON.parse(localStorage.getItem(ODAK_DEPO) || "null");
      if (k && k.bitis > Date.now()) { odak = k; odakDon(); if (window.SES && window.SES.odakMuzigi) window.SES.odakMuzigi(true); } else if (k) localStorage.removeItem(ODAK_DEPO);
    } catch (e) { /* bozuk kayıt */ }
  }

  // ---------- gün kapatma: "🌙 Ofisi kapat" önce asistanın konuşmasını getirir (biten işler, yarının ilk adımı), sonra karne + çıkış ----------
  // Asistan oyuncunun yanına gelir; "Ofisi kapat" (ya da seçim yapmadan geçmek) ofisi kapatır (karne, ekip eve gider), "Biraz daha kalayım" vazgeçirir.
  // Yedek otomatik kapanışta (ofis.js > ofisKapat("oto")) konuşma yoktur. Biten/açık işler "Bugün" kartından gelir (OFIS_PANEL: dosyadaki işler + tikler).
  let kapatma = null;   // { bitir, ada, asama: "yolda" | "diyalog" | "bitti" }
  function gunKapatma(bitir) {
    const ic = I();
    if (kapatma) return true;
    if (ic.uzak || ic.ofisDurum !== "acik" || ic.diyalogAcik()) return undefined;
    const ada = ic.bul("ada"); if (!ada || ada.disarda || ada.konusuyor || ic.mesgul(ada)) return undefined;
    kapatma = { bitir, ada, asama: "yolda" }; ada.ozel = "gorev";
    konus(ada, `${KISI.ad}, günü kapatmadan önce şöyle bir bakalım.`);
    ic.gonder(ada, ic.ziyaretNoktasi(ic.oyuncu), () => { ic.yonBak(ada, ic.oyuncu); ic.sonra(0.8, kapatmaDiyalog); });
    ic.sonra(25, () => { if (kapatma && kapatma.asama === "yolda") kapatmaDiyalog(); });   // gelemezse ya da yol bulunamazsa konuşma yine başlar
    return true;
  }
  function kapatmaDiyalog() {
    const ic = I(); if (!kapatma || kapatma.asama !== "yolda") return;
    const ada = kapatma.ada, P = window.OFIS_PANEL, biten = P ? P.bitenGorevler() : [], acik = P ? P.acikGorevler() : [];
    const bitenMetin = biten.length ? biten.slice(0, 4).map((g) => g.ad).join("; ") : "listede tik yok (yaptıklarını işaretlemeyi unutma)";
    const ilk = acik[0], yarin = (ilk ? `${ilk.ad}${ilk.ipucu ? ". İlk adım: " + ilk.ipucu : ""}` : "yarın sabah plana bakıp tek bir küçük adım seçeriz").replace(/[.\s]+$/, "");
    kapatma.asama = "diyalog"; kapatma.ozet = `bitenler: ${bitenMetin}. Yarının ilk adımı: ${yarin}.`;
    ic.diyalogOzel(ada, `Bugün bitenler: ${bitenMetin}. Yarının tek ilk adımı: ${yarin}. Ofisi kapatalım mı?`, [
      { etiket: "Tamam, ofisi kapat", fn: () => kapatmaSon(true) },
      { etiket: "Biraz daha kalayım", fn: () => kapatmaSon(false) },
    ]);
  }
  function kapatmaSon(kapat_) {
    const ic = I(), k = kapatma; if (!k || k.asama === "bitti") return;
    k.asama = "bitti"; kapatma = null; if (ic.diyalogAcik()) kapat();
    const ada = k.ada;
    ic.eveDon(ada, () => { ada.ozel = null; });
    if (kapat_) {
      konus(ada, "İyi geceler. Yarın küçük bir adımla başlarız."); ic.kalpler(ada, 2); ic.ses("bildirim"); ic.gunluk("Gün kapatma: tamam, iyi geceler.", true);
      kayit(`Gün kapatma: ${k.ozet || ""}`); k.bitir();
    } else konus(ada, "Tamam, ben buradayım. Hazır olunca söylersin.");
  }
  function somineTemas() {
    const ic = I();
    if (!cozy) { konus(ic.oyuncu, "Şömine sönük. Önce lambayı açıp cozy moda geçeyim."); return; }
    konus(ic.oyuncu, rast(["Çıtır çıtır. Odanın en güzel sesi.", "Ellerimi ısıttım, şimdi çalışabilirim.", "Sütlaç buraya gelirse yerimi kaptırırım."]));
    ic.kalpler(ic.oyuncu, 1); ic.ses("mirr");
  }
  function kitaplik() {
    const k = rast(KITAPLAR);
    sor(`Kitaplıktan bir şey çektin: ${k.ad}.`, [
      { etiket: "İpucunu oku", fn: () => sor(k.ipucu, [{ etiket: "Başka kitap", fn: kitaplik }, { etiket: "Kapat", fn: kapat }]) },
      { etiket: "Kitabı yerine koy", fn: kapat },
    ]);
  }
  function cerceve() {
    const ic = I(); ic.ses("tak");
    cerceveTik = ic.zaman - cerceveSon < 8 ? cerceveTik + 1 : 1; cerceveSon = ic.zaman;
    if (cerceveTik >= 3) {
      cerceveTik = 0; ic.efekt.parti = Math.max(ic.efekt.parti, ic.zaman + 4); ic.kalpler(ic.oyuncu, 4); ic.ses("bildirim");
      sor(rast(CERCEVE_NOTLARI), [{ etiket: "Cebime koydum", fn: kapat }]);
      ic.gunluk("Gizli not bulundu: çerçevenin arkası.", true);
    } else konus(ic.oyuncu, rast(["Düzgün asılmış. Bir şey yok.", "Biraz yamuk gibi? Hayır, doğru.", "Çerçeve yerinde. Üçüncüde bir şey olabilir."]));
  }
  function buzdolabi() {
    const ic = I(), karisik = [...MALZEMELER].sort(() => Math.random() - 0.5).slice(0, 3);
    ic.ses("tak");
    sor(`Buzdolabını açtın. İçinde: ${karisik.join(", ")}.`, [
      { etiket: `${KISI.ek((ic.bul("spiker") || { ad: "Mutfaktaki" }).ad, "a")} sor: ne yapsam?`, fn: () => {
        kapat(); const sef = ic.bul("spiker");
        const metin = yemekOner(karisik);
        if (sef && !sef.disarda) { konus(sef, `Bununla mı? ${metin}`); ic.gorevBitir("kayit"); } else konus(ic.oyuncu, metin);
        ic.gunluk(`Mutfak: ${karisik.join(", ")} → ${metin.split(":")[0]}`, true);
      } },
      { etiket: "Kapıyı kapat", fn: kapat },
    ]);
  }
  function mikrodalga() {
    const ic = I(); ic.ses("yazici");
    ic.sonra(2.4, () => { ic.ses("bildirim"); konus(ic.oyuncu, rast(["Ding! Yarısı hâlâ soğuk, her zamanki gibi.", "Ding! Kokusu güzel.", "Ding! Bekle, çok sıcak."])); });
    konus(ic.oyuncu, "Bir dakika yeter...");
  }
  function sinavSayaci() {
    const ic = I(), simdi = Date.now();
    const gelecek = TARIHLER.filter((x) => x.t.getTime() > simdi).sort((a, b) => a.t - b.t);
    if (!gelecek.length) return sor("Sunum ekranı boş: takvimde yaklaşan tarih yok. (Tarihler kisi.json > etkilesim > tarihler ile eklenir.)", [{ etiket: "Küçük bir adım öner", fn: () => sor(`Tek adım: ${rast(KUCUK_ADIMLAR)}`, [{ etiket: "Tamam", fn: kapat }]) }, { etiket: "Kapat", fn: kapat }]);
    const satir = (x) => { const ms = x.t.getTime() - simdi, g = Math.floor(ms / 864e5), s = Math.floor((ms % 864e5) / 36e5); return `${x.ad}: ${g} gün ${s} saat (${x.not})`; };
    sor(`Sunum ekranı yaklaşan tarihleri gösteriyor.\n${gelecek.slice(0, 3).map(satir).join("\n")}`, [
      { etiket: "Küçük bir adım öner", fn: () => sor(`Tek adım: ${rast(KUCUK_ADIMLAR)}`, [{ etiket: "Tamam", fn: kapat }]) },
      { etiket: "Kapat", fn: kapat },
    ]);
    ic.gunluk("Sunum ekranından yaklaşan tarihlere bakıldı.", true);
  }
  function tahta() {
    const ic = I(); ic.ses("tak");
    sor(`Tahtaya büyük harflerle yazdın:\n"${rast(KUCUK_ADIMLAR)}"`, [
      { etiket: "Başka adım", fn: tahta }, { etiket: "Silgiyle sil", fn: kapat },
    ]);
  }
  function telsiz() {
    const ic = I(); ic.ses("tak");
    kanalNo = (kanalNo + 1) % KANALLAR.length; if (kanalNo === 0) kanalTur++;
    const k = KANALLAR[kanalNo];
    if (kanalTur >= 1 && kanalNo === KANALLAR.length - 2 && Math.random() < 0.5) {
      ic.efekt.parti = Math.max(ic.efekt.parti, ic.zaman + 5); ic.ses("bildirim");
      sor(`${k}\nHışırtının arasından zayıf bir ses: "…uzak bir istasyon yakalandı." (Kurgusal.)`, [{ etiket: "Tamam", fn: kapat }]);
      ic.gunluk("Telsiz: uzak bir istasyon yakalandı (kurgusal).", true);
    } else konus(ic.oyuncu, `${k}. ${rast(["Hışırtı...", "Boş frekans, biraz bekleyeyim.", "Bir şey var gibi, çok uzak.", "Sessizlik."])}`);
  }

  // ---------- gizli kelimeler ----------
  function kelime(k) {
    const ic = I();
    if (k === "selam") { const a = ic.bul("ada"); if (a && !a.disarda) { konus(a, `${KISI.ad}, selam! Beni mi çağırdın? Buradayım.`); ic.kalpler(a, 1); } else konus(ic.oyuncu, "Selam! Ofis bomboş."); }
    else if (k === "pembe") { ic.ton = 0.34; pembeBitis = ic.zaman + 10; ic.efekt.parti = Math.max(ic.efekt.parti, ic.zaman + 6); ic.ses("parti", 0.4); konus(ic.oyuncu, "Her şey pembe oldu!"); ic.gunluk("Gizli kelime: pembe.", true); }
    else if (k === "uyku") { const s = ic.bul("sosyal"), m = UYKU ? `Uyku hedefin: ${UYKU}. Söz verdin.` : "Uyku da işin parçası. Bu gece zamanında yatmayı dene."; if (s && !s.disarda) konus(s, m); else konus(ic.oyuncu, m); ic.kalpler(ic.oyuncu, 2); }
    else if (k === "kahve") { const sef = ic.bul("spiker"); ic.ses("kahve"); if (sef && !sef.disarda) konus(sef, "Kahve mi dedin? Sütlü mü sade mi, söyle."); else konus(ic.oyuncu, "Kahve makinesi mutfakta. Bir mola hak ettin."); }
    else if (k === "somine") { if (!cozy) cozyDegis(); else konus(ic.oyuncu, "Şömine zaten yanıyor."); }
    else { const o = (E.gizli_kelimeler || []).find((x) => x.kelime === k); if (o) { ic.kalpler(ic.oyuncu, 5); ic.ses("bildirim"); konus(ic.oyuncu, o.mesaj); ic.gunluk(`Gizli kelime: ${k}.`, true); } }   // kişiye özel gizli kelimeler (kisi.json)
  }
  const KELIMELER = ["selam", "pembe", "uyku", "kahve", "somine", ...(E.gizli_kelimeler || []).map((x) => x.kelime)];

  // ---------- güncelleme: halıda dinlenme, gece yarısı uyarısı, cozy mod bitişi, kedi şöminede ----------
  function guncelle() {
    const ic = I(), { oyuncu, zaman } = ic; if (!oyuncu) return;
    if (pembeBitis && zaman > pembeBitis) { pembeBitis = 0; ic.ton = tonSeviye(); }
    if (zaman - somineSon > 0.25 || zaman < somineSon) { somineSon = zaman; if (window.SES && window.SES.somine) window.SES.somine(cozy, Math.hypot(oyuncu.x - 13.9, oyuncu.y - 5.8)); }   // şömine sesi mesafeye göre
    if (kapatma && kapatma.asama === "diyalog" && !ic.diyalogAcik()) kapatmaSon(true);   // konuşma seçim yapılmadan kapandı (Esc, başka yere gitti): kullanıcı geçti, ofis kapanır
    // Halı (kisi.json etkilesim.hali): üstünde 5 sn durursan huzur
    const halida = !!HALI && oyuncu.x >= HALI[0] && oyuncu.x <= HALI[2] && oyuncu.y >= HALI[1] && oyuncu.y <= HALI[3] && !oyuncu.yol.length && !oyuncu.oturak;
    if (!halida) halidaSure = 0; else if (!halidaSure) halidaSure = zaman;
    if (halidaSure && zaman - halidaSure > 5 && zaman - halidaKalpSon > 20) { halidaKalpSon = zaman; halidaSure = 0; ic.kalpler(oyuncu, 2); konus(oyuncu, rast(["Halı çok yumuşak.", "Burada biraz dursam iyi olur.", "Ayaklarım mutlu."])); }
    // Gece yarısından sonra (00:30-05:00) asistan, kisi.json etkilesim.uyku_hedefi varsa uyku hedefini bir kez hatırlatır (yalnız gerçek saatte)
    const dk = ic.dakika(), bugun = new Date().toDateString();
    if (UYKU && dk >= 24 * 60 + 30 && dk < 29 * 60 && geceUyarisi !== bugun && ic.GERCEK) {
      const ada = ic.bul("ada");
      if (ada && !ada.disarda && !ic.mesgul(ada)) { geceUyarisi = bugun; konus(ada, `Saat 00:30'u geçti, ${KISI.ad}. Uyku hedefin: ${UYKU}. Yarın kendine teşekkür edeceksin.`); ic.gunluk("Asistan uyku hatırlattı.", true); }
    }
    // Cozy modda Sütlaç bir süre sonra şömine önüne gidip uyur
    if (cozy && !kediGonderildi && zaman - cozyBas > 15) {
      const k = ic.kedi;
      if (k && (k.durum === "otur" || k.durum === "yat") && !k.yol.length) {
        kediGonderildi = true;
        k.yol = ic.yolBul([k.x, k.y], ic.enYakinYurur(14, 7)); k.hiz = 2.2; k.durum = "gez"; k.ust = null;
        k.sonra = () => { k.durum = "yat"; k.sure = 40; k.bakis = 1; ic.gunluk("Sütlaç şöminenin önünde uyuyakaldı.", true); };
      }
    }
  }

  // ---------- çizim: cozy ışıkları (ana tuval, ışık katmanından sonra) ----------
  function geceCiz() {
    if (!cozy) return;
    const ic = I(), { g, kam, ex, ey, zaman } = ic, o = kam.o;
    const a = Math.min(1, (zaman - cozyBas) / 1.5);
    g.save(); g.globalCompositeOperation = "lighter";
    const titre = 0.85 + 0.15 * Math.sin(zaman * 11) * Math.sin(zaman * 4.3);
    const leke = (x, y, r, rgb, alfa) => { const gr = g.createRadialGradient(ex(x), ey(y), 0, ex(x), ey(y), r * o); gr.addColorStop(0, `rgba(${rgb},${alfa})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(ex(x) - r * o, ey(y) - r * o, r * o * 2, r * o * 2); };
    leke(221, 90, 62, "255,150,70", 0.42 * a * titre);          // şömine ışığı
    leke(367, 88, 46, "255,214,150", 0.34 * a);                  // abajur
    g.restore();
    // alevler: şömine ağzında titreyen 3 piksel sütun
    for (let i = 0; i < 3; i++) {
      const h = 3 + Math.round(2 + 2 * Math.sin(zaman * (9 + i * 3) + i)), x = 217 + i * 4;
      g.fillStyle = i === 1 ? "#ffd36a" : "#ff8a3d"; g.fillRect(Math.round(ex(x)), Math.round(ey(91 - h)), Math.ceil(2 * o), Math.ceil(h * o));
    }
    // ışık dizisi: tel boyunca yanıp sönen sıcak noktalar
    for (let i = 0; i < 9; i++) {
      const on = Math.sin(zaman * 3 + i * 1.7) > -0.2; if (!on) continue;
      g.fillStyle = i % 2 ? "#fff0b8" : "#ffc9d8"; const x = 294 + i * 6.5, y = 35 + 2 * Math.sin(i * 0.9);
      g.fillRect(Math.round(ex(x)), Math.round(ey(y)), Math.ceil(1.6 * o), Math.ceil(1.6 * o));
    }
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() { I().NESNELER.push(...NOKTALAR); odakDevam(); const c = document.getElementById("odakSaat"); if (c) c.onclick = () => { if (odak) odakSor(); }; },
    bastan() { cozy = false; kapatma = null; I().ton = I().TON_TABAN; kediGonderildi = false; if (window.SES && window.SES.somine) window.SES.somine(false); },
    odakBaslat,   // Ders koçu diyaloğundan (EYLEMLER.odak) çağrılır
    odakDurum: () => odak,
    surprizGuncelle: guncelle,
    geceCiz,
    tusGozle(e) {
      if (e.key.length !== 1) return;
      harfler = (harfler + sade(e.key.toLocaleLowerCase("tr"))).slice(-10);
      for (const k of KELIMELER) if (harfler.endsWith(k)) { harfler = ""; kelime(k); break; }
    },
    gunKapatma,   // çekirdek "🌙 Ofisi kapat" düğmesinde çağırır (ofis.js); true: konuşma başladı/sürüyor, undefined: başlatılamadı (eski onay kutusu açılır)
    test: { cozy: () => cozy, cozyDegis, kelime, yemekOner, tarihler: () => TARIHLER.map((x) => x.ad), odakBasla, odakBitir, odakBirak, odak: () => odak, kapatma: () => (kapatma ? kapatma.asama : null) },
  });
})();
