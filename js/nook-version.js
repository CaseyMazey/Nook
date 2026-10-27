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

window.NOOK_VERSION = '2026.10.11';

window.NOOK_CHANGELOG = [
  {
    version: '2026.10.11',
    date: '2026-10-27',
    items: [
      'Heute: passt auf breiten Bildschirmen (ab 1500 px) in jedem Theme ohne Scrollen auf eine Seite – die rechte Spalte steht in zwei Stapeln nebeneinander',
      'RPG-Heute: Datum und KW-Knöpfe im Kopf besser lesbar, Tischplatte bei Tag heller, Tagebuch ohne grauen Rand',
      'RPG-Heute: „Der Schreibtisch des Reisenden“ – Mahagoni-Tischplatte statt Bretterwand, Aufgaben im aufgeschlagenen Reisetagebuch (über beide Seiten), Unterrichtsblöcke als Messingschilder, Speiseplan auf der Kreidetafel, Gruppenpflichten als Brief mit Wachssiegel, Schnellnotiz als Notizblatt mit Büroklammer, Mini-Kalender als Abreißkalender',
    ],
  },
  {
    version: '2026.10.10',
    date: '2026-10-26',
    items: [
      'Schnellnotiz: „↗ Ablegen“ schickt den markierten Text (oder die ganze Notiz) als Pinnwand-Karte, Projektaufgabe oder Wochenaufgabe weiter',
      'Neu: globale Suche – Strg + K (oder „Suchen“ in der Seitenleiste) findet Anleitungen, Karteikarten, Projekte, Pinnwand, Termine, Budget, Quests und Aufgaben und springt direkt hin',
      'Garten: Pflanzen lassen sich vergrößern, verkleinern und spiegeln (kleine Knöpfe neben dem ✕, auf dem Handy nach Antippen)',
    ],
  },
  {
    version: '2026.10.9',
    date: '2026-10-26',
    items: [
      'Budget: Einzahlen, Abheben und Tilgen können den Kontostand direkt mit anpassen (wie eine erledigte Sparplan-Rate)',
      'Budget: Einmalbuchungen lassen sich bearbeiten und landen im Monat des gewählten Datums',
      'Budget: Rückfrage vor jedem Löschen; gelöschte Einnahmen und Sparziele hinterlassen keine verwaisten Verknüpfungen mehr',
      'Budget: Monatsrückblick (letzte 6 Monate) und CSV-Export des Monats im Zahnrad-Menü',
      'Heute: optionale Zeile „Heute fällig“ mit den Budget-Posten des Tages',
      'Budget: Prognose zeigt Ziele in der echten Verteil-Reihenfolge; „Demnächst“ kennt jetzt auch wöchentliche Posten und Einmalbuchungen',
      'Budget: Farben im Dunkelmodus gut lesbar, Beträge überall im gleichen Format (150,00 €)',
      'RPG-Heute: die Uhr ist jetzt eine astronomische Taschenuhr – mit echter Mondphase und einem Sternenhimmel, der sich langsam mitdreht',
      'RPG-Budget: Farben auf Papier und Holz wieder gut lesbar, kleine Schrift in der Finanzierung größer',
      'Budget: Korrekturen – archivierte Ziele belegen kein Geld mehr, mehrfache Finanzierungen gehen beim Bearbeiten nicht verloren, Sparpläne am 31. springen nicht mehr über kurze Monate',
    ],
  },
  {
    version: '2026.10.8',
    date: '2026-10-26',
    items: [
      'RPG: Finanzgarten wird zur Schatzkammer – Sparziele wachsen als Sonnenamulett, Smaragd-Geode, Schatztruhe, Tonkrug oder Krone, der Finanzbaum als Schatzhort',
      'RPG: Schatzkammer als Pergament-Zettel mit Seil-Trenner, Münz-Stufen, Wachssiegel-Etikett und Stempeln',
      'Taschengeld: Heimfahrt-Wochen ziehen nur noch Samstag und Sonntag ab – der Freitag wird immer bezahlt',
      'Taschengeld: Tage zum Anklicken im Kalender – bezahlt wird jeder angeklickte Tag; Monate ohne Klicks werden geschätzt („Schätzung übernehmen“ macht daraus Klicks)',
      'Taschengeld: kein eigener Feiertagssatz mehr – Feiertage zählen wie ihr Wochentag',
      'RPG-Budget: Kontostand als Wirtshausschild, Reiter als Lederriemen, Monatsauswahl als Messingschild',
      'RPG-Budget: Sparziele als Kassenbuch mit Tintenrahmen, Sparpläne als Zettel, Prognose-Zusammenfassung als Kreidetafel, Monatsrest als Messingschild',
      'RPG-Budget: Finanzierung mit gezeichneten Holzkisten (Einnahmen), Kraftpapier-Anhängern (Posten) und einem Weidenkorb für alles Offene',
    ],
  },
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
      'RPG: auch Karteikarten, Budget, Spiele, Tools und Einstellungen als Pergament-Zettel auf dem Holzbrett; Theme-Editor: „Übrige Seiten“',
      'RPG-Projekte: Karte ohne Tischplatte darunter; Äste & Aufgaben als Zettel auf dem Questbrett',
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
