// Ücretsiz LimeZu paketinde olmayan ofis eşyaları: LimeZu tarzında, kodla çizilmiş piksel sprite'lar.
// Her fonksiyon 1x çözünürlükte bir tuval döndürür.
window.CIZIM = (() => {
  const R = {
    o: "#2e2b3a", k: "#24232e", K: "#383646", d: "#5d6072", g: "#9a9daf", l: "#cfd2dc", w: "#f3f4f8",
    b: "#2f6fb3", B: "#5fb0ea", c: "#8fe3f0", r: "#e0484c", G: "#4fbf5f", y: "#f2cf4a",
    n: "#e8c38c", N: "#c99a5e", m: "#8f5f37", M: "#6b4428", p: "#7b62b8", P: "#a58fe0", s: "#dfe2ea",
  };
  function tuval(w, h, f) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); const r = (x, y, ww, hh, k) => { g.fillStyle = R[k] || k; g.fillRect(x, y, ww, hh); };
    f(r, g); return c;
  }
  const HALI_RENK = (window.OFIS_KISI && window.OFIS_KISI.tema && window.OFIS_KISI.tema.hali) || ["#7c8fb8", "#a9b8d8", "#56668f"];
  // Kenarlı kutu: dış çizgi + dolgu
  const kutu = (r, x, y, w, h, dolgu, kenar = "o") => { r(x, y, w, h, kenar); r(x + 1, y + 1, w - 2, h - 2, dolgu); };

  return {
    R,
    // Monitör ve dizüstünün ARKA görünümü: masada oturan kişi ekrana bakar, kameraya monitörün arkası döner.
    // C.monitorArka(w, h): üstte gövde, ortada küçük logo, altta boyun ve ayak (ön görünümlü atlas monitörüyle aynı boyut)
    monitorArka: (w, h) => tuval(w, h, (r) => {
      const g = h - 4;                                                   // gövde yüksekliği (altında boyun + ayak)
      r(0, 0, w, g, "#2e2b3a"); r(1, 1, w - 2, g - 2, "#505470");        // dış çizgi + gövde
      r(1, 1, w - 2, 1, "#6c7190");                                      // üst ışık çizgisi
      r(Math.floor(w / 2) - 1, Math.floor(g / 2) - 1, 3, 3, "#aab0cc");  // logo
      for (let x = 3; x < w - 3; x += 3) r(x, g - 3, 2, 1, "#3d4058");   // havalandırma
      r(Math.floor(w / 2) - 1, g, 3, 2, "#2e2b3a");                      // boyun
      r(Math.floor(w / 2) - 3, h - 2, 7, 2, "#2e2b3a");                  // ayak
    }),
    laptopArka: (w, h) => tuval(w, h, (r) => {
      r(0, 0, w, h - 3, "#2e2b3a"); r(1, 1, w - 2, h - 5, "#a9afc4"); r(1, 1, w - 2, 1, "#d2d6e4");   // kapak (gümüş)
      r(Math.floor(w / 2) - 1, Math.floor((h - 3) / 2) - 1, 3, 3, "#6c7190");                        // logo
      r(1, h - 3, w - 2, 3, "#3b3d4f");                                                              // menteşe/taban
    }),
    // Cozy halı: yumuşak köşeli, çift şeritli kenar + ortada küçük çiçek deseni. Zemin katmanında kullanılır.
    // C.hali(w, h, ana, acik, koyu) → ana renk, açık şerit, koyu kenar. Renk verilmezse kisi.json "tema.hali" (3 renk), o da yoksa sakin bir mavi-gri.
    hali: (w, h, ana = HALI_RENK[0], acik = HALI_RENK[1], koyu = HALI_RENK[2]) => tuval(w, h, (r) => {
      r(1, 0, w - 2, h, koyu); r(0, 1, w, h - 2, koyu);                       // dış kenar (köşeler yuvarlak)
      r(2, 1, w - 4, h - 2, acik); r(1, 2, w - 2, h - 4, acik);                // açık şerit
      r(3, 3, w - 6, h - 6, ana);                                              // ana renk
      for (let x = 4; x < w - 4; x += 4) { r(x, 4, 1, 1, acik); r(x + 2, h - 5, 1, 1, acik); }   // kenar noktaları
      const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
      r(cx - 1, cy - 2, 3, 5, acik); r(cx - 2, cy - 1, 5, 3, acik); r(cx, cy, 1, 1, koyu);        // ortadaki çiçek
    }),
    // Ofis masası: üst yüzey + ön panel + bölme paneli (arkada)
    masa: (w, bolme = true) => tuval(w, 30, (r) => {
      if (bolme) { kutu(r, 1, 0, w - 2, 9, "l"); r(2, 1, w - 4, 1, "w"); r(2, 7, w - 4, 1, "g"); }
      kutu(r, 0, 8, w, 13, "n"); r(1, 9, w - 2, 1, "#f3d6a6"); r(1, 19, w - 2, 1, "N");
      kutu(r, 0, 20, w, 8, "N"); r(1, 21, w - 2, 1, "m");
      for (const x of [3, w - 6]) r(x, 27, 3, 3, "d");
      r(w / 2 - 6, 22, 12, 4, "m"); r(w / 2 - 1, 23, 2, 1, "y");
    }),
    // Masanın arkasındaki bölme paneli (kişinin arkasında kalır)
    bolme: (w, h = 12) => tuval(w, h, (r) => { kutu(r, 0, 0, w, h, "l"); r(1, 1, w - 2, 1, "w"); r(1, 3, w - 2, h - 6, "#bfc3cf"); r(1, h - 2, w - 2, 1, "g"); }),
    // Yönetici masası: koyu ahşap, geniş
    yoneticiMasasi: (w) => tuval(w, 30, (r) => {
      kutu(r, 0, 4, w, 15, "m"); r(1, 5, w - 2, 1, "N"); r(1, 17, w - 2, 1, "M");
      kutu(r, 0, 18, w, 11, "M"); r(1, 19, w - 2, 1, "m");
      for (let x = 4; x < w - 8; x += 18) { kutu(r, x, 21, 12, 6, "m"); r(x + 5, 23, 2, 1, "y"); }
      r(2, 28, 4, 2, "k"); r(w - 6, 28, 4, 2, "k");
    }),
    monitor: () => tuval(16, 14, (r) => {
      kutu(r, 0, 0, 16, 11, "k"); r(1, 1, 14, 9, "K"); r(2, 2, 12, 7, "b"); r(3, 3, 5, 1, "B"); r(3, 5, 8, 1, "c"); r(3, 7, 6, 1, "B");
      r(7, 11, 2, 2, "d"); kutu(r, 4, 12, 8, 2, "g");
    }),
    ikiliMonitor: () => tuval(30, 14, (r) => {
      for (const x of [0, 15]) { kutu(r, x, 0, 15, 11, "k"); r(x + 1, 1, 13, 9, "K"); r(x + 2, 2, 11, 7, "b"); r(x + 3, 3, 6, 1, "c"); r(x + 3, 5, 8, 1, "B"); }
      r(14, 11, 2, 2, "d"); kutu(r, 9, 12, 12, 2, "g");
    }),
    laptop: () => tuval(14, 10, (r) => {
      kutu(r, 1, 0, 12, 7, "k"); r(2, 1, 10, 5, "B"); r(3, 2, 5, 1, "w");
      kutu(r, 0, 7, 14, 3, "l");
    }),
    klavye: () => tuval(12, 4, (r) => { kutu(r, 0, 0, 12, 4, "l"); for (let x = 2; x < 10; x += 2) r(x, 1, 1, 1, "g"), r(x + 1, 2, 1, 1, "g"); }),
    kupa: (renk = "w", icki = "m") => tuval(5, 5, (r) => { kutu(r, 0, 0, 4, 5, renk); r(1, 1, 2, 1, icki); r(4, 2, 1, 2, "o"); }),
    // Masa üstü küçükleri
    kalemlik: () => tuval(5, 7, (r) => { r(1, 0, 1, 3, "r"); r(2, 1, 1, 2, "b"); r(3, 0, 1, 3, "y"); kutu(r, 0, 3, 5, 4, "d"); r(1, 4, 3, 1, "g"); }),
    kitaplar: () => tuval(10, 6, (r) => { kutu(r, 0, 3, 10, 3, "b"); r(1, 4, 8, 1, "B"); kutu(r, 1, 0, 8, 3, "r"); r(2, 1, 6, 1, "y"); }),
    notDefteri: () => tuval(8, 5, (r) => { kutu(r, 0, 0, 8, 5, "w"); r(1, 1, 6, 1, "g"); r(1, 3, 5, 1, "g"); r(0, 0, 1, 5, "r"); }),
    yapiskan: () => tuval(5, 5, (r) => { r(0, 0, 5, 5, "y"); r(1, 1, 3, 1, "N"); r(1, 3, 2, 1, "N"); }),
    fare: () => tuval(4, 5, (r) => { kutu(r, 0, 0, 4, 5, "l"); r(1, 1, 2, 1, "g"); }),
    bardak: () => tuval(4, 6, (r) => { kutu(r, 0, 0, 4, 6, "c"); r(1, 3, 2, 2, "#c8f4fa"); }),
    kagitlar: () => tuval(10, 6, (r) => { kutu(r, 1, 0, 9, 5, "w"); kutu(r, 0, 1, 9, 5, "w"); r(2, 2, 5, 1, "g"); r(2, 4, 4, 1, "g"); }),
    telefon: () => tuval(9, 6, (r) => { kutu(r, 0, 1, 9, 5, "d"); kutu(r, 1, 0, 7, 2, "k"); r(2, 3, 5, 1, "g"); }),
    // Ofis koltuğu (önden)
    koltuk: (renk = "k") => tuval(14, 18, (r) => {
      kutu(r, 2, 0, 10, 9, renk); r(3, 1, 8, 1, "K");
      kutu(r, 0, 8, 14, 5, renk); r(1, 9, 12, 1, "K");
      r(6, 13, 2, 2, "d"); r(2, 15, 10, 1, "d"); r(1, 16, 2, 2, "o"); r(6, 16, 2, 2, "o"); r(11, 16, 2, 2, "o");
    }),
    yazici: () => tuval(22, 18, (r) => {
      kutu(r, 4, 0, 14, 4, "w"); r(6, 1, 10, 1, "g");
      kutu(r, 0, 3, 22, 11, "l"); r(1, 4, 20, 1, "w"); r(3, 7, 16, 2, "d"); r(16, 5, 3, 1, "G");
      kutu(r, 2, 13, 18, 5, "g");
    }),
    sebil: () => tuval(12, 30, (r) => {
      kutu(r, 2, 0, 8, 11, "c"); r(3, 1, 2, 8, "#c8f4fa"); r(2, 10, 8, 1, "o");
      kutu(r, 0, 11, 12, 19, "w"); r(1, 12, 10, 1, "l"); r(3, 15, 2, 2, "r"); r(7, 15, 2, 2, "b");
      kutu(r, 2, 19, 8, 4, "l"); r(1, 28, 10, 1, "g");
    }),
    // Sunucu dolabı; ışıklar canlı çizilir
    sunucu: () => tuval(18, 34, (r) => {
      kutu(r, 0, 0, 18, 34, "k");
      for (let y = 2; y < 31; y += 4) { kutu(r, 2, y, 14, 3, "K"); r(3, y + 1, 7, 1, "d"); }
      r(1, 32, 16, 1, "d");
    }),
    beyazTahta: (w = 48, h = 28) => tuval(w, h, (r) => {
      kutu(r, 0, 0, w, h - 3, "w"); r(1, 1, w - 2, 1, "s");
      r(5, 6, 14, 1, "b"); r(5, 9, 22, 1, "g"); r(5, 12, 18, 1, "g");
      r(w - 20, 15, 3, 6, "r"); r(w - 15, 11, 3, 10, "G"); r(w - 10, 8, 3, 13, "b");
      r(4, h - 3, w - 8, 2, "g"); r(8, h - 4, 4, 1, "r"); r(14, h - 4, 4, 1, "b");
    }),
    // Duvar ekranı çerçevesi; içerik canlı çizilir
    ekran: (w, h) => tuval(w, h, (r) => { kutu(r, 0, 0, w, h, "k"); r(1, 1, w - 2, h - 2, "#141a2a"); r(2, h - 2, w - 4, 1, "K"); }),
    kamera: () => tuval(16, 30, (r) => {
      kutu(r, 2, 0, 12, 8, "k"); r(3, 1, 4, 2, "d"); kutu(r, 0, 2, 4, 5, "K"); r(12, 2, 2, 1, "r");
      r(7, 8, 2, 14, "d"); r(3, 22, 2, 7, "d"); r(11, 22, 2, 7, "d"); r(7, 22, 2, 8, "d"); r(4, 21, 8, 2, "g");
    }),
    isik: () => tuval(16, 34, (r) => {
      kutu(r, 1, 0, 14, 11, "k"); r(3, 2, 10, 7, "w"); r(4, 3, 8, 5, "#fff6d8");
      r(7, 11, 2, 16, "d"); r(2, 27, 12, 2, "g"); r(1, 29, 3, 4, "d"); r(12, 29, 3, 4, "d"); r(7, 29, 2, 5, "d");
    }),
    sunucuMasasi: (w = 76) => tuval(w, 26, (r, g) => {
      kutu(r, 0, 4, w, 12, "w"); r(1, 5, w - 2, 1, "s");
      kutu(r, 4, 15, w - 8, 10, "l"); r(5, 16, w - 10, 1, "w"); r(w / 2 - 14, 18, 28, 4, "b"); r(w / 2 - 12, 19, 24, 1, "B");
    }),
    kahveMakinesi: () => tuval(14, 18, (r) => {
      kutu(r, 0, 0, 14, 18, "k"); r(2, 2, 10, 3, "d"); r(9, 3, 2, 1, "G"); kutu(r, 3, 7, 8, 7, "K"); kutu(r, 5, 10, 4, 4, "w"); r(1, 16, 12, 1, "d");
    }),
    tezgah: (w) => tuval(w, 28, (r) => {
      kutu(r, 0, 0, w, 7, "s"); r(1, 1, w - 2, 1, "w");
      kutu(r, 0, 6, w, 22, "w"); for (let x = 2; x < w - 10; x += 16) { kutu(r, x, 9, 14, 16, "s"); r(x + 6, 12, 3, 1, "g"); }
    }),
    toplantiMasasi: (w, h) => tuval(w, h, (r) => {
      kutu(r, 0, 0, w, h - 6, "n"); r(2, 2, w - 4, 1, "#f3d6a6"); r(4, 4, w - 8, h - 14, "#e4bb83");
      kutu(r, 0, h - 7, w, 6, "N"); r(4, h - 1, 3, 1, "d"); r(w - 7, h - 1, 3, 1, "d");
    }),
    kanepe: (w) => tuval(w, 24, (r) => {
      kutu(r, 0, 0, w, 12, "#5a6488"); r(2, 2, w - 4, 2, "#76809f");
      kutu(r, 0, 10, w, 11, "#4a5274"); for (let x = 3; x < w - 3; x += Math.floor((w - 6) / 3)) r(x, 12, 1, 7, "#3c4360");
      kutu(r, 0, 6, 5, 15, "#5a6488"); kutu(r, w - 5, 6, 5, 15, "#5a6488"); r(2, 21, 3, 3, "o"); r(w - 5, 21, 3, 3, "o");
    }),
    dosyaDolabi: () => tuval(16, 28, (r) => {
      kutu(r, 0, 0, 16, 28, "g"); for (let y = 2; y < 25; y += 8) { kutu(r, 2, y, 12, 7, "l"); r(6, y + 3, 4, 1, "d"); }
    }),
    copKutusu: () => tuval(8, 9, (r) => { kutu(r, 0, 0, 8, 9, "d"); r(1, 1, 6, 1, "g"); r(2, 3, 1, 5, "K"); r(5, 3, 1, 5, "K"); }),
    evrakKutusu: () => tuval(16, 10, (r) => {
      for (const [y, k] of [[0, "N"], [4, "N"]]) { kutu(r, 0, y, 16, 5, k); r(2, y + 1, 12, 2, "w"); }
      r(0, 9, 16, 1, "o");
    }),
    kapi: () => tuval(32, 30, (r) => {
      kutu(r, 0, 0, 32, 30, "d");
      for (const x of [2, 17]) { kutu(r, x, 2, 13, 28, "#9fb4c4"); r(x + 2, 4, 2, 20, "#d8e6ef"); r(x + (x < 10 ? 10 : 1), 14, 2, 4, "g"); }
    }),
    pencere: (w) => tuval(w, 20, (r) => {
      kutu(r, 0, 0, w, 20, "w");
      for (let x = 2; x < w - 4; x += 18) { kutu(r, x, 2, 16, 15, "#9fd2ee"); r(x + 3, 4, 2, 8, "#e3f4fc"); r(x + 7, 4, 1, 4, "#e3f4fc"); }
    }),
    saat: () => tuval(12, 12, (r) => { kutu(r, 2, 0, 8, 12, "w"); kutu(r, 0, 2, 12, 8, "w"); r(2, 2, 8, 8, "w"); r(5, 3, 1, 4, "o"); r(5, 6, 3, 1, "o"); }),
    klima: () => tuval(30, 10, (r) => { kutu(r, 0, 0, 30, 10, "w"); r(2, 6, 26, 1, "l"); r(2, 8, 26, 1, "g"); r(25, 2, 2, 1, "G"); }),
    yayinTabelasi: () => tuval(36, 12, (r) => { kutu(r, 0, 0, 36, 12, "k"); r(1, 1, 34, 10, "#2a1416"); }),
    // Giriş asansörü: duvara gömülü çerçeve (28x32); kapı kanatları ve ışık canlı çizilir (ofis.js > asansorCiz)
    asansor: () => tuval(28, 32, (r) => {
      kutu(r, 0, 0, 28, 32, "d"); r(1, 1, 26, 1, "g");
      kutu(r, 8, 1, 12, 5, "k"); r(10, 3, 8, 1, "#5a2a2c");
      kutu(r, 3, 7, 22, 25, "o"); r(26, 14, 1, 3, "y");
    }),
    // Girişin önündeki paspas
    paspas: () => tuval(28, 8, (r) => { kutu(r, 0, 0, 28, 8, "#4a5274"); r(1, 1, 26, 1, "#5a6488"); for (let x = 3; x < 26; x += 4) r(x, 3, 2, 3, "#3c4360"); }),
    // Sütlaç'ın mama kabı (boş / dolu)
    mamaKabi: (dolu) => tuval(12, 7, (r) => {
      kutu(r, 0, 2, 12, 5, "r"); r(1, 3, 10, 1, "#f28b8e"); r(5, 5, 2, 1, "w");
      if (dolu) { r(2, 1, 8, 2, "N"); r(3, 0, 2, 1, "m"); r(6, 0, 3, 1, "N"); r(4, 1, 1, 1, "m"); } else r(2, 2, 8, 1, "M");
    }),
    rafKitap: (w) => tuval(w, 40, (r) => {
      kutu(r, 0, 0, w, 40, "m");
      const renk = ["r", "b", "G", "y", "p", "N", "c", "w"];
      for (let y = 3; y < 36; y += 9) {
        r(2, y, w - 4, 8, "M");
        let x = 3, i = y;
        while (x < w - 5) { const bw = 2 + ((i * 7) % 3), bh = 5 + ((i * 3) % 3); r(x, y + 8 - bh, bw, bh, renk[i % renk.length]); r(x, y + 8 - bh, bw, 1, "o"); x += bw + 1; i += 5; }
        r(1, y + 8, w - 2, 1, "N");
      }
    }),
  };
})();
