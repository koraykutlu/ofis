// BeyinOS Takvim uygulaması (bilgisayar ve telefon): ikinci beyindeki tarihli her şeyi tek, SALT-OKUR bir akışta toplar (Kut'taki Pusula → Takvim mantığı).
// Kaynak yeni değil: bilgisayarın zaten okuduğu /api/os/ozet verisi (os_veri.py) + bu tarayıcıdaki odak istatistiği (window.OFIS_ODAK). Hiçbir şey yazmaz.
//   iş     : açık işlerin son tarihi (gecikmiş / bugün / yaklaşan) ve biten işler (bitiş: dosyanın son değişme günü, tamam)
//   hedef  : hedefin son tarihi (bittiyse tamam)
//   oturum : Last-Session oturum kartları (geçmiş, tamam)
//   fikir  : fikir listesindeki tarihli fikirler (tamam)
//   odak   : son 7 günün pomodoro turları (tamam)
// Görünümler: Ay (ızgara + gün paneli), Hafta, Ajanda (gecikmişler + ayın günleri). Tür çipleri türü gösterir/gizler. Öğeye tıklayınca ilgili uygulama açılır.
// Tuşlar (yalnız masadaki bilgisayarda; telefonda yön tuşları yürür): ←/→ ay (haftada hafta), T bugün. Bilgisayar modülü çağırır: OFIS_TAKVIM.ciz(ctx), OFIS_TAKVIM.tus(e).
(() => {
  const TUR = {
    is: { ad: "İş", ac: "isler", uyg: "İşler'de" }, hedef: { ad: "Hedef", ac: "hedefler", uyg: "Hedefler'de" }, oturum: { ad: "Oturum", ac: "yapilanlar", uyg: "Yaptıklarım'da" },
    fikir: { ad: "Fikir", ac: "fikirler", uyg: "Fikirler'de" }, odak: { ad: "Odak", ac: "odak", uyg: "Odak'ta" },
  };
  const DURUM = { gecikmis: "gecikmiş", bugun: "bugün", yaklasan: "yaklaşan", tamam: "tamam" };
  const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const DEPO = "ofis-takvim-1";
  const D = { gorunum: "ay", gizli: new Set(), odak: null, secili: null };
  try { const k = JSON.parse(localStorage.getItem(DEPO) || "{}"); if (["ay", "hafta", "ajanda"].includes(k.gorunum)) D.gorunum = k.gorunum; (k.gizli || []).forEach((t) => TUR[t] && D.gizli.add(t)); } catch (e) { /* yok */ }
  const kaydet = () => { try { localStorage.setItem(DEPO, JSON.stringify({ gorunum: D.gorunum, gizli: [...D.gizli] })); } catch (e) { /* kayıt yok */ } };
  let ctx = null;

  // ---------- tarih yardımcıları (yerel gün; ISO YYYY-AA-GG) ----------
  const iki = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
  const tarih = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const gunEkle = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const pazartesi = (d) => gunEkle(d, -((d.getDay() + 6) % 7));
  const ayBasi = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const bugun = () => iso(new Date());
  const gecerli = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);
  const kisaGun = (s) => tarih(s).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  const uzunGun = (s) => tarih(s).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });

  // ---------- öğeler: tarihli her şey tek listede ----------
  function ogeler() {
    const v = ctx && ctx.veri, b = bugun(), o = [];
    const durum = (t, bitti) => (bitti ? "tamam" : t < b ? "gecikmis" : t === b ? "bugun" : "yaklasan");
    if (v) {
      for (const i of v.isler || []) if (gecerli(i.son)) o.push({ tarih: i.son.slice(0, 10), tur: "is", baslik: i.baslik, durum: durum(i.son.slice(0, 10)), alt: [i.proje, i.ozet].filter(Boolean).join(" · ") });
      for (const i of v.bitenler || []) if (gecerli(i.zaman)) o.push({ tarih: i.zaman.slice(0, 10), tur: "is", baslik: i.baslik, durum: "tamam", alt: i.proje ? `${i.proje} · bitti` : "bitti" });
      for (const h of v.hedefler || []) if (gecerli(h.son)) o.push({ tarih: h.son.slice(0, 10), tur: "hedef", baslik: h.baslik, durum: durum(h.son.slice(0, 10), h.bitti), alt: h.olcut || (h.ilerleme || []).slice(-1)[0] || "" });
      for (const y of v.yapilanlar || []) if (gecerli(y.tarih)) o.push({ tarih: y.tarih.slice(0, 10), tur: "oturum", baslik: y.etiket || "Oturum", durum: "tamam", alt: y.ozet || "", saat: y.saat });
      for (const f of v.fikirler || []) if (gecerli(f.tarih)) o.push({ tarih: f.tarih.slice(0, 10), tur: "fikir", baslik: f.baslik, durum: "tamam", alt: f.ozet || "" });
    }
    const od = window.OFIS_ODAK && OFIS_ODAK.istatistik ? OFIS_ODAK.istatistik() : null;
    for (const g of (od && od.hafta) || []) if (g.tur > 0 && gecerli(g.tarih)) o.push({ tarih: g.tarih, tur: "odak", baslik: `${g.tur} tur odak`, durum: "tamam", alt: `${g.dk || g.tur * 25} dk` });
    const sira = { gecikmis: 0, bugun: 1, yaklasan: 2, tamam: 3 };
    return o.sort((a, c) => (a.tarih < c.tarih ? -1 : a.tarih > c.tarih ? 1 : sira[a.durum] - sira[c.durum] || (a.saat || "").localeCompare(c.saat || "")));
  }
  function grupla(liste) { const g = new Map(); for (const x of liste) { if (D.gizli.has(x.tur)) continue; if (!g.has(x.tarih)) g.set(x.tarih, []); g.get(x.tarih).push(x); } return g; }
  function baskin(liste) {   // günün rengi: açık öğelerde en çok geçen tür
    const acik = liste.filter((x) => x.durum !== "tamam"), say = {};
    for (const x of acik.length ? acik : liste) say[x.tur] = (say[x.tur] || 0) + 1;
    return Object.keys(TUR).reduce((en, t) => ((say[t] || 0) > (say[en] || 0) ? t : en), Object.keys(TUR)[0]);
  }
  /** Masaüstü rozeti için: bugünün açık öğeleri. */
  function bugunSay(v) { const b = bugun(); let n = 0; for (const i of (v && v.isler) || []) if (gecerli(i.son) && i.son.slice(0, 10) === b) n++; for (const h of (v && v.hedefler) || []) if (gecerli(h.son) && h.son.slice(0, 10) === b && !h.bitti) n++; return n; }

  // ---------- çizim ----------
  const yap = (etiket, sinif, metin) => { const d = document.createElement(etiket); if (sinif) d.className = sinif; if (metin != null) d.textContent = metin; return d; };
  const dugme = (metin, fn, sinif) => { const b = yap("button", sinif || "", metin); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; };
  const yeniden = () => ctx && ctx.yeniden();
  function sec(s) { D.secili = s; const d = tarih(s); if (D.gorunum === "hafta" || d.getMonth() !== D.odak.getMonth() || d.getFullYear() !== D.odak.getFullYear()) D.odak = d; yeniden(); }
  function kaydir(yon) {
    const d = D.odak;
    D.odak = D.gorunum === "hafta" ? gunEkle(d, 7 * yon) : new Date(d.getFullYear(), d.getMonth() + yon, 1);
    D.secili = D.gorunum === "hafta" ? iso(D.odak) : iso(D.odak.getMonth() === new Date().getMonth() && D.odak.getFullYear() === new Date().getFullYear() ? new Date() : D.odak);
    yeniden();
  }
  function bugunGit() { D.odak = new Date(); D.secili = bugun(); yeniden(); }
  const nokta = (x) => { const i = yap("i", `tk-nk t-${x.tur} d-${x.durum}`); i.title = `${TUR[x.tur].ad}: ${x.baslik}`; return i; };

  function ogeKart(x) {
    const k = yap("div", `tk-oge t-${x.tur} d-${x.durum}`), ust = yap("div", "tk-oust");
    ust.append(nokta(x), yap("b", "", TUR[x.tur].ad), yap("span", "cip" + (x.durum === "gecikmis" ? " kotu" : x.durum === "bugun" ? " sari" : x.durum === "tamam" ? " iyi" : ""), DURUM[x.durum]));
    if (x.saat) ust.append(yap("span", "tk-saat", x.saat));
    k.append(ust, yap("div", "tk-bas", x.baslik));
    if (x.alt) k.append(yap("div", "tk-alt", x.alt));
    const git = dugme(`${TUR[x.tur].uyg} aç ›`, () => ctx.ac(TUR[x.tur].ac), "tk-git"); k.append(git);
    k.onclick = () => ctx.ac(TUR[x.tur].ac);
    return k;
  }
  function ayIzgara(g) {
    const b = bugun(), ay = D.odak.getMonth(), bas = pazartesi(ayBasi(D.odak));
    const hafta = Math.ceil((((ayBasi(D.odak).getDay() + 6) % 7) + new Date(D.odak.getFullYear(), ay + 1, 0).getDate()) / 7);
    const hb = yap("div", "tk-hb"); GUNLER.forEach((x, i) => hb.append(yap("span", i > 4 ? "hs" : "", x)));
    const iz = yap("div", "tk-izgara");
    for (let i = 0; i < hafta * 7; i++) {
      const d = gunEkle(bas, i), s = iso(d), o = g.get(s) || [];
      const h = dugme("", () => sec(s), "tk-h" + (o.length ? " dolu t-" + baskin(o) : "") + (i % 7 > 4 ? " hs" : "") + (d.getMonth() !== ay ? " diger" : "") + (s === b ? " bugun" : "") + (s === D.secili ? " sec" : "") + (s < b ? " gecmis" : ""));
      h.setAttribute("aria-label", `${uzunGun(s)}, ${o.length ? o.length + " öğe" : "kayıt yok"}`); h.setAttribute("aria-pressed", String(s === D.secili));
      h.append(yap("span", "tk-n", String(d.getDate())));
      if (o.length) {
        h.append(yap("span", "tk-say", String(o.length)));
        const n = yap("span", "tk-nokta"); o.slice(0, 5).forEach((x) => n.append(nokta(x))); if (o.length > 5) n.append(yap("span", "tk-fazla", "+" + (o.length - 5)));
        const c = yap("span", "tk-cipler"); o.slice(0, 2).forEach((x) => { const e = yap("span", `tk-cip t-${x.tur} d-${x.durum}`, x.baslik); e.title = x.baslik; c.append(e); });
        h.append(n, c);
      }
      iz.append(h);
    }
    const kap = yap("div", "tk-ay-g"); kap.append(hb, iz); return kap;
  }
  function haftaGorunum(g) {
    const b = bugun(), p = pazartesi(D.odak), kap = yap("div", "tk-hafta");
    for (let i = 0; i < 7; i++) {
      const d = gunEkle(p, i), s = iso(d), o = g.get(s) || [];
      const sut = yap("div", "tk-hg" + (i > 4 ? " hs" : "") + (s === b ? " bugun" : "") + (s === D.secili ? " sec" : ""));
      const bas = dugme("", () => sec(s), "tk-hg-bas"); bas.append(yap("b", "", String(d.getDate())), yap("span", "", GUNLER[i]));
      sut.append(bas);
      if (!o.length) sut.append(yap("span", "tk-tire", "—"));
      for (const x of o) { const c = dugme(x.baslik, () => sec(s), `tk-cip t-${x.tur} d-${x.durum}`); c.title = x.baslik; sut.append(c); }
      kap.append(sut);
    }
    return kap;
  }
  function ajanda(g, liste) {
    const b = bugun(), kap = yap("div", "tk-ajanda"), ayKod = iso(D.odak).slice(0, 7);
    const gec = liste.filter((x) => x.durum === "gecikmis" && !D.gizli.has(x.tur));
    if (gec.length) {
      const bas = yap("div", "tk-gun-bas kotu"); bas.append(yap("b", "", "Gecikmiş"), yap("span", "cip kotu", String(gec.length))); kap.append(bas);
      gec.forEach((x) => kap.append(ogeKart(x)));
    }
    const gunler = [...g.keys()].filter((t) => t.slice(0, 7) === ayKod).sort();
    let yazildi = 0;
    for (const t of gunler) {
      const o = g.get(t).filter((x) => x.durum !== "gecikmis"); if (!o.length) continue;
      const bas = yap("div", "tk-gun-bas" + (t === b ? " bugun" : "")); bas.append(yap("b", "", uzunGun(t))); if (t === b) bas.append(yap("span", "cip sari", "bugün"));
      kap.append(bas); o.forEach((x) => kap.append(ogeKart(x))); yazildi++;
    }
    if (!yazildi && !gec.length) kap.append(yap("div", "tk-bos", "Bu ay için tarihli kayıt yok."));
    return kap;
  }
  function yanPanel(g, liste) {
    const s = D.secili, d = tarih(s), o = g.get(s) || [], bugunMu = s === bugun(), yan = yap("aside", "tk-yan" + (bugunMu ? " bugun" : ""));
    const bas = yap("div", "tk-yan-bas"), bilgi = yap("div");
    bilgi.append(yap("div", "tk-yan-ad", d.toLocaleDateString("tr-TR", { weekday: "long" }) + (bugunMu ? " · bugün" : "")), yap("div", "tk-etiket", `${d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })} · ${o.length ? o.length + " öğe" : "boş gün"}`));
    bas.append(yap("span", "tk-yan-gun", String(d.getDate())), bilgi); yan.append(bas);
    if (o.length) o.forEach((x) => yan.append(ogeKart(x)));
    else {
      yan.append(yap("div", "tk-bos", "Bu güne bağlı iş, hedef ya da kayıt yok."));
      const sira = liste.filter((x) => x.tarih > s && x.durum !== "tamam" && !D.gizli.has(x.tur)).slice(0, 5);
      if (sira.length) {
        yan.append(yap("div", "tk-etiket ust", "Sıradakiler"));
        for (const x of sira) { const r = dugme("", () => sec(x.tarih), `tk-sira t-${x.tur} d-${x.durum}`); r.append(nokta(x), yap("span", "", x.baslik), yap("small", "", kisaGun(x.tarih))); r.title = x.baslik; yan.append(r); }
      }
    }
    const gec = liste.filter((x) => x.durum === "gecikmis" && x.tarih !== s && !D.gizli.has(x.tur)).length;
    if (bugunMu && gec) { const n = dugme(`Ayrıca ${gec} gecikmiş öğe önceki günlerde · Ajanda'da hepsi ›`, () => { D.gorunum = "ajanda"; kaydet(); yeniden(); }, "tk-not"); yan.append(n); }
    return yan;
  }

  function ciz(c) {
    ctx = c;
    if (!D.odak) { D.odak = new Date(); D.secili = bugun(); }
    const liste = ogeler(), g = grupla(liste), kok = yap("div", "tk gor-" + D.gorunum);
    if (!ctx.veri) kok.append(yap("div", "tk-uyari", ctx.sunucusuz ? "Gerçek veri yalnız masaüstündeki Ofis kısayoluyla açınca görünür; şimdilik yalnız odak turların." : "Veri yükleniyor…"));
    // üst çubuk: ay adı + özet, oklar, görünüm
    const ayKod = iso(D.odak).slice(0, 7), sayac = {};
    liste.forEach((x) => { if (x.tarih.slice(0, 7) === ayKod && x.durum !== "tamam") sayac[x.tur] = (sayac[x.tur] || 0) + 1; });
    const gecSay = liste.filter((x) => x.durum === "gecikmis").length;
    const baslikMetin = D.gorunum === "hafta" ? (() => { const p = pazartesi(D.odak), s = gunEkle(p, 6); return `${p.getDate()} ${p.toLocaleDateString("tr-TR", { month: "short" })} – ${s.getDate()} ${s.toLocaleDateString("tr-TR", { month: "short" })}`; })()
      : D.odak.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    const bar = yap("div", "tk-bar"), sol = yap("div", "tk-baslik"), ozet = yap("div", "tk-ozet");
    for (const t of Object.keys(TUR)) if (sayac[t]) { const s = yap("span", "t-" + t); s.append(yap("b", "", String(sayac[t])), document.createTextNode(" " + TUR[t].ad)); ozet.append(s); }
    if (gecSay) { const s = yap("span", "gec"); s.append(yap("b", "", String(gecSay)), document.createTextNode(" gecikmiş")); ozet.append(s); }
    if (!ozet.childNodes.length) ozet.append(yap("span", "", "bu ay açık iş yok"));
    sol.append(yap("b", "tk-ay", baslikMetin), ozet);
    const birim = D.gorunum === "hafta" ? "hafta" : "ay", oklar = yap("div", "tk-oklar");
    const once = dugme("‹", () => kaydir(-1)), sonra = dugme("›", () => kaydir(1)), bg = dugme("Bugün", bugunGit, "bugun-d");
    once.title = `Önceki ${birim} (←)`; sonra.title = `Sonraki ${birim} (→)`; bg.title = "Bugüne dön (T)";
    oklar.append(once, bg, sonra);
    const gor = yap("div", "seg tk-gor");
    for (const [k, a] of [["ay", "Ay"], ["hafta", "Hafta"], ["ajanda", "Ajanda"]]) gor.append(dugme(a, () => { D.gorunum = k; kaydet(); yeniden(); }, D.gorunum === k ? "secili" : ""));
    const sag = yap("div", "tk-sag"); sag.append(oklar, gor);
    bar.append(sol, sag);
    // tür çipleri (göster/gizle)
    const lej = yap("div", "tk-lejant");
    for (const [k, t] of Object.entries(TUR)) {
      const b = dugme("", () => { D.gizli.has(k) ? D.gizli.delete(k) : D.gizli.add(k); kaydet(); yeniden(); }, `t-${k}` + (D.gizli.has(k) ? " kapali" : ""));
      b.append(yap("i"), document.createTextNode(t.ad)); b.title = (D.gizli.has(k) ? "Göster: " : "Gizle: ") + t.ad; b.setAttribute("aria-pressed", String(!D.gizli.has(k)));
      lej.append(b);
    }
    const govde = yap("div", "tk-govde" + (D.gorunum === "ajanda" ? " tam" : ""));
    govde.append(D.gorunum === "ay" ? ayIzgara(g) : D.gorunum === "hafta" ? haftaGorunum(g) : ajanda(g, liste));
    if (D.gorunum !== "ajanda") govde.append(yanPanel(g, liste));
    kok.append(bar, lej, govde);
    return kok;
  }
  function tus(e) {   // bilgisayar modülü yalnız Takvim öndeyken ve masadaki bilgisayarda çağırır
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === "ArrowLeft") { kaydir(-1); return true; }
    if (e.key === "ArrowRight") { kaydir(1); return true; }
    if (e.code === "KeyT") { bugunGit(); return true; }
    return false;
  }

  const CSS = `
  #bos .tk { --tk-is:#5aaeff; --tk-hedef:var(--vurgu); --tk-oturum:#6cc28a; --tk-fikir:#c39bff; --tk-odak:#f2a65a; display:flex; flex-direction:column; gap:10px; min-height:100%; }
  #bos .tk .t-is { --tk-renk:var(--tk-is); } #bos .tk .t-hedef { --tk-renk:var(--tk-hedef); } #bos .tk .t-oturum { --tk-renk:var(--tk-oturum); } #bos .tk .t-fikir { --tk-renk:var(--tk-fikir); } #bos .tk .t-odak { --tk-renk:var(--tk-odak); }
  #bos .tk-uyari { font-size:12px; color:var(--os-soluk); padding:6px 10px; border:1px dashed var(--os-kenar); border-radius:8px; }
  #bos .tk-bar { display:flex; justify-content:space-between; align-items:flex-end; gap:8px 14px; flex-wrap:wrap; }
  #bos .tk-ay { display:block; font:700 22px/1.1 var(--os-baslik); letter-spacing:.01em; }
  #bos .tk-ozet { display:flex; gap:3px 10px; flex-wrap:wrap; margin-top:4px; font:10.5px Consolas, "Cascadia Mono", monospace; letter-spacing:.08em; text-transform:uppercase; color:var(--os-soluk); }
  #bos .tk-ozet b { color:var(--tk-renk, var(--os-yazi)); font-weight:600; } #bos .tk-ozet .gec b { color:var(--kotu); }
  #bos .tk-sag { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  #bos .tk-oklar { display:inline-flex; gap:4px; }
  #bos .tk-oklar button { min-width:30px; height:28px; padding:0 9px; border-radius:8px; border:1px solid var(--os-dugme-kenar); background:var(--os-dugme); color:var(--os-yazi); font:15px var(--os-govde); cursor:pointer; }
  #bos .tk-oklar .bugun-d { font-size:12.5px; } #bos .tk-oklar button:hover { border-color:var(--vurgu); }
  #bos .tk-gor { display:inline-flex; gap:2px; padding:2px; border:1px solid var(--os-kenar); border-radius:9px; background:color-mix(in srgb, var(--os-zemin) 60%, transparent); }
  #bos .tk-gor button { border:0 !important; background:none !important; padding:4px 11px !important; border-radius:7px !important; }
  #bos .tk-gor button.secili { background:var(--os-secim) !important; color:var(--os-vy); }
  #bos .tk-lejant { display:flex; gap:6px; flex-wrap:wrap; }
  #bos .tk-lejant button { display:inline-flex; align-items:center; gap:6px; padding:2px 10px 2px 8px; border-radius:999px; border:1px solid color-mix(in srgb, var(--tk-renk) 40%, transparent);
    background:color-mix(in srgb, var(--tk-renk) 13%, transparent); color:var(--os-yazi); font:12px var(--os-govde); cursor:pointer; }
  #bos .tk-lejant button:hover { background:color-mix(in srgb, var(--tk-renk) 24%, transparent); }
  #bos .tk-lejant button.kapali { opacity:.45; background:none; border-style:dashed; }
  #bos .tk-lejant i, #bos .tk-nk { display:inline-block; flex:none; width:7px; height:7px; border-radius:50%; background:var(--tk-renk, var(--os-soluk)); }
  #bos .tk-nk.d-gecikmis { box-shadow:0 0 0 1.5px var(--kotu); } #bos .tk-nk.d-bugun { box-shadow:0 0 0 1.5px var(--vurgu); } #bos .tk-nk.d-tamam { opacity:.5; }
  #bos .tk-govde { display:grid; grid-template-columns:minmax(0, 1fr) 250px; gap:12px; align-items:start; flex:1; min-height:0; }
  #bos .tk-govde.tam { grid-template-columns:minmax(0, 1fr); }
  #bos .tk-hb, #bos .tk-izgara { display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:4px; }
  #bos .tk-hb { margin-bottom:4px; font:10.5px Consolas, "Cascadia Mono", monospace; letter-spacing:.1em; color:var(--os-soluk); text-transform:uppercase; text-align:center; }
  #bos .tk-h { position:relative; display:flex; flex-direction:column; align-items:stretch; gap:3px; min-height:72px; padding:6px; text-align:left; border-radius:8px; cursor:pointer;
    border:1px solid color-mix(in srgb, var(--os-kenar) 55%, transparent); background:color-mix(in srgb, var(--os-oge) 45%, transparent); color:var(--os-yazi); font:inherit; overflow:hidden; }
  #bos .tk-h.hs { background:color-mix(in srgb, var(--os-zemin) 55%, transparent); }
  #bos .tk-h.dolu { background:color-mix(in srgb, var(--tk-renk) 8%, transparent); border-top:2px solid color-mix(in srgb, var(--tk-renk) 72%, transparent); padding-top:5px; }
  #bos .tk-h:hover { border-color:var(--os-kenar); background:var(--os-secim); }
  #bos .tk-h.diger { opacity:.36; } #bos .tk-h.gecmis .tk-n { color:var(--os-soluk); } #bos .tk-h.gecmis .tk-nk, #bos .tk-h.gecmis .tk-cip { opacity:.65; }
  #bos .tk-h.bugun { border-color:color-mix(in srgb, var(--vurgu) 55%, transparent); }
  #bos .tk-h.bugun .tk-n { align-self:flex-start; background:var(--vurgu); color:#1b1d25; border-radius:999px; padding:2px 7px; margin:-2px 0 0 -3px; font-weight:700; }
  #bos .tk-h.sec { border-color:var(--vurgu); box-shadow:inset 0 0 0 1px var(--vurgu); }
  #bos .tk-n { font:600 13.5px/1 var(--os-baslik); }
  #bos .tk-say { position:absolute; top:6px; right:7px; font:10px/1 Consolas, monospace; color:var(--os-soluk); }
  #bos .tk-nokta { display:flex; flex-wrap:wrap; gap:3px; align-items:center; } #bos .tk-fazla { font-size:9.5px; color:var(--os-soluk); }
  #bos .tk-cipler { display:flex; flex-direction:column; gap:2px; min-width:0; }
  #bos .tk-cip { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:11px/1.35 var(--os-govde); padding:1px 6px; border-radius:5px; text-align:left;
    background:color-mix(in srgb, var(--tk-renk) 18%, transparent); border:0; border-left:2px solid var(--tk-renk); color:var(--os-yazi); }
  #bos .tk-cip.d-tamam { opacity:.6; } #bos .tk-cip.d-gecikmis { box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--kotu) 60%, transparent); }
  #bos .tk-hafta { display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:5px; }
  #bos .tk-hg { display:flex; flex-direction:column; gap:3px; min-height:160px; padding:6px; border-radius:8px; border:1px solid color-mix(in srgb, var(--os-kenar) 55%, transparent); background:color-mix(in srgb, var(--os-oge) 45%, transparent); }
  #bos .tk-hg.hs { background:color-mix(in srgb, var(--os-zemin) 55%, transparent); } #bos .tk-hg.bugun { border-color:color-mix(in srgb, var(--vurgu) 55%, transparent); } #bos .tk-hg.sec { box-shadow:inset 0 0 0 1px var(--vurgu); }
  #bos .tk-hg-bas { display:flex; align-items:baseline; gap:6px; border:0; background:none; color:var(--os-soluk); font:11px var(--os-govde); padding:0 0 4px; cursor:pointer; text-align:left; }
  #bos .tk-hg-bas b { font:700 16px var(--os-baslik); color:var(--os-yazi); } #bos .tk-hg.bugun .tk-hg-bas b { color:var(--os-vy); }
  #bos .tk-hg .tk-cip { cursor:pointer; } #bos .tk-tire { color:var(--os-soluk); font-size:11px; }
  #bos .tk-yan { display:flex; flex-direction:column; gap:7px; padding:10px; border-radius:12px; background:var(--os-kart); border:1px solid color-mix(in srgb, var(--os-kenar) 70%, transparent); }
  #bos .tk-yan.bugun { border-color:color-mix(in srgb, var(--vurgu) 45%, transparent); }
  #bos .tk-yan-bas { display:flex; align-items:center; gap:10px; margin-bottom:2px; }
  #bos .tk-yan-gun { font:700 34px/1 var(--os-baslik); color:var(--os-yazi); } #bos .tk-yan.bugun .tk-yan-gun { color:var(--os-vy); }
  #bos .tk-yan-ad { font:600 14px var(--os-baslik); } #bos .tk-yan-ad::first-letter { text-transform:uppercase; }
  #bos .tk-etiket { font:10.5px Consolas, monospace; letter-spacing:.07em; text-transform:uppercase; color:var(--os-soluk); } #bos .tk-etiket.ust { margin-top:4px; }
  #bos .tk-oge { position:relative; padding:8px 10px; border-radius:9px; background:var(--os-oge); border:1px solid var(--os-oge-kenar); border-left:3px solid var(--tk-renk); cursor:pointer; }
  #bos .tk-oge:hover { border-color:var(--vurgu); border-left-color:var(--tk-renk); }
  #bos .tk-oge.d-tamam { opacity:.72; }
  #bos .tk-oust { display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--os-soluk); } #bos .tk-oust b { color:var(--os-yazi); font-weight:600; }
  #bos .tk-saat { margin-left:auto; font:11px Consolas, monospace; }
  #bos .tk-bas { margin-top:4px; font-size:13px; font-weight:600; line-height:1.3; overflow-wrap:anywhere; }
  #bos .tk-alt { margin-top:3px; font-size:12px; color:var(--os-soluk); line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  #bos .tk-git { margin-top:6px; border:0; background:none; padding:0; color:var(--os-vy); font:12px var(--os-govde); cursor:pointer; }
  #bos .tk-sira { display:flex; align-items:center; gap:7px; width:100%; border:0; background:none; padding:4px 2px; color:var(--os-yazi); font:12.5px var(--os-govde); text-align:left; cursor:pointer; border-top:1px solid color-mix(in srgb, var(--os-kenar) 55%, transparent); }
  #bos .tk-sira span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } #bos .tk-sira small { color:var(--os-soluk); white-space:nowrap; }
  #bos .tk-sira:hover span { color:var(--os-vy); }
  #bos .tk-bos { color:var(--os-soluk); font-size:12.5px; padding:4px 0; }
  #bos .tk-not { border:0; background:none; padding:4px 0 0; text-align:left; color:var(--os-soluk); font:11.5px var(--os-govde); cursor:pointer; } #bos .tk-not:hover { color:var(--os-vy); }
  #bos .tk-ajanda { display:flex; flex-direction:column; gap:6px; }
  #bos .tk-gun-bas { display:flex; align-items:center; gap:8px; margin-top:6px; font:600 13px var(--os-baslik); }
  #bos .tk-gun-bas.kotu { color:var(--kotu); } #bos .tk-gun-bas.bugun { color:var(--os-vy); }
  /* dar ekran ve telefon: ızgara yalnız nokta, panel altta, hafta liste olur */
  @container boscam (max-width: 620px) {
    #bos .tk-govde { grid-template-columns:minmax(0, 1fr); }
    #bos .tk-bar { align-items:flex-start; } #bos .tk-ay { font-size:19px; }
    #bos .tk-h { min-height:44px; padding:4px; gap:2px; align-items:center; } #bos .tk-h.dolu { padding-top:3px; }
    #bos .tk-cipler, #bos .tk-say { display:none; } #bos .tk-nokta { justify-content:center; gap:2px; } #bos .tk-nk { width:5px; height:5px; }
    #bos .tk-h.bugun .tk-n { margin:0; padding:2px 6px; align-self:center; }
    #bos .tk-hafta { grid-template-columns:1fr; } #bos .tk-hg { min-height:0; flex-direction:row; flex-wrap:wrap; align-items:center; }
    #bos .tk-hg-bas { width:62px; padding:0; } #bos .tk-hg .tk-cip { max-width:100%; }
    #bos .tk-lejant button { padding:1px 8px 1px 6px; font-size:11px; }
  }`;
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  window.OFIS_TAKVIM = { ciz, tus, bugunSay };
})();
