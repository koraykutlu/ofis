// Işık: sabah pencerelerden düşen güneş hüzmeleri, aydınlık gece (dolu odalarda tavan ışığı, boş odalar kararır), monitör/lamba/koridor ışıkları ve partide disko.
// Çekirdeğe MOD kancalarıyla bağlanır (window.OFIS_IC): zeminIsik (kare tuvalinde, nesnelerin altında), geceCiz (ana tuvalde, ustKatman'dan önce).
// Gradyanlar kare başına yeniden yaratılmaz: yumuşak leke ve koni sprite'ları bir kez çizilir, drawImage ile ölçeklenir.
(() => {
  const I = () => window.OFIS_IC;
  const isikOnbellek = new Map();
  function isikLekesi(renk) {   // merkezden kenara doğrusal sönen radyal leke
    if (isikOnbellek.has(renk)) return isikOnbellek.get(renk);
    const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${renk},1)`); gr.addColorStop(1, `rgba(${renk},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); isikOnbellek.set(renk, c); return c;
  }
  function isikKonisi(renk) {   // masa lambasından aşağı açılan koni (64x96, tepe üstte)
    const an = "koni" + renk; if (isikOnbellek.has(an)) return isikOnbellek.get(an);
    const c = document.createElement("canvas"); c.width = 64; c.height = 96; const x = c.getContext("2d");
    const gr = x.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, `rgba(${renk},.95)`); gr.addColorStop(1, `rgba(${renk},0)`);
    if ("filter" in x) x.filter = "blur(2px)";
    x.fillStyle = gr; x.beginPath(); x.moveTo(27, 0); x.lineTo(37, 0); x.lineTo(62, 94); x.lineTo(2, 94); x.closePath(); x.fill();
    isikOnbellek.set(an, c); return c;
  }
  // Sabah güneşi: pencere eşyalarının altından zemine düşen iki bölmeli sıcak hüzme; 10:00'a dek tam, sonra 16:00'a dek söner
  const pencereler = [];
  function pencereleriBul() {
    const { zeminler, PK, ODALAR, T } = I();
    for (const n of zeminler) {
      if (n.kutu !== PK.pencereUzun && n.kutu !== PK.pencereGenis) continue;
      const oda = ODALAR.find((o) => n.x >= o.x * T && n.x < (o.x + o.w) * T && n.y >= o.y * T && n.y < (o.y + 2) * T);
      if (oda) pencereler.push({ x: n.x, w: n.w, y0: (oda.y + 2) * T, oda });
    }
  }
  function huzme(w) {
    const an = "huzme" + w; if (isikOnbellek.has(an)) return isikOnbellek.get(an);
    const L = 76, kay = 40, c = document.createElement("canvas"); c.width = w + kay + 4; c.height = L; const x = c.getContext("2d");
    const gr = x.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, "rgba(255,222,120,.55)"); gr.addColorStop(1, "rgba(255,210,110,0)");
    if ("filter" in x) x.filter = "blur(1px)";
    x.fillStyle = gr;
    for (const [a, b] of [[3, w / 2 - 2], [w / 2 + 2, w - 3]]) { x.beginPath(); x.moveTo(a, 0); x.lineTo(b, 0); x.lineTo(b + kay, L); x.lineTo(a + kay, L); x.closePath(); x.fill(); }
    isikOnbellek.set(an, c); return c;
  }
  function gunIsigi() {
    const dk = I().dakika(); if (dk >= 16 * 60) return 0;
    return dk <= 10 * 60 ? Math.min(1, 0.55 + (dk - 7 * 60) / 40 * 0.45) : 1 - (dk - 10 * 60) / (6 * 60);
  }
  function huzmeleriCiz() {
    const a = gunIsigi(); if (a <= 0.01) return;
    const { f, T, dakika } = I(), kay = Math.round((dakika() - 7 * 60) / 540 * 18);   // güneş ilerledikçe hüzme yavaşça sağa kayar
    f.save(); f.globalAlpha = a * 0.9;   // açık zeminde "lighter" görünmez: normal karışım, sıcak sarı
    for (const p of pencereler) {
      f.save(); f.beginPath(); f.rect(p.oda.x * T, p.y0, p.oda.w * T, (p.oda.h - 2) * T); f.clip();
      f.drawImage(huzme(p.w), Math.round(p.x) + kay - 4, p.y0 - 2); f.restore();
    }
    f.restore();
  }
  // Akşam: 17:00'den sonra lambalar ve koridor tavan lambaları yanar
  const aksamIsigi = () => Math.max(0, Math.min(1, (I().dakika() - 17 * 60) / 40));
  let KORIDOR_LAMBALARI = [];   // haber merkezi orta koridoru (basla'da karo boyutuyla kurulur)

  // Oda ışıkları: içinde oyuncu, ajan, ziyaretçi ya da Sütlaç olan oda yanar (~0,3 sn); boşalan oda ~0,6 sn'de söner. oda[i] 0 (karanlık) .. 1 (yanık).
  let oda = [], odaIlk = true;
  const odaHedef = () => {
    const ic = I(), dolu = ic.ODALAR.map(() => false), isaretle = (a) => { if (a && !a.disarda && Number.isFinite(a.x)) { const no = ic.odaKaro(a.x, a.y); if (no >= 0) dolu[no] = true; } };
    for (const a of ic.ajanlar) isaretle(a);
    isaretle(ic.kedi); for (const a of ic.ekKarakterler || []) isaretle(a);
    return dolu;
  };
  function odaGuncelle(dt) {
    const ic = I(); if (!ic || !ic.ODALAR) return;
    if (oda.length !== ic.ODALAR.length) { oda = ic.ODALAR.map(() => 1); odaIlk = true; }
    const dolu = odaHedef();
    oda.forEach((d, i) => { oda[i] = odaIlk ? (dolu[i] ? 1 : 0) : dolu[i] ? Math.min(1, d + dt / 0.3) : Math.max(0, d - dt / 0.6); });
    odaIlk = false;
  }
  // Bir dünya noktasının (px) odasının ışığı; oda dışı (kapı eşiği) hafif aydınlık sayılır
  const noktaIsigi = (px, py, taban = 0) => { const ic = I(), no = ic.odaKaro(px / ic.T, py / ic.T), d = no >= 0 && oda[no] !== undefined ? oda[no] : 1; return taban + (1 - taban) * d; };

  // Aydınlık gece: hafif lacivert örtü; boş odalar kararır (gündüz de hafif loş), dolu odalar tavan ışığıyla açılır. Glow yok: düz, yumuşak aydınlık.
  function geceCiz() {
    const ic = I(), { g, cv, kam, ex, ey, T } = ic, k = ic.gecelik(), disko = ic.zaman < ic.efekt.parti, ai = aksamIsigi();
    if (k > 0) { g.fillStyle = `rgba(14,20,56,${k * 0.1})`; g.fillRect(0, 0, cv.width, cv.height); }
    ic.ODALAR.forEach((o, i) => {   // paylaşılan kenarlar aynı yuvarlanır: dikişte boşluk ya da çift koyuluk olmaz
      const d = oda[i] === undefined ? 1 : oda[i], x0 = Math.round(ex(o.x * T)), y0 = Math.round(ey(o.y * T)), x1 = Math.round(ex((o.x + o.w) * T)), y1 = Math.round(ey((o.y + o.h) * T));
      if (x1 < 0 || y1 < 0 || x0 > cv.width || y0 > cv.height) return;
      const karanlik = (1 - d) * (0.1 + 0.34 * k);
      if (karanlik > 0.004) { g.fillStyle = `rgba(10,14,40,${karanlik})`; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
      if (k > 0 && d > 0.004) { g.fillStyle = `rgba(255,236,200,${0.07 * k * d})`; g.globalCompositeOperation = "lighter"; g.fillRect(x0, y0, x1 - x0, y1 - y0); g.globalCompositeOperation = "source-over"; }
    });
    if (k <= 0 && !disko && ai <= 0) return;
    g.save(); g.globalCompositeOperation = "lighter";
    const leke = (renk, X, Y, R, alfa) => {
      if (X < -R || Y < -R || X > cv.width + R || Y > cv.height + R) return;
      g.globalAlpha = alfa; g.drawImage(isikLekesi(renk), X - R, Y - R, R * 2, R * 2);
    };
    if (k > 0) for (const m of ic.monitorler) { const d = noktaIsigi(m.x + m.w / 2, m.y + 4); if (d > 0.01) leke("90,160,255", ex(m.x + m.w / 2), ey(m.y + 4), 22 * kam.o, 0.3 * k * d); }
    if (ai > 0) {
      const koni = isikKonisi("255,206,120");
      for (const n of ic.lambalar) {
        const boy = n.h > 24, cx = ex(n.x + n.w / 2), cy = ey(n.y + 4), R = (boy ? 34 : 16) * kam.o, od = noktaIsigi(n.x + n.w / 2, n.y + 4);
        if (od < 0.01) continue;
        leke("255,200,110", cx, cy, R, (boy ? 0.5 : 0.55) * ai * od);
        const kw = (boy ? 70 : 38) * kam.o, kh = (boy ? 74 : 40) * kam.o;
        if (cx > -kw && cx < cv.width + kw && cy > -kh && cy < cv.height + kh) { g.globalAlpha = 0.42 * ai * od; g.drawImage(koni, cx - kw / 2, cy + 1 * kam.o, kw, kh); }
      }
      for (const [lx, ly] of KORIDOR_LAMBALARI) { const X = ex(lx), Y = ey(ly), od = noktaIsigi(lx, ly, 0.35); leke("255,214,140", X, Y, 46 * kam.o, 0.24 * ai * od); leke("255,244,210", X, Y, 5 * kam.o, 0.6 * ai * od); }
    }
    if (disko) for (let i = 0; i < 5; i++) {
      const X = cv.width * (0.5 + 0.45 * Math.sin(ic.zaman * 1.3 + i * 1.7)), Y = cv.height * (0.5 + 0.4 * Math.cos(ic.zaman * 1.1 + i)), R = 260;
      leke(["255,80,120", "80,180,255", "255,220,80", "120,255,140", "190,120,255"][i], X, Y, R, 0.22);
    }
    g.restore();
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() {
      const { T } = I();
      KORIDOR_LAMBALARI = [3, 9, 15, 21, 27, 33, 39, 45].map((x) => [x * T + 8, 17 * T + 8]);
      pencereleriBul();
    },
    yerlesimYenilendi() { pencereler.length = 0; pencereleriBul(); },   // Düzenle modu pencere taşıyıp silebilir
    zeminIsik: huzmeleriCiz,
    geceCiz,
    guncelle: odaGuncelle, uzakGuncelle: odaGuncelle,
    test: {
      odaIsik: () => Object.fromEntries(I().ODALAR.map((o, i) => [o.id, +(oda[i] === undefined ? 1 : oda[i]).toFixed(2)])),
      isik: () => ({ gun: +gunIsigi().toFixed(2), aksam: +aksamIsigi().toFixed(2), pencere: pencereler.length, lamba: I().lambalar.length, onbellek: isikOnbellek.size }),
    },
  });
})();
