// Asansörle Wi-Fi ziyareti (istemci): giriş asansöründe E → "Kat seç" paneli; eşleşmiş ofislerden birine ziyaret isteği, ev sahibinde onay kartı, kabulde ev sahibinin ofisi
// (onun düzeni, onun oyuncu görünümü, ajan adı/rolü/konumu, kedi, saat) kendi karakterinle yürüyerek gezilir. Ağ işi sunucudadır (ziyaret.py: eşleşme sırrı, HMAC imza,
// dinleyici); bu modül yalnız 127.0.0.1 üzerindeki /api/ziyaret/* uçlarını kullanır, sır tarayıcıya hiç gelmez.
// Üç rol: (1) ayarlar bölümü (ziyarete aç, kod üret, yakındaki ofisler, eşleş, eşleşmeleri kaldır); (2) EV SAHİBİ: ofis açıkken ~4 Hz anlık görüntü yollar
// (konumlar, kedi, saat; ad/metin/yol yok), onay kartı gösterir, gelen misafirleri ekKarakterler olarak çizer, "uğurla"; (3) MİSAFİR: onaydan sonra çekirdeğin uzak
// moduna (OFIS_IC.uzakGir) geçer, konumunu yollar, ev sahibinin anlık görüntüsünü uygular, bağlantı kopar/biterse ya da asansörden "Kendi ofisime dön"de geri döner.
// Misafir yazamaz: 🧠, Düzenle, gardırop, onay/brifing kartları, görevler kapalıdır (body.uzak); ajanlarla E yalnız selam balonudur.
// Ziyaret sohbeti (protokol 2): ziyaretteyken (iki tarafta da) Enter/T sohbet satırını açar, 1-4 hızlı tepki; mesaj göndericinin üstünde ~5 sn balon olur, "Ziyaret sohbeti"
// kartında listelenir, gelen mesaj OFIS_SES_AJAN varsa seslendirilir. Mesajlar yalnız sunucu üzerinden (imzalı /z/mesaj, /z/an cevabı) gelir; metin textContent ile basılır.
// Kancalar: basla, guncelle, uzakGuncelle, uzakHedef, tus (panel/Esc/sohbet), tikla (panel açıkken tüketir), duzenCiz ("Buraya gel" işareti).
(() => {
  const I = () => window.OFIS_IC;
  const el = (id) => document.getElementById(id);
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  const SELAM = ["Hoş geldin!", "Ofise bir göz at, kahve makinesi köşede.", "Günaydın! Sütlaç'ı gördün mü?", "Rahatına bak, misafirimizsin.", "Burada herkes çalışıyor, belli etme."];
  const DURUM_MESAJ = { red: "Ev sahibi ziyareti kabul etmedi.", zaman: "Ev sahibi zamanında yanıt vermedi.", yok: "" };

  let durum = null, acik = false, panelAcik = false, mesgul = false, sayac = 0, bekleyenId = null, kartKalan = 0, kartZ = 0, ayarZ = 0;
  let beklerken = null;          // misafir: {id, ad, kalan} onay beklerken
  let ziyaret = null;            // misafir: {id, ad, sahne, sahip: ekKarakter} ziyaret sürerken
  let hareketMesgul = false, hareketZ = 0, sonMesaj = "", kartAnahtar = "";
  const misafirler = new Map();  // ev sahibi: v -> ekKarakter
  let sohbetGor = 0, sohbetHazir = false, ben = "", sohbetDurumZ = 0;   // ev sahibi: görülen son mesaj sıra no; misafir: kendi kısa kimliği
  const gorulen = new Set(), satirlar = [], isaretler = [], canliBalon = new Map();   // sıra no (tekrar gösterilmez), kart satırları, "Buraya gel" işaretleri, balon süreleri
  const BALON_MS = 5000, ISARET_MS = 6000, SATIR_EN_FAZLA = 100;

  // ---------- sunucu ----------
  async function api(yol, govde) {
    if (!ANAHTAR) return { hata: "sunucusuz", _kod: 0 };
    try {
      const r = await fetch(`/api/ziyaret/${yol}`, { method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) },
        body: govde ? JSON.stringify(govde) : undefined });
      const j = await r.json().catch(() => ({}));
      return { ...j, _kod: r.status };
    } catch (e) { return { hata: "Ofis sunucusuna ulaşılamadı.", _kod: -1 }; }
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  const yaz = (k, m) => { if (k) k.textContent = m || ""; };

  // ---------- ev sahibi: anlık görüntü ve yoklama ----------
  // Yalnız sayılar: [id, x, y, yon, yürüyor, oturak no, ofiste değil, telefonda, yazıyor, balon(0 yok, 1 var, 2 sohbet)]. Ad, metin, görev, brifing, yol YOK.
  function anYap() {
    const ic = I(), o = ic.oyuncu, k = ic.kedi, kisiler = ic.ajanlar.filter((a) => !a.oyuncu);
    return {
      d: r2(ic.dakika()),
      a: kisiler.map((a) => [a.id, r2(a.x), r2(a.y), a.yon | 0, a.yol.length ? 1 : 0, ic.OTURAKLAR.indexOf(a.oturak), a.disarda ? 1 : 0, ic.zaman < a.telefonSon ? 1 : 0,
        a.yazSon && ic.yerinde(a) ? 1 : 0, a.balon && ic.zaman <= a.balonSon ? (a.ozel === "beyin" ? 2 : 1) : 0]),
      o: [r2(o.x), r2(o.y), o.yon | 0, o.yol.length ? 1 : 0, ic.OTURAKLAR.indexOf(o.oturak)],
      k: { x: r2(k.x), y: r2(k.y), b: k.bakis < 0 ? -1 : 1, d: k.durum, yu: k.yol.length ? 1 : 0, h: k.hiz || 2.2, u: k.ust ? [k.ust.px, k.ust.py, k.ust.sira] : null },
      kar: Object.fromEntries(kisiler.map((a) => [a.id, a.karakter])),
    };
  }
  async function yoklama() {
    const ic = I(), y = await api("yoklama", { uzakta: ic.uzak, an: ic.uzak ? null : anYap(), gor: sohbetGor });
    if (y._kod !== 200) return;
    if (!y.acik) { acik = false; kartYaz(); return; }
    bekleyenKartlari(y.bekleyen || []);
    misafirleriEsitle(y.misafirler || []);
    for (const o of y.olaylar || []) {
      if (o.tur === "geldi") { ic.asansorAc(); ic.ses("bildirim"); ic.gunluk(`${o.ad} ofise geldi.`); sistemSatiri(`${o.ad} ofise geldi.`); }
      else if (o.tur === "ayrildi") { ic.asansorAc(); ic.ses("bildirim"); ic.gunluk(`${o.ad} ofisten ayrıldı.`, true); sistemSatiri(`${o.ad} ofisten ayrıldı.`); }
    }
    if (!sohbetHazir) { sohbetHazir = true; sohbetGor = Math.max(sohbetGor, y.cs | 0); }   // sayfa yenilenince eski mesajlar balon olarak yeniden oynamasın
    else for (const m of y.c || []) mesajAl(m);
    kartYaz();
  }
  async function tik() {
    if (mesgul || !I()) return;
    mesgul = true;
    try {
      sayac++;
      if (acik && !ziyaret && (misafirler.size || bekleyenId || sayac % 4 === 0)) await yoklama();
      else if (acik && ziyaret && sayac % 4 === 0) await yoklama();   // uzakta: sunucu ziyaretleri bitirsin / istekleri reddetsin
    } finally { mesgul = false; }
  }

  // ---------- ev sahibi: onay kartı ----------
  function bekleyenKartlari(liste) {
    const k = el("ziyaretKarti"), b = liste[0];
    if (!b) { bekleyenId = null; k.hidden = true; return; }
    if (bekleyenId !== b.istek) {
      bekleyenId = b.istek; I().ses("bildirim"); I().gunluk(`${b.ad} ofisine gelmek istiyor.`);
      el("zkAd").textContent = b.ad;
    }
    kartKalan = b.kalan; el("zkKalan").textContent = `${kartKalan} sn`; k.hidden = false;
    clearInterval(kartZ); kartZ = setInterval(() => { kartKalan = Math.max(0, kartKalan - 1); el("zkKalan").textContent = `${kartKalan} sn`; }, 1000);
  }
  async function karar(evet) {
    const id = bekleyenId; if (!id) return;
    el("ziyaretKarti").hidden = true; bekleyenId = null; clearInterval(kartZ);
    await api("karar", { istek: id, evet });
    if (evet) I().ses("gorev");
    I().cv.focus(); yoklama();
  }

  // ---------- ekKarakterler: misafirler (ev sahibinde) / ev sahibi ve diğer misafirler (misafirde) ----------
  function ekYap(id, ad, oyuncuMu) {
    const c = { id: "ek:" + id, ad, x: 46, y: 12, yon: 3, yol: [], oturak: null, oyuncu: !!oyuncuMu, telefonSon: 0, gecis: null, koltuk: [-99, -99], oturK: 0, perde: 1, balon: null,
      balonSon: 0, vurgu: 0, disarda: true, kedi: false, hedef: null, ek: true, gorunumAnahtar: "" };
    I().ekKarakterler.push(c); return c;
  }
  function gorunumUygula(c, gorunum) {
    const anahtar = JSON.stringify(gorunum || null); if (c.gorunumAnahtar === anahtar || !window.OFIS_GARDIROP) return;
    c.gorunumAnahtar = anahtar;
    window.OFIS_GARDIROP.tuvalYap(gorunum).then((t) => { if (c.silindi || c.gorunumAnahtar !== anahtar) return; I().img.k[c.id] = t; c.disarda = false; }).catch(() => {});
  }
  function konumVer(c, p) {
    const ilk = !c.hedef;
    c.hedef = { x: p[0], y: p[1] }; c.yon = p[2]; if (ilk) { c.x = p[0]; c.y = p[1]; }
  }
  function ekKaldir(c) { c.silindi = true; canliBalon.delete(c); const l = I().ekKarakterler, i = l.indexOf(c); if (i >= 0) l.splice(i, 1); delete I().img.k[c.id]; }
  function misafirleriEsitle(liste) {
    const var_ = new Set();
    if (liste.length && !misafirler.size) sohbetSifirla();   // yeni ziyaret: kart temiz başlar
    for (const m of liste) {
      var_.add(m.v);
      let c = misafirler.get(m.v);
      if (!c) { c = ekYap(m.v, m.ad, false); misafirler.set(m.v, c); }
      gorunumUygula(c, m.gorunum); konumVer(c, m.p);
    }
    for (const [v, c] of [...misafirler]) if (!var_.has(v)) { ekKaldir(c); misafirler.delete(v); }
  }
  function ekYumusat(dt) {
    balonlariTazele();
    for (const c of I().ekKarakterler) {
      if (!c.hedef) continue;
      const dx = c.hedef.x - c.x, dy = c.hedef.y - c.y, m = Math.hypot(dx, dy);
      if (m < 0.03 || m > 6) { c.x = c.hedef.x; c.y = c.hedef.y; } else { const k = Math.min(1, dt * 10); c.x += dx * k; c.y += dy * k; }
      c.yol = !c.oturak && m > 0.1 ? [[c.hedef.x, c.hedef.y]] : [];
    }
  }

  // ---------- ziyaret sohbeti ----------
  const sohbetAktif = () => !!(ziyaret || misafirler.size);
  function sohbetSifirla() { gorulen.clear(); satirlar.length = 0; isaretler.length = 0; canliBalon.clear(); sohbetKartYaz(); }
  // Konuşan karakter: ev sahibinde "ev" kendi oyuncun, misafirler ekKarakter; misafirde "ev" sahip ekKarakteri, kendi kısa kimliğin oyuncun, diğerleri digerleri.
  function konusan(v) {
    const ic = I();
    if (ziyaret) return v === "ev" ? ziyaret.sahip : v === ben ? ic.oyuncu : ziyaret.digerleri.get(v) || null;
    return v === "ev" ? ic.oyuncu : misafirler.get(v) || null;
  }
  // Balon çekirdek zamanıyla (zaman, hızlı günde hızlanır) biter; gerçek ~5 sn sürsün diye her karede tazelenir.
  function balonVer(c, metin) {
    const ic = I(); c.balon = metin; c.balonSon = ic.zaman + BALON_MS / 1000; canliBalon.set(c, { metin, bit: performance.now() + BALON_MS });
  }
  function balonlariTazele() {
    if (!canliBalon.size) return;
    const ic = I(), t = performance.now();
    for (const [c, b] of canliBalon) {
      if (t > b.bit || c.balon !== b.metin) { canliBalon.delete(c); if (c.balon === b.metin) c.balonSon = Math.min(c.balonSon, ic.zaman + 0.2); }
      else c.balonSon = Math.max(c.balonSon, ic.zaman + 0.5);
    }
  }
  function sistemSatiri(metin) { satirEkle({ sis: true, saat: new Date().toTimeString().slice(0, 5), t: metin }); }
  function satirEkle(s) { satirlar.push(s); if (satirlar.length > SATIR_EN_FAZLA) satirlar.splice(0, satirlar.length - SATIR_EN_FAZLA); sohbetKartYaz(); }
  function mesajAl(m) {
    if (!m || typeof m.s !== "number" || gorulen.has(m.s)) return;   // aynı sıra numarası ikinci kez gösterilmez
    gorulen.add(m.s); if (gorulen.size > 400) gorulen.delete(gorulen.values().next().value);
    if (!ziyaret) sohbetGor = Math.max(sohbetGor, m.s);
    const ic = I(), benim = ziyaret ? m.v === ben : m.v === "ev", c = konusan(m.v), buraya = m.tur === "b" && Array.isArray(m.p);
    const metin = buraya ? "📍 Buraya gel!" : String(m.t || "");
    satirEkle({ saat: m.saat || new Date().toTimeString().slice(0, 5), ad: m.ad, t: buraya ? "📍 Buraya gel" : metin, benim });
    if ((m.yas | 0) > 8) return;   // eski mesaj (sayfa yenilendi, geç ulaştı): yalnız listede
    if (c) {
      if (!ziyaret && m.v === "ev") { ic.konus(c, metin, true); balonVer(c, metin); }   // ev sahibinin kendi mesajı: çekirdek balonu + oda günlüğü (konusmaSatiri)
      else { balonVer(c, metin); if (!ziyaret) ic.MOD("konusmaSatiri", { ajan: c, metin, sesli: false }); }   // misafir mesajı ev sahibinin oda günlüğüne; ses aşağıda tek kez
    }
    if (buraya) isaretler.push({ x: m.p[0], y: m.p[1], bit: performance.now() + ISARET_MS, ad: m.ad });
    if (!benim) {
      ic.ses("konus", 1.15);
      const S = window.OFIS_SES_AJAN;
      if (c && S && typeof S.konus === "function" && !buraya) { try { S.konus("misafir:" + m.v, metin, { x: c.x, y: c.y, oncelik: 1 }); } catch (e) { /* ses isteğe bağlı */ } }
    }
  }
  async function mesajYolla(govde) {
    const ic = I(); if (!sohbetAktif()) return false;
    const o = ic.oyuncu, d = await api("mesaj", { ...govde, x: r2(o.x), y: r2(o.y) });
    if (d._kod === 200 && d.m) { mesajAl(d.m); sohbetDurum(""); return true; }
    sohbetDurum(d._kod === 429 ? "Çok hızlı: birkaç saniye bekle." : d._kod === 409 ? "Ofiste misafir yok." : d._kod === 404 ? "Ziyaret bitti." : "Mesaj gönderilemedi.");
    return false;
  }
  const tepki = (k) => (k === 4 ? mesajYolla({ tur: "b" }) : k >= 1 && k <= 3 ? mesajYolla({ tur: "r", k }) : false);
  function sohbetDurum(m) { yaz(el("zsDurum"), m); clearTimeout(sohbetDurumZ); if (m) sohbetDurumZ = setTimeout(() => yaz(el("zsDurum"), ""), 3500); }
  function sohbetAc() {
    const ic = I(), kutu = el("zSohbetKutu"); if (!kutu || !sohbetAktif()) return;
    kutu.hidden = false; ic.tuslar.clear(); const g = el("zsGiris"); g.value = ""; g.focus();
  }
  function sohbetKapat() { const kutu = el("zSohbetKutu"); if (kutu && !kutu.hidden) { kutu.hidden = true; I().cv.focus(); } }
  async function sohbetGonder() {
    const g = el("zsGiris"), t = g.value.trim().slice(0, 200);
    if (!t) return sohbetKapat();
    g.value = ""; sohbetKapat();
    await mesajYolla({ tur: "m", t });
  }
  function sohbetKartYaz() {
    const kart = el("zSohbetKart"); if (!kart) return;
    kart.hidden = !sohbetAktif();
    if (kart.hidden) { sohbetKapat(); return; }
    const l = el("zsListe"), alta = l.scrollTop + l.clientHeight >= l.scrollHeight - 8;
    l.replaceChildren();
    if (!satirlar.length) { const d = document.createElement("div"); d.className = "sis"; d.textContent = "Enter ya da T ile yaz · 1 👋 2 😄 3 👍 4 📍 Buraya gel"; l.append(d); }
    for (const s of satirlar) {
      const d = document.createElement("div"), z = document.createElement("time"); z.textContent = s.saat || ""; d.append(z);
      if (s.sis) { d.className = "sis"; d.append(document.createTextNode(s.t)); }
      else { const b = document.createElement("b"); b.textContent = s.ad; if (s.benim) b.className = "ben"; d.append(b, document.createTextNode(" " + s.t)); }
      l.append(d);
    }
    if (alta) l.scrollTop = l.scrollHeight;
  }
  function isaretCiz() {
    if (!isaretler.length) return;
    const ic = I(), g = ic.g, t = performance.now(), u = ic.kam.o, T = ic.T;
    for (let i = isaretler.length - 1; i >= 0; i--) if (t > isaretler[i].bit) isaretler.splice(i, 1);
    for (const k of isaretler) {
      const kalan = (k.bit - t) / ISARET_MS, x = ic.ex(k.x * T + 8), y = ic.ey(k.y * T + T - 2), r = (7 + 2 * Math.sin(t / 160)) * u, z = Math.abs(Math.sin(t / 200)) * 4 * u;
      g.save(); g.globalAlpha = Math.min(1, kalan * 4);
      g.strokeStyle = "#f2cf4a"; g.lineWidth = 2 * u; g.beginPath(); g.ellipse(x, y, r * 1.5, r * 0.7, 0, 0, 7); g.stroke();
      g.fillStyle = "#f2cf4a"; g.strokeStyle = "#2b2838"; g.lineWidth = 1.5 * u;
      g.beginPath(); g.moveTo(x - 5 * u, y - 24 * u - z); g.lineTo(x + 5 * u, y - 24 * u - z); g.lineTo(x, y - 14 * u - z); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }
  function sohbetKur() {
    const g = el("zsGiris"); if (!g) return;
    g.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); sohbetGonder(); }
      else if (e.key === "Escape") { e.preventDefault(); sohbetKapat(); }
    });
    el("zsGonder").onclick = () => sohbetGonder();
    el("zsYaz").onclick = () => sohbetAc();
    for (const b of document.querySelectorAll("#zSohbetKutu [data-zk]")) b.onclick = () => { tepki(+b.dataset.zk); sohbetKapat(); };
  }

  // ---------- misafir: ziyaret ----------
  // Ev sahibinden gelen düzen güvenilmez veridir: yalnız bu ofisin tanıdığı eşya kimlikleri (atlas parçası, katalog "kat:<kategori>/<no>", temel haritadaki kaynak
  // dizeleri) kabul edilir; çekirdekteki kaynak() "C.ad(args)" gibi dizeleri çalıştırdığı için bilinmeyen kimlik düzene girmez.
  let izinli = null;
  function duzenGuvenli(duzen) {
    const ic = I(); if (!izinli) izinli = new Set(ic.HR.mobilya.map((m) => m.k));
    const sahip = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // "constructor", "__proto__" gibi prototip adları tanınmaz
    const eklenen = (duzen.eklenen || []).filter((e) => typeof e.k === "string" && (sahip(window.ATLAS, e.k) || izinli.has(e.k) || (/^kat:[\w-]+\/\d+$/.test(e.k) && sahip(ic.KAT.ogeler, e.k.slice(4).split("/")[0]))));
    return { eklenen, silinen: duzen.silinen || [] };
  }
  async function katYukle(duzen) {
    const ic = I(), idler = new Set((duzen.eklenen || []).filter((e) => e.k.startsWith("kat:")).map((e) => e.k.slice(4).split("/")[0]));
    for (const id of idler) if (Object.prototype.hasOwnProperty.call(ic.KAT.ogeler, id)) await ic.katYukle(id).catch(() => {});
  }
  function bekleBaslat(id, ad, kalan) {
    beklerken = { id, ad, kalan }; panelYaz(); kartYaz();
    const dene = async () => {
      if (!beklerken || beklerken.id !== id) return;
      const d = await api("giden", {});
      if (!beklerken || beklerken.id !== id) return;
      if (d.durum === "bekliyor") { beklerken.kalan = d.kalan; panelYaz(); setTimeout(dene, 1000); return; }
      if (d.durum === "kabul") return girisYap(d);
      beklerken = null; mesajGoster(d.mesaj || DURUM_MESAJ[d.durum] || "Ziyaret olmadı."); panelYaz(); kartYaz();
    };
    setTimeout(dene, 600);
  }
  async function ziyaretIste(id) {
    if (!ANAHTAR || beklerken || ziyaret) return;
    const ic = I(), g = window.OFIS_GARDIROP ? window.OFIS_GARDIROP.gorunum() : null;
    mesajGoster("İstek gönderiliyor…");
    const d = await api("git", { id, gorunum: g });
    if (d.durum !== "bekliyor") { mesajGoster(d.mesaj || d.hata || "Ziyaret başlatılamadı."); return; }
    ic.ses("bildirim"); mesajGoster(""); bekleBaslat(id, (durum && durum.eslesmeler.find((e) => e.id === id) || {}).ad || "Ofis", d.kalan || 60);
  }
  async function iptalEt() {
    if (!beklerken) return;
    beklerken = null; await api("iptal", {}); mesajGoster("İstek geri çekildi."); panelYaz(); kartYaz();
  }
  async function girisYap(d) {
    const ic = I(), s = d.sahne;
    try {
      if (window.SOHBET && SOHBET.acik()) SOHBET.kapat();
      s.duzen = duzenGuvenli(s.duzen);
      await katYukle(s.duzen);
      const sahipTuval = window.OFIS_GARDIROP ? await window.OFIS_GARDIROP.tuvalYap(s.gorunum) : null;
      const ilk = await api("hareket", { x: ic.GIRIS[0], y: ic.GIRIS[1] - 1, yon: 3, yu: 0 });
      if (ilk.durum !== "surer") { beklerken = null; mesajGoster(ilk.mesaj || "Ziyaret başlamadı."); panelYaz(); kartYaz(); return; }
      const id = beklerken && beklerken.id; beklerken = null;
      if (!ic.uzakGir({ dakika: ilk.an && ilk.an.d, odaAdi: s.oda_adi, ajanlar: s.ajanlar, duzen: s.duzen })) { await api("don", {}); return; }
      const sahip = ekYap("sahip", s.oyuncu_adi, true);
      if (sahipTuval) { ic.img.k[sahip.id] = sahipTuval; sahip.disarda = false; sahip.gorunumAnahtar = "sahne"; }
      ziyaret = { id, ad: d.ad, sahne: s, sahip, digerleri: new Map(), digerHazir: false };
      sohbetSifirla(); ben = typeof ilk.ben === "string" ? ilk.ben : "";
      panelKapat(); uygulaAn(ilk.an); ziyaret.digerHazir = true;
      yaz(el("uzakEtiket"), `Ziyarettesin: ${s.ofis_adi}`); el("uzakEtiket").hidden = false;
      ic.gunluk(`${s.ofis_adi} ofisine ziyarete gittin.`); ic.ses("kapiAc"); kartYaz();
      clearInterval(hareketZ); hareketZ = setInterval(hareketTik, 250);
    } catch (e) {
      beklerken = null; await api("don", {}); mesajGoster("Ziyaret başlatılamadı.");
      if (ic.uzak) { for (const c of [...ic.ekKarakterler]) ekKaldir(c); ziyaret = null; clearInterval(hareketZ); ic.uzakCik(); el("uzakEtiket").hidden = true; }   // uzakGir sonrası bir şey patlarsa kendi ofisine dön
      panelYaz(); kartYaz();
    }
  }
  function uygulaAn(an) {
    if (!an || !ziyaret) return;
    const ic = I(); ic.uzakAn(an);
    if (an.o) { konumVer(ziyaret.sahip, an.o); ziyaret.sahip.yon = an.o[2]; ziyaret.sahip.oturak = an.o[4] >= 0 ? ic.OTURAKLAR[an.o[4]] || null : null; }
    const var_ = new Set();
    for (const m of an.m || []) {
      var_.add(m.v);
      let c = ziyaret.digerleri.get(m.v);
      if (!c) {
        c = ekYap(m.v, m.ad, false); ziyaret.digerleri.set(m.v, c);
        if (ziyaret.digerHazir) { ic.ses("bildirim"); ic.gunluk(`${m.ad} ofise geldi.`); sistemSatiri(`${m.ad} ofise geldi.`); }
      }
      gorunumUygula(c, m.gorunum); konumVer(c, m.p);
    }
    for (const [v, c] of [...ziyaret.digerleri]) if (!var_.has(v)) {
      ic.ses("bildirim"); ic.gunluk(`${c.ad} ofisten ayrıldı.`, true); sistemSatiri(`${c.ad} ofisten ayrıldı.`);
      ekKaldir(c); ziyaret.digerleri.delete(v);
    }
  }
  async function hareketTik() {
    if (hareketMesgul || !ziyaret) return;
    hareketMesgul = true;
    try {
      const ic = I(), o = ic.oyuncu;
      const d = await api("hareket", { x: r2(o.x), y: r2(o.y), yon: o.yon | 0, yu: o.yol.length || o.gecis ? 1 : 0 });
      if (!ziyaret) return;
      if (d.durum === "surer") {
        ziyaret.hata = 0; if (typeof d.ben === "string" && d.ben) ben = d.ben;
        uygulaAn(d.an); for (const m of d.c || []) mesajAl(m);
      }
      else if (d.durum === "bitti") bitir(d.mesaj || "Ziyaret bitti: kendi ofisine döndün.");
      else if (d._kod === -1 || d._kod >= 500) { ziyaret.hata = (ziyaret.hata || 0) + 1; if (ziyaret.hata >= 8) bitir("Ofis sunucusuna ulaşılamadı: kendi ofisine döndün."); }
      else if (d._kod >= 400) bitir("Ziyaret bitti: kendi ofisine döndün.");
    } finally { hareketMesgul = false; }
  }
  // Ziyaretten çık: sunucu zaten bitirdiyse (uğurlandı, bağlantı koptu) ya da kullanıcı döndüyse. mesaj: kendi ofisinde gösterilir.
  function bitir(mesaj) {
    if (!ziyaret) return;
    const ic = I(); clearInterval(hareketZ);
    for (const c of [...ic.ekKarakterler]) ekKaldir(c);
    sohbetKapat(); canliBalon.clear(); isaretler.length = 0; ben = "";
    ziyaret = null; ic.uzakCik();
    el("uzakEtiket").hidden = true; el("ziyaretPanel").hidden = true; panelAcik = false; kartYaz();
    if (mesaj) { ic.gunluk(mesaj); mesajGoster(mesaj); ic.konus(ic.oyuncu, mesaj.length > 70 ? mesaj.slice(0, 68) + "…" : mesaj, true); sonMesaj = mesaj; }
    ic.cv.focus();
  }
  // hizli: Esc / kart düğmesi (anında); asansörde E: asansöre girip çıkar
  async function don(hizli) {
    if (!ziyaret || ziyaret.donuyor) return;
    const ic = I();
    panelKapat();
    const cik = async () => { await api("don", {}); bitir("Kendi ofisine döndün."); };
    if (hizli || ic.oyuncu.gecis) return cik();
    ziyaret.donuyor = true;   // konum yollanmaya devam eder; asansöre varınca kapı açılır, içeri girer, kendi ofisinde belirir
    ic.gonder(ic.oyuncu, ic.GIRIS, () => {
      ic.oyuncu.yon = 1; ic.asansorAc();
      ic.gecis(ic.oyuncu, ic.GIRIS[0], ic.GIRIS[1] - 1, 0.45, cik);
    });
  }

  // ---------- asansör paneli ("Kat seç") ----------
  function mesajGoster(m) { sonMesaj = m || ""; yaz(el("zpMesaj"), m); }
  async function panelAc() {
    const ic = I();
    if (panelAcik || ic.diyalogAcik() || !el("duzenPanel").hidden || !el("gardiropPanel").hidden) return;
    panelAcik = true; el("ziyaretPanel").hidden = false; ic.tuslar.clear();
    ic.ses("kapiAc"); panelYaz();
    if (!ziyaret && ANAHTAR) { durum = await api("tara", {}); panelYaz(); }
  }
  function panelKapat() { panelAcik = false; el("ziyaretPanel").hidden = true; I().cv.focus(); }
  function panelYaz() {
    if (!panelAcik) return;
    const kutu = el("zpListe"); kutu.replaceChildren();
    const satir = (metin, alt, fn, secili, kapali) => {
      const b = document.createElement("button"); b.disabled = !!kapali; if (secili) b.classList.add("secili");
      const a = document.createElement("span"); a.className = "ad"; a.textContent = metin; const k = document.createElement("small"); k.textContent = alt || "";
      b.append(a, k); b.onclick = fn; kutu.append(b); return b;
    };
    el("zpBaslik").textContent = ziyaret ? `Kat: ${ziyaret.sahne.ofis_adi}` : "Kat seç";
    if (ziyaret) {
      satir("Kendi ofisime dön", "Asansörle kendi katına", () => don(false), true);
      yaz(el("zpMesaj"), "Ziyaretçisin: burada yalnız gezebilirsin.");
    } else if (beklerken) {
      satir(`${beklerken.ad} ofisi`, `Onay bekleniyor… ${beklerken.kalan} sn`, () => {}, true, true);
      satir("Vazgeç", "İsteği geri çek", iptalEt);
    } else {
      satir("Kendi ofisim", "Buradasın", () => panelKapat(), true, true);
      const liste = (durum && durum.eslesmeler) || [];
      yaz(el("zpMesaj"), !ANAHTAR ? "Ziyaret yalnız Ofis kısayoluyla (ofis.pyw) açılınca çalışır." : !liste.length ? "Henüz eşleşme yok: ⚙️ Ayarlar > Ziyaret'ten bir ofisle eşleş." : "");
      for (const e of liste) satir(e.ad, e.cevrimici === false ? "çevrimdışı" : e.cevrimici ? `çevrimiçi · ${e.adres}` : `denetleniyor… · ${e.adres}`, () => ziyaretIste(e.id), false, e.cevrimici === false);
      if (sonMesaj) yaz(el("zpMesaj"), sonMesaj);
    }
  }
  el("zpKapat").onclick = () => panelKapat();

  // ---------- yan kart ----------
  function kartYaz() {
    const k = el("ziyaretKart"), ic = I(); if (!ic) return;
    sohbetKartYaz();
    k.hidden = !(acik || ziyaret || beklerken);
    if (k.hidden) kartAnahtar = "";
    if (k.hidden) return;
    const anahtar = JSON.stringify([!!ziyaret, ziyaret && ziyaret.sahne.ofis_adi, beklerken && beklerken.ad, [...misafirler].map(([v, c]) => v + c.ad)]);
    if (anahtar === kartAnahtar) return;   // sık yoklamada düğmeler yeniden yaratılmasın (tıklama kaçmasın)
    kartAnahtar = anahtar;
    const g = el("zkIc"); g.replaceChildren();
    const p = (m, sinif) => { const d = document.createElement("div"); if (sinif) d.className = sinif; d.textContent = m; g.append(d); return d; };
    const dugme = (m, fn) => { const b = document.createElement("button"); b.textContent = m; b.onclick = fn; g.append(b); };
    if (ziyaret) {
      p(`${ziyaret.sahne.ofis_adi}`, "b"); p(`Ev sahibi: ${ziyaret.sahne.oyuncu_adi}`); p("Ziyaretçisin: yalnız gezebilirsin.", "soluk");
      dugme("Kendi ofisime dön", () => don(true));
    } else if (beklerken) { p(`${beklerken.ad} ofisinin onayı bekleniyor…`); dugme("Vazgeç", iptalEt); }
    else {
      p(misafirler.size ? `${misafirler.size} misafir ofiste` : "Ofis ziyarete açık", "b");
      for (const [v, c] of misafirler) { const d = p(c.ad); const b = document.createElement("button"); b.textContent = "Uğurla"; b.onclick = async () => { await api("ugurla", { v }); yoklama(); }; d.append(" ", b); }
      if (!misafirler.size) p("Asansörden bir ofise gidebilir ya da misafir ağırlayabilirsin.", "soluk");
    }
  }

  // ---------- ayarlar bölümü ----------
  function ayarKur() {
    const k = el("zAyar"); if (!k) return;
    k.addEventListener("click", (e) => e.stopPropagation());   // liste yeniden çizilince ayar paneli dışarı tıklanmış sanıp kapanmasın
    k.innerHTML = `<h2>Ziyaret (Wi-Fi)</h2>
      <label class="s"><span>Ofisimi ziyarete aç</span><input type="checkbox" id="z_acik"></label>
      <div class="not" id="z_bilgi"></div>
      <div class="zsatir"><button id="z_kod">Eşleşme kodu üret</button><b id="z_kodGoster" class="zkod"></b></div>
      <div class="not">Yakındaki ofisler</div><div id="z_yakin" class="zliste"></div>
      <div class="zsatir"><input id="z_ip" placeholder="IP (192.168.x.x / 100.x.x.x)" size="14" autocomplete="off"><input id="z_port" placeholder="8545" size="5" autocomplete="off"><input id="z_kodGir" placeholder="6 haneli kod" size="9" maxlength="6" inputmode="numeric" autocomplete="off"><button id="z_esles">Eşleş</button></div>
      <div class="not">Eşleşmeler</div><div id="z_liste" class="zliste"></div>
      <div class="zsatir"><button id="z_doktor">Bağlantıyı denetle</button></div><div id="z_doktorSonuc" class="zliste" aria-live="polite"></div>
      <div class="not" id="z_mesaj" aria-live="polite"></div>`;
    el("z_acik").onchange = async () => { zMesaj(""); durum = await api("ayar", { acik: el("z_acik").checked }); durumUygula(); };
    el("z_kod").onclick = async () => { const d = await api("kod", {}); if (d._kod === 200) { durum = d; durumUygula(); } else zMesaj(d.hata || "Kod üretilemedi."); };
    el("z_esles").onclick = async () => {
      const ip = el("z_ip").value.trim(), port = parseInt(el("z_port").value, 10) || 8545, kod = el("z_kodGir").value.trim();
      zMesaj("Eşleşiliyor…");
      const d = await api("esles", { adres: ip, port, kod });
      if (d._kod === 200) { durum = d; el("z_kodGir").value = ""; zMesaj("Eşleşildi."); durumUygula(); } else zMesaj(d.hata || "Eşleşilemedi.");
    };
    el("z_doktor").onclick = async () => {
      const kutu = el("z_doktorSonuc"), dugme = el("z_doktor"); dugme.disabled = true; kutu.textContent = "Denetleniyor…";
      try {
        const d = await api("doktor", {}); kutu.replaceChildren();
        if (d._kod !== 200) { kutu.textContent = d.hata || "Denetlenemedi."; return; }
        const b = document.createElement("div"); b.className = "not"; b.textContent = `${d.ozet} (${d.zaman})`; kutu.append(b);
        for (const m of d.maddeler) {
          const s = document.createElement("div"), simge = m.durum === "ok" ? "✅" : m.durum === "uyari" ? "⚠️" : "❌";
          s.textContent = `${simge} ${m.ad}: ${m.ayrinti}`;
          if (m.cozum) { const c = document.createElement("div"); c.className = "soluk"; c.textContent = "→ " + m.cozum; s.append(c); }
          kutu.append(s);
        }
      } catch (e) { kutu.textContent = "Denetlenemedi."; } finally { dugme.disabled = false; }
    };
    const gozle = new MutationObserver(() => { const acikMi = !el("ayarPanel").hidden; if (acikMi && !ayarZ) { ayarYenile(); ayarZ = setInterval(ayarYenile, 2000); } else if (!acikMi && ayarZ) { clearInterval(ayarZ); ayarZ = 0; } });
    gozle.observe(el("ayarPanel"), { attributes: true, attributeFilter: ["hidden"] });
  }
  const zMesaj = (m) => yaz(el("z_mesaj"), m);
  async function ayarYenile() { const d = await api("durum"); if (d._kod === 200) { durum = d; durumUygula(); } }
  function durumUygula() {
    if (!durum) return;
    acik = !!durum.dinliyor; kartYaz(); panelYaz();
    if (!el("z_acik")) return;
    el("z_acik").checked = !!durum.acik;
    yaz(el("z_bilgi"), durum.hata || (durum.dinliyor ? `Dinliyor: ${(durum.adresler[0] || "bu bilgisayar")}:${durum.port}. Windows güvenlik duvarı sorarsa "özel ağlar"a izin ver. Yalnız eşleştiğin ofisler gelebilir; her ziyarette onay istenir.`
      : "Kapalı: ofisin yalnız bu bilgisayardan erişilebilir."));
    const kod = el("z_kodGoster");
    kod.textContent = durum.kod ? `${durum.kod.kod} (${Math.floor(durum.kod.kalan / 60)}:${String(durum.kod.kalan % 60).padStart(2, "0")})` : durum.kilit ? `kilitli (${durum.kilit} sn)` : "";
    el("z_kod").disabled = !durum.dinliyor;
    const yakin = el("z_yakin"); yakin.replaceChildren();
    for (const y of durum.yakin) {
      const b = document.createElement("button"); b.textContent = `${y.ad} · ${y.adres}${y.eslesti ? " · eşleşti" : ""}${y.protokol !== durum.protokol ? " · sürüm farklı" : ""}`;
      b.onclick = () => { el("z_ip").value = y.adres; el("z_port").value = y.port; el("z_kodGir").focus(); }; yakin.append(b);
    }
    if (!durum.yakin.length) yakin.textContent = durum.dinliyor ? "Yok (ikisi de ziyarete açık olmalı); elle IP girebilirsin." : "Ziyareti açınca burada görünürler.";
    const liste = el("z_liste"); liste.replaceChildren();
    for (const e of durum.eslesmeler) {
      const d = document.createElement("div"); d.textContent = `${e.ad} · ${e.adres}:${e.port} `;
      const b = document.createElement("button"); b.textContent = "Kaldır"; b.onclick = async () => { durum = await api("kaldir", { id: e.id }); durumUygula(); }; d.append(b); liste.append(d);
    }
    if (!durum.eslesmeler.length) liste.textContent = "Henüz yok.";
  }

  // ---------- modül ----------
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    async basla() {
      const ic = I();
      ayarKur();
      el("zkEvet").onclick = () => karar(true); el("zkHayir").onclick = () => karar(false);
      sohbetKur();
      ic.NESNELER.push({ x: ic.GIRIS[0], y: ic.GIRIS[1], r: 1.9, etiket: () => "Asansör: kat seç", fn: panelAc });
      if (ANAHTAR) {
        const d = await api("durum");
        if (d._kod === 200) {
          durum = d; durumUygula();
          // sayfa yenilenirse süren ziyaret/istek bu sayfada kalmaz: ev sahibine haber ver
          if (d.giden && d.giden.durum === "surer") await api("don", {}); else if (d.giden && d.giden.durum === "bekliyor") await api("iptal", {});
        }
      }
      setInterval(tik, 250);
    },
    guncelle: ekYumusat,
    uzakGuncelle: ekYumusat,
    uzakHedef() {   // ziyaretteyken E: asansör (kendi ofisine dön) ya da ajana selam
      const ic = I(), o = ic.oyuncu, T = ic.T; let en = null;
      const dene = (d, etiket, x, y, fn) => { if (!en || d < en.d) en = { tur: "nesne", hedef: { fn }, d, etiket, x, y }; };
      const da = Math.hypot(ic.GIRIS[0] - o.x, ic.GIRIS[1] - o.y); if (da <= 1.9) dene(da - 0.3, "Asansör: kendi ofisine dön", o.x * T + 8, o.y * T - T - 10, panelAc);
      for (const a of ic.ajanlar) {
        if (a.oyuncu || a.disarda) continue;
        const d = Math.hypot(a.x - o.x, a.y - o.y);
        if (d <= 2.3) dene(d, "Selam ver", a.x * T + 8, a.y * T - T, () => { ic.yonBak(o, a); ic.konus(a, `${SELAM[Math.floor(Math.random() * SELAM.length)]}`, true); ic.ses("konus", a.perde); });
      }
      return en;
    },
    tus(e) {
      const ic = I();
      if (panelAcik) {
        if (e.key === "Escape") { panelKapat(); return true; }
        if (e.code === "KeyE" || /^(Arrow|Key[WASD])/.test(e.code)) { e.preventDefault(); return true; }
        return e.key !== "Enter" && e.key !== " " && e.key !== "Tab" ? true : undefined;
      }
      const kutu = el("zSohbetKutu");
      if (kutu && !kutu.hidden) {   // odak kutudan çıktıysa (haritaya tıklandı) Esc yine kapatır
        if (e.key === "Escape") { sohbetKapat(); return true; }
        return;
      }
      // Ziyaret sohbeti: Enter ya da T satırı açar (Enter odaktaki düğmeye bırakılır), 1-4 hızlı tepki. Ziyaret yokken eski davranış (Enter = E) sürer.
      if (sohbetAktif() && !e.ctrlKey && !e.altKey && !e.metaKey && !ic.diyalogAcik() && el("duzenPanel").hidden && el("gardiropPanel").hidden && el("sohbet").hidden) {
        if ((e.key === "Enter" && e.target.tagName !== "BUTTON") || e.code === "KeyT") { e.preventDefault(); if (!e.repeat) sohbetAc(); return true; }
        const r = /^Digit([1-4])$/.exec(e.code);
        if (r) { e.preventDefault(); if (!e.repeat) tepki(+r[1]); return true; }
      }
      if (ic.uzak && e.key === "Escape" && !ic.diyalogAcik()) { panelAc(); return true; }
    },
    duzenCiz: isaretCiz,
    tikla() { sohbetKapat(); if (panelAcik) { panelKapat(); return true; } },
    test: {
      ziyaretDurum: () => ({ acik, panel: panelAcik, uzak: I().uzak, bekleyenKart: el("ziyaretKarti").hidden ? null : el("zkAd").textContent, yanKart: el("ziyaretKart").hidden ? null : el("zkIc").textContent,
        misafirler: [...misafirler.values()].map((c) => [c.ad, c.hedef && c.hedef.x, c.hedef && c.hedef.y, !c.disarda]), beklerken, etiket: el("uzakEtiket").hidden ? null : el("uzakEtiket").textContent,
        sahip: ziyaret && [ziyaret.sahip.ad, ziyaret.sahip.x, ziyaret.sahip.y, ziyaret.sahip.disarda, ziyaret.sahip.hedef && ziyaret.sahip.hedef.x, ziyaret.sahip.hedef && ziyaret.sahip.hedef.y],
        digerleri: ziyaret ? [...ziyaret.digerleri.values()].map((c) => [c.ad, c.x, c.y]) : [], mesaj: sonMesaj, panelListe: [...el("zpListe").children].map((b) => b.textContent) }),
      ziyaretTik: async () => { sayac = 3; await tik(); await hareketTik(); return true; },
      ziyaretPanel: (a = true) => (a ? panelAc() : panelKapat()),
      ziyaretKatSec: (ad) => { const b = [...el("zpListe").children].find((x) => x.textContent.includes(ad)); if (b) b.click(); return !!b; },
      ziyaretKarar: (evet) => karar(evet),
      ziyaretDon: (hizli) => don(!!hizli),
      ziyaretUgurla: async () => { for (const v of misafirler.keys()) await api("ugurla", { v }); await yoklama(); },
      ziyaretAyar: async (a) => { durum = await api("ayar", { acik: a }); durumUygula(); return durum; },
      ziyaretKod: async () => { durum = await api("kod", {}); durumUygula(); return durum.kod; },
      ziyaretEsles: async (adres, port, kod) => { const d = await api("esles", { adres, port, kod }); if (d._kod === 200) { durum = d; durumUygula(); } return d; },
      ziyaretDuzenGuvenli: (d) => duzenGuvenli(d),
      ziyaretSohbet: () => ({ aktif: sohbetAktif(), kutu: !el("zSohbetKutu").hidden, kart: !el("zSohbetKart").hidden, satirlar: satirlar.map((s) => (s.sis ? `— ${s.t}` : `${s.ad}: ${s.t}`)), ben, gor: sohbetGor,
        balonlar: [...I().ekKarakterler, ...I().ajanlar.filter((a) => a.oyuncu)].filter((c) => c.balon && I().zaman <= c.balonSon).map((c) => [c.ad, c.balon]), isaretler: isaretler.length, durum: el("zsDurum").textContent }),
      ziyaretYaz: async (t) => { sohbetAc(); el("zsGiris").value = t; await sohbetGonder(); return true; },
      ziyaretTepki: (k) => tepki(k),
      ziyaretSunucu: async () => { durum = await api("durum"); durumUygula(); return durum; },
    },
  });
})();
