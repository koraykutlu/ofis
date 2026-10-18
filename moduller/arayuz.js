// Arayüz düzeni: sağ paneli aç/kapat (ofisin sağ kenarındaki tutamak; seçim hatırlanır), tam ekran düğmesi (ofisin sağ üst köşesi), Ayarlar'dan "Ofisi düzenle".
// Düzenle düğmesi başlıkta gizli kalır (modüller ona bağlı); Ayarlar'daki düğme onu tıklar. Çekirdeğe bağımlı değil, yalnız DOM.
(() => {
  const el = (id) => document.getElementById(id);
  const DEPO = "ofis-panel-kapali";
  const oku = () => { try { return localStorage.getItem(DEPO) === "1"; } catch (e) { return false; } };
  const yaz = (v) => { try { localStorage.setItem(DEPO, v ? "1" : "0"); } catch (e) { /* depolama kapalı */ } };

  function panelKur() {
    const d = el("panelDugme"); if (!d) return;
    const uygula = (kapali, kaydet) => {
      document.body.classList.toggle("panelKapali", kapali); d.setAttribute("aria-pressed", String(!kapali));
      d.textContent = kapali ? "‹" : "›"; d.title = kapali ? "Sağ paneli aç" : "Sağ paneli kapat";
      if (kaydet) yaz(kapali);
      window.dispatchEvent(new Event("resize"));   // oyun alanı yeni genişliğe oturur
    };
    uygula(oku(), false);
    d.onclick = () => uygula(!document.body.classList.contains("panelKapali"), true);
  }
  function tamEkranKur() {
    const d = el("tamDugme"), kok = document.documentElement; if (!d || !kok.requestFullscreen) return;   // iPad Safari desteklemez: düğme gizli kalır ("Ana ekrana ekle" kullanılır)
    d.hidden = false;
    const yaz_ = () => { const t = !!document.fullscreenElement; const a = t ? "Tam ekrandan çık" : "Tam ekran"; d.title = a; d.setAttribute("aria-label", a); d.classList.toggle("secili", t); };
    d.onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else kok.requestFullscreen().catch(() => {}); };
    document.addEventListener("fullscreenchange", () => { yaz_(); window.dispatchEvent(new Event("resize")); });
    yaz_();
  }
  function duzenleKur() {
    const b = el("a_duzenle"); if (!b) return;
    b.onclick = () => {
      const p = el("ayarPanel"), a = el("ayarDugme");
      if (p) p.hidden = true; if (a) { a.classList.remove("secili"); a.setAttribute("aria-expanded", "false"); }
      const d = el("duzenDugme"); if (d) d.click();
    };
  }
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({ basla() { panelKur(); tamEkranKur(); duzenleKur(); } });
})();
