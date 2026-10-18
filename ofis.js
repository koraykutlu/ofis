// Yönetim Ofisi: LimeZu (ücretsiz) + kodla çizilmiş ofis eşyaları, A* yol bulma, katmanlı çizim, sentez sesler.
(() => {
  const YT = () => window.OFIS_YAZI_TIPI || "'Pixelify Sans', system-ui, sans-serif";   // seçili yazı tipi (Ayarlar > Yazı tipi; moduller/ayarlar.js)
  const T = 16, GEN = 48, YUK = 32, W = GEN * T, H = YUK * T, S = 2;
  // Gün süresi (sn) ve kapsadığı dakika. Hızlı gün (test, video): 120 / 240 / 360 sn = 08:00 → 02:00 (1080 dk), sonunda otomatik kapanır.
  // Gerçek saat (varsayılan): 86400 sn = açılış saati → ertesi açılış (1440 dk); zaman bilgisayarın saatini izler. Gün ACILIS'ta (dk, 08:00 = 480) başlar.
  let DONGU = 240, GUN_DK = 1080, GERCEK = false, saatOfset = 0;   // saatOfset (ms): test için gerçek saati kaydırır
  let ACILIS = 480, OTO_KAPAT = 4;   // ofis açılış saati (dk) ve yedek otomatik kapanış saati (gece yarısından sonra; 0 = kapalı), ayarlar modülünden
  const KOK = "varliklar/limezu-free/Modern tiles_Free/";
  const C = window.CIZIM, V = window.DEMO, SES = window.SES, A = window.ATLAS;
  const KISI = window.OFIS_KISI, OAD = KISI.ad, adEki = KISI.ek;   // kisi.js: ofis sahibine özel adlar (kodda kişi adı yok)
  const TV = KISI.tv || {};   // kisi.json "tv": TV bandı ve tabela yazıları (varsayılan: haber ofisi)
  const KG = "varliklar/limezu-tam/2_Characters/Character_Generator/";

  const cv = document.getElementById("c"); cv.width = W * S; cv.height = H * S;
  let yo = 1, yaziK = 1; // yazı ölçeği = ekran piksel yoğunluğu × ayarlardaki yazı boyutu çarpanı
  let kaliteTavan = 1.5;   // tuval çözünürlük çarpanı üst sınırı (Ayarlar > Görüntü kalitesi: yüksek 1.5, dengeli 1, hızlı 0.75)
  function boyutla() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, d = Math.min(kaliteTavan, dpr);   // yüksek DPI ekranda tuval piksel sayısı sınırlı (akıcılık)
    const yIsle = d < dpr ? "pixelated" : ""; if (cv.style.imageRendering !== yIsle) cv.style.imageRendering = yIsle;   // düşük çözünürlükte büyütme keskin piksel olsun
    const w = Math.max(320, Math.round(r.width * d)), h = Math.max(200, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    yo = Math.max(d < 1 ? 0.75 : 1, d) * yaziK;
  }
  const tamO = () => Math.min(cv.width / W, cv.height / H);
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
  const kare = document.createElement("canvas"); kare.width = W; kare.height = H;
  const f = kare.getContext("2d"); f.imageSmoothingEnabled = false;
  const statik = document.createElement("canvas"); statik.width = W; statik.height = H;
  const st = statik.getContext("2d"); st.imageSmoothingEnabled = false;

  // ---------- paket nesneleri (Interiors_free_16x16.png içindeki kutular) ----------
  const PK = {
    hali2: [114, 244, 60, 40], hali1: [212, 178, 40, 60], haliMavi: [211, 334, 24, 18], haliBej: [3, 674, 43, 28], haliYesil: [163, 451, 26, 28],
    buzdolabi: [32, 296, 64, 32], tabloGunes: [130, 330, 28, 13], tabloOrman: [165, 346, 21, 13], tabloCimen: [130, 362, 28, 13],
    tabloKedi: [38, 394, 21, 14], akvaryum: [6, 362, 21, 14], pencereGenis: [13, 423, 38, 25], pencereUzun: [0, 455, 64, 25],
    kure: [209, 577, 13, 21], renkPano: [208, 616, 31, 21], karaTahta: [210, 647, 28, 23], bitkiBuyuk: [167, 713, 18, 31],
    palmiye: [213, 704, 23, 31], bitkiKucuk: [193, 722, 14, 23], bitkiMini: [2, 790, 12, 14], lambaUzun: [193, 904, 13, 33],
    dunyaHaritasi: [160, 1065, 32, 19], kure2: [193, 1057, 13, 21], kitaplik: [160, 1094, 96, 34], dolap: [114, 820, 27, 39],
  };

  // ---------- odalar ----------
  // duvar: Room_Builder sütun 1'deki duvar yüzü satırı; zemin: 3x2 karo bloğunun sol üstü. rb "f": ücretsiz set, yoksa ofis seti
  // Harita (Tiled): harita/ofis.tmj → araclar/harita_yap.py → harita.js (window.HARITA). Odalar, kapılar, sabit noktalar ve mobilya oradan gelir.
  const HR = window.HARITA;
  const ODALAR = HR.odalar, KAPILAR = HR.kapilar;
  const KAHVE = HR.noktalar.kahve, YAZICI = HR.noktalar.yazici, OYUNCU_BAS = HR.noktalar.oyuncu;
  const RT = V.rutin, GIRIS = RT.giris;   // giriş asansörünün önü
  // Her karonun odası; odalar arası geçiş yalnız kapıdan, dikey adımla
  const odaNo = Array.from({ length: YUK }, (_, y) => Array.from({ length: GEN }, (_, x) =>
    ODALAR.findIndex((o) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h)));
  function gecebilir(x, y, nx, ny) {
    if (!yurur[ny] || !yurur[ny][nx]) return false;
    if (odaNo[y][x] === odaNo[ny][nx]) return true;
    if (x !== nx) return false;
    const sinir = Math.max(y, ny);
    return KAPILAR.some(([kx, ky]) => ky === sinir && (nx === kx || nx === kx + 1));
  }

  // ---------- yürünebilirlik ----------
  const yurur = Array.from({ length: YUK }, () => Array(GEN).fill(false));
  function yurunurKur() {   // oda zeminleri (ilk iki satır duvar) ve kapı boşlukları; eşyalar ekle() ile sonradan engel olur
    for (const r of yurur) r.fill(false);
    for (const o of ODALAR) for (let y = o.y + 2; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) yurur[y][x] = true;
    for (const [x, y] of KAPILAR) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) yurur[y + dy][x + dx] = true;
  }
  yurunurKur();

  // ---------- nesneler ----------
  const nesneler = [];   // karakterlerle birlikte sıralı çizilenler
  const zeminler = [];   // halılar ve duvar eşyaları: statik katman
  const ekranlar = [];   // canlı içerikli ekranlar
  const sunucular = [];
  const monitorler = []; // ekran alanı + sahibi
  const kapilar = [];    // sürgülü cam kapılar (canlı çizilir)
  const lambalar = [];   // masa ve boy lambaları: akşam ışık konisi çıkar
  const img = {};
  // Düzenle modunun kataloğu (katalog.js, araclar/katalog_yap.py): "kat:<kategori>/<no>" → varliklar/katalog/<kategori>.png içindeki kutu
  const KAT = window.KATALOG || { kategoriler: [], ogeler: {} }, katKutu = new Map();
  function katBul(k) {
    if (!katKutu.size) for (const [id, l] of Object.entries(KAT.ogeler)) for (const [no, x, y, w, h] of l) katKutu.set(`kat:${id}/${no}`, [x, y, w, h]);
    return katKutu.get(k);
  }
  const katId = (k) => k.slice(4).split("/")[0];
  // Sözlük bakışları yalnız kendi anahtarlarına bakar: kullanıcı/ziyaret düzeninden gelen "constructor", "__proto__" gibi adlar prototipten işlev döndürüp çizimi bozmasın
  const sahip = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function katYukle(id) {   // kategori sayfası bir kez yüklenir
    if (!img.kat[id]) img.kat[id] = yukle(`varliklar/katalog/${id}.png`).then((i) => (img.kat[id] = i));
    return Promise.resolve(img.kat[id]);
  }
  const spr = (k) => (typeof k !== "string" ? { kaynak: k, kutu: [0, 0, k.width, k.height] } : k.startsWith("kat:") ? { kaynak: img.kat[katId(k)], kutu: katBul(k) }
    : sahip(A, k) ? { kaynak: img.atlas, kutu: A[k] } : sahip(PK, k) ? { kaynak: img.ic, kutu: PK[k] } : { kaynak: null, kutu: null });

  function ekle(k, x, y, ops = {}) {
    const s = spr(k), n = { ...s, x, y, w: s.kutu[2], h: s.kutu[3], ...ops };
    n.sira = ops.sira ?? y + n.h;
    if (ops.golge) golgeEkle(n);
    if (typeof k === "string" && k.startsWith("lamba")) lambalar.push(n);
    if (ops.duvar || ops.zemin) zeminler.push(n);
    else {
      nesneler.push(n);
      if (ops.engel !== false) {
        const y0 = Math.floor((y + n.h - 10) / T), y1 = Math.floor((y + n.h - 3) / T);
        const x0 = Math.floor((x + 3) / T), x1 = Math.floor((x + n.w - 4) / T);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (yurur[ty]) yurur[ty][tx] = false;
      }
    }
    return n;
  }
  // Paketin gölgeli sürümü olmayan nesnelere (ücretsiz set, kodla çizilenler) aynı biçimde gölge: siluet sağ-alta 2 px kayar,
  // yalnız alt kısmı kalır; nesne üstüne çizildiğinden zeminde sağ şerit + alt şerit görünür (Black_Shadow setindeki gibi)
  function golgeEkle(n) {
    const [sx, sy, w, h] = n.kutu, alt = Math.max(6, Math.round(h * 0.35)), c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.drawImage(n.kaynak, sx, sy, w, h, 0, 0, w, h);
    x.globalCompositeOperation = "source-in"; x.fillStyle = "rgba(0,0,0,.34)"; x.fillRect(0, 0, w, h); x.clearRect(0, 0, w, h - alt);
    zeminler.push({ kaynak: c, kutu: [0, 0, w, h], x: n.x + 2, y: n.y + 2, w, h, golgeK: true });
  }
  const koltuklar = new Set();
  // Alt kenarı verilen y'ye oturacak biçimde yerleştir
  const koy = (k, x, alt, ops = {}) => ekle(k, x, alt - (A[k] || PK[k])[3], ops);
  // Ofis paketinin sol + orta×n + sağ masa parçalarından tek masa
  function parcaBirlestir(adlar) {
    const kutular = adlar.map((k) => A[k]), w = kutular.reduce((t, k) => t + k[2], 0), h = Math.max(...kutular.map((k) => k[3]));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); let px = 0;
    for (const k of kutular) { x.drawImage(img.atlas, k[0], k[1], k[2], k[3], px, h - k[3], k[2], k[3]); px += k[2]; }
    return c;
  }
  const masaKur = (tur, n) => parcaBirlestir([`masa${tur}Sol`, ...Array(n).fill(`masa${tur}Orta`), `masa${tur}Sag`]);
  // Masa üstü karışımı masanın karosundan türer: her açılışta aynı, masadan masaya farklı
  const tohum = (tx, ty, k) => { let h = Math.imul(tx + 1, 73856093) ^ Math.imul(ty + 1, 19349663) ^ Math.imul(k + 1, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sec = (liste, tx, ty, k) => liste[Math.floor(tohum(tx, ty, k) * liste.length)];
  function calismaMasasi(tx, ty, ops = {}) {
    const m = masaKur(ops.tur || "", ops.genis ? 2 : 1), w = m.width, x = Math.round(tx * T + 8 - w / 2), y = ty * T + 10;
    ekle(C.bolme(w + 6, 20), x - 3, ty * T - 8, { engel: false });
    koy(ops.koltuk || "koltukOn", tx * T, ty * T + 12, { engel: false });
    const masa = ekle(m, x, y), ust = masa.sira + 1;
    const mon = ops.ikili ? "ikiliMonitor" : "monitor", mk = A[mon];
    const mx = Math.round(tx * T + 8 - mk[2] / 2) + (ops.ikili ? 0 : -4);
    // Çalışan masanın arkasında (kameraya bakarak) oturur: monitör ona dönük olduğundan kameraya ARKASI görünür; klavye monitörün arkasında kalır
    ekle(C.monitorArka(mk[2], mk[3]), mx, y - 7, { engel: false, sira: ust });
    monitorler.push({ x: mx + 3, y: y - 5, w: mk[2] - 6, h: 6, sahip: ops.sahip });
    // sağ uç: ops verdiyse laptop/telefon, yoksa karo'ya göre kâğıt, fotoğraf, lamba ya da telefon
    const yan = ops.laptop ? "laptop" : ops.telefon ? "telefon" : sec(["kagit", "kagitDestesi", "foto1", "foto2", "foto3", "fotoAyakli", "lamba", "lamba2", "lamba3", "telefon2", "kutuGri"], tx, ty, 1);
    const yanY = yan === "laptop" ? -8 : yan === "kagit" || yan === "telefon" ? 0 : 10 - A[yan][3];   // alt kenar masa yüzeyine oturur
    ekle(yan === "laptop" ? C.laptopArka(A.laptop[2], A.laptop[3]) : yan, x + w - A[yan][2] - 2, y + yanY, { engel: false, sira: ust });
    // sol uç: bitki, kupa, kalemlik, kitap ya da kupa + kalemlik
    const sol = ops.bitki ? "bitki" : sec(["kupa", "kupa2", "kalemlik", "kitap", "bitki", "kupa+kalemlik", "bardak"], tx, ty, 2);
    const mini = (k, dx, dy) => ekle(k, x + dx, y + dy, { engel: false, sira: ust });
    if (sol === "bitki") mini("bitkiMini", 2, -9);
    else if (sol === "kalemlik") mini(C.kalemlik(), 3, 2);
    else if (sol === "kitap") mini(C.kitaplar(), 2, 3);
    else if (sol === "bardak") mini(C.bardak(), 4, 3);
    else if (sol === "kupa+kalemlik") { mini(C.kalemlik(), 2, 1); mini(C.kupa("#e87a7a", "m"), 8, 5); }
    else mini(sol === "kupa2" ? C.kupa("#7ab8e8", "o") : C.kupa(), 4, 5);
    // klavyenin yanı: not defteri, yapışkan not ya da fare (bazı masalar boş kalır)
    const on = sec(["", "notDefteri", "yapiskan", "fare", "", "notDefteri"], tx, ty, 3);
    if (on) ekle(C[on](), tx * T + 14 + (on === "fare" ? 1 : 0), y + 9, { engel: false, sira: ust });
    koltuklar.add(`${tx},${ty}`);
  }

  // Mobilya kaynağı: atlas/ücretsiz set adı, "hk.<ad>", "C.<ad>(arg)", "birlesik:a,b", "masaKur:<tür>,<n>" (araclar/harita_yap.py)
  function kaynak(k) {
    if (k.startsWith("kat:")) return k;
    if (k.startsWith("hk.")) return sahip(img.hk, k.slice(3)) ? img.hk[k.slice(3)] : undefined;
    const c = /^C\.(\w+)\((.*)\)$/.exec(k); if (c) return sahip(C, c[1]) && typeof C[c[1]] === "function" ? C[c[1]](...JSON.parse(`[${c[2]}]`)) : undefined;
    if (k.startsWith("birlesik:")) { const adlar = k.slice(9).split(","); return adlar.every((a) => sahip(A, a)) ? parcaBirlestir(adlar) : undefined; }
    if (k.startsWith("masaKur:")) { const [t, n] = k.slice(8).split(","); return sahip(A, `masa${t}Sol`) && sahip(A, `masa${t}Orta`) && sahip(A, `masa${t}Sag`) && n >= 1 && n <= 6 ? masaKur(t, +n) : undefined; }
    return k;
  }
  // Veride işlev olamayacağı için hareketli nesnelerin davranışı adla bağlanır
  const DAVRANIS = {
    guguk: (ops) => { ops.anim.kare = () => (dakika() % 60 < 5 ? Math.floor(zaman * 8) % 10 : 0); },
    akvaryum: (ops) => { ops.anim.hiz = () => (zaman < efekt.balik ? 16 : 5); },
  };
  // Kullanıcı düzeni (Düzenle modu, moduller/duzenle.js): temel haritadan kaldırılanların imzası ve eklenen eşyalar.
  // Boşken yerleşim temel haritayla birebir aynıdır (yerlesimOzet). katman: esya (engel), ust (masa üstü, engelsiz), hali (zemin), duvar.
  let duzen = { eklenen: [], silinen: [] };
  const mobilyaImza = (m) => `${m.k}@${m.x},${m.y}`;
  const KATMANLAR = ["esya", "ust", "hali", "duvar"];
  function duzenTemizle(d) {   // diskten/tarayıcıdan gelen düzen veri olarak denetlenir
    const sayi = (v) => typeof v === "number" && Number.isFinite(v);
    const ek = Array.isArray(d && d.eklenen) ? d.eklenen.filter((e) => e && typeof e.k === "string" && e.k.length <= 160 && sayi(e.x) && sayi(e.y)
      && e.x > -64 && e.x < W && e.y > -64 && e.y < H && KATMANLAR.includes(e.katman)).map((e) => ({ k: e.k, x: Math.round(e.x), y: Math.round(e.y), katman: e.katman })) : [];
    const sil = Array.isArray(d && d.silinen) ? d.silinen.filter((s) => typeof s === "string" && s.length <= 200) : [];
    return { eklenen: ek.slice(0, 2000), silinen: [...new Set(sil)].slice(0, 500) };
  }
  function kullaniciEsyasi(e, i) {
    if (e.k.startsWith("kat:") && !(img.kat[katId(e.k)] instanceof Image)) return;   // sayfası yüklenmemiş kategori
    const k = kaynak(e.k); if (!k) return;
    const s = spr(k); if (!s.kaynak || !s.kutu || !(s.kutu[2] > 0 && s.kutu[3] > 0)) return;
    const ops = e.katman === "hali" ? { zemin: true } : e.katman === "duvar" ? { duvar: true } : e.katman === "ust" ? { engel: false } : {};
    if (e.katman === "ust") {   // masa üstü: altındaki eşyanın hemen üstünde çizilir
      const bx = e.x + s.kutu[2] / 2, by = e.y + s.kutu[3] - 1;
      const alt = nesneler.filter((n) => bx >= n.x && bx < n.x + n.w && by >= n.y && by < n.y + n.h).sort((p, q) => q.sira - p.sira)[0];
      if (alt) ops.sira = alt.sira + 1;
    }
    ekle(k, e.x, e.y, ops).kullanici = i + 1;   // 1 tabanlı: 0 yanlış sayılmasın
  }
  function yerlesim() {
    for (const [x, y] of KAPILAR) kapilar.push({ kx: x, ky: y, x: x * T, y: y * T + 1, acik: 0, sesli: false });
    const olusan = [], sil = new Set(duzen.silinen);
    HR.mobilya.forEach((m, i) => {
      if (m.t === "masa") { calismaMasasi(m.x, m.y, { ...(m.ops || {}) }); olusan.push(null); return; }
      if (sil.has(mobilyaImza(m))) { olusan.push(null); return; }
      const ops = JSON.parse(JSON.stringify(m.ops || {}));
      if (m.davranis && DAVRANIS[m.davranis]) DAVRANIS[m.davranis](ops);
      if (m.ustune != null && olusan[m.ustune]) ops.sira = olusan[m.ustune].sira + (m.siraArti || 1);
      const n = ekle(kaynak(m.k), m.x, m.y, ops); n.taban = i + 1;   // 1 tabanlı temel harita sırası (Düzenle modu)
      if (m.liste) { const [ad, tur] = m.liste.split(":"); if (ad === "ekranlar") ekranlar.push({ tur, n }); else if (ad === "sunucular") sunucular.push(n); }
      if (m.monitor) monitorler.push({ ...m.monitor });
      if (m.koltuk) koltuklar.add(m.koltuk);
      olusan.push(n);
    });
    duzen.eklenen.forEach((e, i) => { try { kullaniciEsyasi(e, i); } catch (err) { /* bozuk kayıt atlanır */ } });
    for (const k of koltuklar) { const [x, y] = k.split(",").map(Number); yurur[y][x] = true; }
    for (const p of [KAHVE, YAZICI]) yurur[p[1]][p[0]] = true;
  }

  // Düzen değişince her şey veriden yeniden kurulur (yürünebilirlik, statik katman, oturakların yaklaşma noktaları); modüller yerlesimYenilendi'yi duyar
  function yerlesimYenile() {
    for (const l of [nesneler, zeminler, ekranlar, sunucular, monitorler, kapilar, lambalar]) l.length = 0;
    koltuklar.clear(); yurunurKur(); yerlesim(); statikCiz(); oturaklariKur(true); MOD("yerlesimYenilendi");
  }
  // Düzen geçerli mi: girişten her masaya, oturağa, kahve makinesine, yazıcıya, mama kabına ve kapılara yol kalmalı. Ulaşılamayanların adları döner.
  function erisimDenetle() {
    const gor = Array.from({ length: YUK }, () => Array(GEN).fill(false)), kuyruk = [GIRIS]; gor[GIRIS[1]][GIRIS[0]] = true;
    while (kuyruk.length) {
      const [x, y] = kuyruk.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GEN || ny >= YUK || gor[ny][nx] || !gecebilir(x, y, nx, ny)) continue;
        gor[ny][nx] = true; kuyruk.push([nx, ny]);
      }
    }
    const eksik = new Set(), bak = (ad, x, y) => { if (!gor[y] || !gor[y][x]) eksik.add(ad); };
    for (const a of ajanlar) bak(a.oyuncu ? `${adEki(OAD, "ın")} masası` : `masa (${a.ad})`, ...(a.oyuncu ? OYUNCU_BAS : a.koltuk));
    bak("kahve makinesi", ...KAHVE); bak("yazıcı", ...YAZICI); bak("mama kabı", 7, 30);
    for (const o of OTURAKLAR) bak(o.ad, ...o.yaklas);
    for (const [kx, ky] of KAPILAR) bak("kapı", kx, ky);
    return [...eksik];
  }
  // Düzenle modunda taşınamaz/silinemez temel eşyalar: işlevi olanlar (masa, ekran, sunucu, monitör, koltuk, hareketli, asansör, saat, tezgah, sebil: dedikodu yeri),
  // üstünde eşya duranlar ve bir oturak ya da etkileşim noktası taşıyanlar
  function korunanMi(i) {
    const m = HR.mobilya[i - 1];
    if (!m || m.t === "masa" || m.liste || m.monitor || m.koltuk || m.davranis || /^(hk\.|C\.asansor|C\.saat|C\.tezgah|sebil$)/.test(m.k)) return true;
    if (HR.mobilya.some((x) => x.ustune === i - 1)) return true;
    const n = nesneler.concat(zeminler).find((x) => x.taban === i); if (!n) return true;
    const icinde = (px, py) => px >= n.x - 2 && px < n.x + n.w + 2 && py >= n.y - 2 && py < n.y + n.h + 18;
    return [...OTURAKLAR.map((o) => [o.x, o.y]), ...NESNELER.map((o) => [o.x, o.y]), KAHVE, YAZICI].some(([x, y]) => icinde(x * T + 8, y * T + 8));
  }
  // Kayıtlı düzen: Ofis sunucusundan (ofis.pyw /api/duzen), yoksa bu tarayıcıdan (düz http.server)
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  async function duzenOku() {
    if (ANAHTAR) try { const r = await fetch("/api/duzen", { headers: { "X-Ofis-Anahtar": ANAHTAR } }); if (r.ok) return await r.json(); } catch (e) { /* tarayıcıya düş */ }
    try { return JSON.parse(localStorage.getItem("ofis-duzen-1") || "null"); } catch (e) { return null; }
  }

  // ---------- statik katman ----------
  function statikCiz() {
    st.fillStyle = "#1b1a22"; st.fillRect(0, 0, W, H);
    for (const o of ODALAR) {
      const [zc, zr] = o.zemin, rb = o.rb === "f" ? img.rb : img.rbo;
      for (let y = o.y + 2; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++)
        st.drawImage(rb, (zc + (x % 3)) * T, (zr + (y % 2)) * T, T, T, x * T, y * T, T, T);
      for (let x = o.x; x < o.x + o.w; x++) for (let d = 0; d < 2; d++)
        st.drawImage(rb, T, (o.duvar + d) * T, T, T, x * T, (o.y + d) * T, T, T);
      st.fillStyle = "rgba(20,16,30,.18)"; st.fillRect(o.x * T, (o.y + 2) * T, o.w * T, 3);
    }
    for (const n of zeminler.filter((n) => n.zemin)) cizNesne(st, n);
    for (const n of zeminler.filter((n) => n.golgeK)) cizNesne(st, n);
    for (const n of zeminler.filter((n) => n.duvar)) cizNesne(st, n);
    // oda sınırları (kapı boşluklu)
    const kalin = 4, cizgi = (x, y, w, h) => { st.fillStyle = "#2b2838"; st.fillRect(x - 1, y - 1, w + 2, h + 2); st.fillStyle = "#f5f5f8"; st.fillRect(x, y, w, h); };
    const yatay = new Map();
    for (const o of ODALAR) {
      for (const yy of [o.y, o.y + o.h]) { const a = yatay.get(yy) || []; a.push([o.x, o.x + o.w]); yatay.set(yy, a); }
      for (const xx of [o.x, o.x + o.w]) cizgi(Math.min(W - kalin, Math.max(0, xx * T - kalin / 2)), o.y * T, kalin, o.h * T);
    }
    for (const [yy, araliklar] of yatay) {
      const y = Math.min(H - kalin, Math.max(0, yy * T - kalin / 2));
      for (const [a, b] of araliklar) {
        let bas = a;
        const kapilar = KAPILAR.filter(([kx, ky]) => ky === yy && kx >= a && kx < b).map(([kx]) => kx).sort((p, q) => p - q);
        for (const kx of kapilar) { if (kx > bas) cizgi(bas * T, y, (kx - bas) * T, kalin); bas = kx + 2; }
        if (b > bas) cizgi(bas * T, y, (b - bas) * T, kalin);
      }
    }
  }
  function cizNesne(c, n) {
    const [sx, sy, w, h] = n.kutu, kr = n.anim ? (n.anim.kare ? n.anim.kare() : Math.floor(zaman * (n.anim.hiz ? n.anim.hiz() : n.anim.fps)) % n.anim.n) : 0;
    c.drawImage(n.kaynak, sx + kr * w, sy, w, h, Math.round(n.x), Math.round(n.y), w, h);
  }

  // ---------- karakterler ----------
  const ajanlar = V.ajanlar.map((a, i) => ({
    ...a, x: a.koltuk[0], y: a.koltuk[1], yol: [], yon: 3, balon: null, balonSon: 0, sonra: null, vurgu: 0,
    yazSon: 0, telefonSon: 0, ozel: null, oyuncu: !!a.oyuncu, konusuyor: false, perde: a.oyuncu ? 0.8 : 0.9 + (i % 4) * 0.12,
    disarda: false, cikti: false, rut: null, hizK: 1,   // gün planı: ofiste değil / bugün çıktı / rutinde / yürüyüş hız çarpanı
  }));
  const bul = (id) => ajanlar.find((a) => a.id === id);
  // Asansörle ziyaret (moduller/ziyaret.js): ekKarakterler = ofiste çizilen ama simülasyonda olmayan karakterler (ev sahibindeki misafirler, misafirdeki ev sahibi);
  // uzak = başka birinin ofisini ziyaret ederken durum (null: kendi ofisin). Bkz. MIMARI.md "Asansörle ziyaret" ve "uzak mod" bölümü.
  const ekKarakterler = [];
  let uzak = null;
  // Modüller (moduller/*.js) window.OFIS_MODULLER'e kayıt olur; çekirdek kancaları MOD(ad, ...) ile çağırır.
  // İlk tanımsız olmayan dönüş kullanılır (seçim kancaları için); bildirim kancaları her modülde çalışır.
  const MOD = (ad, ...arg) => { let sonuc; for (const m of window.OFIS_MODULLER || []) if (m[ad]) { const r = m[ad](...arg); if (sonuc === undefined) sonuc = r; } return sonuc; };
  const yerinde = (a) => !a.yol.length && a.x === a.koltuk[0] && a.y === a.koltuk[1];
  const mesgul = (a) => a.yol.length || a.sonra || a.ozel || a.konusuyor || a.gecis || a.oturak || zaman < a.telefonSon || a.rut || a.disarda;

  // ---------- A* ----------
  function yolBul(bas, hedef) {
    const sx = Math.round(bas[0]), sy = Math.round(bas[1]), [hx, hy] = hedef;
    const k = (x, y) => y * GEN + x, tah = (x, y) => Math.abs(x - hx) + Math.abs(y - hy);
    const acik = [[sx, sy]], gel = new Map(), gs = new Map([[k(sx, sy), 0]]), fs = new Map([[k(sx, sy), tah(sx, sy)]]);
    let tur = 0;
    while (acik.length && tur++ < 5000) {
      let bi = 0; for (let i = 1; i < acik.length; i++) if (fs.get(k(...acik[i])) < fs.get(k(...acik[bi]))) bi = i;
      const [x, y] = acik.splice(bi, 1)[0];
      if (x === hx && y === hy) {
        const yol = [[x, y]]; let kk = k(x, y);
        while (gel.has(kk)) { const [px, py] = gel.get(kk); yol.unshift([px, py]); kk = k(px, py); }
        return yol.slice(1);
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GEN || ny >= YUK) continue;
        if (!gecebilir(x, y, nx, ny) && !(nx === hx && ny === hy && odaNo[y][x] === odaNo[ny][nx])) continue;
        const ng = gs.get(k(x, y)) + 1, nk = k(nx, ny);
        if (ng < (gs.get(nk) ?? 1e9)) {
          gel.set(nk, [x, y]); gs.set(nk, ng); fs.set(nk, ng + tah(nx, ny));
          if (!acik.some(([ax, ay]) => ax === nx && ay === ny)) acik.push([nx, ny]);
        }
      }
    }
    return [hedef];
  }
  function gonder(a, hedef, sonraFn) {
    if (a.rezerve && a.rezerve.dolu === a && !a.oturak) a.rezerve.dolu = null;
    a.rezerve = null;
    if (a.oturak) { kalk(a, () => gonder(a, hedef, sonraFn)); return; } a.yol = yolBul([a.x, a.y], hedef); a.sonra = sonraFn || null; if (!a.yol.length && sonraFn) { a.sonra = null; sonraFn(); } }
  // Rutindeki (toplantı, öğle, çıkış) ya da ofiste olmayan ajanı eski zamanlayıcılar masaya geri yollamasın
  function eveDon(a, sonraFn) { if (a.rut || a.disarda) { if (sonraFn) sonraFn(); return; } gonder(a, a.koltuk, () => { a.yon = 3; if (sonraFn) sonraFn(); }); }

  // ---------- senaryo ----------
  let zaman = 0, hiz = 1, tetik = new Set(), bekleyen = [], secili = null, uzerinde = null;
  let kahveZamani = 8, telefonZamani = 12, sonAdimSes = 0, sonKlavye = 0, sesOdaNo = -2;
  const sonra = (sn, fn) => bekleyen.push({ t: zaman + sn, fn });
  // Konumlu ses: kaynak karo (x, y) oyuncuya göre soldaysa sola, sağdaysa sağa kayar; uzaklaştıkça kısılır, başka odadaki ses ek uzak sayılır
  const odaKaro = (x, y) => odaNo[Math.max(0, Math.min(YUK - 1, Math.round(y)))][Math.max(0, Math.min(GEN - 1, Math.round(x)))];
  // Dinleyici: kamera bir ajanı izliyorsa (kişi kartı) o, değilse oyuncu. Konumlu sesler ve ajan sesleri buna göre kısılır.
  const dinleyici = () => (kamTakip && !kamTakip.disarda ? kamTakip : oyuncu);
  function sesKonum(ad, x, y, ...a) {
    if (!SES.acik) return;
    const d = dinleyici();
    if (!d) { SES.cal(ad, ...a); return; }
    const dx = x - d.x, dy = y - d.y;
    SES.calKonum(ad, dx / 14, Math.hypot(dx, dy) + (odaKaro(x, y) !== odaKaro(d.x, d.y) ? 6 : 0), ...a);
  }
  const el = (id) => document.getElementById(id);
  const aralik = ([a, b]) => a + Math.random() * (b - a);

  // ---------- oyuncu, kamera, diyalog durumu ----------
  let oyuncu = null, diyalogAjan = null, kameraYakin = true, taramaParlak = 0, kayitSon = 0;
  let yurumeK = 1, kameraK = 2;   // ayarlar modülü OFIS_IC üzerinden yazar: oyuncu yürüme hızı çarpanı, yakın kamera çarpanı
  const kam = { x: 0, y: 0, o: S };
  let kamTakip = null;   // kişi kartı "Kamera bu karakteri izliyor": yakın kamera oyuncu yerine bu ajanı izler
  const tuslar = new Set(); let tekAdim = null;
  const YONLER = { sag: [1, 0, 0], yukari: [0, -1, 1], sol: [-1, 0, 2], asagi: [0, 1, 3] };

  function yonBak(a, h) { const dx = h.x - a.x, dy = h.y - a.y; a.yon = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy < 0 ? 1 : 3; }
  function yanKaro(h) {
    const hx = Math.round(h.x), hy = Math.round(h.y);
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [0, 2], [1, 1], [-1, 1]]) {
      const x = hx + dx, y = hy + dy;
      if (yurur[y] && yurur[y][x]) return [x, y];
    }
    return [hx, hy + 1];
  }
  const ziyaretNoktasi = (h) => (h.oyuncu || !yerinde(h) ? yanKaro(h) : [h.koltuk[0], h.koltuk[1] + 2]);

  function olay(o) {
    const a = bul(o.kim), h = o.git && bul(o.git);
    // Gelmemiş ya da rutindeki (giriş, toplantı, öğle) ajan sırasını bekler; gün için çıktıysa olay atlanır
    if (a.disarda || a.rut || a.ozel === "beyin") { if (!a.cikti) sonra(1.5, () => olay(o)); return; }
    a.ozel = null;
    const gider = o.git && !h.disarda;   // hedef ofiste değilse olduğu yerde konuşur
    if (diyalogAjan === a && (gider || o.yazdir)) diyalogKapat();
    if (o.ses) sesKonum(o.ses, a.x, a.y);
    if (gider) {
      a.ozel = "olay";
      gonder(a, ziyaretNoktasi(h), () => {
        yonBak(a, h); konus(a, o.soz);
        if (o.brifing) { brifingGoster(); gorevBitir("brifing"); }
        if (o.onay) { onayEkle(o.onay); SES.cal("bildirim"); }
        sonra(2.4, () => eveDon(a, () => (a.ozel = null)));
      });
    } else if (o.yazdir) {
      a.ozel = "olay"; konus(a, o.soz);
      gonder(a, YAZICI, () => { a.yon = 1; sesKonum("yazici", a.x, a.y); sonra(2.2, () => eveDon(a, () => (a.ozel = null))); });
    } else {
      konus(a, o.soz);
      if (o.yaz) a.yazSon = zaman + o.yaz;
      if (o.tartisma) { a.vurgu = 3; bul(o.tartisma).vurgu = 3; }
    }
    if (o.kayit) gunluk(o.kayit);
  }
  function konus(a, metin, sessiz) {
    if (a.disarda) return;
    a.balon = metin; a.balonSon = zaman + 4.5;
    if (!sessiz) gunluk(`${a.ad}: ${metin}`, true);
    a.sesli = false;
    MOD("konusmaSatiri", { ajan: a, metin });   // ajan sesleri (moduller/konusma-ses.js) ve oda günlüğü dinler; ses modülü satırı alırsa a.sesli = true
    if (!a.sesli) sesKonum("konus", a.x, a.y, a.perde);   // gerçek ses yoksa sentez mırıltısı
  }
  function kahveyeGit(a) {
    a.ozel = "kahve";
    gonder(a, KAHVE, () => { a.yon = 1; sesKonum("kahve", a.x, a.y); konus(a, MOD("kahveSozu", a) || "Kahve molası ☕", true); MOD("kahveIcti", a); sonra(3.5, () => eveDon(a, () => (a.ozel = null))); });
  }
  function ortam() {
    // gerçek saatte ortam seyrekleşir (mola 2,5-5 dk, kahve denetimi ×4, telefon ×8); kahveye gidişi yine ihtiyaç modülü seçer
    if (zaman > molaZamani) { molaZamani = zaman + rs(16, 150) + Math.random() * rs(10, 150); molaVer(); }
    if (zaman > kahveZamani) {
      kahveZamani = zaman + aralik(V.ortam.kahveAralik) * rs(1, 4);
      const bos = ajanlar.filter((a) => !a.oyuncu && !mesgul(a) && yerinde(a) && a.id !== "spiker");
      const aday = MOD("kahveAdayi", bos), a = aday === undefined ? bos[Math.floor(Math.random() * bos.length)] : aday;   // ihtiyaç modülü: en yorgun olan (null: kimse yorgun değil)
      if (a) kahveyeGit(a);
    }
    if (zaman > telefonZamani) {
      telefonZamani = zaman + aralik(V.ortam.telefonAralik) * rs(1, 8);
      const bos = ajanlar.filter((a) => !a.oyuncu && !mesgul(a) && yerinde(a));
      const a = bos[Math.floor(Math.random() * bos.length)];
      if (a) { sesKonum("telefon", a.x, a.y); sonra(1.6, () => { if (!a.konusuyor) { a.telefonSon = zaman + 4; konus(a, "Alo, evet, dinliyorum…", true); } }); }
    }
  }

  // ---------- diyalog eylemleri (hepsi kurgusal; ofiste görünür bir şey başlatır) ----------
  const EYLEMLER = {
    beyneSor: (a) => { diyalogKapat(); if (window.SOHBET) SOHBET.ac(a.id); },
    odak: () => { diyalogKapat(); MOD("odakBaslat"); },   // Ders koçu: 25 dakika odak (moduller/etkilesim.js)
    brifing: () => { brifingGoster(); SES.cal("bildirim"); gunluk(`${bul("ada").ad} sabah brifingini verdi.`); gorevBitir("brifing"); },
    yakalaIsle: () => {
      const p = bul("postaci"), ada = bul("ada");
      if (musaitDegil(p) || musaitDegil(ada)) return;
      p.ozel = "gorev";
      gonder(p, ziyaretNoktasi(ada), () => {
        yonBak(p, ada); konus(p, `${ada.ad}, 3 yeni kaynak getirdim.`); SES.cal("bildirim");
        sonra(2, () => { eveDon(p, () => (p.ozel = null)); ada.yazSon = zaman + 4; });
        sonra(6, () => { konus(ada, "İşlendi: 2 ders kaydedildi, 1 kaynak kalıcı ders vermedi."); gunluk("Beyin: 3 kaynak işlendi (demo)."); });
      });
    },
    tarama: () => {
      const t = bul("tarayici"); t.yazSon = zaman + 5; taramaParlak = zaman + 5; gorevBitir("tarama");
      sonra(5, () => { konus(t, "Tarama bitti: 2 yeni formasyon."); SES.cal("bildirim"); gunluk("Radar: yeni tarama, 2 formasyon (demo)."); });
    },
    bultenOnay: () => { onayEkle("bulten"); SES.cal("bildirim"); },
    yazdir: () => {
      const e = bul("editor"); if (musaitDegil(e)) return;
      e.ozel = "gorev";
      gonder(e, YAZICI, () => { e.yon = 1; sesKonum("yazici", e.x, e.y); konus(e, "Bülten basıldı.", true); sonra(2.2, () => eveDon(e, () => (e.ozel = null))); });
    },
    kahve: (a) => { if (!musaitDegil(a)) kahveyeGit(a); },
    video: () => { kayitSon = zaman + 12; gorevBitir("kayit"); konus(bul("spiker"), "Kayıttayız: 'Günaydın, KK Haber'e hoş geldiniz…'"); gunluk("Stüdyo: video kaydı başladı (demo)."); SES.cal("bildirim"); },
    yayinla: () => {
      const d = bul("dagitici"); d.yazSon = zaman + 3;
      sonra(3, () => { konus(d, "Gönderildi. Kanal +5 üye."); SES.cal("bildirim"); gunluk("Yayın: radar özeti kanala gönderildi (demo)."); });
    },
  };

  function diyalogAc(a) {
    const d = V.diyaloglar[a.id]; if (!d || diyalogAjan || a.disarda || uzak) return;
    diyalogAjan = a; a.konusuyor = true; tuslar.clear(); oyuncu.yol = []; oyuncu.sonra = null;
    yonBak(oyuncu, a); if (!yerinde(a)) yonBak(a, oyuncu);
    el("dAd").textContent = a.ad; el("dRol").textContent = a.rol;
    portreCiz(a); const selam = MOD("selam", a, d.selam) || d.selam; el("dMetin").textContent = selam; MOD("konustu", a);
    secenekCiz([...(window.SOHBET ? [{ etiket: "🧠 Gerçekten sor", cevap: "Sor bakalım, notlara bakarım.", eylem: "beyneSor" }] : []), ...d.secenekler]);
    el("diyalog").classList.add("acik"); diyalogSesi(a, selam);
    secAjan(a);
  }
  // Veri dışı diyalog (toplantı kararı gibi): konuşan ajanın portresiyle metin ve fn'li seçenekler
  function diyalogOzel(a, metin, secenekler) {
    if (diyalogAjan) diyalogKapat();
    diyalogAjan = a; a.konusuyor = true; tuslar.clear(); oyuncu.yol = []; oyuncu.sonra = null;
    el("dAd").textContent = a.ad; el("dRol").textContent = a.rol; portreCiz(a); el("dMetin").textContent = metin;
    const k = el("secenekler"); k.textContent = ""; k._liste = secenekler;
    secenekler.forEach((s, i) => { const b = document.createElement("button"), kb = document.createElement("kbd"); kb.textContent = i + 1; b.append(kb, s.etiket); b.onclick = () => secim(s); k.appendChild(b); });
    el("diyalog").classList.add("acik"); diyalogSesi(a, metin);
  }
  // Diyalog kutusundaki satır: ajan sesi (moduller/konusma-ses.js) açıksa seslendirilir, yeni satır öncekini keser; yoksa sentez mırıltısı
  function diyalogSesi(a, metin) {
    const sa = window.OFIS_SES_AJAN;
    if (!(sa && sa.konus(a.id, metin, { x: a.x, y: a.y, oncelik: 1, kanal: "diyalog" }))) SES.cal("konus", a.perde);
  }
  function secenekCiz(liste) {
    const k = el("secenekler"); k.textContent = ""; if (!liste.some((s) => s.geri)) k._liste = liste;
    [...liste, { etiket: "Görüşürüz", kapat: true }].forEach((s, i) => {
      const b = document.createElement("button"), kb = document.createElement("kbd");
      kb.textContent = i + 1; b.append(kb, s.etiket); b.onclick = () => secim(s); k.appendChild(b);
    });
  }
  function secim(s) {
    if (s.kapat) return diyalogKapat();
    if (s.geri) return secenekCiz(s.geri);
    const a = diyalogAjan;
    if (s.fn) { gunluk(`${OAD} → ${a.ad}: ${s.etiket}`, true); return s.fn(a); }   // özel diyaloglar (toplantı kararı) metni ve seçenekleri kendisi kurar
    const cevap = MOD("cevap", a, s) || s.cevap; el("dMetin").textContent = cevap; diyalogSesi(a, cevap);
    if (s.alt) secenekCiz([...s.alt, { etiket: "↩ Geri", geri: el("secenekler")._liste }]); portreCiz(a);
    gunluk(`${OAD} → ${a.ad}: ${s.etiket}`, true);
    if (s.eylem && EYLEMLER[s.eylem]) { EYLEMLER[s.eylem](a); if (a.yol.length) sonra(1.4, () => { if (diyalogAjan === a) diyalogKapat(); }); }
  }
  function diyalogKapat() {
    if (!diyalogAjan) return;
    const a = diyalogAjan; a.konusuyor = false; if (yerinde(a)) a.yon = 3;
    diyalogAjan = null; el("diyalog").classList.remove("acik"); cv.focus();
  }
  // Portrait Generator portresi olanlar (oyuncu, asistan) 32x32 konuşma animasyonuyla; diğerleri karakter sayfasının önden karesiyle
  let portreZ = 0;
  function portreCiz(a, konusma = 1200) {
    const c = el("portre"), pg = img.portre && img.portre[a.id], p = c.getContext("2d");
    clearInterval(portreZ); c.classList.toggle("pg", !!pg);
    if (!pg) {
      c.width = 18; c.height = 22; p.imageSmoothingEnabled = false; p.fillStyle = "#3f4258"; p.fillRect(0, 0, 18, 22);
      return p.drawImage(img.k[a.id], 18 * 16, 32 + 8, 16, 22, 1, 1, 16, 22);
    }
    c.width = c.height = 32; p.imageSmoothingEnabled = false;
    let k = 0; const bas = performance.now(), ciz = (kr) => { p.clearRect(0, 0, 32, 32); p.drawImage(pg, kr * 32, 0, 32, 32, 0, 0, 32, 32); };
    ciz(0); portreZ = setInterval(() => { if (performance.now() - bas > konusma) { clearInterval(portreZ); return ciz(0); } ciz(++k % 10); }, 90);
  }
  // ---------- gerçek beyin sohbeti (sohbet.js) için kancalar ----------
  // Konuşulan ajan yerinde durur (konusuyor + ozel "beyin": rutin, olay, kahve onu almaz); oyuncuya döner, ne aradığını balonda söyler.
  const sohbetAjan = (id) => { const a = bul(id); return a && !a.oyuncu && !a.disarda ? a : null; };
  window.OFIS_AI = {
    sohbetBasla: (id) => {
      const a = sohbetAjan(id); if (!a) return;
      a.konusuyor = true; a.ozel = "beyin"; a.sonra = null; a.yol = a.yol.slice(0, 1);   // yürüyorsa bu adımı bitirip durur
      tuslar.clear(); oyuncu.yol = []; oyuncu.sonra = null;
      if (Math.hypot(a.x - oyuncu.x, a.y - oyuncu.y) < 4) { yonBak(oyuncu, a); if (!yerinde(a)) yonBak(a, oyuncu); }
    },
    sohbetBitti: (id) => {
      const a = bul(id); if (!a || a.ozel !== "beyin") return;
      a.konusuyor = false; a.ozel = null;
      if (!a.disarda && !a.rut && !yerinde(a) && !a.oturak) sonra(0.8, () => { if (!a.konusuyor && !a.ozel) eveDon(a); });
      else if (yerinde(a)) a.yon = 3;
    },
    dusun: (id) => { const a = sohbetAjan(id); if (a) konus(a, "💭 …", true); },
    arac: (id, ad, hedef) => {
      const a = sohbetAjan(id); if (!a) return;
      const kisa = String(hedef || "").split("/").filter(Boolean).pop() || hedef || "";
      konus(a, (ad === "Read" ? "💭 📄 " : "💭 🔍 ") + kisa.slice(0, 36), true);
    },
    bitti: (id, oneri) => {
      const a = sohbetAjan(id); if (!a) return;
      konus(a, oneri ? "Bir öneri hazırladım, onayına bıraktım." : "Cevabın hazır.", true);
      if (oneri) SES.cal("bildirim");
      if (!window.SOHBET || !SOHBET.acik() || SOHBET.aktif() !== id) OFIS_AI.sohbetBitti(id);   // kutu kapandıysa serbest bırak
    },
    ses: (ad) => SES.cal(ad),
    gunluk: (m) => gunluk(m),
    odak: () => cv.focus(),
  };
  function yakinAjan() {
    if (!oyuncu) return null;
    let en = null, ed = 9;
    for (const a of ajanlar) {
      if (a.oyuncu || a.disarda || !V.diyaloglar[a.id]) continue;
      const d = Math.hypot(a.x - oyuncu.x, a.y - oyuncu.y); if (d < ed) { ed = d; en = a; }
    }
    return ed <= 2.3 ? en : null;
  }
  function secAjan(a) {
    secili = a;
    const k = el("ajan");
    if (!a) { k.className = "bos"; k.textContent = "Bir ajanın yanına git ve E ile konuş."; return; }
    k.className = "";
    const son = [...el("gunluk").children].map((d) => d.textContent).filter((s) => s.includes(a.ad + ":")).slice(0, 3);
    const oda = ODALAR.find((o) => a.koltuk[0] >= o.x && a.koltuk[0] < o.x + o.w && a.koltuk[1] >= o.y && a.koltuk[1] < o.y + o.h);
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));   // ad/rol/oda adı kişi ayarından ya da ev sahibinden gelir
    k.innerHTML = `<b>${esc(a.ad)}</b> · ${esc(a.rol)}<br><small style="color:var(--soluk)">${oda ? esc(oda.ad) : ""}</small>` +
      (MOD("ajanHtml", a) || "") +
      (son.length ? "<ul>" + son.map((s) => `<li>${esc(s.replace(/^\d\d:\d\d/, ""))}</li>`).join("") + "</ul>" : "<div class='bos'>Henüz bir şey yapmadı.</div>");
  }

  function gunluk(metin, soluk) {
    const d = document.createElement("div");
    d.innerHTML = `<time>${saatYazi()}</time>`;
    const s = document.createElement("span"); s.textContent = metin; if (soluk) s.style.color = "var(--soluk)";
    d.appendChild(s); el("gunluk").prepend(d);
  }
  function brifingGoster() { const b = el("brifing"); b.className = ""; b.dataset.gercek = ""; b.innerHTML = "<ul>" + (MOD("brifingVeri") || V.brifing).map((x) => `<li>${x}</li>`).join("") + "</ul>"; }
  function onayEkle(k) {
    const kutu = el("onaylar"); if (kutu.classList.contains("bos")) { kutu.className = ""; kutu.textContent = ""; }
    const v = V.onaylar[k], d = document.createElement("div"); d.className = "onay";
    d.innerHTML = `<b>${v.baslik}</b><small>${v.detay}</small><button class="evet">Onayla</button><button class="hayir">Reddet</button>`;
    d.querySelector(".evet").onclick = () => karar(d, { ...v, k }, true);
    d.querySelector(".hayir").onclick = () => karar(d, { ...v, k }, false);
    kutu.appendChild(d);
  }
  function karar(d, v, evet) {
    d.querySelectorAll("button").forEach((b) => b.remove());
    const s = document.createElement("span"); s.className = evet ? "durum-evet" : "durum-hayir"; s.textContent = evet ? "Onaylandı" : "Reddedildi";
    d.appendChild(s); SES.cal(evet ? "bildirim" : "ret");
    konus(oyuncu, evet ? `Onay: ${v.baslik}.` : `Bunu yayınlamayalım: ${v.baslik}.`);
    const gonderen = bul({ bulten: "editor", radar: "dagitici" }[v.k]);
    if (gonderen) sonra(1.2, () => { if (gonderen.disarda) return; konus(gonderen, evet ? rastgele(["Yaşasın! 🎉", "Harika, hemen yayına!", "Bunu duymak güzel."]) : "Peki, baştan düzeltiyorum."); if (evet) kalpler(gonderen, 4); });
    if (evet) gorevBitir(v.k);
    // Reddedilen taslak bir kez düzeltilip yeniden onaya gelir (görev her zaman yapılabilir kalsın)
    else if (gonderen && !tekrarOnay.has(v.k)) {
      tekrarOnay.add(v.k);
      sonra(9, () => { if (gonderen.disarda) return; konus(gonderen, "Düzelttim, yeni sürüm onayında."); onayEkle(v.k); SES.cal("bildirim"); });
    }
  }
  const saatYazi = () => { const dk = Math.floor(dakika()); return `${String(Math.floor(dk / 60) % 24).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`; };

  function bastan(tam) {
    if (uzak) return;   // ziyaretteyken kendi ofisinin günü yeniden başlatılmaz
    zaman = 0; tetik.clear(); bekleyen = []; kahveZamani = 8; telefonZamani = 12; taramaParlak = 0; kayitSon = 0;
    Object.assign(efekt, { parti: 0, kafein: 0, sonDakika: 0 }); parcaciklar = [];
    if (kedi.klavyeAjan) MOD("klavyedenIn", false);
    OTURAKLAR.forEach((o) => { if (o.dolu && !(o.dolu.oyuncu && !tam)) o.dolu = null; });
    ajanlar.forEach((a) => { if (!a.oyuncu || tam) { a.oturak = null; a.gecis = null; a.rezerve = null; } });
    molaZamani = 15;
    if (tam) diyalogKapat();
    // Gün planı: herkes dışarıda başlar, sabah girişi yeniden oynar; görevler yenilenir
    gun = tam ? 1 : gun + 1; toplanti = null; ogle = null; tekrarOnay.clear(); asansor.acik = 0; asansor.son = -9;
    stat.toplanti = 0; stat.sev = 0; stat.mama = false; mama.dolu = false; mama.sonYeme = -99;
    // Süre damgaları mutlak zamana bağlı: gün dönünce eski günün balonu/takibi yeni güne taşmasın
    ajanlar.forEach((a) => { a.balon = null; a.balonSon = 0; a.telefonSon = 0; });
    Object.assign(kedi, { balon: null, balonSon: 0, takipSon: 0, sonZ: 0 }); efekt.balik = 0; sonKarne = null;
    karneKapat(); if (tam) el("karneKart").hidden = true;
    ajanlar.forEach((a) => {
      if (a.oyuncu && !tam) return;
      if (a.oyuncu) { Object.assign(a, { x: OYUNCU_BAS[0], y: OYUNCU_BAS[1], yol: [], sonra: null, yon: 3, balon: null }); return; }
      a.cikisT = a.cikisVar = Infinity;   // çıkış saatleri kapanışta (ofisKapat) planlanır
      if (a.konusuyor) { Object.assign(a, { disarda: false, cikti: false, rut: null, hizK: 1 }); return; }
      // gece kalan (asistan: arşiv hiç uyumaz) yeni gün açılırken yerinde kalır, yeniden gelmez
      if (!tam && RT.geceKalan.includes(a.id) && !a.disarda) { Object.assign(a, { cikti: false, rut: null, hizK: 1, ozel: null }); if (!yerinde(a)) eveDon(a); return; }
      Object.assign(a, { x: GIRIS[0], y: GIRIS[1], yol: [], balon: null, sonra: null, vurgu: 0, yon: 3, ozel: null, yazSon: 0, telefonSon: 0, disarda: true, cikti: false, rut: null, hizK: 1, rutSon: Infinity });
    });
    ofisDurumKur("acik", true); otoErtele = false; kapatKayitSil();   // yeni gün: ofis açık başlar
    gorevleriYenile(); MOD("bastan", tam);
    el("brifing").className = "bos"; el("brifing").textContent = `${bul("ada").ad} brifingi getirince burada görünecek.`;
    el("onaylar").className = "bos"; el("onaylar").textContent = "Şimdilik yok.";
    el("gunluk").textContent = "";
  }

  // ---------- gün akışı ----------
  // DONGU sn'lik döngü GUN_DK dakikayı kapsar (hızlı gün 08:00 → 02:00, gerçek saat açılıştan ertesi açılışa). dakika() gece yarısından sonra 1440'ı geçer
  // (01:00 = 1500). Olay saatleri (V.olaylar[].t) 120 sn'lik senaryo saniyesidir (1 sn = 6 dk): gerçek saatte açılıştan 6 dk × t, hızlı günde güne yayılır
  // (olcek() ile çarpılır); dakika tabanlı veriler (rutin, görev) dkT() ile kendiliğinden uyar.
  const dakika = () => (uzak ? uzak.dakika : ACILIS + zaman * (GUN_DK / DONGU));
  const olcek = () => (GERCEK ? 360 : DONGU / 120);
  // Gerçek saatte uzayan bekleme/aralıklar (sn): hızlı günde ilki, gerçek saatte ikincisi (toplantı bekleme, öğle, ortam)
  const rs = (hizli, gercek) => (GERCEK ? gercek : hizli);
  // Gün süresi (ayarlar modülü; sn = 0: gerçek saat): değişince olay saatleri, rutin ve görevler yeni güne göre ölçeklenir, oyun baştan başlar
  function gunSuresi(sn, ilk) {
    if (uzak) return;
    const g = sn === 0, yeni = g ? 86400 : sn;
    if (g === GERCEK && yeni === DONGU) return;
    GERCEK = g; DONGU = yeni; GUN_DK = g ? 1440 : 1080; hizDugmeleri();
    if (!ilk) { rutinPlanla(); bastan(true); if (GERCEK) gercegeAtla(gercekZaman()); }
  }
  // Açılış saati (sa, 7-10) ve yedek otomatik kapanış (gece yarısından sonra sa; 0 = kapalı): ayarlar modülünden. Açılış değişince gün yeniden başlar.
  function ofisAyari(acilisSa, otoSa, ilk) {
    const yeni = Math.round(acilisSa * 60), degisti = yeni !== ACILIS;
    if (!degisti && otoSa === OTO_KAPAT) return;
    ACILIS = yeni; OTO_KAPAT = otoSa;
    if (ilk || uzak) return;
    rutinPlanla();
    if (degisti) { bastan(true); if (GERCEK) gercegeAtla(gercekZaman()); }   // yalnız kapanış saati değiştiyse bir sonraki karede rutinGuncelle uygular
  }
  // Bilgisayar saatine göre ofis zamanı: açılış saatinden beri geçen sn (açılıştan önceki saatler önceki ofis gününe aittir)
  function gercekZaman() {
    const d = new Date(Date.now() + saatOfset);
    const s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000 - ACILIS * 60;
    return s < 0 ? s + 86400 : s;
  }
  // Açılışta, uyku/arka plan dönüşünde ya da saat sarılınca: aradakini oynatmadan o saate atla. Geçmiş olaylar oynatılmaz,
  // yalnız masaya bırakılanlar (onay kartı, brifing) bekler; ajanlar o saatte olmaları gereken yere konur.
  function gercegeAtla(t) {
    zaman = t; const ol = olcek();
    V.olaylar.forEach((o, i) => {
      if (o.t * ol >= zaman) { tetik.delete(i); return; }
      if (tetik.has(i)) return;
      tetik.add(i);
      if (o.onay) onayEkle(o.onay);
      if (o.brifing) brifingGoster();
    });
    RT.toplantilar.forEach((m, i) => { if (zaman < dkT(m.dk) - rs(5, 120)) tetik.delete("top:" + i); });
    for (const ad of OGUNLER) if (zaman < dkT(RT[ad].dk) - 1) tetik.delete("yemek:" + ad);   // (surprizler "aksam" anahtarını kullanıyor: çakışmasın)
    rutinSenkron();   // ofisin açık/kapalı durumunu da o saate göre kurar
  }
  function gercekAdim() {
    const h = gercekZaman(), fark = h - zaman;
    if (fark < -5) { if (zaman - h > DONGU / 2) bastan(false); gercegeAtla(h); return; }   // açılış saatinde gün döndü ya da saat geri alındı
    if (fark > 3) { gercegeAtla(h); return; }   // sekme arkadaydı ya da bilgisayar uyudu
    for (let k = fark; k > 0; k -= 0.1) adimla(Math.min(0.1, k));
  }
  // Kullanıcı ofis saatini seçer (Ayarlar > Saat): çalışanlar o saatte olmaları gereken yerde olur. Gerçek modda saat oradan akmaya devam eder.
  function saatAyarla(saat, dk) {
    if (uzak) return false;   // ziyaretteyken saat ev sahibinindir
    const toplam = ((saat * 60 + dk) % 1440 + 1440) % 1440;   // gün içi dakika
    let t = (toplam - ACILIS) * 60;                             // açılış saatinden beri geçen gerçek sn (açılıştan önceki saatler önceki ofis gününe aittir)
    if (t < 0) t += 86400;
    if (GERCEK) {
      let fark = t - gercekZaman();
      if (fark > 43200) fark -= 86400; else if (fark < -43200) fark += 86400;
      saatOfset += fark * 1000;
      gercegeAtla(gercekZaman());
    } else {
      const gdk = toplam < ACILIS ? toplam + 1440 : toplam;   // gece yarısından sonrası 24 saat eklenir (01:00 = 1500)
      zaman = Math.min(DONGU - 1, Math.max(0, ((gdk - ACILIS) / GUN_DK) * DONGU)); rutinSenkron();
    }
    return true;
  }
  function saatSifirla() { if (uzak) return; saatOfset = 0; if (GERCEK) gercegeAtla(gercekZaman()); }
  function hizDugmeleri() {   // gerçek saatte hız seçilmez
    document.querySelectorAll("[data-hiz]").forEach((b) => { b.hidden = GERCEK; });
    if (GERCEK) hiz = 1;
  }
  const gecelik = () => Math.max(0, Math.min(1, (dakika() - 17 * 60) / 120));
  const rastgele = (l) => l[Math.floor(Math.random() * l.length)];

  // ---------- Sütlaç (davranışı moduller/sutlac.js) ----------
  // Kedinin verisi çekirdekte: çizim sırası, kapılar, balonlar, etkileşim ve gün sonu sıfırlaması okur
  const kedi = { ad: "Sütlaç", kedi: true, x: 42, y: 18, yol: [], yon: 0, bakis: 1, durum: "otur", sure: 2, hiz: 2.2, sonra: null,
    balon: null, balonSon: 0, sev: 0, takipSon: 0, ust: null, klavyeAjan: null, kare: 0, sonZ: 0 };
  function enYakinYurur(x, y) {
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (yurur[y + dy] && yurur[y + dy][x + dx] && !koltuklar.has(`${x + dx},${y + dy}`)) return [x + dx, y + dy];
    return [Math.round(kedi.x), Math.round(kedi.y)];
  }
  const kediSira = () => (kedi.ust ? kedi.ust.sira : kedi.y * T + T + 0.3);

  // ---------- parçacıklar (kalp, konfeti, z, buhar) ----------
  let parcaciklar = [], balonAlanlari = [];
  const parcacik = (p) => parcaciklar.push({ yas: 0, ...p });
  function kalpler(h, n) { for (let i = 0; i < n; i++) parcacik({ x: h.x * T + 4 + Math.random() * 8, y: h.y * T - 4, vx: (Math.random() - 0.5) * 12, vy: -14 - Math.random() * 8, omur: 1.4, tip: "kalp" }); }
  function parcaciklarGuncelle(dt) {
    for (const p of parcaciklar) { p.yas += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.tip === "konfeti") p.vy += 30 * dt; }
    parcaciklar = parcaciklar.filter((p) => p.yas < p.omur);
    if (zaman < efekt.parti) for (let i = 0; i < 3; i++) {
      const gw = cv.width / kam.o;
      parcacik({ x: kam.x + Math.random() * gw, y: kam.y - 4, vx: (Math.random() - 0.5) * 20, vy: 20 + Math.random() * 30, omur: 4, tip: "konfeti", renk: rastgele(["#f2cf4a", "#e0484c", "#5fb0ea", "#4fbf5f", "#a58fe0", "#ff9ec7"]) });
    }
    if (oyuncu && zaman < efekt.kafein && Math.random() < dt * 6) parcacik({ x: oyuncu.x * T + 8, y: oyuncu.y * T - 14, vx: (Math.random() - 0.5) * 6, vy: -12, omur: 1, tip: "buhar" });
  }
  function parcaciklarCiz() {
    for (const p of parcaciklar) {
      const X = ex(p.x), Y = ey(p.y), a = 1 - p.yas / p.omur;
      if (p.tip === "konfeti") { g.fillStyle = p.renk; g.save(); g.translate(X, Y); g.rotate(p.yas * 6 + p.x); g.fillRect(-3, -5, 6, 10); g.restore(); }
      else if (p.tip === "kalp") yazi("♥", X, Y, 18 * yo, `rgba(240,90,130,${a})`);
      else if (p.tip === "z") yazi("z", X, Y, (14 + p.yas * 6) * yo, `rgba(220,225,240,${a})`);
      else if (p.tip === "buhar") { g.fillStyle = `rgba(235,235,240,${a * 0.6})`; g.beginPath(); g.arc(X, Y, 4 + p.yas * 6, 0, 7); g.fill(); }
    }
  }

  // ---------- nesne etkileşimleri (sürprizler: moduller/surprizler.js) ----------
  // Çizimin okuduğu süre damgaları (zaman < damga iken etkin): parti (Konami), kafein (3. kahve), balik (yem), sonDakika (stüdyo)
  const efekt = { parti: 0, kafein: 0, balik: 0, sonDakika: 0 };
  const NESNELER = [];   // E ile kullanılan noktalar {x, y, r, etiket(), fn}: modüller basla'da ekler (sürprizler, Sütlaç'ın mama kabı)
  function yakinHedef() {
    if (!oyuncu) return null;
    if (uzak) return MOD("uzakHedef") || null;   // ziyaretteyken yalnız modülün hedefleri: selam, asansör (sim noktaları, kedi, oturak yok)
    let en = null;
    const dene = (tur, hedef, d, etiket, x, y) => { if (!en || d < en.d) en = { tur, hedef, d, etiket, x, y }; };
    for (const a of ajanlar) {
      if (a.oyuncu || a.disarda || !V.diyaloglar[a.id]) continue;
      const d = Math.hypot(a.x - oyuncu.x, a.y - oyuncu.y); if (d <= 2.3) dene("ajan", a, d, "Konuş", a.x * T + 8, a.y * T - T);
    }
    const kd = kedi.ust ? Math.hypot(kedi.ust.px / T - oyuncu.x, (kedi.ust.py + 10) / T - oyuncu.y) : Math.hypot(kedi.x - oyuncu.x, kedi.y - oyuncu.y);
    if (kd <= 2.2) dene("kedi", kedi, kd - 0.5, kedi.durum === "klavye" ? "Sütlaç'ı indir" : "Sütlaç'ı sev",
      (kedi.ust ? kedi.ust.px : kedi.x * T) + 8, kedi.ust ? kedi.ust.py - 4 : kedi.y * T);
    if (oyuncu.oturak) dene("kalk", null, -1, "Kalk", oyuncu.x * T + 8, oyuncu.y * T - T);
    else for (const o of OTURAKLAR) {
      const d = Math.hypot(o.x - oyuncu.x, o.y - oyuncu.y);
      if (!o.dolu && d <= 1.7) dene("oturak", o, d - 0.1, `Otur (${o.ad})`, o.x * T + 8, o.y * T - T);
    }
    for (const n of NESNELER) {
      const d = Math.hypot(n.x - oyuncu.x, n.y - oyuncu.y); if (d <= n.r) dene("nesne", n, oyuncu.oturak && n.oturunca ? -2 : d - 0.3 - (n.oncelik || 0), n.etiket(), oyuncu.x * T + 8, oyuncu.y * T - T - 10);
    }
    return en;
  }
  function etkiles(h) {
    if (h.tur === "ajan") diyalogAc(h.hedef);
    else if (h.tur === "kedi") MOD("kediSev");
    else if (h.tur === "oturak") oturt(oyuncu, h.hedef);
    else if (h.tur === "kalk") kalk(oyuncu);
    else h.hedef.fn();
  }

  // ---------- oturma ----------
  // x, y: karakterin oturduğu konum (karo, kesirli). yon: "sag"/"sol" yandan (karakter sayfası satır 4),
  // "on" önden (koltuk arkada; karakter koltuğun üstünde, bacaklar gizli), "arka" sırtı dönük (koltuk karakterin önünde).
  const OTURAKLAR = [
    { ad: "mutfak sandalyesi", x: 1.63, y: 28.12, yon: "sag" }, { ad: "mutfak sandalyesi", x: 4.53, y: 28.12, yon: "sol" },
    { ad: "kanepe", x: 40.38, y: 15.5, yon: "on", sira: 269 }, { ad: "kanepe", x: 41.31, y: 15.5, yon: "on", sira: 269 },
    { ad: "kanepe", x: 42.5, y: 15.5, yon: "on", sira: 269 }, { ad: "kanepe", x: 43.44, y: 15.5, yon: "on", sira: 269 },
    { ad: "berjer", x: 40.5, y: 19.62, yon: "on", sira: 335 }, { ad: "berjer", x: 43.12, y: 19.62, yon: "on", sira: 335 },
    { ad: "kanepe", x: 13.88, y: 9.5, yon: "on", sira: 173 }, { ad: "kanepe", x: 14.81, y: 9.5, yon: "on", sira: 173 },
    { ad: "berjer", x: 16.12, y: 9.5, yon: "on", sira: 173 },
    { ad: "misafir koltuğu", x: 17, y: 6.62, yon: "arka" }, { ad: "misafir koltuğu", x: 19, y: 6.62, yon: "arka" },
    ...[230, 252, 274, 296].map((x) => ({ ad: "toplantı koltuğu", x: x / T, y: 25.3, yon: "on", sira: 435 })),   // y 25.9 → 25.3: oturanın üst gövdesi masanın üstünde görünür
    ...[230, 252, 274, 296].map((x) => ({ ad: "toplantı koltuğu", x: x / T, y: 27.9, yon: "arka" })),   // y 28.4 → 27.9: baş koltuk arkalığının üstünde görünür
    { ad: "stüdyo koltuğu", x: 23.9, y: 30.25, yon: "on", sira: 507 },
  ];
  function oturaklariKur(koru) {   // koru: düzen yenilenirken oturanlar kalkmasın
    for (const o of OTURAKLAR) {
      if (!koru) o.dolu = null;
      const oda = odaNo[Math.min(YUK - 1, Math.round(o.y))][Math.round(o.x)];
      const adaylar = o.yon === "arka" ? [[0, 1], [0, 2]] : o.yon === "on" ? [[0, 1], [0, 2], [-1, 1], [1, 1]] : o.yon === "sag" ? [[-1, 0], [0, 1], [-1, 1]] : [[1, 0], [0, 1], [1, 1]];
      const bx = Math.round(o.x), by = Math.round(o.y);
      o.yaklas = adaylar.map(([dx, dy]) => [bx + dx, by + dy]).find(([x, y]) => yurur[y] && yurur[y][x] && odaNo[y][x] === oda) || enYakinYurur(bx, by + 1);
    }
  }
  function gecis(a, x1, y1, sure, bitti) { a.gecis = { x0: a.x, y0: a.y, x1, y1, t: 0, sure, bitti }; }
  function oturt(a, o, sonraFn) {
    if (o.dolu) return;
    o.dolu = a;
    gonder(a, o.yaklas, () => {
      a.rezerve = null;
      if (o.dolu !== a) return;
      gecis(a, o.x, o.y, 0.3, () => { a.oturak = o; a.yon = o.yon === "sag" ? 0 : o.yon === "sol" ? 2 : o.yon === "arka" ? 1 : 3; sesKonum("tak", a.x, a.y); if (a.oyuncu && o.ad === TOPLANTI_KOLTUGU) toplantiKoltugu(); if (sonraFn) sonraFn(); });
    });
    if (!a.oturak && !a.gecis) a.rezerve = o;
  }
  function kalk(a, sonraFn) {
    const o = a.oturak; if (!o) { if (sonraFn) sonraFn(); return; }
    a.oturak = null; o.dolu = null;
    gecis(a, o.yaklas[0], o.yaklas[1], 0.25, sonraFn);
  }
  const bosOturak = (filtre = () => true) => OTURAKLAR.filter((o) => !o.dolu && filtre(o));
  function molaVer() {
    const bos = ajanlar.filter((a) => !a.oyuncu && !mesgul(a) && yerinde(a) && a.id !== "spiker");
    const a = rastgele(bos), yerler = bosOturak((o) => o.ad !== "misafir koltuğu" && o.ad !== "stüdyo koltuğu");
    if (!a || !yerler.length) return;
    const o = yerler.sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[Math.floor(Math.random() * Math.min(3, yerler.length))];
    a.ozel = "mola";
    oturt(a, o, () => {
      if (Math.random() < 0.6) sonra(1, () => konus(a, rastgele(["Beş dakika mola.", "Şu koltuk çok rahat.", "Gözlerimi dinlendiriyorum.", "Sütlaç'ı bekliyorum, gelir şimdi."]), true));
      sonra(8 + Math.random() * 6, () => { if (!a.rut) kalk(a, () => eveDon(a, () => (a.ozel = null))); });
    });
  }

  let molaZamani = 15;

  // ---------- gün planı (rutin) ----------
  // Sabah girişi, 10:00 ve 15:00 toplantıları, öğle arası, mesai bitişi. Ajan durumu: `disarda` (ofiste değil), `cikti` (bugün çıktı),
  // `rut` (rutinde: gelis | toplanti | ogle | cikis). mesgul() bunları meşgul sayar; olay() rutindeki/ofiste olmayan ajanı bekletir.
  const asansor = { acik: 0, son: -9 }, ASANSOR = { x: 730, y: 176 };
  const TOPLANTI_KOLTUGU = "toplantı koltuğu";
  let gun = 1, toplanti = null, ogle = null, sonKarne = null, karneZ = 0;
  const tekrarOnay = new Set();                           // reddedilip yeniden onaya gelen kartlar
  const stat = { toplanti: 0, sev: 0, mama: false };      // gün karnesi sayaçları
  const mama = { dolu: false, sonYeme: -99 };
  const dkT = (dk) => (dk - ACILIS) * DONGU / GUN_DK;     // dakika -> oyun saniyesi (açılıştan beri)
  const OGUNLER = ["ogle", "aksam"];                      // yemek arası kayıtları: RT.ogle, RT.aksam (rut adı da bu)
  // Ofis durumu: acik | kapaniyor (karne gösterildi, ekip çıkıyor) | kapali (yalnız asistan arşivde). Kapanış kaydı (kullanıcı "Ofisi kapat" dediyse)
  // localStorage'da: uygulama kapalıyken gün dönmediyse açılışta kapalı kalır. otoErtele: elle yeniden açılan ofis o gün otomatik kapanmaz (bastan sıfırlar).
  const OFIS_ANAHTAR = "ofis-demo-ofis-1";
  let ofisDurum = "acik", kapanisT = 0, otoErtele = false, kapatKayit = null;
  try { const h = JSON.parse(localStorage.getItem(OFIS_ANAHTAR) || "null"); if (h && typeof h.gun === "string" && Number.isFinite(h.z)) kapatKayit = { gun: h.gun, z: h.z, acik: !!h.acik }; } catch (e) { /* erişilemezse bellekte */ }
  const gunAnahtar = () => { const d = new Date(Date.now() + saatOfset - zaman * 1000); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  function kapatKayitYaz(acik) {   // acik: kullanıcı kapalı ofisi elle açtı (yedek kapanış o gün işlemez)
    kapatKayit = { gun: gunAnahtar(), z: zaman, acik: !!acik };
    try { localStorage.setItem(OFIS_ANAHTAR, JSON.stringify(kapatKayit)); } catch (e) { /* kayıt yok */ }
  }
  function kapatKayitSil() { kapatKayit = null; try { localStorage.removeItem(OFIS_ANAHTAR); } catch (e) { /* yok */ } }
  // Yedek otomatik kapanış zamanı (sn; Infinity = yok). Hızlı günde gün bitmeden çıkışlara yetecek kadar önce kapanır.
  const otoKapanisZamani = () => (otoErtele ? Infinity : GERCEK ? (OTO_KAPAT ? dkT((24 + OTO_KAPAT) * 60) : Infinity) : DONGU - Math.max(15, DONGU * 0.12));
  const asansorAc = () => { asansor.son = zaman; sesKonum("kapiAc", GIRIS[0], GIRIS[1]); };
  // Rutine alınabilir mi? Senaryo olayı, görev ve dedikodu bitmeden ajan alınmaz
  const rutinMusait = (a) => !a.disarda && !a.rut && !a.konusuyor && !a.gecis && !["olay", "gorev", "dedikodu", "beyin"].includes(a.ozel);
  function rutinAl(a, durum, hizK, sure = 40) {
    if (kedi.klavyeAjan === a) MOD("klavyedenIn", false);
    a.rut = durum; a.ozel = null; a.telefonSon = 0; a.yazSon = 0; a.hizK = hizK || 1; a.rutSon = zaman + sure;
  }
  function rutinEve(a) {
    if (diyalogAjan === a) diyalogKapat();
    a.rutSon = Infinity; a.hizK = 1.4;   // toplantıdan/öğleden dönüş biraz hızlı: yürüyüşler oyun saatine göre uzun sürüyor
    gonder(a, a.koltuk, () => { a.yon = 3; a.rut = null; a.hizK = 1; });
  }
  // Eylem ofiste olmayan ya da rutindeki ajanı gerektiriyorsa sebebini söyler ve true döner
  function musaitDegil(a) {
    if (!(a.disarda || a.rut)) return false;
    konus(diyalogAjan && diyalogAjan !== a ? diyalogAjan : oyuncu, `${a.ad} ${a.disarda ? (a.cikti ? "mesaiyi bitirdi" : "henüz gelmedi") : a.rut === "ogle" ? "öğle arasında" : a.rut === "aksam" ? "akşam yemeğinde" : "toplantıda"}.`, true);
    return true;
  }
  // Sabah: asansörden çıkıp masaya yürür
  function gelisBasla(a) {
    a.disarda = false; a.cikti = false; rutinAl(a, "gelis");
    a.x = GIRIS[0]; a.y = GIRIS[1] - 1; a.yol = []; a.yon = 3; a.balon = null; asansorAc();
    gecis(a, GIRIS[0], GIRIS[1], 0.45, () => gonder(a, a.koltuk, () => {
      a.yon = 3; a.rut = null; a.hizK = 1;
      if (Math.random() < 0.45) konus(a, rastgele(RT.gunaydin), true);
    }));
  }
  // Kapanışta: biraz hızlı yürüyüp asansöre girer, görünmez olur
  function cikisBasla(a) {
    if (diyalogAjan === a) { konus(a, `Mesai bitti ${OAD}, yarın görüşürüz!`); diyalogKapat(); }
    rutinAl(a, "cikis", 1.4, 60);
    // Masadan uzaktaysa (olay, mola) planlanan saatte asansörde olmak için hızlanır
    const uzun = yolBul([Math.round(a.x), Math.round(a.y)], GIRIS).length;
    a.hizK = Math.max(1.2, Math.min(3, uzun / (3.6 * Math.max(1, a.cikisVar - zaman))));
    if (Math.random() < 0.6) konus(a, rastgele(RT.cikis.sozler), true);
    gonder(a, GIRIS, () => {
      a.yon = 1; asansorAc();
      gecis(a, GIRIS[0], GIRIS[1] - 1, 0.45, () => { a.disarda = true; a.cikti = true; a.rut = null; a.hizK = 1; a.x = GIRIS[0]; a.y = GIRIS[1]; a.balon = null; a.rutSon = Infinity; });
    });
  }
  // Giriş saatleri sabit (gerçek saatte açılıştan itibaren 4 dk arayla); çıkış saatleri kapanışta (ofisKapat) yol uzunluğundan hesaplanır
  function rutinPlanla() {
    const G = RT.gelis.gercek;
    RT.gelis.sira.forEach((id, i) => { bul(id).gelisT = GERCEK ? dkT(ACILIS + G.bas + i * G.aralik) : RT.gelis.bas + i * RT.gelis.aralik; });
    for (const a of ajanlar) if (!a.oyuncu) a.cikisT = a.cikisVar = Infinity;
  }
  // ---- ofisi kapat / aç ----
  const saatDk = (dk) => `${String(Math.floor(dk / 60) % 24).padStart(2, "0")}:${String(dk % 60).padStart(2, "0")}`;
  function ofisArayuz() {   // header düğmesi + kapalı ofis kartı
    const d = ofisDurum, b = el("ofisKapat"), k = el("kapaliKart");
    if (b) { b.textContent = d === "acik" ? "🌙 Ofisi kapat" : d === "kapaniyor" ? "Kapanıyor…" : "☀️ Ofisi aç"; b.disabled = d === "kapaniyor"; b.classList.toggle("secili", d === "kapali"); }
    if (k) { k.hidden = d !== "kapali" || !!uzak; el("kapaliAcilis").textContent = el("kapatAcilis").textContent = saatDk(ACILIS); }
  }
  function ofisDurumKur(d) { ofisDurum = d; ofisArayuz(); }
  // Kapatma: karne gösterilir, ekip kapanış sırasıyla asansöre yürür (asistan kalır); herkes çıkınca ofis "kapalı" olur
  function ofisKapat(neden = "kullanici") {
    if (uzak || ofisDurum !== "acik") return false;
    kapanisT = zaman; tetik.add("karne");
    if (GERCEK && neden === "kullanici") kapatKayitYaz();
    ofisDurumKur("kapaniyor");
    let i = 0;
    for (const id of RT.cikis.sira) {
      const a = bul(id); if (!a || a.oyuncu) continue;
      if (RT.geceKalan.includes(id)) { a.cikisT = a.cikisVar = Infinity; continue; }
      if (a.disarda) { a.cikti = true; continue; }   // henüz gelmediyse hiç gelmez
      a.cikisT = zaman + rs(1, 4) + i * rs(0.35, 9);
      a.cikisVar = a.cikisT + yolBul(a.koltuk, GIRIS).length / (3.6 * 1.4); i++;
    }
    karneGoster(); SES.cal("ofisTik");
    gunluk(`Ofis kapanıyor (${saatYazi()}).`, true);
    return true;
  }
  // Kapalı ofisi şimdi aç: ekip sabahki gibi sırayla asansörden gelir; yedek otomatik kapanış bir süre ertelenir
  function ofisAc() {
    if (uzak || ofisDurum !== "kapali") return false;
    otoErtele = true; if (GERCEK) kapatKayitYaz(true);   // elle açılan ofis, kullanıcı kapatana ya da gün dönene dek açık kalır
    ofisDurumKur("acik");
    let i = 0;
    for (const id of RT.cikis.sira) {
      const a = bul(id); if (!a || a.oyuncu || RT.geceKalan.includes(id)) continue;
      tetik.delete("cikis:" + id); a.cikti = false; a.disarda = true; a.cikisT = a.cikisVar = Infinity;
      a.gelisT = zaman + rs(1, 3) + i * rs(0.6, 10); i++;
    }
    SES.cal("ofisTik"); gunluk(`Ofis açıldı (${saatYazi()}).`, true);
    return true;
  }
  // Saat atlayınca ya da açılışta: ofis o saatte açık mı kapalı mı (kayıtlı kapanış ya da yedek otomatik kapanış)
  function durumSenkron() {
    const kayit = GERCEK && kapatKayit && kapatKayit.gun === gunAnahtar() && zaman >= kapatKayit.z ? kapatKayit : null;   // kullanıcının o günkü son kararı
    const kapali = kayit ? !kayit.acik : zaman >= otoKapanisZamani();
    if (kapali && ofisDurum === "acik") { tetik.add("karne"); ofisDurumKur("kapali"); }
    else if (!kapali && ofisDurum !== "acik") ofisDurumKur("acik");
  }
  function ajanTemizle(a) {
    if (a.oturak) { a.oturak.dolu = null; a.oturak = null; }
    if (a.rezerve && a.rezerve.dolu === a) a.rezerve.dolu = null;
    Object.assign(a, { gecis: null, yol: [], sonra: null, rezerve: null, rut: null, ozel: null, hizK: 1, balon: null, rutSon: Infinity });
  }
  // zamanAyarla (test), açılış ve uyku dönüşü: ofis durumunu kurar, ajanları o saatte olmaları gereken yere koyar
  function rutinSenkron() {
    durumSenkron();
    for (const a of ajanlar) {
      if (a.oyuncu || a.konusuyor) continue;
      const kalir = RT.geceKalan.includes(a.id);
      const koy = () => { ajanTemizle(a); Object.assign(a, { disarda: false, cikti: false, x: a.koltuk[0], y: a.koltuk[1], yon: 3 }); };
      if (ofisDurum !== "acik" && !kalir) {   // kapalı ofis: herkes çıkmış (asistan hariç)
        if (!(a.cikti && a.disarda)) { ajanTemizle(a); Object.assign(a, { disarda: true, cikti: true, x: GIRIS[0], y: GIRIS[1] }); }
        tetik.add("cikis:" + a.id);
      } else if (a.disarda && !a.cikti && (zaman >= a.gelisT + 16 || (kalir && GERCEK))) koy();
      else if (a.cikti) {
        tetik.delete("cikis:" + a.id);
        if (zaman >= a.gelisT + 16 || kalir) koy(); else { ajanTemizle(a); Object.assign(a, { cikti: false, disarda: true, x: GIRIS[0], y: GIRIS[1] }); }
      }
    }
  }
  function rutinGuncelle(dt) {
    asansor.acik += ((zaman - asansor.son < 1.4 ? 1 : 0) - asansor.acik) * Math.min(1, dt * 8);
    for (const a of ajanlar) {
      if (a.oyuncu) continue;
      if (a.disarda && !a.cikti && !a.rut && !a.gecis && zaman >= a.gelisT) gelisBasla(a);
      const k = "cikis:" + a.id;
      if (!a.disarda && !tetik.has(k) && zaman >= a.cikisT && !a.gecis) { tetik.add(k); cikisBasla(a); }   // kapanışta her şeyi bırakır
      if (zaman > a.rutSon && (a.rut === "toplanti" || a.rut === "ogle" || a.rut === "aksam")) rutinEve(a);   // takılan olursa masasına dön
    }
    toplantiKontrol(); ogleKontrol();
    if (ofisDurum === "acik" && zaman >= otoKapanisZamani()) ofisKapat("oto");   // yedek otomatik kapanış
    else if (ofisDurum === "kapaniyor" && ajanlar.every((a) => a.oyuncu || RT.geceKalan.includes(a.id) || (a.disarda && a.cikti))) {
      ofisDurumKur("kapali"); gunluk("Ofis kapalı; asistan arşivde kaldı.", true); MOD("ofisKapandi");   // oda günlüklerine "gün bitti" ayıracı
    }
  }

  // Toplantı: üyeler toplantı koltuklarına oturur; oyuncu da oturursa sırayla 1'er cümle rapor verirler, gelmezse dağılırlar
  function toplantiKontrol() {
    RT.toplantilar.forEach((m, i) => {
      const t0 = dkT(m.dk), k = "top:" + i;
      if (toplanti || tetik.has(k) || ofisDurum !== "acik") return;
      if (zaman >= t0 - rs(5, 120) && zaman < t0 + rs(14, 660)) {   // gerçek saatte 2 dk önce toplanır, 10 dk oyuncuyu bekler
        tetik.add(k);
        toplanti = { m, t0, uyeler: m.uyeler.map(bul), cagri: new Set(), oturdu: new Set(), koltuk: new Map(), durum: "toplaniyor", sira: [], son: 0, aktif: null };
        gunluk(`${m.saat} toplantısı başlıyor: ${m.konu}.`, true);
      } else if (zaman >= t0 + rs(14, 660)) tetik.add(k);   // zaman ileri sarıldı, toplantı atlandı
    });
    const T_ = toplanti; if (!T_) return;
    // Çağrı: üyeler 0.35 sn arayla, müsait olunca, boş koltuğa
    T_.uyeler.forEach((a, i) => {
      if (T_.durum === "bitti" || T_.cagri.has(a.id) || a.disarda || zaman < T_.t0 - rs(6, 120) + i * rs(0.35, 4) || !rutinMusait(a)) return;
      const o = bosOturak((x) => x.ad === TOPLANTI_KOLTUGU).sort((p, q) => (p.yon === "on" ? 0 : 1) - (q.yon === "on" ? 0 : 1) || Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
      if (!o) return;
      T_.cagri.add(a.id); T_.koltuk.set(a.id, o); rutinAl(a, "toplanti", 1.4, rs(60, 3600));
      oturt(a, o, () => { T_.oturdu.add(a.id); a.hizK = 1; });
    });
    const oturan = T_.uyeler.filter((a) => a.oturak && a.oturak === T_.koltuk.get(a.id) && !a.gecis);
    const oyuncuVar = !!(oyuncu.oturak && oyuncu.oturak.ad === TOPLANTI_KOLTUGU && !oyuncu.gecis);
    if (T_.durum === "toplaniyor") {
      if (oyuncuVar && oturan.length && (oturan.length >= T_.cagri.size || zaman >= T_.t0 + rs(6, 120))) {
        T_.durum = "rapor"; T_.sira = oturan.slice(); T_.son = zaman + 1.4; stat.toplanti++; gorevBitir("toplanti");   // erken oturup bekleyen oyuncu da katılmış sayılır
        konus(oyuncu, T_.m.acilis, true); gunluk(`Toplantı (${T_.m.saat}): ${OAD} katıldı, ${oturan.length} kişi rapor verecek.`);
      } else if (zaman >= T_.t0 + rs(12, 600)) toplantiDagit(true);
    } else if (T_.durum === "rapor" && zaman >= T_.son) {
      const a = T_.sira.shift();
      if (a && a.oturak) { konus(a, T_.m.raporlar[a.id]); T_.aktif = a; T_.son = zaman + 3.4; }
      else if (!a) {
        T_.aktif = null;
        if (MOD("toplantiKarar", T_, () => { gunluk(`Toplantı (${T_.m.saat}) bitti.`); SES.cal("bildirim"); toplantiDagit(false); })) T_.durum = "karar";   // modül karar sorar, bitince kapatır
        else { konus(oyuncu, "Teşekkürler, toplantı bitti.", true); gunluk(`Toplantı (${T_.m.saat}) bitti.`); SES.cal("bildirim"); toplantiDagit(false); }
      }
    }
  }
  // Oyuncu toplantı koltuğuna oturdu: toplantı sürüyorsa görev tamam; iki toplantı da kaçtıysa notları okumak da sayılır
  function toplantiKoltugu() {
    if (toplanti && toplanti.durum !== "bitti") return gorevBitir("toplanti");
    const g = gorevler.find((x) => x.id === "toplanti"), sonT = dkT(RT.toplantilar[RT.toplantilar.length - 1].dk) + rs(14, 660);
    if (g && !g.bitti && !toplanti && zaman >= sonT && !stat.toplanti) { konus(oyuncu, "Kaçırdığım toplantıların notlarını okudum.", true); gorevBitir("toplanti"); }
  }
  function toplantiDagit(gelmedi) {
    const T_ = toplanti, kim = T_.uyeler.find((a) => a.oturak && a.oturak === T_.koltuk.get(a.id));
    T_.durum = "bitti"; T_.aktif = null;
    if (gelmedi) { gunluk(`Toplantı (${T_.m.saat}) ${OAD} gelmeyince dağıldı.`, true); if (kim) konus(kim, `${OAD} gelmedi, dağılalım. Notları paylaşırım.`); }
    T_.uyeler.forEach((a, i) => { if (T_.cagri.has(a.id)) sonra(0.6 + i * 0.45, () => { if (a.rut === "toplanti") rutinEve(a); }); });
    sonra(5, () => { if (toplanti === T_) toplanti = null; });
  }

  // Öğle arası ve akşam yemeği: bir kısmı mutfak sandalyesine oturur, bir kısmı kahve makinesine gider, sonra masasına döner (rut: ogle | aksam)
  function ogleKontrol() {
    for (const ad of OGUNLER) {
      const O = RT[ad], t0 = dkT(O.dk), t1 = dkT(O.bitis);
      if (ogle || tetik.has("yemek:" + ad) || ofisDurum !== "acik") continue;
      if (zaman >= t0 - 1 && zaman < t1 - 4) {
        tetik.add("yemek:" + ad);
        ogle = { ad, kahveNo: 0, bekle: [...O.otur.map((id) => ({ id, tur: "otur" })), ...O.kahve.map((id) => ({ id, tur: "kahve" }))] };
        ogle.bekle.forEach((b, i) => (b.bas = t0 - 1 + i * rs(0.7, 20)));
        gunluk(ad === "ogle" ? "Öğle arası: bir kısmı mutfağa iniyor." : "Akşam yemeği: bir kısmı mutfağa iniyor.", true);
      } else if (zaman >= t1 - 4) tetik.add("yemek:" + ad);
    }
    if (!ogle) return;
    const t1 = dkT(RT[ogle.ad].bitis);
    ogle.bekle = ogle.bekle.filter((b) => {
      const a = bul(b.id);
      if (a.disarda || zaman > t1 - 4 || ofisDurum !== "acik") return false;
      if (zaman < b.bas || !rutinMusait(a)) return true;
      ogleGit(a, b.tur); return false;
    });
    if (!ogle.bekle.length && zaman > t1) ogle = null;
  }
  function ogleGit(a, tur) {
    const ad = ogle.ad, O = RT[ad], t1 = dkT(O.bitis);
    rutinAl(a, ad, 1.5, rs(30, t1 - zaman + 900));
    // hızlı günde birkaç sn; gerçek saatte oturanlar yemek bitimine yakın kalkar, kahveciler 5-10 dk kalır
    const kal = GERCEK ? (tur === "otur" ? Math.max(60, t1 - zaman - Math.random() * 600) : 300 + Math.random() * 300) : 3.5 + Math.random() * 1.5;
    const bitir = () => { if (a.rut === ad) rutinEve(a); };
    const o = tur === "otur" ? bosOturak((x) => x.ad === "mutfak sandalyesi")[0] : null;
    if (o) oturt(a, o, () => { konus(a, rastgele(O.sozler), true); sonra(kal, bitir); });
    else {
      const yer = [KAHVE, [KAHVE[0] - 1, KAHVE[1]]][ogle.kahveNo++ % 2];
      gonder(a, yer, () => { a.yon = 1; sesKonum("kahve", a.x, a.y); konus(a, ad === "ogle" ? "Öğle kahvesi ☕" : "Akşam kahvesi ☕", true); sonra(kal, bitir); });
    }
  }

  // ---------- günün işleri ve gün karnesi ----------
  let gorevler = [];   // {id, ad, ipucu, bitti}
  function gorevleriYenile() {
    const sabit = V.gorevler.filter((g) => g.sabit), havuz = V.gorevler.filter((g) => !g.sabit).sort(() => Math.random() - 0.5);
    const secilen = [...sabit, ...havuz.slice(0, Math.max(0, V.gorevSayisi - sabit.length))];
    gorevler = V.gorevler.filter((g) => secilen.includes(g)).map((g) => ({ ...g, bitti: false }));
    gorevCiz();
  }
  function gorevCiz(yeniId) {
    const ul = el("gorevler"); ul.textContent = "";
    for (const g of gorevler) {
      const li = document.createElement("li"); li.className = (g.bitti ? "bitti" : "") + (g.id === yeniId ? " yeni" : "");
      li.setAttribute("role", "checkbox"); li.setAttribute("aria-checked", g.bitti);
      li.innerHTML = '<span class="kutu"></span><span><span class="ad"></span><span class="not"></span></span>';
      li.querySelector(".kutu").textContent = g.bitti ? "✓" : ""; li.querySelector(".ad").textContent = g.ad; li.querySelector(".not").textContent = g.ipucu;
      ul.appendChild(li);
    }
    el("gorevSay").textContent = `Gün ${gun} · ${gorevler.filter((g) => g.bitti).length}/${gorevler.length}`;
  }
  function gorevBitir(id) {
    const g = gorevler.find((x) => x.id === id); if (!g || g.bitti) return;
    g.bitti = true; gorevCiz(id); SES.cal("gorev"); gunluk(`✔ Görev tamam: ${g.ad}`);
    if (oyuncu) kalpler(oyuncu, 3);
  }
  // Ofis morali: biten iş + toplantıya katılım + Sütlaç sevgisi; Sütlaç memnuniyeti: mama + sevgi
  function karneHesapla() {
    const biten = gorevler.filter((g) => g.bitti).length;
    const moral = Math.min(100, 30 + 9 * biten + 8 * stat.toplanti + Math.min(10, 2 * stat.sev));
    const sutlac = Math.min(100, 25 + (stat.mama ? 40 : 0) + Math.min(35, 7 * stat.sev));
    return { gun, biten, toplam: gorevler.length, toplanti: stat.toplanti, sev: stat.sev, moral, sutlac, yorum: rastgele(RT.karneYorum[moral >= 80 ? "yuksek" : moral >= 55 ? "orta" : "dusuk"]) };
  }
  function karneHtml(k) {
    const cubuk = (d, kedi_) => `<div class="cubuk"><i class="${kedi_ ? "kedi" : ""}" style="width:${d}%"></i></div>`;
    return `<div class="satir"><span>Biten işler</span><b>${k.biten}/${k.toplam}</b></div>` +
      `<div class="satir"><span>Ofis morali</span><b>%${k.moral}</b></div>${cubuk(k.moral)}` +
      `<div class="satir"><span>Sütlaç memnuniyeti</span><b>%${k.sutlac}</b></div>${cubuk(k.sutlac, true)}` +
      `<div class="satir"><span>Toplantı katılımı</span><b>${k.toplanti}/${RT.toplantilar.length}</b></div>` +
      `<div class="yorum">“${k.yorum}”</div>`;
  }
  function karneGoster() {
    const k = sonKarne = karneHesapla(), html = karneHtml(k);
    el("karneBaslik").textContent = `Gün ${k.gun} karnesi · ${saatYazi()}`; el("karneGovde").innerHTML = html; el("karne").classList.add("acik");
    el("karneIc").innerHTML = html; el("karneGun").textContent = `Gün ${k.gun}`; el("karneKart").hidden = false;
    SES.cal("karne"); gunluk(`Gün ${k.gun} karnesi: ${k.biten}/${k.toplam} iş, ofis morali %${k.moral}, Sütlaç %${k.sutlac}.`);
    kedi.balon = k.sutlac >= 80 ? "Mrrr ♥ (5 yıldız)" : k.sutlac >= 50 ? "Miyav. İdare eder." : "Miyav… (mama kabı boş kaldı)"; kedi.balonSon = zaman + 4;
    clearTimeout(karneZ); karneZ = setTimeout(karneKapat, 20000);
  }
  function karneKapat() { clearTimeout(karneZ); el("karne").classList.remove("acik"); }
  el("karneKapat").onclick = karneKapat;

  // ---------- güncelleme ----------
  // Oyuncu: tutulan yön tuşuna göre karo karo yürür
  function oyuncuTusu() {
    const basili = tuslar.size || tekAdim;   // tekAdim: aynı karede basılıp bırakılan tuş da bir adım attırır
    if (oyuncu && oyuncu.oturak && basili && !oyuncu.gecis && !diyalogAjan) kalk(oyuncu);
    // Sıradaki adım, mevcut karoya varmadan (0,6 karo kala) sıraya alınır: karo başına duraksama olmaz, yön değişimi daha çabuk algılanır.
    // Yön değişimi anında uygulanır: yürürken başka yöne basılırsa karonun bitmesi beklenmez; en yakın karo merkezinden yeni yöne (hafif çapraz kayarak) dönülür.
    if (oyuncu && basili && !diyalogAjan && !oyuncu.oturak && !oyuncu.gecis && oyuncu.yol.length && oyuncu.yol.length <= 2) {
      const [wx, wy] = YONLER[tuslar.size ? [...tuslar].pop() : tekAdim];
      const sx = Math.sign(oyuncu.yol[0][0] - oyuncu.x), sy = Math.sign(oyuncu.yol[0][1] - oyuncu.y);
      if ((wx !== 0 && sx !== wx) || (wy !== 0 && sy !== wy)) {
        const cx = Math.round(oyuncu.x), cy = Math.round(oyuncu.y);
        if (gecebilir(cx, cy, cx + wx, cy + wy)) { oyuncu.yol = [[cx + wx, cy + wy]]; oyuncu.sonra = null; oyuncu.yon = YONLER[tuslar.size ? [...tuslar].pop() : tekAdim][2]; tekAdim = null; }
      }
    }
    const sirada = oyuncu && oyuncu.yol.length === 1 && Math.hypot(oyuncu.yol[0][0] - oyuncu.x, oyuncu.yol[0][1] - oyuncu.y) < 0.6;
    if (oyuncu && !diyalogAjan && (!oyuncu.yol.length || sirada) && !oyuncu.oturak && !oyuncu.gecis && basili) {
      const [dx, dy, yi] = YONLER[tuslar.size ? [...tuslar].pop() : tekAdim]; tekAdim = null;
      const bx = oyuncu.yol.length ? oyuncu.yol[0][0] : Math.round(oyuncu.x), by = oyuncu.yol.length ? oyuncu.yol[0][1] : Math.round(oyuncu.y);
      if (!oyuncu.yol.length) oyuncu.yon = yi;
      const nx = bx + dx, ny = by + dy;
      if (gecebilir(bx, by, nx, ny)) { oyuncu.yol.push([nx, ny]); oyuncu.sonra = null; }
    }
  }
  // Bir karakterin bir adımı: oturma yumuşatması, geçiş (gecis), yazma, yürüme. Kendi ofiste herkes için, ziyaretteyken yalnız oyuncu için çalışır.
  function ajanAdimla(a, dt, yuruyenler, yazanlar) {
    a.vurgu = Math.max(0, a.vurgu - dt);
    // masaya oturma/kalkma: 0..1 arası yumuşak geçiş (çizimde 5 px iniş + bacak kırpması bununla orantılı)
    const masada = yerinde(a) && zaman >= a.telefonSon && !(zaman < efekt.parti && !a.yol.length) && !a.gecis && !a.oturak && !a.ayakta;
    a.oturK = (a.oturK || 0) + ((masada ? 1 : 0) - (a.oturK || 0)) * Math.min(1, dt * 12);
    if (a.gecis) {
      const q = a.gecis; q.t += dt; const k = Math.min(1, q.t / q.sure);
      a.x = q.x0 + (q.x1 - q.x0) * k; a.y = q.y0 + (q.y1 - q.y0) * k;
      if (k >= 1) { a.gecis = null; if (q.bitti) q.bitti(); }
      return;
    }
    if (!a.oyuncu && yerinde(a) && !a.yazSon && !a.konusuyor && Math.random() < dt * 0.15) a.yazSon = zaman + 1 + Math.random() * 3;
    if (a.yazSon && zaman > a.yazSon) a.yazSon = 0;
    if (yerinde(a) && a.yazSon) yazanlar.push(a);
    if (!a.yol.length) return;
    yuruyenler.push(a);
    const [hx, hy] = a.yol[0], dx = hx - a.x, dy = hy - a.y, m = Math.hypot(dx, dy), v = (a.oyuncu ? (zaman < efekt.kafein ? 8.5 : 5) * yurumeK : 3.6 * a.hizK) * dt;
    a.yon = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy < 0 ? 1 : 3;
    if (m <= v) { a.x = hx; a.y = hy; a.yol.shift(); if (!a.yol.length && a.sonra) { const fn = a.sonra; a.sonra = null; fn(); } }
    else { a.x += (dx / m) * v; a.y += (dy / m) * v; }
  }
  let sonSaatYazi = "";
  function adimSesleri(yuruyenler, yazanlar) {
    const simdi = performance.now();
    if (yuruyenler.length && simdi - sonAdimSes > 300 / hiz) {
      sonAdimSes = simdi; const w = yuruyenler.includes(oyuncu) && Math.random() < 0.6 ? oyuncu : rastgele(yuruyenler); sesKonum("adim", w.x, w.y);
    }
    if (yazanlar.length && simdi - sonKlavye > 420) { sonKlavye = simdi; if (Math.random() < 0.6) { const w = rastgele(yazanlar); sesKonum("klavye", w.x, w.y, 1); } }
    // Saat yazısı yalnız değişince yazılır: her karede DOM'a yazmak, hemen ardından boyutla()'daki getBoundingClientRect ile
    // her karede zorunlu yerleşim hesabı (reflow) yaptırıyor ve yürürken kasmaya yol açıyordu.
    const sy = saatYazi(); if (sy !== sonSaatYazi) { sonSaatYazi = sy; el("saat").textContent = sy; }
    // Oyuncu hangi odadaysa ambiyans o odaya geçer (yumuşak geçişi SES yapar)
    if (oyuncu) { const no = odaKaro(oyuncu.x, oyuncu.y); if (no !== sesOdaNo) { sesOdaNo = no; if (no >= 0) SES.oda(ODALAR[no].id); } }
  }
  function adimla(dt) {
    if (uzak) return uzakAdimla(dt);
    zaman += dt;
    if (zaman > DONGU) bastan(false);
    const vadesi = bekleyen.filter((b) => zaman >= b.t); bekleyen = bekleyen.filter((b) => zaman < b.t); vadesi.forEach((b) => b.fn());   // zamanlayıcı içinden sonra() eklenebilir
    const ol = olcek();
    V.olaylar.forEach((o, i) => { if (!tetik.has(i) && zaman >= o.t * ol) { tetik.add(i); olay(o); } });
    rutinGuncelle(dt);
    MOD("guncelle", dt);
    ortam();
    kapilariGuncelle(dt);
    MOD("kediGuncelle", dt); parcaciklarGuncelle(dt); MOD("surprizGuncelle");
    oyuncuTusu();
    const yuruyenler = [], yazanlar = [];
    for (const a of ajanlar) ajanAdimla(a, dt, yuruyenler, yazanlar);
    adimSesleri(yuruyenler, yazanlar);
  }

  // ---------- uzak mod (başka birinin ofisini ziyaret) ----------
  // Misafir tarafı: kendi simülasyonu DURUR (zaman, olaylar, rutin, kedi, senaryo adımlanmaz); ekranda ev sahibinin ofisi çizilir: ev sahibinin düzeni,
  // ajanların adı/rolü/konumu (ev sahibi tarayıcısının ~4 Hz anlık görüntüsünden, burada yumuşatılır), kedi ve saat. Yalnız `oyuncu` (kendi karakterin,
  // kendi görünümünle) gerçekten yürür. Kendi ofisinin durumu uzakGir'de saklanır, uzakCik'ta aynen geri yüklenir.
  const UZAK_ALAN = ["x", "y", "yol", "yon", "ad", "rol", "balon", "balonSon", "sonra", "disarda", "oturak", "gecis", "konusuyor", "ozel", "telefonSon", "yazSon", "oturK",
    "rezerve", "rut", "vurgu", "hizK", "uh", "balonUzak"];
  function uzakGir(s) {   // s: {dakika, odaAdi, ajanlar: [{id, ad, rol, karakter}], duzen}; katalog sayfaları modülce yüklenmiştir
    if (uzak || !oyuncu) return false;
    if (diyalogAjan) diyalogKapat();
    tuslar.clear(); tekAdim = null; oyuncu.yol = []; oyuncu.sonra = null;
    if (oyuncu.oturak) { oyuncu.oturak.dolu = null; oyuncu.oturak = null; }
    const yonetim = ODALAR.find((o) => o.id === "yonetim"), kayit = {
      zaman, duzen, efekt: { ...efekt }, kedi: { ...kedi }, asansor: { ...asansor }, odaAd: yonetim && yonetim.ad, kameraYakin, secili, parcaciklar,
      ajanlar: ajanlar.map((a) => [a, Object.fromEntries(UZAK_ALAN.map((k) => [k, a[k]])), img.k[a.id]]),
    };
    uzak = { dakika: Number.isFinite(s.dakika) ? s.dakika : 7 * 60, kayit };
    Object.assign(efekt, { parti: 0, kafein: 0, sonDakika: 0, balik: 0 }); parcaciklar = [];
    Object.assign(kedi, { yol: [], sonra: null, klavyeAjan: null, ust: null, balon: null, balonSon: 0, kare: 0 });
    for (const a of ajanlar) {
      if (a.oyuncu) continue;
      Object.assign(a, { yol: [], sonra: null, gecis: null, konusuyor: false, oturak: null, rezerve: null, rut: null, ozel: null, disarda: true, balon: null, balonSon: 0,
        telefonSon: 0, yazSon: 0, uh: null, hizK: 1 });
      const b = s.ajanlar.find((x) => x.id === a.id);   // ev sahibinin ad/rol/karakteri (veri: modül doğrulamıştır)
      if (b) {
        a.ad = b.ad; a.rol = b.rol;
        if (b.karakter && b.karakter !== a.karakter) yukle(`${KG}0_Premade_Characters/16x16/Premade_Character_${String(b.karakter).padStart(2, "0")}.png`).then((i) => { if (uzak && uzak.kayit === kayit) img.k[a.id] = i; }, () => {});
      }
    }
    if (yonetim && s.odaAdi) yonetim.ad = s.odaAdi;
    duzen = duzenTemizle(s.duzen); yerlesimYenile();   // ev sahibinin düzeni: yürünebilirlik, statik katman, oturak noktaları, ışık modülü
    ekKarakterler.length = 0;
    oyuncu.x = GIRIS[0]; oyuncu.y = GIRIS[1] - 1; oyuncu.yon = 3; asansorAc();
    gecis(oyuncu, GIRIS[0], GIRIS[1], 0.45);
    document.body.classList.add("uzak");
    return true;
  }
  function uzakCik() {
    if (!uzak) return false;
    const k = uzak.kayit; uzak = null;
    document.body.classList.remove("uzak");
    ekKarakterler.length = 0; tuslar.clear(); tekAdim = null;
    for (const [a, alanlar, im] of k.ajanlar) { Object.assign(a, alanlar); img.k[a.id] = im; }
    duzen = k.duzen; yerlesimYenile();
    const yonetim = ODALAR.find((o) => o.id === "yonetim"); if (yonetim && k.odaAd) yonetim.ad = k.odaAd;
    Object.assign(efekt, k.efekt); Object.assign(kedi, k.kedi); Object.assign(asansor, k.asansor); parcaciklar = k.parcaciklar;
    zaman = k.zaman; secili = k.secili;
    if (k.kameraYakin !== kameraYakin) kameraDegis();
    // kendi asansöründen çıkar (ev sahibi asansörüne girip kendininkinden çıkmış olur)
    Object.assign(oyuncu, { x: GIRIS[0], y: GIRIS[1] - 1, yol: [], sonra: null, gecis: null, oturak: null, yon: 3 }); asansorAc();
    gecis(oyuncu, GIRIS[0], GIRIS[1], 0.45);
    return true;
  }
  // Ev sahibi anlık görüntüsü: [id, x, y, yon, yuruyor, oturakNo, disarda, telefon, yazıyor, balon(0/1/2)]; kedi {x, y, b, d, yu, h, u}; d = ofis dakikası
  function uzakAn(an) {
    if (!uzak || !an) return;
    if (Number.isFinite(an.d)) uzak.dakika = an.d;
    for (const r of an.a || []) {
      const a = bul(r[0]); if (!a || a.oyuncu) continue;
      const ilk = !a.uh;
      a.uh = { x: r[1], y: r[2] }; a.yon = r[3]; a.disarda = !!r[6];
      a.oturak = r[5] >= 0 && OTURAKLAR[r[5]] ? OTURAKLAR[r[5]] : null;
      a.telefonSon = r[7] ? zaman + 0.7 : 0; a.yazSon = r[8] ? zaman + 0.7 : 0;
      if (r[9]) { a.balon = r[9] === 2 ? "💭 çalışıyor…" : "…"; a.balonSon = zaman + 0.7; a.balonUzak = true; }   // gerçek balon metni ev sahibinden gelmez
      else if (a.balonUzak) { a.balon = null; a.balonSon = 0; a.balonUzak = false; }
      if (ilk || a.disarda) { a.x = r[1]; a.y = r[2]; }
    }
    const k = an.k;
    if (k) {
      const ilk = !kedi.uh;
      kedi.uh = { x: k.x, y: k.y }; kedi.bakis = k.b; kedi.durum = k.d; kedi.hiz = k.h || 2.2; kedi.ust = k.u ? { px: k.u[0], py: k.u[1], sira: k.u[2] } : null;
      if (ilk) { kedi.x = k.x; kedi.y = k.y; }
    }
  }
  function uzakAdimla(dt) {
    zaman += dt;   // yalnız animasyonlar için; uzakCik zamanı geri yükler
    asansor.acik += ((zaman - asansor.son < 1.4 ? 1 : 0) - asansor.acik) * Math.min(1, dt * 8);
    kapilariGuncelle(dt); parcaciklarGuncelle(dt); kedi.kare += dt;
    oyuncuTusu();
    const yuruyenler = [], yazanlar = [];
    ajanAdimla(oyuncu, dt, yuruyenler, yazanlar);
    const yumusat = (c, hedef, hiz_) => {   // hedefe doğru yumuşak; uzaksa ışınla; "yürüyor" görünümü kalan mesafeye göre
      const dx = hedef.x - c.x, dy = hedef.y - c.y, m = Math.hypot(dx, dy);
      if (m < 0.03 || m > 6) { c.x = hedef.x; c.y = hedef.y; return 0; }
      const k = Math.min(1, dt * hiz_); c.x += dx * k; c.y += dy * k; return m;
    };
    for (const a of ajanlar) {
      if (a.oyuncu || !a.uh) continue;
      const m = a.oturak ? (yumusat(a, a.uh, 10), 0) : yumusat(a, a.uh, 10);
      a.yol = !a.oturak && m > 0.1 ? [[a.uh.x, a.uh.y]] : [];
      const masada = yerinde(a) && zaman >= a.telefonSon && !a.oturak && !a.ayakta;
      a.oturK = (a.oturK || 0) + ((masada ? 1 : 0) - (a.oturK || 0)) * Math.min(1, dt * 12);
      if (a.yol.length) yuruyenler.push(a); else if (a.yazSon && yerinde(a)) yazanlar.push(a);
    }
    if (kedi.uh) { const m = yumusat(kedi, kedi.uh, 8); kedi.yol = m > 0.1 ? [[kedi.uh.x, kedi.uh.y]] : []; }
    MOD("uzakGuncelle", dt);
    adimSesleri(yuruyenler, yazanlar);
  }

  // ---------- çizim ----------
  const OTUR_INIS = -4, OTUR_KIRP = 4;   // masada beklerken karakterin dikey kayması (px, eksi = yukarı) ve alttan kırpılan satır
  function ajanCiz(a) {
    if (a.oturak) {
      const o = a.oturak, px = Math.round(a.x * T), py = Math.round(a.y * T - T), adim = Math.floor(zaman * 2) % 6;
      if (o.yon === "sag" || o.yon === "sol") f.drawImage(img.k[a.id], ((o.yon === "sag" ? 0 : 6) + adim) * 16, 4 * 32, 16, 32, px, py, 16, 32);
      else if (o.yon === "on") f.drawImage(img.k[a.id], (18 + adim) * 16, 32, 16, 24, px, py + 5, 16, 24);
      else f.drawImage(img.k[a.id], (6 + adim) * 16, 32, 16, 32, px, py + 3, 16, 32);
      return;
    }
    const yuruyor = a.yol.length > 0, tel = zaman < a.telefonSon, dans = zaman < efekt.parti && !yuruyor;
    // Masasında bekleyen ajan oturur: önden bekleme karesi OTUR_INIS px yukarıda (monitörün arkasında yüz ve omuzlar görünsün; 5 px aşağıdayken
    // monitör yüzü kapatıyor, karakter masada "kayboluyordu"), bacaklar kırpılır; masa önde, koltuk sırtı arkada kalır
    const k = a.oturK || 0, ini = Math.round(OTUR_INIS * k), boy = 32 - Math.round(OTUR_KIRP * k);
    if (yerinde(a) && !tel && !dans && !a.gecis) {
      const px = Math.round(a.x * T), py = Math.round(a.y * T - T);
      f.drawImage(img.k[a.id], (18 + (Math.floor(zaman * 3) % 6)) * 16, 32, 16, boy, px, py + ini, 16, boy);
      return;
    }
    // LimeZu karakter sayfası: satır 1 bekleme, 2 yürüme, 6 telefon (kare 4-9 döngü)
    let satir, kr;
    if (tel) { satir = 6; kr = 3 + (Math.floor(zaman * 6) % 6); }
    else {
      const yon = dans ? Math.floor(zaman * 4 + a.x) % 4 : a.yon;
      satir = yuruyor ? 2 : 1; kr = yon * 6 + (Math.floor(zaman * (yuruyor ? 10 : 5)) % 6);
    }
    const px = Math.round(a.x * T), py = Math.round(a.y * T - T - (zaman < efekt.parti ? Math.abs(Math.sin(zaman * 9 + a.x)) * 3 : 0));
    f.fillStyle = a.oyuncu ? "rgba(242,207,74,.45)" : "rgba(20,16,30,.22)"; f.beginPath(); f.ellipse(px + 8, py + 30, a.oyuncu ? 7 : 6, a.oyuncu ? 3 : 2, 0, 0, 7); f.fill();
    f.drawImage(img.k[a.id], kr * 16, satir * 32, 16, boy, px, py + ini, 16, boy);   // kalkarken ini/boy 0'a yumuşar
  }
  function kapiCiz(k) {
    const { x, y } = k;
    // paketin cam çift kanat kapısı (animated_door_glass_double: 32x48 kare, 0 kapalı → 4 tam açık); alt kenar duvar tabanına oturur
    f.fillStyle = "#2e2b3a"; f.fillRect(x + 1, y + 2, 30, 29);   // kapı aralığının arkası
    f.fillStyle = "#3d3a52"; f.fillRect(x + 1, y + 2, 30, 6);
    f.drawImage(img.kapi, Math.min(4, Math.round(k.acik * 4)) * 32, 0, 32, 48, x, y + 31 - 48, 32, 48);
    f.fillStyle = k.acik > 0.5 ? "#5bf06c" : "#e0484c"; f.fillRect(x + 15, y - 1, 2, 1);
  }
  function kapilariGuncelle(dt) {
    for (const k of kapilar) {
      const yakin = [...ajanlar, kedi, ...ekKarakterler].some((a) => !a.disarda && Math.abs(a.x - (k.kx + 0.5)) < 1.4 && a.y > k.ky - 1.8 && a.y < k.ky + 2.8);
      const hedef = yakin ? 1 : 0;
      if (hedef && !k.sesli) { k.sesli = true; sesKonum("kapiAc", k.kx + 1, k.ky + 1); }
      if (!hedef && k.sesli && k.acik > 0.6) { k.sesli = false; sesKonum("kapiKapa", k.kx + 1, k.ky + 1); }
      k.acik += (hedef - k.acik) * Math.min(1, dt * 9);
    }
  }
  // Giriş asansörü: kanatlar kayar, açıkken içerisi aydınlanır ve önüne ışık düşer
  function asansorCiz() {
    const ax = ASANSOR.x, ay = ASANSOR.y, o = asansor.acik, pw = Math.round(10 * (1 - o));
    f.fillStyle = "#2e2b3a"; f.fillRect(ax + 4, ay + 8, 20, 23);
    if (o > 0.02) {
      f.fillStyle = "#e9d9a0"; f.fillRect(ax + 5, ay + 9, 18, 21); f.fillStyle = "#cdbb82"; f.fillRect(ax + 5, ay + 9, 18, 3); f.fillRect(ax + 13, ay + 12, 1, 18);
      f.fillStyle = `rgba(255,235,170,${0.22 * o})`; f.fillRect(ax + 4, ay + 32, 20, 7);
    }
    f.fillStyle = "#a9afc0"; f.fillRect(ax + 4, ay + 8, pw, 23); f.fillRect(ax + 24 - pw, ay + 8, pw, 23);
    if (pw > 1) { f.fillStyle = "#cfd5e3"; f.fillRect(ax + 5, ay + 9, 1, 21); f.fillRect(ax + 24 - pw, ay + 9, 1, 21); }
    f.fillStyle = o > 0.5 ? "#5bf06c" : "#e0484c"; f.fillRect(ax + 10, ay + 3, 8, 1);
  }
  function canliCiz() {
    const t = zaman;
    for (const k of kapilar) kapiCiz(k);
    for (const s of sunucular) for (let k = 0; k < 4; k++) {
      const yan = Math.sin(t * (3 + k * 1.7) + s.x) > 0.1;
      f.fillStyle = yan ? (k % 2 ? "#f5b942" : "#5bf06c") : "#1e3b24"; f.fillRect(s.x + s.w - 6, s.y + 8 + k * 6, 1, 1);
    }
    // (Monitörler artık çalışana dönük, kameraya arkası görünür: ekrandaki yazı çizgileri çizilmez. Yazan çalışanın yüzüne mavi ışık vurur.)
    for (const m of monitorler) {
      const a = m.sahip && bul(m.sahip);
      const yaziyor = (kedi.klavyeAjan && m.sahip === kedi.klavyeAjan.id) || (a && a.yazSon && yerinde(a));
      if (!yaziyor) continue;
      f.fillStyle = `rgba(143,227,240,${0.16 + 0.1 * Math.sin(t * 9)})`; f.fillRect(m.x - 1, m.y - 15, m.w + 2, 6);   // yüze vuran ekran ışığı (monitörün üstünden görünür)
    }
    asansorCiz();
    if (!uzak) MOD("canliCiz", t);   // Sütlaç'ın mama kabı, sıkışan yazıcının ışığı
    for (const e of ekranlar) {
      const { x, y, w, h } = e.n;
      if (e.tur === "kontrol" && t < taramaParlak) { f.fillStyle = "rgba(242,207,74,.8)"; f.fillRect(x + 4 + Math.floor((t * 50) % (w - 8)), y + 2, 1, h - 12); }
      if (e.tur === "grafik") {
        f.fillStyle = "#0f1a2a"; f.fillRect(x + 2, y + 2, w - 4, h - 5);
        f.fillStyle = "#24364f"; for (let gx = x + 6; gx < x + w - 3; gx += 8) f.fillRect(gx, y + 3, 1, h - 7);
        let yy = y + h / 2;
        for (let i = 0; i < w - 6; i++) {
          const v = Math.sin((i + t * 6) * 0.21) * 5 + Math.sin((i + t * 3) * 0.07) * 4, ny = y + h / 2 - v;
          f.fillStyle = ny < yy ? "#5bf06c" : "#ef5b5b"; f.fillRect(x + 3 + i, Math.round(Math.min(ny, yy)), 1, Math.max(1, Math.round(Math.abs(ny - yy)))); yy = ny;
        }
        if (t < taramaParlak) { f.fillStyle = "#f2cf4a"; f.fillRect(x + 3 + Math.floor((t * 40) % (w - 6)), y + 3, 1, h - 7); }
      } else if (e.tur === "gundem") {
        f.fillStyle = "#16243f"; f.fillRect(x + 2, y + 2, w - 4, h - 5); f.fillStyle = "#c62f37"; f.fillRect(x + 2, y + h - 10, w - 4, 6);
        f.fillStyle = "#2f6fb3"; f.fillRect(x + 4, y + 4, 26, 12); f.fillStyle = "#79c3f0"; f.fillRect(x + 6, y + 6, 8, 3); f.fillRect(x + 6, y + 11, 18, 1);
      } else if (e.tur === "brifing") {
        f.fillStyle = "#1d2236"; f.fillRect(x + 4, y + 4, w - 8, 27); f.fillStyle = "#f2cf4a"; f.fillRect(x + 6, y + 6, 3, 3);   // perdeye düşen slayt
      } else if (e.tur === "studyo") {
        f.fillStyle = "#0b1730"; f.fillRect(x + 2, y + 2, w - 4, h - 5); f.fillStyle = "#c62f37"; f.fillRect(x + 2, y + h - 9, w - 4, 5);
        for (let i = 0; i < 6; i++) { f.fillStyle = `rgba(95,176,234,${0.25 + 0.2 * Math.sin(t * 2 + i)})`; f.fillRect(x + 8 + i * 18, y + 6, 12, 8); }
      } else if (e.tur === "yayin") {
        f.fillStyle = Math.sin(t * 4) > 0 ? "#e0484c" : "#5a1c1f"; f.fillRect(x + 4, y + 4, 4, 4);
      }
    }
  }
  // Işık tonu: kişi.json "tema" ({ton: "r,g,b", seviye}) ile gelir; varsayılan ton yok (seviye 0). Cozy mod ve gizli kelime geçici olarak artırır (ic.ton).
  const TEMA = KISI.tema || {}, TON_RENK = TEMA.ton || "255,190,140", TON_TABAN = TEMA.seviye || 0;
  let PEMBE_TON = TON_TABAN;
  function cizHepsi(gdt = 0.016) {
    f.drawImage(statik, 0, 0);
    MOD("zeminIsik");   // moduller/isik.js: sabah hüzmeleri, nesnelerin altında
    canliCiz();
    const liste = nesneler.map((n) => ({ s: n.sira, ciz: () => cizNesne(f, n) }))
      .concat(ajanlar.filter((a) => !a.disarda).map((a) => ({ s: a.oturak && a.oturak.sira ? a.oturak.sira + 1 : a.y * T + T + 0.5, ciz: () => ajanCiz(a) })),
        ekKarakterler.filter((a) => !a.disarda && img.k[a.id]).map((a) => ({ s: a.oturak && a.oturak.sira ? a.oturak.sira + 1 : a.y * T + T + 0.5, ciz: () => ajanCiz(a) })), [{ s: kediSira(), ciz: () => MOD("kediCiz") }]);
    liste.sort((p, q) => p.s - q.s).forEach((o) => o.ciz());
    boyutla(); kameraGuncelle(gdt);
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#0d0e12"; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(kare, 0, 0, W, H, Math.round(-kam.x * kam.o), Math.round(-kam.y * kam.o), Math.round(W * kam.o), Math.round(H * kam.o));
    // Işık tonu (tema + cozy mod): tek bir yumuşak ışık katmanı (maliyeti bir fillRect); 0 ise çizilmez
    // (soft-light karışımı yazılımsal tuvallerde pahalıydı; düz yarı saydam dolgu çok daha ucuz)
    if (PEMBE_TON > 0) { g.fillStyle = `rgba(${TON_RENK},${PEMBE_TON})`; g.fillRect(0, 0, cv.width, cv.height); }
    MOD("geceCiz");     // moduller/isik.js: akşam karanlığı, lambalar, disko
    MOD("duzenCiz");    // moduller/duzenle.js: ızgara, yerleştirilecek eşya, seçim
    ustKatman();
  }
  function kameraGuncelle(gdt) {
    const hedefO = kameraYakin ? tamO() * kameraK : tamO(), k = Math.min(1, gdt * 7);
    kam.o += (hedefO - kam.o) * k; if (Math.abs(hedefO - kam.o) < 0.01) kam.o = hedefO;
    const gw = cv.width / kam.o, gh = cv.height / kam.o;
    // Görüş haritadan genişse ortala, değilse sınırla
    const sinirla = (v, gor, dunya) => (gor >= dunya ? (dunya - gor) / 2 : Math.max(0, Math.min(dunya - gor, v)));
    let hx = 0, hy = 0;
    const iz = kamTakip && !kamTakip.disarda ? kamTakip : oyuncu;
    if (kameraYakin && iz) { hx = iz.x * T + 8 - gw / 2; hy = iz.y * T - gh / 2; }
    hx = sinirla(hx, gw, W); hy = sinirla(hy, gh, H);
    kam.x += (hx - kam.x) * k; kam.y += (hy - kam.y) * k;
    kam.x = sinirla(kam.x, gw, W); kam.y = sinirla(kam.y, gh, H);
  }
  const ex = (px) => (px - kam.x) * kam.o, ey = (py) => (py - kam.y) * kam.o;

  function yazi(metin, x, y, boyut, renk, ops = {}) {
    g.font = `${ops.kalin === false ? "" : "bold "}${boyut}px ${ops.yazitipi || YT()}`;
    g.textBaseline = "top"; g.textAlign = ops.hiza || "left";
    if (ops.golge) { g.fillStyle = ops.golge; g.fillText(metin, x + yo, y + yo); }
    g.fillStyle = renk; g.fillText(metin, x, y); g.textAlign = "left";
  }
  function ustKatman() {
    const k = kam.o / 2;
    balonAlanlari = [];
    for (const o of ODALAR) yazi(o.ad, ex(o.x * T) + 10 * yo, ey((o.y + o.h) * T) - 24 * yo, 13 * yo, "rgba(255,255,255,.7)", { golge: "rgba(20,16,30,.55)" });
    for (const e of ekranlar) {
      const { x, y, w, h } = e.n, X = ex(x), Y = ey(y), Wd = w * kam.o, Hd = h * kam.o;
      if (X > cv.width || Y > cv.height || X + Wd < 0 || Y + Hd < 0) continue;
      g.save(); g.beginPath(); g.rect(X + 4 * k, Y + 4 * k, Wd - 8 * k, Hd - 10 * k); g.clip();
      if (e.tur === "gundem") {
        yazi(TV.gundem_ust || "CANLI", X + 68 * k, Y + 8 * k, 12 * k, "#ffffff"); yazi(TV.gundem_alt || "GÜNDEM", X + 68 * k, Y + 22 * k, 11 * k, "#79c3f0", { kalin: false });
        const m = zaman < efekt.sonDakika ? `SON DAKİKA · ${KISI.tam} habersiz ${TV.yer_ek || "stüdyoya"} daldı · Sütlaç olay yerinde   •   ` : V.manset.join("   •   ") + "   •   ";
        g.font = `bold ${11 * k}px ${YT()}`; const gw = g.measureText(m).width;
        yazi(m + m, X + 6 * k - ((zaman * 40 * k) % gw), Y + Hd - 20 * k, 11 * k, "#ffffff");
      } else if (e.tur === "brifing" && toplanti && !uzak) {
        const T_ = toplanti, en = Wd - 16 * k, rapor = T_.durum === "rapor" && T_.aktif ? `${T_.aktif.ad}: ${T_.m.raporlar[T_.aktif.id] || ""}` : "";
        const durum = rapor || (T_.durum === "rapor" ? "Rapor sırası…" : T_.durum === "karar" ? `Karar: ${OAD}` : T_.durum === "bitti" ? "Toplantı bitti" : `${OAD} bekleniyor… ${T_.oturdu.size}/${T_.cagri.size}`);
        yaziSigdir(`TOPLANTI · ${T_.m.saat}`, X + 8 * k, Y + 6 * k, 11 * k, "#f2cf4a", en);
        yaziSigdir(T_.m.konu, X + 8 * k, Y + 17 * k, 10 * k, "#ffffff", en);
        yaziSigdir(durum, X + 8 * k, Y + 26 * k, 9 * k, "#cfd2dc", en, { kalin: false });
      } else if (e.tur === "brifing") {
        yazi("SABAH BRİFİNGİ", X + 22 * k, Y + 12 * k, 12 * k, "#f2cf4a"); yazi(`${saatYazi()} · 3 ekip, 2 onay`, X + 14 * k, Y + 32 * k, 11 * k, "#cfd2dc", { kalin: false });
      } else if (e.tur === "studyo") {
        yazi(TV.studyo || "KK HABER", X + Wd / 2, Y + 10 * k, 16 * k, "#ffffff", { hiza: "center" });
        if (zaman < kayitSon) yazi(TV.studyo_kayit || "● KAYIT", X + 8 * k, Y + 8 * k, 11 * k, Math.sin(zaman * 5) > 0 ? "#ff6b6b" : "#8a3b3e");
        yazi(zaman < efekt.sonDakika ? `SON DAKİKA: ${KISI.buyuk(OAD)} ${KISI.buyuk(TV.yer || "STÜDYODA")}!` : V.manset[Math.floor(zaman / 6) % V.manset.length], X + 8 * k, Y + Hd - 18 * k, 10 * k, zaman < efekt.sonDakika ? "#ffe066" : "#ffffff");
      } else if (e.tur === "yayin") {
        yazi(TV.yayin || "YAYIN", X + 20 * k, Y + 4 * k, 12 * k, Math.sin(zaman * 4) > 0 ? "#ff6b6b" : "#8a3b3e");
      }
      g.restore();
    }
    const hedef = !diyalogAjan && yakinHedef(), yakin = hedef && hedef.tur === "ajan" ? hedef.hedef : null;
    for (const a of ajanlar) if (a === uzerinde || a === secili || a.oyuncu || a === yakin) isimEtiketi(a);
    for (const a of ekKarakterler) if (img.k[a.id]) isimEtiketi(a);   // misafirler / ziyaretteki ev sahibi: adı hep görünür
    if (uzerinde === kedi || (hedef && hedef.tur === "kedi")) isimEtiketi(kedi);
    for (const a of ajanlar) if (a.vurgu > 0 && !a.disarda) { g.strokeStyle = `rgba(227,107,93,${Math.min(1, a.vurgu)})`; g.lineWidth = 2 * yo; g.strokeRect(ex(a.x * T) - 2, ey((a.y - 1) * T), T * kam.o + 4, 2 * T * kam.o); }
    parcaciklarCiz();
    // Aşağıdakiler önce yerleşir; çakışan balon yukarı kayar
    // Dar ekranda en önemli birkaç balon: oyuncu, konuşulan ajan, oyuncuya yakın ve en yeni olanlar; geri kalanı günlükte zaten var
    const dar = cv.width / yo < 760, puan = (a) => (a.oyuncu ? 1e4 : 0) + (a.konusuyor ? 5e3 : 0) + a.balonSon - (oyuncu ? Math.hypot(a.x - oyuncu.x, a.y - oyuncu.y) * 3 : 0);
    [...ajanlar, kedi, ...ekKarakterler].filter((a) => a.balon && zaman <= a.balonSon && !a.disarda).sort((p, q) => puan(q) - puan(p)).slice(0, dar ? 3 : 7)
      .sort((p, q) => q.y - p.y).forEach(balonCiz);
    if (hedef && !(hedef.hedef && hedef.hedef.balon && zaman < hedef.hedef.balonSon)) konusIpucu(hedef.x, hedef.y, hedef.etiket);
    if (!document.hasFocus()) {
      g.fillStyle = "rgba(20,22,28,.92)"; yuvarlak(cv.width / 2 - 170 * yo, 10 * yo, 340 * yo, 30 * yo, 8 * yo); g.fill();
      yazi("Klavye için haritaya bir kez tıkla", cv.width / 2, 17 * yo, 14 * yo, "#f2cf4a", { hiza: "center" });
    }
    // HUD
    const u = yo, hx = cv.width - 236 * u, hy = cv.height - 38 * u;
    g.fillStyle = "rgba(14,14,20,.85)"; yuvarlak(hx, hy, 226 * u, 28 * u, 6 * u); g.fill();
    g.fillStyle = Math.sin(zaman * 3) > -0.3 ? "#4ade80" : "#14532d"; g.beginPath(); g.arc(hx + 14 * u, hy + 14 * u, 4.5 * u, 0, 7); g.fill();
    const mono = { yazitipi: "ui-monospace, Consolas, monospace" };
    yazi("CANLI", hx + 24 * u, hy + 7 * u, 12 * u, "#e8e6df", mono);
    yazi(ofisDurum === "acik" ? "OFİS AÇIK" : "OFİS KAPALI", hx + 76 * u, hy + 7 * u, 12 * u, ofisDurum === "acik" ? "#4ade80" : "#f5b942", mono);
    yazi(saatYazi(), hx + 172 * u, hy + 7 * u, 12 * u, "#f2cf4a", mono);
    MOD("ustKatmanSon", hy);   // moduller/mini-harita.js (HUD'un üstü)
  }
  function konusIpucu(wx, wy, etiket) {
    const u = yo; g.font = `bold ${14 * u}px ${YT()}`;
    const w = g.measureText(etiket).width + 44 * u; let x = ex(wx), y = ey(wy) - 36 * u;
    // Bir balonla çakışırsa ipucu oyuncunun ayaklarının altına iner
    if (balonAlanlari.some((r) => x - w / 2 < r.x + r.w && x + w / 2 > r.x && y < r.y + r.h + 10 * u && y + 28 * u > r.y)) { x = ex(oyuncu.x * T + 8); y = ey(oyuncu.y * T + T) + 26 * u; }
    g.fillStyle = "rgba(20,22,28,.94)"; yuvarlak(x - w / 2, y, w, 28 * u, 7 * u); g.fill();
    g.fillStyle = "#f2cf4a"; yuvarlak(x - w / 2 + 6 * u, y + 5 * u, 20 * u, 18 * u, 4 * u); g.fill();
    yazi("E", x - w / 2 + 16 * u, y + 6 * u, 14 * u, "#1d2029", { hiza: "center" }); yazi(etiket, x - w / 2 + 32 * u, y + 6 * u, 14 * u, "#f3efe4");
  }
  function isimEtiketi(a) {
    if (a.disarda) return;
    const u = yo, x = ex(a.x * T + 8), y = ey(a.y * T + T) + 2 * u;
    g.font = `bold ${13 * u}px ${YT()}`; const w = g.measureText(a.ad).width + 14 * u;
    g.fillStyle = a.oyuncu ? "rgba(242,207,74,.97)" : a.kedi ? "rgba(255,240,245,.97)" : "rgba(20,22,28,.9)"; yuvarlak(x - w / 2, y, w, 20 * u, 5 * u); g.fill();
    yazi(a.ad, x, y + 3 * u, 13 * u, a.oyuncu || a.kedi ? "#1d2029" : "#f3efe4", { hiza: "center" });
  }
  function balonCiz(a) {
    if (!a.balon || zaman > a.balonSon || a.disarda) return;
    const u = yo * Math.max(0.72, Math.min(1, cv.width / (900 * yo))), gov = `${15 * u}px ${YT()}`;   // dar tuvalde küçülür
    g.font = gov; const satirlar = sar(a.balon, Math.min(230 * u, cv.width * 0.55));
    g.font = `bold ${13 * u}px ${YT()}`; const bw = g.measureText(a.ad).width;
    g.font = gov;
    const sh = 20 * u, gw = Math.max(bw, ...satirlar.map((s) => g.measureText(s).width)) + 22 * u, gh = satirlar.length * sh + 30 * u;
    const ax = ex(a.x * T + 8), uc = ey(a.y * T - T + (a.kedi ? 12 : 4));
    if (ax < -60 * u || ax > cv.width + 60 * u) return;
    let bx = Math.max(6 * u, Math.min(cv.width - gw - 6 * u, ax - gw / 2)), by = uc - gh - 10 * u;
    const cakisan = () => balonAlanlari.find((r) => bx < r.x + r.w + 6 * u && bx + gw > r.x - 6 * u && by < r.y + r.h + 6 * u && by + gh > r.y - 6 * u);
    for (let i = 0; i < 8; i++) { const c = cakisan(); if (!c) break; by = c.y - gh - 8 * u; }
    by = Math.max(6 * u, by);
    if (cakisan() && !a.oyuncu) return;   // yer kalmadıysa üst üste binmek yerine atla (oyuncununki her zaman görünür)
    balonAlanlari.push({ x: bx, y: by, w: gw, h: gh });
    const kx = Math.max(bx + 12 * u, Math.min(bx + gw - 12 * u, ax));
    g.fillStyle = "#fffdf6"; g.strokeStyle = "#2b2838"; g.lineWidth = 2.5 * u;
    g.beginPath(); g.moveTo(kx - 7 * u, by + gh - 2); g.lineTo(ax, uc); g.lineTo(kx + 7 * u, by + gh - 2); g.closePath(); g.fill(); g.stroke();
    yuvarlak(bx, by, gw, gh, 9 * u); g.fill(); g.stroke();
    g.fillRect(kx - 6 * u, by + gh - 4 * u, 12 * u, 4 * u);
    yazi(a.ad, bx + 11 * u, by + 7 * u, 13 * u, a.oyuncu ? "#9a6a10" : a.kedi ? "#b4506c" : "#5a4fb0");
    satirlar.forEach((s, i) => yazi(s, bx + 11 * u, by + 25 * u + i * sh, 15 * u, "#14161c", { kalin: false }));
  }
  // Metni verilen genişliğe sığacak boyutta yazar (perde gibi dar alanlar için)
  function yaziSigdir(metin, x, y, boyut, renk, en, ops) {
    g.font = `${ops && ops.kalin === false ? "" : "bold "}${boyut}px ${YT()}`;
    const w = g.measureText(metin).width; yazi(metin, x, y, w > en ? (boyut * en) / w : boyut, renk, ops);
  }
  function sar(metin, en) {
    const s = []; let st_ = "";
    for (const k of metin.split(" ")) { const d = st_ ? st_ + " " + k : k; if (g.measureText(d).width > en && st_) { s.push(st_); st_ = k; } else st_ = d; }
    s.push(st_); return s;
  }
  function yuvarlak(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

  // ---------- etkileşim ----------
  function dunya(e) {
    const r = cv.getBoundingClientRect(), olc = Math.min(r.width / cv.width, r.height / cv.height);
    const ox = (r.width - cv.width * olc) / 2, oy = (r.height - cv.height * olc) / 2;
    return [(e.clientX - r.left - ox) / olc / kam.o + kam.x, (e.clientY - r.top - oy) / olc / kam.o + kam.y];
  }
  function ajanBul(e) {
    const [wx, wy] = dunya(e), x = wx / T, y = wy / T;
    const kx = kedi.ust ? kedi.ust.px / T : kedi.x, ky = kedi.ust ? kedi.ust.py / T : kedi.y;
    if (x >= kx - 0.1 && x < kx + 1.1 && y >= ky - 0.2 && y < ky + 1.1) return kedi;
    return ajanlar.find((a) => !a.disarda && x >= a.x - 0.1 && x < a.x + 1.1 && y >= a.y - 1.1 && y < a.y + 1.1) || null;
  }
  cv.addEventListener("mousemove", (e) => {
    if (MOD("fareHareket", e)) { uzerinde = null; return; }   // mini harita üstünde
    uzerinde = ajanBul(e); cv.style.cursor = uzerinde && !uzerinde.oyuncu ? "pointer" : "default";
  });
  // Dokunma ve Apple Pencil (pointerType "touch"/"pen") pointerup ile hemen işlenir; fare click ile. Aynı dokunuştan gelen click'i atlarız
  // (Safari'de kalem/dokunma için click bazen gecikir ya da hiç gelmez).
  let sonPointerTik = 0, pointerBas = null;
  cv.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") pointerBas = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
  cv.addEventListener("pointerup", (e) => {
    if (e.pointerType === "mouse" || !pointerBas || pointerBas.id !== e.pointerId) return;
    const b = pointerBas; pointerBas = null;
    if (Math.hypot(e.clientX - b.x, e.clientY - b.y) > 14 || performance.now() - b.t > 700) return;   // sürükleme ya da uzun basma: tıklama sayılmaz
    sonPointerTik = performance.now(); tiklaIsle(e);
  });
  cv.addEventListener("pointercancel", () => { pointerBas = null; });
  cv.addEventListener("click", (e) => { if (e.pointerType !== "mouse" && performance.now() - sonPointerTik < 600) return; tiklaIsle(e); });
  function tiklaIsle(e) {
    cv.focus();
    if (diyalogAjan || !oyuncu) return;
    if (MOD("tikla", e)) return;   // mini haritadan odaya yürü
    const a = uzak ? null : ajanBul(e);
    if (a === kedi) { gonder(oyuncu, kedi.ust ? [Math.round(kedi.ust.px / T), Math.round(kedi.ust.py / T) + 2] : yanKaro(kedi), () => { if (yakinHedef()?.tur === "kedi") MOD("kediSev"); }); return; }
    const dokunmatik = !uzak && document.documentElement.classList.contains("dokunmatik") && e.pointerType !== "mouse";
    if (a && a.oyuncu) {
      if (dokunmatik) { const h = yakinHedef(); if (h) { etkiles(h); return; } }   // karakterine dokunmak = E (yakındaki şeyi kullan)
      MOD("oyuncuTiklandi");   // sürpriz: 10 kez tıklanınca
      return;
    }
    if (dokunmatik) {   // karakterin üstündeki "E ..." etiketine dokunmak da E gibi çalışır
      const [ex_, ey_] = dunya(e), qx = ex_ / T, qy = ey_ / T;
      if (Math.abs(qx - (oyuncu.x + 0.5)) < 2.6 && qy > oyuncu.y - 2.8 && qy < oyuncu.y - 1.0) { const h = yakinHedef(); if (h) { etkiles(h); return; } }
    }
    if (a && !a.oyuncu) {
      secAjan(a);
      gonder(oyuncu, ziyaretNoktasi(a), () => { if (Math.hypot(a.x - oyuncu.x, a.y - oyuncu.y) <= 2.6) diyalogAc(a); });
      return;
    }
    const [wx, wy] = dunya(e), tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    // Eşyaya ya da boş oturağa dokunmak: yanına yürü ve kullan (dokunmatikte E düğmesine gerek kalmaz)
    if (dokunmatik) {
      const px = wx / T, py = wy / T;
      const oturak = oyuncu.oturak ? null : OTURAKLAR.find((o) => !o.dolu && Math.hypot(o.x + 0.5 - px, o.y - 0.5 - py) < 0.9);
      if (oturak) { tuslar.clear(); oturt(oyuncu, oturak); return; }
      let en = null;
      // E düğmesi olmadığı için nesneye yakın dokunuş yeterli (1,6 karo)
      for (const n of NESNELER) { const d = Math.hypot(n.x - px, n.y - py); if (d < 1.6 && (!en || d < en.d)) en = { n, d }; }
      if (en) {
        const n = en.n; tuslar.clear();
        gonder(oyuncu, enYakinYurur(Math.round(n.x), Math.round(n.y)), () => { if (Math.hypot(n.x - oyuncu.x, n.y - oyuncu.y) <= n.r + 0.4) n.fn(); });
        return;
      }
    }
    if (yurur[ty] && yurur[ty][tx]) { tuslar.clear(); gonder(oyuncu, [tx, ty]); }
  }
  // e.code fiziksel tuşu verir: Türkçe F/Q düzeninde de WASD aynı yerde çalışır
  const TUS = { ArrowRight: "sag", KeyD: "sag", ArrowLeft: "sol", KeyA: "sol", ArrowUp: "yukari", KeyW: "yukari", ArrowDown: "asagi", KeyS: "asagi" };
  addEventListener("keydown", (e) => {
    if (!oyuncu || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;   // ayar paneli alanlarında oyun tuşları çalışmaz
    if (!uzak) MOD("tusGozle", e);   // gizli kodlar (sürprizler: Konami, "sütlaç")
    if (!diyalogAjan && MOD("tus", e)) return;   // modül tuşları (M: mini harita)
    if (diyalogAjan) {
      if (e.key === "Escape") diyalogKapat();
      const rakam = /^(Digit|Numpad)(\d)$/.exec(e.code), n = rakam ? +rakam[2] : parseInt(e.key, 10);
      if (n >= 1 && n <= 9) { const b = el("secenekler").children[n - 1]; if (b) b.click(); }
      if (TUS[e.code]) e.preventDefault();
      return;
    }
    if (TUS[e.code]) { tuslar.delete(TUS[e.code]); tuslar.add(TUS[e.code]); if (!e.repeat) { oyuncu.yol = oyuncu.yol.slice(0, 1); oyuncu.sonra = null; tekAdim = TUS[e.code]; } e.preventDefault(); }
    else if (e.code === "KeyE" || (e.key === "Enter" && e.target.tagName !== "BUTTON")) { const h = yakinHedef(); if (h) { etkiles(h); e.preventDefault(); } }
    else if (e.code === "KeyZ") kameraDegis();
  });
  addEventListener("keyup", (e) => { if (TUS[e.code]) tuslar.delete(TUS[e.code]); });
  addEventListener("blur", () => { tuslar.clear(); tekAdim = null; });
  function kameraDegis() {
    kameraYakin = !kameraYakin;
    el("kamera").textContent = kameraYakin ? "🎥 Yakın kamera" : "🗺️ Tüm ofis"; el("kamera").classList.toggle("secili", kameraYakin);
  }
  el("kamera").onclick = kameraDegis;
  document.querySelectorAll("[data-hiz]").forEach((b) => (b.onclick = () => {
    hiz = +b.dataset.hiz; document.querySelectorAll("[data-hiz]").forEach((x) => x.classList.toggle("secili", x === b));
  }));
  el("bastan").onclick = () => { bastan(true); if (GERCEK) gercegeAtla(gercekZaman()); };
  // Ofisi kapat / aç: kapatmadan önce onay sorulur (Modern UI kutusu); kapalıyken aynı düğme ve kart "Ofisi şimdi aç" der
  const kapatOnay = el("kapatOnay");
  const onayGoster = (a) => { kapatOnay.hidden = !a; if (a) el("kapatEvet").focus(); else cv.focus(); };
  // "🌙 Ofisi kapat": önce asistanın gün kapatma konuşması (moduller/etkilesim.js > gunKapatma: biten işler, yarının ilk adımı; "Ofisi kapat" ya da "Biraz daha kalayım"),
  // konuşma bitince ya da geçilince karne + çıkış akışı (ofisKapat). Konuşma başlatılamazsa (asistan yok/meşgul, ziyaret) eski onay kutusu açılır.
  el("ofisKapat").onclick = () => {
    if (ofisDurum === "acik") { if (!kapatOnay.hidden) return onayGoster(false); if (!uzak && MOD("gunKapatma", () => ofisKapat("kullanici")) === true) return; onayGoster(true); }
    else if (ofisDurum === "kapali") ofisAc();
  };
  el("kapatEvet").onclick = () => { onayGoster(false); ofisKapat("kullanici"); };
  el("kapatHayir").onclick = () => onayGoster(false);
  el("ofisAcDugme").onclick = () => { ofisAc(); cv.focus(); };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !kapatOnay.hidden) { onayGoster(false); e.stopPropagation(); } }, true);
  el("ses").onclick = () => {
    if (SES.acik) { SES.kapat(); el("ses").textContent = "🔇 Sesi aç"; el("ses").classList.remove("secili"); }
    else { SES.ac(); el("ses").textContent = "🔊 Ses açık"; el("ses").classList.add("secili"); }
  };

  // ---------- başlat ----------
  const yukle = (src) => new Promise((ok, hata) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => hata(src); i.src = encodeURI(src); });
  let onceki = performance.now();
  let donguHata = false;
  let fpsSay = 0, fpsT0 = performance.now();
  let sonrakiKare = 0;
  const takilmalar = []; let tanıAcik = false, tanıSon = 0;
  addEventListener("keydown", (e) => {
    if (e.code !== "F3") return;
    e.preventDefault(); tanıAcik = !tanıAcik; let k = document.getElementById("tani");
    if (!k) { k = document.createElement("pre"); k.id = "tani"; k.style.cssText = "position:fixed;left:8px;top:8px;z-index:50;margin:0;padding:6px 8px;background:rgba(14,16,22,.85);color:#e8e6df;font:12px/1.35 Consolas,monospace;border-radius:6px;pointer-events:none;white-space:pre"; document.body.appendChild(k); }
    k.style.display = tanıAcik ? "block" : "none";
  });
  function dongu(t) {
    // 144 Hz ekranda her yenilemede tam çizim gereksiz (çöp toplama baskısı ve takılmalar): ortalama 60 kare/sn çizilir (Stardew gibi)
    // 4 ms tolerans: 60 Hz ekranda kare zamanlaması 1-2 ms oynayınca kare atlanıp 30 fps'e düşmesin
    if (t < sonrakiKare - 4) { requestAnimationFrame(dongu); return; }
    sonrakiKare = t - sonrakiKare > 100 ? t + 1000 / 60 : sonrakiKare + 1000 / 60;
    if (++fpsSay >= 60) { const n = performance.now(); window.OFIS_FPS = Math.round((fpsSay * 1000) / (n - fpsT0)); document.title = `Ofis · ${KISI.tam} · ${window.OFIS_FPS} fps`; fpsSay = 0; fpsT0 = n; }   // sekme başlığında kare hızı (tanı için)
    try {
      const gdt = Math.min(0.1, (t - onceki) / 1000), aralik = t - onceki; onceki = t;
      const m0 = performance.now();
      if (uzak) adimla(gdt); else if (GERCEK) gercekAdim(); else adimla(gdt * hiz);   // ziyaretteyken saat ev sahibinindir: gerçek saate atlama (gercegeAtla) çalışmaz
      const m1 = performance.now();
      cizHepsi(gdt);
      const m2 = performance.now();
      // Tanı (F3): kareler arası süre uzadıysa kaydet. adım/çizim JS süresi küçük, aralık büyükse takılma tarayıcı/ekran kartı tarafındadır.
      if (aralik > 45 || m2 - m0 > 20) { takilmalar.push({ s: new Date().toTimeString().slice(0, 8), aralik: Math.round(aralik), adim: +(m1 - m0).toFixed(1), ciz: +(m2 - m1).toFixed(1) }); if (takilmalar.length > 8) takilmalar.shift(); }
      if (tanıAcik && t - tanıSon > 500) { tanıSon = t; el("tani").textContent = `fps ~${Math.round(1000 / Math.max(1, aralik))} | adım ${(m1 - m0).toFixed(1)} ms | çizim ${(m2 - m1).toFixed(1)} ms | takılma ${takilmalar.length}\n` + takilmalar.map((x) => `${x.s} aralık ${x.aralik} adım ${x.adim} çiz ${x.ciz}`).join("\n"); }
    } catch (e) {
      if (!donguHata) { donguHata = true; console.error("Ofis döngüsü hata verdi (sürüyor):", e); }   // tek bozuk kare oyunu dondurmasın; hata bir kez yazılır
    } finally { requestAnimationFrame(dongu); }
  }

  (async () => {
    img.ic = await yukle(KOK + "Interiors_free/16x16/Interiors_free_16x16.png");
    img.rb = await yukle(KOK + "Interiors_free/16x16/Room_Builder_free_16x16.png");
    img.rbo = await yukle("varliklar/limezu-ofis/1_Room_Builder_Office/Room_Builder_Office_16x16.png");
    img.atlas = await yukle("varliklar/atlas.png");
    const HK = "varliklar/limezu-tam/3_Animated_objects/16x16/spritesheets/";
    img.kapi = await yukle(HK + "animated_door_glass_double.png");
    img.hk = { tv: await yukle(HK + "animated_TV_reportage.png"), kontrol: await yukle(HK + "animated_control_room_screens.png"),
      sunucu: await yukle(HK + "animated_control_room_server.png"), kahve: await yukle(HK + "animated_coffee.png"),
      akvaryum: await yukle(HK + "animated_fishtank_orange.png"), guguk: await yukle(HK + "animated_cuckoo_clock.png") };
    img.kediYat = await yukle(HK + "animated_cat.png");   // Sütlaç modülü beyazlatır
    img.k = {};
    img.portre = { oyuncu: await yukle("varliklar/ui/portre-oyuncu.png"), ada: await yukle("varliklar/ui/portre-ada.png") };   // Modern UI
    for (const a of ajanlar) img.k[a.id] = await yukle(a.oyuncu ? "varliklar/oyuncu.png" : `${KG}0_Premade_Characters/16x16/Premade_Character_${String(a.karakter).padStart(2, "0")}.png`);
    img.kat = {};
    duzen = duzenTemizle(await duzenOku());   // kullanıcının düzeni ve onun gerektirdiği katalog sayfaları
    for (const id of new Set(duzen.eklenen.filter((e) => e.k.startsWith("kat:")).map((e) => katId(e.k)))) if (KAT.ogeler[id]) await katYukle(id).catch(() => delete img.kat[id]);
    yerlesim(); statikCiz(); oturaklariKur(); oyuncu = ajanlar.find((a) => a.oyuncu); oyuncu.x = OYUNCU_BAS[0]; oyuncu.y = OYUNCU_BAS[1]; cv.focus();
    // Modül betikleri ofis.js'ten sonra gelir; görseller önce yüklenirse modüller kaydolana dek bekle
    if (document.readyState === "loading") await new Promise((ok) => addEventListener("DOMContentLoaded", ok, { once: true }));
    // Modüllerin kullandığı çekirdek arayüzü (moduller/*.js). Durum değişkenleri okunurken güncel kalsın diye getter'la verilir.
    window.OFIS_IC = {
      get zaman() { return zaman; }, get gun() { return gun; }, get oyuncu() { return oyuncu; }, get toplanti() { return toplanti; },
      ajanlar, kedi, stat, bul, konus, gunluk, sonra, yonBak, yerinde, mesgul, rastgele, kalpler, dakika, saatYazi, el, kahveyeGit,
      ses: (ad, ...a) => SES.cal(ad, ...a), diyalogOzel, diyalogKapat, diyalogAc, diyalogAcik: () => !!diyalogAjan, secAjanYenile: () => secili && secAjan(secili),
      dkT: (dk) => dkT(dk), rs, get GERCEK() { return GERCEK; },
      // harita, çizim ve ayarlar (ışık, mini harita, ayarlar modülleri)
      T, W, H, GEN, YUK, cv, g, f, kam, img, PK, ODALAR, odaNo, yurur, koltuklar, zeminler, monitorler, lambalar, KAHVE, YAZICI, tuslar,
      ex, ey, yazi, yuvarlak, yolBul, gonder, gecelik, olcek, MOD, gunSuresi, ofisAyari, ofisKapat, ofisAc, saatAyarla, saatSifirla, get ofisDurum() { return ofisDurum; },
      get gorevler() { return gorevler; }, get DONGU() { return DONGU; }, get yo() { return yo; },
      get kalite() { return kaliteTavan; }, set kalite(v) { kaliteTavan = Math.max(0.5, Math.min(1.5, +v || 1.5)); },
      get yaziK() { return yaziK; }, set yaziK(v) { yaziK = v; }, get yurumeK() { return yurumeK; }, set yurumeK(v) { yurumeK = v; },
      get kameraK() { return kameraK; }, set kameraK(v) { kameraK = v; },
      // Sütlaç ve nesne etkileşimleri
      mama, NESNELER, sesKonum, parcacik, yanKaro, enYakinYurur, gorevBitir,
      efekt, tetik, ziyaretNoktasi, eveDon, get kayitSon() { return kayitSon; }, set kayitSon(v) { kayitSon = v; },
      // Düzenle modu
      HR, KAT, OTURAKLAR, GIRIS, nesneler, dunya, katBul, katYukle, kaynak, spr: (k) => spr(kaynak(k)), yerlesimYenile, erisimDenetle, korunanMi,
      mobilyaImza, duzenTemizle, ANAHTAR, get duzen() { return duzen; }, set duzen(d) { duzen = d; },
      get ton() { return PEMBE_TON; }, set ton(v) { PEMBE_TON = Math.max(0, Math.min(0.5, +v || 0)); }, TON_TABAN,
      get kameraYakin() { return kameraYakin; }, kameraAyarla: (yakin) => { if (kameraYakin !== yakin) kameraDegis(); },
      get kameraTakip() { return kamTakip; }, set kameraTakip(a) { kamTakip = a || null; }, dinleyici, odaKaro, secAjan,
      // Asansörle ziyaret (moduller/ziyaret.js)
      ekKarakterler, get uzak() { return !!uzak; }, uzakGir, uzakAn, uzakCik, asansorAc, yukle, gecis, ASANSOR, KG,
    };
    MOD("basla");   // ayarlar modülü burada gün süresini ve açılış/kapanış saatini kurar: rutinPlanla'dan önce belli olmalı
    ofisArayuz(); rutinPlanla();
    for (const a of ajanlar) if (!a.oyuncu) Object.assign(a, { x: GIRIS[0], y: GIRIS[1], disarda: true, cikti: false, rut: null, rutSon: Infinity });   // gün dışarıda başlar
    gorevleriYenile();
    if (GERCEK) gercegeAtla(gercekZaman());   // açılış: günün o saatine atla
    window.__ofis = {
      durum: () => ({ zaman, ajanlar: ajanlar.map((a) => [a.id, +a.x.toFixed(2), +a.y.toFixed(2), a.yol.length]) }),
      // gerçek saatte ilerle saati de kaydırır (yoksa bir sonraki kare geri sarardı); adim büyütülerek uzun süreler hızlı sınanır
      ilerle: (sn, adim = 0.05) => { for (let i = 0; i < sn / adim; i++) adimla(adim); if (GERCEK) saatOfset += sn * 1000; cizHepsi(1); },
      tus: (yon, sn) => { tuslar.add(yon); for (let i = 0; i < sn * 20; i++) adimla(0.05); tuslar.delete(yon); cizHepsi(1); },
      konusYakin: () => { const a = yakinAjan(); if (a) diyalogAc(a); return a && a.id; },
      oyuncu: () => [oyuncu.x, oyuncu.y],
      kedi: () => ({ x: kedi.x, y: kedi.y, durum: kedi.durum, sev: kedi.sev }),
      zamanAyarla: (t) => { if (GERCEK) { saatOfset += (t - gercekZaman()) * 1000; gercegeAtla(t); } else { zaman = t; rutinSenkron(); } },
      saat: () => ({ gercek: GERCEK, zaman: +zaman.toFixed(1), saat: saatYazi(), ofsetDk: Math.round(saatOfset / 60000) }),
      // gün planı ve görevler: test kancaları
      // yerleşim dökümü: harita değişikliklerini karşılaştırmak için (nesne, zemin, ekran, sunucu, monitör, koltuk, yürünebilirlik)
      yerlesimOzet: () => JSON.stringify({ n: nesneler.map((n) => [Math.round(n.x), Math.round(n.y), n.w, n.h, Math.round(n.sira), !!n.anim]),
        z: zeminler.map((n) => [Math.round(n.x), Math.round(n.y), n.w, n.h, !!n.zemin, !!n.duvar, !!n.golgeK]), e: ekranlar.map((e) => [e.tur, e.n.x, e.n.y]),
        s: sunucular.map((n) => [n.x, n.y]), m: monitorler.map((m) => [m.x, m.y, m.w, m.h, m.sahip || ""]), k: [...koltuklar].sort(), l: lambalar.length,
        y: yurur.map((r) => r.map((v) => (v ? 1 : 0)).join("")).join("") }),
      gorevler: () => gorevler.map((g) => [g.id, g.bitti]),
      gorevBitir: (id) => gorevBitir(id),
      rutin: () => ({
        gun, saat: saatYazi(), asansor: +asansor.acik.toFixed(2), mama: mama.dolu, karne: sonKarne,
        toplanti: toplanti && { saat: toplanti.m.saat, durum: toplanti.durum, cagri: toplanti.cagri.size, oturdu: toplanti.oturdu.size, aktif: toplanti.aktif && toplanti.aktif.id },
        ogle: ogle && ogle.bekle.length, yemek: ogle && ogle.ad, ofis: ofisDurum,
        plan: Object.fromEntries(ajanlar.filter((a) => !a.oyuncu).map((a) => [a.id, [+a.gelisT.toFixed(1), +a.cikisT.toFixed(1), +a.cikisVar.toFixed(1), a.ozel]])),
        ajanlar: Object.fromEntries(ajanlar.filter((a) => !a.oyuncu).map((a) => [a.id, a.disarda ? (a.cikti ? "cikti" : "disarda") : a.rut || (a.oturak ? "oturuyor" : yerinde(a) ? "masada" : "yolda")])),
      }),
      karne: () => karneGoster(),
      // ofisi kapat/aç (düğmeyle aynı yol): durum, kapanış kaydı, yedek kapanış zamanı
      ofisKapat: () => ofisKapat("kullanici"), ofisAc: () => ofisAc(),
      ofisDurum: () => ({ durum: ofisDurum, kapanisT: +kapanisT.toFixed(1), otoT: Number.isFinite(otoKapanisZamani()) ? +otoKapanisZamani().toFixed(1) : null, acilis: saatDk(ACILIS), oto: OTO_KAPAT,
        kayit: kapatKayit, icerde: ajanlar.filter((a) => !a.oyuncu && !a.disarda).map((a) => a.id), disarda: ajanlar.filter((a) => !a.oyuncu && a.disarda).length }),
      // ses: test kancaları (mini harita, ayar, ışık kancaları kendi modüllerinden gelir)
      sesDurum: () => SES.durum(),
      sesDene: () => {   // her sesi düz ve konumlu çalar; hata mesajlarını döner
        const hata = [];
        for (const ad of SES.adlar()) { try { SES.cal(ad); SES.calKonum(ad, -0.8, 5); SES.calKonum(ad, 0.9, 40); } catch (e) { hata.push(ad + ": " + e.message); } }
        return hata;
      },
      mola: () => molaVer(), oturaklar: () => OTURAKLAR.map((o) => [o.ad, o.yaklas, o.dolu && o.dolu.id]),
      isinla: (x, y) => { oyuncu.x = x; oyuncu.y = y; oyuncu.yol = []; },
      e: () => { const h = yakinHedef(); if (h) etkiles(h); return h && (h.tur + ":" + h.etiket); },
      yanina: (id) => { const a = bul(id); gonder(oyuncu, ziyaretNoktasi(a), () => diyalogAc(a)); },
      yurur,
    };
    for (const m of window.OFIS_MODULLER || []) if (m.test) Object.assign(window.__ofis, m.test);   // modüllerin test kancaları
    requestAnimationFrame(dongu);
  })().catch((e) => { document.body.insertAdjacentHTML("afterbegin", `<p style="color:#e36b5d;padding:12px">Varlık yüklenemedi: ${e}</p>`); });
})();
