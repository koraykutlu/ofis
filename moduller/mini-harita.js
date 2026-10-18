// Mini harita: sağ altta, HUD'un üstünde yarı saydam: odalar, oyuncu (sarı), ajanlar, Sütlaç (beyaz), yapılmamış görevlerin yeri (ünlem).
// Odaya tıklayınca oda kartı açılır (moduller/kartlar.js); karttaki "Oraya git" oyuncuyu o odanın uygun bir karosuna yürütür (OFIS_MINI.git). M tuşu gizler/gösterir. Diyalog açıkken tıklama yok sayılır (çekirdek sormaz).
// Çekirdeğe MOD kancalarıyla bağlanır (window.OFIS_IC): ustKatmanSon(hudUst), fareHareket(e), tikla(e), tus(e), ayarUygulandi(ayar).
// Olay kancaları olayı tüketince true, tüketmeyince undefined döner (MOD ilk tanımlı dönüşü kullanır; false sonraki modülü gölgeler).
// Görünürlük ayarlar modülüne ayarKaydet("mini", v) ile yazılır.
(() => {
  const I = () => window.OFIS_IC;
  const MINI_AD = { gundem: "Gündem", yonetim: "Yönetim", beyin: "Arşiv", radar: "Radar", merkez: "Haber merkezi", mutfak: "Mutfak", toplanti: "Toplantı", studyo: "Stüdyo", yayin: "Yayın" };
  const miniAd = (id) => (window.OFIS_KISI && window.OFIS_KISI.miniAd[id]) || MINI_AD[id];   // kişi.json oda_adlari kısa adı varsa o
  const MINI_RENK = { gundem: "90,130,200", yonetim: "220,170,70", beyin: "140,110,200", radar: "80,170,150", merkez: "120,140,170", mutfak: "210,120,100", toplanti: "170,130,90", studyo: "200,90,120", yayin: "90,150,210" };
  // Görev -> yeri (karo). Ajanla ilgili olanlar ajanın o anki yerini izler.
  const ajanYeri = (id) => { const a = I().bul(id); return a.disarda ? a.koltuk : [a.x, a.y]; };
  const GOREV_YERI = {
    bulten: () => ajanYeri("editor"), radar: () => ajanYeri("dagitici"), brifing: () => ajanYeri("ada"), kayit: () => ajanYeri("spiker"), tarama: () => ajanYeri("tarayici"),
    mama: () => [8, 30], toplanti: () => [16, 27], yazici: () => I().YAZICI, balik: () => [45, 16], kahve: () => I().KAHVE,
  };
  let mini = null, miniUst = -1, miniAcik = true;   // son çizilen mini harita alanı; fare üstündeki oda; görünürlük (ayar.mini)
  function miniCiz(hudUst) {
    mini = null;
    const ic = I(), { oyuncu, cv, g, kam, yo, W, H, T, ODALAR, kedi, yazi, yuvarlak } = ic;
    if (!miniAcik || !oyuncu) return;
    // dar tuvalde (telefon, küçük pencere) harita oranı küçülür, oda adları yazılmaz (üst üste biniyordu)
    const u = yo, dar = cv.width < 760 * u, pad = 5 * u, mw = Math.min(150 * u, cv.width * (dar ? 0.2 : 0.24)), ol = (mw - 2 * pad) / W, mh = H * ol + 2 * pad;
    const adlar = mw >= 120 * u, ur = Math.min(4.2 * u, Math.max(2.4 * u, ol * T * 1.2));   // ünlem yarıçapı haritayla ölçeklenir
    const mx = cv.width - 10 * u - mw, my = hudUst - 8 * u - mh;
    if (my < 4 * u || mx < 4 * u) return;   // tuval çok küçükse gösterme
    mini = { x: mx, y: my, w: mw, h: mh, ol, pad };
    const X = (wx) => mx + pad + wx * ol, Y = (wy) => my + pad + wy * ol;
    g.fillStyle = "rgba(14,14,20,.58)"; yuvarlak(mx, my, mw, mh, 6 * u); g.fill();
    g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = u; g.stroke();
    ODALAR.forEach((o, i) => {
      const rx = X(o.x * T), ry = Y(o.y * T), rw = o.w * T * ol, rh = o.h * T * ol;
      g.fillStyle = `rgba(${MINI_RENK[o.id]},${i === miniUst ? 0.8 : 0.5})`; g.fillRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      g.strokeStyle = i === miniUst ? "rgba(255,255,255,.9)" : "rgba(10,10,20,.5)"; g.lineWidth = u; g.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      if (adlar) yazi(miniAd(o.id), rx + rw / 2, ry + 3 * u, 9 * u, "rgba(255,255,255,.88)", { hiza: "center", golge: "rgba(10,10,20,.6)" });
    });
    // kamera görüş alanı
    const gw = cv.width / kam.o, gh = cv.height / kam.o;
    if (gw < W - 1 || gh < H - 1) { g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = u; g.strokeRect(X(Math.max(0, kam.x)), Y(Math.max(0, kam.y)), Math.min(gw, W) * ol, Math.min(gh, H) * ol); }
    const nokta = (wx, wy, r, renk, kenar) => {
      g.fillStyle = renk; g.beginPath(); g.arc(X(wx), Y(wy), r, 0, 7); g.fill();
      if (kenar) { g.strokeStyle = kenar; g.lineWidth = u; g.stroke(); }
    };
    for (const a of ic.ajanlar) if (!a.oyuncu && !a.disarda) nokta(a.x * T + 8, a.y * T + 8, 2 * u, "#9cc4ff");
    const kx = kedi.ust ? kedi.ust.px + 8 : kedi.x * T + 8, ky = kedi.ust ? kedi.ust.py + 8 : kedi.y * T + 8;
    nokta(kx, ky, 2.2 * u, "#ffffff", "rgba(10,10,20,.6)");
    // görev işaretleri: küçük ünlem (yeri bilinen, yapılmamış görevler)
    const nabiz = 0.75 + 0.25 * Math.sin(ic.zaman * 5);
    for (const gv of (ic.uzak ? [] : ic.gorevler)) {   // ziyaretteyken kendi görev işaretlerin ev sahibinin haritasında görünmez
      if (gv.bitti || !GOREV_YERI[gv.id]) continue;
      const [gx, gy] = GOREV_YERI[gv.id](), px = X(gx * T + 8), py = Y(gy * T + 8) - 5 * u;
      g.fillStyle = `rgba(232,88,74,${nabiz})`; g.beginPath(); g.arc(px, py, ur, 0, 7); g.fill();
      yazi("!", px, py - ur * 1.1, ur * 2.15, "#ffffff", { hiza: "center" });
    }
    nokta(oyuncu.x * T + 8, oyuncu.y * T + 8, 3.2 * u, "#f2cf4a", "#1d2029");
  }
  // Tıklama noktası (tuval pikseli) mini haritanın neresinde? null: harita dışı; {oda: -1}: panel içi ama oda dışı
  function tuvalPx(e) {
    const { cv } = I(), r = cv.getBoundingClientRect(), olc = Math.min(r.width / cv.width, r.height / cv.height);
    return [(e.clientX - r.left - (r.width - cv.width * olc) / 2) / olc, (e.clientY - r.top - (r.height - cv.height * olc) / 2) / olc];
  }
  function miniVurus(e) {
    if (!mini) return null;
    const { T, GEN, YUK, odaNo } = I(), [px, py] = tuvalPx(e);
    if (px < mini.x || py < mini.y || px > mini.x + mini.w || py > mini.y + mini.h) return null;
    const tx = Math.floor(((px - mini.x - mini.pad) / mini.ol) / T), ty = Math.floor(((py - mini.y - mini.pad) / mini.ol) / T);
    return { oda: tx >= 0 && ty >= 0 && tx < GEN && ty < YUK ? odaNo[ty][tx] : -1 };
  }
  // Odanın ortasına en yakın, koltuk olmayan ve erişilebilir karo (A* yolu kesintisiz değilse sıradaki adaya geçer)
  function miniGit(i) {
    const ic = I(), { oyuncu, yurur, koltuklar, odaNo } = ic, o = ic.ODALAR[i]; if (!o || !oyuncu) return null;
    ic.tuslar.clear();
    const bas = [Math.round(oyuncu.x), Math.round(oyuncu.y)], cx = o.x + o.w / 2, cy = o.y + 2 + (o.h - 2) / 2, adaylar = [];
    for (let y = o.y + 2; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) if (yurur[y][x] && !koltuklar.has(`${x},${y}`) && odaNo[y][x] === i) adaylar.push([x, y]);
    adaylar.sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy));
    for (const c of adaylar.slice(0, 25)) {
      const yol = ic.yolBul(bas, c);
      let ok = true, px = bas[0], py = bas[1];
      for (const [x, y] of yol) { if (Math.abs(x - px) + Math.abs(y - py) !== 1) ok = false; px = x; py = y; }
      if (ok && px === c[0] && py === c[1]) { ic.gonder(oyuncu, c); return c; }
    }
    return null;
  }

  window.OFIS_MINI = { git: (odaId) => miniGit(I().ODALAR.findIndex((o) => o.id === odaId)) };   // oda kartının "Oraya git" düğmesi
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() { I().cv.addEventListener("mouseleave", () => (miniUst = -1)); },
    ayarUygulandi(ayar) { miniAcik = ayar.mini; },
    ustKatmanSon: miniCiz,
    fareHareket(e) {
      const m = miniVurus(e); miniUst = m ? m.oda : -1;
      if (!m) return;
      e.miniTik = true;   // kartlar.js aynı fareyi haritanın altındaki ajan/tabela için okumasın
      I().cv.style.cursor = m.oda >= 0 ? "pointer" : "default"; return true;
    },
    tikla(e) {   // mini haritadan oda kartı (kartlar.js); "Oraya git" kartta (OFIS_MINI.git)
      const m = miniVurus(e); if (!m) return;
      e.miniTik = true;
      if (m.oda >= 0) { const o = I().ODALAR[m.oda]; if (window.OFIS_KART && o) window.OFIS_KART.odaAc(o.id); else miniGit(m.oda); }
      return true;
    },
    tus(e) {
      if (e.code !== "KeyM" || e.ctrlKey || e.metaKey || e.altKey) return;
      miniAcik = !miniAcik; I().MOD("ayarKaydet", "mini", miniAcik); return true;
    },
    test: {
      mini: () => mini && { ...mini, acik: miniAcik },
      miniEkran: (id) => {   // odanın mini haritadaki ortası (sayfa pikseli); tıklama testi için
        const { cv, T, ODALAR } = I(), o = ODALAR.find((x) => x.id === id), r = cv.getBoundingClientRect(), olc = Math.min(r.width / cv.width, r.height / cv.height);
        const px = mini.x + mini.pad + (o.x + o.w / 2) * T * mini.ol, py = mini.y + mini.pad + (o.y + o.h * 0.6) * T * mini.ol;
        return [r.left + (r.width - cv.width * olc) / 2 + px * olc, r.top + (r.height - cv.height * olc) / 2 + py * olc];
      },
      miniGit: (id) => miniGit(I().ODALAR.findIndex((o) => o.id === id)),
    },
  });
})();
