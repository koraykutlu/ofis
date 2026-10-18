// "Bir ara yapalım" panosu (sağ panelde kart): aklına gelen "şunu yapalım bir ara" maddeleri, tik ve silme. Veri bu bilgisayarda (VERI/pano.json).
// Not: iki ofis arasında ortak pano için ziyaret kanalı üzerinden ayrı bir iş gerekir; şimdilik her ofisin panosu kendinindir.
(() => {
  const I = () => window.OFIS_IC;
  const el = (id) => document.getElementById(id);
  let liste = [];
  const api = (govde) => fetch("/api/pano", { method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": I().ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) }, body: govde ? JSON.stringify(govde) : undefined });
  async function yap(govde) {
    try {
      const r = await api(govde), j = await r.json();
      if (r.ok) { liste = j.liste; ciz(); el("panoHata").textContent = ""; } else el("panoHata").textContent = j.hata || "Olmadı.";
    } catch (e) { el("panoHata").textContent = "Sunucuya ulaşılamadı."; }
  }
  function ciz() {
    const ul = el("panoListe"); ul.textContent = "";
    el("panoSay").textContent = liste.length ? `${liste.filter((m) => m.bitti).length}/${liste.length}` : "";
    if (!liste.length) { const li = document.createElement("li"); li.className = "bos"; li.textContent = "Henüz yok. Aklına gelen bir şeyi yaz."; ul.append(li); }
    for (const m of liste) {
      const li = document.createElement("li"); if (m.bitti) li.className = "bitti";
      const kutu = document.createElement("button"); kutu.type = "button"; kutu.className = "kutu"; kutu.textContent = m.bitti ? "✓" : ""; kutu.setAttribute("aria-label", m.bitti ? "Tiki kaldır" : "Yapıldı");
      const ad = document.createElement("span"); ad.className = "ad"; ad.textContent = m.metin; ad.title = `${m.ekleyen || ""} · ${m.tarih || ""}`;
      const sil = document.createElement("button"); sil.type = "button"; sil.className = "sil"; sil.textContent = "✕"; sil.setAttribute("aria-label", "Sil");
      const degis = () => yap({ islem: "isaret", id: m.id, bitti: !m.bitti });
      kutu.onclick = degis; ad.onclick = degis; sil.onclick = () => yap({ islem: "sil", id: m.id });
      li.append(kutu, ad, sil); ul.append(li);
    }
  }
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    async basla() {
      if (!I().ANAHTAR || !el("panoKart")) return;
      el("panoForm").onsubmit = (e) => { e.preventDefault(); const g = el("panoGiris"), m = g.value.trim(); if (!m) return; g.value = ""; yap({ islem: "ekle", metin: m }); };
      try { const r = await api(); if (r.ok) { liste = (await r.json()).liste; ciz(); } } catch (e) { /* sunucu yok */ }
    },
    test: { liste: () => liste, yap },
  });
})();
