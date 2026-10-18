// Gerçek beyin sohbeti: bir ajana sorulan soru ofis.pyw üzerinden Claude Code aboneliğiyle (claude -p) cevaplanır.
// Her ajan kendi rolüyle cevap verir (sunucuda ROLLER); konuşmalar ajan başına ayrı tutulur (ayrı oturum, ayrı mesaj listesi).
// Konuşurken ajan ofiste yerinde durur (OFIS_AI.sohbetBasla/Bitti); ne aradığını başının üstünde balonla söyler.
// Yalnız Ofis kısayoluyla (ofis.pyw) açılınca çalışır: sunucu sayfaya anahtar gömer. Düz http.server'da kutu açılır ama uyarı gösterir.
// Yazma yalnız onayla: ajanın önerisi kart olur, "Onayla" sunucuda beyin.py note-create / task-create ya da nota eklemeyi çalıştırır.
(() => {
  const el = (id) => document.getElementById(id);
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  const DEPO = "ofis-sohbet-2";   // 2: varsayılan model Haiku oldu (eski tercih sıfırlandı; sohbet kutusundan değiştirilebilir)
  const MODELLER = { haiku: "Haiku 5.5", sonnet: "Sonnet 5.5", opus: "Opus 5.5", fable: "Fable 5.1" };
  const EFORLAR = { low: "Düşük", medium: "Orta", high: "Yüksek", xhigh: "Çok yüksek", max: "En yüksek" };
  const TUR_AD = { not: "Yeni not", gorev: "Yeni görev", ekle: "Nota ekle" };
  const AJANLAR = Object.fromEntries((window.DEMO ? DEMO.ajanlar : []).filter((a) => !a.oyuncu).map((a) => [a.id, a]));
  let tercih = { model: "haiku", efor: "medium" };
  try { Object.assign(tercih, JSON.parse(localStorage.getItem(DEPO) || "{}")); } catch (e) { /* özel pencere: varsayılan */ }
  if (!MODELLER[tercih.model]) tercih.model = "haiku";
  if (!EFORLAR[tercih.efor]) tercih.efor = "medium";
  let aktif = "ada", sure = null, durdur = null, durum = null;   // sure: cevabı süren ajanın id'si (tek soru)
  const konusma = {};   // ajan id -> { oturum, kutu (mesaj listesi div'i) }

  // Modern UI Portrait Generator portreleri (araclar/ui_yap.py): 10 kare x 3 satır (0 konuş, 1 onayla, 2 hayır), kare 32x32
  const PORTRE = {};
  for (const id of ["oyuncu", ...Object.keys(AJANLAR)]) { const im = new Image(); im.onload = () => portreYenile(); im.src = `varliklar/ui/portre-${id}.png`; PORTRE[id] = im; }
  function portre(c, id, kare = 0, satir = 0) {
    const p = c.getContext("2d"), im = PORTRE[id]; p.imageSmoothingEnabled = false; p.clearRect(0, 0, 32, 32);
    if (im && (im instanceof HTMLCanvasElement || (im.complete && im.naturalWidth))) p.drawImage(im, kare * 32, satir * 32, 32, 32, 0, 0, 32, 32);
  }
  function portreYenile() { document.querySelectorAll("canvas[data-portre]").forEach((c) => portre(c, c.dataset.portre)); }
  // Gardırop oyuncunun portresini seçilen görünümden birleştirir (moduller/gardirop.js); açık sohbetteki portreler de yenilenir
  window.OFIS_PORTRE = { ayarla(id, kaynak) { PORTRE[id] = kaynak; portreYenile(); } };
  // Cevap akarken başlıktaki portre konuşur; öneri gelince başını sallar, hata olunca hayır der
  let animZ = 0;
  function anim(satir, sure_) {
    clearInterval(animZ); let k = 0; const c = el("sPortre"), id = aktif, bas = performance.now();
    animZ = setInterval(() => { portre(c, id, k++ % 10, satir); if (sure_ && performance.now() - bas > sure_) { clearInterval(animZ); portre(c, id); } }, 90);
  }
  const animDur = () => { clearInterval(animZ); portre(el("sPortre"), aktif); };

  const panel = el("sohbet"), liste = el("sMesajlar"), giris = el("sGiris"), gonder = el("sGonder"), etkinlik = el("sEtkinlik");
  const mSec = el("sModel"), eSec = el("sEfor"), aSec = el("sAjan");
  for (const [k, v] of Object.entries(MODELLER)) mSec.add(new Option(v, k));
  for (const [k, v] of Object.entries(EFORLAR)) eSec.add(new Option(v, k));
  for (const [k, a] of Object.entries(AJANLAR)) aSec.add(new Option(`${a.ad} · ${a.rol}`, k));
  mSec.value = tercih.model; eSec.value = tercih.efor;
  const kaydet = () => { try { localStorage.setItem(DEPO, JSON.stringify(tercih)); } catch (e) { /* yoksay */ } };
  mSec.onchange = () => { tercih.model = mSec.value; kaydet(); };
  eSec.onchange = () => { tercih.efor = eSec.value; kaydet(); };
  aSec.onchange = () => ac(aSec.value);

  const api = (yol, govde) => fetch(yol, {
    method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) },
    body: govde ? JSON.stringify(govde) : undefined,
  });

  // Küçük, güvenli biçimlendirme: önce kaçış, sonra **kalın**, `kod`, "- " maddeleri
  function bicimle(metin) {
    const kac = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const satir = (t) => kac(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    let html = "", madde = false;
    for (const s of String(metin).split("\n")) {
      const m = /^\s*[-*•]\s+(.*)$/.exec(s);
      if (m) { if (!madde) { html += "<ul>"; madde = true; } html += `<li>${satir(m[1])}</li>`; continue; }
      if (madde) { html += "</ul>"; madde = false; }
      html += s.trim() ? `<p>${satir(s)}</p>` : "";
    }
    return html + (madde ? "</ul>" : "");
  }
  const kutu = (id) => konusma[id].kutu;
  const asagi = () => { liste.scrollTop = liste.scrollHeight; };
  function mesaj(id, kim, metin) {
    const d = document.createElement("div"); d.className = "msj " + (kim === "oyuncu" ? "oyuncu" : "ajan");
    const b = document.createElement("div"); b.className = "balon"; b.innerHTML = bicimle(metin);
    const c = document.createElement("canvas"); c.width = c.height = 32; c.className = "pp"; c.dataset.portre = kim; portre(c, kim);
    if (kim === "oyuncu") d.append(b, c); else d.append(c, b);
    kutu(id).append(d); if (id === aktif) asagi(); return b;
  }
  function bilgi(id, metin, sinif) { const d = document.createElement("div"); d.className = "bilgi " + (sinif || ""); d.textContent = metin; kutu(id).append(d); if (id === aktif) asagi(); return d; }

  function oneriKart(id, o) {
    const ad = AJANLAR[id].ad, k = document.createElement("div"); k.className = "oneriKart";
    if (o.gecersiz) { k.classList.add("gecersiz"); k.textContent = `${ad} bir kayıt önerdi ama geçersizdi: ${o.gecersiz}`; kutu(id).append(k); asagi(); return; }
    const bas = document.createElement("div"); bas.className = "ob";
    bas.innerHTML = `<span class="tur">${TUR_AD[o.tur]}</span> <code></code>`; bas.querySelector("code").textContent = o.yol;
    const bsl = document.createElement("b"); bsl.textContent = o.baslik || "";
    const on = document.createElement("pre"); on.textContent = o.metin;
    const dg = document.createElement("div"); dg.className = "od";
    const evet = document.createElement("button"); evet.className = "evet"; evet.textContent = "Onayla, kaydet";
    const hayir = document.createElement("button"); hayir.className = "hayir"; hayir.textContent = "Vazgeç";
    const karar = async (k_) => {
      evet.disabled = hayir.disabled = true;
      try {
        const r = await api("/api/onay", { jeton: o.jeton, karar: k_ }), j = await r.json();
        dg.textContent = r.ok ? (k_ === "evet" ? "✔ " : "✖ ") + j.metin : "Olmadı: " + (j.hata || r.status);
        if (r.ok && k_ === "evet") { OFIS_AI.ses("gorev"); OFIS_AI.gunluk(`${ad}'ın önerisi kaydedildi: ${j.metin}`); }
      } catch (e) { dg.textContent = "Sunucuya ulaşılamadı."; }
    };
    evet.onclick = () => karar("evet"); hayir.onclick = () => karar("hayir");
    dg.append(evet, hayir); k.append(bas, ...(o.baslik ? [bsl] : []), on, dg); kutu(id).append(k); asagi();
  }

  // Tam yetenek kipinde kilide takılan kritik iş (silme, push, dışarı gönderme…): "Emin misin?" kartı. Evet: iş bir kez geçer ve Ada'ya "onayladım" gider
  function kritikKart(id, o) {
    const ad = AJANLAR[id].ad, k = document.createElement("div"); k.className = "oneriKart kritik";
    const bas = document.createElement("div"); bas.className = "ob"; bas.innerHTML = `<span class="tur">⚠ Emin misin?</span> `;
    const ne = document.createElement("b"); ne.textContent = `${ad} kritik bir iş yapmak istiyor: ${o.neden}`;
    const on = document.createElement("pre"); on.textContent = o.is;
    const dg = document.createElement("div"); dg.className = "od";
    const evet = document.createElement("button"); evet.className = "evet"; evet.textContent = "Evet, eminim";
    const hayir = document.createElement("button"); hayir.className = "hayir"; hayir.textContent = "Hayır, yapma";
    const karar = async (k_) => {
      evet.disabled = hayir.disabled = true;
      try {
        const r = await api("/api/kritik", { jeton: o.jeton, karar: k_ }), j = await r.json();
        dg.textContent = r.ok ? (k_ === "evet" ? "✔ " : "✖ ") + j.metin : "Olmadı: " + (j.hata || r.status);
        if (r.ok && k_ === "evet") { OFIS_AI.gunluk(`${ad} için kritik iş onaylandı: ${o.neden}`); const devam = "Onayladım, eminim. Kilide takılan işi birebir aynı haliyle şimdi yap.";
          if (!sure && id === aktif) { giris.value = devam; sor(); } else bilgi(id, `Devam etmesi için ${ad}'a "onayladım" yaz (10 dk içinde).`); }
      } catch (e) { dg.textContent = "Sunucuya ulaşılamadı."; }
    };
    evet.onclick = () => karar("evet"); hayir.onclick = () => karar("hayir");
    dg.append(evet, hayir); bas.append(ne); k.append(bas, on, dg); kutu(id).append(k); asagi();
  }

  async function sor() {
    const soru = giris.value.trim(), id = aktif, ad = AJANLAR[id].ad; if (!soru || sure) return;
    if (!ANAHTAR) return bilgi(id, "Gerçek sohbet yalnız masaüstündeki Ofis kısayoluyla açınca çalışır.", "uyari");
    giris.value = ""; mesaj(id, "oyuncu", soru);
    sure = id; gonder.textContent = "Durdur"; aSec.disabled = true; etkinlik.textContent = `${ad} düşünüyor…`; OFIS_AI.dusun(id);
    let balon = null, metin = "", bitti = null, hata = null;
    const ctrl = new AbortController(); durdur = () => { ctrl.abort(); api("/api/iptal", {}).catch(() => {}); };
    try {
      const r = await fetch("/api/sor", { method: "POST", signal: ctrl.signal, headers: { "X-Ofis-Anahtar": ANAHTAR, "Content-Type": "application/json" },
        body: JSON.stringify({ soru, ajan: id, oturum: konusma[id].oturum, model: tercih.model, efor: tercih.efor }) });
      if (!r.ok) throw new Error("sunucu " + r.status);
      const okur = r.body.getReader(), coz = new TextDecoder(); let tampon = "";
      for (;;) {
        const { value, done } = await okur.read(); if (done) break;
        tampon += coz.decode(value, { stream: true });
        let i;
        while ((i = tampon.indexOf("\n")) >= 0) {
          const s = tampon.slice(0, i); tampon = tampon.slice(i + 1); if (!s.trim()) continue;
          const d = JSON.parse(s);
          if (d.tur === "basla") etkinlik.textContent = `${ad} düşünüyor… (${d.model} · ${EFORLAR[d.efor] || d.efor})`;
          else if (d.tur === "arac") { etkinlik.textContent = (d.ad === "Read" ? "📄 Okuyor: " : "🔍 Arıyor: ") + d.hedef; OFIS_AI.arac(id, d.ad, d.hedef); }
          else if (d.tur === "metin") { metin += d.parca; if (!balon) { balon = mesaj(id, id, ""); if (id === aktif) anim(0); } balon.innerHTML = bicimle(metin); if (id === aktif) asagi(); }
          else if (d.tur === "bitti") bitti = d;
          else if (d.tur === "hata") hata = d;
        }
      }
    } catch (e) { hata = { metin: e.name === "AbortError" ? "Durduruldu." : "Sunucuya ulaşılamadı. Ofis penceresi açık mı?" }; }
    sure = null; durdur = null; gonder.textContent = "Sor"; aSec.disabled = false; etkinlik.textContent = ""; animDur();
    if (bitti) {
      konusma[id].oturum = bitti.oturum || konusma[id].oturum;
      if (!balon) balon = mesaj(id, id, ""); balon.innerHTML = bicimle(bitti.metin || metin || "(boş cevap)");
      (bitti.oneriler || []).forEach((o) => oneriKart(id, o));
      (bitti.kritik || []).forEach((o) => kritikKart(id, o));
      const oneri = (bitti.oneriler || []).some((o) => o.jeton) || (bitti.kritik || []).length > 0;
      if (oneri) anim(1, 1000);
      OFIS_AI.bitti(id, oneri);
      if (window.OFIS_SES_AJAN) OFIS_SES_AJAN.cevap(id, bitti.metin || metin);   // "gerçek cevapları sesli oku" açıksa ilk ~3 cümle (moduller/konusma-ses.js)
      if (bitti.sure) etkinlik.textContent = `${bitti.sure} sn`;
    } else {
      anim(2, 1000);
      if (hata && hata.oturum) konusma[id].oturum = hata.oturum;
      bilgi(id, hata ? hata.metin : "Cevap gelmedi.", "uyari"); OFIS_AI.bitti(id, false);
    }
    if (!panel.hidden) giris.focus();
  }

  gonder.onclick = () => (sure && durdur ? durdur() : sor());
  giris.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sor(); }
    if (e.key === "Escape") { e.preventDefault(); kapat(); }
  });
  el("sYeni").onclick = () => { if (sure === aktif) return; konusma[aktif].oturum = ""; kutu(aktif).textContent = ""; selam(aktif); };
  el("sKapat").onclick = () => kapat();

  function selam(id) {
    const a = AJANLAR[id];
    mesaj(id, id, !ANAHTAR ? "Bu pencere sunucusuz açılmış. Gerçek sohbet için masaüstündeki **Ofis** kısayolunu kullan."
      : id === "ada" ? "Buradayım. Notların, görevlerin, projelerin: ne istersen sor. Bir şey kaydetmemi istersen önerip onayına bırakırım."
      : `Ben ${a.ad}, ${a.rol.toLocaleLowerCase("tr")}. Kendi alanımdaki notlara bakarak cevaplarım; kayıt önerirsem onayına bırakırım.`);
  }
  async function durumBak() {
    if (!ANAHTAR || durum) return;
    try { durum = await (await api("/api/durum")).json(); if (!durum.claude) bilgi(aktif, "Claude Code bulunamadı: claude komutu kurulu ve giriş yapılmış olmalı.", "uyari"); }
    catch (e) { bilgi(aktif, "Sunucuya ulaşılamadı.", "uyari"); }
  }
  function ac(id) {
    id = AJANLAR[id] ? id : aktif;
    if (sure && id !== sure) id = sure;   // cevap sürerken başka ajana geçilmez
    if (!panel.hidden && id !== aktif) OFIS_AI.sohbetBitti(aktif);
    aktif = id; aSec.value = id;
    if (!konusma[id]) { const k = document.createElement("div"); k.className = "kutu"; konusma[id] = { oturum: "", kutu: k }; selam(id); }
    liste.replaceChildren(kutu(id)); asagi();
    const a = AJANLAR[id]; el("sAd").textContent = a.ad; giris.placeholder = `${window.OFIS_KISI ? window.OFIS_KISI.ek(a.ad, "a") : a.ad + "'a"} sor… (Enter gönder, Shift+Enter yeni satır)`; el("sRol").textContent = a.rol + " · gerçek"; portre(el("sPortre"), id);
    panel.hidden = false; OFIS_AI.sohbetBasla(id); durumBak(); setTimeout(() => giris.focus(), 30);
  }
  function kapat() { panel.hidden = true; if (sure !== aktif) OFIS_AI.sohbetBitti(aktif); OFIS_AI.odak(); }
  window.SOHBET = { ac, kapat, acik: () => !panel.hidden, aktif: () => aktif, sure: () => sure };
  el("sohbetDugme").onclick = () => { if (document.body.classList.contains("uzak")) return; panel.hidden ? ac(aktif) : kapat(); };   // ziyaretteyken gerçek soru yok
  if (!ANAHTAR) el("sohbetDugme").title = "Gerçek sohbet Ofis kısayoluyla açınca çalışır";
  // Pencere açık oldukça sunucuya nabız: pencere kapanınca sunucu ~30 dk sonra kendini kapatır (ses işçisi ve panel de onunla kapanır).
  // Gizli/arka plandaki sayfada tarayıcı zamanlayıcıları yavaşlatır (en çok dakikada bir) ya da dondurur: bu yüzden sayfa görününce/odaklanınca/ağ dönünce hemen nabız atılır.
  // Sunucu yanıt vermiyorsa (kapanmış) kullanıcıya bir kez haber verilir.
  if (ANAHTAR) {
    let nabizHata = 0, nabizUyari = false;
    const nabiz = () => api("/api/nabiz").then(() => { nabizHata = 0; nabizUyari = false; }).catch(() => {
      if (++nabizHata >= 3 && !nabizUyari) { nabizUyari = true; const o = window.OFIS_IC; if (o && o.gunluk) o.gunluk("Ofis sunucusuyla bağlantı koptu (sunucu kapanmış olabilir). Ofis kısayolundan yeniden aç.", true); }
    });
    setInterval(nabiz, 10000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) nabiz(); });
    for (const o of ["focus", "pageshow", "online", "resume"]) addEventListener(o, nabiz);
  }
})();
