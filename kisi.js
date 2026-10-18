// Kişi ayarı (istemci): ofisin sahibine özel görünen her şey (adlar, başlık, oda tabelası, ajan adları) buradan gelir; kodda kişi adı yoktur.
// Kaynak: ofis.pyw sayfaya <meta name="ofis-kisi"> içinde gömer (VERI/kisi.json, doğrulanmış). Düz http.server'da meta boştur, varsayılanlar kullanılır.
// Betik sırası: demo-veri.js ve harita.js'ten sonra, ofis.js'ten önce (ajanlar ve odalar kurulmadan adlar yerine oturur).
// Sağladıkları: window.OFIS_KISI { ad, tam, ofis, oda, asistan, ajanlar, ek(ad, "ın"), metin(s), buyuk(s), oda_adlari, miniAd, etkilesim, tema, tv }.
// Kişiye özel katman (hepsi isteğe bağlı, varsayılanlar genel): ajanlar {id: {ad, rol, koltuk:[x,y], ayakta}}, oda_adlari {oda id: ad | {ad, mini}}, gunaydin [metin],
// tema {ton:"r,g,b", seviye, renkler:{zemin,panel,...}}, tv {gundem_ust, gundem_alt, studyo, studyo_kayit, yayin, yer, yer_ek}, etkilesim {tarihler, kitaplar, kanallar, gizli_kelimeler, hali, uyku_hedefi, cerceve_notlari}.
// Yer tutucular (index.html ve DEMO metinlerinde): {oyuncu} {tam} {asistan} {ofis} {ajan.<id>}; ek için {asistan:ın} (Ada'nın) {oyuncu:a} {oyuncu:ı} {asistan:dan} {asistan:la}.
(() => {
  const VARSAYILAN = { oyuncu_adi: "Yönetici", ofis_adi: "Yönetim Ofisi", asistan_adi: "Ada" };
  let ham = {};
  try { ham = JSON.parse((document.querySelector('meta[name="ofis-kisi"]') || {}).content || "{}") || {}; } catch (e) { ham = {}; }
  const tem = (s) => String(s).replace(/[<>\u0000-\u001f\u007f]/g, " ").trim();   // adlar sayfada innerHTML'e de girer: HTML ayraçları ve kontrol karakterleri atılır
  const m = (k, v) => (typeof ham[k] === "string" && tem(ham[k]) ? tem(ham[k]).slice(0, 80) : v);

  const buyuk = (s) => String(s).toLocaleUpperCase("tr");
  const SESLI = "aeıioöuü";
  // Türkçe ek: ünlü uyumu ve kaynaştırma harfi (Ada'nın, Deniz'in, Baran'a, Selçuk'ta). tur: ın | ı | a | da | dan | la
  function ek(ad, tur) {
    const s = String(ad).trim(); if (!s) return "";
    const h = [...s.toLocaleLowerCase("tr")], son = h[h.length - 1];
    const sonSesli = h.slice().reverse().find((c) => SESLI.includes(c)) || "e";
    const sesli = SESLI.includes(son), ince = "eiöü".includes(sonSesli);
    const dort = ince ? ("ei".includes(sonSesli) ? "i" : "ü") : ("aı".includes(sonSesli) ? "ı" : "u"), iki = ince ? "e" : "a";
    const sert = "çfhkpsşt".includes(son), y = sesli ? "y" : "";
    const sonEk = { "ın": (sesli ? "n" : "") + dort + "n", "ı": y + dort, "a": y + iki, "da": (sert ? "t" : "d") + iki, "dan": (sert ? "t" : "d") + iki + "n", "la": y + "l" + iki }[tur];
    return sonEk === undefined ? s : `${s}'${sonEk}`;
  }

  const ad = m("oyuncu_adi", VARSAYILAN.oyuncu_adi), tam = m("oyuncu_tam_adi", ad);
  const K = {
    ad, tam, ofis: m("ofis_adi", VARSAYILAN.ofis_adi), asistan: m("asistan_adi", VARSAYILAN.asistan_adi),
    oda: m("oda_adi", buyuk(tam) + " · YÖNETİM"),
    ajanlar: ham.ajanlar && typeof ham.ajanlar === "object" ? ham.ajanlar : {},   // ajan id -> { ad, rol, koltuk, ayakta }
    oda_adlari: ham.oda_adlari && typeof ham.oda_adlari === "object" ? ham.oda_adlari : {},
    etkilesim: ham.etkilesim && typeof ham.etkilesim === "object" ? ham.etkilesim : {},
    tema: ham.tema && typeof ham.tema === "object" ? ham.tema : {},
    tv: ham.tv && typeof ham.tv === "object" ? ham.tv : {},
    gunaydin: Array.isArray(ham.gunaydin) ? ham.gunaydin.map(tem).filter(Boolean).slice(0, 8) : [],
    miniAd: {},
    ek, buyuk,
  };
  const DEGER = { oyuncu: K.ad, tam: K.tam, asistan: K.asistan, ofis: K.ofis };
  const ajanAdi = (id) => { const a = window.DEMO && window.DEMO.ajanlar.find((x) => x.id === id); return a ? a.ad : id; };
  K.metin = (s) => String(s).replace(/\{(oyuncu|tam|asistan|ofis|ajan\.[a-z0-9]+)(?::([a-zıüöşç]+))?\}/g, (_, k, e) => {
    const d = k.startsWith("ajan.") ? ajanAdi(k.slice(5)) : DEGER[k];
    return e ? ek(d, e) : d;
  });
  window.OFIS_KISI = K;

  // DEMO metinleri (diyaloglar, görevler, senaryo sözleri) yer tutucularla yazılıdır: yüklenirken bir kez çözülür
  const coz = (v) => {
    if (typeof v === "string") return v.includes("{") ? K.metin(v) : v;
    if (Array.isArray(v)) { v.forEach((x, i) => { v[i] = coz(x); }); return v; }
    if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = coz(v[k]); return v; }
    return v;
  };
  if (window.DEMO) {
    for (const a of window.DEMO.ajanlar) {
      if (a.oyuncu) { a.ad = K.ad; continue; }
      const o = K.ajanlar[a.id] || {};
      if (typeof o.ad === "string" && tem(o.ad)) a.ad = tem(o.ad).slice(0, 40);
      if (typeof o.rol === "string" && tem(o.rol)) a.rol = tem(o.rol).slice(0, 80);
      if (Array.isArray(o.koltuk) && o.koltuk.length === 2 && o.koltuk.every((n) => Number.isInteger(n) && n >= 0 && n <= 80)) a.koltuk = o.koltuk.slice();
      if (o.ayakta === true) a.ayakta = true;
      if (a.id === "ada" && !o.ad) a.ad = K.asistan;
    }
    if (K.gunaydin.length && window.DEMO.rutin) window.DEMO.rutin.gunaydin = K.gunaydin.slice();
    coz(window.DEMO);   // adlar yerleştikten sonra: metinlerdeki {ajan.id} güncel adı alır
  }
  if (window.HARITA) {
    const o = window.HARITA.odalar.find((r) => r.id === "yonetim"); if (o) o.ad = K.oda;
    for (const od of window.HARITA.odalar) {   // kişiye özel oda adları (tabela) ve mini harita kısa adı
      const x = K.oda_adlari[od.id]; if (!x) continue;
      const ad = typeof x === "string" ? x : x.ad; if (typeof ad !== "string" || !tem(ad)) continue;
      od.ad = buyuk(tem(ad).slice(0, 40));
      const mini = typeof x === "object" && typeof x.mini === "string" && tem(x.mini) ? tem(x.mini) : "";
      K.miniAd[od.id] = (mini || tem(ad).toLocaleLowerCase("tr")).slice(0, 24).replace(/^./, (c) => c.toLocaleUpperCase("tr"));
    }
  }
  // Arayüz renkleri (tema.renkler): yalnız bilinen CSS değişkenleri ve #rrggbb
  if (K.tema.renkler && typeof K.tema.renkler === "object") {
    for (const [k, v] of Object.entries(K.tema.renkler)) if (/^(zemin|panel|cizgi|yazi|soluk|vurgu|iyi|kotu|kenar|dugme|kutu|kutuKenar)$/.test(k) && /^#[0-9a-f]{6}$/i.test(v)) document.documentElement.style.setProperty("--" + k, v);
    if (/^#[0-9a-f]{6}$/i.test(K.tema.renkler.zemin || "")) { const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = K.tema.renkler.zemin; }
  }

  // Sayfadaki yer tutucular: metin düğümleri ve başlık/ipucu özellikleri
  function sayfa() {
    document.title = K.metin(document.title);
    const yuru = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const dugumler = []; while (yuru.nextNode()) dugumler.push(yuru.currentNode);
    for (const n of dugumler) if (n.nodeValue.includes("{")) n.nodeValue = K.metin(n.nodeValue);
    for (const e of document.querySelectorAll("[title],[aria-label],[placeholder]"))
      for (const o of ["title", "aria-label", "placeholder"]) { const v = e.getAttribute(o); if (v && v.includes("{")) e.setAttribute(o, K.metin(v)); }
  }
  if (document.body) sayfa(); else document.addEventListener("DOMContentLoaded", sayfa, { once: true });
})();
