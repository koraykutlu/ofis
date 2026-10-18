// Gerçek veri (salt-okur): vault'taki görevler, açık konular ve son oturum. Sunucu tarafı gercek_veri.py (/api/gercek/*, yalnız 127.0.0.1 + anahtar; PIN'li tablet kapısından da okunabilir).
// Sağ paneldeki tek "Bugün" kartının iş listesi (kart: moduller/panel.js, tik de orada), sabah brifingi (MOD "brifingVeri"; Haiku katmanı açıksa onun satırları eklenir),
// günde bir kez evrak uyarısı, oda kartında "Masada bekleyen iş", Ayarlar'da aç/kapat.
// Düz http.server'da, uzak modda (ziyaret) ve ziyarette hiç çalışmaz. Gerçek metin yalnız bu ekranda kalır: ziyaret anlık görüntüsüne (anYap) girmez.
(() => {
  const I = () => window.OFIS_IC;
  const el = (id) => document.getElementById(id);
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  const AYAR_ANAHTARI = "ofis-gercek-1", UYARI_ANAHTARI = "ofis-gercek-uyari-1";
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let veri = null, acik = true, hata = "", secili = "", yenileZ = 0, uyariZ = 0;

  const depoOku = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const depoYaz = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* kalıcı değil */ } };
  const uzak = () => { const ic = I(); return !!(ic && ic.uzak) || document.body.classList.contains("uzak"); };
  const kullanilir = () => !!ANAHTAR && acik && !uzak();
  const gorunur = () => (kullanilir() && veri ? veri : null);   // başka modüllerin gördüğü veri

  async function cek(yol, yontem) {
    if (!ANAHTAR) return null;
    try {
      const r = await fetch(`/api/gercek/${yol}`, { method: yontem || "GET", headers: { "X-Ofis-Anahtar": ANAHTAR, ...(yontem === "POST" ? { "Content-Type": "application/json" } : {}) }, body: yontem === "POST" ? "{}" : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { hata = j.hata || "Gerçek veri okunamadı."; return null; }
      hata = ""; return j;
    } catch (e) { hata = "Ofis sunucusuna ulaşılamadı."; return null; }
  }
  async function yenile(zorla) {
    if (!kullanilir()) { kartYaz(); return; }
    const j = await cek(zorla ? "yenile" : "ozet", zorla ? "POST" : "GET");
    if (j) { veri = j; brifingTazele(); }
    kartYaz(); ayarYaz();
  }

  // ---------- kart: tek "Bugün" kartı moduller/panel.js'tedir; bu modül yalnız veriyi sağlar (gorevler) ve kartı tazelemesini ister ----------
  function satirlar() {
    const g = (veri && veri.gorevler) || [];
    const secim = g.filter((x) => x.gecikti || x.bugun || x.durum === "doing" || x.durum === "active");
    return secim.slice(0, 6);
  }
  const gorevler = () => (kullanilir() && veri ? satirlar() : []);
  function kartYaz() { const P = window.OFIS_PANEL; if (P && P.ciz) P.ciz(); }

  // ---------- brifing (çekirdek MOD "brifingVeri") ----------
  function brifingSatirlari() {
    const v = gorunur(); if (!v) return undefined;
    const s = v.sayilar || {}, g = v.gorevler || [], sat = [];
    sat.push(`Açık iş ${s.acik || 0} · bugün ${s.bugun || 0} · gecikmiş ${s.gecikti || 0}.`);
    const acil = g.filter((x) => x.gecikti || x.bugun).slice(0, 2);
    if (acil.length) sat.push("Öncelik: " + acil.map((x) => esc(x.baslik)).join("; ") + ".");
    if (v.basliklar && v.basliklar.length) sat.push("Açık konular: " + v.basliklar.slice(0, 3).map(esc).join(", ") + (v.basliklar.length > 3 ? ` (+${v.basliklar.length - 3})` : "") + ".");
    if (v.son_oturum && v.son_oturum.baslik) sat.push("Son oturum: " + esc(v.son_oturum.baslik) + ".");
    const P = window.OFIS_PANEL; if (P && P.haikuBrifing) for (const h of P.haikuBrifing()) sat.push(esc(h));   // Haiku katmanı açıksa onun brifing satırları eklenir
    return sat;
  }
  function brifingTazele() {   // brifing fikri gösterilmişken veri sonradan geldiyse yerinde gerçeğe çevir
    const b = el("brifing"), sat = brifingSatirlari();
    if (b && sat && !b.classList.contains("bos") && b.dataset.gercek !== "1") { b.innerHTML = "<ul>" + sat.map((x) => `<li>${x}</li>`).join("") + "</ul>"; b.dataset.gercek = "1"; }
  }

  // ---------- evrak uyarısı: günde bir kez ----------
  function ajanSec(proje) {
    const ic = I(), p = (proje || "").toLowerCase();
    const aday = /radar|chart/.test(p) ? "tarayici" : "postaci";
    for (const id of [aday, "ada"]) { const a = ic.bul(id); if (a && !a.oyuncu && !a.disarda && !a.rut && !a.ozel && !ic.mesgul(a) && !a.konusuyor) return a; }
    return null;
  }
  function bugunKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  function uyariDene() {
    const ic = I(); if (!ic || !kullanilir() || !veri || ic.ofisDurum !== "acik" || ic.diyalogAcik()) return;
    if (depoOku(UYARI_ANAHTARI) === bugunKey()) return;
    const x = (veri.gorevler || []).find((t) => t.gecikti || t.bugun); if (!x) return;
    const o = ic.oyuncu; if (!o || o.disarda || o.oturak) return;
    const a = ajanSec(x.proje); if (!a) return;
    depoYaz(UYARI_ANAHTARI, bugunKey());
    const b = x.baslik.length > 48 ? x.baslik.slice(0, 47) + "…" : x.baslik;
    a.ozel = "gorev";
    ic.gonder(a, ic.ziyaretNoktasi(o), () => {
      ic.yonBak(a, o); ic.ses("bildirim");
      ic.konus(a, x.gecikti ? `${b}: süresi geçti.` : `${b} bugün bitiyor.`);
      ic.gunluk(`Evrak: ${x.gecikti ? "gecikmiş" : "bugün biten"} bir iş masaya bırakıldı.`);
      ic.sonra(2.6, () => ic.eveDon(a, () => (a.ozel = null)));
    });
    ic.sonra(40, () => { if (a.ozel === "gorev" && !a.yol.length && ic.yerinde(a)) a.ozel = null; });   // yol bulunamazsa ajan takılı kalmasın
  }

  // ---------- ayarlar ----------
  function ayarKur() {
    const ayar = el("ayarPanel"); if (!ayar || el("gAyarGercek")) return;
    const k = document.createElement("div"); k.id = "gAyarGercek"; k.className = "zayar";
    k.addEventListener("click", (e) => e.stopPropagation());
    k.innerHTML = `<h2>Gerçek veri</h2>
      <label class="s"><span>Vault görevlerini göster (salt-okur)</span><input type="checkbox" id="gv_acik"></label>
      <div class="zsatir"><button id="gv_yenile">Şimdi yenile</button></div>
      <div class="not" id="gv_bilgi" aria-live="polite"></div>
      <div class="not">Görev başlıkları yalnız bu bilgisayarda, bu ekranda görünür; ziyaretçilere ve ağa gönderilmez. Vault'a hiçbir şey yazılmaz.</div>`;
    const yer = el("a_sifirla");
    if (yer && yer.parentNode === ayar) ayar.insertBefore(k, yer); else ayar.append(k);
    el("gv_acik").checked = acik;
    el("gv_acik").onchange = () => { acik = el("gv_acik").checked; depoYaz(AYAR_ANAHTARI, acik ? "1" : "0"); if (acik) yenile(false); else { kartYaz(); } ayarYaz(); };
    el("gv_yenile").onclick = async () => { el("gv_bilgi").textContent = "Yenileniyor…"; await yenile(true); };
    ayarYaz();
  }
  function ayarYaz() {
    const b = el("gv_bilgi"); if (!b) return;
    b.textContent = !ANAHTAR ? "Ofis sunucusu (ofis.pyw) olmadan çalışmaz." : !acik ? "Kapalı." : hata ? hata : veri ? `${(veri.sayilar || {}).acik || 0} açık iş okundu (${String(veri.guncel || "").slice(11, 16)}).` : "Bekleniyor…";
  }

  function basla() {
    acik = depoOku(AYAR_ANAHTARI) !== "0";
    ayarKur();
    if (!ANAHTAR) return;   // düz http.server: gerçek veri yok
    yenile(false);
    yenileZ = setInterval(() => yenile(false), 5 * 60 * 1000);
    uyariZ = setInterval(uyariDene, 20000);
  }

  window.OFIS_GERCEK = { sayi: () => { const v = gorunur(); return v ? (v.sayilar || {}).acik : null; }, ozet: () => gorunur(), gorevler, yenile };
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla,
    brifingVeri: brifingSatirlari,
    test: { gercek: () => gorunur(), gercekYenile: () => yenile(true), gercekUyari: () => { try { localStorage.removeItem(UYARI_ANAHTARI); } catch (e) { /* */ } uyariDene(); } },
  });
})();
