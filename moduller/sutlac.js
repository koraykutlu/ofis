// Sütlaç: ofisin beyaz, kısa tüylü kedisi. Gezer, uyur, klavyeye çıkar, sevilir, mama kabına koşar.
// Kedinin verisi (window.OFIS_IC.kedi) ve mama kabı durumu (OFIS_IC.mama) çekirdekte kalır: çekirdek çizim sırası, kapılar, balonlar,
// etkileşim ve gün sonu sıfırlaması onları okur. Davranış buradadır. Kancalar: kediGuncelle(dt), kediCiz, kediSev, klavyedenIn(tesekkur),
// sutlacCagir, partiBasladi, canliCiz (mama kabı). Mama kabı E noktası basla'da OFIS_IC.NESNELER'e eklenir.
(() => {
  const I = () => window.OFIS_IC;
  const KISI = window.OFIS_KISI, OAD = KISI.ad, adEki = KISI.ek;   // kisi.js: ofis sahibine özel adlar
  const MAMA_KEDI = [7, 30];   // Sütlaç'ın mama kabı başındaki durağı
  const KEDI_RENK = { o: "#4f4a58", w: "#fffdf8", s: "#dcd6cf", p: "#f2a7b6", k: "#2b2838" };
  function pikselden(satirlar) {
    const c = document.createElement("canvas"); c.width = 16; c.height = satirlar.length;
    const x = c.getContext("2d");
    satirlar.forEach((s, y) => [...s].forEach((ch, i) => { if (KEDI_RENK[ch]) { x.fillStyle = KEDI_RENK[ch]; x.fillRect(i, y, 1, 1); } }));
    return c;
  }
  const KEDI_YURU_UST = [
    "................", "...........o..o.", "..........owoowo", "..........owwwwo", "o.........owkwko",
    "ow........owwpwo", ".ow..oooooowwwo.", "..oowwwwwwwwwwo.", "...owwwwwwwwwwo.", "...owwwwwwwwsso.", "...osswwwwwssso.",
  ];
  const KEDI_KARE = {
    yuru: [
      pikselden([...KEDI_YURU_UST, "....owwo..owwo..", "....oso....oso..", "................"]),
      pikselden([...KEDI_YURU_UST, ".....owo.owo....", ".....oso.oso....", "................"]),
    ],
    otur: [
      pikselden(["................", "....o.....o.....", "...opo...opo....", "...owwoooowwo...", "...owwwwwwwwo...", "...owkwwwwkwo...",
        "...owwwppwwwo...", "....owwwwwwo....", "....owwwwwwo..o.", "...owwswwswwo.ow", "...owwwwwwwwoow.", "...owwswwswwo...",
        "...osswwwwsso...", "....oooooooo...."]),
      pikselden(["................", "....o.....o.....", "...opo...opo....", "...owwoooowwo...", "...owwwwwwwwo...", "...owoowwoowo...",
        "...owwwppwwwo...", "....owwwwwwo....", "....owwwwwwo...o", "...owwswwswwo.ow", "...owwwwwwwwoow.", "...owwswwswwo...",
        "...osswwwwsso...", "....oooooooo...."]),
    ],
  };
  const MAMA_IMG = [window.CIZIM.mamaKabi(false), window.CIZIM.mamaKabi(true)];
  let kediYat = null;   // paketteki uzanmış kedi, beyazlatılmış (basla'da)
  // Paketteki uzanmış gri kediyi beyaza çevir (Sütlaç'ın dinlenme animasyonu)
  function beyazla(kaynak) {
    const c = document.createElement("canvas"); c.width = kaynak.width; c.height = kaynak.height;
    const x = c.getContext("2d"); x.drawImage(kaynak, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const r = p[i], gg = p[i + 1], b = p[i + 2], l = (r + gg + b) / 3;
      if (l < 85) { p[i] = 79; p[i + 1] = 74; p[i + 2] = 88; continue; }
      if (r > gg + 12 && r > b + 8) continue;   // yerdeki sıcak gölge
      const t = Math.max(0, Math.min(1, (l - 85) / 110));
      p[i] = 220 + 35 * t; p[i + 1] = 214 + 39 * t; p[i + 2] = 207 + 41 * t;
    }
    x.putImageData(d, 0, 0); return c;
  }

  // Gerçek saatte kedi saniye ölçeğinde yaşar ama klavyeye çıkma ve mama isteme seyrekleşir (yoksa günlük ve ses dolar)
  let klavyeBekle = 0, mamaBekle = 0;
  const KEDI_YERLERI = [[42, 18], [22, 7], [38, 5], [45, 26], [6, 27], [31, 9], [14, 28]];
  function kediGit(h, sonraFn, hiz = 2.2) { const { kedi } = I(); kedi.yol = I().yolBul([kedi.x, kedi.y], h); kedi.sonra = sonraFn || null; kedi.hiz = hiz; kedi.durum = "gez"; kedi.ust = null; }
  function rastgeleKaro(menzil) {
    const { kedi, yurur, koltuklar } = I();
    for (let i = 0; i < 30; i++) {
      const x = Math.round(kedi.x + (Math.random() * 2 - 1) * menzil), y = Math.round(kedi.y + (Math.random() * 2 - 1) * menzil);
      if (yurur[y] && yurur[y][x] && !koltuklar.has(`${x},${y}`)) return [x, y];
    }
    return null;
  }
  const otur = (sure) => () => { const { kedi } = I(); kedi.durum = "otur"; kedi.sure = sure; };
  function kediKarar() {
    const ic = I(), { kedi, oyuncu, zaman, sesKonum } = ic, r = Math.random();
    if (ic.mama.dolu) return kediMamayaGit();
    if (!ic.stat.mama && zaman > 6 && r < 0.2 && zaman >= mamaBekle) return kediGit(MAMA_KEDI, () => {
      mamaBekle = I().zaman + ic.rs(0, 600 + Math.random() * 600);   // gerçek saatte 10-20 dk'da bir
      kedi.bakis = 1; otur(3)(); kedi.balon = ic.rastgele(["Miyav! (mama kabı boş)", "Mrr? (mama vakti mi?)"]); kedi.balonSon = I().zaman + 3.5; sesKonum("miyav", kedi.x, kedi.y); }, 3);
    if (zaman < kedi.takipSon && oyuncu) return kediGit(ic.yanKaro(oyuncu), otur(0.6), 4);
    if ((ic.gecelik() > 0.3 || zaman < ic.efekt.parti) && r < 0.45) { const k = rastgeleKaro(10); if (k) return kediGit(k, otur(0.4), 7); }
    if (r < 0.36) { const k = rastgeleKaro(7); if (k) return kediGit(k, otur(2 + Math.random() * 3)); }
    if (r < 0.56) { kedi.durum = "otur"; kedi.sure = 3 + Math.random() * 4; return; }
    if (r < 0.78) return kediGit(ic.enYakinYurur(...ic.rastgele(KEDI_YERLERI)), () => { kedi.durum = "yat"; kedi.sure = 10 + Math.random() * 10; });
    if (r < 0.92 && zaman >= klavyeBekle) return klavyeyeCik();
    if (r < 0.92) { kedi.durum = "otur"; kedi.sure = 3 + Math.random() * 4; return; }
    if (oyuncu) kediGit(ic.yanKaro(oyuncu), () => {
      otur(3)(); kedi.bakis = oyuncu.x >= kedi.x ? 1 : -1;
      if (Math.hypot(kedi.x - oyuncu.x, kedi.y - oyuncu.y) < 1.8) { sesKonum("mirr", kedi.x, kedi.y); ic.kalpler(kedi, 2); }
    });
  }
  function klavyeyeCik() {
    const ic = I(), { kedi, T } = ic;
    const adaylar = ic.ajanlar.filter((a) => !a.oyuncu && ic.yerinde(a) && !a.konusuyor && ic.monitorler.some((m) => m.sahip === a.id));
    if (!adaylar.length) { kedi.durum = "otur"; kedi.sure = 2; return; }
    const a = ic.MOD("kediFavori", adaylar) || ic.rastgele(adaylar);
    kediGit([a.koltuk[0], a.koltuk[1] + 2], () => {
      if (!ic.yerinde(a)) { otur(1)(); return; }
      kedi.durum = "klavye"; kedi.ust = { px: a.koltuk[0] * T, py: a.koltuk[1] * T + 6, sira: a.koltuk[1] * T + 40 };
      kedi.klavyeAjan = a; kedi.sure = 9; ic.sesKonum("miyav", kedi.x, kedi.y);
      klavyeBekle = ic.zaman + ic.rs(0, 1200 + Math.random() * 1800);   // gerçek saatte 20-50 dk'da bir
      ic.sonra(1, () => ic.konus(a, ic.rastgele(["Sütlaç! Rapor 4000 sayfa 'fffff' oldu.", "Sütlaç, o klavye senin değil.", "Biri Sütlaç'ı alsın, toplantım var.", "Kedi klavyede. Haber yarın çıkar."])));
    });
  }
  function klavyedenIn(tesekkur) {
    const ic = I(), { kedi } = ic, a = kedi.klavyeAjan;
    kedi.ust = null; kedi.klavyeAjan = null; otur(2)();
    if (tesekkur && a) ic.sonra(0.4, () => ic.konus(a, `Sağ ol ${OAD}! Rapor kurtuldu.`));
  }
  function kediGuncelle(dt) {
    const ic = I(), { kedi, oyuncu, zaman, T } = ic;
    kedi.kare += dt;
    if (kedi.yol.length) {
      const [hx, hy] = kedi.yol[0], dx = hx - kedi.x, dy = hy - kedi.y, m = Math.hypot(dx, dy), v = kedi.hiz * dt;
      if (Math.abs(dx) > 0.01) kedi.bakis = dx > 0 ? 1 : -1;
      if (m <= v) { kedi.x = hx; kedi.y = hy; kedi.yol.shift(); if (!kedi.yol.length && kedi.sonra) { const fn = kedi.sonra; kedi.sonra = null; fn(); } }
      else { kedi.x += (dx / m) * v; kedi.y += (dy / m) * v; }
      return;
    }
    if (kedi.durum === "yat" && zaman - kedi.sonZ > 1.6) { kedi.sonZ = zaman; ic.parcacik({ x: kedi.x * T + 12, y: kedi.y * T, vx: 6, vy: -10, omur: 1.6, tip: "z" }); }
    if (oyuncu && kedi.durum !== "gez" && Math.hypot(kedi.x - oyuncu.x, kedi.y - oyuncu.y) < 1.4 && Math.random() < dt * 0.15) ic.sesKonum("mirr", kedi.x, kedi.y);
    kedi.sure -= dt;
    if (kedi.sure <= 0) { if (kedi.durum === "klavye") klavyedenIn(false); if (kedi.durum === "ye") yemeBitti(); kediKarar(); }
  }
  function kediSev() {
    const ic = I(), { kedi, oyuncu, zaman, sesKonum } = ic;
    if (kedi.durum === "klavye") { klavyedenIn(true); kedi.balon = "Miyav… (indirildi)"; kedi.balonSon = zaman + 3; sesKonum("miyav", kedi.x, kedi.y); return; }
    kedi.yol = []; kedi.sonra = null; otur(4)(); kedi.bakis = oyuncu.x >= kedi.x ? 1 : -1;
    kedi.sev++; ic.stat.sev++; ic.kalpler(kedi, 4); sesKonum(kedi.sev % 2 ? "mirr" : "miyav", kedi.x, kedi.y);
    kedi.balon = ic.rastgele(["Mrrr ♥", "Miyav!", "Prrr…", "Mrr? (mama var mı?)"]); kedi.balonSon = zaman + 3;
    ic.gunluk(`${OAD}, Sütlaç'ı sevdi (${kedi.sev}).`, true);
    if (kedi.sev % 5 === 0) { kedi.takipSon = zaman + 30; kedi.balon = "Sütlaç artık seni takip ediyor."; kedi.balonSon = zaman + 4; }
  }
  function kediCiz() {
    const { kedi, f, T } = I();
    let c, px, py;
    if (kedi.durum === "klavye" && kedi.ust) { c = KEDI_KARE.otur[0]; px = kedi.ust.px; py = kedi.ust.py; }
    else if (kedi.yol.length) { c = KEDI_KARE.yuru[Math.floor(kedi.kare * (kedi.hiz > 4 ? 14 : 8)) % 2]; px = Math.round(kedi.x * T); py = Math.round(kedi.y * T + 16 - c.height); }
    else if (kedi.durum === "yat") {
      // Sayfa 36 parça ama 12 kare x 3: her karenin ortadaki parçası (indeks 1) kedi; diğer ikisi kenar süsü. Hepsini döndürmek kediyi gidip getiriyordu.
      const kr = (Math.floor(kedi.kare * 5) % 12) * 3 + 1; px = Math.round(kedi.x * T); py = Math.round(kedi.y * T);
      f.fillStyle = "rgba(20,16,30,.2)"; f.beginPath(); f.ellipse(px + 8, py + 15, 7, 2, 0, 0, 7); f.fill();
      f.save(); if (kedi.bakis < 0) { f.translate(px * 2 + 16, 0); f.scale(-1, 1); }
      f.drawImage(kediYat, kr * 16, 0, 16, 16, px, py, 16, 16); f.restore(); return;
    } else { c = KEDI_KARE.otur[Math.floor(kedi.kare) % 4 === 0 ? 1 : 0]; px = Math.round(kedi.x * T); py = Math.round(kedi.y * T + 16 - c.height) + (kedi.durum === "ye" ? Math.round(Math.abs(Math.sin(kedi.kare * 9)) * 2) : 0); }
    if (!kedi.ust) { f.fillStyle = "rgba(20,16,30,.2)"; f.beginPath(); f.ellipse(px + 8, py + c.height - 1, 6, 2, 0, 0, 7); f.fill(); }
    f.save(); if (kedi.bakis < 0) { f.translate(px * 2 + 16, 0); f.scale(-1, 1); }
    f.drawImage(c, px, py); f.restore();
  }
  // Oyuncu klavyeye "sütlaç" yazınca koşarak gelir
  function sutlacCagir() {
    const ic = I(), { kedi, oyuncu, sesKonum } = ic;
    ic.gunluk(`${OAD} 'Sütlaç' yazdı. Biri koşarak geliyor…`); sesKonum("miyav", kedi.x, kedi.y);
    kediGit(ic.yanKaro(oyuncu), () => { otur(4)(); kedi.bakis = oyuncu.x >= kedi.x ? 1 : -1; ic.kalpler(kedi, 5); sesKonum("mirr", kedi.x, kedi.y); kedi.balon = "Miyaaav! (çağırdın mı?)"; kedi.balonSon = I().zaman + 3; }, 8);
  }

  // ---------- mama kabı ----------
  function mamaVer() {
    const ic = I(), { kedi, oyuncu, mama } = ic;
    if (mama.dolu) { ic.konus(oyuncu, "Kap dolu, Sütlaç yoldadır.", true); return; }
    if (ic.stat.mama && ic.zaman < mama.sonYeme + 25) { ic.konus(oyuncu, "Sütlaç az önce yedi, karnı tok.", true); return; }
    mama.dolu = true; ic.ses("tak"); ic.konus(oyuncu, "Mama kabı dolu. Sütlaaaç!", true); ic.sesKonum("miyav", kedi.x, kedi.y);
    kediMamayaGit();
  }
  function kediMamayaGit() {
    const { kedi } = I();
    if (kedi.durum === "klavye") klavyedenIn(false);
    kediGit(MAMA_KEDI, () => {
      const ic = I();
      kedi.bakis = 1;
      if (ic.mama.dolu) { kedi.durum = "ye"; kedi.sure = 3.4; ic.sesKonum("mirr", kedi.x, kedi.y); } else otur(2)();
    }, 5.5);
  }
  function yemeBitti() {
    const ic = I(), { kedi, mama } = ic;
    if (!mama.dolu) return;
    mama.dolu = false; mama.sonYeme = ic.zaman; ic.stat.mama = true; ic.kalpler(kedi, 4); ic.sesKonum("mirr", kedi.x, kedi.y);
    kedi.balon = "Mrrr ♥ Karnım doydu."; kedi.balonSon = ic.zaman + 3; ic.gunluk("Sütlaç mamasını yedi."); ic.gorevBitir("mama");
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() {
      const ic = I();
      kediYat = beyazla(ic.img.kediYat);
      ic.NESNELER.push({ x: 8, y: 30, r: 1.7, etiket: () => (I().mama.dolu ? "Sütlaç yolda…" : "Sütlaç'ı besle"), fn: mamaVer });
    },
    bastan() { klavyeBekle = 0; mamaBekle = 0; },
    kediGuncelle, kediCiz, kediSev, klavyedenIn, sutlacCagir,
    partiBasladi() { const { kedi } = I(); kediGit(rastgeleKaro(8) || [Math.round(kedi.x), Math.round(kedi.y)], otur(0.3), 7); },   // kedi de koşturur
    canliCiz() { const { f, mama } = I(); f.drawImage(MAMA_IMG[mama.dolu ? 1 : 0], 130, 485); },
    test: { klavye: () => klavyeyeCik(), sutlac: () => sutlacCagir() },
  });
})();
