// =========================
// PWA — SERVICE-WORKER-REGISTRIERUNG
// Eigenständige, kleine Datei nach dem bestehenden Datei-pro-Feature-
// Muster, lädt als letztes Script. Kennt keine Nook-Daten/State — reine
// Infrastruktur.
//
// Service Worker brauchen einen "secure context" (https oder localhost).
// Unter file:// (weiterhin ein voll unterstützter Nook-Nutzungsmodus)
// existiert navigator.serviceWorker zwar, register() schlägt dort aber
// erwartungsgemäß fehl — daher der stille catch, kein Fehlerzustand.
// =========================

if ("serviceWorker" in navigator && !window.NOOK_THEME_LAB && !window.NOOK_THEME_LAB_FAILED) { // Theme-Lab: kein SW
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // sw.js liegt hinter Cache-Control: no-cache (siehe _headers), der
        // Browser prüft bei jeder register()/update()-Runde also wirklich
        // gegen den Server. Zusätzlich stündlich nachfragen, damit ein
        // Deploy auch in einem lange offen gelassenen Tab ankommt, nicht
        // erst beim nächsten kompletten Neuladen.
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(() => {
        // file:// oder anderer unsicherer Kontext — App funktioniert
        // trotzdem ganz normal, nur ohne Offline-Cache/Installierbarkeit.
      });
  });

  // sw.js ruft self.skipWaiting()+clients.claim() bedingungslos auf (siehe
  // dortiger Kommentar) — ein neu installierter Worker übernimmt also
  // sofort die Kontrolle, statt auf das Schließen aller Tabs zu warten.
  // "controllerchange" ist damit das zuverlässige Signal "es gibt jetzt
  // eine neuere Version, als das, was dieser Tab geladen hat". Kein
  // Auto-Reload (siehe Banner-Kommentar in index.html) — nur ein Hinweis,
  // wie beim Sync-Update-Banner.
  //
  // Ausnahme: die allererste Aktivierung (frischer Erstbesuch, noch kein
  // Controller vorhanden) ist kein "Update", sondern nur die Erstinstallation
  // — dafür wird kein Banner angezeigt. hadControllerAtLoad merkt sich den
  // Zustand VOR jeder Registrierung, damit der Vergleich stimmt.
  const hadControllerAtLoad = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadControllerAtLoad) return;
    document.getElementById("sw-update-banner")?.classList.remove("hidden");
  });
}

document.getElementById("sw-update-reload-btn")?.addEventListener("click", () => location.reload());
