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

window.NOOK_VERSION = '2026.10.7';

window.NOOK_CHANGELOG = [
  {
    version: '2026.10.7',
    date: '2026-10-23',
    items: [
      'Kalender: Kacheln der rechten Spalte (und die Wetterkarte) einzeln in den Kalender-Einstellungen ein-/ausblendbar',
      'Kalender: neue Karte „Demnächst“ mit den Terminen der nächsten 14 Tage',
      'Kalender: Monatsstatistik neu – Termine mit Vormonatsvergleich, freie Tage, Ø pro Woche, erledigte Aufgaben und Auslastung je Tag',
      'Kalender: „Heute“-Knopf, Monatswechsel per Pfeiltasten; Monatswechsel am 29.–31. überspringt keinen Monat mehr',
      'Countdowns: Klick öffnet direkt den Termin; auch für wiederkehrende Termine (zählt bis zum nächsten Vorkommen)',
      'Kalender: Kacheln der rechten Spalte per Ziehen an der Überschrift sortierbar; Tage aus Vor-/Nachmonat anklickbar',
      'RPG: Heute-Seite auf dem Holzbrett, Unterrichtsblöcke und Kacheln als angepinnte Pergament-Zettel; Theme-Editor: Heute-Stil wählbar',
    ],
  },
  {
    version: '2026.10.6',
    date: '2026-10-21',
    items: [
      'Neues Theme Zombie (aus Kuros Core) mit Hintergrund, Kalenderbildern, Banner und Icon',
      'RPG: Projektwald als Pergament-Karte, Pinnwand als Pergament-Blätter mit farbigen Pins',
      'RPG: Anleitungen als Zauberbücher in der Buchfarbe, Kapitel auf Pergament, Seitenkarten als Zettel',
      'RPG: Kalender als Pergamentblatt auf dem Holzbrett; Termine in hellen Themes besser lesbar',
      'Heute: Fortschritt verfolgen (z.B. Ausbildung in Wochen), in den Einstellungen einschaltbar',
    ],
  },
  {
    version: '2026.10.5',
    date: '2026-10-21',
    items: [
      'Neues Theme RPG mit Tag- und Nachtversion, eigenem Hintergrund, Kalenderbildern, Banner und Icon',
      'Questboard im RPG-Theme als Tavernen-Aushang mit Pergament-Zetteln und Wachssiegeln',
      'Theme-Editor: Questboard-Stil wählbar',
      'RPG mit eigenen Schriften: Alegreya für Text, Blackwood Castle für Überschriften und Tabs; Theme-Editor: eigene Überschriften-Schrift',
    ],
  },
  {
    version: '2026.10.4',
    date: '2026-10-21',
    items: [
      'Neuer Tab Questboard: Daily, Weekly, Time und Side Quests auf einem Brett',
      'Würfel entscheidet, welche Side Quest als Nächstes dran ist',
      'Optionale Schatztruhe: Münzen sammeln und eigene Belohnungen einlösen',
    ],
  },
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
