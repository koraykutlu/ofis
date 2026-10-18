// Kişi kartı ve oda kartı (Modern UI çerçevesi, haritanın sol üstünde; aynı anda tek kart).
// Kişi kartı: ajana tıklayınca. Portre, ad, rol, ruh hali + şu an ne yaptığı, kamera takibi (OFIS_IC.kameraTakip), tanıtım, hikâye ve ilişkiler (hikayeler.js),
// ihtiyaç çubukları (OFIS_YASAM.ihtiyaclar; yoksa enerji/sosyallik), "Konuş" (eski tıkla-yürü-konuş). Oyuncunun kendine tıklaması çekirdekte kalır.
// Oda kartı: oda duvar şeridine / adı yazan tabelaya ya da mini haritadaki odaya tıklayınca. Canlı küçük görüntü (kare tuvalinden ~4 Hz), İÇERİDE listesi,
// oda günlüğü (OFIS_YASAM.odaGunlugu; yoksa boş), "Oraya git" (mini-harita.js OFIS_MINI.git).
// Çekirdeğe MOD kancalarıyla bağlanır: tikla(e), fareHareket(e), tus(e), tusGozle(e). Olay kancaları tüketince true, tüketmeyince undefined döner.
// Dışa açılan: window.OFIS_KART { kisiAc(ajan|id), odaAc(odaId), kapat(), kisi(), oda(), renk(id), durum(ajan) }.
(() => {
  const I = () => window.OFIS_IC;
  const Y = () => window.OFIS_YASAM || {};
  const KISI = window.OFIS_KISI;
  const el = (id) => document.getElementById(id);
  const buyukIlk = (s) => (s ? s.charAt(0).toLocaleUpperCase("tr") + s.slice(1) : s);

  // Ajan renkleri (oda günlüğünde ad, listede kare); bilinmeyen kimlik (ziyaretçi) addan türetilir
  const RENK = { oyuncu: "#f2cf4a", kedi: "#f0a0c0", muhabir1: "#6fc3e8", muhabir2: "#e58ac8", ada: "#a99bff", postaci: "#8fd18f", tarayici: "#5fd0b8",
    analist: "#e8b25c", editor: "#f08a6a", denetci: "#d6d36a", sosyal: "#ff9f7a", spiker: "#7aa6ff", dagitici: "#c4a5e8" };
  function renk(id) {
    if (RENK[id]) return RENK[id];
    let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h},60%,72%)`;
  }
  // Oda kimliği -> "-de" ve "-e" biçimleri. Kimlikler HARITA.odalar[].id; eski tasarım adları takma ad
  const ODA_DE = { gundem: "gündem masasında", yonetim: "yönetim odasında", beyin: "arşivde", radar: "radar odasında", merkez: "haber merkezinde", mutfak: "mutfakta", toplanti: "toplantı odasında", studyo: "stüdyoda", yayin: "yayın odasında" };
  const ODA_E = { gundem: "gündem masasına", yonetim: "yönetim odasına", beyin: "arşive", radar: "radar odasına", merkez: "haber merkezine", mutfak: "mutfağa", toplanti: "toplantı odasına", studyo: "stüdyoya", yayin: "yayın odasına" };
  const ODA_TAKMA = { arsiv: "beyin", haber: "merkez" };
  const OTURAK_DE = { kanepe: "kanepede", berjer: "berjerde", "mutfak sandalyesi": "mutfak sandalyesinde", "misafir koltuğu": "misafir koltuğunda", "toplantı koltuğu": "toplantı koltuğunda", "stüdyo koltuğu": "stüdyo koltuğunda" };
  const KEDI_NE = { gez: "dolaşıyor", otur: "oturuyor", yat: "uyuyor", klavye: "bir klavyenin üstünde", ye: "mama yiyor" };
  const PANELLER = ["duzenPanel", "gardiropPanel", "sohbet", "ziyaretPanel"];   // bunlar açıkken kart açılmaz / kapanır (aynı köşe)
  const HAREKET_TUSLARI = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"]);

  let tur = null, ajan = null, oda = null, odaNo = -1;   // açık kart: "kisi" | "oda" | null
  let kamAcildi = false, zamanlayici = 0, sayac = 0, sonUzak = false, kisiEl = null, odaEl = null;
  const K = {}, O = {};   // kart parçaları (DOM başvuruları)

  const yap = (etiket, sinif, metin) => { const e = document.createElement(etiket); if (sinif) e.className = sinif; if (metin != null) e.textContent = metin; return e; };
  const yakin = (p, q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= r;
  const odaOf = (x, y) => { const ic = I(), i = ic.odaKaro(x, y); return i >= 0 ? ic.ODALAR[i] : null; };
  const panelAcik = () => PANELLER.some((id) => el(id) && !el(id).hidden);

  // ---------- "şu an ne yapıyor" ----------
  function sohbetMetni(a) {
    const ic = I(); let konu = null;
    try { konu = Y().sohbette && Y().sohbette(a); } catch (e) { konu = null; }
    if (!konu) return null;
    const sohbetteMi = (b) => { try { return !!(Y().sohbette && Y().sohbette(b)); } catch (e) { return false; } };
    const es = ic.ajanlar.filter((b) => b !== a && !b.oyuncu && !b.disarda && Math.hypot(b.x - a.x, b.y - a.y) < 5 && sohbetteMi(b))
      .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
    const ek = typeof konu === "string" && konu.includes(" ") && konu.length <= 40 ? ` · ${konu}` : "";
    return (es ? `${es.ad} ile sohbet ediyor` : "Sohbet ediyor") + ek;
  }
  function gidisMetni(a, hedef) {
    const ic = I();
    if (yakin(hedef, ic.YAZICI, 2.2)) return "yazıcıya gidiyor";
    if (yakin(hedef, ic.KAHVE, 2.2)) return "kahve makinesine gidiyor";
    const op = ic.oyuncu; if (op && yakin(hedef, [op.x, op.y], 2.8)) return `${KISI.ek(op.ad, "a")} gidiyor`;
    const b = ic.ajanlar.find((x) => x !== a && !x.oyuncu && yakin(hedef, [x.koltuk[0], x.koltuk[1] + 2], 1.6));
    if (b) return `${KISI.ek(b.ad, "ın")} yanına gidiyor`;
    const o = odaOf(hedef[0], hedef[1]); return o ? `${ODA_E[o.id] || o.ad} gidiyor` : "bir işe gidiyor";
  }
  function durum(a) {
    const ic = I(), z = ic.zaman, yol = a.yol || [], yuruyor = yol.length > 0, hedef = yuruyor ? yol[yol.length - 1] : null, konum = [a.x, a.y];
    if (a.disarda) return a.cikti ? "Eve gitti" : "Dışarıda, henüz gelmedi";
    const oda_ = odaOf(a.x, a.y);
    if (a.rut === "gelis") return "Asansörden çıkıp masasına gidiyor";
    if (a.rut === "toplanti") return oda_ && oda_.id === "toplanti" ? "Toplantıda" : "Toplantıya gidiyor";
    if (a.rut === "ogle") return "Öğle arasında";
    if (a.rut === "aksam") return "Akşam yemeğinde";
    if (a.rut === "cikis") return "Eve gidiyor";
    const sohbet = sohbetMetni(a); if (sohbet) return sohbet;
    if (a.konusuyor) return ic.oyuncu ? `${ic.oyuncu.ad} ile konuşuyor` : "Konuşuyor";
    switch (a.ozel) {
      case "kahve": return yuruyor ? "Kahve almaya gidiyor" : "Kahve alıyor";
      case "mola": return a.oturak ? `Molada, ${OTURAK_DE[a.oturak.ad] || a.oturak.ad} dinleniyor` : "Mola vermeye gidiyor";
      case "dedikodu": return yuruyor ? "Sebile gidiyor" : "Sebil başında sohbet ediyor";
      case "beyin": return a.id === "ada" && !a.oturak ? "Arşivde arıyor" : "Bir şey araştırıyor";
      case "olay": case "gorev": {
        if (hedef) return buyukIlk(gidisMetni(a, hedef));
        if (yakin(konum, ic.YAZICI, 2.2)) return "Yazıcıdan çıktı alıyor";
        if (yakin(konum, ic.KAHVE, 2.2)) return "Kahve makinesinin başında";
        const b = [...ic.ajanlar].filter((x) => x !== a && !x.disarda && Math.hypot(x.x - a.x, x.y - a.y) < 2.4).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
        return b ? `${b.ad} ile konuşuyor` : "Bir işle uğraşıyor";
      }
    }
    if (z < a.telefonSon) return "Telefonda";
    const k = ic.kedi;
    if (!yuruyor && k.durum === "klavye" && k.ust && Math.abs(k.ust.px - a.koltuk[0] * ic.T) < 20) return "Klavyesine Sütlaç oturmuş";
    if (a.oturak) return buyukIlk(`${OTURAK_DE[a.oturak.ad] || a.oturak.ad} oturuyor`);
    if (yuruyor) {
      if (a.koltuk && hedef[0] === a.koltuk[0] && hedef[1] === a.koltuk[1]) return "Masasına dönüyor";
      return buyukIlk(gidisMetni(a, hedef));
    }
    if (ic.yerinde(a)) return a.yazSon > z ? "Masasında yazıyor" : "Masasında çalışıyor";
    if (Math.hypot(k.x - a.x, k.y - a.y) < 1.8) return "Sütlaç'ı seviyor";
    if (yakin(konum, ic.YAZICI, 2.2)) return "Yazıcının başında";
    if (yakin(konum, ic.KAHVE, 2.2)) return "Kahve makinesinin başında";
    return oda_ ? buyukIlk(`${ODA_DE[oda_.id] || oda_.ad} duruyor`) : "Ofiste";
  }
  function ruh(a) {
    if (I().uzak) return null;
    try { return (Y().ruhHali && Y().ruhHali(a)) || null; } catch (e) { return null; }
  }

  // ---------- ortak kabuk ----------
  function kabuk(id) {
    let e = el(id);
    if (!e) { e = yap("div", "cerceve"); e.id = id; e.setAttribute("role", "dialog"); e.hidden = true; (document.querySelector(".sahne") || document.body).appendChild(e); }
    return e;
  }
  function temizle() {   // takibi bırak ve eski kamerayı geri ver (kartı gizlemez)
    const ic = I();
    if (ic && ic.kameraTakip) ic.kameraTakip = null;
    if (kamAcildi) { kamAcildi = false; if (ic) ic.kameraAyarla(false); }
  }
  function kapat() {
    temizle();
    tur = null; ajan = null; oda = null; odaNo = -1;
    if (kisiEl) kisiEl.hidden = true;
    if (odaEl) odaEl.hidden = true;
    clearInterval(zamanlayici); zamanlayici = 0;
    const ic = I(); if (ic) ic.cv.focus();
  }
  function baslat() { if (!zamanlayici) zamanlayici = setInterval(tik, 125); }

  // ---------- kişi kartı ----------
  function kisiKur() {
    kisiEl = kabuk("kisiKart"); kisiEl.setAttribute("aria-label", "Kişi kartı");
    if (K.kuruldu) return; K.kuruldu = true;
    const bas = yap("div", "kBas"); K.ust = yap("span", "kUst"); K.kapat = yap("button", "kKapat", "✕"); K.kapat.title = "Kapat (Esc)"; K.kapat.onclick = kapat;
    bas.append(K.ust, K.kapat);
    const ic = yap("div", "kIc");
    const kim = yap("div", "kKim"); K.portre = yap("canvas", "kPortre"); K.portre.width = 18; K.portre.height = 22;
    const m = yap("div", "kMetin"); K.ad = yap("div", "kAd"); K.rol = yap("div", "kRol"); m.append(K.ad, K.rol); kim.append(K.portre, m);
    K.durum = yap("div", "kDurum"); K.emoji = yap("span", "kEmoji"); K.ne = yap("span", "kNe"); K.durum.append(K.emoji, K.ne);
    K.takip = yap("button", "kTakip"); K.takipEt = yap("span", "kTakipEt"); K.takipAlt = yap("small", "kTakipAlt", "yakındaki konuşmalar yüksek, uzaktakiler kısık"); K.takip.append(K.takipEt, K.takipAlt);
    K.takip.onclick = () => { if (!ajan) return; if (I().kameraTakip === ajan) takipBirak(); else takipBaslat(); takipYaz(); I().cv.focus(); };
    K.tanitim = yap("p", "kTanitim");
    K.hik = yap("details", "kHik"); K.hikOzet = yap("summary", null, "📖 Hikâyesi ve ilişkileri"); K.hikGovde = yap("div", "kHikGovde"); K.hik.append(K.hikOzet, K.hikGovde);
    K.cubuklar = yap("div", "kCubuklar"); K.satirlar = []; K.cubukAnahtar = null;
    ic.append(kim, K.durum, K.takip, K.tanitim, K.hik, K.cubuklar);
    const alt = yap("div", "kAlt"); K.konus = yap("button", "kKonus", "Konuş");
    K.konus.onclick = konusGit; alt.append(K.konus);
    kisiEl.replaceChildren(bas, ic, alt);
  }
  function takipBaslat() {
    const ic = I(); if (!ic || ic.uzak || !ajan || ajan.disarda) return;
    if (!ic.kameraYakin) { ic.kameraAyarla(true); kamAcildi = true; }
    ic.kameraTakip = ajan;
  }
  function takipBirak() { const ic = I(); if (ic.kameraTakip) ic.kameraTakip = null; if (kamAcildi) { kamAcildi = false; ic.kameraAyarla(false); } }
  function takipYaz() {
    const ic = I(), var_ = ic.kameraTakip === ajan;
    K.takip.classList.toggle("secili", var_);
    K.takipEt.textContent = var_ ? "🎧 Kamera bu karakteri izliyor" : "🎧 Kamerayla izle";
    K.takip.disabled = !!ic.uzak || !!ajan.disarda;
  }
  function konusGit() {
    const ic = I(), a = ajan; if (!a || a.disarda || ic.uzak || !ic.oyuncu) return;
    kapat();
    ic.gonder(ic.oyuncu, ic.ziyaretNoktasi(a), () => { if (Math.hypot(a.x - ic.oyuncu.x, a.y - ic.oyuncu.y) <= 2.6) ic.diyalogAc(a); });
  }
  function portreCiz(a) {
    const ic = I(), c = K.portre, pg = ic.img.portre && ic.img.portre[a.id], p = c.getContext("2d");
    c.classList.toggle("pg", !!pg);
    if (pg) {
      if (c.width !== 32) { c.width = 32; c.height = 32; }
      const konusuyor = a.balon && ic.zaman <= a.balonSon, kare = konusuyor ? 1 + (Math.floor(performance.now() / 90) % 9) : 0;
      p.imageSmoothingEnabled = false; p.clearRect(0, 0, 32, 32); p.drawImage(pg, kare * 32, 0, 32, 32, 0, 0, 32, 32);
    } else {
      if (c.width !== 18) { c.width = 18; c.height = 22; }
      p.imageSmoothingEnabled = false; p.fillStyle = "#3f4258"; p.fillRect(0, 0, 18, 22);
      const s = ic.img.k[a.id]; if (s) p.drawImage(s, 18 * 16, 32 + 8, 16, 22, 1, 1, 16, 22);
    }
  }
  function hikayeKur(a) {
    const ic = I(), h = (window.OFIS_HIKAYE || {})[a.id], uzak = ic.uzak;
    K.tanitim.textContent = h && !uzak ? KISI.metin(h.tanitim) : ""; K.tanitim.hidden = !h || uzak;
    K.hik.hidden = !h || uzak; K.hik.open = false; K.hikGovde.replaceChildren();
    if (!h || uzak) return;
    K.hikGovde.append(yap("p", null, KISI.metin(h.hikaye)));
    const ark = (() => { try { return Y().arkadaslari ? Y().arkadaslari(a.id) : []; } catch (e) { return []; } })();
    const demo = (window.DEMO && DEMO.iliskiler) || { sakalar: {}, kediFavori: [] };
    const dost = ark.map((id) => ic.bul(id)).filter(Boolean);
    if (dost.length) K.hikGovde.append(yap("p", "kIliski", "Arkadaşları: " + dost.map((b) => b.ad).join(", ")));
    for (const b of dost.slice(0, 2)) {
      const saka = (demo.sakalar || {})[[a.id, b.id].sort().join("|")];
      if (saka && saka[0]) K.hikGovde.append(yap("p", "kIliski", `${b.ad} ile şakası: “${saka[0][0]}” · “${saka[0][1]}”`));
    }
    if ((demo.kediFavori || []).includes(a.id)) K.hikGovde.append(yap("p", "kIliski", "Sütlaç'ın gözdesi: klavyesine sık sık o oturur."));
  }
  function cubukYaz(a) {
    const ic = I(); let liste = null;
    try { liste = Y().ihtiyaclar && Y().ihtiyaclar(a); } catch (e) { liste = null; }
    if (!Array.isArray(liste) || !liste.length) liste = a.ih ? [{ id: "enerji", ad: "Enerji", deger: a.ih.enerji, renk: "#5aa0e6" }, { id: "sosyal", ad: "Sosyallik", deger: a.ih.sosyal, renk: "#e0b84a" }] : [];
    if (ic.uzak) liste = [];
    K.cubuklar.hidden = !liste.length;
    const anahtar = liste.map((x) => x.id || x.ad).join();
    if (anahtar !== K.cubukAnahtar) {
      K.cubukAnahtar = anahtar; K.cubuklar.replaceChildren(); K.satirlar = liste.map(() => {
        const s = yap("div", "kB"), ad = yap("span"), i = yap("i"), d = yap("b"), sayi = yap("em"); i.append(d); s.append(ad, i, sayi); K.cubuklar.append(s); return { ad, d, sayi };
      });
    }
    liste.forEach((x, i) => {
      const v = Math.round(Math.max(0, Math.min(100, +x.deger || 0))), s = K.satirlar[i];
      s.ad.textContent = x.ad; s.d.style.width = v + "%"; s.d.style.background = x.renk || "#9a9caa"; s.sayi.textContent = v;
    });
  }
  function kisiYenile() {
    const a = ajan, ic = I(); if (!a) return;
    K.ust.textContent = `${KISI.buyuk(KISI.ofis)} · PERSONEL`;
    K.ad.textContent = a.ad; K.rol.textContent = a.rol;
    const r = ruh(a), d = durum(a);
    K.emoji.textContent = r ? r.emoji : "";
    K.ne.textContent = r && !a.disarda ? `${r.ad} · ${d.charAt(0).toLocaleLowerCase("tr") + d.slice(1)}` : d;
    K.durumAnahtar = K.ne.textContent;
    if (ic.kameraTakip === a && a.disarda) takipBirak();
    takipYaz(); cubukYaz(a);
    K.konus.disabled = !!ic.uzak || !!a.disarda;
  }
  function kisiAc(x, ops) {
    const ic = I(); if (!ic) return null;
    const a = typeof x === "string" ? ic.bul(x) : x;
    if (!a || a.oyuncu || a.kedi) return null;
    if (tur) temizle();
    kisiKur(); if (odaEl) odaEl.hidden = true;
    tur = "kisi"; ajan = a; oda = null; odaNo = -1; sonUzak = !!ic.uzak;
    kisiEl.hidden = false; K.hik.open = false; K.cubukAnahtar = null;
    if (!ops || ops.takip !== false) takipBaslat();
    hikayeKur(a); portreCiz(a); kisiYenile();
    try { ic.secAjan(a); } catch (e) { /* yan panel */ }
    baslat(); return a;
  }

  // ---------- oda kartı ----------
  function odaKur() {
    odaEl = kabuk("odaKart"); odaEl.setAttribute("aria-label", "Oda kartı");
    if (O.kuruldu) return; O.kuruldu = true;
    const bas = yap("div", "kBas"); O.ad = yap("b", "oAd"); O.kapat = yap("button", "kKapat", "✕"); O.kapat.title = "Kapat (Esc)"; O.kapat.onclick = kapat;
    bas.append(O.ad, O.kapat);
    const ic = yap("div", "kIc");
    O.ses = yap("div", "oSes", "🎧 Ekrandaki konuşmalar sırayla sesli, uzaktakiler kısık");
    O.gor = yap("canvas", "oGor"); O.gor.width = 270; O.gor.height = 120;
    O.bilgi = yap("div", "oBilgi");
    O.listeBaslik = yap("h3", "oBaslik"); O.liste = yap("div", "oListe"); O.listeAnahtar = "";
    O.gunlukBaslik = yap("h3", "oBaslik"); O.gunluk = yap("div", "oGunluk"); O.gunlukAnahtar = "";
    ic.append(O.ses, O.gor, O.bilgi, O.listeBaslik, O.liste, O.gunlukBaslik, O.gunluk);
    const alt = yap("div", "kAlt"); O.git = yap("button", "oGit", "Oraya git"); O.git.onclick = orayaGit; alt.append(O.git);
    odaEl.replaceChildren(bas, ic, alt);
  }
  function orayaGit() {
    const ic = I(); if (!oda || !ic.oyuncu) return;
    if (window.OFIS_MINI) window.OFIS_MINI.git(oda.id);
    ic.cv.focus();
  }
  function icerdekiler() {
    const ic = I(), s = [];
    if (ic.oyuncu && odaNo === ic.odaKaro(ic.oyuncu.x, ic.oyuncu.y)) s.push({ id: "oyuncu", ad: `${ic.oyuncu.ad} (sen)`, renk: renk("oyuncu"), ne: (ic.oyuncu.yol && ic.oyuncu.yol.length) || (ic.tuslar && ic.tuslar.size) ? "Yürüyor" : ic.oyuncu.oturak ? "Oturuyor" : "Burada", ajan: null });
    for (const a of ic.ajanlar) if (!a.oyuncu && !a.disarda && ic.odaKaro(a.x, a.y) === odaNo) s.push({ id: a.id, ad: a.ad, renk: renk(a.id), ne: durum(a), ajan: a });
    const k = ic.kedi; if (k && !k.gizli && ic.odaKaro(k.ust ? k.ust.px / ic.T : k.x, k.ust ? k.ust.py / ic.T : k.y) === odaNo) s.push({ id: "kedi", ad: "Sütlaç", renk: renk("kedi"), ne: buyukIlk(KEDI_NE[k.durum] || "dolaşıyor"), ajan: null });
    return s;
  }
  function gorunumCiz() {
    const ic = I(), o = oda, c = O.gor; if (!o || !ic.f) return;
    const T = ic.T, sw = o.w * T, sh = o.h * T, cw = Math.max(120, Math.round(c.clientWidth || 260)), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(cw * dpr), H = Math.round((W * sh) / sw);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const x = c.getContext("2d"), olc = W / sw;
    x.imageSmoothingEnabled = olc < 1; x.imageSmoothingQuality = "high";
    x.drawImage(ic.f.canvas, o.x * T, o.y * T, sw, sh, 0, 0, W, H);
    // boş/loş oda: ışık katmanı (varsa) kadar karart
    let isik = null; try { const oi = window.__ofis && window.__ofis.odaIsik && window.__ofis.odaIsik(); if (oi && typeof oi[o.id] === "number") isik = oi[o.id]; } catch (e) { isik = null; }
    if (isik != null && isik < 1) { x.fillStyle = `rgba(8,10,28,${((1 - Math.max(0, isik)) * 0.5).toFixed(2)})`; x.fillRect(0, 0, W, H); }
    // içerdekiler: yeterince büyükse ad (ajan renginde), dar/uzun odada renkli nokta (adlar üst üste biniyordu)
    const fs = 10 * dpr;
    x.font = `bold ${fs}px system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "top"; x.lineWidth = 3; x.lineJoin = "round";
    for (const m of icerdekiler()) {
      if (!m.ajan) continue;
      const px = (m.ajan.x * T + 8 - o.x * T) * olc, py = (m.ajan.y * T + T - o.y * T) * olc + 1;
      if (olc >= 0.7) { x.strokeStyle = "rgba(10,10,20,.85)"; x.strokeText(m.ad, px, py); x.fillStyle = m.renk; x.fillText(m.ad, px, py); }
      else { x.beginPath(); x.arc(px, py - 4 * dpr, 3 * dpr, 0, 7); x.fillStyle = m.renk; x.fill(); x.strokeStyle = "rgba(10,10,20,.9)"; x.lineWidth = dpr; x.stroke(); }
    }
  }
  function odaYenile() {
    const ic = I(), o = oda; if (!o) return;
    O.ad.textContent = o.ad;
    O.ses.hidden = !(window.OFIS_SES_AJAN && window.OFIS_SES_AJAN.acik && window.OFIS_SES_AJAN.acik());
    const gercekIs = o.id === "gundem" && !ic.uzak && window.OFIS_GERCEK ? window.OFIS_GERCEK.sayi() : null;   // gercek.js: vault'taki açık iş sayısı (veri yoksa null)
    const bekleyen = o.id === "yonetim" && !ic.uzak ? document.querySelectorAll("#onaylar .onay").length : gercekIs;
    O.bilgi.hidden = bekleyen == null; O.bilgi.textContent = bekleyen == null ? "" : o.id === "gundem" ? `Masada bekleyen iş: ${bekleyen}` : `Masada bekleyen onay: ${bekleyen}`;
    const ic_ = icerdekiler(), anahtar = JSON.stringify(ic_.map((m) => [m.id, m.ad, m.ne]));
    O.listeBaslik.textContent = `İÇERİDE (${ic_.length})`;
    if (anahtar !== O.listeAnahtar) {
      O.listeAnahtar = anahtar; O.liste.replaceChildren();
      if (!ic_.length) O.liste.append(yap("div", "bos", "Kimse yok."));
      for (const m of ic_) {
        const satir = yap("div", "oSatir"), kare = yap("i"), ad = m.ajan ? yap("button", "oAdBtn", m.ad) : yap("span", "oAdYaz", m.ad), ne = yap("span", "oNe", m.ne);
        kare.style.background = m.renk; ad.style.color = m.renk;
        if (m.ajan) ad.onclick = () => kisiAc(m.ajan);
        satir.append(kare, ad, ne); O.liste.append(satir);
      }
    }
    O.gunlukBaslik.textContent = `${KISI.buyuk(o.ad)} GÜNLÜĞÜ`; O.gunlukBaslik.hidden = O.gunluk.hidden = !!ic.uzak;
    if (ic.uzak) return;
    let g = []; try { g = (Y().odaGunlugu && Y().odaGunlugu(o.id, 30)) || []; } catch (e) { g = []; }
    const ganahtar = o.id + "|" + g.length + "|" + (g.length ? g[g.length - 1].saat + g[g.length - 1].metin : "");
    if (ganahtar !== O.gunlukAnahtar) {
      O.gunlukAnahtar = ganahtar; const dipte = O.gunluk.scrollHeight - O.gunluk.scrollTop - O.gunluk.clientHeight < 24;
      O.gunluk.replaceChildren();
      if (!g.length) O.gunluk.append(yap("div", "bos", "Henüz konuşma yok."));
      for (const e of g) {
        const s = yap("div", "oG"), t = yap("time", null, e.saat), ad = yap("b", null, e.ad || e.ajan), m = yap("span", null, ": " + e.metin);
        ad.style.color = renk(e.ajan); s.append(t, ad, m); O.gunluk.append(s);
      }
      if (dipte || !O.gunluk.dataset.k) O.gunluk.scrollTop = O.gunluk.scrollHeight;
      O.gunluk.dataset.k = "1";
    }
  }
  function odaAc(id) {
    const ic = I(); if (!ic) return null;
    const i = typeof id === "number" ? id : ic.ODALAR.findIndex((o) => o.id === (ODA_TAKMA[id] || id));
    if (i < 0) return null;
    if (tur) temizle();
    odaKur(); if (kisiEl) kisiEl.hidden = true;
    tur = "oda"; oda = ic.ODALAR[i]; odaNo = i; ajan = null; sonUzak = !!ic.uzak;
    O.listeAnahtar = O.gunlukAnahtar = ""; O.gunluk.dataset.k = "";
    odaEl.hidden = false; odaYenile(); gorunumCiz(); baslat();
    return oda;
  }

  // ---------- zamanlayıcı ----------
  function tik() {
    if (!tur) return;
    const ic = I();
    if (!ic || ic.uzak !== sonUzak || panelAcik()) return kapat();
    sayac++;
    if (tur === "kisi") {
      if (ic.kameraTakip && ic.kameraTakip !== ajan) { kamAcildi = false; }   // başka modül takibi aldı
      portreCiz(ajan); if (sayac % 4 === 0) kisiYenile();
    } else {
      if (sayac % 2 === 0) gorunumCiz();
      if (sayac % 4 === 0) odaYenile();
    }
  }

  // ---------- tıklama ----------
  function ajanVuruldu(wx, wy) {
    const ic = I(), x = wx / ic.T, y = wy / ic.T, k = ic.kedi;
    const kx = k.ust ? k.ust.px / ic.T : k.x, ky = k.ust ? k.ust.py / ic.T : k.y;
    if (x >= kx - 0.1 && x < kx + 1.1 && y >= ky - 0.2 && y < ky + 1.1) return k;   // Sütlaç çekirdekte kalır
    return ic.ajanlar.find((a) => !a.disarda && x >= a.x - 0.1 && x < a.x + 1.1 && y >= a.y - 1.1 && y < a.y + 1.1) || null;
  }
  // Odanın adı yazan tabelası (ustKatman: odanın sol altında) ya da duvar şeridi (ilk 2 satır, yürünemeyen) mi?
  function odaVuruldu(wx, wy) {
    const ic = I(), T = ic.T, tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    if (tx < 0 || ty < 0 || tx >= ic.GEN || ty >= ic.YUK) return -1;
    const i = ic.odaNo[ty][tx], o = ic.ODALAR[i];
    if (o && ty < o.y + 2 && !ic.yurur[ty][tx]) return i;
    const yo = ic.yo, ko = ic.kam.o;
    ic.g.font = `bold ${13 * yo}px system-ui, 'Segoe UI', sans-serif`;
    for (let j = 0; j < ic.ODALAR.length; j++) {
      const p = ic.ODALAR[j], lx = p.x * T + (10 * yo) / ko, ly = (p.y + p.h) * T - (24 * yo) / ko, lw = ic.g.measureText(p.ad).width / ko;
      if (wx >= lx - 4 && wx <= lx + lw + 4 && wy >= ly - 2 && wy <= ly + (15 * yo) / ko + 2) return j;
    }
    return -1;
  }
  const engelli = (e) => e.miniTik || panelAcik();
  function vurus(e) {
    const ic = I(); if (!ic || !ic.oyuncu || engelli(e)) return null;
    const [wx, wy] = ic.dunya(e), a = ajanVuruldu(wx, wy);
    if (a === ic.kedi) return { yok: true };
    if (a) return a.oyuncu ? { yok: true } : { ajan: a };
    const i = odaVuruldu(wx, wy);
    return i >= 0 ? { oda: i } : null;
  }

  // ---------- test ----------
  const cizimOzeti = (c) => { try { const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 16) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0; return h; } catch (e) { return 0; } };
  function sigar(kutu) {
    const s = document.querySelector(".sahne").getBoundingClientRect(), r = kutu.getBoundingClientRect(), ic = kutu.querySelector(".kIc");
    return r.left >= s.left - 0.5 && r.right <= s.right + 0.5 && r.top >= s.top - 0.5 && r.bottom <= s.bottom + 0.5 && kutu.scrollWidth <= kutu.clientWidth + 1 && ic.scrollWidth <= ic.clientWidth + 1;
  }
  function ozet() {
    const ic = I();
    if (tur === "kisi") {
      kisiYenile(); portreCiz(ajan);
      return { tur, id: ajan.id, ad: K.ad.textContent, rol: K.rol.textContent, ust: K.ust.textContent, durum: K.ne.textContent, emoji: K.emoji.textContent, takip: ic.kameraTakip === ajan,
        takipMetni: K.takipEt.textContent + " · " + K.takipAlt.textContent, kameraYakin: ic.kameraYakin, tanitim: K.tanitim.textContent, hikaye: K.hik.hidden ? "" : K.hikGovde.textContent,
        cubuklar: K.satirlar.map((s) => [s.ad.textContent, +s.sayi.textContent, s.d.style.background]), konusAcik: !K.konus.disabled, portre: [K.portre.width, K.portre.height, cizimOzeti(K.portre)],
        sigar: sigar(kisiEl), kutu: (({ left, top, width, height }) => [left, top, width, height].map(Math.round))(kisiEl.getBoundingClientRect()) };
    }
    if (tur === "oda") {
      odaYenile(); gorunumCiz();
      return { tur, id: oda.id, ad: O.ad.textContent, baslik: O.listeBaslik.textContent, iceride: icerdekiler().map((m) => m.id), gunlukBaslik: O.gunlukBaslik.textContent, gunluk: O.gunluk.querySelectorAll(".oG").length,
        gunlukMetin: O.gunluk.textContent.slice(0, 120), gorunum: [O.gor.width, O.gor.height, cizimOzeti(O.gor)], bilgi: O.bilgi.hidden ? null : O.bilgi.textContent, sesSatiri: !O.ses.hidden,
        sigar: sigar(odaEl), kutu: (({ left, top, width, height }) => [left, top, width, height].map(Math.round))(odaEl.getBoundingClientRect()) };
    }
    return { tur: null, kameraTakip: ic.kameraTakip && ic.kameraTakip.id };
  }

  window.OFIS_KART = { kisiAc, odaAc, kapat, kisi: () => (tur === "kisi" ? ajan : null), oda: () => (tur === "oda" ? oda : null), renk, durum };

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() { kisiKur(); odaKur(); },
    tikla(e) {
      const v = vurus(e);
      if (!v) { if (I().kameraTakip && tur === "kisi" && !engelli(e)) { temizle(); if (ajan) takipYaz(); } return; }   // zemine tıklama oyuncuyu yürütür: takibi bırak
      if (v.yok) return;
      if (v.ajan) kisiAc(v.ajan); else odaAc(v.oda);
      return true;
    },
    fareHareket(e) {
      const v = vurus(e); if (!v || v.yok || v.ajan) return;
      I().cv.style.cursor = "pointer"; return true;   // oda tabelası / duvar şeridi
    },
    tus(e) { if (e.key === "Escape" && tur) { kapat(); return true; } },
    tusGozle(e) { if (tur === "kisi" && HAREKET_TUSLARI.has(e.code) && I().kameraTakip) { temizle(); takipYaz(); } },   // oyuncu kıpırdadı: kamera ona döner
    test: {
      kartKisi: (id) => { const a = kisiAc(id); return a ? ozet() : null; },
      kartOda: (id) => { const o = odaAc(id); return o ? ozet() : null; },
      kartKapat: () => { kapat(); return ozet(); },
      kartOzet: ozet,
    },
  });
})();
