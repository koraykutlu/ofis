// Güncelleme (Ayarlar paneli bölümü): kurulu sürüm, "Denetle", yeni sürüm varsa notları ve "Güncelle", "Önceki sürüme dön", isteğe bağlı günlük otomatik denetim.
// Sunucu tarafı guncelleme.py (/api/guncelleme/*), kurulumu araclar/guncelle.py ayrı süreçte yapar (sha256 + izin listesi + yedek). Hiçbir veri gönderilmez.
// Güncelleme bitince sunucu yeniden başlar; bu modül /api/kimlik'i yoklar, sunucu dönünce sayfayı yeniler (pencere kapanıp açılmaz).
(() => {
  const el = (id) => document.getElementById(id);
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  let durum = null, yenileZ = 0, bekliyor = false, mesaj = "";

  async function api(yol, govde) {
    if (!ANAHTAR) return { hata: "Ofis sunucusu olmadan güncelleme çalışmaz.", _kod: 0 };
    try {
      const r = await fetch(`/api/guncelleme/${yol}`, { method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) },
        body: govde ? JSON.stringify(govde) : undefined });
      const j = await r.json().catch(() => ({}));
      return { ...j, _kod: r.status };
    } catch (e) { return { hata: "Ofis sunucusuna ulaşılamadı.", _kod: -1 }; }
  }
  const yaz = (id, m) => { const k = el(id); if (k) k.textContent = m || ""; };
  const ASAMA = { denetim: "Son sürüm soruluyor…", indirme: "İndiriliyor…", dogrulama: "Doğrulanıyor…", yedek: "Önceki sürüm yedekleniyor…", uygulama: "Dosyalar yerleştiriliyor…",
    uretim: "Görseller denetleniyor…", geri: "Geri alınıyor…", yeniden: "Ofis yeniden başlıyor…" };

  function kur() {
    const ayar = el("ayarPanel"); if (!ayar || el("gAyar")) return;
    const k = document.createElement("div"); k.id = "gAyar"; k.className = "zayar";
    k.addEventListener("click", (e) => e.stopPropagation());   // panel içi tıklama paneli kapatmasın
    k.innerHTML = `<h2>Güncelleme</h2>
      <div class="not" id="g_surum"></div>
      <div class="zsatir"><button id="g_denetle">Denetle</button><button id="g_kur" hidden>Güncelle</button><button id="g_geri" hidden>Önceki sürüme dön</button></div>
      <div class="not" id="g_yeni"></div>
      <label class="s"><span>Günde bir kez denetle</span><input type="checkbox" id="g_oto"></label>
      <div class="not" id="g_mesaj" aria-live="polite"></div>
      <div class="not">Açıkken Ofis, açılışta ve günde en çok bir kez yalnız son sürüm bilgisini sorar; hiçbir veri gönderilmez. Kurmadan önce dosya sağlama toplamı doğrulanır, önceki sürüm yedeklenir. İnternetsiz: yeni sürüm zip'ini Ofis klasörünün üstüne açıp Kur.bat'ı çalıştır.</div>`;
    const yer = el("a_sifirla");
    if (yer && yer.parentNode === ayar) ayar.insertBefore(k, yer); else ayar.append(k);
    el("g_denetle").onclick = async () => {
      mesaj = "Denetleniyor…"; ciz();
      const d = await api("denetle", {});
      if (d._kod === 200 || d.surum) { durum = d; mesaj = d.yeni ? "" : (d.son ? "Güncelsin." : ""); } else { mesaj = d.hata || "Denetlenemedi."; if (d.surum) durum = d; }
      ciz();
    };
    el("g_kur").onclick = async () => {
      if (bekliyor || !confirm("Güncelleme kurulacak ve Ofis yeniden başlayacak (önceki sürüm yedeklenir). Devam edilsin mi?")) return;
      const d = await api("kur", {});
      if (d._kod !== 200) { mesaj = d.hata || "Başlatılamadı."; if (d.surum) durum = d; ciz(); return; }
      beklemeBasla("Güncelleme başladı…");
    };
    el("g_geri").onclick = async () => {
      if (bekliyor || !confirm("Son güncelleme geri alınacak ve Ofis yeniden başlayacak. Devam edilsin mi?")) return;
      const d = await api("geri", {});
      if (d._kod !== 200) { mesaj = d.hata || "Başlatılamadı."; ciz(); return; }
      beklemeBasla("Geri dönülüyor…");
    };
    el("g_oto").onchange = async () => { const d = await api("ayar", { otomatik: el("g_oto").checked }); if (d.surum) durum = d; ciz(); };
    const gozle = new MutationObserver(() => {
      const acik = !ayar.hidden;
      if (acik && !yenileZ) { yenile(); yenileZ = setInterval(yenile, bekliyor ? 1500 : 5000); } else if (!acik && yenileZ) { clearInterval(yenileZ); yenileZ = 0; }
    });
    gozle.observe(ayar, { attributes: true, attributeFilter: ["hidden"] });
  }

  async function yenile() { const d = await api("durum"); if (d._kod === 200) { durum = d; ciz(); } }

  function ciz() {
    if (!el("gAyar") || !durum) return;
    const d = durum, i = d.islem, uzak = document.body.classList.contains("uzak");
    yaz("g_surum", `Kurulu sürüm: ${d.surum}` + (d.son_denetim ? ` · son denetim ${d.son_denetim}` : "") + (d.depo_ayarli ? "" : " · yayın deposu ayarlanmadı (çevrimiçi denetim kapalı)"));
    const yeni = el("g_yeni"); yeni.textContent = "";
    if (d.yeni && d.son) {
      yeni.append(`Yeni sürüm: ${d.son.surum}${d.son.yayin ? " (" + d.son.yayin + ")" : ""}`);
      if (d.son.notlar) { const n = document.createElement("div"); n.className = "gnot"; n.textContent = d.son.notlar.slice(0, 700); n.style.cssText = "white-space:pre-wrap;margin-top:4px;max-height:110px;overflow:auto"; yeni.append(n); }
      if (/^https:\/\/github\.com\//.test(d.son.url || "")) { const a = document.createElement("a"); a.href = d.son.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Sürüm sayfası"; a.style.display = "block"; yeni.append(a); }
    }
    el("g_kur").hidden = !d.yeni; el("g_geri").hidden = !d.geri_var;
    const mesgul = uzak || bekliyor || d.mesgul;   // ziyarette (uzak mod) ve işlem sürerken düğmeler kapalı
    el("g_denetle").disabled = mesgul || !d.depo_ayarli; el("g_kur").disabled = mesgul; el("g_geri").disabled = mesgul;
    el("g_oto").checked = !!d.otomatik; el("g_oto").disabled = !d.depo_ayarli;
    let m = mesaj;
    if (i && (d.mesgul || i.asama === "hata" || i.asama === "bitti")) m = i.asama === "hata" ? `Hata: ${i.mesaj}` : i.asama === "bitti" ? i.mesaj : (ASAMA[i.asama] || i.mesaj || "Çalışıyor…");
    else if (!m && d.son_hata) m = d.son_hata;
    else if (!m && d.mesaj && !d.depo_ayarli) m = d.mesaj;
    yaz("g_mesaj", m);
    if (bekliyor && i && i.asama === "hata") bekliyor = false;
  }

  // Sunucu yeniden başlarken: /api/kimlik (anahtarsız) yoklanır; kapanıp geri gelince ya da sürüm değişince sayfa yenilenir.
  async function beklemeBasla(ilk) {
    bekliyor = true; mesaj = ilk; ciz();
    let once = null; try { once = (await (await fetch("/api/kimlik", { cache: "no-store" })).json()).surum; } catch (e) {}
    let dustu = false, sayac = 0;
    const z = setInterval(async () => {
      sayac++;
      try {
        const j = await (await fetch("/api/kimlik", { cache: "no-store" })).json();
        if (j.uygulama === "ofis" && (dustu || (once && j.surum !== once))) { clearInterval(z); location.reload(); return; }
        const d = await api("durum"); if (d._kod === 200) { durum = d; ciz(); if (d.islem && d.islem.asama === "hata") { bekliyor = false; clearInterval(z); ciz(); } }
      } catch (e) { dustu = true; mesaj = "Ofis yeniden başlıyor…"; ciz(); }
      if (sayac > 240) { clearInterval(z); bekliyor = false; mesaj = "Ofis yanıt vermedi. Kısayoldan yeniden aç."; ciz(); }
    }, 1000);
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({ basla() { kur(); } });
})();
