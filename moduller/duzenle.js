// Düzenle modu (header'daki 🛠️): ofise eşya yerleştir, taşı, sil, geri al. Katalog: bu ofisteki atlas parçaları + LimeZu tekil eşyaları
// (katalog.js, araclar/katalog_yap.py). Düzen veri olarak tutulur (OFIS_IC.duzen: eklenen + kaldırılan temel eşyaların imzası); her değişiklikte
// çekirdek her şeyi yeniden kurar (yerlesimYenile) ve girişten masalara, oturaklara, kahveye, yazıcıya, mama kabına ve kapılara yol kalmalıdır
// (erisimDenetle), kalmazsa değişiklik geri alınır. İşlevi olan temel eşyalar (masa, ekran, sunucu, koltuk, hareketli, oturak taşıyan) korunur.
// Kayıt: Ofis sunucusu (/api/duzen → %LOCALAPPDATA%\OfisDemo\duzen.json), düz http.server'da bu tarayıcı (localStorage).
// Kancalar: basla, fareHareket, tikla, tus (açıkken tüketir), duzenCiz.
(() => {
  const I = () => window.OFIS_IC;
  const el = (id) => document.getElementById(id);
  const KATMAN_AD = { esya: "Eşya", ust: "Masa üstü", hali: "Halı", duvar: "Duvar" };
  let acik = false, katman = "esya", kategori = "atlas", secim = null, fare = null, alti = null, son = null, oncekiKamera = true;
  const geri = [];   // düzen anlık görüntüleri (JSON)
  let kayitZ = 0, sonKaydirma = 0;

  // ---------- düzen işlemleri ----------
  const anlik = () => JSON.stringify(I().duzen);
  function uygula(d) { const ic = I(); ic.duzen = ic.duzenTemizle(d); ic.yerlesimYenile(); }
  // Değişikliği dene: yol kapanırsa geri al ve sebebini söyle
  function degistir(fn, geriAlinir = true) {
    if (I().uzak) return false;   // ziyaretteyken ekrandaki düzen başkasınındır: kendi kaydına yazılmaz
    const once = anlik(), d = JSON.parse(once);
    fn(d); uygula(d);
    const eksik = I().erisimDenetle();
    if (eksik.length) { uygula(JSON.parse(once)); mesaj(`Olmaz: ${eksik.slice(0, 3).join(", ")} yolu kapanıyor.`, true); return false; }
    if (geriAlinir) { geri.push(once); if (geri.length > 60) geri.shift(); }
    kaydet(); return true;
  }
  function kaydet() {
    if (I().uzak) return;
    clearTimeout(kayitZ);
    kayitZ = setTimeout(async () => {
      const ic = I(), govde = JSON.stringify({ surum: 1, ...ic.duzen });
      if (ic.ANAHTAR) {
        try {
          const r = await fetch("/api/duzen", { method: "POST", headers: { "X-Ofis-Anahtar": ic.ANAHTAR, "Content-Type": "application/json" }, body: govde });
          if (r.ok) return; mesaj("Kaydedilemedi: " + ((await r.json().catch(() => ({}))).hata || r.status), true); return;
        } catch (e) { /* tarayıcıya düş */ }
      }
      try { localStorage.setItem("ofis-duzen-1", govde); } catch (e) { mesaj("Kaydedilemedi (tarayıcı depolaması kapalı).", true); }
    }, 300);
  }
  function geriAl() {
    if (I().uzak) return;
    if (!geri.length) return mesaj("Geri alınacak bir şey yok.");
    if (secim && secim.tur === "tasi") secimBirak();
    uygula(JSON.parse(geri.pop())); son = null; kaydet(); mesaj("Geri alındı.");
  }

  // ---------- eşya bilgisi ----------
  // Yerleşimdeki nesne → düzen kaydı ({k, katman}) ya da null (taşınamaz)
  function kayit(n) {
    const ic = I();
    if (n.kullanici) return { ...ic.duzen.eklenen[n.kullanici - 1], tur: "kullanici", i: n.kullanici - 1 };
    if (!n.taban || ic.korunanMi(n.taban)) return null;
    const m = ic.HR.mobilya[n.taban - 1], o = m.ops || {};
    return { k: m.k, x: m.x, y: m.y, katman: o.duvar ? "duvar" : o.zemin ? "hali" : o.engel === false ? "ust" : "esya", tur: "taban", imza: ic.mobilyaImza(m) };
  }
  const alfa = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  function opakMi(n, px, py) {   // sprite'ın o pikseli boş değilse (şeffaf köşeler seçilmesin)
    try { alfa.clearRect(0, 0, 1, 1); alfa.drawImage(n.kaynak, n.kutu[0] + px, n.kutu[1] + py, 1, 1, 0, 0, 1, 1); return alfa.getImageData(0, 0, 1, 1).data[3] > 20; }
    catch (e) { return true; }
  }
  // Farenin altındaki seçilebilir eşya: önce önde çizilenler, sonra duvar eşyaları, en son halılar
  function altindaki(wx, wy) {
    const ic = I(), aday = (n) => (n.kullanici || n.taban) && wx >= n.x && wx < n.x + n.w && wy >= n.y && wy < n.y + n.h && opakMi(n, Math.floor(wx - n.x), Math.floor(wy - n.y));
    const n = ic.nesneler.filter(aday).sort((p, q) => q.sira - p.sira)[0] || ic.zeminler.filter((z) => z.duvar && aday(z))[0] || ic.zeminler.filter((z) => z.zemin && aday(z)).pop();
    return n ? { n, kayit: kayit(n) } : null;
  }

  // ---------- yerleştirme ----------
  const boyut = (k) => { const s = I().spr(k); return s && s.kutu ? [s.kutu[2], s.kutu[3]] : null; };
  // İmlece göre konum: yatayda 8 px'e, altta karo kenarına oturur (Alt: serbest)
  function konum(wx, wy, w, h, serbest) {
    const T = I().T;
    return serbest ? [Math.round(wx - w / 2), Math.round(wy - h + 4)] : [Math.round((wx - w / 2) / 8) * 8, (Math.floor(wy / T) + 1) * T - h];
  }
  // Konum kurallara uyuyor mu: oda içinde; eşya alt şeridi boş zeminde ve masa/kapı/giriş/oturak noktası üstünde değil; halı zeminde; duvar eşyası duvarda
  function uygunMu(katman_, x, y, w, h) {
    const ic = I(), { T, ODALAR, yurur, koltuklar } = ic, bx = x + w / 2, by = y + h - 1;
    const o = ODALAR.find((r) => bx >= r.x * T && bx < (r.x + r.w) * T && by >= r.y * T && by < (r.y + r.h) * T);
    if (!o) return "oda dışında";
    if (x < o.x * T - 2 || x + w > (o.x + o.w) * T + 2) return "oda duvarından taşıyor";
    const zeminUst = (o.y + 2) * T;
    if (katman_ === "duvar") return by < zeminUst + 6 && y >= o.y * T - 24 ? "" : "duvar eşyası duvara asılır";
    if (katman_ === "hali") return y >= zeminUst - 2 && y + h <= (o.y + o.h) * T + 2 ? "" : "halı zemine serilir";
    if (by < zeminUst) return "zemine koy";
    if (katman_ === "ust") return "";
    const yasak = new Set([...koltuklar, `${ic.KAHVE}`, `${ic.YAZICI}`, `${ic.GIRIS}`, ...ic.OTURAKLAR.map((s) => `${s.yaklas}`)]);
    const y0 = Math.floor((y + h - 10) / T), y1 = Math.floor((y + h - 3) / T), x0 = Math.floor((x + 3) / T), x1 = Math.floor((x + w - 4) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!yurur[ty] || !yurur[ty][tx]) return "orası dolu";
      if (yasak.has(`${tx},${ty}`)) return "orası bir masanın, oturağın ya da girişin önü";
    }
    return "";
  }
  function yerlestir(k, katman_, x, y) {
    const b = boyut(k); if (!b) return { ok: false, mesaj: "eşya bulunamadı" };
    const neden = uygunMu(katman_, x, y, b[0], b[1]);
    if (neden) { mesaj(`Buraya olmaz: ${neden}.`, true); return { ok: false, mesaj: neden }; }
    const ok = degistir((d) => d.eklenen.push({ k, x, y, katman: katman_ }));
    if (ok) { son = I().duzen.eklenen.length - 1; mesaj(`${KATMAN_AD[katman_]} yerleşti. Ok tuşları: 1 px kaydır (Shift: 8 px).`); }
    return { ok, mesaj: ok ? "" : "yol kapanıyor" };
  }
  function sil(a) {
    if (!a || !a.kayit) { mesaj(a ? "Bu eşyanın ofiste bir işi var, kaldırılamaz." : "", !!a); return false; }
    const r = a.kayit;
    degistir((d) => { if (r.tur === "kullanici") d.eklenen.splice(r.i, 1); else d.silinen.push(r.imza); });
    son = null; mesaj("Kaldırıldı. Geri almak için Ctrl+Z."); return true;
  }
  // Taşı: eşya elde tutulur (düzenden çıkar), tıklanan yere bırakılır; Esc eski yerine koyar
  function tasimaBasla(a) {
    if (!a.kayit) return mesaj("Bu eşyanın ofiste bir işi var, taşınamaz.", true);
    const r = a.kayit, once = anlik(), d = JSON.parse(once);
    if (r.tur === "kullanici") d.eklenen.splice(r.i, 1); else d.silinen.push(r.imza);
    uygula(d); son = null;
    secim = { tur: "tasi", k: r.k, katman: r.katman, once };
    cekmece(false); mesaj("Taşınıyor: yeni yerine dokun/tıkla; 🗑 kaldırır, Esc eski yerine koyar.");
  }
  function secimBirak() {
    if (secim && secim.tur === "tasi") uygula(JSON.parse(secim.once));
    secim = null; kutulariIsaretle(); mesaj("");
  }
  function birakVeyaKoy(wx, wy, serbest) {
    const b = boyut(secim.k); if (!b) return;
    const [x, y] = konum(wx, wy, b[0], b[1], serbest);
    if (secim.tur === "tasi") {
      const neden = uygunMu(secim.katman, x, y, b[0], b[1]);
      if (neden) return mesaj(`Buraya olmaz: ${neden}.`, true);
      const once = secim.once, k = secim.k, kat = secim.katman;
      const ok = degistir((d) => d.eklenen.push({ k, x, y, katman: kat }), false);
      if (ok) { geri.push(once); son = I().duzen.eklenen.length - 1; secim = null; mesaj("Taşındı. Ok tuşları: 1 px kaydır."); }
    } else yerlestir(secim.k, katman, x, y);
  }
  function kaydir(dx, dy) {
    const ic = I(), e = son != null && ic.duzen.eklenen[son]; if (!e) return false;
    const b = boyut(e.k); if (!b) return false;
    const once = anlik(), d = JSON.parse(once); d.eklenen.splice(son, 1); uygula(d);   // kendi kapladığı yer engel sayılmasın
    const neden = uygunMu(e.katman, e.x + dx, e.y + dy, b[0], b[1]); uygula(JSON.parse(once));
    if (neden) { mesaj(`O yöne kaydırılamaz: ${neden}.`, true); return true; }
    const birlesik = performance.now() - sonKaydirma < 1200; sonKaydirma = performance.now();   // art arda kaydırmalar tek geri alma adımı
    degistir((d) => { d.eklenen[son].x += dx; d.eklenen[son].y += dy; }, !birlesik);
    return true;
  }

  // ---------- panel ----------
  function mesaj(m, uyari) { const k = el("dMesaj"); if (!k) return; k.textContent = m || ""; k.classList.toggle("uyari", !!uyari); }
  function kategorileriYaz() {
    const s = el("dKategori"), ic = I();
    const sec = (v, ad) => { const o = document.createElement("option"); o.value = v; o.textContent = ad; s.appendChild(o); };
    sec("atlas", `Bu ofisteki parçalar (${Object.keys(window.ATLAS).length})`);
    for (const k of ic.KAT.kategoriler) sec(k.id, `${k.ad} (${k.n})`);
    s.value = kategori; s.onchange = () => { kategori = s.value; ogeleriYaz(); };
  }
  async function ogeleriYaz() {
    const kutu = el("dOgeler"), ic = I(), istenen = kategori; kutu.textContent = "";
    let liste, kaynak;
    if (kategori === "atlas") { kaynak = ic.img.atlas; liste = Object.entries(window.ATLAS).filter(([ad]) => !/^masa(Sari|Turuncu)?(Sol|Orta|Sag)$/.test(ad)).map(([ad, r]) => [ad, r]); }
    else {
      mesaj("Katalog yükleniyor…");
      try { kaynak = await ic.katYukle(kategori); } catch (e) { return mesaj("Bu kategorinin görseli yüklenemedi.", true); }
      if (istenen !== kategori) return;   // bu arada başka kategori seçildi
      mesaj(""); liste = (ic.KAT.ogeler[kategori] || []).map(([no, x, y, w, h]) => [`kat:${kategori}/${no}`, [x, y, w, h]]);
    }
    for (const [k, [sx, sy, w, h]] of liste) {
      const b = document.createElement("button"), c = document.createElement("canvas"), o = Math.max(1, Math.min(3, Math.floor(44 / Math.max(w, h))));
      c.width = w * o; c.height = h * o; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(kaynak, sx, sy, w, h, 0, 0, w * o, h * o);
      b.title = k; b.dataset.k = k; b.appendChild(c);
      b.onclick = () => { if (secim && secim.tur === "tasi") secimBirak(); secim = { tur: "yeni", k }; son = null; kutulariIsaretle(); mesaj(`Seçildi (${KATMAN_AD[katman]}): haritaya dokun/tıkla. Esc bırakır.`); cekmece(false); I().cv.focus(); };
      kutu.appendChild(b);
    }
    kutulariIsaretle();
  }
  // ---------- yüzen çekmece (üstten çekilir) ve eylem çubuğu (Kaldır / Bırak) ----------
  function cekmece(ac_) { const p = el("duzenPanel"); if (p) p.classList.toggle("toplu", !ac_); }
  let eylemImza = "";
  function kaldirSecili() {   // dokunmatikte sağ tık / Del yok: eldeki ya da son yerleştirilen eşyayı kaldırır
    if (secim && secim.tur === "tasi") { geri.push(secim.once); secim = null; son = null; kaydet(); kutulariIsaretle(); mesaj("Kaldırıldı. Geri al ile döner."); return true; }
    if (son != null) { const i = son; degistir((d) => d.eklenen.splice(i, 1)); son = null; mesaj("Kaldırıldı. Geri al ile döner."); return true; }
    return false;
  }
  function eylemYaz() {
    const k = el("duzenEylem"); if (!k) return;
    const durum = !acik ? "" : secim && secim.tur === "tasi" ? "tasi" : (secim ? "yeni" : "") + (son != null ? "+son" : "");
    if (durum === eylemImza) return; eylemImza = durum; k.textContent = "";
    k.hidden = !durum; if (!durum) return;
    const d = (ad, fn, tehlike) => { const b = document.createElement("button"); b.type = "button"; b.textContent = ad; if (tehlike) b.className = "tehlike"; b.onclick = () => { fn(); I().cv.focus(); }; k.append(b); };
    if (durum === "tasi") { d("🗑 Kaldır", kaldirSecili, true); d("↩ Eski yerine", secimBirak); return; }
    if (son != null) d(secim ? "🗑 Sonuncuyu kaldır" : "🗑 Kaldır", kaldirSecili, true);   // az önce yerleştirilen/taşınan eşya
    if (secim) d("✕ Bırak", secimBirak); else d("✓ Tamam", () => { son = null; mesaj(""); });
  }
  function kutulariIsaretle() { document.querySelectorAll("#dOgeler button").forEach((b) => b.classList.toggle("secili", !!secim && secim.tur === "yeni" && b.dataset.k === secim.k)); }
  function katmanYaz() { document.querySelectorAll("#dKatman [data-k]").forEach((b) => b.classList.toggle("secili", b.dataset.k === katman)); }
  function ac(a) {
    const ic = I(); if (a === acik || (a && ic.uzak)) return;   // ziyaretteyken (başkasının ofisinde) düzenlenmez
    acik = a; el("duzenPanel").hidden = !a; el("duzenDugme").classList.toggle("secili", a); el("duzenDugme").setAttribute("aria-expanded", a);
    el("duzenTutac").hidden = !a; if (!a) el("duzenEylem").hidden = true;
    if (a) {
      cekmece(true);
      if (ic.diyalogAcik()) ic.diyalogKapat();
      oncekiKamera = ic.kameraYakin; ic.kameraAyarla(false);
      if (!el("dKategori").options.length) { kategorileriYaz(); ogeleriYaz(); }
      katmanYaz(); mesaj("Bir eşya seç ya da haritadaki bir eşyaya tıklayıp taşı.");
    } else { secimBirak(); son = null; alti = null; ic.kameraAyarla(oncekiKamera); ic.cv.style.cursor = "default"; }
    ic.cv.focus();
  }

  // ---------- çizim ----------
  function ciz() {
    eylemYaz();
    if (!acik) return;
    const ic = I(), { g, cv, kam, ex, ey, T, W, H, yo } = ic;
    g.save();
    // ızgara (yalnız görünen kısım)
    g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1;
    const x0 = Math.max(0, Math.floor(kam.x / T)), x1 = Math.min(W / T, Math.ceil((kam.x + cv.width / kam.o) / T)), y0 = Math.max(0, Math.floor(kam.y / T)), y1 = Math.min(H / T, Math.ceil((kam.y + cv.height / kam.o) / T));
    g.beginPath();
    for (let x = x0; x <= x1; x++) { g.moveTo(Math.round(ex(x * T)) + 0.5, ey(y0 * T)); g.lineTo(Math.round(ex(x * T)) + 0.5, ey(y1 * T)); }
    for (let y = y0; y <= y1; y++) { g.moveTo(ex(x0 * T), Math.round(ey(y * T)) + 0.5); g.lineTo(ex(x1 * T), Math.round(ey(y * T)) + 0.5); }
    g.stroke();
    const kutuCiz = (x, y, w, h, renk, kesik) => { g.setLineDash(kesik ? [4 * yo, 3 * yo] : []); g.strokeStyle = renk; g.lineWidth = 2 * yo; g.strokeRect(ex(x) - 1, ey(y) - 1, w * kam.o + 2, h * kam.o + 2); };
    const e = son != null && ic.duzen.eklenen[son], sb = e && boyut(e.k);
    if (sb) kutuCiz(e.x, e.y, sb[0], sb[1], "rgba(242,193,78,.9)", true);
    if (secim && fare) {
      const s = ic.spr(secim.k), b = s && s.kutu && [s.kutu[2], s.kutu[3]];
      if (b && s.kaynak) {
        const kat = secim.tur === "tasi" ? secim.katman : katman, [x, y] = konum(fare[0], fare[1], b[0], b[1], fare[2]), neden = uygunMu(kat, x, y, b[0], b[1]);
        g.globalAlpha = 0.8; g.imageSmoothingEnabled = false;
        g.drawImage(s.kaynak, s.kutu[0], s.kutu[1], b[0], b[1], ex(x), ey(y), b[0] * kam.o, b[1] * kam.o); g.globalAlpha = 1;
        kutuCiz(x, y, b[0], b[1], neden ? "rgba(227,107,93,.95)" : "rgba(108,194,138,.95)");
      }
    } else if (alti) kutuCiz(alti.n.x, alti.n.y, alti.n.w, alti.n.h, alti.kayit ? "rgba(255,255,255,.85)" : "rgba(227,107,93,.7)", !alti.kayit);
    g.restore();
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() {
      const ic = I();
      el("duzenDugme").onclick = () => ac(!acik);
      el("dBitir").onclick = () => ac(false);
      setInterval(eylemYaz, 150);   // eylem çubuğu çizim döngüsünden bağımsız da güncellensin (sekme arka plandayken bile)
      el("dTopla").onclick = () => { cekmece(false); ic.cv.focus(); };
      // tutaç: dokunursan açılır; aşağı çekersen açılır, yukarı çekersen kapanır
      const tutac = el("duzenTutac"); let y0 = null;
      tutac.addEventListener("pointerdown", (e) => { y0 = e.clientY; try { tutac.setPointerCapture(e.pointerId); } catch (x) { /* yapay işaretçi */ } });
      tutac.addEventListener("pointerup", (e) => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; cekmece(dy > -14); });
      tutac.addEventListener("pointercancel", () => { y0 = null; });
      el("dGeri").onclick = () => { geriAl(); ic.cv.focus(); };
      el("dSifirla").onclick = () => {
        if (!confirm("Ofis ilk düzenine dönsün mü? Eklediğin ve taşıdığın her şey kalkar (Geri al ile dönebilirsin).")) return;
        if (secim) secimBirak(); degistir((d) => { d.eklenen = []; d.silinen = []; }); son = null; mesaj("İlk düzene dönüldü.");
      };
      document.querySelectorAll("#dKatman [data-k]").forEach((b) => (b.onclick = () => { katman = b.dataset.k; katmanYaz(); ic.cv.focus(); }));
      ic.cv.addEventListener("contextmenu", (e) => {
        if (!acik) return; e.preventDefault();
        if (secim) return secimBirak();
        const [wx, wy] = ic.dunya(e); sil(altindaki(wx, wy));
      });
    },
    fareHareket(e) {
      if (!acik) return;
      const ic = I(), [wx, wy] = ic.dunya(e); fare = [wx, wy, e.altKey];
      alti = secim ? null : altindaki(wx, wy);
      ic.cv.style.cursor = secim ? "crosshair" : alti && alti.kayit ? "grab" : "default";
      return true;
    },
    tikla(e) {
      if (!acik) return;
      const [wx, wy] = I().dunya(e);
      if (secim) birakVeyaKoy(wx, wy, e.altKey);
      else { const a = altindaki(wx, wy); if (a) tasimaBasla(a); }
      return true;
    },
    tus(e) {
      if (!acik) return;
      if (e.key === "Escape") { if (secim) secimBirak(); else if (son != null) { son = null; mesaj(""); } else ac(false); return true; }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { geriAl(); e.preventDefault(); return true; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (son != null) { const i = son; degistir((d) => d.eklenen.splice(i, 1)); son = null; mesaj("Kaldırıldı."); }
        else if (fare) sil(altindaki(fare[0], fare[1]));
        e.preventDefault(); return true;
      }
      const yon = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (yon && son != null) { const a = e.shiftKey ? 8 : 1; kaydir(yon[0] * a, yon[1] * a); e.preventDefault(); return true; }
      return;
    },
    duzenCiz: ciz,
    test: {
      duzen: () => JSON.parse(anlik()),
      duzenAc: (a = true) => ac(a),
      duzenYerlestir: (k, katman_, x, y) => yerlestir(k, katman_, x, y),
      duzenAlti: (wx, wy) => { const a = altindaki(wx, wy); return a && { k: a.n.kullanici ? I().duzen.eklenen[a.n.kullanici - 1].k : I().HR.mobilya[a.n.taban - 1].k, tasinir: !!a.kayit }; },
      duzenSil: (wx, wy) => sil(altindaki(wx, wy)),
      duzenTasi: (wx, wy, hx, hy) => { const a = altindaki(wx, wy); if (!a || !a.kayit) return false; tasimaBasla(a); birakVeyaKoy(hx, hy, false); return !secim; },
      duzenGeri: () => geriAl(),
      duzenMesaj: () => el("dMesaj").textContent,
    },
  });
})();
