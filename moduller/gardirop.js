// Gardırop (Yönetim odasındaki açık dolap, E): Oyuncunun görünümünü Character Generator parçalarından (gövde + göz + kıyafet + saç + aksesuar,
// paketin katman sırası) tarayıcıda canlı birleştirir. Seçilen parçanın tam sayfası bir kez yüklenir; birleşim tek bir tuvale çizilir ve
// img.k.oyuncu o tuval olur (çizim kodu değişmez). Parça listesi ve küçük resimler araclar/gardirop_yap.py'nin ürettiği gardirop.js + varliklar/gardirop/.
// Panelde her değişiklik ofiste hemen görünür; Giy kaydeder, Vazgeç/Esc eski görünüme döner. Kayıt: Ofis sunucusu (/api/gorunum →
// %LOCALAPPDATA%\OfisDemo\gorunum.json), düz http.server'da bu tarayıcı (localStorage). E noktası dolabın önünden hesaplanır; nokta taşıdığı için
// dolap Düzenle'de korunan eşyadır (askılık taşınabilir). Konuşan portre de aynı seçimden Portrait Generator parçalarıyla (ten, göz, saç, aksesuar;
// kıyafet yok) birleşir: img.portre.oyuncu (diyalog kutusu) ve OFIS_PORTRE.ayarla (sohbet penceresi). Portresi olmayan aksesuar portrede görünmez.
// Kancalar: basla, yerlesimYenilendi, tus ve tikla (açıkken tüketir). Dışa: window.OFIS_GARDIROP.tuvalYap(görünüm) başkasının görünümünü (ziyaret: ev sahibi, misafir)
// aynı parçalardan ayrı bir tuvale birleştirir (kendi görünümüne dokunmaz); temizle(görünüm), gorunum() (kendi kayıtlı görünümün).
(() => {
  const I = () => window.OFIS_IC;
  const KISI = window.OFIS_KISI, OAD = KISI.ad, adEki = KISI.ek;   // kisi.js: ofis sahibine özel adlar
  const GV = window.GARDIROP;
  const el = (id) => document.getElementById(id);
  const KG = "varliklar/limezu-tam/2_Characters/Character_Generator/";
  const PG = "varliklar/limezu-ui/16x16/Portrait_Generator/";
  const KATLAR = [["govde", "Ten"], ["goz", "Göz"], ["kiyafet", "Kıyafet"], ["sac", "Saç"], ["aksesuar", "Aksesuar"]];
  const BOS_OLUR = { sac: true, aksesuar: true };   // "Yok" seçilebilen katmanlar
  const p2 = (n) => String(n).padStart(2, "0");
  const DOSYA = {
    govde: (v) => `Bodies/16x16/Body_${p2(v)}.png`, goz: (v) => `Eyes/16x16/Eyes_${p2(v)}.png`, kiyafet: (v) => `Outfits/16x16/Outfit_${v}.png`,
    sac: (v) => `Hairstyles/16x16/Hairstyle_${v}.png`, aksesuar: (v) => `Accessories/16x16/Accessory_${v}.png`,
  };
  // Portre parçaları: aynı numaralar, renk numarası başında sıfırsız (Hairstyle_02_04 → PG_Hairstyle_02_4)
  const renkNo = (v) => +v.slice(v.lastIndexOf("_") + 1), modelNo = (v) => v.slice(0, v.lastIndexOf("_"));
  const PORTRE_DOSYA = {
    govde: (v) => `Skins/PG_Skin_${v}.png`, goz: (v) => `Eyes/PG_Eyes_${p2(v)}.png`, kiyafet: () => null,
    sac: (v) => `Hairstyles/PG_Hairstyle_${modelNo(v)}_${renkNo(v)}.png`,
    aksesuar: (v) => (GV.portre_aksesuar.includes(modelNo(v)) ? `Accessories/PG_Accessory_${modelNo(v)}_${renkNo(v)}.png` : null),
  };
  const AKSESUAR_AD = { Ladybug: "Uğur böceği", Bee: "Arı", Backpack: "Sırt çantası", Snapback: "Şapka", Dino_Snapback: "Dino şapka",
    Policeman_Hat: "Polis şapkası", Bataclava: "Kar maskesi", Detective_Hat: "Dedektif şapkası", Zombie_Brain: "Zombi beyni", Bolt: "Şimşek",
    Beanie: "Bere", Mustache: "Bıyık", Beard: "Sakal", Gloves: "Eldiven", Glasses: "Gözlük", Monocle: "Monokl", Medical_Mask: "Maske",
    Chef: "Aşçı şapkası", Party_Cone: "Parti şapkası" };
  const YONLER = [[18, "önden"], [12, "soldan"], [6, "arkadan"], [0, "sağdan"]];   // yürüme satırında her yönün ilk karesi

  // ---------- veri ----------
  // Her kategori için düz liste (küçük resim sayfasındaki sıra) ve modeller: [{model, renkler: [değer]}]
  const duz = {}, modeller = {};
  for (const [k] of KATLAR) {
    if (k === "govde" || k === "goz") { duz[k] = GV[k].slice(); modeller[k] = GV[k].map((v) => ({ model: v, renkler: [v] })); continue; }
    duz[k] = []; modeller[k] = GV[k].map(([m, rr]) => { const renkler = rr.map((r) => `${m}_${r}`); duz[k].push(...renkler); return { model: m, renkler }; });
  }
  const gecerli = (k, v) => (v == null ? !!BOS_OLUR[k] : duz[k].includes(v));
  function temizle(g) {   // bilinmeyen parça varsayılana döner (paket sürümü değişirse)
    const o = { ...GV.varsayilan };
    if (g && typeof g === "object") for (const [k] of KATLAR) if (k in g && gecerli(k, g[k])) o[k] = g[k];
    return o;
  }

  let gorunum = temizle(null), once = null, acik = false, kat = "kiyafet", yon = 0, kare = 0, pkare = 0, animZ = 0, sira = 0;
  const NOKTA = { x: 13.2, y: 4.6, r: 0, etiket: () => "Gardırop", fn: () => ac(true) };   // r = 0: dolap yoksa görünmez

  // ---------- birleştirme ----------
  const resimler = new Map();
  function resim(src) {
    if (!resimler.has(src)) resimler.set(src, new Promise((ok, red) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => red(new Error(src)); i.src = src; }));
    return resimler.get(src);
  }
  const tuval = document.createElement("canvas"); tuval.width = 896; tuval.height = 656;
  const portreTuval = document.createElement("canvas"); portreTuval.width = 320; portreTuval.height = 96;   // 10 kare x 3 satır (konuş, onayla, hayır)
  const katman = (k, v, kok, dosya) => { const d = v == null ? null : dosya[k](v); return d ? resim(kok + d) : null; };
  async function birlestir(g) {
    const no = ++sira;
    const [katmanlar, portreler] = await Promise.all([Promise.all(KATLAR.map(([k]) => katman(k, g[k], KG, DOSYA))),
      Promise.all(KATLAR.map(([k]) => katman(k, g[k], PG, PORTRE_DOSYA)))]);
    if (no !== sira) return false;   // arada yeni seçim geldi
    const c = tuval.getContext("2d"); c.clearRect(0, 0, tuval.width, tuval.height);
    for (const r of katmanlar) if (r) c.drawImage(r, 0, 0);
    const pc = portreTuval.getContext("2d"); pc.clearRect(0, 0, portreTuval.width, portreTuval.height);
    for (const r of portreler) if (r) pc.drawImage(r, 0, 0);
    const ic = I(); ic.img.k.oyuncu = tuval; ic.img.portre.oyuncu = portreTuval; ic.secAjanYenile(); onizle();
    if (window.OFIS_PORTRE) window.OFIS_PORTRE.ayarla("oyuncu", portreTuval);
    return true;
  }
  // Başkasının görünümü: ayrı tuval, önbellekli (en çok 12). Bilinmeyen parça varsayılana döner.
  const baskasi = new Map();
  function tuvalYap(g) {
    const gg = temizle(g), anahtar = JSON.stringify(gg);
    if (!baskasi.has(anahtar)) baskasi.set(anahtar, Promise.all(KATLAR.map(([k]) => katman(k, gg[k], KG, DOSYA))).then((rs) => {
      const c = document.createElement("canvas"); c.width = 896; c.height = 656; const x = c.getContext("2d");
      for (const r of rs) if (r) x.drawImage(r, 0, 0);
      return c;
    }));
    if (baskasi.size > 12) baskasi.delete(baskasi.keys().next().value);
    return baskasi.get(anahtar);
  }
  window.OFIS_GARDIROP = { tuvalYap, temizle, gorunum: () => ({ ...gorunum }) };
  function sec(k, v) {
    if (!gecerli(k, v)) return;
    gorunum = { ...gorunum, [k]: v };
    birlestir(gorunum).catch(() => mesaj("Parça yüklenemedi.", true));
    izgaraYaz(); portreNotu();
  }

  // ---------- kayıt ----------
  async function oku() {
    const ic = I();
    if (ic.ANAHTAR) {
      try { const r = await fetch("/api/gorunum", { headers: { "X-Ofis-Anahtar": ic.ANAHTAR } }); if (r.ok) return (await r.json()).gorunum; } catch (e) { /* tarayıcıya düş */ }
    }
    try { return JSON.parse(localStorage.getItem("ofis-gorunum-1") || "null"); } catch (e) { return null; }
  }
  async function kaydet() {
    const ic = I(), govde = JSON.stringify({ surum: 1, ...gorunum });
    if (ic.ANAHTAR) {
      try {
        const r = await fetch("/api/gorunum", { method: "POST", headers: { "X-Ofis-Anahtar": ic.ANAHTAR, "Content-Type": "application/json" }, body: govde });
        if (r.ok) return true; mesaj("Kaydedilemedi: " + ((await r.json().catch(() => ({}))).hata || r.status), true); return false;
      } catch (e) { /* tarayıcıya düş */ }
    }
    try { localStorage.setItem("ofis-gorunum-1", govde); return true; } catch (e) { mesaj("Kaydedilemedi (tarayıcı depolaması kapalı).", true); return false; }
  }

  // ---------- panel ----------
  const sayfalar = {};
  for (const [k] of KATLAR) { const i = new Image(); i.src = `varliklar/gardirop/${k}.png`; sayfalar[k] = i; }
  function kucukResim(k, v) {   // seçim ızgarasındaki önden duruş karesi
    const c = document.createElement("canvas"); c.width = 16; c.height = 32;
    const ciz = () => { const i = duz[k].indexOf(v); c.getContext("2d").drawImage(sayfalar[k], (i % GV.satir) * 16, Math.floor(i / GV.satir) * 32, 16, 32, 0, 0, 16, 32); };
    if (sayfalar[k].complete) ciz(); else sayfalar[k].addEventListener("load", ciz, { once: true });
    return c;
  }
  function dugme(icerik, baslik, secili, fn) {
    const b = document.createElement("button"); b.title = baslik; b.setAttribute("aria-label", baslik);
    if (typeof icerik === "string") b.textContent = icerik; else b.append(icerik);
    if (secili) { b.classList.add("secili"); b.setAttribute("aria-pressed", "true"); }
    b.onclick = fn; return b;
  }
  const modelAd = (k, m) => (k === "aksesuar" ? AKSESUAR_AD[m.model.slice(3)] || m.model.slice(3).replace(/_/g, " ") : k === "govde" ? `Ten ${m.model}` : k === "goz" ? `Göz ${m.model}` : `${k === "sac" ? "Saç" : "Kıyafet"} ${+m.model}`);
  function izgaraYaz() {
    if (!acik) return;
    document.querySelectorAll("#gKat [data-k]").forEach((b) => b.classList.toggle("secili", b.dataset.k === kat));
    const v = gorunum[kat], ms = modeller[kat], suanki = ms.find((m) => m.renkler.includes(v));
    const iz = el("gModeller"); iz.replaceChildren();
    if (BOS_OLUR[kat]) iz.append(dugme("Yok", "Yok", v == null, () => sec(kat, null)));
    for (const m of ms) iz.append(dugme(kucukResim(kat, m === suanki ? v : m.renkler[0]), modelAd(kat, m), m === suanki, () => sec(kat, m === suanki ? v : m.renkler[0])));
    const rk = el("gRenkler"); rk.replaceChildren();
    const renkli = suanki && suanki.renkler.length > 1;
    el("gRenkBaslik").hidden = rk.hidden = !renkli;
    if (renkli) suanki.renkler.forEach((r, i) => rk.append(dugme(kucukResim(kat, r), `Renk ${i + 1}`, r === v, () => sec(kat, r))));
  }
  function onizle() {
    const c = el("gOnizleme"); if (!c || !acik) return;
    const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
    x.drawImage(tuval, (YONLER[yon][0] + kare) * 16, 64, 16, 32, 0, 0, c.width, c.height);   // yürüme satırı (2)
    const pc = el("gPortre"), px = pc.getContext("2d"); px.imageSmoothingEnabled = false; px.clearRect(0, 0, pc.width, pc.height);
    px.drawImage(portreTuval, (pkare < 10 ? pkare : 0) * 32, 0, 32, 32, 0, 0, pc.width, pc.height);   // konuşma satırı: 10 kare konuşur, sonra susar
    el("gYon").textContent = YONLER[yon][1];
  }
  function portreNotu() {   // seçili aksesuarın konuşma portresi yoksa söyle
    const v = gorunum.aksesuar;
    mesaj(v && !PORTRE_DOSYA.aksesuar(v) ? `${AKSESUAR_AD[modelNo(v).slice(3)] || "Bu aksesuar"} konuşma portresinde görünmez.` : "");
  }
  function mesaj(m, uyari) { const d = el("gMesaj"); if (d) { d.textContent = m; d.classList.toggle("uyari", !!uyari); } }
  async function ac(a) {
    const ic = I();
    if (a === acik) return;
    if (a && (ic.diyalogAcik() || !el("duzenPanel").hidden || ic.uzak)) return;
    acik = a; el("gardiropPanel").hidden = !a;
    if (a) {
      once = { ...gorunum }; yon = 0; izgaraYaz(); portreNotu(); onizle();
      clearInterval(animZ); animZ = setInterval(() => { kare = (kare + 1) % 6; pkare = (pkare + 1) % 30; onizle(); }, 140);
      ic.ses("kapiAc"); el("gKat").querySelector(".secili")?.focus();
    } else { clearInterval(animZ); ic.cv.focus(); }
  }
  function vazgec() {
    if (once && JSON.stringify(once) !== JSON.stringify(gorunum)) { gorunum = once; birlestir(gorunum).catch(() => {}); }
    ac(false); I().ses("kapiKapa");
  }
  async function giy() {
    const ic = I(), degisti = JSON.stringify(once) !== JSON.stringify(gorunum);
    if (degisti && !(await kaydet())) return;
    ac(false);
    if (!degisti) return ic.ses("kapiKapa");
    ic.ses("gorev"); ic.kalpler(ic.oyuncu, 4); ic.konus(ic.oyuncu, "Nasıl olmuşum?", true); ic.gunluk(`${OAD} gardıroptan yeni bir görünüm seçti.`);
  }
  function rastgele() {
    const r = (l) => l[Math.floor(Math.random() * l.length)];
    gorunum = { govde: r(duz.govde), goz: r(duz.goz), kiyafet: r(duz.kiyafet), sac: Math.random() < 0.92 ? r(duz.sac) : null,
      aksesuar: Math.random() < 0.35 ? r(duz.aksesuar) : null };
    birlestir(gorunum).catch(() => mesaj("Parça yüklenemedi.", true)); izgaraYaz(); portreNotu();
  }
  // Dolabın önü: haritadaki (ya da Düzenle ile taşınan/eklenen) ilk gardırop
  function noktaKur() {
    const ic = I(), n = ic.nesneler.find((o) => (o.taban && ic.HR.mobilya[o.taban - 1].k === "gardirop") || (o.kullanici && ic.duzen.eklenen[o.kullanici - 1].k === "gardirop"));
    if (!n) { NOKTA.r = 0; return; }
    Object.assign(NOKTA, { x: (n.x + n.w / 2) / ic.T - 0.5, y: (n.y + n.h) / ic.T + 0.3, r: 1.6 });
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    async basla() {
      const ic = I();
      ic.NESNELER.push(NOKTA); noktaKur();
      el("gKat").replaceChildren(...KATLAR.map(([k, ad]) => { const b = dugme(ad, ad, false, () => { kat = k; izgaraYaz(); }); b.dataset.k = k; return b; }));
      el("gVazgec").onclick = vazgec; el("gGiy").onclick = giy; el("gRastgele").onclick = rastgele;
      el("gIlk").onclick = () => { gorunum = temizle(null); birlestir(gorunum).catch(() => {}); izgaraYaz(); };
      el("gSol").onclick = () => { yon = (yon + 3) % 4; onizle(); }; el("gSag").onclick = () => { yon = (yon + 1) % 4; onizle(); };
      gorunum = temizle(await oku());
      await birlestir(gorunum).catch(() => { /* oyuncu.png kalır */ });
    },
    yerlesimYenilendi: noktaKur,
    tus(e) {
      if (!acik) return;
      if (e.key === "Escape") { vazgec(); return true; }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { yon = (yon + (e.key === "ArrowLeft" ? 3 : 1)) % 4; onizle(); e.preventDefault(); return true; }
      if (e.code === "KeyE" || /^(Arrow|Key[WASD])/.test(e.code)) { e.preventDefault(); return true; }   // panel açıkken yürüme yok
      return e.key !== "Enter" && e.key !== " " && e.key !== "Tab" ? true : undefined;   // düğmeler klavyeyle kullanılabilsin
    },
    tikla() { if (acik) { vazgec(); return true; } },   // haritaya tıklamak paneli kapatır (değişiklik kaydedilmez)
    test: {
      gardirop: () => ({ acik, gorunum: { ...gorunum }, nokta: { x: NOKTA.x, y: NOKTA.y, r: NOKTA.r }, kat }),
      gardiropAc: (a = true) => ac(a),
      gardiropSec: (k, v) => { sec(k, v); return gorunum[k]; },
      gardiropGiy: () => giy(),
      gardiropVazgec: () => vazgec(),
      gardiropRastgele: () => { rastgele(); return { ...gorunum }; },
      // Birleşimin doğruluğu: tuvaldeki bir karenin opak piksel sayısı ve renk özeti
      gardiropPortreOzet: () => { const d = portreTuval.getContext("2d").getImageData(0, 0, 320, 96).data; let n = 0, t = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; t = (t * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2]) % 1e9; } return [n, t, I().img.portre.oyuncu === portreTuval]; },
      gardiropMesaj: () => el("gMesaj").textContent,
      gardiropOzet: () => { const d = tuval.getContext("2d").getImageData(288, 32, 16, 32).data; let n = 0, t = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; t = (t * 31 + d[i] * 7 + d[i + 1] * 3 + d[i + 2]) % 1e9; } return [n, t, I().img.k.oyuncu === tuval]; },
    },
  });
})();
