// Dallanan diyalog ve toplantı kararı (yol haritası 11). Çekirdeğe MOD kancalarıyla bağlanır (window.OFIS_IC).
// - Hafıza: ajan aynı soruyu bugün ya da dün sorduğunu hatırlar ("Az önce de sormuştun", "Dün de sormuştun").
// - Ruh hali: selam ihtiyaç modülünün ruh haline göre değişir (yorgun, yalnız, keyifli); bugün ikinci gelişte farklı selamlar.
// - Alt seçenekler: demo-veri.js'deki seçeneklerde `alt: [...]` varsa cevaptan sonra o dal açılır ("↩ Geri" ile döner).
// - Toplantı kararı: raporlar bitince ekip oyuncuya önceliği sorar; seçim ekibin moralini ve sosyalliğini etkiler, cevapsız kalırsa
//   40 oyun dakikası sonra "plana devam" sayılır.
(() => {
  const I = () => window.OFIS_IC;
  const hafiza = new Map();     // "ajan|etiket" -> son sorulduğu gün
  const gelis = new Map();      // ajan -> { gun, sayi } bugün kaç kez konuşuldu
  const ruh = (a) => (window.OFIS_YASAM ? OFIS_YASAM.ruhHali(a) : { ad: "normal" });

  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    bastan(tam) { if (tam) { hafiza.clear(); gelis.clear(); } },
    selam(a, selam) {
      const ic = I(), g = gelis.get(a.id), ikinci = g && g.gun === ic.gun;
      gelis.set(a.id, { gun: ic.gun, sayi: ikinci ? g.sayi + 1 : 1 });
      const r = ruh(a).ad, h = a.ih || {}, saat = Math.floor(ic.dakika() / 60) % 24;
      const gece = saat >= 22 || saat < 5, aksam = saat >= 17 && saat < 22, ogle = saat >= 11 && saat < 15;
      const on = ikinci ? (g.sayi >= 2 ? "Bugün beni çok özledin galiba. " : "Yine geldin! ") : "";
      // açlık ve kahve durumu ruh halinden önce söylenir; gece mesaisi ayrıca anılır
      let ek = "";
      if (h.tokluk < 30) ek = aksam || gece ? " Daha akşam yemeği yemedim, karnım zil çalıyor." : ogle ? " Daha öğle yemeği yemedim…" : " Karnım zil çalıyor.";
      else if (h.kahve < 20) ek = " Kahve seviyem kritik ☕";
      else if (gece) ek = r === "yorgun" ? " Gecenin bu saati gözler kapanıyor." : " Gece mesaisi sessiz geçiyor, sevdim.";
      if (r === "yorgun") return `${on}${selam} (esner) Bir kahve iyi giderdi açıkçası.${ek}`;
      if (r === "aç") return `${on}${selam}${ek || " Karnım zil çalıyor."}`;
      if (r === "yalnız") return `${on || "Sonunda biri uğradı! "}${selam}${ek}`;
      if (r === "keyifli") return `${on}${selam} Bugün iyi gidiyor.${ek}`;
      return on + selam + ek;
    },
    cevap(a, s) {
      if (!s.etiket || s.kapat) return undefined;
      const ic = I(), k = `${a.id}|${s.etiket}`, once = hafiza.get(k); hafiza.set(k, ic.gun);
      if (once === ic.gun) return `Az önce de sormuştun 🙂 ${s.cevap}`;
      if (once === ic.gun - 1) return `Dün de sormuştun. ${s.cevap}`;
      if (once !== undefined) return `Geçenlerde de konuşmuştuk. ${s.cevap}`;
      return undefined;
    },
    toplantiKarar(T_, bitir) {
      const ic = I(), uyeler = T_.uyeler.filter((a) => a.oturak && !a.disarda);
      const konusan = uyeler[0]; if (!konusan) return false;
      let bitti = false;
      const kapat = (soz, etki) => {
        if (bitti) return; bitti = true;
        for (const a of uyeler) if (a.ih) { a.ih.sosyal = Math.min(100, a.ih.sosyal + etki.sosyal); a.ih.enerji = Math.max(0, Math.min(100, a.ih.enerji + etki.enerji)); }
        if (etki.kalp) uyeler.forEach((a) => ic.kalpler(a, 1));
        ic.stat.karar = soz.kayit; ic.gunluk(`Toplantı kararı (${T_.m.saat}): ${soz.kayit}`);
        if (ic.diyalogAcik()) ic.diyalogKapat();
        ic.konus(ic.oyuncu, soz.oyuncu, true); ic.sonra(1.2, () => ic.konus(konusan, soz.ekip, true));
        bitir();
      };
      const DEVAM = { kayit: "plana devam", oyuncu: "Plan iyi, devam edin.", ekip: "Tamamdır, akşama kadar bitiyor." };
      const secenekler = [
        { etiket: "Plana devam, onaylıyorum", fn: () => kapat(DEVAM, { sosyal: 10, enerji: 5, kalp: true }) },
        { etiket: "Tek işe odaklanın, gerisi yarına", fn: () => kapat({ kayit: "tek işe odak", oyuncu: "Bugün tek iş: önce en önemlisi.", ekip: "Anlaşıldı, gerisini yarına yazıyorum." }, { sosyal: 4, enerji: 12 }) },
        { etiket: "En büyük risk ne?", fn: (a) => {
          const riskci = uyeler[1] || konusan;
          ic.diyalogOzel(riskci, (T_.m.risk || "Zaman: iki iş aynı saate sıkıştı. Birini ertelersek rahatlarız.") + " Ne diyorsun?", [
            { etiket: "Haklısın, birini ertele", fn: () => kapat({ kayit: "risk alındı, bir iş ertelendi", oyuncu: "Birini erteleyin, acele yok.", ekip: "Rahatladık, teşekkürler." }, { sosyal: 8, enerji: 15, kalp: true }) },
            { etiket: "Riski göze alalım", fn: () => kapat({ kayit: "risk göze alındı", oyuncu: "İkisini de yetiştirelim.", ekip: "Peki, hızlanıyoruz." }, { sosyal: 2, enerji: -8 }) },
          ]);
        } },
      ];
      ic.diyalogOzel(konusan, `Raporlar bu kadar (${T_.m.konu}). Bugünün önceliği ne olsun?`, secenekler);
      ic.sonra(ic.dkT(460) - ic.dkT(420), () => { if (!bitti) kapat(DEVAM, { sosyal: 3, enerji: 0 }); });   // 40 oyun dakikası cevapsız kalırsa (gün süresinden bağımsız)
      return true;
    },
  });
})();
