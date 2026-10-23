// Sürprizler ve nesne etkileşimleri: E ile kullanılan noktalar (kahve, yazıcı, para, masaya oturma, küre, akvaryum), yazıcı sıkışması,
// stüdyoya dalınca son dakika, guguklu saat, akşam selamları, sebil dedikodusu ve gizli kodlar (Konami partisi, "sütlaç" yazmak,
// oyuncuya 10 kez tıklamak). Liste: SURPRIZLER.md. Çekirdeğe MOD kancalarıyla bağlanır (window.OFIS_IC): surprizGuncelle, tusGozle(e),
// oyuncuTiklandi, canliCiz (sıkışan yazıcının ışığı), bastan. Çizimin okuduğu süre damgaları çekirdekteki OFIS_IC.efekt'tedir
// (parti, kafein, balik, sonDakika: zaman < damga iken etkin); gün dönünce çekirdek sıfırlar. E noktaları basla'da OFIS_IC.NESNELER'e eklenir.
(() => {
  const I = () => window.OFIS_IC;
  const KISI = window.OFIS_KISI, OAD = KISI.ad, adEki = KISI.ek;   // kisi.js: ofis sahibine özel adlar
  let kahveSayisi = 0, yaziciSikisti = false, sikismaZamani = 40, sonDakikaBekle = 0;
  let dedikoduZamani = 22, oyuncuTik = 0, oyuncuTikZaman = 0, sonGuguk = -1, paraSay = 0;
  const DEDIKODU = [
    ["Duydun mu, Sütlaç yine sunucunun üstünde uyumuş.", "Sunucu ısınıyor ya. Kedi de bir tür soğutma sistemi."],
    ["Editör bugün üçüncü kahvesinde.", "Doğrulayıcı kahvenin kaynağını sordu mu?"],
    [`${adEki(OAD, "ın")} guguklu saati gerçekten çalışıyor mu?`, "Saat başında yanından geç, görürsün."],
    ["Stüdyoda kameraların önüne geçen yayına çıkıyormuş.", `Sakın ${adEki(OAD, "a")} söyleme, hemen dener.`],
    ["Ofiste gizli bir kod varmış.", "Yukarı yukarı, aşağı aşağı… gerisini unuttum. Sonu B, A gibiydi."],
    ["Sütlaç'ın adını klavyeye yazarsan koşarak geliyormuş.", "Kedi klavye okuyor yani? Tabii ya, hep üstünde."],
    ["Radar odasındaki para gerçek mi?", "Dokunma, Analist karneyi bozduğunu söylüyor."],
    [`${OAD} masasına oturursa biri ona kahve götürmeli.`, "Kural bu mu? Bilmiyordum."],
  ];
  const NOKTALAR = [
    { x: 8, y: 25, r: 1.2, etiket: () => "Kahve al", fn: kahveAl },
    { x: 33, y: 20, r: 1.4, etiket: () => (yaziciSikisti ? "Yazıcıyı düzelt" : "Fotokopi çek"), fn: yaziciKullan },
    { x: 43, y: 10, r: 1.5, etiket: () => "Paraya dokun", fn: paraDokun },
    { x: 18, y: 4, r: 0.6, etiket: () => "Otur", fn: masayaOtur },
    { x: 24, y: 5, r: 1.6, etiket: () => "Küreyi çevir", fn: kureCevir },
    { x: 45, y: 16, r: 1.6, etiket: () => "Balıkları besle", fn: balikBesle },
  ];
  function kahveAl() {
    const ic = I();
    kahveSayisi++; ic.ses("kahve"); ic.gorevBitir("kahve");
    ic.konus(ic.oyuncu, ["Oh be. İlk kahve.", "İkinci kahve: odak modu.", "Üçüncü kahve… zamanı duyabiliyorum!"][Math.min(kahveSayisi, 3) - 1], true);
    if (kahveSayisi >= 3) { kahveSayisi = 0; ic.efekt.kafein = ic.zaman + 20; ic.gunluk(`${OAD} kafein modunda! (20 sn)`); ic.sonra(1.2, () => ic.ses("parti", 0.5)); }
  }
  function yaziciKullan() {
    const ic = I(), { oyuncu } = ic;
    if (yaziciSikisti) {
      yaziciSikisti = false; sikismaZamani = ic.zaman + ic.rs(50 + Math.random() * 30, 3600 + Math.random() * 5400); ic.ses("tak");   // gerçek saatte 1-2,5 saat
      ic.konus(oyuncu, "Bir tık, bir dua… Düzeldi!", true); ic.gunluk(`${OAD} yazıcıyı düzeltti. Ofis alkışlıyor.`); ic.gorevBitir("yazici");
      for (const a of ic.ajanlar) if (!a.oyuncu && !ic.mesgul(a) && Math.hypot(a.x - oyuncu.x, a.y - oyuncu.y) < 9) { ic.kalpler(a, 1); }
    } else { ic.ses("yazici"); ic.konus(oyuncu, "Bir kopya da bana.", true); }
  }
  function paraDokun() {
    const ic = I();
    ic.konus(ic.oyuncu, ["Bu demo parası. Vergisi bile kurgusal.", "Analist: 'Ona dokunursan karne bozulur.'", "Para hâlâ burada. Belki radar gerçekten çalışıyordur."][paraSay++ % 3], true);
    ic.ses("tak");
  }
  function masayaOtur() {
    const ic = I(), { oyuncu, sonra } = ic;
    oyuncu.yon = 3; ic.konus(oyuncu, "Kahvem nerede?", true);
    const a = ic.rastgele(ic.ajanlar.filter((x) => !x.oyuncu && !ic.mesgul(x) && x.id !== "spiker") || []);
    if (!a) return;
    a.ozel = "gorev";
    sonra(1.2, () => ic.gonder(a, ic.KAHVE, () => { ic.sesKonum("kahve", a.x, a.y); sonra(1.6, () => ic.gonder(a, ic.ziyaretNoktasi(oyuncu), () => {
      ic.yonBak(a, oyuncu); ic.konus(a, `Buyrun ${OAD}, sade kahve. Sütlaç'tan saklayın.`); kahveSayisi++; ic.kalpler(oyuncu, 2);
      sonra(2.4, () => ic.eveDon(a, () => (a.ozel = null)));
    })); }));
  }
  function kureCevir() {
    const ic = I();
    ic.ses("tak");
    ic.konus(ic.oyuncu, `Küre ${ic.rastgele(["İzlanda", "Japonya", "Kenya", "Peru", "Norveç", "Yeni Zelanda", "Fas"])}'da durdu. Bir gün oraya da şube.`, true);
  }
  function balikBesle() { const ic = I(); ic.efekt.balik = ic.zaman + 6; ic.ses("bloop"); ic.gorevBitir("balik"); ic.konus(ic.oyuncu, "Balıklar yemi kaptı. Biri sana göz kırptı.", true); }

  function partiBaslat() {
    const ic = I();
    if (ic.zaman < ic.efekt.parti) return;
    ic.efekt.parti = ic.zaman + 12; ic.ses("parti"); ic.gunluk("🎉 Gizli kod bulundu: ofis partisi!");
    for (const a of ic.ajanlar) if (!a.oyuncu && !a.konusuyor && !a.disarda) ic.sonra(Math.random() * 1.5, () => ic.konus(a, ic.rastgele(["🎉", "Yaşasın!", "Bütçe mi onaylandı?!", "Bu ne kutlaması?", "💃", "Sütlaç da dans ediyor!"]), true));
    ic.MOD("partiBasladi");
  }
  function surprizGuncelle() {
    const ic = I(), { zaman, oyuncu, bul, konus, sonra, rastgele, sesKonum, YAZICI } = ic;
    // Yazıcı ara sıra sıkışır
    if (!yaziciSikisti && zaman > sikismaZamani) {
      yaziciSikisti = true; sesKonum("sikisti", YAZICI[0], YAZICI[1]);
      const a = ic.ajanlar.filter((x) => !x.oyuncu && !ic.mesgul(x)).sort((p, q) => Math.hypot(p.x - 33, p.y - 20) - Math.hypot(q.x - 33, q.y - 20))[0];
      if (a) konus(a, rastgele(["Yazıcı yine sıkıştı!", "Fotokopi makinesi greve gitti.", `Kâğıt sıkıştı. ${OAD}, senin elin hafif.`]));
    }
    // Stüdyo: oyuncu kameraların önüne geçerse son dakika
    if (oyuncu && oyuncu.x >= 27 && oyuncu.x <= 31 && oyuncu.y >= 28 && oyuncu.y <= 30.5 && zaman > sonDakikaBekle) {
      ic.efekt.sonDakika = zaman + 10; sonDakikaBekle = zaman + 40; ic.kayitSon = Math.max(ic.kayitSon, zaman + 10);
      ic.ses("bildirim"); konus(bul("spiker"), `${OAD} canlı yayında! Gülümse, 40 bin kişi izliyor (kurgusal).`);
      ic.gunluk(`SON DAKİKA: ${KISI.tam} habersiz stüdyoya daldı.`);
    }
    // Guguklu saat: her saat başı
    const saat = Math.floor(ic.dakika() / 60);
    if (saat !== sonGuguk && ic.dakika() % 60 < 6) {
      if (sonGuguk >= 0) { sesKonum("guguk", 22.5, 2, (saat % 12) || 12); if (saat === 12) konus(bul("ada"), "Öğlen oldu. Guguk kuşu 12 kere öttü, ben saydım."); }
      sonGuguk = saat;
    }
    // Akşam selamları
    if (Math.abs(ic.dakika() - 18 * 60 - 30) < 3 && !ic.tetik.has("aksam")) {
      ic.tetik.add("aksam"); konus(bul("ada"), "Arşiv hiç uyumaz. Ben biraz daha kalıyorum.");
      sonra(2, () => konus(bul("editor"), "İyi akşamlar ekip!")); sonra(3.5, () => { ic.kedi.balon = "Gece mesaisi başladı."; ic.kedi.balonSon = I().zaman + 3; });
    }
    // Sebil başında dedikodu
    if (zaman > dedikoduZamani) {
      dedikoduZamani = zaman + ic.rs(28, 240) + Math.random() * ic.rs(18, 360);   // gerçek saatte 4-10 dk
      const bos = ic.ajanlar.filter((a) => !a.oyuncu && !ic.mesgul(a) && ic.yerinde(a) && a.id !== "spiker");
      if (bos.length >= 2) {
        const cift = ic.MOD("dedikoduCifti", bos);   // ilişki modülü: yalnız/arkadaş çifti ve kendi sözleri
        const [a, b] = cift ? [cift.a, cift.b] : [bos.splice(Math.floor(Math.random() * bos.length), 1)[0], rastgele(bos)];
        const [s1, s2] = (cift && cift.sozler) || rastgele(DEDIKODU);
        a.ozel = b.ozel = "dedikodu"; let gelen = 0;
        const geldi = () => { if (++gelen < 2) return; ic.yonBak(a, b); ic.yonBak(b, a); konus(a, s1, true);
          sonra(3, () => konus(b, s2, true)); ic.MOD("sohbetEtti", a, b); sonra(6.5, () => { ic.eveDon(a, () => (a.ozel = null)); ic.eveDon(b, () => (b.ozel = null)); }); };
        ic.gonder(a, ic.enYakinYurur(35, 16), geldi); ic.gonder(b, ic.enYakinYurur(37, 16), geldi);
        // biri yolda başka işe alınırsa öteki sebil başında beklemesin
        sonra(20, () => [a, b].forEach((x) => { if (x.ozel === "dedikodu" && !x.disarda && !x.yol.length) ic.eveDon(x, () => (x.ozel = null)); }));
      }
    }
  }
  // Gizli kodlar: Konami (yukarı yukarı aşağı aşağı sol sağ sol sağ B A) parti başlatır; "sütlaç" yazmak Sütlaç'ı çağırır
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "KeyB", "KeyA"];
  let kodlar = [], harfler = "";
  const sade = (k) => ({ ü: "u", ç: "c", ş: "s", ı: "i", ö: "o", ğ: "g" })[k] || k;

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() { I().NESNELER.push(...NOKTALAR); },
    bastan() { const ic = I(); yaziciSikisti = false; sikismaZamani = ic.rs(40, ic.dkT(570 + Math.random() * 90)); sonDakikaBekle = 0; dedikoduZamani = 22; sonGuguk = -1; },
    surprizGuncelle,
    tusGozle(e) {   // her tuşu görür, tüketmez
      kodlar = [...kodlar, e.code].slice(-KONAMI.length);
      if (kodlar.join() === KONAMI.join()) { kodlar = []; partiBaslat(); }
      if (e.key.length === 1) { harfler = (harfler + sade(e.key.toLocaleLowerCase("tr"))).slice(-12); if (harfler.endsWith("sutlac")) { harfler = ""; I().MOD("sutlacCagir"); } }
    },
    oyuncuTiklandi() {
      const ic = I();
      oyuncuTik = ic.zaman - oyuncuTikZaman < 4 ? oyuncuTik + 1 : 1; oyuncuTikZaman = ic.zaman;
      if (oyuncuTik === 10) { oyuncuTik = 0; ic.konus(ic.oyuncu, "Beni tıklamayı bırakır mısın? Bütün ofis izliyor.", true); ic.ses("ret"); }
    },
    canliCiz(t) { if (yaziciSikisti) { const { f } = I(); f.fillStyle = Math.sin(t * 8) > 0 ? "#ff3b3b" : "#5a1c1f"; f.fillRect(538, 300, 3, 3); } },
    test: { parti: () => partiBaslat(), yazici: () => yaziciSikisti },
  });
})();
