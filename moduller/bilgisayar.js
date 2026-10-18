// Masa bilgisayarı: oyundan çıkmadan Ada'yla uzun, kalıcı sohbetler (sunucu: ofis.pyw > /api/bilgisayar/*, soru yine /api/sor).
// Masadaki bilgisayara yaklaşıp E'ye (ya da üstteki "🖥️ Bilgisayar" düğmesine) basınca karakter masasının önündeki koltuğa oturur ve büyük bir pencere açılır:
// solda sohbet listesi, sağda mesajlar (markdown, araç işlemleri, resim ekleme/yapıştırma), model ve efor seçimi. Sohbetler yeniden başlatmadan sonra da sürer.
// Ayarlar > "Tam yetenek" açıksa Ada vault'ta dosya yazabilir ve komut çalıştırabilir (rozet bunu gösterir); kapalıysa yalnız okur ve önerir.
// Ziyaretteyken (body.uzak) görünmez. Tablet kapısından erişilemez (sunucu izin listesinde yok).
(() => {
  const el = (id) => document.getElementById(id);
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  const DEPO = "ofis-bilgisayar-1";
  const MODELLER = { haiku: "Haiku 5.5", sonnet: "Sonnet 5.5", opus: "Opus 5.5", fable: "Fable 5.1" };
  const EFORLAR = { low: "Düşük", medium: "Orta", high: "Yüksek", xhigh: "Çok yüksek", max: "En yüksek" };
  const TUR_AD = { not: "Yeni not", gorev: "Yeni görev", ekle: "Nota ekle" };
  const BOSLUK = 14;   // masaya bu karoya kadar yaklaşınca E ile açılır
  let ic = null, pencere = null, acik = false, kayit = null, liste = [], sure = null, durdur = null, ekler = [], tamKip = false;
  let tercih = { model: "sonnet", efor: "medium" };
  try { Object.assign(tercih, JSON.parse(localStorage.getItem(DEPO) || "{}")); } catch (e) { /* özel pencere: varsayılan */ }
  if (!MODELLER[tercih.model]) tercih.model = "sonnet";
  if (!EFORLAR[tercih.efor]) tercih.efor = "medium";
  tercih.yan = tercih.yan === true;   // yan görünüm (pencere sağa yaslanır); tercih localStorage'da

  const api = (yol, govde) => fetch(yol, {
    method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) },
    body: govde ? JSON.stringify(govde) : undefined,
  });

  // ---------- küçük, güvenli markdown ----------
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
    let h = "", i = 0, liste_ = null;
    const kapatListe = () => { if (liste_) { h += `</${liste_}>`; liste_ = null; } };
    while (i < satirlar.length) {
      const s = satirlar[i];
      let m;
      if ((m = /^\s*```(\w*)\s*$/.exec(s))) {   // kod bloğu
        kapatListe(); const kod = []; i++;
        while (i < satirlar.length && !/^\s*```\s*$/.test(satirlar[i])) kod.push(satirlar[i++]);
        i++; h += `<pre><code>${kac(kod.join("\n"))}</code></pre>`; continue;
      }
      if (/^\s*\|.*\|\s*$/.test(s) && i + 1 < satirlar.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(satirlar[i + 1])) {   // tablo
        kapatListe(); const hucre = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const bas = hucre(s); i += 2; const govde = [];
        while (i < satirlar.length && /^\s*\|.*\|\s*$/.test(satirlar[i])) govde.push(hucre(satirlar[i++]));
        h += "<table><thead><tr>" + bas.map((c) => `<th>${satirBicim(c)}</th>`).join("") + "</tr></thead><tbody>"
          + govde.map((r) => "<tr>" + r.map((c) => `<td>${satirBicim(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>"; continue;
      }
      if ((m = /^(#{1,4})\s+(.*)$/.exec(s))) { kapatListe(); h += `<h${m[1].length + 2}>${satirBicim(m[2])}</h${m[1].length + 2}>`; i++; continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(s)) { kapatListe(); h += "<hr>"; i++; continue; }
      if ((m = /^\s*>\s?(.*)$/.exec(s))) { kapatListe(); h += `<blockquote>${satirBicim(m[1])}</blockquote>`; i++; continue; }
      if ((m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(s))) {   // kontrol listesi: yalnız görsel, tıklanamaz
        if (liste_ !== "ul") { kapatListe(); h += "<ul>"; liste_ = "ul"; }
        const tamam = m[1] !== " "; h += `<li class="kl${tamam ? " tamam" : ""}"><span class="kutu">${tamam ? "☑" : "☐"}</span>${satirBicim(m[2])}</li>`; i++; continue;
      }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(s))) { if (liste_ !== "ul") { kapatListe(); h += "<ul>"; liste_ = "ul"; } h += `<li>${satirBicim(m[1])}</li>`; i++; continue; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(s))) { if (liste_ !== "ol") { kapatListe(); h += "<ol>"; liste_ = "ol"; } h += `<li>${satirBicim(m[1])}</li>`; i++; continue; }
      kapatListe(); if (s.trim()) h += `<p>${satirBicim(s)}</p>`; i++;
    }
    kapatListe(); return h;
  }

  // ---------- pencere ----------
  function kur() {
    const sahne = el("sohbet") && el("sohbet").parentElement; if (!sahne) return false;
    pencere = document.createElement("div"); pencere.id = "bilg"; pencere.className = "cerceve"; pencere.hidden = true; pencere.setAttribute("role", "dialog"); pencere.setAttribute("aria-label", "Bilgisayar");
    pencere.innerHTML = `
      <div class="bb"><span class="bbaslik">🖥️ Bilgisayar</span><span id="bTam" class="brozet"></span><span class="bosluk"></span>
        <select id="bModel" aria-label="Model"></select><select id="bEfor" aria-label="Efor"></select>
        <button id="bYan" title="Yan görünüm: pencere sağa yaslanır, sohbet listesi daralır">◧</button><button id="bKalk" title="Pencereyi kapat ve koltuktan kalk">Kalk</button><button id="bKapat" title="Pencereyi kapat (Esc); koltukta oturmaya devam edersin">✕</button></div>
      <div class="bg">
        <aside class="bk"><button id="bYeni" class="bdugme">＋ Yeni sohbet</button><div id="bListe" class="bliste"></div></aside>
        <section class="bs">
          <div id="bMesajlar" aria-live="polite"></div>
          <div id="bEtkinlik" class="betkinlik"></div>
          <div id="bEkler" class="bekler"></div>
          <div class="bsg"><textarea id="bGiris" rows="2" placeholder="Ada'ya yaz… (Enter gönderir, Shift+Enter yeni satır; resim yapıştırabilirsin)" aria-label="Mesaj"></textarea>
            <button id="bResim" class="bdugme" title="Resim ekle">📎</button><button id="bGonder" class="bdugme bgonder">Gönder</button></div>
          <input type="file" id="bDosya" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
        </section>
      </div>`;
    sahne.append(pencere);
    for (const [k, v] of Object.entries(MODELLER)) el("bModel").add(new Option(v, k));
    for (const [k, v] of Object.entries(EFORLAR)) el("bEfor").add(new Option(v, k));
    el("bModel").value = tercih.model; el("bEfor").value = tercih.efor;
    const sakla = () => { try { localStorage.setItem(DEPO, JSON.stringify(tercih)); } catch (e) { /* yoksay */ } };
    el("bModel").onchange = () => { tercih.model = el("bModel").value; sakla(); };
    el("bEfor").onchange = () => { tercih.efor = el("bEfor").value; sakla(); };
    pencere.classList.toggle("yan", tercih.yan);
    el("bYan").onclick = () => { tercih.yan = !tercih.yan; pencere.classList.toggle("yan", tercih.yan); sakla(); };
    el("bKapat").onclick = () => kapat(false); el("bKalk").onclick = () => kapat(true);
    el("bYeni").onclick = () => { if (sure) return; yeniSohbet(); el("bGiris").focus(); };
    el("bGonder").onclick = () => (sure && durdur ? durdur() : gonder());
    el("bResim").onclick = () => el("bDosya").click();
    el("bDosya").onchange = async () => { for (const d of el("bDosya").files) await resimEkle(d); el("bDosya").value = ""; };
    const g = el("bGiris");
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!sure) gonder(); }
      if (e.key === "Escape") { e.preventDefault(); kapat(false); }
    });
    g.addEventListener("paste", async (e) => {
      const dosyalar = [...(e.clipboardData ? e.clipboardData.items : [])].filter((x) => x.kind === "file" && x.type.startsWith("image/")).map((x) => x.getAsFile());
      if (dosyalar.length) { e.preventDefault(); for (const d of dosyalar) await resimEkle(d); }
    });
    pencere.addEventListener("dragover", (e) => e.preventDefault());
    pencere.addEventListener("drop", async (e) => { e.preventDefault(); for (const d of e.dataTransfer.files) if (d.type.startsWith("image/")) await resimEkle(d); });
    pencere.addEventListener("keydown", (e) => { e.stopPropagation(); });   // yazarken oyun tuşları (WASD, E) karakteri oynatmasın
    return true;
  }

  // ---------- resim ekleme ----------
  async function kucult(dosya) {   // büyük resimleri JPEG'e küçültür (sunucu sınırı 6 MB; Claude için 2000 px yeter)
    if (dosya.size <= 3 * 1024 * 1024 && dosya.type !== "image/gif") return dosya;
    try {
      const bmp = await createImageBitmap(dosya), o = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * o); c.height = Math.round(bmp.height * o);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.88)); return b || dosya;
    } catch (e) { return dosya; }
  }
  const base64 = (blob) => new Promise((ok, hata) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = hata; r.readAsDataURL(blob); });
  async function resimEkle(dosya) {
    if (ekler.length >= 6) return bilgi("En çok 6 resim eklenebilir.", "uyari");
    const k = { ad: dosya.name || "resim", durum: "yukleniyor", yol: "" }; ekler.push(k); eklerCiz();
    try {
      const b = await kucult(dosya), r = await api("/api/bilgisayar/resim", { tur: b.type, veri: await base64(b) }), j = await r.json();
      if (!r.ok) throw new Error(j.hata || r.status); k.yol = j.yol; k.durum = "hazir";
    } catch (e) { k.durum = "hata"; k.hata = String(e.message || e); }
    eklerCiz();
  }
  function eklerCiz() {
    const k = el("bEkler"); k.replaceChildren();
    ekler.forEach((e, i) => {
      const c = document.createElement("span"); c.className = "bek " + e.durum;
      c.textContent = `🖼️ ${e.ad}${e.durum === "yukleniyor" ? " …" : e.durum === "hata" ? " (olmadı: " + e.hata + ")" : ""} `;
      const x = document.createElement("button"); x.textContent = "✕"; x.title = "Kaldır"; x.onclick = () => { ekler.splice(i, 1); eklerCiz(); }; c.append(x); k.append(c);
    });
  }

  // ---------- sohbet listesi ve kayıt ----------
  const yeniKayit = () => ({ id: "", baslik: "Yeni sohbet", oturum: "", tam: false, mesajlar: [] });
  async function listeYenile() {
    try { const r = await api("/api/bilgisayar/liste"); if (r.ok) liste = (await r.json()).liste || []; } catch (e) { /* sunucu yok */ }
    listeCiz();
  }
  function listeCiz() {
    const k = el("bListe"); k.replaceChildren();
    for (const s of liste) {
      const d = document.createElement("div"); d.className = "bsatir" + (kayit && kayit.id === s.id ? " secili" : "");
      const b = document.createElement("button"); b.className = "bsec"; b.textContent = s.baslik; b.title = `${s.sayi} mesaj`; b.onclick = () => { if (!sure) sohbetAc(s.id); };
      const x = document.createElement("button"); x.className = "bsil"; x.textContent = "🗑"; x.title = "Sil (yedeği 'silinen' klasöründe kalır)";
      x.onclick = async () => { if (sure || !confirm(`"${s.baslik}" silinsin mi?`)) return; await api("/api/bilgisayar/sil", { id: s.id }); if (kayit && kayit.id === s.id) yeniSohbet(); await listeYenile(); };
      d.append(b, x); k.append(d);
    }
    if (!liste.length) { const d = document.createElement("div"); d.className = "bnot"; d.textContent = "Henüz sohbet yok."; k.append(d); }
  }
  async function sohbetAc(id) {
    try { const r = await api("/api/bilgisayar/sohbet?id=" + encodeURIComponent(id)); if (!r.ok) return; kayit = await r.json(); } catch (e) { return; }
    if (MODELLER[kayit.model]) { tercih.model = kayit.model; el("bModel").value = kayit.model; }
    if (EFORLAR[kayit.efor]) { tercih.efor = kayit.efor; el("bEfor").value = kayit.efor; }
    mesajlarCiz(); listeCiz();
  }
  function yeniSohbet() { kayit = yeniKayit(); mesajlarCiz(); listeCiz(); }
  async function kaydet() {
    if (!kayit) return;
    try {
      const r = await api("/api/bilgisayar/kaydet", { id: kayit.id, baslik: kayit.baslik, oturum: kayit.oturum, tam: kayit.tam, model: tercih.model, efor: tercih.efor, mesajlar: kayit.mesajlar });
      const j = await r.json(); if (r.ok) kayit.id = j.id; else bilgi(j.hata || "Sohbet kaydedilemedi.", "uyari");
    } catch (e) { /* sunucu yok: bellekte kalır */ }
    listeYenile();
  }

  // ---------- mesajlar ----------
  const asagi = () => { const m = el("bMesajlar"); m.scrollTop = m.scrollHeight; };
  function balonYap(k, m) {
    const d = document.createElement("div"); d.className = "bmsj " + k;
    if (k === "ajan") d.innerHTML = markdown(m);
    else d.textContent = m;
    return d;
  }
  // Kod bloğu kopyala düğmesi: yalnız çizim sonunda çalışır (akış sırasında her parça için değil)
  function kopyaDugmeleri(kok) {
    kok.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".bkopya")) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "bkopya"; b.textContent = "Kopyala";
      b.onclick = async () => {
        const kod = Array.from(pre.childNodes).filter((n) => n !== b).map((n) => n.textContent).join("");
        try { await navigator.clipboard.writeText(kod); b.textContent = "Kopyalandı"; } catch (e) { b.textContent = "Olmadı"; }
        setTimeout(() => { b.textContent = "Kopyala"; }, 1500);
      };
      pre.append(b);
    });
  }
  // Seçenek kartı: son mesajsa ve ondan sonra kullanıcı mesajı yoksa etkin; kilitliyse kullanıcının seçtiği etiket (sonraki mesaj) vurgulanır
  function secenekKart(i, s, etkin) {
    const k = document.createElement("div"); k.className = "bsecenek";
    const soru = document.createElement("div"); soru.className = "bsoru"; soru.textContent = s.soru; k.append(soru);
    const sonraki = kayit.mesajlar.slice(i + 1).find((y) => y.k === "oyuncu");
    const secilenler = !etkin && sonraki ? (s.coklu ? sonraki.m.split(", ") : [sonraki.m]) : [];
    const isaretler = new Set();
    const gb = document.createElement("button"); gb.type = "button"; gb.className = "bdugme bgonder bsecgonder"; gb.textContent = "Gönder"; gb.disabled = true;
    gb.onclick = () => { if (!etkin || sure || !isaretler.size) return; gonderMetin(s.secenekler.map((o) => o.etiket).filter((e) => isaretler.has(e)).join(", "), false); };
    const liste_ = document.createElement("div"); liste_.className = "bsecler";
    for (const o of s.secenekler) {
      const b = document.createElement("button"); b.type = "button"; b.className = "bsecim";
      const ad = document.createElement("b"); ad.textContent = o.etiket; b.append(ad);
      if (o.aciklama) { const a = document.createElement("span"); a.textContent = o.aciklama; b.append(a); }
      if (!etkin) {
        b.disabled = true;
        b.classList.add(secilenler.includes(o.etiket) ? "secildi" : "soluk");
      }
      b.onclick = () => {
        if (!etkin || sure) return;   // akış sürerken kart tıklamaları yok sayılır
        if (s.coklu) {
          isaretler.has(o.etiket) ? isaretler.delete(o.etiket) : isaretler.add(o.etiket);
          b.classList.toggle("isaretli", isaretler.has(o.etiket)); gb.disabled = !isaretler.size; return;
        }
        gonderMetin(o.etiket, false);   // yazılmakta olan taslak korunur
      };
      liste_.append(b);
    }
    k.append(liste_);
    if (s.coklu) { if (!etkin) gb.disabled = true; k.append(gb); }
    const not = document.createElement("div"); not.className = "bsecnot"; not.textContent = "ya da kendi cevabını yaz"; k.append(not);
    return k;
  }
  function mesajlarCiz() {
    const kutu = el("bMesajlar"); kutu.replaceChildren();
    if (!kayit || !kayit.mesajlar.length) {
      const d = document.createElement("div"); d.className = "bbos";
      d.innerHTML = `<b>Merhaba!</b><br>Buradan oyundan çıkmadan Ada'yla konuşabilirsin. Notlarına bakar, bir şey öğrenmek istersen araştırır${tamKip ? ", dosya yazar ve komut çalıştırır" : ""}.${tamKip ? "" : "<br><span class='bsoluk'>Şu an yalnız-okur kipte: dosya yazma ve komut için Ayarlar > İkinci beyin > <b>Tam yetenek</b>.</span>"}`;
      kutu.append(d); return;
    }
    let grup = null;
    for (const [i, x] of kayit.mesajlar.entries()) {
      if (x.k === "arac") {
        if (!grup) { grup = document.createElement("details"); grup.className = "barac"; grup.append(document.createElement("summary")); kutu.append(grup); }
        const s = document.createElement("div"); s.textContent = x.m; grup.append(s); grup.firstChild.textContent = `⚙ ${grup.children.length - 1} işlem`;
        continue;
      }
      grup = null;
      if (x.k === "secenek") {
        let s = null;
        try { s = JSON.parse(x.m); } catch (e) { /* bozuk kayıt: kart çizilmez */ }
        if (s && Array.isArray(s.secenekler)) kutu.append(secenekKart(i, s, i === kayit.mesajlar.length - 1 && !sure));
        continue;
      }
      if (x.k === "bilgi") { const d = document.createElement("div"); d.className = "bbilgi"; d.textContent = x.m; kutu.append(d); }
      else kutu.append(balonYap(x.k === "resim" ? "oyuncu" : x.k, x.k === "resim" ? "🖼️ " + x.m : x.m));
    }
    kopyaDugmeleri(kutu);
    asagi();
  }
  function bilgi(metin, sinif) {
    const d = document.createElement("div"); d.className = "bbilgi " + (sinif || ""); d.textContent = metin; el("bMesajlar").append(d); asagi();
  }
  function oneriKart(o, kutu) {
    const k = document.createElement("div"); k.className = "oneriKart";
    if (o.gecersiz) { k.textContent = `Ada bir kayıt önerdi ama geçersizdi: ${o.gecersiz}`; kutu.append(k); return; }
    const bas = document.createElement("div"); bas.className = "ob"; bas.innerHTML = `<span class="tur">${kac(TUR_AD[o.tur] || o.tur)}</span> <code></code>`; bas.querySelector("code").textContent = o.yol;
    const on = document.createElement("pre"); on.textContent = o.metin; const dg = document.createElement("div"); dg.className = "od";
    const evet = document.createElement("button"); evet.className = "bdugme"; evet.textContent = "Onayla, kaydet";
    const hayir = document.createElement("button"); hayir.className = "bdugme"; hayir.textContent = "Vazgeç";
    const karar = async (v) => {
      evet.disabled = hayir.disabled = true;
      try { const r = await api("/api/onay", { jeton: o.jeton, karar: v }), j = await r.json(); dg.textContent = r.ok ? (v === "evet" ? "✔ " : "✖ ") + j.metin : "Olmadı: " + (j.hata || r.status); } catch (e) { dg.textContent = "Sunucuya ulaşılamadı."; }
    };
    evet.onclick = () => karar("evet"); hayir.onclick = () => karar("hayir"); dg.append(evet, hayir); k.append(bas, on, dg); kutu.append(k);
  }

  // giriş kutusundan gönderir; seçenek kartları da aynı yolu kullanır (temizle=false: kutudaki taslak kalır)
  function gonder() { return gonderMetin(el("bGiris").value.trim(), true); }
  async function gonderMetin(metin, temizle) {
    if ((!metin && !ekler.length) || sure) return;
    if (!ANAHTAR) return bilgi("Gerçek sohbet yalnız masaüstündeki Ofis kısayoluyla açınca çalışır.", "uyari");
    if (ekler.some((e) => e.durum === "yukleniyor")) return bilgi("Resim yükleniyor, bir saniye…", "uyari");
    const hazir = ekler.filter((e) => e.durum === "hazir");
    if (!kayit) kayit = yeniKayit();
    const soru = (hazir.length ? hazir.map((e) => `[Ekli resim: ${e.yol}]`).join("\n") + "\n" : "") + (metin || "Bu resme bak.");
    if (!kayit.mesajlar.length && kayit.baslik === "Yeni sohbet") kayit.baslik = (metin || hazir[0].ad).replace(/\s+/g, " ").slice(0, 50);
    hazir.forEach((e) => kayit.mesajlar.push({ k: "resim", m: e.ad }));
    kayit.mesajlar.push({ k: "oyuncu", m: metin || "(resim)" });
    if (temizle) el("bGiris").value = ""; ekler = []; eklerCiz(); mesajlarCiz();
    sure = true; el("bGonder").textContent = "Durdur"; el("bEtkinlik").textContent = "Ada düşünüyor…";
    const kutu = el("bMesajlar"); let balon = null, ham = "", bitti = null, hata = null; const baslangic = Date.now();
    const sayac = setInterval(() => { const e = el("bEtkinlik"); if (e.dataset.canli === "1") e.dataset.sn = Math.round((Date.now() - baslangic) / 1000); }, 1000);
    const etkinlik = (t) => { const e = el("bEtkinlik"); e.dataset.canli = "1"; e.textContent = t; };
    const ctrl = new AbortController(); durdur = () => { ctrl.abort(); api("/api/iptal", {}).catch(() => {}); };
    let aracGrubu = null;
    try {
      const r = await fetch("/api/sor", { method: "POST", signal: ctrl.signal, headers: { "X-Ofis-Anahtar": ANAHTAR, "Content-Type": "application/json" },
        body: JSON.stringify({ soru, ajan: "ada", oturum: kayit.oturum, model: tercih.model, efor: tercih.efor }) });
      if (!r.ok) throw new Error("sunucu " + r.status);
      const okur = r.body.getReader(), coz = new TextDecoder(); let tampon = "";
      for (;;) {
        const { value, done } = await okur.read(); if (done) break;
        tampon += coz.decode(value, { stream: true }); let i;
        while ((i = tampon.indexOf("\n")) >= 0) {
          const s = tampon.slice(0, i); tampon = tampon.slice(i + 1); if (!s.trim()) continue;
          const d = JSON.parse(s);
          if (d.tur === "basla") { etkinlik(`Ada düşünüyor… (${d.model} · ${EFORLAR[d.efor] || d.efor})`); kayit.tam = tamKip; }
          else if (d.tur === "arac") {
            const satir = `${d.ad}${d.hedef ? ": " + d.hedef : ""}`; kayit.mesajlar.push({ k: "arac", m: satir }); etkinlik("⚙ " + satir.slice(0, 90));
            if (!aracGrubu) { aracGrubu = document.createElement("details"); aracGrubu.className = "barac"; aracGrubu.append(document.createElement("summary")); kutu.append(aracGrubu); }
            const x = document.createElement("div"); x.textContent = satir; aracGrubu.append(x); aracGrubu.firstChild.textContent = `⚙ ${aracGrubu.children.length - 1} işlem`; balon = null; ham = ""; asagi();
          } else if (d.tur === "metin") {
            ham += d.parca; aracGrubu = null;
            if (!balon) { balon = balonYap("ajan", ""); kutu.append(balon); }
            balon.innerHTML = markdown(ham); asagi();
          } else if (d.tur === "bitti") bitti = d;
          else if (d.tur === "hata") hata = d;
        }
      }
    } catch (e) { hata = { metin: e.name === "AbortError" ? "Durduruldu." : "Sunucuya ulaşılamadı. Ofis penceresi açık mı?" }; }
    clearInterval(sayac); sure = null; durdur = null; el("bGonder").textContent = "Gönder"; el("bEtkinlik").dataset.canli = "0";
    el("bEtkinlik").textContent = bitti && bitti.sure ? `${bitti.sure} sn` : "";
    if (bitti) {
      kayit.oturum = bitti.oturum || kayit.oturum;
      const son = bitti.metin || ham || "(boş cevap)";
      if (son !== "(boş cevap)" || !bitti.secenek) kayit.mesajlar.push({ k: "ajan", m: son });   // yalnız kart varsa boş balon kalmasın
      if (bitti.secenek) kayit.mesajlar.push({ k: "secenek", m: JSON.stringify(bitti.secenek) });
      mesajlarCiz();   // araç grupları, son metin ve seçenek kartı kayıttan yeniden çizilir
      (bitti.oneriler || []).forEach((o) => oneriKart(o, el("bMesajlar"))); kopyaDugmeleri(el("bMesajlar")); asagi();
      if (window.OFIS_SES_AJAN) OFIS_SES_AJAN.cevap("ada", son);
    } else {
      if (hata && hata.oturum) kayit.oturum = hata.oturum;
      if (ham) kayit.mesajlar.push({ k: "ajan", m: ham });
      kayit.mesajlar.push({ k: "bilgi", m: hata ? hata.metin : "Cevap gelmedi." }); mesajlarCiz();
    }
    await kaydet();
    if (acik) el("bGiris").focus();
  }

  // ---------- aç / kapat / otur ----------
  async function tamBak() {
    try { const r = await api("/api/ayar-sunucu"); if (r.ok) tamKip = (await r.json()).tam === true; } catch (e) { /* bilinmiyor */ }
    const z = el("bTam"); if (z) { z.textContent = tamKip ? "● Tam yetenek" : "○ Yalnız okur"; z.className = "brozet " + (tamKip ? "tam" : "kisitli"); z.title = tamKip ? "Ada dosya yazabilir ve komut çalıştırabilir" : "Ayarlar > İkinci beyin > Tam yetenek ile açılır"; }
  }
  async function goster() {
    if (!pencere) return;
    acik = true; pencere.hidden = false; await tamBak(); await listeYenile();
    if (!kayit) { if (liste.length) await sohbetAc(liste[0].id); else yeniSohbet(); } else mesajlarCiz();
    setTimeout(() => el("bGiris").focus(), 30);
  }
  function kapat(kalk) {
    if (!pencere) return; acik = false; pencere.hidden = true;
    if (kalk && ic.oyuncu && ic.oyuncu.oturak) ic.kalk(ic.oyuncu);
    if (ic.cv) ic.cv.focus();
  }
  function oturVeAc() {
    if (!ANAHTAR) { ic.gunluk("Bilgisayar yalnız Ofis kısayoluyla açınca çalışır.", true); return; }
    if (document.body.classList.contains("uzak")) return;
    if (acik) return;
    const o = ic.oyuncu;
    if (o.oturak) return goster();
    const yerler = ic.OTURAKLAR.filter((x) => x.ad === "misafir koltuğu" && !x.dolu).sort((p, q) => Math.hypot(p.x - o.x, p.y - o.y) - Math.hypot(q.x - o.x, q.y - o.y));
    if (!yerler.length) return goster();   // koltuklar dolu: oturmadan aç
    ic.oturt(o, yerler[0], goster);
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() {
      ic = window.OFIS_IC;
      if (!kur()) return;
      el("bilgDugme").onclick = () => (acik ? kapat(false) : oturVeAc());
      // masadaki bilgisayar (oyuncunun monitörü, HARITA'da {monitor:{sahip:"oyuncu"}}): yakınında E ile aç
      const m = ic.monitorler.find((x) => x.sahip === "oyuncu"), T = ic.T;
      const mx = m ? (m.x + m.w / 2) / T : 18.2, my = m ? m.y / T + 0.9 : 5.0;
      ic.NESNELER.push({ x: mx, y: my, r: 2.6, etiket: () => (ic.oyuncu.oturak ? "Bilgisayarı aç" : "Bilgisayar: otur ve aç"), fn: oturVeAc });
    },
    canliCiz(t) {   // pencere açıkken masadaki monitör hafifçe parlar
      if (!acik || !ic) return;
      const m = ic.monitorler.find((x) => x.sahip === "oyuncu"); if (!m) return;
      ic.f.fillStyle = `rgba(143,227,240,${0.18 + 0.08 * Math.sin(t * 5)})`; ic.f.fillRect(m.x - 1, m.y - 15, m.w + 2, 6);
    },
  });
  window.OFIS_BILGISAYAR = { ac: oturVeAc, kapat, acik: () => acik };
})();
