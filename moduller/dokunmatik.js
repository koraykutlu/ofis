// Dokunmatik kullanım (tablet/telefon, Apple Pencil): ekranda düğme YOK, fare gibi çalışır (mantık ofis.js tıklama işleyicisinde):
// haritaya dokun → karakter oraya yürür · ajana dokun → yanına gidip konuşur · eşyaya ya da boş oturağa dokun → yanına gidip kullanır/oturur ·
// karakterine ya da üstündeki "E ..." etiketine dokun → o an yakındaki şeyi kullan (E tuşu gibi).
// Bu dosya yalnız dokunmatik cihazı algılar (html.dokunmatik sınıfı), sayfa kaydırma/yakınlaştırma jestlerini oyun alanında kapatır ve ilk açılışta mini haritayı kapatır.
// Açılış: dokunmatik ekran (pointer: coarse) ya da adres sonuna ?dokunmatik=1; ?dokunmatik=0 kapatır.
(() => {
  const url = new URLSearchParams(location.search).get("dokunmatik");
  const dokunmatik = url === "1" || (url !== "0" && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1));
  if (!dokunmatik) return;
  document.documentElement.classList.add("dokunmatik");
  // İlk açılışta (kayıtlı ayar yoksa) mini harita kapalı; Ayarlar'dan ya da M ile açılır
  try { if (!localStorage.getItem("ofis-demo-ayar-1")) localStorage.setItem("ofis-demo-ayar-1", JSON.stringify({ mini: false, surum: 2 })); } catch (e) { /* depolama kapalı */ }
  (window.OFIS_MODULLER = window.OFIS_MODULLER || []).push({
    basla() {
      const sahne = document.querySelector(".sahne");
      if (sahne) sahne.addEventListener("touchmove", (e) => { if (e.target.closest("#c")) e.preventDefault(); }, { passive: false });
    },
  });
})();
