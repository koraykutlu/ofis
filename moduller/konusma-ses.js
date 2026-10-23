// Ajan sesleri (istemci): ekranda görünen konuşmalar yerel TTS ile (ses_motoru.py, EMA Lightning) sırayla seslendirilir.
// Çekirdek her balonda MOD("konusmaSatiri", {ajan, metin}) yayınlar; bu modül dinler (undefined döner, tüketmez) ve satırı alırsa ajan.sesli = true yapar:
// çekirdek o satır için sentez "konus" mırıltısını çalmaz. Sunucu yok / motor yok / ses kapalıysa hiçbir istek atılmaz, her şey eskisi gibi mırıltıyla sürer.
// - Yalnız kamera görüşündeki konuşmalar; tek ses, bekleyen en çok 3, 8 sn'den bayat satır atlanır. Ses önceden üretilir (sunucu tek tek, önbellekli).
// - Ses yüksekliği dinleyiciye (OFIS_IC.dinleyici(): izlenen ajan ya da oyuncu) uzaklıkla azalır; başka odadaysa kısık ve boğuk; sağ/sol pan. Konuşan hareket
//   ederse ses canlı güncellenir. Web Audio: ses.js'in ana bus'una bağlanır (SES.baglanti()), ayrı AudioContext açılmaz.
// - Tek ses motoru olduğundan her ajana perde (playbackRate) + konuşma temposu (sunucu hızı) + iki bantlı ton eşitleyici profili verilir (PROFIL).
// - Dışa açılan: window.OFIS_SES_AJAN = { konus(ajanId, metin, {x, y, oda, oncelik, kanal}), acik(), durum(), cevap(ajanId, metin) }.
//   `kanal` (ör. "diyalog": E ile açılan kutu) verilirse aynı kanaldaki önceki satır kesilir; seçim değişince eski cevap konuşmaya devam etmez.
//   `misafir:<id>` gibi bilinmeyen kimlikler varsayılan misafir profili alır (kimlikten türetilmiş küçük sapmayla).
// Ayarlar paneline "Ajan sesleri" bölümü eklenir (aç/kapat, seviye, gerçek sohbet cevaplarını sesli oku); ayar localStorage'da.
(() => {
  const I = () => window.OFIS_IC;
  const el = (id) => document.getElementById(id);
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  const DEPO = "ofis-konusma-ses-1";
  const BAYAT = 8000, KUYRUK_ENFAZLA = 3, ESIK = 0.05, ILK_YAS = 3000;

  // id -> { perde: playbackRate (perde+hız birlikte), tempo: net konuşma hızı, ton: alçak raf dB, parlak: tiz raf dB }.
  // Sunucuya istenen hız = tempo / perde (playbackRate sonradan perdeyle birlikte hızı da değiştirir; böylece net hız ~tempo kalır).
  const PROFIL = {
    ada:      { perde: 1.00, tempo: 1.00, ton: 0,  parlak: 0 },    // asistan: doğal
    oyuncu:   { perde: 0.93, tempo: 0.98, ton: 2,  parlak: 0 },
    muhabir1: { perde: 1.05, tempo: 1.04, ton: 0,  parlak: 1 },
    muhabir2: { perde: 1.14, tempo: 1.08, ton: -2, parlak: 2 },
    postaci:  { perde: 1.10, tempo: 1.14, ton: -3, parlak: 1 },
    tarayici: { perde: 0.90, tempo: 1.10, ton: 3,  parlak: -3 },
    analist:  { perde: 0.94, tempo: 0.92, ton: 2,  parlak: -2 },
    editor:   { perde: 0.98, tempo: 0.96, ton: 4,  parlak: -1 },
    denetci:  { perde: 0.87, tempo: 0.90, ton: 4,  parlak: -2 },
    sosyal:   { perde: 1.12, tempo: 1.16, ton: -3, parlak: 3 },
    spiker:   { perde: 0.96, tempo: 0.94, ton: 1,  parlak: 3 },
    dagitici: { perde: 1.03, tempo: 1.00, ton: -1, parlak: 0 },
  };
  function profil(id) {
    if (Object.prototype.hasOwnProperty.call(PROFIL, id)) return PROFIL[id];
    let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;   // misafir: kimlikten küçük sapma (iki misafir birbirinden ayrılsın)
    return { perde: 1.02 + (h % 7) * 0.025, tempo: 1.0 + (h % 5) * 0.03, ton: (h % 3) - 1, parlak: (h % 4) - 1 };
  }

  const ayar = { acik: true, seviye: 80, cevap: false };
  try { const h = JSON.parse(localStorage.getItem(DEPO) || "null"); if (h && typeof h === "object") for (const k of Object.keys(ayar)) if (typeof h[k] === typeof ayar[k]) ayar[k] = h[k]; } catch (e) { /* özel pencere: varsayılan */ }
  ayar.seviye = Math.max(0, Math.min(100, +ayar.seviye || 0));
  const kaydet = () => { try { localStorage.setItem(DEPO, JSON.stringify(ayar)); } catch (e) { /* kayıt yok */ } };

  let motor = { var: false, hazir: false, yukleniyor: false, bakildi: false };
  let kapaliSon = 0, ardisikHata = 0, calis = false, calan = null, calanIt = null;
  const sira = [], kayit = [];
  const sayac = { istek: 0, wav: 0, bekle: 0, hata: 0, bayat: 0, tasma: 0, gorunmez: 0, uzak: 0, calindi: 0 };
  const bekle = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const yuvarla = (x) => Math.round(x * 20) / 20;

  async function api(yol, govde) {
    return fetch("/api/ses/" + yol, { method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) }, body: govde ? JSON.stringify(govde) : undefined });
  }
  async function motorYokla() {
    if (!ANAHTAR) return;
    try {
      const r = await api("durum");
      if (r.ok) { const d = await r.json(); motor = { var: !!d.var, hazir: !!d.hazir, yukleniyor: !!d.yukleniyor, bakildi: true, kuyruk: d.kuyruk, onbellek: d.onbellek_mb, hata: d.hata || "" }; }
      else motor = { var: false, bakildi: true };
    } catch (e) { motor = { var: false, bakildi: true }; }
  }

  const uygun = () => !!(ANAHTAR && ayar.acik && motor.var && window.SES && SES.acik && Date.now() >= kapaliSon);

  // ---------- konum, uzaklık, görüş ----------
  function odaKimlik(x, y) { const ic = I(); try { const o = ic.ODALAR[ic.odaKaro(x, y)]; return o && o.id; } catch (e) { return null; } }
  function gorunuyor(x, y) {
    const ic = I(); if (!ic || x == null) return true;
    const X = ic.ex(x * ic.T + ic.T / 2), Y = ic.ey(y * ic.T);
    return X >= 0 && X <= ic.cv.width && Y >= 0 && Y <= ic.cv.height;
  }
  // Dinleyiciye göre kazanç, pan ve tiz süzgeci. Konum yoksa (sohbet cevabı) nötr.
  function kazanc(it) {
    const ic = I(), d = ic && ic.dinleyici && ic.dinleyici();
    const a = it.ajan && !it.ajan.disarda ? it.ajan : null, x = a ? a.x : it.x, y = a ? a.y : it.y;
    if (!d || x == null || y == null) return { g: 1, pan: 0, lp: 14000, baska: false, m: 0 };
    const dx = x - d.x, dy = y - d.y, m = Math.hypot(dx, dy), baska = ic.odaKaro(x, y) !== ic.odaKaro(d.x, d.y);
    let g = m <= 3 ? 1 : 1 / (1 + (m - 3) * 0.16), lp = Math.max(3000, 13000 - m * 330);
    if (baska) { g *= 0.4; lp = Math.min(lp, 1300); }
    return { g: Math.max(g, 0.02), pan: Math.max(-1, Math.min(1, dx / 14)) * 0.9, lp, baska, m };
  }

  // ---------- kuyruk ----------
  function ekle(id, metin, o = {}) {
    if (!uygun()) return false;
    metin = String(metin || "").trim();
    if (!/\p{L}/u.test(metin)) return false;
    const ic = I(), it = { id, metin, t: performance.now(), ajan: o.ajan || null, x: o.x, y: o.y, oda: o.oda, oncelik: o.oncelik || 0, kanal: o.kanal || null, p: profil(id), durum: "getiriliyor" };
    if (!it.ajan && it.x == null && !it.oncelik && ic && ic.bul) it.ajan = ic.bul(id) || null;
    if (kazanc(it).g < ESIK && !it.oncelik) { sayac.uzak++; return false; }   // duyulmayacak kadar uzak
    if (it.kanal) kanalKes(it.kanal);   // aynı kanalda (diyalog kutusu) yeni satır eskisini keser: sıradakini atar, çalanı durdurur
    if (it.oncelik) sira.unshift(it); else sira.push(it);
    while (sira.length > KUYRUK_ENFAZLA) {   // taşma: en eski öncelliksiz satır düşer
      let k = -1; for (let i = 0; i < sira.length; i++) if (!sira[i].oncelik && (k < 0 || sira[i].t < sira[k].t)) k = i;
      sira.splice(k < 0 ? sira.length - 1 : k, 1)[0].durum = "atildi"; sayac.tasma++;
    }
    getir(it); pompa();
    return true;
  }
  function kanalKes(kanal) {
    for (let i = sira.length - 1; i >= 0; i--) if (sira[i].kanal === kanal) sira.splice(i, 1)[0].durum = "atildi";
    if (calanIt && calanIt.kanal === kanal && calanIt.dur) calanIt.dur();
  }
  function mirilti(it) {   // ses üretilemedi: eski sentez mırıltısı (satır hâlâ tazeyse)
    const ic = I(), a = it.ajan; if (!ic || !a || performance.now() - it.t > ILK_YAS) return;
    ic.sesKonum("konus", a.x, a.y, a.perde);
  }
  async function getir(it) {
    sayac.istek++;
    try {
      const hiz = yuvarla(Math.max(0.6, Math.min(1.6, it.p.tempo / it.p.perde)));
      const r = await api("uret", { metin: it.metin, hiz, bekle_sn: 6 });
      if (r.status === 200) {
        const b = SES.baglanti(); if (!b) { it.durum = "iptal"; return; }
        it.buf = await b.ctx.decodeAudioData(await r.arrayBuffer());
        it.durum = "hazir"; sayac.wav++; ardisikHata = 0; motor.hazir = true; return;
      }
      const j = await r.json().catch(() => ({}));
      if (r.status === 202) { it.durum = "bekle"; sayac.bekle++; motor.yukleniyor = !!j.yukleniyor; mirilti(it); return; }
      if (r.status === 400) { it.durum = "bos"; return; }
      if (r.status === 503 || r.status === 404) { motor.var = false; }
      throw new Error(j.hata || r.status);
    } catch (e) {
      it.durum = "hata"; sayac.hata++; mirilti(it);
      if (++ardisikHata >= 3) { kapaliSon = Date.now() + 60000; ardisikHata = 0; }   // art arda hata: bir dakika dinlen
    }
  }
  async function pompa() {
    if (calis) return; calis = true;
    try {
      while (sira.length) {
        const it = sira[0], kalan = BAYAT - (performance.now() - it.t);
        if (it.durum === "atildi") { sira.shift(); continue; }
        if (kalan <= 0) { sira.shift(); sayac.bayat++; continue; }
        for (const bit = performance.now() + kalan; it.durum === "getiriliyor" && performance.now() < bit;) await bekle(40);
        if (sira[0] !== it) continue;
        if (it.durum === "getiriliyor") { sira.shift(); sayac.bayat++; continue; }   // zamanında gelmedi
        sira.shift();
        if (it.durum === "hazir") await cal(it);
      }
    } finally { calis = false; if (sira.length) pompa(); }
  }

  // ---------- çalma ----------
  async function cal(it) {
    const b = window.SES && SES.baglanti(); if (!b || !uygun()) return;
    const { ctx, cikis } = b, p = it.p, ic = I();
    const src = ctx.createBufferSource(); src.buffer = it.buf; src.playbackRate.value = p.perde;
    const ls = ctx.createBiquadFilter(); ls.type = "lowshelf"; ls.frequency.value = 260; ls.gain.value = p.ton;
    const hs = ctx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 3200; hs.gain.value = p.parlak;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 14000; lp.Q.value = 0.5;
    const gn = ctx.createGain(); gn.gain.value = 0;
    const pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(ls); ls.connect(hs); hs.connect(lp); lp.connect(gn); if (pn) { gn.connect(pn); pn.connect(cikis); } else gn.connect(cikis);
    const sure = it.buf.duration / p.perde, seviye = () => (ayar.seviye / 100) * 0.9;
    const guncelle = (ani) => {
      const k = kazanc(it), t = ctx.currentTime, tau = ani ? 0.001 : 0.06;
      gn.gain.setTargetAtTime(k.g * seviye(), t, tau); lp.frequency.setTargetAtTime(k.lp, t, tau); if (pn) pn.pan.setTargetAtTime(k.pan, t, tau);
      calan = { id: it.id, metin: it.metin, ...k, kazancSon: k.g * seviye(), perde: p.perde, ton: p.ton, parlak: p.parlak, sure: +sure.toFixed(2) };
      const a = it.ajan;   // konuşurken balon sürer
      if (a && !a.disarda && (!a.balon || a.balon === it.metin)) { a.balon = it.metin; a.balonSon = Math.max(a.balonSon || 0, ic.zaman + 0.6); }
      return k;
    };
    const ilk = guncelle(true); kayit.push({ id: it.id, metin: it.metin.slice(0, 40), lp: Math.round(ilk.lp), g: +ilk.g.toFixed(3), baska: ilk.baska, m: +ilk.m.toFixed(1), pan: +ilk.pan.toFixed(2) }); if (kayit.length > 30) kayit.shift();
    const z = setInterval(() => guncelle(false), 90);
    sayac.calindi++; calanIt = it;
    it.dur = () => { try { gn.gain.setTargetAtTime(0, ctx.currentTime, 0.02); src.stop(ctx.currentTime + 0.08); } catch (e) { /* zaten durdu */ } };
    if (SES.kis) SES.kis(sure + 0.5);   // konuşurken gün müziği kısılır
    await new Promise((ok) => { src.onended = ok; setTimeout(ok, sure * 1000 + 1500); src.start(); });
    clearInterval(z); calan = null; calanIt = null; it.dur = null;
    try { src.disconnect(); ls.disconnect(); hs.disconnect(); lp.disconnect(); gn.disconnect(); if (pn) pn.disconnect(); } catch (e) { /* zaten ayrık */ }
  }

  // ---------- gerçek sohbet cevabı ----------
  function cevapMetni(m) {
    let t = String(m || "").replace(/```[\s\S]*?```/g, " ").replace(/<oneri>[\s\S]*?<\/oneri>/g, " ").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, " ")
      .replace(/^\s*[-*•#>]+\s*/gm, "").replace(/[*_`~]+/g, "").replace(/\s+/g, " ").trim();
    const cumleler = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [t];
    return cumleler.slice(0, 3).join("").trim().slice(0, 240);
  }

  const DIS = {
    konus(ajanId, metin, o = {}) { return ekle(String(ajanId || "misafir"), metin, { x: o.x, y: o.y, oda: o.oda, oncelik: o.oncelik, kanal: o.kanal }); },
    acik: () => uygun(),
    cevap(ajanId, metin) { if (ayar.cevap && uygun()) ekle(String(ajanId), cevapMetni(metin), { oncelik: 2 }); },
    durum() {
      return { acik: uygun(), ayar: { ...ayar }, motor: { ...motor }, ses: !!(window.SES && SES.acik), kapaliKalan: Math.max(0, kapaliSon - Date.now()), calis: !!calan, calan: calan && { ...calan },
        sira: sira.map((i) => ({ id: i.id, durum: i.durum, yas: Math.round(performance.now() - i.t), oncelik: i.oncelik })), sayac: { ...sayac }, kayit: kayit.slice() };
    },
  };
  window.OFIS_SES_AJAN = DIS;

  // ---------- ayarlar bölümü ----------
  function bilgiYaz() {
    const b = el("as_bilgi"); if (!b) return;
    const kisi = window.OFIS_KISI;
    el("as_acik").disabled = !motor.var; el("as_cevap").disabled = !motor.var;
    b.textContent = !ANAHTAR ? "Ajan sesleri yalnız masaüstündeki Ofis kısayoluyla (ofis.pyw) açınca çalışır."
      : !motor.bakildi ? "Ses motoru denetleniyor…"
      : !motor.var ? "Ses motoru bulunamadı: EMA Lightning ortamı kurulu değil."
      : !ayar.acik ? "Kapalı: ajanlar eskisi gibi mırıldanır."
      : !(window.SES && SES.acik) ? "Üstteki Sesi aç düğmesi kapalı: ajanlar sessiz."
      : motor.yukleniyor ? "Ses modeli yükleniyor… (ilk konuşmalar mırıltıyla geçer)"
      : motor.hazir ? `Hazır. Yalnız ekrandaki konuşmalar sırayla seslenir.${motor.onbellek ? ` Önbellek ${motor.onbellek} MB.` : ""}`
      : "Hazır, ilk konuşmada model yüklenir (~20 sn).";
    const ad = el("as_cevapAd"); if (ad && kisi) ad.textContent = `${kisi.asistan || "Asistan"} ve ajanların gerçek cevaplarını sesli oku`;
  }
  function ayarKur() {
    const panel = el("ayarPanel"), son = el("a_sifirla"); if (!panel || el("sesAyar")) return;
    const k = document.createElement("div"); k.id = "sesAyar"; k.className = "zayar";
    k.innerHTML = `<h2>Ajan sesleri</h2>
      <label class="s"><span>Ajan sesleri</span><input type="checkbox" id="as_acik"></label>
      <label class="s"><span>Ses seviyesi</span><input type="range" id="as_seviye" min="0" max="100" step="5"><output id="as_o"></output></label>
      <label class="s"><span id="as_cevapAd">Gerçek cevapları sesli oku</span><input type="checkbox" id="as_cevap"></label>
      <div class="not" id="as_bilgi" aria-live="polite"></div>`;
    panel.insertBefore(k, son || null);
    k.addEventListener("click", (e) => e.stopPropagation());
    const yaz = () => { el("as_acik").checked = ayar.acik; el("as_seviye").value = ayar.seviye; el("as_o").textContent = ayar.seviye + "%"; el("as_cevap").checked = ayar.cevap; bilgiYaz(); };
    el("as_acik").onchange = () => { ayar.acik = el("as_acik").checked; kaydet(); if (!ayar.acik) sira.length = 0; yaz(); };
    el("as_seviye").oninput = () => { ayar.seviye = +el("as_seviye").value; kaydet(); yaz(); };
    el("as_seviye").onchange = () => I().cv.focus();
    el("as_cevap").onchange = () => { ayar.cevap = el("as_cevap").checked; kaydet(); yaz(); };
    let z = 0;
    new MutationObserver(async () => {
      if (!panel.hidden && !z) { const yenile = async () => { await motorYokla(); yaz(); }; yenile(); z = setInterval(yenile, 2500); }
      else if (panel.hidden && z) { clearInterval(z); z = 0; }
    }).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    yaz();
  }

  function dene(id, metin, zorla) {
    const ic = I(), a = ic.bul(id) || null;
    if (zorla) return ekle(id, metin, { ajan: a, x: a ? undefined : ic.oyuncu.x, y: a ? undefined : ic.oyuncu.y, oncelik: 0 });
    const o = a || { id, ad: id, x: ic.oyuncu.x, y: ic.oyuncu.y };
    o.sesli = false; MODUL.konusmaSatiri({ ajan: o, metin });
    return o.sesli;
  }

  const MODUL = {
    // Ses açıksa model açılışta ısıtılır (~20 sn); yoksa ilk satırlar mırıltıyla geçerdi. 10 dk boşta kalırsa işçi GPU'yu bırakır.
    basla() { ayarKur(); motorYokla().then(() => { bilgiYaz(); if (uygun() && !motor.hazir) api("isit", {}).catch(() => {}); }); },
    konusmaSatiri(o) {
      try {
        const a = o && o.ajan;
        if (!a || !uygun()) return undefined;
        if (a.disarda || o.sesli === false) return undefined;   // ziyaret sohbeti kendi mesajını OFIS_SES_AJAN.konus ile tek kez seslendirir
        if (!gorunuyor(a.x, a.y)) { sayac.gorunmez++; return undefined; }
        if (ekle(a.id, o.metin, { ajan: a })) a.sesli = true;
      } catch (e) { /* ses hatası oyunu bozmasın */ }
      return undefined;
    },
    test: {
      sesAjanDurum: () => DIS.durum(),
      sesAjanDene: (id, metin, zorla) => dene(id, metin, zorla),
      sesAjanAyar: (k, v) => { if (k in ayar) { ayar[k] = v; kaydet(); } return { ...ayar }; },
      sesAjanProfil: (id) => ({ ...profil(id) }),
      sesAjanYokla: async () => { await motorYokla(); return { ...motor }; },
    },
  };
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push(MODUL);
})();
