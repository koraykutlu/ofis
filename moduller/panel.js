// "Bugün" kartı (sağ panel): TEK kart, iki kaynak.
//  1) İş listesi HER ZAMAN dosyadan gelir (moduller/gercek.js: vault görevleri, ücretsiz, anında). Maddeye dokununca tik atılır/kalkar; tik sunucuda tutulur
//     (VERI/panel-isaret.json, yalnız o gün için geçerli) ve Haiku katmanı kapalıyken de çalışır.
//  2) Haiku katmanı (sunucu: panel.py; Ayarlar'dan açılır, VARSAYILAN KAPALI, kota harcar): açıksa sabah brifingine ek satırlar, TV manşeti, çalışanların konuşmaları
//     (Ada ve ekip vault notlarına göre konuşur) ve ortam sohbetlerine "taze konu" olarak katılan konuşmalar eklenir. Dosyadan iş yoksa Haiku'nun işleri listeyi doldurur.
// Diğer modüller için (odak modu, gün kapatma): window.OFIS_PANEL { acikGorevler(), bitenGorevler(), isaretle(id, bitti), haikuBrifing(), ciz() }.
(() => {
  const I = () => window.OFIS_IC;
  const el = (id) => document.getElementById(id);
  let durum = null, sorguZ = 0, bekleZ = 0, secili = "";
  const V0 = window.DEMO ? { brifing: window.DEMO.brifing.slice(), manset: window.DEMO.manset.slice() } : { brifing: [], manset: [] };   // Haiku kapanırsa dönülecek özgün metinler
  const api = (yol, govde) => fetch("/api/panel" + yol, { method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": I().ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) }, body: govde ? JSON.stringify(govde) : undefined });
  const haikuAcik = () => !!(durum && durum.acik && durum.var);

  function saatYaz(iso) {
    if (!iso) return "";
    const t = new Date(iso); if (isNaN(t)) return "";
    const bugun = new Date().toDateString() === t.toDateString();
    return (bugun ? "" : t.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) + " ") + t.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }
  // ---------- Haiku katmanı: brifing, manşet, konuşmalar ----------
  function brifingUygula(d) {
    const V = window.DEMO; if (!V) return;
    const taze = haikuAcik() && d.tarih === new Date().toLocaleDateString("sv-SE");
    V.brifing.splice(0, V.brifing.length, ...(taze && d.brifing && d.brifing.length ? d.brifing : V0.brifing));
    V.manset.splice(0, V.manset.length, ...(taze && d.manset && d.manset.length ? d.manset : V0.manset));
  }
  // Çalışanların konuşmaları: Haiku'nun vault notlarına dayanarak yazdığı selam, soru-cevap ve toplantı raporları. Eylem seçenekleri (brifing, odak, yazdır…) korunur.
  function konusmaUygula(d) {
    const V = window.DEMO, k = d && d.konusma; if (!V || !haikuAcik()) return;
    if (d.gorevler && d.gorevler.length) V.onaylar.bulten = { baslik: `Günün planı (${d.gorevler.length} iş)`, detay: d.gorevler.slice(0, 4).map((g) => g.ad).join(" · ") };
    if (!k || !k.ajanlar) return;
    for (const [id, a] of Object.entries(k.ajanlar)) {
      const eski = V.diyaloglar[id]; if (!eski) continue;
      const eylemli = (eski.secenekler || []).filter((s) => s.eylem);
      V.diyaloglar[id] = { ...eski, selam: a.selam || eski.selam, secenekler: [...(a.secenekler || []).map((o) => ({ etiket: o.etiket, cevap: o.cevap })), ...eylemli] };
    }
    for (const m of V.rutin.toplantilar) { const r = k.toplanti && k.toplanti[m.saat]; if (r) for (const id of Object.keys(m.raporlar)) if (r[id]) m.raporlar[id] = r[id]; }
  }
  // Ortam sohbetlerine "taze konu": Haiku'nun ürettiği selam/soru-cevap, elle yazılmış havuza (sohbetler.js) eklenir ve aynı yoldan oynar (balon, oda günlüğü, ses).
  // Elle yazılmış sohbetler her zaman temel kalır: Haiku kapalıysa ya da konuşma yoksa bu liste boştur.
  function tazeKur(d) {
    window.SOHBETLER_TAZE = [];
    const k = d && d.konusma; if (!haikuAcik() || !k || !k.ajanlar) return;
    const kisalt = (t, n) => { t = String(t || "").trim(); if (t.length <= n) return t; const c = t.slice(0, n - 1), i = Math.max(c.lastIndexOf(". "), c.lastIndexOf("; ")); return i > 30 ? c.slice(0, i + 1) : c.replace(/\s+\S*$/, "") + "…"; };
    const parcala = (t, n) => { t = String(t || "").trim(); const a = kisalt(t, n); if (a.length >= t.length || a.endsWith("…")) { const bas = t.slice(0, a.replace(/…$/, "").length).trimEnd(); const kalan = t.slice(bas.length).trim(); return kalan ? [bas, kisalt(kalan, n)] : [a]; } return [a, kisalt(t.slice(a.length).trim(), n)].filter(Boolean); };   // sohbet satırı ≤ 90 karakter: cevap en çok 2 satıra bölünür
    const damga = String(k.guncelleme || k.tarih || "").replace(/\D/g, "").slice(0, 12), yerler = ["kahve", "sebil", "mutfak"];
    let n = 0;
    for (const [id, a] of Object.entries(k.ajanlar)) {
      (a.secenekler || []).slice(0, 2).forEach((o, i) => {
        if (!o.etiket || !o.cevap) return;
        const par = parcala(o.cevap, 86), satir = [`a: ${i === 0 && a.selam ? kisalt(a.selam, 86) : "Notlarda bir şey gördüm, bakar mısın?"}`, `b: ${kisalt(o.etiket, 86)}`, ...par.map((p) => `a: ${p}`)];
        satir.push(par.length < 2 ? "b: Tamamdır, teşekkürler." : "b: Anladım, aklımda.");
        window.SOHBETLER_TAZE.push({ id: `taze-${id}-${i}-${damga}`, konu: kisalt(o.etiket, 40), yer: yerler[n++ % yerler.length], taze: true, a: [id], satir });
      });
    }
  }

  // ---------- birleşik liste ----------
  function liste() {
    const G = window.OFIS_GERCEK, isaret = (durum && durum.gercek_isaret) || {}, sat = [];
    const gercek = G && G.gorevler ? G.gorevler() : [];
    for (const x of gercek) {
      sat.push({ id: "g:" + x.id, ad: x.baslik, bitti: !!isaret[x.id], kim: isaret[x.id] ? "sen" : "", not: `${x.proje ? x.proje + " · " : ""}${x.yol}${x.son ? " · son " + x.son : ""}`, ipucu: "", isaret: x.gecikti ? "gecikti" : x.bugun ? "bugun" : "doing", kaynak: "dosya" });
    }
    if (!sat.length && haikuAcik()) {   // dosyadan iş yoksa Haiku'nun işleri listeyi doldurur
      for (const g of durum.gorevler || []) sat.push({ ...g, not: g.ipucu && !g.bitti ? g.ipucu : "", isaret: "haiku", kaynak: "haiku" });
    }
    return sat;
  }
  function ciz() {
    const kart = el("canliKart"); if (!kart) return;
    const G = window.OFIS_GERCEK, gv = G && G.ozet ? G.ozet() : null, sat = liste();
    const goster = !!gv || haikuAcik() || !!(durum && durum.acik);
    kart.hidden = !goster; if (!goster) return;
    const ul = el("canliListe"); ul.textContent = "";
    const bitenler = sat.filter((g) => g.bitti).length;
    el("canliSay").textContent = sat.length ? `${bitenler}/${sat.length}` : "";
    for (const g of sat) {
      const li = document.createElement("li"); li.className = (g.bitti ? "bitti " : "") + (g.isaret || "") + (secili === g.id ? " acildi" : "");
      const kutu = document.createElement("button"); kutu.type = "button"; kutu.className = "kutu"; kutu.setAttribute("aria-label", g.bitti ? "Tiki kaldır" : "Yapıldı olarak işaretle"); kutu.textContent = g.bitti ? "✓" : "";
      const gv_ = document.createElement("div"); gv_.className = "gv";
      const ad = document.createElement("span"); ad.className = "ad"; ad.textContent = g.ad + (g.isaret === "gecikti" && !g.bitti ? " · gecikti" : g.isaret === "bugun" && !g.bitti ? " · bugün" : ""); gv_.append(ad);
      if (g.kim === "otomatik") { const r = document.createElement("span"); r.className = "robot"; r.textContent = " 🤖"; r.title = `Otomatik tiklendi (tahmini): ${g.neden || "kaynakta yapıldığı yazıyor"}${g.kaynak ? " · " + g.kaynak : ""}`; ad.append(r); }
      if (g.not && !g.bitti && (g.kaynak === "haiku" || secili === g.id)) { const n = document.createElement("span"); n.className = "not"; n.textContent = g.not; gv_.append(n); }
      kutu.onclick = (e) => { e.stopPropagation(); isaretle(g.id, !g.bitti, g.ad); };
      gv_.onclick = () => { secili = secili === g.id ? "" : g.id; ciz(); };   // satıra dokununca yol/ayrıntı açılır; tik yalnız kutudan
      li.append(kutu, gv_); ul.append(li);
    }
    if (!sat.length) { const li = document.createElement("li"); li.className = "bos"; li.textContent = !gv ? "Vault görevleri bu pencerede okunamıyor." : "Bugün için acil ya da süren iş yok."; ul.append(li); }
    const alt = el("canliAlt"); alt.textContent = "";
    const s = (gv && gv.sayilar) || {}, bilgi = document.createElement("span");
    bilgi.textContent = (gv ? `Açık ${s.acik || 0} · gecikmiş ${s.gecikti || 0} · bugün ${s.bugun || 0}` : "") + (haikuAcik() ? `${gv ? " · " : ""}Haiku ${saatYaz(durum.guncelleme)}` : "");
    alt.append(bilgi);
    if (durum && durum.acik) {
      const dugme = document.createElement("button"); dugme.type = "button"; dugme.textContent = durum.calisiyor ? "Güncelleniyor…" : "Brifingi güncelle"; dugme.disabled = !!durum.calisiyor;
      dugme.title = "Haiku vault notlarını okuyup brifing, manşet ve konuşmaları tazeler (kota harcar)";
      dugme.onclick = async () => { try { const r = await api("/guncelle", {}); if (r.ok) { durum = await r.json(); ciz(); sorgula(true); } } catch (e) { /* yoksay */ } };
      alt.append(dugme);
      if (durum.hata && !durum.var) { const h = document.createElement("div"); h.className = "hata"; h.textContent = durum.calisiyor ? "Brifing hazırlanıyor…" : durum.hata; alt.append(h); }
    }
  }
  async function isaretle(id, bitti, ad) {
    try { const r = await api("/isaret", { id, bitti: !!bitti, ad: ad || "" }); if (r.ok) { durum = await r.json(); ciz(); return true; } } catch (e) { /* sunucu yok */ }
    return false;
  }
  async function cek() {
    try {
      const r = await api(""); if (!r.ok) return; durum = await r.json();
      brifingUygula(durum); konusmaUygula(durum); tazeKur(durum); ciz();
    } catch (e) { /* sunucu yok */ }
  }
  // güncelleme sürerken 3 sn'de bir bak; bitince bırak
  function sorgula(hizli) {
    clearTimeout(bekleZ);
    const dene = async () => { await cek(); if (durum && durum.calisiyor) bekleZ = setTimeout(dene, 3000); };
    bekleZ = setTimeout(dene, hizli ? 2500 : 0);
  }
  window.OFIS_PANEL = {
    durum: () => durum,
    acikGorevler: () => liste().filter((g) => !g.bitti),
    bitenGorevler: () => liste().filter((g) => g.bitti),
    haikuBrifing: () => (haikuAcik() && durum.tarih === new Date().toLocaleDateString("sv-SE") ? (durum.brifing || []) : []),
    isaretle: (id, bitti, ad) => isaretle(id, bitti, ad),
    ciz, cek,
  };
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() {
      if (!I().ANAHTAR || !el("canliKart")) return;
      cek();
      clearInterval(sorguZ); sorguZ = setInterval(cek, 5 * 60 * 1000);   // sayfa açık kaldıkça 5 dakikada bir tazele
      document.addEventListener("visibilitychange", () => { if (!document.hidden) cek(); });
    },
    test: { durum: () => durum, cek, liste, taze: () => window.SOHBETLER_TAZE },
  });
})();
