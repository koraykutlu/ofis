// Ofis sesleri: hepsi Web Audio ile sentezlenir, dosya yok. Tarayıcı kuralı gereği ilk tıklamada açılır.
window.SES = (() => {
  // Düğüm grafiği: efektler -> efektBus, ambiyans katmanları -> ambBus; ikisi ana (genel) -> sıkıştırıcı -> hoparlör.
  // Konumlu efekt: kazanç -> alçak geçiren (uzakta) -> StereoPanner -> efektBus. `hedef` o an çalınan sesin bağlandığı düğümdür.
  let ctx = null, ana = null, efektBus = null, ambBus = null, hedef = null, acik = false;
  const seviye = { genel: 1, ambiyans: 1, efekt: 1 };   // ayarlar paneli seviyeleri (1 = varsayılan)
  let odaId = null, taban = null, katmanlar = {}, uzakBus = null;

  function gurultu(sn) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sn, ctx.sampleRate), d = b.getChannelData(0);
    let son = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; son = (son + 0.02 * w) / 1.02; d[i] = son * 3.5; }
    return b;
  }
  function beyaz(sn) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sn, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  let beyazTampon = null;

  // Oda ambiyansı: her oda için hedef katman seviyeleri (taban = oda tonu çarpanı). Stüdyo sessiz ve yankısız.
  const ODA_SES = {
    studyo: { taban: 0.3, lofi: 1 },   // Atölye: lofi müzik (aşağıda kodla üretilir)
    mutfak: { taban: 0.8, buzdolabi: 1 },
    radar: { taban: 0.9, sunucu: 1 },
    yayin: { taban: 0.9, sunucu: 1 },
    merkez: { taban: 1, haber: 1 },
  };
  function odaUygula() {
    if (!ctx) return;
    const t = ctx.currentTime, h = ODA_SES[odaId] || {};
    taban.gain.setTargetAtTime(h.taban ?? 1, t, 0.6);
    for (const [ad, k] of Object.entries(katmanlar)) {   // oda değişince yumuşak geçiş
      let hedef = h[ad] || 0;
      if (ad === "lofi") hedef = muzikAcik ? (odakVar ? 1 : hedef) : 0;   // Ayarlar'dan kapalıysa susar; odak modunda her odada duyulur
      k.setTargetAtTime(hedef, t, 0.7);
    }
  }
  // Sürekli çalan ambiyans katmanı: kaynaklar -> kendi kazancı (0'dan başlar) -> ambBus
  function katman(kur) {
    const g = ctx.createGain(); g.gain.value = 0; kur(g); g.connect(ambBus); return g.gain;
  }

  function baslat() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const komp = ctx.createDynamicsCompressor(); komp.threshold.value = -14; komp.ratio.value = 4; komp.connect(ctx.destination);
    ana = ctx.createGain(); ana.gain.value = 0.9 * seviye.genel; ana.connect(komp);
    efektBus = ctx.createGain(); efektBus.gain.value = seviye.efekt; efektBus.connect(ana);
    ambBus = ctx.createGain(); ambBus.gain.value = seviye.ambiyans; ambBus.connect(ana);
    hedef = efektBus;
    beyazTampon = beyaz(1);
    // Oda tonu: alçak geçirgen kahverengi gürültü + çok hafif klima uğultusu (taban kazancıyla odaya göre kısılır)
    taban = ctx.createGain(); taban.gain.value = 1; taban.connect(ambBus);
    const kahverengi = gurultu(4);
    const n = ctx.createBufferSource(); n.buffer = kahverengi; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 520;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    n.connect(f).connect(ng).connect(taban); n.start();
    const h = ctx.createOscillator(); h.frequency.value = 58; const hg = ctx.createGain(); hg.gain.value = 0.006;
    h.connect(hg).connect(taban); h.start();
    // Mutfak: buzdolabı uğultusu (50/100 Hz + alçak gürültü, kompresör döngüsü gibi yavaş dalgalanma)
    katmanlar.buzdolabi = katman((g) => {
      const o1 = ctx.createOscillator(); o1.frequency.value = 50; const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = 101;
      const a1 = ctx.createGain(); a1.gain.value = 0.045; const a2 = ctx.createGain(); a2.gain.value = 0.012;
      const s = ctx.createBufferSource(); s.buffer = kahverengi; s.loop = true; const lf = ctx.createBiquadFilter(); lf.type = "lowpass"; lf.frequency.value = 180;
      const a3 = ctx.createGain(); a3.gain.value = 0.05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17; const lg = ctx.createGain(); lg.gain.value = 0.012; lfo.connect(lg).connect(a1.gain);
      o1.connect(a1).connect(g); o2.connect(a2).connect(g); s.connect(lf).connect(a3).connect(g); o1.start(); o2.start(); s.start(); lfo.start();
    });
    // Yayın ve radar odası: sunucu fanı (bantlı gürültü + pervane tonu)
    katmanlar.sunucu = katman((g) => {
      const s = ctx.createBufferSource(); s.buffer = beyaz(3); s.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 820; bp.Q.value = 0.6;
      const a1 = ctx.createGain(); a1.gain.value = 0.03;
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 118; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
      const a2 = ctx.createGain(); a2.gain.value = 0.016;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.4; const lg = ctx.createGain(); lg.gain.value = 1.2; lfo.connect(lg).connect(o.frequency);
      s.connect(bp).connect(a1).connect(g); o.connect(lp).connect(a2).connect(g); s.start(); o.start(); lfo.start();
    });
    // Haber merkezi: hafif ofis uğultusu (yavaş nefes alan) + uzaktan klavye sesi (uzakKlavye zamanlar)
    katmanlar.haber = katman((g) => {
      const s = ctx.createBufferSource(); s.buffer = kahverengi; s.loop = true; s.loopStart = 0.7;
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 330; bp.Q.value = 0.5;
      const a = ctx.createGain(); a.gain.value = 0.07;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.025; lfo.connect(lg).connect(a.gain);
      s.connect(bp).connect(a).connect(g); s.start(); lfo.start();
    });
    // Şömine (cozy mod): kısık alçak ateş uğultusu + rastgele çıtırtılar. Seviyeyi SES.somine(acik, mesafe) ayarlar (karakter yaklaştıkça artar).
    somineG = ctx.createGain(); somineG.gain.value = 0; somineG.connect(ambBus);
    {
      const s = ctx.createBufferSource(); s.buffer = kahverengi; s.loop = true; s.loopStart = 0.4;
      const lf = ctx.createBiquadFilter(); lf.type = "lowpass"; lf.frequency.value = 280;
      const a = ctx.createGain(); a.gain.value = 0.09;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35; const lg = ctx.createGain(); lg.gain.value = 0.035; lfo.connect(lg).connect(a.gain);
      s.connect(lf).connect(a).connect(somineG); s.start(); lfo.start();
    }
    somineUygula();
    setInterval(somineCitirti, 90);
    // Atölye lofi: katman kazancı oda geçişiyle gelir; notalar lofiAdim zamanlayıcısıyla bu düğüme programlanır
    katmanlar.lofi = katman((g) => { lofiG = g; });
    lofiSonra = ctx.currentTime; setInterval(lofiAdim, 250);
    uzakBus = ctx.createGain(); uzakBus.gain.value = 0.28;
    const uf = ctx.createBiquadFilter(); uf.type = "lowpass"; uf.frequency.value = 2200; uzakBus.connect(uf).connect(ambBus);
    setInterval(uzakKlavye, 480);
    odaUygula();
  }
  // ---- şömine çıtırtısı
  let somineG = null, somineSeviye = 0;
  function somineUygula() { if (somineG) somineG.gain.setTargetAtTime(somineSeviye, ctx.currentTime, 0.6); }
  function somineCitirti() {
    if (!ctx || !acik || somineSeviye < 0.03 || Math.random() > 0.4) return;
    const t = ctx.currentTime, kuvvet = 0.35 + Math.random() * 0.65;
    tikirti(t, 700 + Math.random() * 2600, 0.045 * kuvvet, 0.012, somineG);
    if (Math.random() < 0.18) for (let i = 1; i <= 2 + Math.floor(Math.random() * 3); i++) tikirti(t + i * 0.035, 900 + Math.random() * 2200, 0.035 * kuvvet, 0.01, somineG);
  }
  // ---- Atölye müziği (kodla üretilir). Tarzlar: lofi (Cmaj7-Am7-Dm7-G7, 70 bpm), caz (ii-V-I-VI, 92 bpm, fırça), piyano (yavaş, davulsuz).
  // Ayarlar'dan açılıp kapatılır (SES.muzik) ve tarz seçilir; odak modunda her odada çalar (SES.odakMuzigi).
  let lofiG = null, lofiSonra = 0, lofiSayac = 0, muzikAcik = true, muzikTarz = "lofi", odakVar = false, somineAcik = true, somineIstek = { acik: false, mesafe: 0 };
  const MUZIK = {
    lofi: { bpm: 70, akor: [[[60, 64, 67, 71], 36], [[57, 60, 64, 67], 33], [[62, 65, 69, 72], 38], [[55, 59, 62, 65], 31]], tonlar: [["sine", 0, 0.034], ["triangle", 6, 0.018]], lp: 1500, sure: 2.4, kick: true, sapka: 7500, plak: 6 },
    caz: { bpm: 92, akor: [[[65, 69, 72, 76], 38], [[59, 64, 65, 69], 31], [[64, 67, 71, 74], 36], [[67, 70, 73, 76], 33]], tonlar: [["triangle", 0, 0.03], ["sine", 4, 0.022]], lp: 2300, sure: 1.7, kick: false, sapka: 5500, plak: 2 },
    piyano: { bpm: 56, akor: [[[65, 69, 72, 76], 29], [[64, 67, 71, 74], 28], [[62, 65, 69, 72], 26], [[60, 64, 67, 71], 24]], tonlar: [["sine", 0, 0.04], ["triangle", 3, 0.012]], lp: 1900, sure: 3.4, kick: false, sapka: 0, plak: 0 },
  };
  const frekMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function lofiAkor(t0, sira) {
    const T = MUZIK[muzikTarz] || MUZIK.lofi, [notalar, bas] = T.akor[sira % T.akor.length], vuru = 60 / T.bpm;
    notalar.forEach((m, j) => {
      const tn = t0 + j * 0.045 + Math.random() * 0.012;                      // hafif arpej: akor elle çalınmış gibi
      for (const [tip, kay, ses] of T.tonlar) {
        const o = ctx.createOscillator(); o.type = tip; o.frequency.value = frekMidi(m); o.detune.value = kay + (Math.random() - 0.5) * 5;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = T.lp; o.connect(lp);
        zarf(lp, tn, 0.012, 0.15, T.sure, ses, lofiG); o.start(tn); o.stop(tn + T.sure + 0.5);
      }
    });
    for (const k of [0, 2.5]) {                                               // bas: 1. vuruş ve 3. vuruşun yarımı
      const tb = t0 + k * vuru, o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = frekMidi(bas);
      zarf(o, tb, 0.01, 0.2, 0.9, 0.085, lofiG); o.start(tb); o.stop(tb + 1.3);
    }
    if (T.sapka) for (let i = 0; i < 8; i++) if (i % 2 === 1 || Math.random() < 0.2) tikirti(t0 + i * vuru / 2 + (i % 2 ? 0.03 : 0), T.sapka, 0.012 + Math.random() * 0.006, 0.02, lofiG);   // şapka / fırça (swing'li)
    if (T.kick && sira % 2 === 0) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14); zarf(o, t0, 0.002, 0.03, 0.14, 0.09, lofiG); o.start(t0); o.stop(t0 + 0.25); }   // hafif kick
    for (let i = 0; i < T.plak; i++) tikirti(t0 + Math.random() * 4 * vuru, 3200 + Math.random() * 2500, 0.006, 0.004, lofiG);   // plak çıtırtısı
  }
  function lofiAdim() {
    if (!ctx || !acik || !lofiG) return;
    const simdi = ctx.currentTime;
    if (!muzikAcik || (odaId !== "studyo" && !odakVar)) { lofiSonra = Math.max(lofiSonra, simdi); return; }   // yalnız Atölye'de (ya da odak modunda) ve açıkken programlanır
    if (lofiSonra < simdi) lofiSonra = simdi + 0.05;
    const T = MUZIK[muzikTarz] || MUZIK.lofi;
    while (lofiSonra < simdi + 0.7) { lofiAkor(lofiSonra, lofiSayac++); lofiSonra += 4 * 60 / T.bpm; }
  }
  function uzakKlavye() {
    if (!ctx || !acik || odaId !== "merkez" || Math.random() < 0.45) return;
    const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) tikirti(t + i * (0.07 + Math.random() * 0.1), 2000 + Math.random() * 1400, 0.06 + Math.random() * 0.04, 0.025, uzakBus);
  }

  function zarf(dugum, t0, atak, kalis, sonum, tepe, cikis) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(tepe, t0 + atak);
    g.gain.setValueAtTime(tepe, t0 + atak + kalis);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + atak + kalis + sonum);
    dugum.connect(g); g.connect(cikis || hedef); return g;
  }
  function tikirti(t0, frek, ses, sure = 0.025, cikis) {
    const s = ctx.createBufferSource(); s.buffer = beyazTampon;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = frek; f.Q.value = 3;
    s.connect(f); zarf(f, t0, 0.001, 0.004, sure, ses, cikis); s.start(t0, Math.random() * 0.5, sure + 0.02);
  }
  function ton(t0, frek, tip, sure, ses, bitis) {
    const o = ctx.createOscillator(); o.type = tip; o.frequency.setValueAtTime(frek, t0);
    if (bitis) o.frequency.exponentialRampToValueAtTime(bitis, t0 + sure);
    zarf(o, t0, 0.005, sure * 0.4, sure * 0.6, ses); o.start(t0); o.stop(t0 + sure + 0.05);
  }

  function kayma(f0, f1, sure, ses) {
    const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = beyazTampon;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + sure);
    s.connect(f); zarf(f, t, 0.06, sure * 0.5, sure * 0.5, ses); s.start(t, 0, sure + 0.1);
  }
  const calgilar = {
    klavye(yogunluk = 1) {
      const t = ctx.currentTime, n = 2 + Math.floor(Math.random() * 4 * yogunluk);
      for (let i = 0; i < n; i++) tikirti(t + i * (0.06 + Math.random() * 0.09), 2400 + Math.random() * 1800, 0.05 + Math.random() * 0.03);
    },
    adim() { tikirti(ctx.currentTime, 380 + Math.random() * 120, 0.07, 0.04); },
    konus(perde = 1) {
      const t = ctx.currentTime, n = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) ton(t + i * 0.075, (330 + Math.random() * 160) * perde, "square", 0.05, 0.022);
    },
    telefon() {
      const t = ctx.currentTime;
      for (let k = 0; k < 2; k++) for (let i = 0; i < 12; i++) {
        ton(t + k * 1.1 + i * 0.05, 1240, "sine", 0.04, 0.05); ton(t + k * 1.1 + i * 0.05 + 0.025, 1550, "sine", 0.03, 0.04);
      }
    },
    yazici() {
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 95 + i * 6;
        const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.4;
        o.connect(f); zarf(f, t + i * 0.55, 0.03, 0.38, 0.08, 0.06); o.start(t + i * 0.55); o.stop(t + i * 0.55 + 0.6);
        tikirti(t + i * 0.55 + 0.45, 1400, 0.06, 0.03);
      }
    },
    kahve() {
      const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = gurultu(3);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
      s.connect(f); zarf(f, t, 0.3, 1.6, 0.6, 0.11); s.start(t);
      for (let i = 0; i < 6; i++) ton(t + 0.4 + i * 0.28, 220 + Math.random() * 90, "sine", 0.08, 0.03, 140);
    },
    bildirim() { const t = ctx.currentTime; ton(t, 880, "triangle", 0.18, 0.09); ton(t + 0.13, 1320, "triangle", 0.3, 0.08); },
    ret() { const t = ctx.currentTime; ton(t, 300, "triangle", 0.16, 0.08); ton(t + 0.14, 220, "triangle", 0.26, 0.08); },
    kapi() { const t = ctx.currentTime; tikirti(t, 220, 0.08, 0.08); tikirti(t + 0.12, 160, 0.05, 0.1); },
    // Oyun: görev tamam (kısa yükselen çın) ve gün karnesi (küçük fanfar)
    gorev() { const t = ctx.currentTime; [784, 988, 1319].forEach((n, i) => ton(t + i * 0.09, n, "triangle", 0.22, 0.07)); },
    karne() { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((n, i) => { ton(t + i * 0.14, n, "square", 0.16, 0.03); ton(t + i * 0.14, n / 2, "triangle", 0.2, 0.04); }); },
    // Sütlaç
    miyav() {
      const t = ctx.currentTime, o = ctx.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(880, t + 0.18); o.frequency.exponentialRampToValueAtTime(430, t + 0.55);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 3; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1600, t + 0.2); f.frequency.linearRampToValueAtTime(800, t + 0.55);
      o.connect(f); zarf(f, t, 0.04, 0.25, 0.3, 0.12); o.start(t); o.stop(t + 0.7);
    },
    mirr() {
      const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = gurultu(2);
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 160;
      const am = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 24; lg.gain.value = 0.5; am.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain); s.connect(f).connect(am); zarf(am, t, 0.2, 0.9, 0.4, 0.5); s.start(t); lfo.start(t); lfo.stop(t + 1.6);
    },
    guguk(kez = 3) { const t = ctx.currentTime; for (let i = 0; i < Math.min(kez, 12); i++) { ton(t + i * 0.55, 740, "sine", 0.16, 0.07); ton(t + i * 0.55 + 0.2, 587, "sine", 0.22, 0.07); } },
    tak() { const t = ctx.currentTime; tikirti(t, 900, 0.1, 0.04); tikirti(t + 0.09, 600, 0.08, 0.05); },
    sikisti() { const t = ctx.currentTime; for (let i = 0; i < 3; i++) ton(t + i * 0.18, 220, "square", 0.12, 0.04); },
    bloop() { const t = ctx.currentTime; for (let i = 0; i < 3; i++) ton(t + i * 0.12, 500 + i * 120, "sine", 0.12, 0.06, 900 + i * 150); },
    parti(sure = 1) {
      const t = ctx.currentTime, nota = [523, 659, 784, 1047, 784, 659, 523, 659, 784, 1047, 1319, 1047];
      nota.slice(0, Math.max(4, Math.round(nota.length * sure))).forEach((n, i) => { ton(t + i * 0.12, n, "square", 0.11, 0.035); ton(t + i * 0.12, n / 2, "triangle", 0.11, 0.04); });
    },
    // Sürgülü cam kapı: filtreli gürültü süpürmesi + raylarda tık
    kapiAc() { kayma(600, 1700, 0.42, 0.07); tikirti(ctx.currentTime + 0.4, 260, 0.06, 0.05); },
    kapiKapa() { kayma(1500, 550, 0.38, 0.06); tikirti(ctx.currentTime + 0.36, 200, 0.08, 0.06); },
    // Ofis açıldı/kapandı ve boş odanın ışığı: kısa "tık" (şalter)
    ofisTik() { const t = ctx.currentTime; tikirti(t, 1100, 0.05, 0.07); tikirti(t + 0.07, 700, 0.07, 0.06); },
  };

  // Konumlu çalma: panX -1 (sol) .. 1 (sağ), uzaklik karo cinsinden (uzaklaştıkça kısılır, uzakta tizler yumuşar).
  // Kaynak sesi `hedef` üzerinden bu zincire bağlanır; çağrı bitince hedef eski haline döner (calgilar eşzamanlı kurulur).
  function calKonum(ad, panX, uzaklik, ...a) {
    if (!acik || !ctx || !calgilar[ad]) return;
    const g = ctx.createGain(); g.gain.value = Math.max(0.12, 1 / (1 + Math.max(0, uzaklik) * 0.1));
    let son = g;
    if (uzaklik > 8) { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = Math.max(900, 7000 - uzaklik * 140); son.connect(lp); son = lp; }
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, panX || 0)) * 0.9; son.connect(p); son = p; }
    son.connect(efektBus);
    const eski = hedef; hedef = g;
    try { calgilar[ad](...a); } finally { hedef = eski; }
  }

  return {
    get acik() { return acik; },
    ac() { baslat(); ctx.resume(); acik = true; ana.gain.setTargetAtTime(0.9 * seviye.genel, ctx.currentTime, 0.05); },
    kapat() { if (!ctx) return; acik = false; ana.gain.setTargetAtTime(0, ctx.currentTime, 0.05); },
    cal(ad, ...a) { if (acik && ctx && calgilar[ad]) calgilar[ad](...a); },
    calKonum,
    // Dış modüller (ajan sesleri) aynı ana bus'a bağlansın: açıksa { ctx, cikis: ana }, değilse null
    baglanti() { return acik && ctx ? { ctx, cikis: ana } : null; },
    // Ayarlar paneli: tur genel | ambiyans | efekt, deger 0..1.5 (1 = varsayılan)
    seviye(tur, deger) {
      if (!(tur in seviye)) return; seviye[tur] = Math.max(0, Math.min(1.5, +deger || 0));
      if (!ctx) return; const t = ctx.currentTime;
      if (tur === "genel" && acik) ana.gain.setTargetAtTime(0.9 * seviye.genel, t, 0.05);
      else if (tur === "ambiyans") ambBus.gain.setTargetAtTime(seviye.ambiyans, t, 0.05);
      else if (tur === "efekt") efektBus.gain.setTargetAtTime(seviye.efekt, t, 0.05);
    },
    // Şömine sesi: acik=true iken mesafe (karo) arttıkça kısılır. Ses henüz açılmamışsa seviye saklanır, açılınca uygulanır.
    somine(acik, mesafe = 0) { somineIstek = { acik, mesafe }; somineSeviye = acik && somineAcik ? Math.max(0.12, 1 / (1 + Math.max(0, mesafe) * 0.2)) * 1.5 : 0; if (ctx) somineUygula(); },
    // Ayarlar: şömine sesi açık/kapalı; Atölye müziği açık/kapalı ve tarzı (lofi | caz | piyano); odak modunda müzik her odada çalar
    somineSes(acik) { somineAcik = !!acik; this.somine(somineIstek.acik, somineIstek.mesafe); },
    muzik(acik, tarz) { muzikAcik = !!acik; if (MUZIK[tarz] && tarz !== muzikTarz) { muzikTarz = tarz; lofiSayac = 0; if (ctx) lofiSonra = ctx.currentTime + 0.1; } if (ctx) odaUygula(); },
    odakMuzigi(var_) { odakVar = !!var_; if (ctx) odaUygula(); },
    // Oyuncunun bulunduğu oda (ODALAR kimliği): ambiyans katmanları yumuşakça değişir
    oda(id) { if (id === odaId) return; odaId = id; odaUygula(); },
    adlar() { return Object.keys(calgilar); },
    durum() { return { durum: ctx && ctx.state, acik, oda: odaId, seviye: { ...seviye }, katman: ctx ? Object.keys(katmanlar) : [], panner: !!(ctx && ctx.createStereoPanner) }; },
  };
})();
