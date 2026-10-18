// Claude Code uygulaması: masa bilgisayarındaki "Claude Code" penceresinin sohbet arayüzü.
// Sunucu: /api/claude/* (oturum listesi, geçmiş, resim) ve /api/sor (NDJSON akış); hepsi X-Ofis-Anahtar başlığıyla.
// bilgisayar.js ciz()'in döndürdüğü tek DOM öğesini pencere içeriği yapar. Durum modül düzeyinde tutulur,
// ciz() her çağrıda DOM'u yeniden kurup aynı durumdan çizer (pencere kapanıp açılınca sohbet kaybolmaz).
(() => {
  "use strict";
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  const VARSAYILAN_MODELLER = { haiku: "Haiku 5.5", sonnet: "Sonnet 5.5", opus: "Opus 5.5" };
  const EFORLAR = { low: "Düşük", medium: "Orta", high: "Yüksek" };
  const TUR_AD = { not: "Yeni not", gorev: "Yeni görev", ekle: "Nota ekle" };
  const DEVAM = "Onayladım, eminim. Kilide takılan işi birebir aynı haliyle şimdi yap.";
  const CSS = `
  #bos .cc { position:relative; display:flex; height:100%; min-height:0; width:100%; box-sizing:border-box; font:13px var(--os-govde); color:var(--os-yazi); text-align:left; }
  #bos .cc button, #bos .cc select, #bos .cc textarea { font:inherit; color:inherit; }
  #bos .cc button { background:var(--os-dugme); border:1px solid var(--os-dugme-kenar); border-radius:8px; padding:4px 10px; cursor:pointer; }
  #bos .cc button:disabled { opacity:.45; cursor:default; }
  #bos .cc select { background:var(--os-giris); border:1px solid var(--os-kenar); border-radius:8px; padding:3px 6px; }
  #bos .cc .cc-kenar { width:210px; flex:none; display:flex; flex-direction:column; gap:8px; padding:10px; box-sizing:border-box; border-right:1px solid var(--os-kenar); min-height:0; }
  #bos .cc .cc-yeni { width:100%; padding:7px 10px; font-weight:600; }
  #bos .cc .cc-liste { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:3px; }
  #bos .cc .cc-satir { display:flex; border-radius:9px; border:1px solid transparent; }
  #bos .cc .cc-satir.secili { background:var(--os-oge); border-color:var(--os-vy); }
  #bos .cc .cc-sec { flex:1; min-width:0; text-align:left; background:none; border:0; padding:6px 8px; display:flex; flex-direction:column; gap:2px; }
  #bos .cc .cc-ad { display:block; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  #bos .cc .cc-zaman { font-size:11px; color:var(--os-soluk); }
  #bos .cc .cc-not { font-size:11px; color:var(--os-soluk); line-height:1.4; }
  #bos .cc .cc-ana { flex:1; min-width:0; display:flex; flex-direction:column; min-height:0; }
  #bos .cc .cc-ust { display:flex; align-items:center; gap:6px; padding:8px 10px; border-bottom:1px solid var(--os-kenar); flex-wrap:wrap; }
  #bos .cc .cc-baslik { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; max-width:40%; }
  #bos .cc .cc-bosluk { flex:1; }
  #bos .cc .cc-rozet { font-size:11px; color:var(--os-soluk); white-space:nowrap; }
  #bos .cc .cc-rozet.tam { color:var(--os-vy); }
  #bos .cc .cc-rozet.kisitli { color:#f0a46a; }
  #bos .cc .cc-kenarduge { display:none; padding:4px 8px; }
  #bos .cc .cc-mesajlar { flex:1; min-height:0; overflow-y:auto; padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
  #bos .cc .cc-bmsj { max-width:86%; padding:8px 11px; border-radius:10px; overflow-wrap:anywhere; }
  #bos .cc .cc-bmsj.oyuncu { align-self:flex-end; background:var(--os-dugme); white-space:pre-wrap; }
  #bos .cc .cc-bmsj.ajan { align-self:stretch; max-width:100%; padding:2px 0; }
  #bos .cc .cc-bmsj p { margin:0 0 8px; }
  #bos .cc .cc-bmsj h3, #bos .cc .cc-bmsj h4, #bos .cc .cc-bmsj h5, #bos .cc .cc-bmsj h6 { margin:8px 0 4px; font-size:14px; font-weight:600; }
  #bos .cc .cc-bmsj code { font:12px Consolas, "Cascadia Mono", monospace; background:var(--os-giris); padding:1px 4px; border-radius:4px; }
  #bos .cc .cc-bmsj pre { position:relative; margin:6px 0 8px; background:var(--os-giris); border:1px solid var(--os-kenar); border-radius:8px; padding:8px 10px; overflow-x:auto; white-space:pre; }
  #bos .cc .cc-bmsj pre code { background:none; padding:0; }
  #bos .cc .cc-kopya { position:absolute; top:4px; right:4px; font-size:11px; padding:2px 6px; }
  #bos .cc .cc-bmsj table { border-collapse:collapse; margin:6px 0; display:block; overflow-x:auto; max-width:100%; }
  #bos .cc .cc-bmsj th, #bos .cc .cc-bmsj td { border:1px solid var(--os-kenar); padding:4px 8px; text-align:left; vertical-align:top; }
  #bos .cc .cc-bmsj th { background:var(--os-oge); }
  #bos .cc .cc-bmsj blockquote { margin:6px 0; padding-left:10px; border-left:3px solid var(--os-vy); color:var(--os-soluk); }
  #bos .cc .cc-bmsj hr { border:0; border-top:1px solid var(--os-kenar); margin:8px 0; }
  #bos .cc .cc-bmsj ul, #bos .cc .cc-bmsj ol { margin:4px 0 8px 20px; padding:0; }
  #bos .cc .cc-bmsj li.kl { list-style:none; margin-left:-20px; }
  #bos .cc .cc-bmsj li.kl .kutu { display:inline-block; width:20px; }
  #bos .cc .cc-bmsj li.kl.tamam { color:var(--os-soluk); text-decoration:line-through; }
  #bos .cc .cc-bmsj a { color:var(--os-vy); }
  #bos .cc .cc-arac { align-self:flex-start; max-width:92%; font-size:12px; color:var(--os-soluk); border:1px solid var(--os-kenar); border-radius:8px; padding:4px 8px; }
  #bos .cc .cc-arac summary { cursor:pointer; }
  #bos .cc .cc-arac > div { padding:2px 0; font:11.5px Consolas, monospace; overflow-wrap:anywhere; }
  #bos .cc .cc-bilgi { align-self:center; font-size:12px; color:var(--os-soluk); text-align:center; }
  #bos .cc .cc-bilgi.uyari { color:#f0a46a; }
  #bos .cc .cc-bos { margin:auto; text-align:center; color:var(--os-soluk); max-width:420px; line-height:1.5; }
  #bos .cc .cc-bos b { color:var(--os-yazi); }
  #bos .cc .cc-kart { align-self:flex-start; max-width:92%; background:var(--os-oge); border:1px solid var(--os-oge-kenar); border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:8px; }
  #bos .cc .cc-soru { font-weight:600; }
  #bos .cc .cc-secenekler { display:flex; flex-direction:column; gap:6px; }
  #bos .cc .cc-secim { text-align:left; display:flex; flex-direction:column; gap:2px; padding:8px 10px; }
  #bos .cc .cc-secim b { font-weight:600; }
  #bos .cc .cc-secim span { font-size:12px; color:var(--os-soluk); }
  #bos .cc .cc-secim:disabled { opacity:.5; }
  #bos .cc .cc-secim.secildi { opacity:1; border-color:var(--os-vy); }
  #bos .cc .cc-secim.isaretli { border-color:var(--os-vy); }
  #bos .cc .cc-secnot { font-size:11.5px; color:var(--os-soluk); }
  #bos .cc .cc-kart pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; background:var(--os-giris); border:1px solid var(--os-kenar); border-radius:8px; padding:8px 10px; font:12px Consolas, monospace; }
  #bos .cc .cc-tur { font-size:11px; color:var(--os-vy); font-weight:600; }
  #bos .cc .cc-od { display:flex; gap:6px; flex-wrap:wrap; font-size:12.5px; }
  #bos .cc .cc-ekler { display:flex; flex-wrap:wrap; gap:6px; padding:0 14px; }
  #bos .cc .cc-ekler:empty { display:none; }
  #bos .cc .cc-ek { font-size:12px; background:var(--os-oge); border:1px solid var(--os-oge-kenar); border-radius:8px; padding:3px 6px; }
  #bos .cc .cc-ek button { padding:0 4px; border:0; background:none; font-size:11px; }
  #bos .cc .cc-etkinlik { min-height:16px; padding:0 14px; font-size:11.5px; color:var(--os-soluk); }
  #bos .cc .cc-etkinlik.uyari { color:#f0a46a; }
  #bos .cc .cc-girisalan { display:flex; gap:6px; align-items:flex-end; padding:8px 10px; border-top:1px solid var(--os-kenar); }
  #bos .cc .cc-giris { flex:1; min-width:0; resize:vertical; min-height:38px; background:var(--os-giris); border:1px solid var(--os-kenar); border-radius:10px; padding:7px 9px; }
  #bos .cc .cc-gonder { font-weight:600; padding:7px 14px; }
  @media (max-width:620px) {
    #bos .cc .cc-kenar { display:none; position:absolute; left:0; top:0; bottom:0; z-index:2; background:var(--os-pencere); }
    #bos .cc.kenar-acik .cc-kenar { display:flex; }
    #bos .cc .cc-kenarduge { display:inline-block; }
    #bos .cc .cc-baslik { max-width:30%; }
  }`;

  // Modül durumu: pencere kapanıp açılsa da korunur.
  const D = {
    secili: "", baslik: "Yeni sohbet", mesajlar: [], kes: false,
    liste: [], taslak: "", ekler: [],
    model: "", efor: "medium", modeller: null, tam: false,
    sure: false, durdur: null, etkinlik: "", baslangic: 0, sonSure: "", canli: "",
    uyari: "", kenarAcik: true,
  };
  let kok = null, r = {}, canliEl = null, uyariZaman = null, zamanlayici = false;

  const api = (yol, govde) => fetch(yol, {
    method: govde !== undefined ? "POST" : "GET",
    headers: { "X-Ofis-Anahtar": ANAHTAR, ...(govde !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: govde !== undefined ? JSON.stringify(govde) : undefined,
  });
  const div = (sinif, metin) => { const d = document.createElement("div"); if (sinif) d.className = sinif; if (metin !== undefined) d.textContent = metin; return d; };
  const asagi = () => { if (r.mesajlar) r.mesajlar.scrollTop = r.mesajlar.scrollHeight; };

  // ---------- küçük, güvenli markdown (ham HTML asla basılmaz; her metin kaçışlanır) ----------
  const kac = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function satirBicim(t) {   // satır içi: `kod` korunur; kalın, italik, bağlantı (yalnız http/https)
    return String(t).split(/(`[^`]+`)/).map((p) => {
      if (/^`[^`]+`$/.test(p)) return `<code>${kac(p.slice(1, -1))}</code>`;
      return kac(p).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }).join("");
  }
  function markdown(metin) {
    const satirlar = String(metin).replace(/\r\n/g, "\n").split("\n");
    let h = "", i = 0, acikListe = null, paragraf = [];
    const paragrafKapat = () => { if (paragraf.length) { h += `<p>${paragraf.map(satirBicim).join("<br>")}</p>`; paragraf = []; } };
    const kapat = () => { paragrafKapat(); if (acikListe) { h += `</${acikListe}>`; acikListe = null; } };
    const listeAc = (tur) => { if (acikListe !== tur) { kapat(); h += `<${tur}>`; acikListe = tur; } };
    while (i < satirlar.length) {
      const s = satirlar[i];
      let m;
      if (/^\s*```/.test(s)) {   // kod bloğu: ``` ile açılır, ``` ile kapanır
        kapat(); const kod = []; i++;
        while (i < satirlar.length && !/^\s*```\s*$/.test(satirlar[i])) kod.push(satirlar[i++]);
        i++; h += `<pre><code>${kac(kod.join("\n"))}</code></pre>`; continue;
      }
      if (/^\s*\|.*\|\s*$/.test(s) && i + 1 < satirlar.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(satirlar[i + 1])) {   // tablo
        kapat(); const hucre = (x) => x.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const bas = hucre(s); i += 2; const govde = [];
        while (i < satirlar.length && /^\s*\|.*\|\s*$/.test(satirlar[i])) govde.push(hucre(satirlar[i++]));
        h += "<table><thead><tr>" + bas.map((c) => `<th>${satirBicim(c)}</th>`).join("") + "</tr></thead><tbody>"
          + govde.map((x) => "<tr>" + x.map((c) => `<td>${satirBicim(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>"; continue;
      }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(s))) { kapat(); const n = m[1].length + 2; h += `<h${n}>${satirBicim(m[2])}</h${n}>`; i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)) { kapat(); h += "<hr>"; i++; continue; }
      if ((m = /^\s*>\s?(.*)$/.exec(s))) { kapat(); h += `<blockquote>${satirBicim(m[1])}</blockquote>`; i++; continue; }
      if ((m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(s))) {   // kontrol listesi: yalnız görsel, tıklanamaz
        listeAc("ul"); const tamam = m[1] !== " ";
        h += `<li class="kl${tamam ? " tamam" : ""}"><span class="kutu">${tamam ? "☑" : "☐"}</span>${satirBicim(m[2])}</li>`; i++; continue;
      }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(s))) { listeAc("ul"); h += `<li>${satirBicim(m[1])}</li>`; i++; continue; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(s))) { listeAc("ol"); h += `<li>${satirBicim(m[1])}</li>`; i++; continue; }
      if (s.trim()) { if (acikListe) kapat(); paragraf.push(s); } else kapat();
      i++;
    }
    kapat(); return h;
  }

  // ---------- stil (tek kez) ----------
  function stilEkle() {
    if (document.getElementById("cc-stil")) return;
    const st = document.createElement("style"); st.id = "cc-stil"; st.textContent = CSS; document.head.append(st);
  }

  // ---------- pencere iskeleti ve bağlama ----------
  function ciz() {
    stilEkle();
    kok = document.createElement("div");
    kok.className = "cc" + (D.kenarAcik ? " kenar-acik" : "");
    kok.innerHTML = `
      <aside class="cc-kenar">
        <button type="button" class="cc-yeni">＋ Yeni sohbet</button>
        <div class="cc-liste"></div>
        <div class="cc-not">Bu liste masaüstündeki Claude Code uygulamasıyla aynı oturumlardır (İkinci Beyin klasörü).</div>
      </aside>
      <section class="cc-ana">
        <div class="cc-ust">
          <button type="button" class="cc-kenarduge" title="Sohbet listesini aç/kapat">☰</button>
          <span class="cc-baslik"></span>
          <span class="cc-rozet"></span>
          <span class="cc-bosluk"></span>
          <select class="cc-model" aria-label="Model"></select>
          <select class="cc-efor" aria-label="Efor"></select>
        </div>
        <div class="cc-mesajlar" aria-live="polite"></div>
        <div class="cc-etkinlik"></div>
        <div class="cc-ekler"></div>
        <div class="cc-girisalan">
          <textarea class="cc-giris" rows="2" placeholder="Ada'ya yaz… (Enter gönderir, Shift+Enter yeni satır; resim yapıştırabilirsin)" aria-label="Mesaj"></textarea>
          <button type="button" class="cc-resim" title="Resim ekle">📎</button>
          <button type="button" class="cc-gonder cc-dugme">Gönder</button>
        </div>
        <input type="file" class="cc-dosya" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
      </section>`;
    const q = (s) => kok.querySelector(s);
    r = {
      liste: q(".cc-liste"), baslik: q(".cc-baslik"), rozet: q(".cc-rozet"), model: q(".cc-model"), efor: q(".cc-efor"),
      mesajlar: q(".cc-mesajlar"), etkinlik: q(".cc-etkinlik"), ekler: q(".cc-ekler"), giris: q(".cc-giris"),
      gonder: q(".cc-gonder"), resim: q(".cc-resim"), dosya: q(".cc-dosya"),
    };
    q(".cc-yeni").onclick = () => { if (!D.sure) yeniSohbet(); };
    q(".cc-kenarduge").onclick = () => { D.kenarAcik = !D.kenarAcik; kok.classList.toggle("kenar-acik", D.kenarAcik); };
    r.model.onchange = () => { D.model = r.model.value; };
    r.efor.onchange = () => { D.efor = r.efor.value; };
    r.resim.onclick = () => r.dosya.click();
    r.dosya.onchange = async () => { for (const d of Array.from(r.dosya.files)) await resimEkle(d); r.dosya.value = ""; };
    r.gonder.onclick = () => (D.sure ? D.durdur && D.durdur() : gonder());
    r.giris.oninput = () => { D.taslak = r.giris.value; };
    r.giris.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!D.sure) gonder(); }
    });
    r.giris.addEventListener("paste", async (e) => {
      const dosyalar = Array.from(e.clipboardData ? e.clipboardData.items : []).filter((x) => x.kind === "file" && x.type.startsWith("image/")).map((x) => x.getAsFile());
      if (dosyalar.length) { e.preventDefault(); for (const d of dosyalar) await resimEkle(d); }
    });
    kok.addEventListener("dragover", (e) => e.preventDefault());
    kok.addEventListener("drop", async (e) => {
      e.preventDefault(); for (const d of Array.from(e.dataTransfer.files)) if (d.type.startsWith("image/")) await resimEkle(d);
    });
    kok.addEventListener("keydown", (e) => e.stopPropagation());   // yazarken oyun tuşları karakteri oynatmasın

    r.giris.value = D.taslak;
    if (!ANAHTAR) {
      r.giris.disabled = true; r.resim.disabled = true; r.gonder.disabled = true;
    }
    modelDoldur(); eforDoldur();
    hepsiniCiz();
    if (ANAHTAR) { tamKontrol(); modelleriYukle(); listeYenile(); }
    zamanlayicilariBaslat();
    return kok;
  }

  function zamanlayicilariBaslat() {
    if (zamanlayici) return; zamanlayici = true;
    setInterval(() => { if (kok && kok.isConnected && ANAHTAR) listeYenile(); }, 15000);   // sohbet listesi 15 sn'de bir
    setInterval(() => { if (kok && kok.isConnected && D.sure) etkinlikCiz(); }, 1000);     // geçen süre
  }

  // ---------- çizim yardımcıları ----------
  function hepsiniCiz() { baslikCiz(); rozetCiz(); listeCiz(); mesajlariCiz(); ekleriCiz(); gonderDugmesiCiz(); etkinlikCiz(); }
  function baslikCiz() { if (r.baslik) r.baslik.textContent = D.baslik || "Yeni sohbet"; }
  function rozetCiz() {
    const z = r.rozet; if (!z) return;
    z.textContent = D.tam ? "● Tam yetenek" : "○ Yalnız okur";
    z.className = "cc-rozet " + (D.tam ? "tam" : "kisitli");
    z.title = D.tam ? "Ada dosya yazabilir ve komut çalıştırabilir" : "Ayarlar > İkinci beyin > Tam yetenek ile açılır";
  }
  function gonderDugmesiCiz() { if (r.gonder) r.gonder.textContent = D.sure ? "Durdur" : "Gönder"; }
  function modelDoldur() {
    if (!r.model) return;
    const modeller = D.modeller || VARSAYILAN_MODELLER;
    r.model.replaceChildren(new Option("Otomatik", ""));
    for (const [k, v] of Object.entries(modeller)) r.model.add(new Option(v, k));
    r.model.value = D.model && modeller[D.model] ? D.model : "";
  }
  function eforDoldur() {
    if (!r.efor) return;
    r.efor.replaceChildren();
    for (const [k, v] of Object.entries(EFORLAR)) r.efor.add(new Option(v, k));
    r.efor.value = EFORLAR[D.efor] ? D.efor : "medium";
  }
  function goreli(epoch) {
    const s = Date.now() / 1000 - epoch;
    if (s < 60) return "az önce";
    if (s < 3600) return Math.floor(s / 60) + " dk önce";
    if (s < 86400) return Math.floor(s / 3600) + " sa önce";
    if (s < 172800) return "dün";
    return new Date(epoch * 1000).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  }
  function listeCiz() {
    if (!r.liste) return;
    r.liste.replaceChildren();
    for (const s of D.liste) {
      const satir = div("cc-satir" + (s.id === D.secili ? " secili" : ""));
      const b = document.createElement("button"); b.type = "button"; b.className = "cc-sec"; b.title = s.baslik || "";
      b.append(div("cc-ad", s.baslik || "Sohbet"), div("cc-zaman", goreli(s.guncel || 0)));
      b.onclick = () => { if (!D.sure) sohbetAc(s.id); };
      satir.append(b); r.liste.append(satir);
    }
    if (!D.liste.length) r.liste.append(div("cc-not", "Henüz sohbet yok."));
  }
  function ekleriCiz() {
    if (!r.ekler) return;
    r.ekler.replaceChildren();
    for (const e of D.ekler) {
      const c = div("cc-ek", `🖼️ ${e.ad}${e.durum === "yukleniyor" ? " …" : e.durum === "hata" ? " (olmadı: " + e.hata + ")" : ""} `);
      const x = document.createElement("button"); x.type = "button"; x.textContent = "✕"; x.title = "Kaldır";
      x.onclick = () => { D.ekler = D.ekler.filter((y) => y !== e); ekleriCiz(); };
      c.append(x); r.ekler.append(c);
    }
  }
  function etkinlikCiz() {
    const e = r.etkinlik; if (!e) return;
    e.classList.toggle("uyari", !!D.uyari);
    if (D.uyari) { e.textContent = D.uyari; return; }
    if (D.sure) { e.textContent = `${D.etkinlik} · ${Math.round((Date.now() - D.baslangic) / 1000)} sn`; return; }
    e.textContent = D.sonSure ? `${D.sonSure} sn` : "";
  }
  function uyariGoster(metin) {
    D.uyari = metin; etkinlikCiz();
    clearTimeout(uyariZaman); uyariZaman = setTimeout(() => { D.uyari = ""; etkinlikCiz(); }, 4000);
  }

  // Kod bloğu kopyala düğmesi: çizim sonunda eklenir (akış sırasında her parça için değil)
  function kopyaDugmeleri(kutu) {
    kutu.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".cc-kopya")) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "cc-kopya"; b.textContent = "Kopyala";
      b.onclick = async () => {
        const kod = Array.from(pre.childNodes).filter((n) => n !== b).map((n) => n.textContent).join("");
        try { await navigator.clipboard.writeText(kod); b.textContent = "Kopyalandı"; } catch (e) { b.textContent = "Olmadı"; }
        setTimeout(() => { b.textContent = "Kopyala"; }, 1500);
      };
      pre.append(b);
    });
  }

  // Seçenek kartı: yalnız son kullanıcı mesajından önceki kart etkin; kilitliyse kullanıcının seçtiği etiket vurgulanır
  function secenekKart(i, s, etkin) {
    const k = div("cc-kart");
    k.append(div("cc-soru", s.soru || "Seçin"));
    const sonraki = D.mesajlar.slice(i + 1).find((y) => y.k === "oyuncu");
    const secilenler = !etkin && sonraki ? (s.coklu ? sonraki.m.split(", ") : [sonraki.m]) : [];
    const isaretler = new Set();
    const liste = div("cc-secenekler");
    const gb = document.createElement("button"); gb.type = "button"; gb.className = "cc-gonder cc-dugme"; gb.textContent = "Gönder"; gb.disabled = true;
    gb.onclick = () => {
      if (!etkin || D.sure || !isaretler.size) return;
      gonderMetin(s.secenekler.map((o) => o.etiket).filter((e) => isaretler.has(e)).join(", "), false);
    };
    for (const o of s.secenekler) {
      const b = document.createElement("button"); b.type = "button"; b.className = "cc-secim";
      const ad = document.createElement("b"); ad.textContent = o.etiket; b.append(ad);
      if (o.aciklama) { const a = document.createElement("span"); a.textContent = o.aciklama; b.append(a); }
      if (!etkin) { b.disabled = true; if (secilenler.includes(o.etiket)) b.classList.add("secildi"); }
      b.onclick = () => {
        if (!etkin || D.sure) return;
        if (s.coklu) {
          if (isaretler.has(o.etiket)) isaretler.delete(o.etiket); else isaretler.add(o.etiket);
          b.classList.toggle("isaretli", isaretler.has(o.etiket)); gb.disabled = !isaretler.size; return;
        }
        gonderMetin(o.etiket, false);   // yazılmakta olan taslak korunur
      };
      liste.append(b);
    }
    k.append(liste);
    if (s.coklu) k.append(gb);
    k.append(div("cc-secnot", "ya da kendi cevabını yaz"));
    return k;
  }

  // Öneri kartı (kayıt önerisi): onay /api/onay ile; sonuç kart üzerinde kalır
  function oneriKart(o) {
    const k = div("cc-kart");
    if (o.gecersiz) { k.textContent = "Ada bir kayıt önerdi ama geçersizdi: " + o.gecersiz; return k; }
    if (o.sonuc) { k.textContent = o.sonuc; return k; }
    if (!o.jeton) { k.textContent = "✔ Kaydedildi" + (o.kaydedildi ? " · " + o.kaydedildi : ""); return k; }
    const bas = div("cc-ob");
    const tur = document.createElement("span"); tur.className = "cc-tur"; tur.textContent = TUR_AD[o.tur] || o.tur || "Kayıt";
    const yol = document.createElement("code"); yol.textContent = o.yol || "";
    bas.append(tur, " ", yol);
    if (o.baslik) bas.append(" ", div("", o.baslik));
    const on = document.createElement("pre"); on.textContent = o.metin || "";
    const dg = div("cc-od");
    const evet = document.createElement("button"); evet.type = "button"; evet.textContent = "Onayla, kaydet";
    const hayir = document.createElement("button"); hayir.type = "button"; hayir.textContent = "Vazgeç";
    evet.disabled = hayir.disabled = !!o.kararda;
    const karar = async (v) => {
      o.kararda = true; mesajlariCiz();
      try {
        const rs = await api("/api/onay", { jeton: o.jeton, karar: v }), j = await rs.json();
        o.sonuc = rs.ok ? (v === "evet" ? "✔ " : "✖ ") + j.metin : "Olmadı: " + (j.hata || rs.status);
      } catch (e) { o.sonuc = "Sunucuya ulaşılamadı."; }
      delete o.jeton; o.kararda = false; mesajlariCiz();
    };
    evet.onclick = () => karar("evet"); hayir.onclick = () => karar("hayir");
    dg.append(evet, hayir); k.append(bas, on, dg);
    return k;
  }

  // Kritik kart: "Emin misin?" onayı; "evet" sonrası devam mesajı otomatik gönderilir
  function kritikKart(o) {
    const k = div("cc-kart");
    k.append(div("cc-soru", "⚠ Emin misin?"));
    if (o.neden) k.append(div("", o.neden));
    if (o.is) { const p = document.createElement("pre"); p.textContent = o.is; k.append(p); }
    if (o.sonuc) { k.append(div("", o.sonuc)); return k; }
    const dg = div("cc-od");
    const evet = document.createElement("button"); evet.type = "button"; evet.textContent = "Evet, devam et";
    const hayir = document.createElement("button"); hayir.type = "button"; hayir.textContent = "Vazgeç";
    evet.disabled = hayir.disabled = !!o.kararda;
    const karar = async (v) => {
      o.kararda = true; mesajlariCiz();
      let devam = false;
      try {
        const rs = await api("/api/kritik", { jeton: o.jeton, karar: v }), j = await rs.json();
        o.sonuc = rs.ok ? (v === "evet" ? "✔ " : "✖ ") + j.metin : "Olmadı: " + (j.hata || rs.status);
        devam = rs.ok && v === "evet";
      } catch (e) { o.sonuc = "Sunucuya ulaşılamadı."; }
      delete o.jeton; o.kararda = false; mesajlariCiz();
      if (devam) gonderMetin(DEVAM, false);
    };
    evet.onclick = () => karar("evet"); hayir.onclick = () => karar("hayir");
    dg.append(evet, hayir); k.append(dg);
    return k;
  }

  // Mesaj listesini durumdan çizer. Akış sürerken canlı balon ayrı tutulur (canliGuncelle).
  function mesajlariCiz() {
    if (!r.mesajlar) return;
    const kutu = r.mesajlar; kutu.replaceChildren(); canliEl = null;
    if (!ANAHTAR) { kutu.append(div("cc-bos", "Yalnız masaüstündeki Ofis kısayoluyla açınca çalışır.")); return; }
    if (!D.mesajlar.length && !D.sure) {
      const d = div("cc-bos");
      d.innerHTML = `<b>Merhaba!</b><br>İkinci Beyin klasöründe Claude Code ile konuşabilirsin.${D.tam ? " Dosya yazabilir ve komut çalıştırabilir." : "<br><span>Şu an yalnız-okur kipte. Dosya yazma ve komut için Ayarlar > İkinci beyin > <b>Tam yetenek</b>.</span>"}`;
      kutu.append(d); return;
    }
    if (D.kes) kutu.append(div("cc-bilgi", "Yalnız son 300 mesaj gösteriliyor."));
    let grup = null, sayi = 0;
    D.mesajlar.forEach((x, i) => {
      if (x.k === "arac") {
        if (!grup) { grup = document.createElement("details"); grup.className = "cc-arac"; grup.append(document.createElement("summary")); kutu.append(grup); sayi = 0; }
        grup.append(div("", x.m)); sayi++; grup.firstChild.textContent = `⚙ ${sayi} işlem`; return;
      }
      grup = null;
      const sonrasiKullanici = D.mesajlar.slice(i + 1).some((y) => y.k === "oyuncu");
      if (x.k === "secenek") kutu.append(secenekKart(i, x.s, !D.sure && !sonrasiKullanici));
      else if (x.k === "oneri") kutu.append(oneriKart(x.o));
      else if (x.k === "kritik") kutu.append(kritikKart(x.o));
      else if (x.k === "bilgi") kutu.append(div("cc-bilgi" + (x.uyari ? " uyari" : ""), x.m));
      else if (x.k === "ajan") { const d = div("cc-bmsj ajan"); d.innerHTML = markdown(x.m); kutu.append(d); }
      else kutu.append(div("cc-bmsj oyuncu", x.k === "resim" ? "🖼️ " + x.m : x.m));
    });
    if (D.sure && D.canli) { canliEl = div("cc-bmsj ajan"); canliEl.innerHTML = markdown(D.canli); kutu.append(canliEl); }
    kopyaDugmeleri(kutu);
    asagi();
  }
  // Akış sırasında yalnız canlı balon güncellenir; pencere kapalıysa durum kayıtlı kalır, açılınca çizilir
  function canliGuncelle() {
    if (!r.mesajlar || !r.mesajlar.isConnected) return;
    if (!canliEl || !canliEl.isConnected) { mesajlariCiz(); return; }
    canliEl.innerHTML = markdown(D.canli); asagi();
  }

  // ---------- sohbet listesi, oturum yükleme ----------
  async function listeYenile() {
    if (!ANAHTAR) return;
    try { const rs = await api("/api/claude/oturumlar"); if (rs.ok) D.liste = (await rs.json()).liste || []; } catch (e) { /* sunucu yok: eski liste kalır */ }
    const s = D.liste.find((x) => x.id === D.secili); if (s) D.baslik = s.baslik || D.baslik;
    listeCiz(); baslikCiz();
  }
  async function sohbetAc(id) {
    if (D.sure || !ANAHTAR) return;
    try {
      const rs = await api("/api/claude/oturum?id=" + encodeURIComponent(id));
      if (!rs.ok) return uyariGoster("Sohbet açılamadı.");
      const j = await rs.json();
      D.secili = j.id || id; D.baslik = j.baslik || "Sohbet"; D.kes = !!j.kes; D.canli = "";
      D.mesajlar = (j.mesajlar || []).filter((x) => x && ["oyuncu", "ajan", "arac"].includes(x.k)).map((x) => ({ k: x.k, m: String(x.m || "") }));
    } catch (e) { return uyariGoster("Sohbet açılamadı."); }
    hepsiniCiz();
  }
  function yeniSohbet() {
    D.secili = ""; D.baslik = "Yeni sohbet"; D.mesajlar = []; D.kes = false; D.canli = ""; D.sonSure = "";
    hepsiniCiz(); if (r.giris) r.giris.focus();
  }

  // ---------- model, tam yetenek ----------
  async function tamKontrol() {
    try { const rs = await api("/api/ayar-sunucu"); if (rs.ok) D.tam = (await rs.json()).tam === true; } catch (e) { /* bilinmiyor */ }
    rozetCiz(); mesajlariCiz();
  }
  async function modelleriYukle() {
    try {
      const rs = await api("/api/durum");
      if (rs.ok) { const j = await rs.json(); if (j.modeller && Object.keys(j.modeller).length) D.modeller = j.modeller; }
    } catch (e) { /* varsayılan liste */ }
    if (D.model && !(D.modeller || VARSAYILAN_MODELLER)[D.model]) D.model = "";
    modelDoldur();
  }

  // ---------- resim ekleme ----------
  async function kucult(dosya) {   // büyük resimleri JPEG'e küçültür (Claude için 2000 px yeter)
    if (dosya.size <= 3 * 1024 * 1024 && dosya.type !== "image/gif") return dosya;
    try {
      const bmp = await createImageBitmap(dosya), o = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * o); c.height = Math.round(bmp.height * o);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.88)); return b || dosya;
    } catch (e) { return dosya; }
  }
  const base64 = (blob) => new Promise((ok, hata) => {
    const okuyucu = new FileReader();
    okuyucu.onload = () => ok(String(okuyucu.result).split(",")[1] || "");
    okuyucu.onerror = hata; okuyucu.readAsDataURL(blob);
  });
  async function resimEkle(dosya) {
    if (D.ekler.length >= 6) return uyariGoster("En çok 6 resim eklenebilir.");
    const e = { ad: dosya.name || "resim", durum: "yukleniyor", yol: "", hata: "" };
    D.ekler.push(e); ekleriCiz();
    try {
      const b = await kucult(dosya);
      const rs = await api("/api/claude/resim", { tur: b.type, veri: await base64(b) }), j = await rs.json();
      if (!rs.ok) throw new Error(j.hata || rs.status);
      e.yol = j.yol; e.durum = "hazir";
    } catch (err) { e.durum = "hata"; e.hata = String(err.message || err); }
    ekleriCiz();
  }

  // ---------- gönderim ----------
  function gonder() { return gonderMetin(r.giris.value.trim(), true); }
  // giriş kutusundan ya da seçenek kartlarından gelir (temizle=false: kutudaki taslak kalır)
  async function gonderMetin(metin, temizle) {
    if ((!metin && !D.ekler.length) || D.sure) return;
    if (!ANAHTAR) return uyariGoster("Yalnız masaüstündeki Ofis kısayoluyla açınca çalışır.");
    if (D.ekler.some((e) => e.durum === "yukleniyor")) return uyariGoster("Resim yükleniyor, bir saniye…");
    const hazir = D.ekler.filter((e) => e.durum === "hazir");
    if (!metin && !hazir.length) return uyariGoster("Resim yüklenemedi, tekrar dene.");
    const s = D.liste.find((x) => x.id === D.secili);
    if (D.secili && s && Date.now() / 1000 - (s.guncel || 0) < 120 &&
        !confirm("Bu oturum şu an masaüstü uygulamasında açık olabilir; yine de devam edilsin mi?")) return;

    const soru = (hazir.length ? hazir.map((e) => `[Ekli resim: ${e.yol}]`).join("\n") + "\n" : "") + (metin || "Bu resme bak.");
    if (!D.secili && !D.mesajlar.length) D.baslik = (metin || hazir[0].ad).replace(/\s+/g, " ").slice(0, 50);
    hazir.forEach((e) => D.mesajlar.push({ k: "resim", m: e.ad }));
    D.mesajlar.push({ k: "oyuncu", m: metin || "(resim)" });
    if (temizle) { D.taslak = ""; if (r.giris) r.giris.value = ""; }
    D.ekler = []; ekleriCiz();
    D.sure = true; D.canli = ""; D.etkinlik = "Ada düşünüyor…"; D.baslangic = Date.now(); D.sonSure = "";
    hepsiniCiz();

    const ctrl = new AbortController();
    D.durdur = () => { ctrl.abort(); api("/api/iptal", {}).catch(() => {}); };
    const govde = { soru, ajan: "ada", oturum: D.secili, efor: D.efor };
    if (D.model) govde.model = D.model;   // boşsa model gönderilmez: sunucu varsayılanı kullanır
    let bitti = null, hata = null;
    try {
      const rs = await fetch("/api/sor", {
        method: "POST", signal: ctrl.signal,
        headers: { "X-Ofis-Anahtar": ANAHTAR, "Content-Type": "application/json" }, body: JSON.stringify(govde),
      });
      if (!rs.ok) throw new Error("sunucu " + rs.status);
      const okur = rs.body.getReader(), coz = new TextDecoder(); let tampon = "";
      for (;;) {
        const { value, done } = await okur.read(); if (done) break;
        tampon += coz.decode(value, { stream: true });
        let i;
        while ((i = tampon.indexOf("\n")) >= 0) {
          const satir = tampon.slice(0, i); tampon = tampon.slice(i + 1);
          if (!satir.trim()) continue;
          let d; try { d = JSON.parse(satir); } catch (e) { continue; }   // bozuk satır atlanır
          if (d.tur === "basla") {
            D.etkinlik = `Ada düşünüyor… (${d.model || ""}${d.efor ? " · " + (EFORLAR[d.efor] || d.efor) : ""})`; etkinlikCiz();
          } else if (d.tur === "arac") {
            const satir2 = `${d.ad}${d.hedef ? ": " + d.hedef : ""}`;
            if (D.canli.trim()) D.mesajlar.push({ k: "ajan", m: D.canli });   // araçtan önceki metin kalıcı olur
            D.canli = "";
            D.mesajlar.push({ k: "arac", m: satir2 }); D.etkinlik = "⚙ " + satir2.slice(0, 90);
            mesajlariCiz(); etkinlikCiz();
          } else if (d.tur === "metin") {
            D.canli += d.parca || ""; canliGuncelle();
          } else if (d.tur === "bitti") bitti = d;
          else if (d.tur === "hata") hata = d;
        }
      }
    } catch (e) {
      hata = { metin: e.name === "AbortError" ? "Durduruldu." : "Sunucuya ulaşılamadı. Ofis penceresi açık mı?" };
    }

    D.sure = false; D.durdur = null;
    D.sonSure = bitti && bitti.sure ? String(bitti.sure) : "";
    if (bitti) {
      D.secili = bitti.oturum || D.secili;
      const son = bitti.metin || D.canli || "";
      D.canli = "";
      if (son.trim()) D.mesajlar.push({ k: "ajan", m: son });
      else if (!bitti.secenek) D.mesajlar.push({ k: "ajan", m: "(boş cevap)" });
      if (bitti.secenek && Array.isArray(bitti.secenek.secenekler)) D.mesajlar.push({ k: "secenek", s: bitti.secenek });
      for (const o of bitti.oneriler || []) D.mesajlar.push({ k: "oneri", o });
      for (const o of bitti.kritik || []) D.mesajlar.push({ k: "kritik", o });
      if (window.OFIS_SES_AJAN) OFIS_SES_AJAN.cevap("ada", son);
    } else {
      if (hata && hata.oturum) D.secili = hata.oturum;
      if (D.canli.trim()) D.mesajlar.push({ k: "ajan", m: D.canli });
      D.canli = "";
      D.mesajlar.push({ k: "bilgi", m: hata ? hata.metin : "Cevap gelmedi.", uyari: true });
    }
    hepsiniCiz();
    await listeYenile();
    if (kok && kok.isConnected && r.giris && !r.giris.disabled) r.giris.focus();
  }

  // Dışarıdan: bilgisayar.js bu modülün ciz() çıktısını pencere içeriği olarak koyar
  window.OFIS_CLAUDE_KODU = { ciz };
})();
