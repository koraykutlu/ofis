// Ofis bilgisayarı (BeyinOS): oyuncunun masasındaki bilgisayara E → karakter masaya oturur, ekran yakınlaşır, açılış ekranı ve piksel masaüstü açılır.
// İkinci beynin önemli bilgileri uygulamalarda görünür (sunucu: os_veri.py, /api/os/ozet; salt-okur): Hedefler, İşler, Fikirler, Yaptıklarım (oturum kartları +
// biten görevler), Posta (günlük posta/takvim özeti notu; ofis Gmail'e bağlanmaz), Projeler, Odak, Ayarlar. Masaüstünde seviye/XP, rozetler ve "günün görevleri" (oyunlaştırma; puanlar
// yalnız gösterimdir, hiçbir yere yazılmaz).
// Mesajlar: ekip arkadaşlarına mesaj atılır (/api/sor, kaynak "os"). Ayarlar > "Mesajla gelen kayıtları doğrudan kaydet" açıksa (VERI/os-ayar.json, varsayılan kapalı) ajanın kayıt önerisi
// onay beklemeden kaydedilir; kapalıyken onay kartı çıkar. Kayıt olunca ajan kâğıdı oyuncunun masasına getirir (mizansen).
// Görünüm (Ayarlar > Görünüm, tarayıcıda saklanır): tema koyu / açık / otomatik (ofis saatine göre), yazı modern / piksel, duvar kâğıdı saate göre gök / düz.
// Modern OS: alt ortada cam dock, Ctrl+Space arama (uygulamalar + yüklü veri; sunucuya gitmez), bildirim baloncukları + zil menüsü, masaüstü bileşenleri (saat,
// sıradaki iş, odak), birden çok pencere (başlıktan sürükle, küçült, büyüt; başlığa çift tık büyütür).
// Uygulamalar ayrıca: Terminal (Ada ile gerçek iş: araç adımları canlı log, tam yetenek kipinde kritik işler "Emin misin?"), Sütlaç Koşusu (yılan oyunu),
// Odak (pomodoro istatistiği: etkilesim.js > window.OFIS_ODAK). Sürprizler: masaüstünde soluk "çok gizli" klasörü (şifreli), 02:00-05:00 arası açınca
// Ada uyumanı söyler ve ekran koruyucu erken gelir (boşta: gece 25 sn, gündüz 3 dk), bilgisayar açıkken Sütlaç ara sıra klavyene çıkıp yazar.
// Tuşlar: E masada aç, Ctrl+Space ara, Esc aramayı / öndeki pencereyi / bilgisayarı kapat. Ziyaretteyken (uzak) ve sunucusuz açılışta gerçek veri yoktur.
// Telefon (GTA tarzı): telefon tuşu (Ayarlar > Telefon tuşu, varsayılan P) ofisin her yerinden aynı uygulamaları dikey bir telefonda açar. Sağ altta yukarı kayar, ofis kararmaz,
// oyuncu telefon açıkken yürümeye devam eder (yön tuşları / WASD). Üst çubukta saat ve bulunduğun oda (konum), altta ana ekran çizgisi (uygulamadan çık / telefonu kapat).
(() => {
  const I = () => window.OFIS_IC;
  const ANAHTAR = (document.querySelector('meta[name="ofis-anahtar"]') || {}).content || "";
  const DEPO_MESAJ = "ofis-bilgisayar-mesaj-1";
  const MASA = (window.HARITA && HARITA.noktalar && HARITA.noktalar.oyuncu) || [18, 6];
  const AJANLAR = Object.fromEntries((window.DEMO ? DEMO.ajanlar : []).filter((a) => !a.oyuncu).map((a) => [a.id, a]));
  const UYG = [
    { id: "hedefler", ad: "Hedefler", ikon: "🎯" }, { id: "isler", ad: "İşler", ikon: "✅" }, { id: "fikirler", ad: "Fikirler", ikon: "💡" },
    { id: "yapilanlar", ad: "Yaptıklarım", ikon: "🏆" }, { id: "posta", ad: "Posta", ikon: "✉️" }, { id: "mesajlar", ad: "Mesajlar", ikon: "💬" },
    { id: "projeler", ad: "Projeler", ikon: "📁" }, { id: "claudekodu", ad: "Claude Code", ikon: "✳️" }, { id: "terminal", ad: "Terminal", ikon: "🖥️" }, { id: "sutlac", ad: "Sütlaç Koşusu", ikon: "🐱" },
    { id: "odak", ad: "Odak", ikon: "⏱️" }, { id: "ayarlar", ad: "Ayarlar", ikon: "⚙️" }, { id: "gizli", ad: "çok gizli", ikon: "📁", gizli: true },
  ];
  const CANLI = new Set(["mesajlar", "terminal", "sutlac", "claudekodu"]);   // veri yenilenince yeniden çizilmez (yazılan metin / oyun durumu kaybolmasın)
  const UNVAN = ["Stajyer", "Muhabir", "Kıdemli muhabir", "Editör", "Yazı işleri müdürü", "Genel yayın yönetmeni", "Efsane"];
  const DURUM_AD = { active: "sürüyor", doing: "sürüyor", inbox: "gelen", todo: "yapılacak", waiting: "bekliyor", blocked: "takıldı", aktif: "aktif", taslak: "taslak" };

  let acik = false, veri = null, uygulama = null, acilisGosterildi = false, ayar = { dogrudan: false }, saatZ = 0;
  let cihaz = "pc", telTus = "KeyP", konumZ = 0;   // cihaz: "pc" (masadaki bilgisayar) ya da "telefon"; telTus: Ayarlar > Telefon tuşu (e.code)
  const YURU = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "KeyZ"]);   // telefon açıkken oyuna geçen tuşlar
  const mesajlar = {};   // ajan id -> { oturum, liste: [{kim, metin, kayitlar}], okunmadi }
  let aktifKisi = "ada", sure = null;
  const DEPO_GORUNUM = "ofis-bilgisayar-gorunum-1";
  const gorunum = { tema: "oto", yazi: "modern", duvar: "gok" };
  try { const g = JSON.parse(localStorage.getItem(DEPO_GORUNUM) || "{}"); for (const k of Object.keys(gorunum)) if (typeof g[k] === "string") gorunum[k] = g[k]; } catch (e) { /* yok */ }
  const gorunumKaydet = () => { try { localStorage.setItem(DEPO_GORUNUM, JSON.stringify(gorunum)); } catch (e) { /* kayıt yok */ } };
  const pencereler = new Map();   // uygulama id -> { el, ic, kucuk, buyuk }; uygulama = öndeki pencere
  const bildirimler = [];         // son 20 bildirim (zil menüsü)
  let zSira = 10, bildirimSay = 0, ilkBildirim = false;
  try { const h = JSON.parse(localStorage.getItem(DEPO_MESAJ) || "{}"); for (const [k, v] of Object.entries(h)) if (AJANLAR[k] && v && Array.isArray(v.liste)) mesajlar[k] = { oturum: "", liste: v.liste.slice(-30), okunmadi: 0 }; } catch (e) { /* yok */ }
  const mesajKaydet = () => { try { localStorage.setItem(DEPO_MESAJ, JSON.stringify(Object.fromEntries(Object.entries(mesajlar).map(([k, v]) => [k, { liste: v.liste.slice(-30) }])))); } catch (e) { /* kayıt yok */ } };

  // ---------- küçük yardımcılar ----------
  const yap = (etiket, sinif, metin) => { const d = document.createElement(etiket); if (sinif) d.className = sinif; if (metin != null) d.textContent = metin; return d; };
  const dugme = (metin, fn, sinif) => { const b = yap("button", sinif || "", metin); b.type = "button"; b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; };
  const api = (yol, govde) => fetch(yol, { method: govde ? "POST" : "GET", headers: { "X-Ofis-Anahtar": ANAHTAR, ...(govde ? { "Content-Type": "application/json" } : {}) }, body: govde ? JSON.stringify(govde) : undefined });
  const ek = (ad, tur) => (window.OFIS_KISI && OFIS_KISI.ek ? OFIS_KISI.ek(ad, tur) : ad + (tur === "a" ? "'a" : tur === "la" ? " ile" : "'ın"));
  const tarihYaz = (t) => { if (!t) return ""; const d = new Date(t + (t.length === 10 ? "T00:00:00" : "")); return isNaN(d) ? t : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }); };
  const gunFarki = (t) => Math.round((new Date(t + "T00:00:00") - new Date(new Date().toDateString())) / 86400000);
  function bicimle(metin) {   // önce kaçış, sonra **kalın**, `kod`, "- " maddeleri (sohbet.js ile aynı)
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
  // Portre: Modern UI konuşma portresi (varliklar/ui/portre-<id>.png, 32x32 ilk kare); yoksa karakter sayfasının önden karesi
  const PORTRE = {};
  function portreGorsel(id) {
    if (!PORTRE[id]) { const im = new Image(); im.onload = () => document.querySelectorAll(`#bos canvas[data-portre="${id}"]`).forEach((c) => portreBoya(c, id)); im.src = `varliklar/ui/portre-${id}.png`; PORTRE[id] = im; }
    return PORTRE[id];
  }
  function portreBoya(c, id) {
    const p = c.getContext("2d"), im = portreGorsel(id); p.imageSmoothingEnabled = false; p.clearRect(0, 0, 32, 32);
    if (im.complete && im.naturalWidth) return p.drawImage(im, 0, 0, 32, 32, 0, 0, 32, 32);
    const ic = I(), k = ic && ic.img && ic.img.k && ic.img.k[id];
    if (k) try { p.drawImage(k, 18 * 16, 32 + 8, 16, 22, 5, 2, 22, 30); } catch (e) { /* görsel yok */ }
  }
  function portre(id, boy = 32) {
    const c = yap("canvas", "bos-pp"); c.width = c.height = 32; c.style.width = c.style.height = boy + "px"; c.dataset.portre = id;
    portreBoya(c, id); return c;
  }

  // ---------- ses (açılış, kapanış, bildirim): ses.js ana bus'ı ----------
  function ton(notalar, tur = "square", sure = 0.09, seviye = 0.05) {
    const b = window.SES && SES.baglanti && SES.baglanti(); if (!b) return;
    const { ctx, cikis } = b, t0 = ctx.currentTime + 0.02;
    notalar.forEach((f, i) => {
      if (!f) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + i * sure;
      o.type = tur; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(seviye, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + sure * 1.8);
      o.connect(g); g.connect(cikis); o.start(t); o.stop(t + sure * 2);
    });
  }
  const sesAcilis = () => { ton([523, 659, 784, 1047, 0, 1319], "triangle", 0.11, 0.06); ton([131, 0, 196], "square", 0.22, 0.025); };
  const sesKapanis = () => ton([784, 523, 392, 262], "triangle", 0.07, 0.05);
  const sesBildirim = () => ton([880, 1175], "square", 0.08, 0.035);
  const sesTik = () => ton([1400], "square", 0.02, 0.02);

  // ---------- görünüm ----------
  const CSS = `
  #bos { position:absolute; inset:0; z-index:30; display:flex; align-items:center; justify-content:center; padding:4vh 6vw 8vh; box-sizing:border-box; background:rgba(6,7,10,.62); container-type:size; }   /* karartma tüm ofisi kaplar (yarıda kalmaz); monitör ortada açılır, ofis arkada soluk görünür */
  #bos[hidden], #bos [hidden] { display:none !important; }
  /* tema değişkenleri: koyu (varsayılan) / açık; "otomatik" ofisin saatine göre seçer (gorunumUygula) */
  #bos { --os-yazi:#eceef5; --os-soluk:#9aa0b4; --os-p:#cfd1da; --os-vy:var(--vurgu); --os-kenar:#3a3f53; --os-kart:rgba(18,20,30,.7); --os-oge:rgba(31,35,51,.92); --os-oge-kenar:#343a50;
    --os-pencere:rgba(22,25,37,.88); --os-pb:rgba(43,48,69,.55); --os-giris:#0f1119; --os-dugme:#262b3d; --os-dugme-kenar:#444a5e; --os-cip:#2b3044; --os-cubuk:rgba(16,18,28,.62);
    --os-balon:#252a3d; --os-balon-kenar:#3a4058; --os-ben:#3a3420; --os-ben-kenar:#6b5a26; --os-secim:rgba(242,193,78,.16); --os-zemin:#151826; --os-golge:0 18px 44px rgba(0,0,0,.55);
    --os-govde:"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif; --os-baslik:"Pixelify Sans", "Segoe UI", system-ui, sans-serif; }
  #bos[data-tema="acik"] { --os-yazi:#1c2130; --os-soluk:#5d6477; --os-p:#2e3445; --os-vy:color-mix(in srgb, var(--vurgu) 52%, #241a00); --os-kenar:#cdd3df; --os-kart:rgba(255,255,255,.72);
    --os-oge:rgba(255,255,255,.96); --os-oge-kenar:#dde2ea; --os-pencere:rgba(248,249,252,.9); --os-pb:rgba(232,236,244,.75); --os-giris:#ffffff; --os-dugme:#eef1f6; --os-dugme-kenar:#cdd3df;
    --os-cip:#e7ebf2; --os-cubuk:rgba(246,248,252,.68); --os-balon:#eef1f7; --os-balon-kenar:#d6dbe5; --os-ben:color-mix(in srgb, var(--vurgu) 24%, #fff); --os-ben-kenar:color-mix(in srgb, var(--vurgu) 60%, #fff);
    --os-secim:color-mix(in srgb, var(--vurgu) 22%, transparent); --os-zemin:#dfe5ef; --os-golge:0 16px 40px rgba(30,40,70,.28); }
  #bos[data-yazi="piksel"] { --os-govde:"Pixelify Sans", system-ui, sans-serif; }
  #bos .bos-ekran { position:relative; box-sizing:border-box; aspect-ratio:16 / 10; width:min(1040px, calc(100cqw - 24px), calc((100cqh - 24px) * 1.6)); height:auto;   /* gerçek monitör oranı: pencere kısa ya da dar olsa da 16:10 kalır */
    display:flex; flex-direction:column; background:#2a2d38; border:4px solid #12141a;
    border-radius:14px; box-shadow:0 0 0 2px #3c4152 inset, 0 18px 50px rgba(0,0,0,.6); padding:12px 12px 8px; transform-origin:var(--bx,50%) var(--by,50%); }
  #bos.giris .bos-ekran { animation:bosGir .48s cubic-bezier(.2,.9,.25,1) both; } #bos.cikis .bos-ekran { animation:bosCik .32s ease-in both; }
  @keyframes bosGir { from { transform:scale(.03); opacity:.2; } to { transform:scale(1); opacity:1; } }
  @keyframes bosCik { 0% { transform:scale(1); } 55% { transform:scaleY(.008) scaleX(1); filter:brightness(2.2); } 100% { transform:scaleY(.008) scaleX(0); opacity:0; } }
  #bos .bos-cam { container:boscam / inline-size; position:relative; flex:1; min-height:0; overflow:hidden; border-radius:8px; background:#0b0d14; border:2px solid #0a0b0f; color:var(--os-yazi);
    font-family:var(--os-govde); }
  #bos .bos-tarama { position:absolute; inset:0; pointer-events:none; background:repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px);
    box-shadow:inset 0 0 70px rgba(0,0,0,.55); z-index:1000; }
  #bos:not([data-yazi="piksel"]) .bos-tarama { background:none; box-shadow:inset 0 0 40px rgba(0,0,0,.28); }
  #bos .bos-alt { display:flex; align-items:center; gap:8px; padding:6px 4px 0; color:#7f8496; font:12px "Pixelify Sans", system-ui; letter-spacing:.08em; }
  #bos .bos-alt .led { width:7px; height:7px; border-radius:50%; background:#5be08a; box-shadow:0 0 6px #5be08a; } #bos .bos-alt .bosluk { flex:1; }
  #bos .bos-acilis { position:absolute; inset:0; padding:22px 26px; font:14px/1.55 Consolas, "Cascadia Mono", monospace; color:#9be7a8; background:#05070a; z-index:1100; white-space:pre-wrap; }
  #bos .bos-acilis .logo { color:var(--vurgu); font:700 30px "Pixelify Sans", system-ui; letter-spacing:.04em; margin-bottom:10px; }
  #bos .bos-acilis .imlec { display:inline-block; width:9px; height:15px; background:#9be7a8; vertical-align:-2px; animation:bosYanip .8s steps(1) infinite; }
  @keyframes bosYanip { 50% { opacity:0; } }
  /* masaüstü + duvar kâğıdı: düz ya da saate göre gök (gece / şafak / gün / akşam) ve piksel tepeler */
  #bos .bos-masa { position:absolute; inset:0; display:grid; grid-template-columns:1fr 270px; gap:12px; padding:14px 14px 70px;
    background:radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--vurgu) 13%, transparent), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(108,194,138,.12), transparent 55%),
      repeating-linear-gradient(90deg, rgba(128,128,128,.05) 0 1px, transparent 1px 16px), repeating-linear-gradient(0deg, rgba(128,128,128,.05) 0 1px, transparent 1px 16px), var(--os-zemin); }
  #bos[data-duvar="gok"] .bos-masa::before, #bos[data-duvar="gok"] .bos-masa::after { content:""; position:absolute; left:0; right:0; bottom:0; pointer-events:none; }
  #bos[data-duvar="gok"] .bos-masa::before { height:30%; background:var(--os-tepe1);
    clip-path:polygon(0 60%, 8% 60%, 8% 45%, 18% 45%, 18% 30%, 30% 30%, 30% 50%, 42% 50%, 42% 35%, 55% 35%, 55% 20%, 66% 20%, 66% 40%, 78% 40%, 78% 28%, 90% 28%, 90% 48%, 100% 48%, 100% 100%, 0 100%); }
  #bos[data-duvar="gok"] .bos-masa::after { height:19%; background:var(--os-tepe2);
    clip-path:polygon(0 55%, 12% 55%, 12% 40%, 26% 40%, 26% 62%, 40% 62%, 40% 48%, 58% 48%, 58% 66%, 72% 66%, 72% 50%, 86% 50%, 86% 38%, 100% 38%, 100% 100%, 0 100%); }
  #bos[data-duvar="gok"][data-gok="gun"] { --os-tepe1:#8cc58a; --os-tepe2:#5fa86a; }
  #bos[data-duvar="gok"][data-gok="gun"] .bos-masa { background:radial-gradient(circle at 80% 18%, #fff7cf 0 22px, rgba(255,247,207,.3) 23px 36px, transparent 37px), linear-gradient(180deg, #4f9fe0 0%, #9fd0f3 58%, #e3f2fb 100%); }
  #bos[data-duvar="gok"][data-gok="safak"] { --os-tepe1:#6a5a86; --os-tepe2:#463d66; }
  #bos[data-duvar="gok"][data-gok="safak"] .bos-masa { background:radial-gradient(circle at 24% 74%, #ffe2a8 0 20px, rgba(255,214,150,.35) 21px 46px, transparent 47px), linear-gradient(180deg, #29386a 0%, #9c6b9a 52%, #f3b37c 100%); }
  #bos[data-duvar="gok"][data-gok="aksam"] { --os-tepe1:#5b3d63; --os-tepe2:#3b2848; }
  #bos[data-duvar="gok"][data-gok="aksam"] .bos-masa { background:radial-gradient(circle at 74% 72%, #ffc98a 0 20px, rgba(255,170,100,.35) 21px 48px, transparent 49px), linear-gradient(180deg, #2f2552 0%, #b85f7d 50%, #f39a5b 100%); }
  #bos[data-duvar="gok"][data-gok="gece"] { --os-tepe1:#1d2546; --os-tepe2:#121833; }
  #bos[data-duvar="gok"][data-gok="gece"] .bos-masa { background:radial-gradient(circle at 80% 18%, #e9ecf7 0 13px, rgba(233,236,247,.12) 14px 30px, transparent 31px),
      radial-gradient(1.6px 1.6px at 12% 14%, #fff 50%, transparent 52%), radial-gradient(1.6px 1.6px at 27% 32%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 41% 9%, #fff 50%, transparent 52%),
      radial-gradient(1.6px 1.6px at 55% 26%, #dfe6ff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 63% 44%, #fff 50%, transparent 52%), radial-gradient(1.6px 1.6px at 92% 36%, #fff 50%, transparent 52%),
      radial-gradient(1.2px 1.2px at 7% 48%, #fff 50%, transparent 52%), radial-gradient(1.2px 1.2px at 35% 55%, #cfd8ff 50%, transparent 52%), radial-gradient(1.6px 1.6px at 70% 12%, #fff 50%, transparent 52%),
      linear-gradient(180deg, #0a0f24 0%, #1a2346 62%, #2c2f5c 100%); }
  #bos .bos-simgeler, #bos .bos-yan { position:relative; z-index:1; }
  #bos .bos-simgeler { display:grid; grid-template-columns:repeat(auto-fill, 88px); grid-auto-rows:88px; gap:6px; align-content:start; }
  #bos .bos-simge { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; border:1px solid transparent; border-radius:12px;
    background:none; color:var(--os-yazi); font:12.5px var(--os-govde); cursor:pointer; padding:4px; }
  #bos[data-duvar="gok"] .bos-simge { color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.75); }
  #bos .bos-simge .i { width:46px; height:46px; display:grid; place-items:center; font-size:26px; line-height:1; border-radius:13px; background:rgba(255,255,255,.18);
    box-shadow:0 1px 0 rgba(255,255,255,.25) inset, 0 4px 12px rgba(0,0,0,.22); backdrop-filter:blur(6px); text-shadow:none; }
  #bos .bos-simge:hover, #bos .bos-simge:focus-visible { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.3); outline:none; }
  #bos .rozet-say { position:absolute; top:2px; right:12px; min-width:18px; padding:0 5px; border-radius:9px; background:var(--kotu); color:#fff; font:11px/18px system-ui; text-align:center; text-shadow:none; }
  #bos .rozet-say.sari { background:var(--vurgu); color:#1b1d25; }
  #bos .bos-yan { display:flex; flex-direction:column; gap:10px; min-height:0; overflow:auto; }
  #bos .kart { background:var(--os-kart); backdrop-filter:blur(14px) saturate(1.2); border:1px solid color-mix(in srgb, var(--os-kenar) 70%, transparent); border-radius:14px; padding:10px 12px;
    box-shadow:0 4px 16px rgba(0,0,0,.18); color:var(--os-yazi); }
  #bos .kart h4 { margin:0 0 6px; font:600 12.5px var(--os-baslik); color:var(--os-vy); letter-spacing:.05em; }
  #bos .w-saat .s { font:700 38px/1 var(--os-baslik); letter-spacing:.02em; } #bos .w-saat .t { color:var(--os-soluk); font-size:12.5px; margin-top:4px; }
  #bos .w-bos { color:var(--os-soluk); font-size:12.5px; }
  #bos .w-odak { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:13px; }
  #bos .profil { display:flex; gap:10px; align-items:center; } #bos .profil .ad { font:600 15px var(--os-baslik); } #bos .profil .unvan { color:var(--os-soluk); font-size:12px; }
  #bos .xp { height:8px; background:color-mix(in srgb, var(--os-kenar) 60%, transparent); border-radius:6px; overflow:hidden; margin-top:8px; }
  #bos .xp i { display:block; height:100%; background:linear-gradient(90deg, var(--vurgu), #ffe08a); width:0; transition:width .6s; }
  #bos .xpyazi { display:flex; justify-content:space-between; color:var(--os-soluk); font-size:11px; margin-top:3px; }
  #bos .gorev-sat { display:flex; gap:7px; align-items:flex-start; font-size:12.5px; padding:5px 0; border-top:1px solid color-mix(in srgb, var(--os-kenar) 60%, transparent); cursor:pointer; }
  #bos .gorev-sat:hover { color:var(--os-vy); }
  #bos .gorev-sat:first-of-type { border-top:0; } #bos .gorev-sat .p { margin-left:auto; color:var(--os-vy); white-space:nowrap; font-size:11px; }
  #bos .rozetler { display:flex; flex-wrap:wrap; gap:5px; } #bos .rozet { font-size:11.5px; padding:2px 8px; border-radius:10px; background:var(--os-cip); border:1px solid var(--os-kenar); }
  #bos .rozet.kilit { opacity:.38; filter:grayscale(1); }
  /* dock: alt ortada yüzen cam çubuk */
  #bos .bos-cubuk { position:absolute; left:50%; bottom:8px; transform:translateX(-50%); max-width:calc(100% - 16px); box-sizing:border-box; height:50px; display:flex; align-items:center; gap:3px; padding:0 8px;
    background:var(--os-cubuk); backdrop-filter:blur(18px) saturate(1.4); border:1px solid color-mix(in srgb, var(--os-kenar) 80%, transparent); border-radius:16px; box-shadow:var(--os-golge);
    z-index:800; overflow-x:auto; overflow-y:hidden; scrollbar-width:none; }
  #bos .bos-cubuk .dk { position:relative; flex:none; width:38px; height:38px; display:grid; place-items:center; border:0; border-radius:10px; background:none; color:var(--os-yazi); font-size:21px;
    cursor:pointer; transition:transform .12s, background .12s; padding:0; }
  #bos .bos-cubuk .dk:hover { background:var(--os-secim); transform:translateY(-3px); }
  #bos .bos-cubuk .dk.acik::after { content:""; position:absolute; bottom:1px; left:50%; width:5px; height:3px; margin-left:-2.5px; border-radius:2px; background:var(--os-soluk); }
  #bos .bos-cubuk .dk.odak::after { width:14px; margin-left:-7px; background:var(--vurgu); }
  #bos .bos-cubuk .rozet-say { top:-1px; right:-2px; }
  #bos .bos-cubuk .ayrac { flex:none; width:1px; height:26px; background:var(--os-kenar); margin:0 5px; }
  #bos .bos-cubuk .ara-hap { flex:none; height:32px; display:flex; align-items:center; gap:7px; padding:0 10px; border-radius:10px; border:1px solid var(--os-dugme-kenar); background:var(--os-giris);
    color:var(--os-soluk); font:13px var(--os-govde); cursor:text; min-width:150px; }
  #bos .bos-cubuk .ara-hap kbd { margin-left:auto; font:10.5px var(--os-govde); padding:1px 5px; border:1px solid var(--os-kenar); border-radius:4px; }
  #bos .bos-cubuk .tepsi { position:relative; flex:none; height:36px; border:0; border-radius:9px; background:none; color:var(--os-yazi); cursor:pointer; padding:0 8px; font:14px var(--os-govde); }
  #bos .bos-cubuk .tepsi:hover { background:var(--os-secim); } #bos .bos-cubuk .kapat:hover { background:color-mix(in srgb, var(--kotu) 35%, transparent); }
  #bos .bos-cubuk .saat { display:flex; flex-direction:column; align-items:flex-end; justify-content:center; line-height:1.15; font-size:12.5px; cursor:default; }
  #bos .bos-cubuk .saat small { color:var(--os-soluk); font-size:11px; }
  /* pencereler: birden çok, sürüklenir; .max büyütülmüş, .kucuk dock'ta */
  #bos .bos-pencere { position:absolute; display:flex; flex-direction:column; min-width:280px; min-height:180px; background:var(--os-pencere); backdrop-filter:blur(22px) saturate(1.2); color:var(--os-yazi);
    border:1px solid color-mix(in srgb, var(--os-kenar) 85%, transparent); border-radius:12px; box-shadow:var(--os-golge); overflow:hidden; animation:bosPen .18s ease-out both; }
  #bos .bos-pencere.max { left:8px !important; top:8px !important; width:auto !important; height:auto !important; right:8px; bottom:66px; }
  #bos .bos-pencere.kucuk { display:none; } #bos .bos-pencere:not(.odak) .bos-pb { opacity:.72; }
  @keyframes bosPen { from { transform:translateY(10px) scale(.97); opacity:0; } }
  #bos .bos-pb { display:flex; align-items:center; gap:8px; height:36px; flex:none; padding:0 4px 0 12px; background:var(--os-pb); border-bottom:1px solid var(--os-kenar); cursor:grab; user-select:none; touch-action:none; }
  #bos .bos-pb:active { cursor:grabbing; } #bos .bos-pb .pi { font-size:16px; } #bos .bos-pb b { font:600 14px var(--os-baslik); } #bos .bos-pb .bosluk { flex:1; }
  #bos .bos-pb button { width:34px; height:28px; border:0; border-radius:7px; background:none; color:var(--os-yazi); cursor:pointer; font:15px var(--os-govde); padding:0; }
  #bos .bos-pb button:hover { background:var(--os-secim); } #bos .bos-pb button.kapat:hover { background:#e0534a; color:#fff; }
  #bos .bos-ic { flex:1; min-height:0; overflow:auto; padding:12px 14px; font-size:13.5px; }
  #bos .arac { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:10px; }
  #bos .arac button, #bos .k-dugme, #bos .seg button { background:var(--os-dugme); color:var(--os-yazi); border:1px solid var(--os-dugme-kenar); border-radius:8px; padding:4px 10px; font:12.5px var(--os-govde); cursor:pointer; }
  #bos .arac button:hover, #bos .k-dugme:hover, #bos .seg button:hover { border-color:var(--vurgu); }
  #bos .arac button.secili, #bos .seg button.secili { background:var(--os-secim); border-color:var(--vurgu); font-weight:600; }
  #bos .k-dugme.genis { width:100%; margin-top:8px; }
  #bos .arac input[type=search] { flex:1; min-width:140px; background:var(--os-giris); color:var(--os-yazi); border:1px solid var(--os-dugme-kenar); border-radius:8px; padding:5px 9px; font:13px var(--os-govde); }
  #bos .liste { display:grid; gap:8px; } #bos .ikili { grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); }
  #bos .oge { background:var(--os-oge); border:1px solid var(--os-oge-kenar); border-radius:10px; padding:9px 11px; }
  #bos .oge .bas { display:flex; gap:8px; align-items:baseline; } #bos .oge .bas b { font-weight:600; flex:1; }
  #bos .oge .meta { color:var(--os-soluk); font-size:12px; margin-top:3px; display:flex; flex-wrap:wrap; gap:4px 10px; }
  #bos .oge p { margin:5px 0 0; color:var(--os-p); line-height:1.45; } #bos .oge .alt { display:flex; gap:6px; margin-top:7px; flex-wrap:wrap; }
  #bos .cip { font-size:11px; padding:1px 7px; border-radius:9px; background:var(--os-cip); color:var(--os-p); white-space:nowrap; }
  #bos .cip.iyi { background:rgba(108,194,138,.2); color:var(--iyi); } #bos .cip.kotu { background:rgba(227,107,93,.2); color:var(--kotu); } #bos .cip.sari { background:var(--os-secim); color:var(--os-vy); }
  #bos .gun-bas { margin:12px 0 6px; color:var(--os-vy); font:600 12.5px var(--os-baslik); letter-spacing:.05em; } #bos .gun-bas:first-child { margin-top:0; }
  #bos .bos-bos { color:var(--os-soluk); padding:24px 8px; text-align:center; line-height:1.5; }
  #bos .bos-bos code, #bos .oge code { background:var(--os-giris); padding:1px 5px; border-radius:4px; font-size:12px; }
  #bos .ayar-sat { display:flex; align-items:center; gap:10px; margin-top:8px; flex-wrap:wrap; } #bos .ayar-sat > span { width:96px; color:var(--os-soluk); font-size:12.5px; }
  #bos .seg { display:flex; gap:4px; flex-wrap:wrap; }
  #bos .mesaj-duzen { display:grid; grid-template-columns:200px 1fr; gap:10px; height:100%; min-height:0; }
  #bos .kisiler { overflow:auto; display:flex; flex-direction:column; gap:3px; border-right:1px solid var(--os-kenar); padding-right:8px; }
  #bos .kisi { display:flex; gap:8px; align-items:center; padding:5px 6px; border-radius:8px; cursor:pointer; background:none; border:1px solid transparent; color:var(--os-yazi); text-align:left; font:inherit; }
  #bos .kisi:hover { background:var(--os-secim); } #bos .kisi.secili { background:var(--os-secim); border-color:color-mix(in srgb, var(--vurgu) 60%, transparent); }
  #bos .kisi .k-ad { font-size:13px; } #bos .kisi .k-rol { font-size:11px; color:var(--os-soluk); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px; }
  #bos .kisi .nokta { margin-left:auto; width:8px; height:8px; border-radius:50%; background:var(--vurgu); }
  #bos .bos-pp { image-rendering:pixelated; background:#2b2f40; border-radius:8px; flex:none; }
  #bos .sohbet { display:flex; flex-direction:column; min-height:0; height:100%; }
  #bos .akış { flex:1; overflow:auto; display:flex; flex-direction:column; gap:8px; padding:4px 2px 8px; }
  #bos .msj { display:flex; gap:7px; align-items:flex-end; max-width:86%; } #bos .msj.ben { align-self:flex-end; flex-direction:row-reverse; }
  #bos .msj .balon { background:var(--os-balon); border:1px solid var(--os-balon-kenar); border-radius:12px 12px 12px 3px; padding:7px 10px; line-height:1.45; }
  #bos .msj.ben .balon { background:var(--os-ben); border-color:var(--os-ben-kenar); border-radius:12px 12px 3px 12px; }
  #bos .msj .balon p { margin:0 0 4px; } #bos .msj .balon p:last-child { margin:0; } #bos .msj .balon ul { margin:2px 0 2px 16px; padding:0; }
  #bos .kayit { align-self:flex-start; margin-left:30px; font-size:12px; padding:5px 9px; border-radius:8px; background:rgba(108,194,138,.14); border:1px solid rgba(108,194,138,.45); color:var(--os-yazi); }
  #bos .kayit.uyari { background:rgba(227,107,93,.12); border-color:rgba(227,107,93,.45); }
  #bos .kayit .od { display:flex; gap:6px; margin-top:5px; } #bos .kayit pre { white-space:pre-wrap; margin:4px 0 0; font:12px/1.35 var(--os-govde); color:var(--os-p); max-height:120px; overflow:auto; }
  #bos .durum-satir { color:var(--os-soluk); font-size:12px; min-height:16px; padding:2px 2px 4px; }
  #bos .hizli { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:6px; } #bos .hizli button { font-size:12px; padding:3px 8px; }
  #bos .yaz { display:flex; gap:6px; } #bos .yaz textarea { flex:1; resize:none; height:52px; background:var(--os-giris); color:var(--os-yazi); border:1px solid var(--os-dugme-kenar); border-radius:10px; padding:7px 9px; font:13.5px/1.35 var(--os-govde); }
  #bos .yaz textarea:focus { outline:none; border-color:var(--vurgu); } #bos .yaz button { background:var(--vurgu); color:#1b1d25; border:0; border-radius:10px; padding:0 14px; font:600 13px var(--os-govde); cursor:pointer; }
  #bos .yaz button:disabled { opacity:.5; cursor:default; }
  #bos .xp-ucan { position:absolute; z-index:1050; color:var(--vurgu); font:700 18px "Pixelify Sans", system-ui; text-shadow:0 2px 0 #000; pointer-events:none; animation:bosUc 1.4s ease-out forwards; }
  @keyframes bosUc { from { transform:translateY(0); opacity:1; } to { transform:translateY(-46px); opacity:0; } }
  #bos .anahtar { display:flex; gap:10px; align-items:flex-start; padding:10px 0; border-bottom:1px solid var(--os-kenar); } #bos .anahtar input { margin-top:3px; transform:scale(1.2); }
  #bos .anahtar small { display:block; color:var(--os-soluk); margin-top:3px; line-height:1.4; }
  #bos .odak-buyuk { display:flex; flex-direction:column; align-items:center; gap:12px; padding:34px 10px; text-align:center; }
  #bos .odak-buyuk .saat { font:700 54px var(--os-baslik); color:var(--os-vy); }
  #bos .odak-buyuk button { background:var(--vurgu); color:#1b1d25; border:0; border-radius:10px; padding:9px 18px; font:600 15px var(--os-govde); cursor:pointer; }
  /* arama (Ctrl+Space) */
  #bos .bos-ara { position:absolute; inset:0; z-index:900; display:flex; justify-content:center; align-items:flex-start; padding-top:8%; background:rgba(0,0,0,.2); }
  #bos .ara-kutu { width:min(560px, calc(100% - 24px)); background:var(--os-pencere); backdrop-filter:blur(26px) saturate(1.3); border:1px solid var(--os-kenar); border-radius:16px; box-shadow:var(--os-golge);
    overflow:hidden; animation:bosPen .14s ease-out both; }
  #bos .ara-kutu input { width:100%; box-sizing:border-box; border:0; border-bottom:1px solid var(--os-kenar); background:none; color:var(--os-yazi); font:17px var(--os-govde); padding:14px 16px; outline:none; }
  #bos .ara-liste { max-height:min(380px, 52vh); overflow:auto; padding:6px; }
  #bos .ara-grup { padding:8px 10px 3px; color:var(--os-soluk); font:600 11px var(--os-govde); letter-spacing:.06em; text-transform:uppercase; }
  #bos .ara-oge { display:flex; gap:10px; align-items:center; width:100%; border:0; background:none; color:var(--os-yazi); text-align:left; padding:7px 10px; border-radius:9px; cursor:pointer; font:13.5px var(--os-govde); }
  #bos .ara-oge.secili { background:var(--os-secim); } #bos .ara-oge .ai { width:22px; text-align:center; font-size:16px; flex:none; }
  #bos .ara-oge > span:nth-child(2) { min-width:0; flex:1; } #bos .ara-oge .am { display:block; color:var(--os-soluk); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #bos .ara-ipucu { padding:7px 14px; color:var(--os-soluk); font-size:11.5px; border-top:1px solid var(--os-kenar); }
  /* bildirimler: sağ üstten kayan baloncuk + zil menüsü */
  #bos .bos-bildirimler { position:absolute; top:10px; right:10px; z-index:950; display:flex; flex-direction:column; gap:8px; width:min(300px, calc(100% - 20px)); pointer-events:none; }
  #bos .bos-toast { pointer-events:auto; display:flex; gap:10px; align-items:flex-start; padding:10px 12px; background:var(--os-pencere); backdrop-filter:blur(20px); border:1px solid var(--os-kenar);
    border-radius:12px; box-shadow:var(--os-golge); cursor:pointer; color:var(--os-yazi); animation:bosToast .32s cubic-bezier(.2,.9,.25,1) both; }
  #bos .bos-toast.sabit { animation:none; box-shadow:none; background:var(--os-oge); margin-top:6px; } #bos .bos-toast.gidiyor { animation:bosToastGit .25s ease-in forwards; }
  @keyframes bosToast { from { transform:translateX(110%); opacity:0; } } @keyframes bosToastGit { to { transform:translateX(110%); opacity:0; } }
  #bos .bos-toast .ti { font-size:20px; line-height:1.1; } #bos .bos-toast > div { flex:1; min-width:0; } #bos .bos-toast b { display:block; font-size:13px; }
  #bos .bos-toast span:not(.ti) { display:block; color:var(--os-soluk); font-size:12.5px; line-height:1.35; overflow-wrap:anywhere; } #bos .bos-toast .zaman { color:var(--os-soluk); font-size:11px; }
  #bos .bos-merkez { position:absolute; right:10px; bottom:66px; z-index:850; width:min(320px, calc(100% - 20px)); max-height:62%; overflow:auto; box-sizing:border-box; padding:10px; background:var(--os-pencere);
    backdrop-filter:blur(22px); border:1px solid var(--os-kenar); border-radius:14px; box-shadow:var(--os-golge); color:var(--os-yazi); animation:bosPen .14s ease-out both; }
  #bos .bos-merkez .m-bas { display:flex; align-items:center; gap:8px; } #bos .bos-merkez .m-bas b { font:600 14px var(--os-baslik); } #bos .bos-merkez .m-bas .bosluk { flex:1; }
  #bos .bos-simge.gizli-simge { opacity:.28; transform:scale(.86); } #bos .bos-simge.gizli-simge:hover, #bos .bos-simge.gizli-simge:focus-visible { opacity:1; }
  /* Terminal: tema ne olursa olsun koyu, eş aralıklı */
  #bos .term { height:100%; display:flex; flex-direction:column; background:#0c0e14; color:#d7dae3; font:13px/1.5 "Cascadia Mono", Consolas, monospace; }
  #bos .term-ust { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:6px 10px; background:#151823; border-bottom:1px solid #262a38; font:12px var(--os-govde); color:#9aa0b4; }
  #bos .term-ust .bosluk { flex:1; } #bos .term-ust select, #bos .term-ust button { background:#1d2130; color:#d7dae3; border:1px solid #363b4f; border-radius:6px; font:12px var(--os-govde); padding:2px 8px; cursor:pointer; }
  #bos .term-kip { padding:1px 8px; border-radius:9px; background:#262b3d; } #bos .term-kip.tam { background:rgba(227,107,93,.22); color:#f2c0b8; } #bos .term-kip.okur { background:rgba(108,194,138,.18); color:#a8e3bb; }
  #bos .term-akis { flex:1; min-height:0; overflow:auto; padding:10px 12px; white-space:pre-wrap; overflow-wrap:anywhere; }
  #bos .term-akis .girdi { color:#fff; } #bos .term-akis .girdi .ps { color:#7ee787; } #bos .term-akis .arac { color:#7d8496; } #bos .term-akis .bilgi { color:#7d8496; font-style:italic; }
  #bos .term-akis .hata { color:#ff7b72; } #bos .term-akis .metin p { margin:0 0 6px; } #bos .term-akis .metin ul { margin:0 0 6px 18px; padding:0; } #bos .term-akis .metin code { color:#ffa657; }
  #bos .term-kart { margin:6px 0; padding:8px 10px; border:1px solid #6b5a26; border-radius:8px; background:#1d1a10; white-space:normal; } #bos .term-kart.kritik { border-color:#e0534a; background:#251313; }
  #bos .term-kart pre { margin:5px 0; white-space:pre-wrap; color:#ffa657; font:12px/1.4 "Cascadia Mono", Consolas, monospace; } #bos .term-kart .od { display:flex; gap:6px; }
  #bos .term-kart button { background:#262b3d; color:#d7dae3; border:1px solid #444a5e; border-radius:6px; padding:3px 10px; font:12px var(--os-govde); cursor:pointer; } #bos .term-kart button.evet { background:#e0534a; border-color:#e0534a; color:#fff; }
  #bos .term-gir { display:flex; align-items:center; gap:8px; padding:8px 12px; border-top:1px solid #262a38; } #bos .term-gir .ps { color:#7ee787; white-space:nowrap; }
  #bos .term-gir input { flex:1; min-width:0; background:none; border:0; outline:none; color:#fff; font:inherit; caret-color:#7ee787; }
  #bos .term-gir.mesgul .ps { color:#ffa657; }
  /* Sütlaç Koşusu */
  #bos .oyun { height:100%; display:flex; flex-direction:column; align-items:center; gap:8px; padding:10px; box-sizing:border-box; }
  #bos .oyun-ust { width:100%; max-width:528px; display:flex; gap:12px; align-items:center; font-size:13px; } #bos .oyun-ust .bosluk { flex:1; } #bos .oyun-ust b { font:600 14px var(--os-baslik); }
  #bos .oyun canvas { width:100%; max-width:528px; height:auto; image-rendering:pixelated; border-radius:8px; border:2px solid var(--os-kenar); outline:none; cursor:pointer; flex:none; }
  #bos .oyun canvas:focus { border-color:var(--vurgu); } #bos .oyun-alt { color:var(--os-soluk); font-size:12px; text-align:center; }
  /* Odak istatistiği */
  #bos .odak-durum { font:600 15px var(--os-baslik); color:var(--os-vy); } #bos .odak-sayilar { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  #bos .odak-hafta { display:flex; gap:8px; align-items:flex-end; height:96px; padding:6px 4px 0; } #bos .odak-hafta .gun { display:flex; flex-direction:column; align-items:center; gap:4px; font-size:11px; color:var(--os-soluk); }
  #bos .odak-hafta .cubuk-s { width:22px; border-radius:5px 5px 2px 2px; background:var(--vurgu); min-height:3px; opacity:.85; } #bos .odak-hafta .gun.bugun { color:var(--os-yazi); font-weight:600; }
  /* Çok gizli klasör */
  #bos .gizli-kilit { display:flex; flex-direction:column; align-items:center; gap:10px; padding:30px 10px; text-align:center; } #bos .gizli-kilit .k { font-size:40px; }
  #bos .gizli-kilit input { background:var(--os-giris); color:var(--os-yazi); border:1px solid var(--os-dugme-kenar); border-radius:8px; padding:6px 10px; font:14px var(--os-govde); text-align:center; width:200px; }
  #bos .gizli-kilit .ipucu { color:var(--os-soluk); font-size:12.5px; min-height:18px; }
  #bos .gizli-not { background:#fff6b8; color:#3d3410; border-radius:4px; padding:10px 12px; box-shadow:0 3px 8px rgba(0,0,0,.25); font:13.5px/1.45 var(--os-govde); transform:rotate(var(--r, 0deg)); }
  #bos .gizli-not b { display:block; font-size:12px; color:#7a6a20; margin-bottom:3px; }
  /* ekran koruyucu + klavyedeki Sütlaç */
  #bos .bos-koruyucu { position:absolute; inset:0; z-index:1080; background:radial-gradient(ellipse at 50% 120%, #1a2346, #05070d 70%); cursor:none; overflow:hidden; }
  #bos .bos-koruyucu .yuzen { position:absolute; left:0; top:0; display:flex; flex-direction:column; align-items:center; gap:4px; color:#cfd6f3; font:600 15px "Pixelify Sans", system-ui; text-shadow:0 0 12px rgba(150,170,255,.5); }
  #bos .bos-koruyucu .yuzen .b { font-size:44px; } #bos .bos-koruyucu small { color:#7f88aa; font:12px var(--os-govde); }
  #bos .bos-pati { position:absolute; left:50%; bottom:68px; transform:translateX(-50%); z-index:860; width:min(440px, calc(100% - 24px)); box-sizing:border-box; padding:10px 12px;
    background:var(--os-pencere); backdrop-filter:blur(18px); border:1px solid var(--os-kenar); border-radius:12px; box-shadow:var(--os-golge); display:flex; gap:10px; align-items:center; animation:bosPen .2s ease-out both; }
  #bos .bos-pati .y { flex:1; min-width:0; } #bos .bos-pati .y b { font-size:13px; } #bos .bos-pati .y code { display:block; margin-top:2px; color:var(--os-soluk); font:13px "Cascadia Mono", Consolas, monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; direction:rtl; text-align:left; }
  @container boscam (max-width: 860px) { #bos .bos-cubuk .ara-hap span:nth-child(2), #bos .bos-cubuk .ara-hap kbd { display:none; } #bos .bos-cubuk .ara-hap { min-width:0; } }
  @container boscam (max-width: 620px) {
    #bos .bos-masa { grid-template-columns:1fr; } #bos .bos-yan { display:none; } #bos .bos-simgeler { grid-template-columns:repeat(auto-fill, 78px); }
    #bos .bos-cubuk .saat small { display:none; }
    #bos .mesaj-duzen { grid-template-columns:1fr; grid-template-rows:auto 1fr; } #bos .kisiler { flex-direction:row; overflow-x:auto; border-right:0; border-bottom:1px solid var(--os-kenar); padding:0 0 6px; }
    #bos .kisi .k-rol { display:none; } #bos .kisi .k-ad { white-space:nowrap; }
  }
  /* telefon (GTA tarzı): sağ altta yukarı kayan dikey cihaz; ofis kararmaz, tıklamalar telefonun dışında oyuna geçer */
  #bos .tel-ust, #bos .tel-ev, #bos .bos-pb .geri, #bos .w-konum { display:none; }
  #bos[data-cihaz="telefon"] { background:none; pointer-events:none; padding:0; }
  #bos[data-cihaz="telefon"] .bos-ekran { pointer-events:auto; position:absolute; right:max(16px, 3cqw); bottom:max(12px, 3cqh); aspect-ratio:9 / 19;
    width:min(330px, calc((100cqh - 24px) * 9 / 19), calc(100cqw - 32px)); padding:9px 7px; border-radius:40px; border:3px solid #0a0b0f;
    background:linear-gradient(155deg, #3a3e4d, #1d2029 38%, #121419); box-shadow:0 0 0 2px #3c4152 inset, 0 0 0 1px color-mix(in srgb, var(--vurgu) 40%, transparent), 0 26px 60px rgba(0,0,0,.62);
    transform-origin:50% 100%; }
  #bos[data-cihaz="telefon"] .bos-ekran::before { content:""; position:absolute; right:-6px; top:22%; width:3px; height:13%; border-radius:2px; background:#2b2e3a; }   /* yan tuş */
  #bos[data-cihaz="telefon"].giris .bos-ekran { animation:telGir .34s cubic-bezier(.2,.9,.25,1.08) both; } #bos[data-cihaz="telefon"].cikis .bos-ekran { animation:telCik .24s ease-in both; }
  @keyframes telGir { from { transform:translateY(118%) rotate(5deg); } to { transform:none; } }
  @keyframes telCik { to { transform:translateY(118%) rotate(5deg); } }
  #bos[data-cihaz="telefon"] .bos-cam { border-radius:32px; border:0; }
  #bos[data-cihaz="telefon"] .bos-alt, #bos[data-cihaz="telefon"] .bos-cubuk, #bos[data-cihaz="telefon"] .bos-tarama { display:none; }
  #bos[data-cihaz="telefon"] .tel-ust { display:flex; position:absolute; top:0; left:0; right:0; height:32px; align-items:center; gap:6px; padding:0 20px; z-index:950; pointer-events:none;
    font:600 12px "Pixelify Sans", system-ui; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.55); }
  #bos[data-cihaz="telefon"]:not([data-duvar="gok"]) .tel-ust, #bos[data-cihaz="telefon"].tel-uyg .tel-ust { color:var(--os-yazi); text-shadow:none; }
  #bos[data-cihaz="telefon"].tel-uyg .tel-ust { background:var(--os-pb); }
  #bos .tel-ust .ada { position:absolute; left:50%; top:7px; width:74px; height:20px; margin-left:-37px; border-radius:12px; background:#05060a; box-shadow:0 0 0 1px rgba(255,255,255,.06); }
  #bos .tel-ust .ada::after { content:""; position:absolute; right:9px; top:7px; width:6px; height:6px; border-radius:50%; background:#1b2340; box-shadow:0 0 0 1px #2a3352; }
  #bos .tel-ust .sag { margin-left:auto; display:flex; align-items:center; justify-content:flex-end; gap:5px; min-width:0; max-width:calc(50% - 46px); }   /* çentiğe taşmaz */
  #bos .tel-ust .yer { flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; opacity:.92; }
  #bos .tel-ust .pil { width:20px; height:10px; border:1.5px solid currentColor; border-radius:3px; position:relative; box-sizing:border-box; }
  #bos .tel-ust .pil::before { content:""; position:absolute; left:1px; top:1px; bottom:1px; width:72%; border-radius:1px; background:var(--vurgu); }
  #bos .tel-ust .pil::after { content:""; position:absolute; right:-4px; top:2px; width:2px; height:4px; border-radius:0 1px 1px 0; background:currentColor; }
  #bos[data-cihaz="telefon"] .tel-ev { display:block; position:absolute; left:50%; bottom:0; width:140px; height:22px; margin-left:-70px; z-index:960; border:0; padding:0; background:none; cursor:pointer; }
  #bos .tel-ev::after { content:""; position:absolute; left:20px; right:20px; bottom:7px; height:5px; border-radius:3px; background:rgba(255,255,255,.82); box-shadow:0 0 4px rgba(0,0,0,.35); }
  #bos[data-cihaz="telefon"][data-tema="acik"].tel-uyg .tel-ev::after { background:rgba(20,24,36,.7); }
  #bos[data-cihaz="telefon"] .bos-masa { grid-template-columns:1fr; grid-template-rows:auto 1fr; gap:14px; padding:40px 14px 30px; overflow-y:auto; scrollbar-width:none; }
  #bos[data-cihaz="telefon"] .bos-yan { display:flex; order:-1; overflow:visible; gap:8px; }
  #bos[data-cihaz="telefon"] .bos-yan > :not(.w-saat):not(.w-konum) { display:none; }
  #bos[data-cihaz="telefon"] .w-saat { background:none; border:0; box-shadow:none; backdrop-filter:none; text-align:center; padding:6px 0 0; }
  #bos[data-cihaz="telefon"] .w-saat .s { font-size:52px; } #bos[data-cihaz="telefon"][data-duvar="gok"] .w-saat { color:#fff; text-shadow:0 2px 8px rgba(0,0,0,.4); }
  #bos[data-cihaz="telefon"][data-duvar="gok"] .w-saat .t { color:rgba(255,255,255,.88); }
  #bos[data-cihaz="telefon"] .w-konum { display:flex; align-self:center; align-items:center; gap:6px; padding:5px 12px; border-radius:16px; font-size:12px; }
  #bos .w-konum b { color:var(--os-vy); font-weight:600; }
  #bos[data-cihaz="telefon"] .bos-simgeler { grid-template-columns:repeat(4, 1fr); grid-auto-rows:auto; gap:14px 2px; }
  #bos[data-cihaz="telefon"] .bos-simge { gap:5px; padding:2px 0; font-size:10.5px; text-align:center; line-height:1.15; }
  #bos[data-cihaz="telefon"] .bos-simge .i { width:46px; height:46px; border-radius:14px; font-size:24px; }
  #bos[data-cihaz="telefon"] .rozet-say { right:6px; }
  #bos[data-cihaz="telefon"] .bos-pencere { inset:32px 0 0 0 !important; width:auto !important; height:auto !important; min-width:0; min-height:0; border-radius:0; border:0; box-shadow:none;
    padding-bottom:20px; animation:telUyg .2s ease-out both; }
  @keyframes telUyg { from { transform:scale(.92); opacity:0; } }
  #bos[data-cihaz="telefon"] .bos-pb { cursor:default; padding:0 8px 0 4px; }
  #bos[data-cihaz="telefon"] .bos-pb .geri { display:block; font-size:22px; color:var(--os-vy); }
  #bos[data-cihaz="telefon"] .bos-pb .kuc, #bos[data-cihaz="telefon"] .bos-pb .buy, #bos[data-cihaz="telefon"] .bos-pb .kapat { display:none; }
  #bos[data-cihaz="telefon"] .bos-bildirimler { top:36px; }
  #bos[data-cihaz="telefon"] .cc .cc-kenar { display:none; position:absolute; left:0; top:0; bottom:0; z-index:2; background:var(--os-pencere); }
  #bos[data-cihaz="telefon"] .cc.kenar-acik .cc-kenar { display:flex; } #bos[data-cihaz="telefon"] .cc .cc-kenarduge { display:inline-block; }`;

  // ---------- görünüm ayarları: tema, yazı, duvar kâğıdı ("otomatik" tema ve gök ofisin saatine göre) ----------
  const TEMA_SIRA = ["oto", "acik", "koyu"], TEMA_AD = { oto: "Otomatik (ofis saati)", acik: "Açık", koyu: "Koyu" }, TEMA_IKON = { oto: "🌓", acik: "☀️", koyu: "🌙" };
  const GOK_IKON = { gece: "🌙", safak: "🌅", gun: "☀️", aksam: "🌇" };
  function ofisSaati() { const ic = I(), d = new Date(), dk = ic && ic.dakika ? ic.dakika() : d.getHours() * 60 + d.getMinutes(); return (((dk % 1440) + 1440) % 1440) / 60; }
  const gokEvresi = (h) => (h < 5.5 ? "gece" : h < 7.5 ? "safak" : h < 17.5 ? "gun" : h < 19.5 ? "aksam" : "gece");
  function gorunumUygula() {
    if (!kok) return;
    const evre = gokEvresi(ofisSaati());
    kok.dataset.tema = gorunum.tema === "oto" ? (evre === "gun" || evre === "safak" ? "acik" : "koyu") : gorunum.tema;
    kok.dataset.yazi = gorunum.yazi; kok.dataset.duvar = gorunum.duvar; kok.dataset.gok = evre;
  }
  function gorunumAyarla(k, v) { gorunum[k] = v; gorunumKaydet(); gorunumUygula(); if (acik) { masaustuCiz(); if (pencereler.has("ayarlar")) icerikCiz("ayarlar"); } }

  let kok, cam, acilisEl, masa, simgelerEl, yanEl, cubuk, saatEl, saatWidget, araEl, araGiris, araListe, bildirimEl, merkezEl, telSaatEl, telYerEl;
  function kur() {
    const sahne = document.querySelector(".sahne"); if (!sahne || document.getElementById("bos")) return;
    const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    kok = yap("div"); kok.id = "bos"; kok.hidden = true; kok.setAttribute("role", "dialog"); kok.setAttribute("aria-label", "Ofis bilgisayarı");
    const ekran = yap("div", "bos-ekran"); cam = yap("div", "bos-cam");
    acilisEl = yap("div", "bos-acilis"); masa = yap("div", "bos-masa"); masa.hidden = true;
    simgelerEl = yap("div", "bos-simgeler"); yanEl = yap("div", "bos-yan"); masa.append(simgelerEl, yanEl);
    cubuk = yap("div", "bos-cubuk"); cubuk.hidden = true;
    bildirimEl = yap("div", "bos-bildirimler"); merkezEl = yap("div", "bos-merkez"); merkezEl.hidden = true;
    araKur();
    const telUst = yap("div", "tel-ust"); telSaatEl = yap("span", "s"); telYerEl = yap("span", "yer");
    const telSag = yap("span", "sag"); telSag.append(telYerEl, yap("span", "", "▂▄▆"), yap("span", "pil")); telUst.append(telSaatEl, yap("span", "ada"), telSag);
    const telEv = dugme("", () => telEve(), "tel-ev"); telEv.title = "Ana ekran · ana ekrandayken telefonu kapat"; telEv.setAttribute("aria-label", "Ana ekran");
    cam.append(acilisEl, masa, cubuk, merkezEl, araEl, bildirimEl, yap("div", "bos-tarama"), telUst, telEv);
    const alt = yap("div", "bos-alt"); alt.append(yap("span", "led"), yap("span", "", "BEYİN-OS"), yap("span", "bosluk"), yap("span", "", "Ctrl+Space: ara · Esc: kapat"));
    ekran.append(cam, alt); kok.append(ekran); sahne.appendChild(kok); gorunumUygula();
    kok.addEventListener("pointerdown", (e) => {
      if (e.target === kok) kapat();
      if (!merkezEl.hidden && !e.target.closest(".bos-merkez, .zil")) merkezEl.hidden = true;
    });
    kok.addEventListener("keydown", (e) => { if (koruyucuEl) { hareketVar(); e.preventDefault(); e.stopPropagation(); return; } hareketVar(); if (tusIsle(e)) { e.preventDefault(); e.stopPropagation(); } });
    for (const t of ["pointermove", "pointerdown", "wheel"]) kok.addEventListener(t, hareketVar, { passive: true });
  }
  // Esc sırayla: arama → bildirim menüsü → öndeki pencere → bilgisayar. Ctrl+Space / Ctrl+K aramayı açar.
  function tusIsle(e) {
    if (e.key === "Escape") {
      if (!araEl.hidden) araKapat(); else if (!merkezEl.hidden) merkezEl.hidden = true;
      else if (uygulama && pencereler.has(uygulama) && !pencereler.get(uygulama).kucuk) pencereKapat(uygulama); else kapat();
      return true;
    }
    if (acilisEl && !acilisEl.hidden) { acilisAtla(); return true; }
    if ((e.ctrlKey || e.metaKey) && (e.code === "Space" || (e.key || "").toLowerCase() === "k")) { if (araEl.hidden) araAc(); else araKapat(); return true; }
    return false;
  }

  // ---------- veri ----------
  async function yenile(zorla) {
    if (!ANAHTAR) { veri = null; return; }
    try { const r = await api(zorla ? "/api/os/yenile" : "/api/os/ozet", zorla ? {} : undefined); if (r.ok) veri = await r.json(); } catch (e) { /* sunucu yok */ }
    try { const r = await api("/api/os/ayar"); if (r.ok) ayar = await r.json(); } catch (e) { /* yok */ }
    if (acik && !masa.hidden) { masaustuCiz(); for (const id of pencereler.keys()) if (!CANLI.has(id)) icerikCiz(id); }
  }
  const S = () => (veri && veri.sayilar) || {};

  // Oyunlaştırma: puanlar gerçek kayıtlardan türetilir, hiçbir yere yazılmaz
  function seviye() {
    const s = S(), odakTur = window.OFIS_ODAK ? OFIS_ODAK.istatistik().toplamTur : 0;
    const xp = (s.biten || 0) * 20 + (s.oturum || 0) * 10 + (s.fikir || 0) * 4 + (s.hedef || 0) * 6 + (s.seri || 0) * 15 + odakTur * 8;
    const lv = Math.floor(Math.sqrt(xp / 60)) + 1, alt = (lv - 1) ** 2 * 60, ust = lv ** 2 * 60;
    return { xp, lv, unvan: UNVAN[Math.min(UNVAN.length - 1, lv - 1)], oran: Math.max(0, Math.min(1, (xp - alt) / (ust - alt))), kalan: ust - xp };
  }
  function rozetler() {
    const s = S();
    return [
      { ad: `🔥 ${Math.max(s.seri || 0, 2)} günlük seri`, var: (s.seri || 0) >= 2 }, { ad: "✅ 10 iş bitti", var: (s.biten || 0) >= 10 },
      { ad: "💡 Fikir avcısı", var: (s.fikir || 0) >= 8 }, { ad: "🎯 Hedef koyan", var: (s.hedef || 0) >= 3 },
      { ad: "📬 Posta sıfır", var: !!(veri && veri.posta && veri.posta.var && !s.posta) }, { ad: "🏆 25 oturum", var: (s.oturum || 0) >= 25 },
      { ad: "⏱️ Bugün 4 tur odak", var: !!(window.OFIS_ODAK && OFIS_ODAK.istatistik().bugun.tur >= 4) },
    ];
  }
  function gununGorevleri() {
    const g = [];
    if (!veri) return g;
    const gec = veri.isler.find((i) => i.gecikti), sur = veri.isler.find((i) => i.durum === "active" || i.durum === "doing") || veri.isler[0];
    if (gec) g.push({ ikon: "⚠️", metin: `Gecikeni bitir: ${gec.baslik}`, xp: 30, ac: "isler" });
    else if (sur) g.push({ ikon: "✅", metin: `Bir adım at: ${sur.baslik}`, xp: 20, ac: "isler" });
    const h = veri.hedefler.find((x) => !x.bitti && x.kalan != null && x.kalan >= 0) || veri.hedefler.find((x) => !x.bitti);
    if (h) g.push({ ikon: "🎯", metin: h.kalan != null && h.kalan >= 0 ? `${h.baslik} · ${h.kalan} gün` : `${h.baslik} için ölçüt belirle`, xp: 25, ac: "hedefler" });
    if (veri.posta && veri.posta.var && S().posta) g.push({ ikon: "✉️", metin: `Postada ${S().posta} madde bekliyor`, xp: 15, ac: "posta" });
    else if (veri.posta && !veri.posta.var) g.push({ ikon: "✉️", metin: "Posta özetini bağla", xp: 10, ac: "posta" });
    g.push({ ikon: "💬", metin: "Ekipten birine fikir ya da iş yaz", xp: 10, ac: "mesajlar" });
    return g.slice(0, 4);
  }

  // ---------- masaüstü: simgeler + bileşenler (saat, profil, sıradaki, günün görevleri, odak, rozetler) ----------
  const rozetSayac = () => { const s = S(); return { hedefler: s.hedef, isler: s.gecikti || null, posta: s.posta || null, mesajlar: Object.values(mesajlar).reduce((t, m) => t + (m.okunmadi || 0), 0) || null }; };
  function masaustuCiz() {
    const sayac = rozetSayac();
    simgelerEl.replaceChildren(...UYG.map((u) => {
      const b = dugme("", () => uygulamaAc(u.id), "bos-simge" + (u.gizli ? " gizli-simge" : "")); b.append(yap("span", "i", u.ikon), yap("span", "", u.ad));
      const n = sayac[u.id]; if (n) b.append(yap("span", "rozet-say" + (u.id === "hedefler" ? " sari" : ""), String(n)));
      return b;
    }));
    const saat = yap("div", "kart w-saat"), sS = yap("div", "s"), sT = yap("div", "t"); saat.append(sS, sT);
    saatWidget = { guncelle() { const d = new Date(); sS.textContent = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }); sT.textContent = `${GOK_IKON[gokEvresi(ofisSaati())]} ${d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}`; } };
    saatWidget.guncelle();
    const sv = seviye(), K = window.OFIS_KISI || {};
    const profil = yap("div", "kart"), ust = yap("div", "profil"), bilgi = yap("div");
    bilgi.append(yap("div", "ad", K.ad || (window.DEMO && DEMO.ajanlar.find((a) => a.oyuncu) || {}).ad || "Sen"), yap("div", "unvan", `Seviye ${sv.lv} · ${sv.unvan}`));
    ust.append(portre("oyuncu", 40), bilgi);
    const xp = yap("div", "xp"), dol = yap("i"); xp.append(dol); requestAnimationFrame(() => (dol.style.width = Math.round(sv.oran * 100) + "%"));
    const xy = yap("div", "xpyazi"); xy.append(yap("span", "", `${sv.xp} XP`), yap("span", "", `sonraki seviyeye ${sv.kalan}`));
    profil.append(ust, xp, xy);
    const sira = yap("div", "kart"); sira.append(yap("h4", "", "SIRADAKİ"));
    const isl = veri ? [...veri.isler.filter((i) => i.gecikti), ...veri.isler.filter((i) => !i.gecikti && (i.durum === "active" || i.durum === "doing"))].slice(0, 3) : [];
    if (!isl.length) sira.append(yap("div", "w-bos", veri ? "Süren iş yok." : ANAHTAR ? "Veri yükleniyor…" : "Gerçek veri için Ofis kısayoluyla aç."));
    for (const i of isl) { const r = yap("div", "gorev-sat"); r.append(yap("span", "", i.gecikti ? "⚠️" : "▶️"), yap("span", "", i.baslik), yap("span", "p", i.son ? tarihYaz(i.son) : "")); r.onclick = () => { isFiltre = "hepsi"; uygulamaAc("isler"); }; sira.append(r); }
    const gorev = yap("div", "kart"); gorev.append(yap("h4", "", "GÜNÜN GÖREVLERİ"));
    const gl = gununGorevleri();
    if (!gl.length) gorev.append(yap("div", "w-bos", ANAHTAR ? "Veri yükleniyor…" : "Gerçek veri için Ofis kısayoluyla aç."));
    for (const g of gl) { const r = yap("div", "gorev-sat"); r.append(yap("span", "", g.ikon), yap("span", "", g.metin), yap("span", "p", `+${g.xp} XP`)); r.onclick = () => uygulamaAc(g.ac); gorev.append(r); }
    const odak = yap("div", "kart w-odak"); odak.append(yap("span", "", "⏱️ Odak"), dugme("25 dk başlat", () => kapat(() => { const ic = I(); if (ic && ic.MOD) ic.MOD("odakBaslat"); }), "k-dugme"));
    const roz = yap("div", "kart"), rl = yap("div", "rozetler"); roz.append(yap("h4", "", "ROZETLER"), rl);
    for (const r of rozetler()) rl.append(yap("span", "rozet" + (r.var ? "" : " kilit"), r.ad));
    const konum = yap("div", "kart w-konum"); konum.append(yap("span", "", "📍"), yap("b", "", odaAdi()));
    yanEl.replaceChildren(saat, konum, profil, sira, gorev, odak, roz);
    cubukCiz();
  }
  // Dock: başlat/ara, uygulamalar (açık: nokta, öndeki: çizgi), tema, bildirimler, saat, kapat
  function cubukCiz() {
    if (!cubuk) return;
    const sayac = rozetSayac();
    const bas = dugme("⊞", () => araAc(), "dk"); bas.title = "Başlat / ara (Ctrl+Space)";
    const ara = dugme("", () => araAc(), "ara-hap"); ara.append(yap("span", "", "🔍"), yap("span", "", "Ara"), yap("kbd", "", "Ctrl+Space"));
    const uyg = UYG.filter((u) => !u.gizli).map((u) => {
      const b = dugme(u.ikon, () => dockTik(u.id), "dk" + (pencereler.has(u.id) ? " acik" : "") + (uygulama === u.id ? " odak" : "")); b.title = u.ad;
      const n = sayac[u.id]; if (n) b.append(yap("span", "rozet-say" + (u.id === "hedefler" ? " sari" : ""), String(n)));
      return b;
    });
    const tema = dugme(TEMA_IKON[gorunum.tema] || "🌓", () => gorunumAyarla("tema", TEMA_SIRA[(TEMA_SIRA.indexOf(gorunum.tema) + 1) % TEMA_SIRA.length]), "tepsi"); tema.title = "Tema: " + (TEMA_AD[gorunum.tema] || "");
    const zil = dugme("🔔", () => merkezAcKapa(), "tepsi zil"); zil.title = "Bildirimler"; if (bildirimSay) zil.append(yap("span", "rozet-say", String(bildirimSay)));
    saatEl = yap("span", "tepsi saat"); saatYaz(true);
    const kap = dugme("⏻", () => kapat(), "tepsi kapat"); kap.title = "Bilgisayarı kapat (Esc)";
    cubuk.replaceChildren(bas, ara, yap("span", "ayrac"), ...uyg, yap("span", "ayrac"), tema, zil, saatEl, kap);
  }
  function dockTik(id) { const p = pencereler.get(id); if (!p || p.kucuk) uygulamaAc(id); else if (uygulama === id) kucult(id); else odakla(id); }
  function saatYaz(yalniz) {
    const d = new Date();
    if (saatEl) saatEl.replaceChildren(yap("span", "", d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })), yap("small", "", d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })));
    if (yalniz === true) return;
    if (saatWidget) saatWidget.guncelle();
    gorunumUygula();
  }

  // ---------- pencereler: birden çok; başlıktan sürüklenir, küçültülür, büyütülür. uygulama = öndeki pencere ----------
  const UAD = (id) => UYG.find((x) => x.id === id);
  const icAl = (id) => { const p = pencereler.get(id); return p && !p.kucuk ? p.ic : null; };
  function pencereYap(id) {
    const u = UAD(id), el = yap("div", "bos-pencere"), pb = yap("div", "bos-pb"), ic_ = yap("div", "bos-ic");
    const yen = dugme("⟳", () => yenile(true)), kuc = dugme("–", () => kucult(id), "kuc"), buy = dugme("▢", () => buyut(id), "buy"), kap = dugme("✕", () => pencereKapat(id), "kapat");
    const geri = dugme("‹", () => pencereKapat(id), "geri"); geri.title = "Geri (Esc)";
    yen.title = "Verileri yenile"; kuc.title = "Küçült"; buy.title = "Büyüt / eski boyut (başlığa çift tıkla)"; kap.title = "Kapat (Esc)";
    pb.append(geri, yap("span", "pi", u.ikon), yap("b", "", u.ad), yap("span", "bosluk"), yen, kuc, buy, kap);
    el.append(pb, ic_); el.dataset.u = id;
    el.addEventListener("pointerdown", () => odakla(id), true);
    pb.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) buyut(id); });
    suruklemeKur(pb, el);
    const p = { el, ic: ic_, kucuk: false, buyuk: false };
    pencereler.set(id, p); cam.insertBefore(el, cubuk);
    // Pencere tam ekran (büyütülmüş) açılır; ▢ ya da başlığa çift tık eski boyuta alır: o zaman masaüstü bileşenlerini örtmeden, açık pencere sayısına göre kademeli
    const W = cam.clientWidth, H = cam.clientHeight, n = pencereler.size - 1;
    const w = Math.max(320, Math.min(680, W - 320)), h = Math.max(240, Math.min(470, H - 92));
    el.style.left = Math.max(8, Math.min(14 + n * 26, W - w - 8)) + "px"; el.style.top = Math.max(8, Math.min(12 + n * 22, H - h - 66)) + "px";
    el.style.width = w + "px"; el.style.height = h + "px";
    p.buyuk = true; el.classList.toggle("max", p.buyuk);
    return p;
  }
  function suruklemeKur(pb, el) {
    let bas = null;
    pb.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button") || el.classList.contains("max")) return;
      bas = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop, o: cam.getBoundingClientRect().width / cam.clientWidth || 1 };
      pb.setPointerCapture(e.pointerId);
    });
    pb.addEventListener("pointermove", (e) => {
      if (!bas) return;
      const W = cam.clientWidth, H = cam.clientHeight, l = bas.l + (e.clientX - bas.x) / bas.o, t = bas.t + (e.clientY - bas.y) / bas.o;
      el.style.left = Math.round(Math.max(80 - el.offsetWidth, Math.min(W - 80, l))) + "px"; el.style.top = Math.round(Math.max(0, Math.min(H - 60, t))) + "px";
    });
    const bit = () => { bas = null; }; pb.addEventListener("pointerup", bit); pb.addEventListener("pointercancel", bit);
  }
  function odakla(id) {
    const p = pencereler.get(id); if (!p) return;
    if (zSira > 700) { zSira = 10; [...pencereler.values()].sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0)).forEach((x) => (x.el.style.zIndex = ++zSira)); }
    p.el.style.zIndex = ++zSira;
    const degisti = uygulama !== id; uygulama = id;
    for (const [k, x] of pencereler) x.el.classList.toggle("odak", k === id);
    telUygYaz();
    if (degisti) cubukCiz();
  }
  function ondeki() { let en = null, z = -1; for (const [k, p] of pencereler) if (!p.kucuk && (+p.el.style.zIndex || 0) > z) { en = k; z = +p.el.style.zIndex || 0; } return en; }
  function uygulamaAc(id) {
    if (!UAD(id)) return;
    let p = pencereler.get(id); const yeni = !p;
    if (!p) p = pencereYap(id);
    p.kucuk = false; p.el.classList.remove("kucuk"); odakla(id); sesTik();
    if (id === "mesajlar") kisiVeri(aktifKisi).okunmadi = 0;
    if (yeni || id === "mesajlar") icerikCiz(id);
    masaustuCiz();
  }
  function kucult(id) { const p = pencereler.get(id); if (!p) return; p.kucuk = true; p.el.classList.add("kucuk"); if (uygulama === id) { uygulama = null; const o = ondeki(); if (o) odakla(o); } telUygYaz(); cubukCiz(); }
  function buyut(id) { const p = pencereler.get(id); if (!p) return; p.buyuk = !p.buyuk; p.el.classList.toggle("max", p.buyuk); }
  function pencereKapat(id = uygulama) {
    const p = pencereler.get(id); if (!p) return;
    p.el.remove(); pencereler.delete(id);
    if (uygulama === id) { uygulama = null; const o = ondeki(); if (o) odakla(o); }
    telUygYaz(); masaustuCiz();
  }
  function bosMesaj(metin, kod) { const d = yap("div", "bos-bos", metin); if (kod) { d.append(document.createElement("br")); d.append(yap("code", "", kod)); } return d; }
  const sunucusuz = () => bosMesaj("Gerçek veri yalnız masaüstündeki Ofis kısayoluyla açınca görünür.");

  function icerikCiz(id = uygulama) {
    const fn = { hedefler: hedeflerCiz, isler: islerCiz, fikirler: fikirlerCiz, yapilanlar: yapilanlarCiz, posta: postaCiz, mesajlar: mesajlarCiz, projeler: projelerCiz, odak: odakCiz, ayarlar: ayarlarCiz,
      terminal: terminalCiz, claudekodu: () => (window.OFIS_CLAUDE_KODU ? window.OFIS_CLAUDE_KODU.ciz() : bosMesaj("Claude Code modülü yüklenmedi.")), sutlac: oyunCiz, gizli: gizliCiz }[id];
    const p = pencereler.get(id); if (!fn || !p) return;
    const kaydirma = p.ic.scrollTop;
    p.ic.style.padding = id === "mesajlar" ? "10px 12px" : id === "terminal" || id === "sutlac" || id === "claudekodu" ? "0" : "";
    p.ic.replaceChildren(...[].concat(fn())); p.ic.scrollTop = kaydirma;
  }
  function sorDugmesi(metin, ajan, istem) { return dugme(metin, () => { mesajaGit(ajan, istem); }, "k-dugme"); }
  function mesajaGit(ajan, istem) {
    aktifKisi = AJANLAR[ajan] ? ajan : "ada"; uygulamaAc("mesajlar");
    const k = icAl("mesajlar"), t = k && k.querySelector("textarea"); if (t && istem) { t.value = istem; t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }

  function hedeflerCiz() {
    if (!veri) return sunucusuz();
    const arac = yap("div", "arac"); arac.append(sorDugmesi("＋ Yeni hedef", "ada", "Yeni bir hedef kaydet: "), yap("span", "cip", `${S().hedef || 0} aktif`));
    if (!veri.hedefler.length) return [arac, bosMesaj("Hedef bulunamadı. Hedefler klasörü:", (veri.kaynaklar && veri.kaynaklar.hedefler) || "notes/hedefler")];
    const l = yap("div", "liste ikili"), bitenler = veri.hedefler.filter((h) => h.bitti);
    for (const h of veri.hedefler.filter((x) => !x.bitti)) l.append(hedefKart(h));
    const parca = [arac, l];
    if (bitenler.length) { parca.push(yap("div", "gun-bas", `TAMAMLANANLAR (${bitenler.length})`)); const l2 = yap("div", "liste ikili"); bitenler.forEach((h) => l2.append(hedefKart(h))); parca.push(l2); }
    return parca;
  }
  function hedefKart(h) {
    const o = yap("div", "oge"), bas = yap("div", "bas");
    bas.append(yap("b", "", h.baslik), yap("span", "cip" + (h.bitti ? " iyi" : h.durum === "aktif" ? " sari" : ""), DURUM_AD[h.durum] || h.durum));
    const meta = yap("div", "meta");
    if (h.son) meta.append(yap("span", h.kalan < 0 ? "cip kotu" : h.kalan <= 7 ? "cip sari" : "", h.kalan < 0 ? `⚠ ${-h.kalan} gün geçti` : h.kalan === 0 ? "⏳ bugün" : `⏳ ${h.kalan} gün kaldı · ${tarihYaz(h.son)}`));
    else meta.append(yap("span", "", "📅 son tarih yok"));
    if (h.tur) meta.append(yap("span", "", "· " + h.tur));
    o.append(bas, meta);
    if (h.olcut) o.append(yap("p", "", "Ölçüt: " + h.olcut));
    if (h.ilerleme && h.ilerleme.length) o.append(yap("p", "", "Son: " + h.ilerleme[h.ilerleme.length - 1]));
    const alt = yap("div", "alt"); alt.append(sorDugmesi("💬 Sıradaki adım?", "ada", `"${h.baslik}" hedefi için bir sonraki somut adım ne olmalı?`)); o.append(alt);
    return o;
  }

  let isFiltre = "hepsi";
  function islerCiz() {
    if (!veri) return sunucusuz();
    const arac = yap("div", "arac");
    for (const [k, ad] of [["hepsi", "Hepsi"], ["suren", "Sürenler"], ["gelen", "Gelen kutusu"], ["biten", "Bitenler"]])
      arac.append(dugme(ad, () => { isFiltre = k; icerikCiz(); }, isFiltre === k ? "secili" : ""));
    arac.append(sorDugmesi("＋ Görev", "ada", "Yeni görev ekle: "));
    let liste = isFiltre === "biten" ? veri.bitenler : veri.isler;
    if (isFiltre === "suren") liste = liste.filter((i) => i.durum === "active" || i.durum === "doing");
    if (isFiltre === "gelen") liste = liste.filter((i) => i.durum === "inbox" || i.durum === "todo");
    if (!liste.length) return [arac, bosMesaj("Bu listede iş yok.")];
    const gruplar = {};
    for (const i of liste) (gruplar[i.proje || "Diğer"] = gruplar[i.proje || "Diğer"] || []).push(i);
    const parca = [arac];
    for (const [proje, isler] of Object.entries(gruplar).sort((a, b) => b[1].length - a[1].length)) {
      parca.push(yap("div", "gun-bas", `${proje.toLocaleUpperCase("tr")} · ${isler.length}`));
      const l = yap("div", "liste");
      for (const i of isler) {
        const o = yap("div", "oge"), bas = yap("div", "bas");
        bas.append(yap("b", "", i.baslik), yap("span", "cip" + (i.gecikti ? " kotu" : i.durum === "active" || i.durum === "doing" ? " sari" : i.durum === "done" ? " iyi" : ""), i.gecikti ? "gecikti" : DURUM_AD[i.durum] || i.durum));
        o.append(bas);
        const meta = yap("div", "meta"); if (i.son) meta.append(yap("span", "", "📅 " + tarihYaz(i.son))); if (isFiltre === "biten" && i.zaman) meta.append(yap("span", "", "✔ " + tarihYaz(i.zaman.slice(0, 10))));
        meta.append(yap("code", "", i.yol)); o.append(meta);
        if (i.ozet) { const p = yap("p", "", i.ozet); p.hidden = true; o.append(p); o.style.cursor = "pointer"; o.onclick = () => (p.hidden = !p.hidden); }
        l.append(o);
      }
      parca.push(l);
    }
    return parca;
  }

  let fikirAra = "";
  function fikirlerCiz() {
    if (!veri) return sunucusuz();
    const arac = yap("div", "arac"), ara = yap("input"); ara.type = "search"; ara.placeholder = "Fikirlerde ara…"; ara.value = fikirAra;
    const l = yap("div", "liste ikili");
    const doldur = () => {
      const q = fikirAra.toLocaleLowerCase("tr"), f = veri.fikirler.filter((x) => !q || (x.baslik + " " + x.ozet).toLocaleLowerCase("tr").includes(q));
      l.replaceChildren(...(f.length ? f.map((x) => {
        const o = yap("div", "oge"), bas = yap("div", "bas"); bas.append(yap("b", "", x.baslik)); if (x.uygulandi) bas.append(yap("span", "cip iyi", "hayata geçti"));
        o.append(bas); if (x.tarih) { const m = yap("div", "meta"); m.append(yap("span", "", "💡 " + tarihYaz(x.tarih))); o.append(m); }
        if (x.ozet) o.append(yap("p", "", x.ozet));
        const alt = yap("div", "alt"); alt.append(sorDugmesi("💬 Büyüt", "ada", `"${x.baslik}" fikrini nasıl küçük bir denemeye çevirebilirim?`)); o.append(alt);
        return o;
      }) : [bosMesaj(veri.fikirler.length ? "Aramaya uyan fikir yok." : "Fikir dosyası boş ya da yok:", veri.fikirler.length ? "" : (veri.kaynaklar && veri.kaynaklar.fikirler) || "notes/fikirler.md")]));
    };
    ara.oninput = () => { fikirAra = ara.value; doldur(); };
    arac.append(ara, sorDugmesi("＋ Fikir", "ada", "Şu fikri kaydet: ")); doldur();
    return [arac, l];
  }

  function yapilanlarCiz() {
    if (!veri) return sunucusuz();
    const s = S(), hafta = veri.yapilanlar.filter((y) => gunFarki(y.tarih) >= -6).length;
    const ust = yap("div", "arac"); ust.append(yap("span", "cip sari", `🔥 ${s.seri || 0} günlük seri`), yap("span", "cip", `Bu hafta ${hafta} oturum`), yap("span", "cip iyi", `✅ ${s.biten || 0} iş bitti`));
    const parca = [ust];
    if (!veri.yapilanlar.length && !veri.bitenler.length) return [ust, bosMesaj("Henüz kayıtlı oturum yok.")];
    let gun = "";
    for (const y of veri.yapilanlar) {
      if (y.tarih !== gun) { gun = y.tarih; const f = gunFarki(gun); parca.push(yap("div", "gun-bas", f === 0 ? "BUGÜN" : f === -1 ? "DÜN" : tarihYaz(gun).toLocaleUpperCase("tr"))); }
      const o = yap("div", "oge"), bas = yap("div", "bas"); bas.append(yap("b", "", y.etiket || "oturum")); if (y.saat) bas.append(yap("span", "cip", y.saat)); if (y.devam) bas.append(yap("span", "cip", `+${y.devam} devam`));
      o.append(bas); if (y.ozet) o.append(yap("p", "", y.ozet)); parca.push(o);
    }
    if (veri.bitenler.length) {
      parca.push(yap("div", "gun-bas", "SON BİTEN İŞLER"));
      const l = yap("div", "liste");
      for (const i of veri.bitenler.slice(0, 15)) { const o = yap("div", "oge"), bas = yap("div", "bas"); bas.append(yap("b", "", "✔ " + i.baslik)); if (i.proje) bas.append(yap("span", "cip", i.proje)); o.append(bas); l.append(o); }
      parca.push(l);
    }
    return parca;
  }

  function postaCiz() {
    if (!veri) return sunucusuz();
    const p = veri.posta || {};
    if (!p.var) {
      const d = bosMesaj("Henüz posta özeti yok. Her sabah Gmail'i tarayıp aksiyon gerektirenleri şu nota yazan bir zamanlanmış görev bu ekranı doldurur:", p.yol || "notes/posta/ozet.md");
      d.append(document.createElement("br"), yap("small", "", "Ofis Gmail'e doğrudan bağlanmaz; yalnız bu notu okur."));
      return d;
    }
    const ust = yap("div", "arac"); ust.append(yap("span", "cip" + (p.bayat ? " kotu" : " iyi"), (p.bayat ? "⚠ eski özet · " : "güncel · ") + new Date(p.guncel).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })),
      sorDugmesi("💬 Postadan ne önemli?", "postaci", "Posta özetine bak: bugün hangisine öncelik vermeliyim?"));
    const parca = [ust];
    for (const b of p.bolumler) {
      parca.push(yap("div", "gun-bas", b.baslik.toLocaleUpperCase("tr")));
      if (!b.maddeler.length) { parca.push(yap("div", "oge", b.metin || "—")); continue; }
      const l = yap("div", "liste");
      for (const m of b.maddeler) {
        const o = yap("div", "oge"), sat = yap("div", "bas"); sat.append(yap("span", "", m)); o.append(sat);
        const alt = yap("div", "alt"); alt.append(sorDugmesi("💬 Ne yapayım?", "postaci", `Postadaki şu madde için ne yapmalıyım: "${m}"`), sorDugmesi("✅ Göreve çevir", "ada", `Postadaki şu maddeyi görev olarak ekle: "${m}"`));
        o.append(alt); l.append(o);
      }
      parca.push(l);
    }
    return parca;
  }

  function projelerCiz() {
    if (!veri) return sunucusuz();
    if (!veri.projeler.length) return bosMesaj("projeler/ altında README.md olan proje yok.");
    const l = yap("div", "liste ikili");
    for (const p of veri.projeler) {
      const o = yap("div", "oge"), bas = yap("div", "bas"); bas.append(yap("b", "", "📁 " + p.ad), yap("span", "cip", tarihYaz(p.zaman))); o.append(bas);
      const m = yap("div", "meta"); m.append(yap("code", "", "projeler/" + p.klasor)); o.append(m);
      if (p.ozet) o.append(yap("p", "", p.ozet));
      const alt = yap("div", "alt"); alt.append(sorDugmesi("💬 Nerede kaldık?", "ada", `projeler/${p.klasor} projesinde nerede kaldık, sıradaki adım ne?`)); o.append(alt);
      l.append(o);
    }
    return l;
  }

  function odakCiz() {
    const O = window.OFIS_ODAK, d = yap("div", "odak-buyuk"), st = O ? O.istatistik() : null, du = O ? O.durum() : null;
    const iki = (n) => String(n).padStart(2, "0"), kalan = du ? Math.max(0, du.bitis - Date.now()) : 25 * 60000;
    d.append(yap("div", "saat", `${iki(Math.floor(kalan / 60000))}:${iki(Math.floor((kalan % 60000) / 1000))}`));
    d.append(yap("div", "odak-durum", !du ? "Pomodoro: 25 dk odak · 5 dk mola · 4 turda bir 15 dk uzun mola" : du.faz === "odak" ? `Odakta · tur ${du.tur}/${du.turSayisi}${du.gorev ? " · " + du.gorev.ad : ""}` : `${du.uzun ? "Uzun mola" : "Mola"} · sonra tur ${du.uzun ? 1 : du.tur + 1}`));
    d.append(yap("div", "", "Odakta ofis susar: masada lamba ve \"Odakta\" tabelası, ekip fısıldaşır, Sütlaç yanında uyur. Molada kahveye yürürsün, biri sohbete gelir."));
    d.append(dugme(du ? "Ofise dön" : "⏱️ Odağı başlat", () => { kapat(() => { const ic = I(); if (!du && ic && ic.MOD) ic.MOD("odakBaslat"); }); }));
    if (st) {
      const say = yap("div", "odak-sayilar");
      say.append(yap("span", "cip sari", `Bugün ${st.bugun.tur} tur · ${st.bugun.dk} dk`), yap("span", "cip", `🔥 ${st.seri} gün seri`), yap("span", "cip", `Toplam ${st.toplamTur} tur`));
      const hafta = yap("div", "odak-hafta"), en = Math.max(4, ...st.hafta.map((g) => g.tur));
      st.hafta.forEach((g, i) => {
        const gun = yap("div", "gun" + (i === st.hafta.length - 1 ? " bugun" : "")), c = yap("div", "cubuk-s");
        c.style.height = Math.round((g.tur / en) * 70) + "px"; c.title = `${g.tur} tur · ${g.dk} dk`;
        gun.append(yap("span", "", g.tur ? String(g.tur) : ""), c, yap("span", "", new Date(g.tarih + "T00:00:00").toLocaleDateString("tr-TR", { weekday: "short" })));
        hafta.append(gun);
      });
      d.append(say, hafta);
      if (st.bugun.notlar && st.bugun.notlar.length) { const l = yap("div", "liste"); l.style.width = "100%"; for (const n of st.bugun.notlar.slice(-5).reverse()) l.append(yap("div", "oge", n)); d.append(yap("div", "gun-bas", "BUGÜNKÜ TURLAR"), l); }
    }
    return d;
  }

  function ayarlarCiz() {
    const parca = [];
    const gor = yap("div", "oge"); gor.append(yap("b", "", "Görünüm"));
    const secim = (etiket, anahtar, secenekler) => {
      const sat = yap("div", "ayar-sat"), seg = yap("div", "seg");
      for (const [v, ad] of secenekler) seg.append(dugme(ad, () => gorunumAyarla(anahtar, v), gorunum[anahtar] === v ? "secili" : ""));
      sat.append(yap("span", "", etiket), seg); return sat;
    };
    gor.append(secim("Tema", "tema", TEMA_SIRA.map((k) => [k, TEMA_AD[k]])), secim("Yazı", "yazi", [["modern", "Modern"], ["piksel", "Piksel"]]),
      secim("Duvar kâğıdı", "duvar", [["gok", "Gök (saate göre)"], ["duz", "Düz"]]));
    gor.append(yap("p", "", "Kısayollar: Ctrl+Space ara · başlıktan sürükle · başlığa çift tıkla büyüt · Esc öndeki pencereyi kapat. Görünüm bu tarayıcıda saklanır."));
    parca.push(gor);
    const a = yap("label", "anahtar"), kutu = yap("input"); kutu.type = "checkbox"; kutu.checked = !!ayar.dogrudan; kutu.disabled = !ANAHTAR;
    const t = yap("div"); t.append(yap("b", "", "Mesajla gelen kayıtları doğrudan kaydet"), yap("small", "", "Açıkken Mesajlar'da ekip arkadaşının önerdiği not, görev, fikir ve hedef onay beklemeden vault'a yazılır (yalnız notes/ ve tasks/ altına, üzerine yazmadan). Kapalıyken onay kartı çıkar."));
    a.append(kutu, t); parca.push(a);
    kutu.onchange = async () => { try { const r = await api("/api/os/ayar", { dogrudan: kutu.checked }); if (r.ok) ayar = await r.json(); } catch (e) { /* yok */ } kutu.checked = !!ayar.dogrudan; };
    const k = (veri && veri.kaynaklar) || {}, kay = yap("div", "oge");
    kay.append(yap("b", "", "Kaynaklar"));
    for (const [ad, yol] of [["Hedefler", k.hedefler], ["Fikirler", k.fikirler], ["Posta özeti", k.posta]]) { const m = yap("div", "meta"); m.append(yap("span", "", ad + ":"), yap("code", "", yol || "—")); kay.append(m); }
    kay.append(yap("p", "", "Yolları değiştirmek için veri klasöründeki os.json: {\"hedefler\": \"notes/...\", \"fikirler\": \"notes/....md\", \"posta\": \"notes/....md\"}"));
    parca.push(kay);
    const y = yap("div", "arac"); y.style.marginTop = "10px"; y.append(dugme("⟳ Verileri şimdi yenile", () => yenile(true))); parca.push(y);
    return parca;
  }

  // ---------- Terminal: Ada ile gerçek iş (claude -p). Araç adımları canlı log; öneri ve kritik iş kartları satır içinde ----------
  const term = { satirlar: [], oturum: "", calisiyor: false, model: "", gecmis: [], gi: -1, tam: null, modeller: null, ctrl: null };
  const TERM_DEVAM = "Onayladım, eminim. Kilide takılan işi birebir aynı haliyle şimdi yap.";
  function termEl() { const k = icAl("terminal"); return k && k.querySelector(".term"); }
  async function termDurumAl() {
    if (!ANAHTAR) return;
    try { const r = await api("/api/ayar-sunucu"); if (r.ok) term.tam = !!(await r.json()).tam; } catch (e) { /* yok */ }
    try { if (!term.modeller) { const r = await api("/api/durum"); if (r.ok) term.modeller = (await r.json()).modeller || null; } } catch (e) { /* yok */ }
    if (pencereler.has("terminal")) termUstCiz();
  }
  function terminalCiz() {
    const kutu = yap("div", "term"), ust = yap("div", "term-ust"), akis = yap("div", "term-akis"), gir = yap("div", "term-gir" + (term.calisiyor ? " mesgul" : ""));
    const giris = yap("input"); giris.type = "text"; giris.spellcheck = false; giris.setAttribute("aria-label", "Terminal komutu"); giris.placeholder = term.calisiyor ? "çalışıyor… (Ctrl+C durdurur)" : "Ada'ya bir iş ver ya da 'yardım' yaz";
    gir.append(yap("span", "ps", "ada@beyinos:~$"), giris);
    giris.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); const t = giris.value; giris.value = ""; termGonder(t); }
      else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault(); if (!term.gecmis.length) return;
        term.gi = e.key === "ArrowUp" ? (term.gi < 0 ? term.gecmis.length - 1 : Math.max(0, term.gi - 1)) : (term.gi < 0 ? -1 : term.gi + 1);
        if (term.gi >= term.gecmis.length) term.gi = -1; giris.value = term.gi < 0 ? "" : term.gecmis[term.gi];
      } else if (e.ctrlKey && (e.key || "").toLowerCase() === "c" && term.calisiyor && !giris.selectionEnd) { e.preventDefault(); termDurdur(); }
      else if (e.ctrlKey && (e.key || "").toLowerCase() === "l") { e.preventDefault(); term.satirlar = []; termAkisCiz(); }
    });
    kutu.append(ust, akis, gir); kutu.addEventListener("pointerup", () => { if (!getSelection().toString()) giris.focus(); });
    if (!term.satirlar.length) termYaz("bilgi", "BeyinOS Terminal · Ada vault'unda okur, arar" + (term.tam ? ", yazar ve komut çalıştırır." : ".") + " Komutlar: yardım, temizle, yeni, model <ad>.", true);
    requestAnimationFrame(() => { termUstCiz(); termAkisCiz(); giris.focus(); });
    termDurumAl();
    return kutu;
  }
  function termUstCiz() {
    const k = termEl(); if (!k) return; const ust = k.querySelector(".term-ust");
    const kip = yap("span", "term-kip" + (term.tam ? " tam" : term.tam === false ? " okur" : ""), term.tam ? "tam yetenek: yazar, komut çalıştırır · kritik işler onaya gelir" : term.tam === false ? "salt-okur (Ayarlar > İkinci beyin > Tam yetenek)" : "…");
    const sec = yap("select"); sec.title = "Model";
    for (const [v, ad] of [["", "Model: otomatik"], ...Object.entries(term.modeller || { haiku: "Haiku", sonnet: "Sonnet", opus: "Opus" })]) { const o = yap("option", "", ad); o.value = v; sec.append(o); }
    sec.value = term.model; sec.onchange = () => { term.model = sec.value; };
    ust.replaceChildren(kip, yap("span", "bosluk"), sec, dugme("Yeni oturum", () => { term.oturum = ""; termYaz("bilgi", "Yeni oturum: önceki konuşma unutuldu."); }), dugme("Temizle", () => { term.satirlar = []; termAkisCiz(); }));
  }
  function termYaz(tur, metin, sessiz) { term.satirlar.push({ tur, metin }); if (term.satirlar.length > 400) term.satirlar.splice(0, term.satirlar.length - 400); if (!sessiz) termAkisCiz(); }
  let termCizBekliyor = false;
  function termAkisCiz() {
    if (termCizBekliyor) return; termCizBekliyor = true;
    requestAnimationFrame(() => {
      termCizBekliyor = false; const k = termEl(); if (!k) return;
      const akis = k.querySelector(".term-akis"), altta = akis.scrollHeight - akis.scrollTop - akis.clientHeight < 40;
      akis.replaceChildren(...term.satirlar.filter((x) => x.tur !== "metin" || x.metin).map(termSatir));
      if (altta) akis.scrollTop = akis.scrollHeight;
      const gir = k.querySelector(".term-gir"), inp = gir.querySelector("input"); gir.classList.toggle("mesgul", term.calisiyor);
      inp.placeholder = term.calisiyor ? "çalışıyor… (Ctrl+C durdurur)" : "Ada'ya bir iş ver ya da 'yardım' yaz";
    });
  }
  function termSatir(x) {
    if (x.tur === "girdi") { const d = yap("div", "girdi"); d.append(yap("span", "ps", "ada@beyinos:~$ "), document.createTextNode(x.metin)); return d; }
    if (x.tur === "metin") { const d = yap("div", "metin"); d.innerHTML = bicimle(x.metin); return d; }
    if (x.tur === "kritik" || x.tur === "oneri") return termKart(x);
    return yap("div", x.tur, x.metin);
  }
  function termKart(x) {
    const k = yap("div", "term-kart" + (x.tur === "kritik" ? " kritik" : "")), o = x.veri;
    if (x.sonuc) { k.append(yap("div", "", x.sonuc)); return k; }
    if (x.tur === "kritik") { k.append(yap("b", "", `⚠ Emin misin? Ada kritik bir iş yapmak istiyor: ${o.neden}`), yap("pre", "", o.is)); }
    else { k.append(yap("b", "", `${TUR_AD[o.tur] || "Kayıt"} önerisi · ${o.yol || ""}`), yap("pre", "", (o.baslik ? o.baslik + "\n" : "") + (o.metin || ""))); }
    const od = yap("div", "od"), evet = dugme(x.tur === "kritik" ? "Evet, eminim" : "Onayla, kaydet", () => karar("evet"), "evet"), hayir = dugme(x.tur === "kritik" ? "Hayır, yapma" : "Vazgeç", () => karar("hayir"));
    async function karar(kr) {
      evet.disabled = hayir.disabled = true;
      try {
        const r = await api(x.tur === "kritik" ? "/api/kritik" : "/api/onay", { jeton: o.jeton, karar: kr }), j = await r.json();
        x.sonuc = r.ok ? (kr === "evet" ? "✔ " : "✖ ") + j.metin : "Olmadı: " + (j.hata || r.status);
        if (r.ok && kr === "evet" && x.tur === "kritik") { termAkisCiz(); return termGonder(TERM_DEVAM); }
        if (r.ok && kr === "evet" && x.tur === "oneri") kayitOldu("ada", { ...o, kaydedildi: j.metin });
      } catch (e) { x.sonuc = "Olmadı: sunucuya ulaşılamadı."; }
      termAkisCiz();
    }
    od.append(evet, hayir); k.append(od); return k;
  }
  function termKomut(t) {
    const [k, ...arg] = t.split(/\s+/), kk = kucukHarf(k);
    if (["temizle", "clear", "cls"].includes(kk)) { term.satirlar = []; termAkisCiz(); return true; }
    if (["yeni", "new"].includes(kk)) { term.oturum = ""; termYaz("girdi", t); termYaz("bilgi", "Yeni oturum."); return true; }
    if (["yardım", "yardim", "help", "?"].includes(kk)) {
      termYaz("girdi", t);
      termYaz("bilgi", "Ada'ya düz cümleyle iş ver: \"notes/ altında okul notlarımı özetle\", \"bugünkü görevlerimi listele\"" + (term.tam ? ", \"şu notu düzenle\"." : ".") +
        "\nKomutlar: temizle (Ctrl+L) · yeni (yeni oturum) · model haiku|sonnet|opus|otomatik · ↑↓ geçmiş · Ctrl+C durdur" +
        (term.tam ? "\nSilme, push, ağa çıkma gibi kritik işler \"Emin misin?\" kartıyla onayına gelir." : "\nYazma ve komut için: Ayarlar > İkinci beyin > Tam yetenek."));
      return true;
    }
    if (kk === "model") {
      termYaz("girdi", t); const m = kucukHarf(arg[0] || "");
      if (m === "otomatik" || m === "") { term.model = ""; termYaz("bilgi", "Model: otomatik."); }
      else if (!term.modeller || term.modeller[m]) { term.model = m; termYaz("bilgi", "Model: " + ((term.modeller && term.modeller[m]) || m)); }
      else termYaz("hata", "Bilinmeyen model. Seçenekler: " + Object.keys(term.modeller).join(", "));
      termUstCiz(); return true;
    }
    return false;
  }
  function termDurdur() { if (term.ctrl) term.ctrl.abort(); api("/api/iptal", {}).catch(() => {}); }
  async function termGonder(metin) {
    metin = String(metin || "").trim(); if (!metin || term.calisiyor) return;
    if (term.gecmis[term.gecmis.length - 1] !== metin) term.gecmis.push(metin); term.gi = -1;
    if (termKomut(metin)) return;
    termYaz("girdi", metin);
    if (!ANAHTAR) return termYaz("hata", "Terminal yalnız masaüstündeki Ofis kısayoluyla açınca çalışır.");
    term.calisiyor = true; term.ctrl = new AbortController(); termAkisCiz();
    let cikti = { tur: "metin", metin: "" }, bitti = null, hata = null; term.satirlar.push(cikti);
    try {
      const r = await fetch("/api/sor", { method: "POST", signal: term.ctrl.signal, headers: { "X-Ofis-Anahtar": ANAHTAR, "Content-Type": "application/json" },
        body: JSON.stringify({ soru: metin, ajan: "ada", oturum: term.oturum, ...(term.model ? { model: term.model } : {}), efor: "medium" }) });
      if (!r.ok) throw new Error("sunucu " + r.status);
      const okur = r.body.getReader(), coz = new TextDecoder(); let tampon = "";
      for (;;) {
        const { value, done } = await okur.read(); if (done) break;
        tampon += coz.decode(value, { stream: true }); let i;
        while ((i = tampon.indexOf("\n")) >= 0) {
          const sat = tampon.slice(0, i); tampon = tampon.slice(i + 1); if (!sat.trim()) continue;
          const d = JSON.parse(sat);
          if (d.tur === "basla") termYaz("bilgi", `${d.model || ""}${d.efor ? " · " + d.efor : ""} düşünüyor…`);
          else if (d.tur === "arac") { termYaz("arac", `  ↳ ${d.ad}${d.hedef ? " " + d.hedef : ""}`); cikti = { tur: "metin", metin: "" }; term.satirlar.push(cikti); }
          else if (d.tur === "metin") { cikti.metin += d.parca; termAkisCiz(); }
          else if (d.tur === "bitti") bitti = d; else if (d.tur === "hata") hata = d;
        }
      }
    } catch (e) { hata = { metin: e.name === "AbortError" ? "^C durduruldu." : "Sunucuya ulaşılamadı. Ofis penceresi açık mı?" }; }
    term.calisiyor = false; term.ctrl = null;
    if (bitti) {
      term.oturum = bitti.oturum || term.oturum;
      if (!term.satirlar.some((x) => x.tur === "metin" && x.metin && x !== cikti) && !cikti.metin) cikti.metin = bitti.metin || "(boş cevap)";
      for (const o of bitti.oneriler || []) term.satirlar.push(o.jeton ? { tur: "oneri", veri: o } : { tur: o.kaydedildi ? "bilgi" : "hata", metin: o.kaydedildi ? "✔ Kaydedildi: " + o.kaydedildi : "Kayıt önerisi geçersiz: " + (o.gecersiz || "") });
      for (const k of bitti.kritik || []) term.satirlar.push({ tur: "kritik", veri: k });
      if (bitti.sure) termYaz("bilgi", `✓ ${bitti.sure} sn`, true);
      if (!icAl("terminal") || uygulama !== "terminal") bildir("🖥️", "Terminal", (bitti.kritik || []).length ? "Ada onayını bekliyor." : "Ada işi bitirdi.", () => uygulamaAc("terminal"));
    }
    if (hata) { term.oturum = hata.oturum || term.oturum; termYaz("hata", hata.metin || "Cevap gelmedi.", true); }
    termAkisCiz();
    const k = termEl(); if (k) k.querySelector(".term-gir input").focus();
  }

  // ---------- Sütlaç Koşusu: yılan oyunu. Sütlaç fare kovalar, her fare arkasına bir yumak ekler; duvara ya da yumağa çarpınca uyuyakalır ----------
  const OYUN_REKOR = "ofis-sutlac-rekor";
  function oyunCiz() {
    const G = 22, Y = 14, K = 16, kutu = yap("div", "oyun"), ust = yap("div", "oyun-ust"), skorEl = yap("span"), rekorEl = yap("span"), cv = yap("canvas");
    cv.width = G * K; cv.height = Y * K; cv.tabIndex = 0; cv.setAttribute("aria-label", "Sütlaç Koşusu oyun alanı");
    let rekor = 0; try { rekor = +localStorage.getItem(OYUN_REKOR) || 0; } catch (e) { /* yok */ }
    ust.append(yap("b", "", "🐱 Sütlaç Koşusu"), yap("span", "bosluk"), skorEl, rekorEl);
    kutu.append(ust, cv, yap("div", "oyun-alt", "Yön tuşları ya da WASD · Boşluk: başla / duraklat · fareleri yakala, yumağa ve duvara çarpma"));
    const c = cv.getContext("2d"); c.imageSmoothingEnabled = false;
    let yil, yon, kuyruk, fare, skor, durum = "hazir", adimSure, son = 0, birik = 0, kare = 0;
    const yaz = () => { skorEl.textContent = `🐭 ${skor}`; rekorEl.textContent = `Rekor ${rekor}`; };
    function sifirla() { yil = [{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }]; yon = { x: 1, y: 0 }; kuyruk = []; skor = 0; adimSure = 150; fareKoy(); yaz(); }
    function fareKoy() { do { fare = { x: Math.floor(Math.random() * G), y: Math.floor(Math.random() * Y) }; } while (yil.some((p) => p.x === fare.x && p.y === fare.y)); }
    function yonVer(x, y) { const sonY = kuyruk.length ? kuyruk[kuyruk.length - 1] : yon; if (x === -sonY.x && y === -sonY.y) return; if (kuyruk.length < 3) kuyruk.push({ x, y }); }
    function adim() {
      if (kuyruk.length) yon = kuyruk.shift();
      const bas = { x: yil[0].x + yon.x, y: yil[0].y + yon.y };
      if (bas.x < 0 || bas.y < 0 || bas.x >= G || bas.y >= Y || yil.some((p, i) => i < yil.length - 1 && p.x === bas.x && p.y === bas.y)) return uyudu();
      yil.unshift(bas);
      if (bas.x === fare.x && bas.y === fare.y) { skor++; yaz(); ton([660, 990], "square", 0.05, 0.04); adimSure = Math.max(68, adimSure - 4); fareKoy(); } else yil.pop();
    }
    function uyudu() {
      durum = "bitti"; ton([392, 330, 262], "triangle", 0.12, 0.05);
      if (skor > rekor) { rekor = skor; try { localStorage.setItem(OYUN_REKOR, String(rekor)); } catch (e) { /* yok */ } if (skor >= 5) xpUcur("Yeni rekor!"); }
      yaz();
    }
    const kutuCiz = (x, y, w, h, renk) => { c.fillStyle = renk; c.fillRect(x, y, w, h); };
    function kafaCiz(px, py) {   // 16x16 beyaz kedi başı; yöne göre aynalanır
      c.save(); if (yon.x < 0) { c.translate(px * 2 + K, 0); c.scale(-1, 1); }
      kutuCiz(px + 2, py + 1, 3, 4, "#2b2a3d"); kutuCiz(px + 11, py + 1, 3, 4, "#2b2a3d"); kutuCiz(px + 3, py + 2, 1, 2, "#f6a6b8"); kutuCiz(px + 12, py + 2, 1, 2, "#f6a6b8");
      kutuCiz(px + 1, py + 4, 14, 11, "#2b2a3d"); kutuCiz(px + 2, py + 5, 12, 9, "#fbfbff"); kutuCiz(px + 2, py + 12, 12, 2, "#dfe3ef");
      const goz = durum === "bitti" ? 1 : 2;
      kutuCiz(px + 4, py + 8, 2, goz, "#2b2a3d"); kutuCiz(px + 10, py + 8, 2, goz, "#2b2a3d"); kutuCiz(px + 7, py + 10, 2, 1, "#f08aa5");
      c.restore();
    }
    function ciz() {
      for (let y = 0; y < Y; y++) for (let x = 0; x < G; x++) kutuCiz(x * K, y * K, K, K, (x + y) % 2 ? "#3f6b48" : "#457552");
      const fx = fare.x * K, fy = fare.y * K, kip = Math.floor(kare / 18) % 2;   // fare: gri gövde, pembe kulak, kıpır kuyruk
      kutuCiz(fx + 3, fy + 7, 9, 5, "#8c8fa3"); kutuCiz(fx + 10, fy + 5, 3, 3, "#8c8fa3"); kutuCiz(fx + 11, fy + 5, 1, 1, "#f6a6b8"); kutuCiz(fx + 12, fy + 8, 1, 1, "#1b1d25");
      kutuCiz(fx + 1, fy + 9 + kip, 2, 1, "#f6a6b8"); kutuCiz(fx, fy + 8 + kip, 1, 1, "#f6a6b8");
      for (let i = yil.length - 1; i >= 1; i--) {   // yumaklar
        const p = yil[i], x = p.x * K, y = p.y * K;
        kutuCiz(x + 3, y + 3, 10, 10, i % 2 ? "#f29bb5" : "#9bc6f2"); kutuCiz(x + 2, y + 5, 12, 6, i % 2 ? "#f29bb5" : "#9bc6f2");
        kutuCiz(x + 5, y + 5, 6, 1, "rgba(255,255,255,.55)"); kutuCiz(x + 4, y + 8, 8, 1, "rgba(255,255,255,.4)");
      }
      kafaCiz(yil[0].x * K, yil[0].y * K);
      if (durum !== "oyun") {
        c.fillStyle = "rgba(10,12,20,.55)"; c.fillRect(0, 0, cv.width, cv.height);
        c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "bold 22px 'Pixelify Sans', system-ui"; const m = cv.width / 2;
        c.fillText(durum === "bitti" ? "Sütlaç uyuyakaldı 💤" : durum === "dur" ? "Duraklatıldı" : "Sütlaç Koşusu", m, cv.height / 2 - 8);
        c.font = "13px 'Pixelify Sans', system-ui"; c.fillText(durum === "bitti" ? `${skor} fare · Boşluk: yeniden` : "Boşluk ya da tıkla: başla", m, cv.height / 2 + 16);
        c.textAlign = "left";
      }
    }
    function dongu(t) {
      if (!cv.isConnected) return; requestAnimationFrame(dongu);
      const dt = Math.min(100, t - (son || t)); son = t; kare++;
      if (durum === "oyun" && (!acik || cv.offsetParent === null)) durum = "dur";   // pencere küçüldü / bilgisayar kapandı
      if (durum === "oyun") { birik += dt; while (birik >= adimSure && durum === "oyun") { birik -= adimSure; adim(); } }
      ciz();
    }
    const basla = () => { if (durum === "bitti") sifirla(); durum = durum === "oyun" ? "dur" : "oyun"; birik = 0; cv.focus(); };
    cv.addEventListener("keydown", (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, Y_ = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[k];
      if (Y_) { e.preventDefault(); e.stopPropagation(); if (durum === "hazir" || durum === "dur") { durum = "oyun"; birik = 0; } if (durum === "oyun") yonVer(...Y_); }
      else if (k === " " || k === "p") { e.preventDefault(); e.stopPropagation(); basla(); }
    });
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); if (durum !== "oyun") basla(); else cv.focus(); });
    sifirla(); requestAnimationFrame(dongu); requestAnimationFrame(() => cv.focus());
    return kutu;
  }

  // ---------- Çok gizli klasör: soluk masaüstü simgesi, şifreli; içinde ekibin birbirine yazdığı komik notlar ----------
  let gizliAcik = false, gizliDeneme = 0;
  const GIZLI_SIFRE = ["sütlaç", "sutlac", "sütlac", "sutlaç"];
  function gizliCiz() {
    if (!gizliAcik) {
      const d = yap("div", "gizli-kilit"), inp = yap("input"), ip = yap("div", "ipucu", gizliDeneme ? "" : "Bu klasör şifreli. Yetkisiz erişim kayda geçer. (Geçmez.)");
      inp.type = "text"; inp.placeholder = "Şifre"; inp.autocomplete = "off"; inp.spellcheck = false;
      const dene = () => {
        if (GIZLI_SIFRE.includes(kucukHarf(inp.value.trim()))) { gizliAcik = true; ton([523, 659, 784, 1047], "triangle", 0.08, 0.05); icerikCiz("gizli"); return; }
        gizliDeneme++; ton([220, 196], "square", 0.08, 0.04); inp.value = "";
        ip.textContent = ["Yanlış şifre.", "Yanlış. İpucu: ofisin en tüylü çalışanı.", "Hâlâ yanlış. İpucu: beyaz, kısa tüylü, klavyeye çıkar, mama ister.", "Son ipucu: S _ _ _ _ Ç"][Math.min(3, gizliDeneme - 1)];
      };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); dene(); } });
      d.append(yap("div", "k", "🔒"), yap("b", "", "çok gizli"), ip, inp, dugme("Aç", dene, "k-dugme"));
      requestAnimationFrame(() => inp.focus());
      return d;
    }
    const aj = Object.values(AJANLAR).map((a) => a.ad), ad = (i) => aj[i % Math.max(1, aj.length)] || "Biri", ben = (window.OFIS_KISI && OFIS_KISI.ad) || "Sen", asistan = (AJANLAR.ada || {}).ad || ad(0);
    const notlar = [
      [`${ad(1)} → ${ad(2)}`, "Buzdolabındaki yoğurdu ben yemedim. Sütlaç yedi. Kanıtım yok ama yüzünden belli."],
      [`${asistan} → ${ben}`, "Gece \"son bir şey\" dediğinde saymaya başladım. Dün 14 oldu. Bugün rekor denemesi mi?"],
      [`${ad(3)} → herkes`, "Yazıcı yine kâğıt yedi. Adını \"Kâğıt Canavarı\" koydum, artık resmi kayıtlarda böyle geçecek."],
      [`${ad(2)} → ${ad(4)}`, "Toplantı \"kısa\" olacaktı. Takvimden \"kısa\" kelimesini yasaklama önergesi veriyorum."],
      ["Sütlaç → herkes", "ffffffffffffff;;;;;;;jjjjk (çeviri: mama.)"],
      [`${ad(4)} → ${ad(1)}`, "Kahve makinesi benden hoşlanmıyor. Sana iki şeker veriyor, bana yalnız sıcak su."],
      ["Gizli toplantı tutanağı", "Gündem 1: Sütlaç'a ofis kartı çıkarılsın mı? Oy birliğiyle kabul. Gündem 2: Kart kayboldu. Şüpheli belli, yüzü beyaz."],
      [`${ad(5)} → ${asistan}`, `${ben} bugün kaç kez "bir bakayım" dedi? Ben 9 saydım, sen?`],
      [`${ben} için sürpriz planı`, "1) Pasta 2) Konfeti 3) Bu dosyayı okuduysan hiçbir şey görmedin. 🤫"],
    ];
    const l = yap("div", "liste ikili");
    notlar.forEach(([kim, metin], i) => { const n = yap("div", "gizli-not"); n.style.setProperty("--r", ((i * 37) % 5 - 2) * 0.6 + "deg"); n.append(yap("b", "", kim), document.createTextNode(metin)); l.append(n); });
    return [yap("div", "gun-bas", "ÇOK GİZLİ · ŞİRKET İÇİ YAZIŞMALAR"), l, bosMesaj("Bu klasörü okuduysan, hiçbir şey görmedin.")];
  }

  // ---------- ekran koruyucu: boşta kalınca (gece 25 sn, gündüz 3 dk) yüzen Sütlaç; herhangi bir tuş ya da hareket kapatır ----------
  let koruyucuEl = null, sonHareket = Date.now(), koruyucuZ = 0;
  const geceMi = () => { const h = new Date().getHours(); return h >= 2 && h < 5; };
  function ekranKoruyucu(ac_) {
    if (!ac_) { if (koruyucuEl) { koruyucuEl.remove(); koruyucuEl = null; } return; }
    if (koruyucuEl || !acik || masa.hidden) return;
    const gece = geceMi(), saat = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    koruyucuEl = yap("div", "bos-koruyucu"); const y = yap("div", "yuzen");
    y.append(yap("span", "b", gece ? "😴🐱" : "🐱"), yap("span", "", gece ? `Uyku vakti · ${saat}` : `BeyinOS · ${saat}`), yap("small", "", gece ? "Ada: \"Yarın da buradayım. Uyu.\"" : "bir tuşa bas ya da fareyi oynat"));
    koruyucuEl.append(y); cam.append(koruyucuEl);
    let x = 40, yy = 40, vx = 0.6, vy = 0.45;
    const adim = () => {
      if (!koruyucuEl) return; requestAnimationFrame(adim);
      const W = cam.clientWidth - y.offsetWidth, H = cam.clientHeight - y.offsetHeight;
      x += vx; yy += vy; if (x < 0 || x > W) { vx = -vx; x = Math.max(0, Math.min(W, x)); } if (yy < 0 || yy > H) { vy = -vy; yy = Math.max(0, Math.min(H, yy)); }
      y.style.transform = `translate(${Math.round(x)}px, ${Math.round(yy)}px)`;
    };
    requestAnimationFrame(adim);
  }
  function hareketVar() { sonHareket = Date.now(); if (koruyucuEl) ekranKoruyucu(false); }
  function koruyucuDenetle() { if (acik && !koruyucuEl && !masa.hidden && Date.now() - sonHareket > (geceMi() ? 25000 : 180000)) ekranKoruyucu(true); }
  // Gece 02:00-05:00 arası açılış: Ada uyumanı söyler (gecede bir kez), ekran koruyucu kısa süre sonra gelir
  function geceKontrol() {
    if (!geceMi()) return;
    const anahtar = "ofis-gece-uyari-" + new Date().toDateString(); let gosterildi = false;
    try { gosterildi = !!localStorage.getItem(anahtar); localStorage.setItem(anahtar, "1"); } catch (e) { /* yok */ }
    if (gosterildi) return;
    const asistan = (AJANLAR.ada || { ad: "Ada" }).ad, saat = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    setTimeout(() => bildir("🌙", asistan, `Saat ${saat}. Bu saatte bilgisayar mı? Uyuman lazım. Ekranı birazdan karartıyorum.`), 900);
    const ic = I(), a = ic && ic.bul("ada"); if (a && !a.disarda) ic.konus(a, "Uyuman lazım. 🌙", true);
    setTimeout(() => { if (acik) ekranKoruyucu(true); }, 10000);
  }

  // ---------- Sütlaç klavyede: bilgisayar açıkken ara sıra oyuncunun klavyesine çıkar (sutlac.js > kediOyuncuKlavye) ve yazar ----------
  let patiEl = null, patiMetin = "", patiZ = 0, patiDenetimZ = 0, patiSon = 0;
  const kediKlavyede = () => { const ic = I(), k = ic && ic.kedi; return !!(k && k.durum === "klavye" && k.klavyeAjan && k.klavyeAjan.oyuncu); };
  function patiDenetle() {
    if (!acik || masa.hidden) return;
    if (kediKlavyede()) return patiYaz();
    if (patiEl) patiBitir(false);
    if (Date.now() - patiSon > 150000 && !koruyucuEl && Math.random() < 0.1) { patiSon = Date.now(); I().MOD("kediOyuncuKlavye", MASA); }
  }
  function patiYaz() {
    if (!patiEl) {
      patiMetin = ""; patiEl = yap("div", "bos-pati"); const y = yap("div", "y");
      y.append(yap("b", "", "🐾 Sütlaç klavyenin üstünde"), yap("code", "", ""));
      patiEl.append(yap("span", "", "🐱"), y, dugme("Sev ve indir", () => { const ic = I(); ic.MOD("klavyedenIn", false); ic.kedi.balon = "Mrrr ♥ (indirildi)"; ic.kedi.balonSon = ic.zaman + 3; ic.kalpler(ic.kedi, 3); patiBitir(true); }, "k-dugme"));
      cam.append(patiEl); clearInterval(patiZ);
      patiZ = setInterval(() => {
        if (!kediKlavyede() || !acik) return patiBitir(false);
        const parca = "jjjjkkkkfffff;;;;;ççççöööggggg     ".charAt(Math.floor(Math.random() * 34)).repeat(1 + Math.floor(Math.random() * 3));
        patiMetin = (patiMetin + parca).slice(-80); const kod = patiEl && patiEl.querySelector("code"); if (kod) kod.textContent = patiMetin;
        const p = uygulama && icAl(uygulama), alan = p && p.querySelector("textarea, .term-gir input, .arac input[type=search]");   // öndeki penceredeki yazı alanına da yazar (göndermez)
        if (alan && alan.value.length < 400) { alan.value += parca; alan.dispatchEvent(new Event("input")); }
        sesTik();
      }, 260);
    }
  }
  function patiBitir(sevildi) {
    clearInterval(patiZ); if (patiEl) { patiEl.remove(); patiEl = null; }
    if (!sevildi && patiMetin && acik) bildir("🐾", "Sütlaç", `Klavyeden indi. Bıraktığı not: "${patiMetin.trim().slice(-24)}"`);
    patiMetin = "";
  }

  // ---------- Mesajlar ----------
  const kisiVeri = (id) => (mesajlar[id] = mesajlar[id] || { oturum: "", liste: [], okunmadi: 0 });
  function mesajlarCiz() {
    const duzen = yap("div", "mesaj-duzen"), kisiler = yap("div", "kisiler");
    for (const [id, a] of Object.entries(AJANLAR)) {
      const b = dugme("", () => { aktifKisi = id; kisiVeri(id).okunmadi = 0; icerikCiz(); masaustuCiz(); }, "kisi" + (id === aktifKisi ? " secili" : ""));
      const t = yap("div"); t.append(yap("div", "k-ad", a.ad), yap("div", "k-rol", a.rol)); b.append(portre(id, 30), t);
      if ((mesajlar[id] || {}).okunmadi) b.append(yap("span", "nokta"));
      kisiler.append(b);
    }
    const a = AJANLAR[aktifKisi] || AJANLAR.ada, m = kisiVeri(aktifKisi);
    const sohbet = yap("div", "sohbet"), akis = yap("div", "akış");
    if (!m.liste.length) akis.append(yap("div", "bos-bos", `${ek(a.ad, "a")} yaz: soru sor, fikir, görev ya da hedef kaydettir.${ayar.dogrudan ? " Kayıtlar doğrudan yazılır." : " Kayıtlar onayına gelir."}`));
    for (const x of m.liste) akis.append(...mesajEl(aktifKisi, x));
    const durum = yap("div", "durum-satir", sure === aktifKisi ? `${a.ad} yazıyor…` : sure ? `${AJANLAR[sure].ad} başka bir mesajı cevaplıyor…` : "");
    const hizli = yap("div", "hizli arac");
    for (const [et, on] of [["💡 Fikir", "Şu fikri kaydet: "], ["🎯 Hedef", "Yeni hedef kaydet: "], ["✅ Görev", "Görev ekle: "], ["📝 Not", "Not al: "], ["❓ Soru", ""]])
      hizli.append(dugme(et, () => { giris.value = on; giris.focus(); }));
    const yaz = yap("div", "yaz"), giris = yap("textarea"); giris.placeholder = `${ek(a.ad, "a")} mesaj… (Enter gönder, Shift+Enter yeni satır)`; giris.maxLength = 4000;
    const gonder = dugme("Gönder", () => gonderMesaj(giris.value)); gonder.disabled = !!sure || !ANAHTAR;
    giris.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); gonderMesaj(giris.value); } });
    yaz.append(giris, gonder);
    if (!ANAHTAR) durum.textContent = "Mesajlar yalnız Ofis kısayoluyla açınca çalışır.";
    sohbet.append(akis, durum, hizli, yaz); duzen.append(kisiler, sohbet);
    requestAnimationFrame(() => { akis.scrollTop = akis.scrollHeight; if (!sure) giris.focus(); });
    return duzen;
  }
  function mesajEl(id, x) {
    const el = [], d = yap("div", "msj" + (x.kim === "ben" ? " ben" : "")), b = yap("div", "balon");
    b.innerHTML = bicimle(x.metin || (x.kim === "ben" ? "" : "…"));
    d.append(portre(x.kim === "ben" ? "oyuncu" : id, 26), b); el.push(d);
    for (const k of x.kayitlar || []) el.push(kayitEl(k));
    return el;
  }
  const TUR_AD = { not: "Not", gorev: "Görev", ekle: "Nota ekleme" };
  function kayitEl(k) {
    if (k.kaydedildi) return yap("div", "kayit", `✔ Kaydedildi · ${k.kaydedildi}`);
    if (k.gecersiz) return yap("div", "kayit uyari", `Kayıt yapılamadı: ${k.gecersiz}`);
    if (k.sonuc) return yap("div", "kayit" + (k.sonuc.startsWith("✖") || k.sonuc.startsWith("Olmadı") ? " uyari" : ""), k.sonuc);
    if (k.kritik) return yap("div", "kayit uyari", `⚠ ${k.kritik}: onay için sohbet penceresini aç.`);
    const d = yap("div", "kayit"); d.append(yap("b", "", `${TUR_AD[k.tur] || "Kayıt"} önerisi · `), yap("code", "", k.yol || ""));
    if (k.baslik) d.append(yap("div", "", k.baslik));
    d.append(yap("pre", "", k.metin || ""));
    const od = yap("div", "od"), evet = dugme("Onayla, kaydet", () => karar("evet"), "k-dugme"), hayir = dugme("Vazgeç", () => karar("hayir"), "k-dugme");
    async function karar(kr) {
      evet.disabled = hayir.disabled = true;
      try { const r = await api("/api/onay", { jeton: k.jeton, karar: kr }), j = await r.json(); k.sonuc = r.ok ? (kr === "evet" ? "✔ " : "✖ ") + j.metin : "Olmadı: " + (j.hata || r.status); if (r.ok && kr === "evet") kayitOldu(aktifKisi, k); }
      catch (e) { k.sonuc = "Olmadı: sunucuya ulaşılamadı."; }
      delete k.jeton; mesajKaydet(); if (pencereler.has("mesajlar")) icerikCiz("mesajlar");
    }
    od.append(evet, hayir); d.append(od);
    return d;
  }
  async function gonderMesaj(metin) {
    metin = String(metin || "").trim(); const id = aktifKisi, a = AJANLAR[id]; if (!metin || sure || !ANAHTAR) return;
    const m = kisiVeri(id), ben = { kim: "ben", metin }, cevap = { kim: id, metin: "", kayitlar: [] };
    m.liste.push(ben, cevap); sure = id; sesTik(); icerikCiz();
    const ic = I(), aj = ic && ic.bul(id); if (aj && !aj.disarda) { ic.konus(aj, "💭 Mesaj geldi…", true); }
    let tercih = { model: "haiku", efor: "medium" }; try { Object.assign(tercih, JSON.parse(localStorage.getItem("ofis-sohbet-2") || "{}")); } catch (e) { /* yok */ }
    let bitti = null, hata = null;
    try {
      const r = await fetch("/api/sor", { method: "POST", headers: { "X-Ofis-Anahtar": ANAHTAR, "Content-Type": "application/json" },
        body: JSON.stringify({ soru: metin, ajan: id, oturum: m.oturum, model: tercih.model, efor: tercih.efor, kaynak: "os" }) });
      if (!r.ok) throw new Error("sunucu " + r.status);
      const okur = r.body.getReader(), coz = new TextDecoder(); let tampon = "";
      for (;;) {
        const { value, done } = await okur.read(); if (done) break;
        tampon += coz.decode(value, { stream: true }); let i;
        while ((i = tampon.indexOf("\n")) >= 0) {
          const s = tampon.slice(0, i); tampon = tampon.slice(i + 1); if (!s.trim()) continue;
          const d = JSON.parse(s);
          if (d.tur === "metin") { cevap.metin += d.parca; canliGuncelle(id, cevap); }
          else if (d.tur === "arac") durumYaz(id, (d.ad === "Read" ? "📄 Okuyor: " : "🔍 Arıyor: ") + d.hedef);
          else if (d.tur === "bitti") bitti = d; else if (d.tur === "hata") hata = d;
        }
      }
    } catch (e) { hata = { metin: "Sunucuya ulaşılamadı. Ofis penceresi açık mı?" }; }
    sure = null;
    if (bitti) {
      const kayitli = (bitti.oneriler || []).some((o) => o.kaydedildi), oneri = (bitti.oneriler || []).some((o) => o.jeton);
      m.oturum = bitti.oturum || m.oturum; cevap.metin = bitti.metin || cevap.metin || (kayitli ? "Kaydettim 👍" : oneri ? "Kaydı hazırladım, onayına bıraktım." : "(boş cevap)");
      for (const o of bitti.oneriler || []) { cevap.kayitlar.push(o); if (o.kaydedildi) kayitOldu(id, o); }
      for (const k of bitti.kritik || []) cevap.kayitlar.push({ kritik: k.neden || "kritik iş" });
      if (aj && !aj.disarda && !kayitli) ic.konus(aj, oneri ? "📨 Kaydı onayına yolladım." : "📨 Cevabı yazdım.", true);
    } else cevap.metin = "⚠ " + ((hata && hata.metin) || "Cevap gelmedi.");
    if (hata && hata.oturum) m.oturum = hata.oturum;
    const okuyor = acik && aktifKisi === id && uygulama === "mesajlar" && !!icAl("mesajlar");
    if (!okuyor) { m.okunmadi = (m.okunmadi || 0) + 1; bildir("💬", a.ad, ozetle(cevap.metin), () => { aktifKisi = id; uygulamaAc("mesajlar"); }); } else sesBildirim();
    mesajKaydet();
    if (acik && pencereler.has("mesajlar")) icerikCiz("mesajlar"); if (acik) masaustuCiz();
  }
  function canliGuncelle(id, cevap) {
    const k = icAl("mesajlar"); if (!acik || !k || aktifKisi !== id) return;
    const balonlar = k.querySelectorAll(".msj:not(.ben) .balon"), b = balonlar[balonlar.length - 1]; if (b) b.innerHTML = bicimle(cevap.metin);
    const akis = k.querySelector(".akış"); if (akis) akis.scrollTop = akis.scrollHeight;
  }
  function durumYaz(id, t) { const k = icAl("mesajlar"); if (acik && k && aktifKisi === id) { const d = k.querySelector(".durum-satir"); if (d) d.textContent = t; } }
  // Kayıt olunca: XP uçar, veri yenilenir, ajan kâğıdı oyuncunun masasına getirir (müsaitse)
  function kayitOldu(id, k) {
    I() && I().ses("gorev"); xpUcur(k.tur === "gorev" ? "+20 XP" : "+10 XP");
    bildir("✅", "Kaydedildi", k.kaydedildi || k.yol || k.baslik || "kayıt", k.tur === "gorev" ? () => uygulamaAc("isler") : null);
    if (I() && I().gunluk) I().gunluk(`${(AJANLAR[id] || {}).ad} bilgisayardan gelen mesajla kaydetti: ${k.kaydedildi || k.yol}`);
    setTimeout(() => yenile(true), 400);
    const ic = I(), a = ic && ic.bul(id);
    if (!a || a.disarda || a.konusuyor || a.ozel || ic.mesgul(a) || !ic.yerinde(a)) return;
    a.ozel = "gorev"; ic.konus(a, "📄 Kaydettim, getiriyorum.", true);
    ic.gonder(a, ic.ziyaretNoktasi(ic.oyuncu), () => {
      ic.yonBak(a, ic.oyuncu); ic.konus(a, `Masana bıraktım: ${k.baslik || "kayıt"}`, true); ic.kalpler(a, 1);
      ic.sonra(2.4, () => ic.eveDon(a, () => (a.ozel = null)));
    });
  }
  function xpUcur(t) {
    if (!acik) return; const d = yap("div", "xp-ucan", t), r = cam.getBoundingClientRect();
    d.style.left = r.width / 2 - 30 + "px"; d.style.top = r.height / 2 + "px"; cam.append(d); setTimeout(() => d.remove(), 1500);
  }

  // ---------- arama (Ctrl+Space): uygulamalar + yüklü veri (hedef, iş, fikir, proje, yaptıklarım, posta); sunucuya gitmez ----------
  let araSonuc = [], araSecim = 0;
  const kucukHarf = (t) => String(t || "").toLocaleLowerCase("tr");
  function araKur() {
    araEl = yap("div", "bos-ara"); araEl.hidden = true;
    const kutu = yap("div", "ara-kutu"); araGiris = yap("input"); araGiris.type = "search"; araGiris.placeholder = "Ara: uygulama, hedef, iş, fikir, proje, posta…"; araGiris.setAttribute("aria-label", "Ara");
    araListe = yap("div", "ara-liste"); kutu.append(araGiris, araListe, yap("div", "ara-ipucu", "↑↓ seç · Enter aç · Esc kapat"));
    araEl.append(kutu);
    araEl.addEventListener("pointerdown", (e) => { if (e.target === araEl) araKapat(); });
    araGiris.addEventListener("input", araDoldur);
    araGiris.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); if (araSonuc.length) { araSecim = (araSecim + (e.key === "ArrowDown" ? 1 : araSonuc.length - 1)) % araSonuc.length; araSecimGoster(); } }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); araCalistir(araSonuc[araSecim]); }
    });
  }
  function araAc(q = "") { if (!acik || masa.hidden) return; merkezEl.hidden = true; araEl.hidden = false; araGiris.value = q; araDoldur(); requestAnimationFrame(() => araGiris.focus()); }
  function araKapat() { if (araEl) araEl.hidden = true; }
  function araCalistir(s) { if (!s) return; araKapat(); s.fn(); }
  function araDoldur() {
    const ham = araGiris.value.trim(), q = kucukHarf(ham), sonuc = [];
    const ekle = (grup, ikon, baslik, alt, metin, fn) => {
      const b = kucukHarf(baslik);
      if (q && !b.includes(q) && !kucukHarf(metin).includes(q)) return;
      sonuc.push({ grup, ikon, baslik, alt, fn, puan: !q || b.startsWith(q) ? 0 : b.includes(q) ? 1 : 2 });
    };
    for (const u of UYG) if (!u.gizli || q.includes("gizli")) ekle("Uygulamalar", u.ikon, u.ad, "", "", () => uygulamaAc(u.id));
    if (veri && q) {
      for (const h of veri.hedefler) ekle("Hedefler", "🎯", h.baslik, h.olcut || (h.son ? "son: " + tarihYaz(h.son) : ""), (h.olcut || "") + " " + (h.ilerleme || []).join(" "), () => uygulamaAc("hedefler"));
      for (const i of veri.isler) ekle("İşler", i.gecikti ? "⚠️" : "✅", i.baslik, [i.proje, i.son && tarihYaz(i.son)].filter(Boolean).join(" · "), (i.ozet || "") + " " + (i.proje || ""), () => { isFiltre = "hepsi"; uygulamaAc("isler"); icerikCiz("isler"); });
      for (const i of veri.bitenler) ekle("İşler", "✔️", i.baslik, ["bitti", i.proje].filter(Boolean).join(" · "), i.proje || "", () => { isFiltre = "biten"; uygulamaAc("isler"); icerikCiz("isler"); });
      for (const f of veri.fikirler) ekle("Fikirler", "💡", f.baslik, f.ozet || "", f.ozet || "", () => { fikirAra = ham; uygulamaAc("fikirler"); icerikCiz("fikirler"); });
      for (const p of veri.projeler) ekle("Projeler", "📁", p.ad, p.ozet || "", (p.ozet || "") + " " + (p.klasor || ""), () => uygulamaAc("projeler"));
      for (const y of veri.yapilanlar) ekle("Yaptıklarım", "🏆", y.etiket || "oturum", [tarihYaz(y.tarih), y.ozet].filter(Boolean).join(" · "), y.ozet || "", () => uygulamaAc("yapilanlar"));
      for (const b of (veri.posta && veri.posta.bolumler) || []) for (const m of b.maddeler || []) ekle("Posta", "✉️", m, b.baslik, "", () => uygulamaAc("posta"));
    }
    const gruplar = [];
    for (const s of sonuc) { let g = gruplar.find((x) => x.ad === s.grup); if (!g) gruplar.push((g = { ad: s.grup, l: [] })); g.l.push(s); }
    araSonuc = [];
    for (const g of gruplar) { g.l.sort((a, b) => a.puan - b.puan); araSonuc.push(...g.l.slice(0, q ? 6 : 9)); }
    if (ham) { const ada = (AJANLAR.ada || { ad: "Ada" }).ad; araSonuc.push({ grup: "Ekip", ikon: "💬", baslik: `${ek(ada, "a")} sor: “${ham}”`, alt: "Mesajlar'da cevaplar", fn: () => { mesajaGit("ada", ham); if (ANAHTAR && !sure) gonderMesaj(ham); } }); }
    araSecim = 0; araCiz();
  }
  function araCiz() {
    const parca = []; let grup = "";
    araSonuc.forEach((s, i) => {
      if (s.grup !== grup) { grup = s.grup; parca.push(yap("div", "ara-grup", grup)); }
      const b = dugme("", () => araCalistir(s), "ara-oge" + (i === araSecim ? " secili" : "")); b.dataset.i = i;
      const t = yap("span"); t.append(yap("span", "", s.baslik)); if (s.alt) t.append(yap("span", "am", s.alt));
      b.append(yap("span", "ai", s.ikon), t); b.onmouseenter = () => { araSecim = i; araSecimGoster(); };
      parca.push(b);
    });
    if (!araSonuc.length) parca.push(yap("div", "bos-bos", "Sonuç yok."));
    araListe.replaceChildren(...parca);
  }
  function araSecimGoster() {
    araListe.querySelectorAll(".ara-oge").forEach((b) => b.classList.toggle("secili", +b.dataset.i === araSecim));
    const s = araListe.querySelector(".ara-oge.secili"); if (s) s.scrollIntoView({ block: "nearest" });
  }

  // ---------- bildirimler: sağ üstten kayan baloncuk + zil menüsü (son 20; bu oturumla sınırlı) ----------
  const ozetle = (t) => { const d = String(t || "").replace(/[*`#>]/g, "").replace(/\s+/g, " ").trim(); return d.length > 110 ? d.slice(0, 109) + "…" : d; };
  function bildir(ikon, baslik, metin, fn) {
    bildirimler.unshift({ ikon, baslik, metin, fn, zaman: Date.now() }); bildirimler.length = Math.min(bildirimler.length, 20);
    bildirimSay++; sesBildirim();
    if (!acik || !bildirimEl || masa.hidden) return;
    cubukCiz();
    const t = toastEl(bildirimler[0], true); bildirimEl.prepend(t);
    while (bildirimEl.children.length > 3) bildirimEl.lastChild.remove();
    setTimeout(() => toastGit(t), 5200);
  }
  function toastEl(b, kayan) {
    const t = yap("div", "bos-toast" + (kayan ? "" : " sabit")), g = yap("div");
    g.append(yap("b", "", b.baslik), yap("span", "", b.metin || ""));
    if (!kayan) g.append(yap("span", "zaman", new Date(b.zaman).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })));
    t.append(yap("span", "ti", b.ikon), g);
    t.onclick = (e) => { e.stopPropagation(); if (kayan) toastGit(t); else merkezEl.hidden = true; if (b.fn) b.fn(); };
    return t;
  }
  function toastGit(t) { if (!t.isConnected || t.classList.contains("gidiyor")) return; t.classList.add("gidiyor"); setTimeout(() => t.remove(), 260); }
  function merkezAcKapa() {
    if (!merkezEl.hidden) { merkezEl.hidden = true; return; }
    bildirimSay = 0; cubukCiz();
    const bas = yap("div", "m-bas"); bas.append(yap("b", "", "Bildirimler"), yap("span", "bosluk"), dugme("Temizle", () => { bildirimler.length = 0; merkezEl.hidden = true; }, "k-dugme"));
    const liste = bildirimler.length ? bildirimler.map((b) => toastEl(b, false)) : [yap("div", "bos-bos", "Yeni bildirim yok.")];
    merkezEl.replaceChildren(bas, ...liste, dugme("✉️ Posta özetini aç", () => { merkezEl.hidden = true; uygulamaAc("posta"); }, "k-dugme genis"));
    merkezEl.hidden = false;
  }

  // ---------- açılış / kapanış ----------
  let acilisZ = [], acilisBitir = null;
  function acilisAtla() { if (acilisBitir) acilisBitir(); }
  function acilisOynat(kisa) {
    return new Promise((bitti) => {
      acilisEl.hidden = false; masa.hidden = true; cubuk.hidden = true; acilisEl.replaceChildren();
      const s = S(), K = window.OFIS_KISI || {}, ekip = Object.keys(AJANLAR).length;
      const logo = yap("div", "logo", "▣ BeyinOS"); acilisEl.append(logo);
      const satirlar = kisa ? ["Oturum açılıyor…"] : [
        `BEYİN BIOS v1.0 · ${K.ofis || "Ofis"} · ${new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`, "",
        `Hafıza denetimi ........ ${s.oturum ?? "?"} oturum kartı      OK`,
        `Görev sürücüsü ......... ${s.acik ?? "?"} açık / ${s.biten ?? "?"} biten   OK`,
        `Hedef modülü ........... ${s.hedef ?? "?"} aktif hedef        OK`,
        `Fikir deposu ........... ${s.fikir ?? "?"} fikir              OK`,
        `Posta kuyruğu .......... ${veri && veri.posta && veri.posta.var ? (s.posta || 0) + " madde" : "özet yok"}`,
        `Ekip ağı ............... ${ekip} çalışan çevrimiçi`, "", "BeyinOS başlatılıyor"];
      const pre = yap("div"); acilisEl.append(pre); const imlec = yap("span", "imlec");
      let i = 0, bitmis = false;
      acilisBitir = () => { if (bitmis) return; bitmis = true; acilisZ.forEach(clearTimeout); acilisZ = []; acilisBitir = null; acilisEl.hidden = true; bitti(); };
      const adim = () => { if (bitmis) return; if (i < satirlar.length) { pre.append(document.createTextNode(satirlar[i++] + "\n")); pre.append(imlec); sesTik(); acilisZ.push(setTimeout(adim, kisa ? 120 : 125)); } else acilisZ.push(setTimeout(acilisBitir, kisa ? 260 : 650)); };
      acilisZ.push(setTimeout(adim, kisa ? 120 : 380));
      acilisEl.onclick = acilisAtla;
    });
  }
  function kaynakNokta() {   // ekranın, oyuncunun masasındaki monitörden büyümesi için dönüşüm merkezi
    const ic = I(); if (!ic) return;
    const m = (ic.monitorler || []).find((x) => x.sahip === "oyuncu"); if (!m) return;
    const cv = ic.cv, r = cv.getBoundingClientRect(), sr = kok.getBoundingClientRect(), ek_ = kok.firstChild.getBoundingClientRect();
    const x = r.left + ic.ex(m.x + m.w / 2) / cv.width * r.width, y = r.top + ic.ey(m.y + m.h / 2) / cv.height * r.height;
    if (!isFinite(x) || !isFinite(y) || !sr.width) return;
    kok.firstChild.style.setProperty("--bx", (x - ek_.left) + "px"); kok.firstChild.style.setProperty("--by", (y - ek_.top) + "px");
  }
  async function ac(c = "pc") {
    if (document.body.classList.contains("uzak")) return;
    if (acik) { if (cihaz !== c && !kok.classList.contains("cikis")) kapat(() => ac(c)); return; }   // telefondan masadaki bilgisayara (ya da tersi) geçiş
    const ic = I(); if (!ic || (ic.diyalogAcik && ic.diyalogAcik())) return;
    acik = true; cihaz = c; kok.dataset.cihaz = c;
    if (c === "pc") {
      ic.tuslar.clear();
      const o = ic.oyuncu; o.yol = []; o.sonra = null; ic.yonBak(o, { x: MASA[0], y: MASA[1] - 2 }); o.yazSon = ic.zaman + 1e6;   // klavyede yazıyor
    }
    kok.hidden = false; kok.classList.remove("cikis"); if (c === "pc") kaynakNokta(); kok.classList.add("giris");
    if (c === "pc") { sesAcilis(); I().ses("tak"); } else sesTelefon();
    const veriSoz = yenile(false);
    if (c === "pc") { if (!acilisGosterildi) await veriSoz; await acilisOynat(acilisGosterildi); acilisGosterildi = true; }
    else { acilisEl.hidden = true; telDurumYaz(); clearInterval(konumZ); konumZ = setInterval(telDurumYaz, 700); }
    if (!acik) return;
    masa.hidden = false; cubuk.hidden = false; gorunumUygula(); masaustuCiz(); saatYaz(); clearInterval(saatZ); saatZ = setInterval(saatYaz, 15000);
    if (uygulama && !pencereler.has(uygulama)) uygulamaAc(uygulama);
    if (c === "pc") { geceKontrol(); hareketVar(); clearInterval(koruyucuZ); koruyucuZ = setInterval(() => { koruyucuDenetle(); patiDenetle(); }, 1000); }
    telUygYaz();
    if (!ilkBildirim && veri) {   // açılışta bir kez: geciken iş ve posta
      ilkBildirim = true; const s = S();
      if (s.gecikti) setTimeout(() => bildir("⚠️", "Geciken iş", `${s.gecikti} iş son tarihini geçti.`, () => { isFiltre = "hepsi"; uygulamaAc("isler"); icerikCiz("isler"); }), 700);
      if (veri.posta && veri.posta.var && s.posta) setTimeout(() => bildir("✉️", "Posta", `${s.posta} madde seni bekliyor.`, () => uygulamaAc("posta")), 1600);
    }
    if (c === "pc") (simgelerEl.firstChild || kok).focus && (simgelerEl.firstChild || kok).focus();   // telefonda odak oyunda kalır: yürümek için
  }
  function kapat(sonraFn) {
    if (!acik) return;
    acik = false; clearInterval(saatZ); clearInterval(koruyucuZ); clearInterval(konumZ); if (acilisBitir) acilisBitir(); araKapat(); if (merkezEl) merkezEl.hidden = true; ekranKoruyucu(false); patiBitir(true);
    const ic = I(); if (ic && ic.oyuncu) ic.oyuncu.yazSon = 0;
    if (cihaz === "pc") sesKapanis(); else ton([1175, 880], "sine", 0.05, 0.035);
    kok.classList.remove("giris"); kok.classList.add("cikis");
    setTimeout(() => { kok.hidden = true; kok.classList.remove("cikis"); if (ic && ic.cv) ic.cv.focus(); if (sonraFn) sonraFn(); }, cihaz === "pc" ? 330 : 250);
  }
  // ---------- telefon: durum çubuğu (saat, konum), ana ekran çizgisi ----------
  const sesTelefon = () => ton([988, 1319, 1760], "sine", 0.06, 0.04);
  function odaAdi() {
    const ic = I(), o = ic && ic.oyuncu; if (!o || !ic.odaKaro) return "Ofis";
    const oda = ic.ODALAR && ic.ODALAR[ic.odaKaro(o.x, o.y)];
    const ad = (oda && (oda.ad || oda.id)) || "Koridor";
    return ad.toLocaleLowerCase("tr-TR").replace(/(^|\s)(\S)/g, (m, b, h) => b + h.toLocaleUpperCase("tr-TR"));   // "YÖNETİM" -> "Yönetim"
  }
  function telDurumYaz() {
    if (!acik || cihaz !== "telefon" || !telSaatEl) return;
    telSaatEl.textContent = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    const yer = odaAdi(); if (telYerEl.textContent !== yer) { telYerEl.textContent = yer; telYerEl.title = "Konum: " + yer; const k = yanEl && yanEl.querySelector(".w-konum b"); if (k) k.textContent = yer; }
  }
  function telUygYaz() { if (kok) kok.classList.toggle("tel-uyg", !!(uygulama && pencereler.has(uygulama) && !pencereler.get(uygulama).kucuk)); }
  function telEve() {   // ana ekran çizgisi: arama/bildirim menüsü açıksa kapatır, sonra öndeki uygulamayı, ana ekrandaysa telefonu
    if (!araEl.hidden) return araKapat();
    if (!merkezEl.hidden) { merkezEl.hidden = true; return; }
    const o = ondeki(); if (o) pencereKapat(o); else kapat();
  }
  function telefonAcKapa() { if (acik && cihaz === "telefon") kapat(); else if (!acik) ac("telefon"); }
  // Masaya git, sonra aç (E noktası masanın önünde; oyuncu sandalyeye geçer)
  function masayaGecVeAc() {
    const ic = I(), o = ic.oyuncu;
    if (Math.hypot(o.x - MASA[0], o.y - MASA[1]) < (o.oturak ? 1.6 : 0.6) || Math.hypot(o.x - MASA[0], o.y - (MASA[1] - 2)) < 1.2) return ac();   // masanın önündeki koltukta ya da kendi koltuğunda (masanın arkası) yürümeden aç
    ic.gonder(o, MASA, () => ac());
  }

  const MODUL = {
    basla() {
      kur();
      I().NESNELER.push({ x: MASA[0], y: MASA[1], r: 1.35, etiket: () => "💻 Bilgisayarı aç", fn: masayaGecVeAc, oturunca: true, oncelik: 0.6 });
      I().NESNELER.push({ x: MASA[0], y: MASA[1] - 2, r: 1.1, etiket: () => "💻 Bilgisayarı aç", fn: masayaGecVeAc, oturunca: true, oncelik: 0.8 });   // kendi koltuğunda (masanın arkası): "Otur" yerine bilgisayar   // oturunca "Kalk" yerine bu öner (kalkmak için yürü)
      if (ANAHTAR) { yenile(false); setInterval(() => { if (!acik) yenile(false); }, 5 * 60000); }
      const td = document.getElementById("telefonDugme"); if (td) td.onclick = (e) => { e.stopPropagation(); telefonAcKapa(); td.blur(); };   // dokunmatik / fare için
    },
    tus(e) {
      const telTusu = e.code === telTus && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!acik) { if (telTusu && !e.repeat && !document.body.classList.contains("uzak")) { e.preventDefault(); ac("telefon"); return true; } return undefined; }
      if (cihaz === "telefon") {
        if (telTusu) { e.preventDefault(); if (!e.repeat) kapat(); return true; }
        if (tusIsle(e)) { e.preventDefault(); return true; }
        return YURU.has(e.code) ? undefined : true;   // GTA gibi: telefon açıkken yürünür (yön tuşları / WASD, Z kamera); diğer oyun tuşları kapalı
      }
      if (tusIsle(e)) e.preventDefault();
      return true;   // bilgisayar açıkken oyun tuşları çalışmaz
    },
    ayarUygulandi(a) { if (a && typeof a.telefon === "string") telTus = a.telefon; const k = document.getElementById("telefonTusu"); if (k) k.textContent = telTus.replace(/^Key/, ""); },
    test: {
      bilgisayar: () => ({ acik, cihaz, telTus, uygulama, pencereler: [...pencereler.keys()], gorunum: { ...gorunum, tema_etkin: kok && kok.dataset.tema, gok: kok && kok.dataset.gok }, bildirim: bildirimler.length, veri: !!veri, sayilar: S(), ayar: { ...ayar }, seviye: seviye(), mesaj: Object.fromEntries(Object.entries(mesajlar).map(([k, v]) => [k, v.liste.length])), sure }),
      bilgisayarAc: () => ac(), bilgisayarKapat: () => kapat(), telefonAc: () => ac("telefon"), bilgisayarUyg: (id) => uygulamaAc(id), bilgisayarYenile: () => yenile(true),
      bilgisayarAra: (q) => { araAc(q || ""); return araSonuc.map((s) => s.grup + ": " + s.baslik); }, bilgisayarGorunum: (k, v) => gorunumAyarla(k, v),
      bilgisayarBildir: (b, m) => bildir("🔔", b || "Deneme", m || ""),
      bilgisayarKoruyucu: (a) => ekranKoruyucu(a !== false), bilgisayarPati: () => I().MOD("kediOyuncuKlavye", MASA), bilgisayarGece: () => { try { localStorage.removeItem("ofis-gece-uyari-" + new Date().toDateString()); } catch (e) { /* yok */ } const h = Date.prototype.getHours; Date.prototype.getHours = () => 3; try { geceKontrol(); } finally { Date.prototype.getHours = h; } },
      bilgisayarTerminal: (t) => { uygulamaAc("terminal"); return termGonder(t); },
      bilgisayarMesaj: (ajan, metin) => { aktifKisi = AJANLAR[ajan] ? ajan : "ada"; return gonderMesaj(metin); },
    },
  };
  window.OFIS_BILGISAYAR = { ac: () => masayaGecVeAc(), telefon: () => telefonAcKapa(), kapat: () => kapat(), acik: () => acik, cihaz: () => cihaz, uygulama: (id) => { if (!acik) { uygulama = id; masayaGecVeAc(); } else uygulamaAc(id); } };
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push(MODUL);
})();
