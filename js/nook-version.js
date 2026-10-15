// =========================
// NOOK-VERSION + ÄNDERUNGSPROTOKOLL
// Reine Daten (window.X, kein JSON — siehe CLAUDE.md: file://), angezeigt
// unter Einstellungen > Über Nook (js/settings.js: renderAboutSettings).
// Lädt direkt vor settings.js.
//
// Pflege: bei einem nennenswerten Update NOOK_VERSION hochzählen
// (Jahr.Monat.Laufnummer) und oben in NOOK_CHANGELOG einen Eintrag
// ergänzen — kurz, aus Nutzersicht, deutsch. Ältere Einträge dürfen
// hinten wegfallen, angezeigt werden ohnehin nur die neuesten.
// =========================

window.NOOK_VERSION = '2026.10.3';

window.NOOK_CHANGELOG = [
  {
    version: '2026.10.3',
    date: '2026-10-15',
    items: [
      'Einstellungen neu gegliedert, mit Sprungleiste',
      'Startbildschirm, Schriftgröße und „Animationen reduzieren“ einstellbar',
      'Tag/Nacht automatisch nach Gerät oder Sonnenstand',
      'Untere Leiste auf dem Handy frei belegbar, Seitenleiste einklappbar',
      'Speicheranzeige, Export und Zurücksetzen je Bereich, Backup-Erinnerung',
      'Backups enthalten keine Anmeldedaten mehr und werden mit Vorschau importiert',
      'Wochen-Navigation sitzt jetzt auf der Heute-Seite',
    ],
  },
  {
    version: '2026.10.2',
    date: '2026-10-15',
    items: [
      'Heute: Speiseplan-Widget mit PDF-Import',
      'Scrollbalken folgen dem Theme',
      'Anleitungen: Tags als Filter, bessere Suche, mehr Markdown',
      'Theme-Editor: eigene Themes mit Tag- und Nachtversion',
    ],
  },
  {
    version: '2026.10.1',
    date: '2026-10-14',
    items: [
      'Neue feste Themes: Cotton Candy, Sci-Fi, Forest, Royal, Cyberpunk, Lab',
      'Cozy mit Tag- und Nachtversion',
    ],
  },
];
