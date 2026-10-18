// Ek etkileşimler ve gizli sürprizler: cozy mod (lamba + şömine + ışık dizisi), buzdolabı (mutfaktakinden yemek önerisi), mikrodalga,
// kitaplık, çerçeve (gizli not), toplantı ekranında yaklaşan tarihler, tahtada "tek küçük adım", telsiz masasında kanal gezintisi, halıda dinlenmek,
// odak modu (pomodoro: odak/mola turları, ofis tepkileri, istatistik), "Ofisi kapat" gün kapatma konuşması ve yazılan gizli kelimeler (selam, pembe, uyku, kahve, somine). Çekirdeğe MOD kancalarıyla bağlanır (window.OFIS_IC).
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
    { x: 18, y: 7.6, r: 1.9, etiket: () => (!odak ? `Odak başlat (pomodoro ${ODAK_DK} dk)` : odak.faz === "mola" ? "Molayı yönet" : "Odağı bırak"), fn: () => odakBaslat() },
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

  // ---------- odak modu (pomodoro): 25 dk odak → 5 dk mola, 4 turda bir 15 dk uzun mola. Ofis tepki verir: oyuncu masasına oturur, cozy lamba +
  // masanın üstünde "ODAKTA" tabelası, odak müziği, ekip ara ara fısıldaşır, Sütlaç masanın yanına gelip uyur (sutlac.js > odakBasladi). Tur bitince
  // "ne oldu?" sorulur (İlerledim / Bitirdim: iş tiklenir / Takıldım: küçük adım önerisi); molada oyuncu kahveye yürür, ekipten biri sohbete gelir
  // (uzun molada iki-üç kişi + küçük parti). Başka sekmeye geçip dönünce Ada kaldığın yeri hatırlatır (ceza yok: iş başka pencerede de sürebilir).
  // İstatistik bu tarayıcıda: localStorage "ofis-odak-istatistik" {gün: {tur, dk, notlar}}; BeyinOS Odak uygulaması window.OFIS_ODAK ile okur.
  // Ofisteki olaylar ikinci beyne kaydolur (sunucu: notes/ofis-sohbet/<gün>.md); sunucu yoksa sessizce atlanır
  const kayit = (metin) => { try { fetch("/api/ofis-kayit", { method: "POST", headers: { "X-Ofis-Anahtar": I().ANAHTAR, "Content-Type": "application/json" }, body: JSON.stringify({ metin }) }).catch(() => {}); } catch (e) { /* yoksay */ } };
  const ODAK_DK = 25, MOLA_DK = 5, UZUN_DK = 15, TUR = 4, ODAK_DEPO = "ofis-odak", IST_DEPO = "ofis-odak-istatistik";
  let odak = null, odakZ = 0, fisZ = 0, gizliBas = 0;
  const odakKaydet = () => { try { if (odak) localStorage.setItem(ODAK_DEPO, JSON.stringify(odak)); else localStorage.removeItem(ODAK_DEPO); } catch (e) { /* depolama kapalı */ } };
  const iki = (n) => String(n).padStart(2, "0");
  const gunAnahtar = (t) => { const d = new Date(t); return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`; };
  const MASA_N = () => (window.HARITA && HARITA.noktalar && HARITA.noktalar.oyuncu) || [18, 6];
  const muzik = (a) => { if (window.SES && window.SES.odakMuzigi) window.SES.odakMuzigi(a); };
  const FISILTI = ["(fısıltıyla) Şşt, odakta.", "🤫", "(fısıltı) Sonra konuşuruz.", "(fısıltı) Kahveyi ben alırım, sen devam.", "(fısıltı) Sütlaç bile sessiz bak."];
  const MOLA_SOZ = ["Mola mı? Ben de tam kahve alacaktım.", "Sütlaç bugün üç kez klavyeme çıktı, rekor.", "5 dakika ekran yok, söz mü?", "Biraz yürüyelim mi? Bacaklar unutuyor.",
    "Su içtin mi bugün?", "Odak nasıl gidiyor? Yüzünden belli, iyi.", "Bu kahve makinesi bugün cömert.", "Mola da işin parçası, demişler."];
  const MOLA_CEVAP = ["Haha, aynen.", "Kahve şart.", "Biraz nefes alıyorum.", "İyi gidiyor, sağ ol.", "Bir bardak su, tamam."];
  function istOku() { try { const s = JSON.parse(localStorage.getItem(IST_DEPO) || "{}"); return s && typeof s === "object" ? s : {}; } catch (e) { return {}; } }
  function istYaz(fn) {
    const s = istOku(), k = gunAnahtar(Date.now()), g = (s[k] = s[k] || { tur: 0, dk: 0, notlar: [] }); fn(g);
    const anahtarlar = Object.keys(s).sort(); while (anahtarlar.length > 120) delete s[anahtarlar.shift()];
    try { localStorage.setItem(IST_DEPO, JSON.stringify(s)); } catch (e) { /* yok */ }
  }
  function istatistik() {
    const s = istOku(), bos = () => ({ tur: 0, dk: 0, notlar: [] }), hafta = [];
    for (let i = 6; i >= 0; i--) { const k = gunAnahtar(Date.now() - i * 864e5); hafta.push({ tarih: k, ...bos(), ...(s[k] || {}) }); }
    let seri = 0;
    for (let i = 0; i < 120; i++) { const g = s[gunAnahtar(Date.now() - i * 864e5)]; if (g && g.tur) seri++; else if (i > 0) break; }
    return { bugun: { ...bos(), ...(s[gunAnahtar(Date.now())] || {}) }, hafta, seri, toplamTur: Object.values(s).reduce((t, g) => t + (g.tur || 0), 0) };
  }
  function odakChip() {
    const c = document.getElementById("odakSaat"); if (!c) return;
    if (!odak) { c.hidden = true; return; }
    const kalan = Math.max(0, odak.bitis - Date.now()), mm = `${iki(Math.floor(kalan / 60000))}:${iki(Math.floor((kalan % 60000) / 1000))}`;
    c.textContent = odak.faz === "odak" ? `⏱ ${mm} · ${odak.tur}/${TUR}` : `☕ ${mm} ${odak.uzun ? "uzun mola" : "mola"}`; c.hidden = false;
  }
  function odakSor() {
    if (odak && odak.faz === "mola") return sor(`${odak.uzun ? "Uzun mola" : "Mola"} sürüyor. Erken dönmek ister misin?`, [
      { etiket: "Molaya devam", fn: kapat }, { etiket: "Molayı bitir", fn: () => { kapat(); molaBitir(); } }, { etiket: "Bugünlük bırak", fn: () => { kapat(); odakBirak(); } },
    ]);
    sor(`Odak sürüyor (tur ${odak ? odak.tur : 1}/${TUR})${odak && odak.gorev ? ": " + odak.gorev.ad : ""}. Bırakmak mı istiyorsun?`, [
      { etiket: "Devam et", fn: kapat }, { etiket: "Odağı bırak", fn: () => { kapat(); odakBirak(); } },
    ]);
  }
  function odakBaslat() {
    if (odak) return odakSor();
    const P = window.OFIS_PANEL, acik = P ? P.acikGorevler().slice(0, 4) : [];
    const sec = acik.map((g) => ({ etiket: g.ad.length > 36 ? g.ad.slice(0, 35) + "…" : g.ad, fn: () => odakBasla(g) }));
    sor(`Pomodoro: ${ODAK_DK} dk odak, ${MOLA_DK} dk mola, ${TUR} turda bir uzun mola. Neye başlıyoruz? Küçük bir ilk adım yeter.`, [...sec, { etiket: "Serbest odak", fn: () => odakBasla(null) }, { etiket: "Vazgeç", fn: kapat }]);
  }
  function masayaOtur() {
    const ic = I(), o = ic.oyuncu, M = MASA_N();
    if (!o || (window.OFIS_BILGISAYAR && window.OFIS_BILGISAYAR.acik())) return;
    const otur = () => { ic.yonBak(o, { x: M[0], y: M[1] - 2 }); o.yazSon = ic.zaman + 1e6; };
    if (Math.hypot(o.x - M[0], o.y - M[1]) < 0.6) otur(); else ic.gonder(o, M, otur);
  }
  function odakSahne(acik) {
    const ic = I(); clearInterval(fisZ); muzik(acik);
    if (!acik) { if (ic.oyuncu && !(window.OFIS_BILGISAYAR && window.OFIS_BILGISAYAR.acik())) ic.oyuncu.yazSon = 0; return; }
    if (!cozy) cozyDegis(true);
    ic.MOD("odakBasladi", MASA_N());
    fisZ = setInterval(() => {
      if (!odak || odak.faz !== "odak" || document.hidden || Math.random() < 0.4) return;
      const l = ic.ajanlar.filter((a) => !a.oyuncu && !a.disarda && !a.konusuyor && !ic.mesgul(a));
      if (l.length) konus(rast(l), rast(FISILTI));
    }, 70000);
  }
  function odakBasla(gorev, tur = 1) {
    const ic = I(); kapat();
    odak = { faz: "odak", tur, bitis: Date.now() + ODAK_DK * 60000, sure: ODAK_DK, gorev: gorev ? { id: gorev.id, ad: gorev.ad } : null };
    odakKaydet(); ic.ses("gorev"); ic.kalpler(ic.oyuncu, 1);
    masayaOtur(); odakSahne(true);
    konus(ic.oyuncu, tur > 1 ? `Tur ${tur}/${TUR}. Devam.` : gorev && gorev.ipucu ? `${ODAK_DK} dakika başladı. İlk adım: ${gorev.ipucu}` : `${ODAK_DK} dakika başladı. Sadece başla.`);
    const ada = ic.bul("ada"); if (ada && !ada.disarda && tur === 1) ic.sonra(2.5, () => konus(ada, "Ben yanındayım. Kapıya tabelayı astım, kimse rahatsız etmez."));
    ic.gunluk(`Odak başladı (tur ${tur}/${TUR}${gorev ? ": " + gorev.ad : ""}).`, true); kayit(`Odak başladı (tur ${tur}, ${ODAK_DK} dk): ${gorev ? gorev.ad : "serbest"}`);
    odakDon();
  }
  function odakDon() {
    clearInterval(odakZ); odakChip();
    odakZ = setInterval(() => { if (!odak) return clearInterval(odakZ); odakChip(); if (Date.now() >= odak.bitis) (odak.faz === "odak" ? odakBitir : molaBitir)(); }, 1000);
  }
  function odakBirak() {
    const f = odak && odak.faz; kayit(`${f === "mola" ? "Mola" : "Odak"} bırakıldı${odak && odak.gorev ? ": " + odak.gorev.ad : ""}`);
    odak = null; odakKaydet(); odakChip(); clearInterval(odakZ); odakSahne(false);
    konus(I().oyuncu, f === "mola" ? "Bugünlük bu kadar. İyi iş çıkardık." : "Odağı bıraktım. Gerekirse yeniden başlarız."); I().gunluk("Odak bırakıldı.", true);
  }
  function odakBitir() {
    const ic = I(), m = odak, g = m && m.gorev, tur = m ? m.tur : 1, uzun = tur % TUR === 0;
    odak = null; odakKaydet(); odakChip(); clearInterval(odakZ); odakSahne(false);
    istYaz((x) => { x.tur++; x.dk += ODAK_DK; });
    ic.ses("karne"); ic.kalpler(ic.oyuncu, 4); if (uzun) { ic.efekt.parti = Math.max(ic.efekt.parti, ic.zaman + 6); ic.ses("parti"); }
    ic.gunluk(`Odak turu ${tur} bitti${g ? ": " + g.ad : ""}.`, true);
    const oncekiBaslik = document.title; document.title = "✅ Tur bitti · " + oncekiBaslik; setTimeout(() => { document.title = oncekiBaslik; }, 20000);
    const alkis = ic.ajanlar.filter((a) => !a.oyuncu && !a.disarda && !a.konusuyor); for (let i = 0; i < Math.min(uzun ? 4 : 2, alkis.length); i++) { const a = alkis.splice(Math.floor(Math.random() * alkis.length), 1)[0]; ic.sonra(Math.random() * 1.2, () => konus(a, rast(["Güzel tur!", "Harika odak!", "Bir tur daha cebe.", "Alkışlar 👏"]))); }
    const sonu = (durum, not) => {
      kapat(); istYaz((x) => { x.notlar = [...(x.notlar || []), `Tur ${tur}: ${durum}${g ? " · " + g.ad : ""}`].slice(-20); });
      kayit(`Odak turu ${tur} (${ODAK_DK} dk): ${durum}${g ? " · " + g.ad : ""}`);
      if (not) { const ada = ic.bul("ada"); if (ada && !ada.disarda) ic.sonra(0.8, () => konus(ada, not)); }
      molaBasla(durum === "bitirdim" ? null : g, tur, uzun);
    };
    sor(`Tur ${tur}/${TUR} tamam!${g ? " (\"" + g.ad + "\")" : ""} Bu turda ne oldu?`, [
      { etiket: "İlerledim", fn: () => sonu("ilerledim") },
      ...(g ? [{ etiket: "Bitirdim, tikle", fn: () => { if (window.OFIS_PANEL) window.OFIS_PANEL.isaretle(g.id, true); sonu("bitirdim", "Tiklendi! Sıradakine molanın ardından bakarız."); } }] : []),
      { etiket: "Takıldım", fn: () => sonu("takıldım", "Takılınca adımı küçült: " + rast(KUCUK_ADIMLAR)) },
    ]);
  }
  function molaBasla(gorev, tur, uzun) {
    const ic = I(), dk = uzun ? UZUN_DK : MOLA_DK, o = ic.oyuncu;
    odak = { faz: "mola", tur, uzun, bitis: Date.now() + dk * 60000, sure: dk, gorev };
    odakKaydet(); odakDon();
    konus(o, uzun ? `${TUR} tur bitti! ${dk} dakika uzun mola.` : `${dk} dakika mola. Kahve!`);
    if (window.OFIS_BILGISAYAR && window.OFIS_BILGISAYAR.acik()) window.OFIS_BILGISAYAR.kapat();
    ic.gonder(o, ic.KAHVE, () => {
      ic.sesKonum("kahve", o.x, o.y);
      const bos = ic.ajanlar.filter((a) => !a.oyuncu && !a.disarda && !a.konusuyor && !ic.mesgul(a) && ic.yerinde(a));
      for (let i = 0; i < Math.min(uzun ? 3 : 1, bos.length); i++) {
        const a = bos.splice(Math.floor(Math.random() * bos.length), 1)[0]; a.ozel = "mola";
        ic.sonra(i * 1.5, () => ic.gonder(a, ic.ziyaretNoktasi(o), () => {
          ic.yonBak(a, o); konus(a, rast(MOLA_SOZ)); ic.sonra(3, () => konus(o, rast(MOLA_CEVAP)));
          ic.sonra(9 + i * 2, () => ic.eveDon(a, () => (a.ozel = null)));
        }));
      }
    });
  }
  function molaBitir() {
    const ic = I(), m = odak; if (!m) return;
    odak = null; odakKaydet(); odakChip(); clearInterval(odakZ); ic.ses("gorev");
    const oncekiBaslik = document.title; document.title = "☕ Mola bitti · " + oncekiBaslik; setTimeout(() => { document.title = oncekiBaslik; }, 15000);
    const sonraki = m.uzun ? 1 : m.tur + 1;
    sor(`Mola bitti. ${m.uzun ? "Yeni bir set" : `Tur ${sonraki}/${TUR}`} başlasın mı?${m.gorev ? " (\"" + m.gorev.ad + "\")" : ""}`, [
      { etiket: m.uzun ? "Yeni set başlat" : `Tur ${sonraki} başlat`, fn: () => odakBasla(m.gorev, sonraki) },
      { etiket: "Başka işe geç", fn: () => { kapat(); odakBaslat(); } },
      { etiket: "Bugünlük yeter", fn: () => { kapat(); konus(ic.oyuncu, "Bugünlük bu kadar. İyi iş!"); } },
    ]);
  }
  function odakDevam() {   // sayfa yenilenirse süren odak/mola kaldığı yerden devam eder; süresi dolmuşsa sessizce silinir (tur sayılmaz)
    try {
      const k = JSON.parse(localStorage.getItem(ODAK_DEPO) || "null");
      if (k && k.bitis > Date.now()) { if (!k.faz) { k.faz = "odak"; k.tur = 1; } odak = k; odakDon(); if (k.faz === "odak") { muzik(true); I().MOD("odakBasladi", MASA_N()); } }
      else if (k) localStorage.removeItem(ODAK_DEPO);
    } catch (e) { /* bozuk kayıt */ }
  }
  // Başka sekmeye geçip dönünce: ceza yok, Ada kaldığın yeri hatırlatır (30 sn'den uzun ayrılıklarda)
  function sekmeDegisti() {
    if (!odak || odak.faz !== "odak") { gizliBas = 0; return; }
    if (document.hidden) { gizliBas = Date.now(); return; }
    if (gizliBas && Date.now() - gizliBas > 30000) {
      const ic = I(), ada = ic.bul("ada"), kalan = Math.max(1, Math.round((odak.bitis - Date.now()) / 60000));
      if (ada && !ada.disarda) konus(ada, `Hoş geldin. ${kalan} dk kaldı${odak.gorev ? ", " + odak.gorev.ad : ""}. Kaldığın yerden.`);
    }
    gizliBas = 0;
  }
  // Masanın üstünde asılı tabela: "ODAKTA" (kırmızı) / "MOLA" (yeşil)
  function odakTabela() {
    if (!odak) return;
    const ic = I(), { f, T } = ic, M = MASA_N(), x = Math.round(M[0] * T - 8), y = Math.round((M[1] - 3) * T - 2);
    const yazi = odak.faz === "odak" ? "ODAKTA" : "MOLA", renk = odak.faz === "odak" ? "#d9534f" : "#5fa86a";
    f.fillStyle = "#3a2a1c"; f.fillRect(x + 6, y - 5, 1, 5); f.fillRect(x + 25, y - 5, 1, 5);
    f.fillStyle = "rgba(0,0,0,.35)"; f.fillRect(x + 1, y + 1, 32, 10); f.fillStyle = renk; f.fillRect(x, y, 32, 10);
    f.fillStyle = "#fff"; f.font = "7px 'Pixelify Sans', monospace"; f.textAlign = "center"; f.textBaseline = "middle"; f.fillText(yazi, x + 16, y + 5.5);
    f.textAlign = "start"; f.textBaseline = "alphabetic";
  }
  window.OFIS_ODAK = { durum: () => (odak ? { ...odak, turSayisi: TUR } : null), istatistik, baslat: () => odakBaslat() };

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
    basla() { I().NESNELER.push(...NOKTALAR); odakDevam(); document.addEventListener("visibilitychange", sekmeDegisti); const c = document.getElementById("odakSaat"); if (c) c.onclick = () => { if (odak) odakSor(); }; },
    canliCiz: odakTabela,
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
    test: { cozy: () => cozy, cozyDegis, kelime, yemekOner, tarihler: () => TARIHLER.map((x) => x.ad), odakBasla, odakBitir, odakBirak, molaBitir, odak: () => odak, odakIstatistik: istatistik, kapatma: () => (kapatma ? kapatma.asama : null) },
  });
})();
