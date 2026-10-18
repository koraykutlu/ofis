// Ortam sohbetleri ve oda günlüğü (18 Ekim gece sürümü, C paketi). Veri: sohbetler.js (window.SOHBETLER).
// Ofiste boştaki 2-3 ajan bir yerde (sebil, kahve makinesi, mutfak masası, toplantı sonrası, masa komşuluğu, gece mesaisi) buluşur ve 4-8 satırlık,
// birbirine cevap veren bir sohbet yapar: satırlar 2-4 sn arayla `konus()` ile balon olur (oda günlüğü ve ajan sesi kendiliğinden dinler).
// - Katılımcılar `ozel = "sohbet"` ile meşgul sayılır; rutin (toplantı/öğle/akşam/çıkış), olay, oyuncu diyaloğu ya da gün dönümü gelirse sohbet nazikçe kesilir.
// - Sohbet seçimi: saat dilimi (sabah/öğle/akşam/gece), yer, rol (a/b/c yuvası), ilişki (arkadaş/rekabet), ruh hali ve ihtiyaç (tokluk, kahve). Aynı sohbet aynı gün tekrar etmez.
//   Gece (22:00-05:00) seyrek ve fısıltı tonunda. Mevcut sebil dedikodusu (surprizler.js) ayrıdır: aynı ajanları aynı anda kullanmaz (mesgul) ve yakın dedikoduyu görünce yer değiştirir.
// - Oda günlüğü: her `konusmaSatiri` (oyuncu ve ziyaretçi dahil) konuşanın odasına yazılır, odada son 60 satır; kapanışta "— gün bitti —" ayıracı.
// Dışa: OFIS_YASAM.sohbette(a) (konu ya da null), sohbetOrtaklari(a), odaGunlugu(odaId, n), gunAyraci(). Kancalar: guncelle, bastan, konusmaSatiri, ofisKapandi.
(() => {
  const I = () => window.OFIS_IC;
  const KISI = window.OFIS_KISI;
  const liste = () => (window.SOHBETLER_TAZE && window.SOHBETLER_TAZE.length ? (window.SOHBETLER || []).concat(window.SOHBETLER_TAZE) : window.SOHBETLER || []);   // SOHBETLER_TAZE: moduller/panel.js (Haiku açıksa "taze konu")
  const VARSAYILAN_DILIM = ["sabah", "ogle", "aksam"];
  const SON_SATIR = 60;
  const KESME = {
    toplanti: ["Toplantı çağırıyor, sonra devam!", "Toplantı vakti, kaldığımız yerden devam ederiz."],
    ogle: ["Yemek vakti, sonra devam edelim.", "Karnım çağırıyor, sonra!"],
    aksam: ["Yemek vakti, sonra devam edelim.", "Akşam yemeği çağırıyor, sonra!"],
    cikis: ["Mesai bitti, kaldığımız yerden yarın.", "İyi akşamlar, yarın devam!"],
    varsayilan: ["Neyse, sonra devam ederiz."],
  };
  // buluşma noktaları (karo); en yakın boş yürünebilir karo seçilir
  const YER = {
    sebil: [[34, 17], [36, 18], [38, 17]],
    kahve: [[8, 25], [7, 25], [9, 25]],
    mutfak: [[3, 25], [5, 25], [4, 26]],
  };
  const oynanan = new Set();    // bugün oynayan sohbet kimlikleri
  const sonSohbet = new Map();  // ajan id -> son sohbet zamanı (dağılım için)
  const gunluk = new Map();     // oda id -> [{saat, ajan, ad, metin}]
  const donecek = new Set();    // sohbetten kopan ama masasına dönemeyen (oyuncu konuşuyordu) ajanlar
  const oncekiRut = new Map();
  let aktif = [], sayac = 12, tpPenceresi = null, ses = 0, denetim = 0;

  // ---------- yardımcılar ----------
  const dilim = () => { const s = Math.floor(I().dakika() / 60) % 24; return s >= 22 || s < 5 ? "gece" : s < 11 ? "sabah" : s < 15 ? "ogle" : "aksam"; };
  const Y = () => window.OFIS_YASAM;
  const ayri = (list, id) => (list ? list.includes(id) : id !== "ada" && id !== "spiker");   // Ada ve Sunucu yalnız adı geçtiği sohbete katılır
  const gecerli = (a) => !a.disarda && !a.rut && !a.konusuyor && !a.gecis && a.ozel === "sohbet";
  function ayristir(c) {
    if (c._s) return;
    c._s = c.satir.map((l) => { const m = /^([abc]):\s*(.*)$/.exec(l); return [m[1], m[2]]; });
    c._slot = ["a", "b", "c"].filter((k) => c._s.some((s) => s[0] === k));
  }
  function coz(metin, ctx) {
    const ic = I();
    const m = metin.replace(/\{(a|b|c|kedi|saat)(?::([a-zıüöşç]+))?\}/g, (_, k, e) => {
      const d = k === "kedi" ? ic.kedi.ad : k === "saat" ? ic.saatYazi() : ctx[k] ? ctx[k].ad : "";
      return e ? KISI.ek(d, e) : d;
    });
    return KISI.metin(m);
  }
  const rastgeleSira = (dizi) => dizi.map((x) => [x, Math.random()]).sort((p, q) => p[1] - q[1]).map((p) => p[0]);

  // ---------- oda günlüğü ----------
  const ODA_TAKMA = { arsiv: "beyin", haber: "merkez" };   // tasarım belgesindeki eski adlar
  const odaKimligi = (id) => ODA_TAKMA[id] || id;
  function odaBul(ajan) {
    const ic = I();
    if (ajan && typeof ajan.oda === "string") return odaKimligi(ajan.oda);
    if (!ajan || typeof ajan.x !== "number" || typeof ajan.y !== "number") return null;
    const no = ic.odaKaro(ajan.x, ajan.y), o = ic.ODALAR[no];
    return o ? o.id : null;
  }
  function gunlugeYaz(odaId, kayit) {
    let l = gunluk.get(odaId); if (!l) gunluk.set(odaId, (l = []));
    l.push(kayit); if (l.length > SON_SATIR) l.splice(0, l.length - SON_SATIR);
  }
  function odaGunlugu(odaId, n = 30) { const l = gunluk.get(odaKimligi(odaId)) || []; return l.slice(-n).map((k) => ({ ...k })); }
  function gunAyraci() {
    const saat = I().saatYazi();
    for (const [, l] of gunluk) if (l.length && !l[l.length - 1].ayrac) l.push({ saat, ajan: "", ad: "", metin: "— gün bitti —", ayrac: true });
  }

  // ---------- seçim ----------
  const iliskiVar = (tur, p, q) => (tur === "arkadas" ? Y().arkadaslari(p).includes(q) : tur === "rekabet" ? Y().rakipleri(p).includes(q) : true);
  const yakinKoltuk = (p, q) => {
    const ic = I();
    return ic.odaKaro(p.koltuk[0], p.koltuk[1]) === ic.odaKaro(q.koltuk[0], q.koltuk[1]) && Math.hypot(p.koltuk[0] - q.koltuk[0], p.koltuk[1] - q.koltuk[1]) <= 13;
  };
  function ata(c, havuz) {
    ayristir(c);
    const ic = I(), sl = c._slot;
    const anahtar = new Map(havuz.map((a) => [a, (sonSohbet.get(a.id) || -1e9) + Math.random() * ic.rs(40, 700)]));
    const sirali = havuz.slice().sort((p, q) => anahtar.get(p) - anahtar.get(q));
    const dene = (i, secili) => {
      if (i === sl.length) return secili;
      const k = sl[i];
      let adaylar = sirali.filter((x) => !secili.includes(x) && ayri(c[k], x.id));
      if (i === 1 && c.iliski) adaylar = adaylar.filter((x) => iliskiVar(c.iliski, secili[0].id, x.id));
      if (c.yer === "komsu" && i > 0) adaylar = adaylar.filter((x) => yakinKoltuk(secili[0], x));
      for (const x of adaylar.slice(0, 8)) { const r = dene(i + 1, [...secili, x]); if (r) return r; }
      return null;
    };
    return dene(0, []);
  }
  function skor(c, uyeler) {
    let w = 1;
    const ih = (k) => Math.min(...uyeler.map((a) => (a.ih ? a.ih[k] : 100)));
    const et = c.etiket || [];
    if (et.includes("tokluk")) w *= ih("tokluk") < 45 ? 3 : ih("tokluk") > 75 ? 0.5 : 1;
    if (et.includes("kahve")) w *= ih("kahve") < 40 ? 3 : 1;
    if (c.ruh) w *= uyeler.some((a) => Y().ruhHali(a).ad === c.ruh || (c.ruh === "yalniz" && Y().ruhHali(a).ad === "yalnız")) ? 3 : 0.7;
    if (c.iliski === "arkadas") w *= 1.8;
    if (c.taze) w *= 2.5;   // Haiku'nun vault notlarından ürettiği taze konu önce oynanır
    return w;
  }
  // yer: buluşma karolarını seç. Başka sohbet/dedikodu/kahve yapan biri yakındaysa null (yer değiştirsin)
  function bosKaro(x, y, kullanilan, yoksay) {
    const ic = I();
    for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const tx = Math.round(x) + dx, ty = Math.round(y) + dy;
      if (!ic.yurur[ty] || !ic.yurur[ty][tx] || ic.koltuklar.has(`${tx},${ty}`)) continue;
      if (kullanilan.some((k) => k[0] === tx && k[1] === ty)) continue;
      if (ic.ajanlar.some((o) => !yoksay.includes(o) && !o.disarda && !o.yol.length && Math.hypot(o.x - tx, o.y - ty) < 0.9)) continue;
      return [tx, ty];
    }
    return null;
  }
  // her katılımcı için hedef karo; null = yerinde (komsu ya da masası buluşma noktası); hepsi bulunamazsa null (yer değiştirsin)
  function hedefler(c, uyeler) {
    const ic = I(), kullanilan = [];
    if (c.yer === "komsu") return uyeler.map(() => null);
    if (c.yer === "toplanti") {   // ilk konuşanın masasına diğerleri yürür (olay `git` ile aynı yaklaşma noktası)
      const h = ic.ziyaretNoktasi(uyeler[0]), sonuc = [null];
      for (let i = 1; i < uyeler.length; i++) {
        const n = bosKaro(h[0] + (i - 1) * 2 - 1, h[1], kullanilan, uyeler);
        if (!n) return null; kullanilan.push(n); sonuc.push(n);
      }
      return sonuc;
    }
    const merkez = YER[c.yer]; if (!merkez) return null;
    if (ic.ajanlar.some((o) => !uyeler.includes(o) && !o.disarda && ["dedikodu", "sohbet", "kahve", "atistirma"].includes(o.ozel) && Math.hypot(o.x - merkez[0][0], o.y - merkez[0][1]) < 3.2)) return null;
    const sonuc = [];
    for (let i = 0; i < uyeler.length; i++) {
      const n = bosKaro(merkez[i % merkez.length][0], merkez[i % merkez.length][1], kullanilan, uyeler);
      if (!n) return null; kullanilan.push(n); sonuc.push(n);
    }
    return sonuc;
  }

  // ---------- yürütme ----------
  function baslat(c, uyeler) {
    const ic = I(), hd = hedefler(c, uyeler);
    if (!hd) return null;
    const d = { c, uyeler, slot: {}, durum: "yuru", idx: 0, bekle: 0, t0: ic.zaman, varis: new Set(), konu: c.konu, yer: c.yer };
    c._slot.forEach((k, i) => (d.slot[k] = uyeler[i]));
    oynanan.add(c.id);
    uyeler.forEach((a, i) => {
      a.ozel = "sohbet"; sonSohbet.set(a.id, ic.zaman);
      if (!hd[i]) d.varis.add(a.id);
      else ic.gonder(a, hd[i], () => d.varis.add(a.id));
    });
    aktif.push(d);
    return d;
  }
  function satirSoyle(d) {
    const ic = I(), [k, metin] = d.c._s[d.idx], a = d.slot[k];
    const onceki = d.idx > 0 ? d.slot[d.c._s[d.idx - 1][0]] : null;
    for (const m of d.uyeler) if (m !== a) ic.yonBak(m, a);
    ic.yonBak(a, onceki && onceki !== a ? onceki : d.uyeler.find((m) => m !== a));
    ic.konus(a, coz(metin, d.slot), true);
    d.idx++;
    const gec = 2 + Math.min(1.6, metin.length / 55) + Math.random() * 0.4;   // 2-4 sn
    d.bekle = gec;
  }
  function bitir(d, kes) {
    const ic = I();
    aktif = aktif.filter((x) => x !== d);
    if (kes && d.durum === "konus" && d.idx >= 2) {
      const kesen = d.uyeler.find((a) => !gecerli(a) && !a.disarda && a.rut);
      if (kesen) ic.konus(kesen, ic.rastgele(KESME[kesen.rut] || KESME.varsayilan), true);
    }
    for (const a of d.uyeler) {
      if (a.ozel !== "sohbet") continue;
      a.ozel = null;
      if (a.konusuyor) { donecek.add(a); continue; }   // oyuncuyla konuşuyor: diyalog kapanınca masasına döner
      if (!a.disarda && !a.rut) ic.eveDon(a);
    }
    if (kes) return;
    const u = d.uyeler;
    for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) ic.MOD("sohbetEtti", u[i], u[j]);
    const et = d.c.etiket || [];
    if (d.yer === "kahve") for (const a of u) Y().doldur(a, { kahve: 25, enerji: 8 });
    if (d.yer === "mutfak" && et.includes("yemek")) for (const a of u) Y().doldur(a, { tokluk: 12 });
    ic.secAjanYenile();
  }
  function ilerlet(d, dt) {
    const ic = I();
    const bozuk = d.uyeler.find((a) => !gecerli(a));
    if (bozuk) return bitir(d, true);
    if (d.durum === "yuru") {
      if (d.uyeler.every((a) => d.varis.has(a.id))) {
        d.durum = "konus"; d.bekle = 0.6;
        const m = d.uyeler[0]; for (const a of d.uyeler) if (a !== m) ic.yonBak(a, m); ic.yonBak(m, d.uyeler[1]);
      } else if (ic.zaman - d.t0 > 60) return bitir(d, true);
      return;
    }
    d.bekle -= dt;
    if (d.bekle > 0) return;
    if (d.durum === "konus") {
      if (d.idx < d.c._s.length) satirSoyle(d);
      else { d.durum = "son"; d.bekle = 1.8; }
    } else bitir(d, false);   // son
  }

  // ---------- başlatma kararı ----------
  function sec(zorla, konuId, havuzKisit) {
    const ic = I(), dil = dilim();
    const musait = ic.ajanlar.filter((a) => !a.oyuncu && !a.disarda && !ic.mesgul(a) && ic.yerinde(a));
    if (musait.length < 2) return { hata: "boşta ajan yok" };
    const adaylar = [];
    for (const c of liste()) {
      if (konuId) { if (c.id !== konuId) continue; }
      else {
        if (oynanan.has(c.id) || !(c.dilim || VARSAYILAN_DILIM).includes(dil)) continue;
        if (c.yer === "toplanti" && !havuzKisit) continue;
        if (havuzKisit && c.yer !== "toplanti") continue;
      }
      const uyeler = ata(c, havuzKisit || musait);
      if (uyeler) adaylar.push({ c, uyeler, w: skor(c, uyeler) });
    }
    if (!adaylar.length) return { hata: konuId ? "bu sohbet için uygun ajan yok" : "uygun sohbet yok" };
    let t = adaylar.reduce((s, x) => s + x.w, 0), r = Math.random() * t, secilen = adaylar[adaylar.length - 1];
    for (const x of adaylar) { r -= x.w; if (r <= 0) { secilen = x; break; } }
    for (const x of [secilen, ...rastgeleSira(adaylar)]) { const d = baslat(x.c, x.uyeler); if (d) return { d }; }   // yer çakışırsa başkasını dene
    return { hata: "buluşma yeri dolu" };
  }
  const aralik = () => {
    const ic = I(), gece = dilim() === "gece", r = Math.random();
    return ic.rs(gece ? 28 + r * 22 : 12 + r * 14, gece ? 1500 + r * 1800 : 600 + r * 720);
  };

  const modul = {
    basla() { },
    bastan(tam) {
      const ic = I();
      for (const d of aktif) for (const a of d.uyeler) if (a.ozel === "sohbet") a.ozel = null;
      aktif = []; donecek.clear(); oynanan.clear(); sonSohbet.clear(); oncekiRut.clear(); tpPenceresi = null;
      sayac = ic.rs(10, 150 + Math.random() * 150);
      if (tam) gunluk.clear(); else gunAyraci();
    },
    ofisKapandi() { gunAyraci(); },
    guncelle(dt) {
      const ic = I();
      for (const d of aktif.slice()) ilerlet(d, dt);
      sayac -= dt;
      if ((denetim -= dt) > 0) return; denetim = 1;
      // masasına dönemeyen yetim ajanlar
      for (const a of [...donecek]) {
        if (a.konusuyor) continue;
        donecek.delete(a);
        if (!a.ozel && !a.disarda && !a.rut && !ic.yerinde(a)) ic.eveDon(a);
      }
      // toplantıdan dönenler: kısa bir süre toplantı konulu sohbet fırsatı
      for (const a of ic.ajanlar) {
        if (a.oyuncu) continue;
        const once = oncekiRut.get(a.id);
        if (once === "toplanti" && a.rut !== "toplanti" && !a.disarda) { if (!tpPenceresi || ic.zaman - tpPenceresi.t > 60) tpPenceresi = { t: ic.zaman, uyeler: new Set(), kullanildi: false }; tpPenceresi.uyeler.add(a.id); }
        oncekiRut.set(a.id, a.rut);
      }
      if (tpPenceresi && !tpPenceresi.kullanildi && aktif.length < 2) {
        if (ic.zaman - tpPenceresi.t > ic.rs(70, 400)) tpPenceresi = null;
        else if (ic.zaman - tpPenceresi.t > ic.rs(8, 40)) {
          const havuz = ic.ajanlar.filter((a) => tpPenceresi.uyeler.has(a.id) && !ic.mesgul(a) && ic.yerinde(a));
          if (havuz.length >= 2) { tpPenceresi.kullanildi = true; if (Math.random() < 0.7) sec(false, null, havuz); }
        }
      }
      // genel sıklık: gece seyrek
      if (sayac > 0) return;
      sayac = aralik();
      if (aktif.length >= 2) return;
      sec(false, null, null);
    },
    konusmaSatiri(e) {
      if (!e || !e.ajan || typeof e.metin !== "string") return undefined;
      const oda = odaBul(e.ajan); if (!oda) return undefined;
      gunlugeYaz(oda, { saat: I().saatYazi(), ajan: String(e.ajan.id || ""), ad: String(e.ajan.ad || ""), metin: e.metin });
      return undefined;
    },
  };

  Object.assign(window.OFIS_YASAM = window.OFIS_YASAM || {}, {
    sohbette: (a) => { const d = a && aktif.find((x) => x.uyeler.includes(a) && (x.durum === "konus" || x.durum === "son")); return d ? d.konu : null; },
    sohbetOrtaklari: (a) => { const d = a && aktif.find((x) => x.uyeler.includes(a)); return d ? d.uyeler.filter((x) => x !== a) : []; },
    odaGunlugu, gunAyraci,
  });

  modul.test = {
    // konuId verilirse dilim/gün kuralları atlanır; yalnız ajan uygunluğu aranır
    sohbetBaslat: (konuId) => { const r = sec(true, konuId || null, null); return r.d ? { id: r.d.c.id, konu: r.d.konu, yer: r.d.yer, uyeler: r.d.uyeler.map((a) => a.id) } : r.hata; },
    sohbetler: () => aktif.map((d) => ({ id: d.c.id, konu: d.konu, yer: d.yer, durum: d.durum, satir: d.idx + "/" + d.c._s.length, uyeler: d.uyeler.map((a) => a.id) })),
    odaGunlugu: (id) => odaGunlugu(id, SON_SATIR),
    sohbetDurum: () => ({ oynanan: [...oynanan], toplam: liste().length, dilim: dilim(), sayac: Math.round(sayac), aktif: aktif.length, tp: !!tpPenceresi }),
    sohbetSayac: (n) => { sayac = n; },
    // veri denetimi: yer tutucular çözülüyor mu, satır uzunluğu, satır sayısı, yuva tutarlılığı
    sohbetDogrula: () => {
      const ic = I(), sorun = [], ctx = { a: ic.ajanlar[1], b: ic.ajanlar[2], c: ic.ajanlar[3] }, kimler = new Set();
      for (const c of liste()) {
        ayristir(c);
        if (kimler.has(c.id)) sorun.push(c.id + ": yinelenen kimlik"); kimler.add(c.id);
        if (c._s.length < 4 || c._s.length > 8) sorun.push(`${c.id}: ${c._s.length} satır`);
        if (!c._slot.includes("a") || !c._slot.includes("b")) sorun.push(c.id + ": a/b yuvası eksik");
        for (const [k, m] of c._s) {
          const s = coz(m, ctx);
          if (/[{}]/.test(s)) sorun.push(`${c.id}: çözülmemiş yer tutucu: ${s}`);
          if (s.length > 90) sorun.push(`${c.id}: ${s.length} karakter: ${s}`);
          if (!c._slot.includes(k)) sorun.push(c.id + ": yuva " + k);
        }
      }
      return { sayi: liste().length, sorun };
    },
  };
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push(modul);
})();
