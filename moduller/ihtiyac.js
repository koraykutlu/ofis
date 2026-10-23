// İhtiyaçlar ve ilişkiler (yol haritası 10; 18 Ekim gece sürümünde genişledi). Çekirdeğe (ofis.js) yalnız MOD kancalarıyla bağlanır; çekirdek arayüzü window.OFIS_IC.
// Her ajanda dört sayaç (0-100): enerji (çalıştıkça düşer, gece daha hızlı; kahve, öğle ve akşam yemeği doldurur), sosyallik (yalnız kaldıkça düşer; sohbet,
// oyuncuyla konuşma, yemek ve toplantı doldurur), kahve (kafein doygunluğu: saatte ~10 düşer, kahve içince dolar) ve tokluk (saatte ~6 düşer; öğle ve akşam
// yemeğinde dolar, çok acıkan mutfağa atıştırmaya gider). Kahveye en yorgun/kahvesi azalan gider; sebil sohbetini en yalnız olan başlatır ve önce arkadaşını çağırır.
// Arkadaş çiftlerinin kendi şakaları var; Sütlaç favori insanlarının klavyesini seçer. Kişi kartı için OFIS_YASAM.ihtiyaclar(a).
(() => {
  const I = () => window.OFIS_IC;
  const V = () => (window.DEMO && DEMO.iliskiler) || { arkadas: [], sakalar: {}, kediFavori: [], gerilim: [] };
  const sinirla = (v) => Math.max(0, Math.min(100, v));
  const yakinlik = new Map();   // "a|b" -> bugünkü sohbet sayısı
  const anahtar = (a, b) => [a, b].sort().join("|");
  const yemekte = (a) => a.rut === "ogle" || a.rut === "aksam";   // A paketi akşam yemeği rutinine "aksam" adını verir
  let kontrol = 0;   // yorgunluk/açlık denetimi aralığı (oyun saniyesi)
  const atistirSon = new Map();   // ajan id -> bir sonraki atıştırmaya kadar bekleme bitişi (oyun saniyesi)
  const yetim = new Map();        // ajan id -> boşta ama masasından sapmış ardışık denetim sayısı

  function sifirla() {
    yakinlik.clear(); atistirSon.clear(); yetim.clear();
    for (const a of I().ajanlar) if (!a.oyuncu) a.ih = { enerji: 72 + Math.random() * 28, sosyal: 50 + Math.random() * 40, kahve: 45 + Math.random() * 40, tokluk: 70 + Math.random() * 25 };
  }
  const arkadaslari = (id) => V().arkadas.filter((c) => c.includes(id)).map((c) => (c[0] === id ? c[1] : c[0]));
  const rakipleri = (id) => (V().gerilim || []).filter((c) => c.includes(id)).map((c) => (c[0] === id ? c[1] : c[0]));
  // Ruh hali: diyalog modülü, ortam sohbetleri ve kişi kartı kullanır
  function ruhHali(a) {
    if (!a || !a.ih) return { ad: "normal", emoji: "🙂" };
    const { enerji, sosyal, tokluk } = a.ih;
    if (enerji < 25) return { ad: "yorgun", emoji: "🥱" };
    if (tokluk !== undefined && tokluk < 22) return { ad: "aç", emoji: "🍽️" };
    if (sosyal < 25) return { ad: "yalnız", emoji: "😶" };
    if (enerji > 65 && sosyal > 60) return { ad: "keyifli", emoji: "😄" };
    return { ad: "normal", emoji: "🙂" };
  }
  // Kişi kartındaki çubuklar (B paketi): Kahve, Tokluk, Enerji
  function ihtiyaclar(a) {
    if (!a || !a.ih) return [];
    const h = a.ih;
    return [
      { id: "kahve", ad: "Kahve", deger: Math.round(h.kahve), renk: "#c58a3a" },
      { id: "tokluk", ad: "Tokluk", deger: Math.round(h.tokluk), renk: "#8cb65a" },
      { id: "enerji", ad: "Enerji", deger: Math.round(h.enerji), renk: "#f2c14e" },
    ];
  }
  // Başka modüller sayaç doldurur: doldur(a, { kahve: 25, tokluk: 15 }); negatif değer düşürür
  function doldur(a, d) {
    if (!a || !a.ih) return;
    for (const k of ["enerji", "sosyal", "kahve", "tokluk"]) if (typeof d[k] === "number") a.ih[k] = sinirla(a.ih[k] + d[k]);
  }
  window.OFIS_YASAM = Object.assign(window.OFIS_YASAM || {}, {
    ruhHali, arkadaslari, rakipleri, ihtiyaclar, doldur,
    // sohbet-ortam.js gerçeğini bunların üstüne yazar (yüklenmezse kart bölümleri boş kalır)
    sohbette: (window.OFIS_YASAM && window.OFIS_YASAM.sohbette) || (() => null),
    odaGunlugu: (window.OFIS_YASAM && window.OFIS_YASAM.odaGunlugu) || (() => []),
  });

  // Acıkan ajan mutfağa atıştırmaya gider: tokluk +35, sonra masasına döner (aynı anda en çok bir kişi, ajan başına 40 oyun dakikasında bir)
  function atistir(a) {
    const ic = I(), dkSn = ic.dkT(421) - ic.dkT(420);
    atistirSon.set(a.id, ic.zaman + dkSn * 40);
    a.ozel = "atistirma";
    const yer = ic.enYakinYurur(2 + Math.floor(Math.random() * 4), 26);
    ic.gonder(a, yer, () => {
      if (a.ozel !== "atistirma") return;
      a.yon = 1; ic.sesKonum("tak", a.x, a.y); doldur(a, { tokluk: 35 }); a.ih.enerji = sinirla(a.ih.enerji + 5);
      ic.konus(a, ic.rastgele(["Karnım zil çalıyor, bir şeyler atıştırayım 🍪", "Bir dilim bir şeyler iyi gider.", "Bisküvi molası!"]), true);
      ic.sonra(3.5, () => { if (a.ozel === "atistirma") ic.eveDon(a, () => { if (a.ozel === "atistirma") a.ozel = null; }); });
    });
    ic.sonra(30, () => { if (a.ozel === "atistirma" && !a.disarda && !a.rut) ic.eveDon(a, () => { if (a.ozel === "atistirma") a.ozel = null; }); });   // yolda başka işe alınırsa askıda kalmasın
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla: sifirla,
    bastan: sifirla,
    guncelle(dt) {
      const ic = I(), dkSn = ic.dkT(421) - ic.dkT(420), dk = dt / dkSn;   // bu karede geçen oyun dakikası
      const saat = Math.floor(ic.dakika() / 60) % 24, gece = saat >= 22 || saat < 5;
      for (const a of ic.ajanlar) {
        if (a.oyuncu || !a.ih || a.disarda) continue;
        const h = a.ih;
        if (h.kahve === undefined) h.kahve = 60;
        if (h.tokluk === undefined) h.tokluk = 70;
        if (yemekte(a)) { h.enerji += dk * 0.9; h.sosyal += dk * 1.1; h.tokluk += dk * 1.2; }
        else if (a.rut === "toplanti") { h.enerji -= dk * 0.1; h.sosyal += dk * 0.35; h.tokluk -= dk * 0.1; }
        else if (a.konusuyor) { h.sosyal += dk * 0.4; h.tokluk -= dk * 0.1; }
        else { h.enerji -= dk * (ic.yerinde(a) ? 0.12 : 0.08) * (gece ? 1.4 : 1); h.sosyal -= dk * 0.07; h.tokluk -= dk * 0.1; }   // saatte ~7 enerji (gece ~10), ~4 sosyallik, ~6 tokluk
        h.kahve -= dk * 0.167;   // saatte ~10
        for (const k of ["enerji", "sosyal", "kahve", "tokluk"]) h[k] = sinirla(h[k]);
      }
      // çok yorgun ya da kahvesi bitmiş olan çekirdeğin kahve zamanlayıcısını beklemez (makinede aynı anda tek kişi); çok acıkan atıştırmaya gider
      if ((kontrol -= dt) > 0) return; kontrol = 2.5;
      // Bekçi: hiçbir işi olmayıp masasının 0,6 karo yakınında takılı kalan ajanı (kesilen bir dönüş yürüyüşü, kesirli konumdan A* boş yol verir) masasına oturtur;
      // uzakta kalansa eveDon ile geri yollar. Yoksa "masada değil" sayılıp kahve/atıştırma/sohbet seçimine hiç girmez.
      for (const a of ic.ajanlar) {
        if (a.oyuncu || a.disarda || a.rut || a.ozel || a.konusuyor || a.oturak || a.gecis || a.sonra || a.yol.length || ic.yerinde(a) || ic.zaman < a.telefonSon) { yetim.delete(a.id); continue; }
        const n = (yetim.get(a.id) || 0) + 1; yetim.set(a.id, n);
        if (n < 3) continue;   // ~7 sn
        yetim.delete(a.id);
        if (Math.hypot(a.x - a.koltuk[0], a.y - a.koltuk[1]) < 0.6) { a.x = a.koltuk[0]; a.y = a.koltuk[1]; a.yon = 3; } else ic.eveDon(a);
      }
      const musait = (a) => !a.oyuncu && a.ih && !ic.mesgul(a) && ic.yerinde(a);
      if (!ic.ajanlar.some((a) => a.ozel === "kahve")) {
        const yorgun = ic.ajanlar.filter((a) => musait(a) && (a.ih.enerji < 30 || a.ih.kahve < 12)).sort((p, q) => (p.ih.kahve + p.ih.enerji) - (q.ih.kahve + q.ih.enerji))[0];
        if (yorgun) { ic.kahveyeGit(yorgun); return; }
      }
      if (!ic.ajanlar.some((a) => a.ozel === "atistirma")) {
        const ac = ic.ajanlar.filter((a) => musait(a) && a.ih.tokluk < 20 && (atistirSon.get(a.id) || 0) < ic.zaman).sort((p, q) => p.ih.tokluk - q.ih.tokluk)[0];
        if (ac) atistir(ac);
      }
    },
    // kahve: ihtiyacı en çok olan (enerji < 45 ya da kahve < 35) gider; kimse yorgun değilse kimse gitmez
    kahveAdayi(bos) {
      const aday = bos.filter((a) => a.ih && (a.ih.enerji < 45 || a.ih.kahve < 35)).sort((p, q) => (p.ih.kahve + p.ih.enerji * 0.5) - (q.ih.kahve + q.ih.enerji * 0.5));
      return aday[0] || null;
    },
    kahveSozu(a) { return a.ih && (a.ih.enerji < 20 || a.ih.kahve < 10) ? "Bu kahve hayat kurtarır ☕" : undefined; },
    kahveIcti(a) { if (a.ih) { doldur(a, { kahve: 60, enerji: 35 }); } I().secAjanYenile(); },
    // sebil sohbeti: en yalnız olan başlatır; arkadaşı müsaitse onu, değilse rastgele birini çağırır; arkadaş çiftinin kendi sözleri
    dedikoduCifti(bos) {
      const ic = I(), yalniz = bos.filter((a) => a.ih).sort((p, q) => p.ih.sosyal - q.ih.sosyal);
      const a = yalniz[0]; if (!a || a.ih.sosyal > 55) return undefined;
      const digerleri = bos.filter((b) => b !== a), dost = digerleri.filter((b) => arkadaslari(a.id).includes(b.id));
      const b = dost.length ? ic.rastgele(dost) : ic.rastgele(digerleri); if (!b) return undefined;
      const saka = V().sakalar[anahtar(a.id, b.id)];
      return { a, b, sozler: saka ? ic.rastgele(saka) : undefined };
    },
    sohbetEtti(a, b) {
      for (const x of [a, b]) if (x.ih) x.ih.sosyal = sinirla(x.ih.sosyal + 35);
      const k = anahtar(a.id, b.id); yakinlik.set(k, (yakinlik.get(k) || 0) + 1);
      if (arkadaslari(a.id).includes(b.id)) I().kalpler(b, 1);
      I().secAjanYenile();
    },
    konustu(a) { if (a.ih) a.ih.sosyal = sinirla(a.ih.sosyal + 12); },
    kediFavori(adaylar) {
      const fav = adaylar.filter((a) => V().kediFavori.includes(a.id));
      return fav.length && Math.random() < 0.65 ? I().rastgele(fav) : undefined;
    },
    ajanHtml(a) {
      if (!a.ih) return "";
      const r = ruhHali(a), cubuk = (ad, v, renk) =>
        `<div class="ih"><span>${ad}</span><i><b style="width:${Math.round(v)}%;background:${renk}"></b></i><em>${Math.round(v)}</em></div>`;
      const dost = arkadaslari(a.id).map((id) => I().bul(id)).filter(Boolean).map((b) => b.ad);
      const sohbet = window.OFIS_YASAM.sohbette(a);
      return `<div class="ihKutu">${r.emoji} <b>${r.ad}</b>${ihtiyaclar(a).map((x) => cubuk(x.ad, x.deger, x.renk)).join("")}${cubuk("Sosyallik", a.ih.sosyal, "#7ab8e8")}` +
        (sohbet ? `<small>Sohbet ediyor: ${sohbet}</small>` : "") + (dost.length ? `<small>Arkadaşı: ${dost.join(", ")}</small>` : "") + "</div>";
    },
    test: {
      ihtiyac: (id) => { const a = I().bul(id); return a && a.ih ? { ...Object.fromEntries(Object.entries(a.ih).map(([k, v]) => [k, Math.round(v)])), ruh: ruhHali(a).ad } : null; },
      ihtiyacAyarla: (id, d) => { const a = I().bul(id); if (a && a.ih) Object.assign(a.ih, d); return !!(a && a.ih); },
    },
  });
})();
