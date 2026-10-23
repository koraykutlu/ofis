// Ayarlar paneli (header'daki ⚙️): ses seviyeleri, yazı boyutu, yürüme hızı, kamera yakınlığı, gün süresi, mini harita. localStorage'a
// kaydolur (erişilemezse varsayılanlar). Her değişiklik sayfa yenilenmeden uygulanır; gün süresi değişince oyun temiz biçimde baştan başlar.
// Çekirdeğe MOD kancalarıyla bağlanır (window.OFIS_IC): basla'da yükleyip uygular (çekirdek rutinPlanla'yı bundan sonra çağırır).
// Uygulayınca ayarUygulandi(ayar) yayınlar; başka modül bir ayarı ayarKaydet(k, v) ile yazar (mini harita M tuşu).
(() => {
  const I = () => window.OFIS_IC;
  const AYAR_ANAHTAR = "ofis-demo-ayar-1";
  const AYAR_VARSAYILAN = { genel: 100, ambiyans: 100, efekt: 100, muzikSes: 100, yazi: "normal", font: "piksel", kalite: "yuksek", yurume: 100, kamera: 200, gun: "gercek", acilis: 8, kapanis: 4, mini: true, muzik: true, muzikTarz: "lofi", somine: true, telefon: "KeyP", surum: 2 };
  const GUNLER = ["gercek", 2, 4, 6];   // gün süresi: gerçek saat ya da hızlı gün (dk)
  const ACILISLAR = [7, 8, 9, 10], KAPANISLAR = [0, 2, 3, 4, 5];   // ofis açılış saati; yedek otomatik kapanış (gece yarısından sonra saat, 0 = kapalı)
  const AYAR_ARALIK = { genel: [0, 150], ambiyans: [0, 150], efekt: [0, 150], muzikSes: [0, 150], yurume: [50, 200], kamera: [120, 320] };
  const YAZI_K = { kucuk: 0.8, normal: 1, buyuk: 1.3 };
  const TELEFON_TUSLARI = ["KeyP", "KeyQ", "KeyF", "KeyG"];   // telefonu açan tuş (e.code); T ziyaret sohbetinde kullanıldığı için yok
  // Görüntü kalitesi: tuval çözünürlüğü üst sınırı. Otomatik: kare hızı uzun süre 45 fps altında kalırsa bir kademe düşürür (Yüksek 1.5 > Dengeli 1 > Hızlı 0.75)
  const KALITE = { yuksek: 1.5, dengeli: 1, hizli: 0.75, otomatik: 1.5 }, KADEMELER = [1.5, 1, 0.75];
  let otoTavan = 1.5, yavasSay = 0, otoZ = 0;
  // Yazı tipi: varsayılan Pixelify Sans (Stardew tarzı, OFL); diğerleri sistem yazı tipleri (indirme gerektirmez)
  const FONTLAR = { piksel: "'Pixelify Sans', system-ui, sans-serif", sistem: "'Segoe UI', system-ui, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "Consolas, 'Courier New', monospace" };
  let sonFont = "";
  const ayar = { ...AYAR_VARSAYILAN };
  const el = (id) => document.getElementById(id);
  function ayarYukle() {
    try {
      const ham = JSON.parse(localStorage.getItem(AYAR_ANAHTAR) || "null");
      if (ham && typeof ham === "object") for (const k of Object.keys(AYAR_VARSAYILAN)) if (typeof ham[k] === typeof AYAR_VARSAYILAN[k]) ayar[k] = ham[k];
      if (ham && GUNLER.includes(ham.gun)) ayar.gun = ham.gun;
      if (ham && ham.surum !== 2) { ayar.gun = "gercek"; ayar.surum = 2; }   // gerçek saat gelmeden önce kaydedilmiş ayar: bir kez gerçek saate geç
    } catch (e) { /* erişilemezse varsayılanlar */ }
    for (const [k, [a, b]] of Object.entries(AYAR_ARALIK)) { const v = +ayar[k]; ayar[k] = Math.max(a, Math.min(b, Number.isFinite(v) ? v : AYAR_VARSAYILAN[k])); }
    if (!YAZI_K[ayar.yazi]) ayar.yazi = "normal";
    if (!KALITE[ayar.kalite]) ayar.kalite = "yuksek";
    if (!FONTLAR[ayar.font]) ayar.font = "piksel";
    if (!TELEFON_TUSLARI.includes(ayar.telefon)) ayar.telefon = "KeyP";
    if (!GUNLER.includes(ayar.gun)) ayar.gun = "gercek";
    if (!ACILISLAR.includes(ayar.acilis)) ayar.acilis = AYAR_VARSAYILAN.acilis;
    if (!KAPANISLAR.includes(ayar.kapanis)) ayar.kapanis = AYAR_VARSAYILAN.kapanis;
  }
  function ayarKaydet() { try { localStorage.setItem(AYAR_ANAHTAR, JSON.stringify(ayar)); } catch (e) { /* kayıt yok */ } }
  function otoKalite() {   // her 5 sn: son kare hızı 45'in altındaysa 3 ardışık ölçümden sonra bir kademe düşür
    const ic = I(), fps = window.OFIS_FPS; if (!ic || !fps || document.hidden) return;
    yavasSay = fps < 45 ? yavasSay + 1 : 0;
    if (yavasSay < 3) return;
    yavasSay = 0; const i = KADEMELER.indexOf(otoTavan); if (i < 0 || i >= KADEMELER.length - 1) return;
    otoTavan = KADEMELER[i + 1]; ic.kalite = otoTavan; ic.gunluk(`Görüntü kalitesi otomatik düşürüldü (kare hızı ~${fps} fps).`, true);
  }
  function ayarUygula(ilk) {
    const ic = I(), SES = window.SES;
    if (ayar.kalite === "otomatik") { ic.kalite = otoTavan; if (!otoZ) otoZ = setInterval(otoKalite, 5000); } else { clearInterval(otoZ); otoZ = 0; otoTavan = 1.5; yavasSay = 0; ic.kalite = KALITE[ayar.kalite]; }
    document.documentElement.style.setProperty("--yt", FONTLAR[ayar.font]); window.OFIS_YAZI_TIPI = FONTLAR[ayar.font];
    if (sonFont && sonFont !== ayar.font) ic.yerlesimYenile();   // oda tabelaları gibi önceden çizilmiş yazılar yeni yazı tipiyle yenilenir
    sonFont = ayar.font;
    ic.yaziK = YAZI_K[ayar.yazi]; ic.yurumeK = ayar.yurume / 100; ic.kameraK = ayar.kamera / 100; ic.MOD("ayarUygulandi", ayar);
    SES.seviye("genel", ayar.genel / 100); SES.seviye("ambiyans", ayar.ambiyans / 100); SES.seviye("efekt", ayar.efekt / 100); SES.seviye("muzik", ayar.muzikSes / 100);
    ic.ofisAyari(ayar.acilis, ayar.kapanis, ilk);   // açılış değişirse gün yeniden başlar; yalnız kapanış değişirse ofis durumu yeniden hesaplanır
    SES.muzik(ayar.muzik, ayar.muzikTarz); SES.somineSes(ayar.somine);   // müzik (gün müziği + Atölye) ve şömine sesi: açık/kapalı, Atölye tarzı
    ic.gunSuresi(ayar.gun === "gercek" ? 0 : ayar.gun * 60, ilk);   // değişirse olay saatleri, rutin ve görevler yeni güne göre ölçeklenir, oyun baştan başlar
    ayarPaneliniYaz();
  }
  function ayarPaneliniYaz() {
    const bicim = { genel: (v) => v + "%", ambiyans: (v) => v + "%", efekt: (v) => v + "%", muzikSes: (v) => v + "%", yurume: (v) => (v / 100).toFixed(1) + "×", kamera: (v) => (v / 100).toFixed(1) + "×" };
    for (const k of Object.keys(bicim)) { const r = el("a_" + k); if (r) { r.value = ayar[k]; el("o_" + k).textContent = bicim[k](ayar[k]); } }
    document.querySelectorAll("#ayarPanel [data-ayar]").forEach((b) => b.classList.toggle("secili", String(ayar[b.dataset.ayar]) === b.dataset.v));
    if (el("a_mini")) el("a_mini").checked = ayar.mini;
    if (el("a_muzik")) el("a_muzik").checked = ayar.muzik;
    if (el("a_somine")) el("a_somine").checked = ayar.somine;
  }
  // ---------- Tablet / telefon erişimi (sunucu: ofis.pyw > tablet kapısı) ----------
  // Yalnız bu bilgisayarın kendi penceresinde yönetilir; tablet/telefondan açılan sayfada bölüm gizlenir (sunucu o uçları reddeder).
  function tabletKur() {
    const ic = I(), bolum = el("tabletBolum"), kutu = el("t_acik"), bilgi = el("t_bilgi"), pinDugme = el("t_pin");
    if (!bolum || !ic.ANAHTAR) { if (bolum) bolum.hidden = true; return; }
    const api = (yol, govde) => fetch("/api/tablet/" + yol, { method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ic.ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) }, body: govde ? JSON.stringify(govde) : undefined });
    const yaz = (d) => {
      kutu.checked = !!d.acik; pinDugme.hidden = !d.acik;
      bilgi.textContent = "";
      if (!d.acik) { bilgi.textContent = "Kapalı. Açınca bu bilgisayarın adresi ve 6 haneli PIN burada görünür."; return; }
      const satir = (t, kalin) => { const p = document.createElement(kalin ? "b" : "span"); p.textContent = t; p.style.display = "block"; bilgi.append(p); };
      satir(d.calisiyor ? `PIN: ${d.pin}` : "Kapı açılamadı (günlüğe bak).", true);
      if (d.adresler.length) { satir("Tablette tarayıcıdan şu adreslerden birini aç (aynı Wi-Fi ya da Tailscale):"); d.adresler.forEach((a) => satir(a)); }
      else satir("Bu bilgisayarın özel ağ adresi bulunamadı (Wi-Fi'ye bağlı mısın?).");
      satir(`Giriş yapmış cihaz: ${d.cihaz}. Windows güvenlik duvarı sorarsa "özel ağlar"a izin ver.`);
    };
    const yenile = async () => {
      try { const r = await api("durum"); if (!r.ok) { bolum.hidden = true; return; } bolum.hidden = false; yaz(await r.json()); } catch (e) { /* sunucu yok */ }
    };
    kutu.onchange = async () => { try { const r = await api("ayar", { acik: kutu.checked }); if (r.ok) yaz(await r.json()); else kutu.checked = !kutu.checked; } catch (e) { kutu.checked = !kutu.checked; } };
    pinDugme.onclick = async () => { try { const r = await api("ayar", { yeni_pin: true }); if (r.ok) yaz(await r.json()); } catch (e) { /* yoksay */ } };
    new MutationObserver(() => { if (!el("ayarPanel").hidden) yenile(); }).observe(el("ayarPanel"), { attributes: true, attributeFilter: ["hidden"] });
    yenile();
  }
  // ---------- İkinci beyin anahtarları (sunucu: ofis.pyw > /api/ayar-sunucu): Haiku katmanı ve konuşma kaydı; ikisi de varsayılan KAPALI ----------
  function sunucuKur() {
    const ic = I(), bolum = el("sunucuBolum"), p = el("s_panel"), k = el("s_kayit"), pn = el("s_panel_not"), t = el("s_tam"), tt = el("s_tam_tablet");
    if (!bolum || !ic.ANAHTAR) return;
    const api = (g) => fetch("/api/ayar-sunucu", { method: g ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ic.ANAHTAR, ...(g ? { "Content-Type": "application/json" } : {}) }, body: g ? JSON.stringify(g) : undefined });
    const yaz = (d) => {
      bolum.hidden = false; p.checked = !!d.panel; k.checked = !!d.kayit; if (t) { t.checked = !!d.tam; t.disabled = !d.claude; } if (tt) { tt.checked = !!d.tam_tablet; tt.disabled = !d.claude; } p.disabled = !d.panel_var || !d.claude;
      if (!d.claude) pn.textContent = "Claude Code bulunamadı: Haiku katmanı kullanılamaz.";
    };
    const yenile = async () => { try { const r = await api(); if (r.ok) yaz(await r.json()); else bolum.hidden = true; } catch (e) { /* sunucu yok */ } };
    const gonder = (g, kutu) => async () => { try { const r = await api(g()); if (r.ok) { yaz(await r.json()); if (window.OFIS_PANEL) window.OFIS_PANEL.cek(); } else kutu.checked = !kutu.checked; } catch (e) { kutu.checked = !kutu.checked; } };
    p.onchange = gonder(() => ({ panel: p.checked }), p); k.onchange = gonder(() => ({ kayit: k.checked }), k);
    if (t) t.onchange = () => { if (t.checked && !confirm("Tam yetenek: çalışanlar bu bilgisayarda komut çalıştırabilir ve vault dosyalarını değiştirebilir. Açılsın mı?")) { t.checked = false; return; } gonder(() => ({ tam: t.checked }), t)(); };
    if (tt) tt.onchange = () => { if (tt.checked && !confirm("Tabletten de tam yetenek: PIN'i bilen herkes bu bilgisayarda komut çalıştırabilir ve dosyaları değiştirebilir. Açılsın mı?")) { tt.checked = false; return; } gonder(() => ({ tam_tablet: tt.checked }), tt)(); };
    new MutationObserver(() => { if (!el("ayarPanel").hidden) yenile(); }).observe(el("ayarPanel"), { attributes: true, attributeFilter: ["hidden"] });
    yenile();
  }
  function ayarKur() {
    const panel = el("ayarPanel"), dugme = el("ayarDugme"), odak = () => I().cv.focus();
    const goster = (a) => { panel.hidden = !a; dugme.setAttribute("aria-expanded", a); dugme.classList.toggle("secili", a); };
    dugme.onclick = (e) => { e.stopPropagation(); goster(panel.hidden); };
    document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target) && e.target !== dugme) goster(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { goster(false); odak(); } });
    for (const k of Object.keys(AYAR_ARALIK)) {
      const r = el("a_" + k);
      r.oninput = () => { ayar[k] = +r.value; ayarUygula(); ayarKaydet(); };
      r.onchange = odak;
    }
    panel.querySelectorAll("[data-ayar]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.ayar, v = b.dataset.v; ayar[k] = k === "gun" ? (v === "gercek" ? v : +v) : (k === "acilis" || k === "kapanis") ? +v : v; ayarUygula(); ayarKaydet(); odak();
    }));
    // Ofis saati: seçilen saate atlar (çalışanlar o saatte olmaları gereken yerde olur); "Şimdi" bilgisayar saatine döner
    // (yazı yerine açılır liste: dokunmatik ve klavye için güvenilir; seçince saat hemen uygulanır)
    const sS = el("a_saatS"), sD = el("a_saatD"), iki = (n) => String(n).padStart(2, "0");
    for (let s = 0; s < 24; s++) sS.add(new Option(iki(s), s));
    for (let d = 0; d < 60; d += 5) sD.add(new Option(iki(d), d));
    const simdiYaz = () => { const t = new Date(); sS.value = t.getHours(); sD.value = Math.floor(t.getMinutes() / 5) * 5; };
    simdiYaz();
    const saatUygula = () => { if (I().saatAyarla(+sS.value, +sD.value)) odak(); };
    sS.onchange = saatUygula; sD.onchange = saatUygula;
    el("a_saatSimdi").onclick = () => { I().saatSifirla(); simdiYaz(); odak(); };
    el("a_muzik").onchange = () => { ayar.muzik = el("a_muzik").checked; ayarUygula(); ayarKaydet(); odak(); };
    el("a_somine").onchange = () => { ayar.somine = el("a_somine").checked; ayarUygula(); ayarKaydet(); odak(); };
    el("a_mini").onchange = () => { ayar.mini = el("a_mini").checked; ayarUygula(); ayarKaydet(); odak(); };
    tabletKur(goster); sunucuKur();
    el("a_sifirla").onclick = () => { Object.assign(ayar, AYAR_VARSAYILAN); ayarUygula(); ayarKaydet(); odak(); };
  }

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() { ayarYukle(); ayarKur(); ayarUygula(true); ayarKaydet(); },   // kaydet: sürüm geçişi (gerçek saat) kalıcı olsun   // gün süresi çekirdeğin rutinPlanla'sından önce belli olmalı
    ayarKaydet(k, v) { ayar[k] = v; ayarKaydet(); ayarPaneliniYaz(); },
    test: {
      ayar: () => { const ic = I(); return { ...ayar, GERCEK: ic.GERCEK, DONGU: ic.DONGU, yo: ic.yo, yaziK: ic.yaziK, yurumeK: ic.yurumeK, kameraK: ic.kameraK, olcek: ic.olcek() }; },
    },
  });
})();
