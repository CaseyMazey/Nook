# Budget.md

Version: 1.0

---

# Zweck

Budget ist der persönliche Finanzbegleiter des Personal Hub.

Er hilft dabei, Einnahmen, Ausgaben und Sparziele übersichtlich zu verwalten, die eigene finanzielle Situation besser einzuschätzen und langfristig ein gesundes Budget aufzubauen.

Budget ersetzt keine Banking-App.

Es konzentriert sich auf Planung, Übersicht und Motivation.

---

# Ziele

Budget soll:

- monatliche Finanzen planen
- wiederkehrende Zahlungen verwalten
- einmalige Ausgaben organisieren
- Sparziele motivierend darstellen
- die aktuelle finanzielle Situation verständlich erklären
- einen ruhigen, stressfreien Überblick bieten

---

# Designprinzip

Budget soll sich bewusst nicht wie klassisches Online-Banking anfühlen.

Keine roten Warnmeldungen.

Keine Tabellen voller Zahlen.

Keine überladene Buchhaltung.

Stattdessen:

- warme Farben
- ruhiges Dashboard
- leicht verständliche Aussagen
- positive Motivation
- Fokus auf Planung statt Kontrolle

---

# Dashboard

Das Dashboard besteht aus mehreren Bereichen:

1. Kopfbereich
2. Monatsübersicht
3. Zusammenfassung
4. Finanzstatus
5. Liquiditätsvorschau
6. Finanzgarten
7. Wiederkehrende Zahlungen
8. Einmalige Zahlungen
9. Sparziele
10. Finanztipp

---

# Kopfbereich

Der Header enthält:

- Seitentitel
- aktuellen Monat
- Monatsnavigation
- Kontostand
- Aktionen
- Einstellungen für den Finanzgarten

---

# Kontostand

Der Kontostand wird manuell gepflegt.

Er stellt den tatsächlichen Kontostand dar.

Von diesem Wert aus werden sämtliche Berechnungen durchgeführt.

Der Kontostand kann jederzeit angepasst werden.

---

# Monatsnavigation

Budget arbeitet monatsbasiert.

Zwischen Monaten kann jederzeit gewechselt werden.

Jeder Monat besitzt eigene:

- Einnahmen
- Ausgaben
- Einmalzahlungen
- Sparziele

---

# Zusammenfassung

Die Übersicht zeigt die wichtigsten Kennzahlen.

Dazu gehören:

- Einnahmen
- Ausgaben
- verfügbares Budget

Alle Werte werden automatisch berechnet.

---

# Finanzstatus

Budget bewertet automatisch die finanzielle Situation.

Die Bewertung orientiert sich unter anderem daran:

- ob Pflichtausgaben gedeckt sind
- ob notwendige Ausgaben gedeckt sind
- ob Wünsche finanzierbar sind
- wie viel Geld anschließend verbleibt

Der Status wird verständlich formuliert.

Beispiele:

- Stabil
- Vorsicht
- Kritisch

Zusätzlich werden passende Hinweise angezeigt.

---

# Liquiditätsvorschau

Die Liquiditätsvorschau zeigt:

- aktueller Kontostand
- erwartete Einnahmen
- kommende Ausgaben
- voraussichtlicher Kontostand

Dadurch lässt sich früh erkennen, ob ausreichend Geld vorhanden sein wird.

---

# Finanzgarten

Der Finanzgarten visualisiert den Fortschritt der Sparziele.

Jedes Sparziel besitzt eine Pflanze.

Je näher das Ziel erreicht wird, desto weiter wächst die Pflanze.

Unterstützt werden verschiedene Pflanzenarten.

Der Finanzgarten dient ausschließlich der Motivation.

---

# Sparziele

Ein Sparziel besitzt mindestens:

- Name
- Zielbetrag
- aktueller Betrag
- Pflanze
- Emoji

Budget berechnet automatisch den Fortschritt.

---

# Wiederkehrende Zahlungen

Hier werden regelmäßige Einnahmen und Ausgaben verwaltet.

Beispiele:

- Gehalt
- Miete
- Strom
- Internet
- Versicherungen

Jeder Eintrag besitzt:

- Name
- Betrag
- Typ
- Priorität
- Intervall

---

# Einmalige Zahlungen

Einmalige Zahlungen gelten nur für einen bestimmten Monat.

Sie eignen sich beispielsweise für:

- Urlaube
- Anschaffungen
- Reparaturen
- Geschenke

---

# Prioritäten

Ausgaben können priorisiert werden.

Es existieren drei Stufen:

## Must

Pflichtausgaben.

Zum Beispiel:

- Miete
- Strom
- Versicherungen

---

## Need

Wichtige Ausgaben.

Zum Beispiel:

- Lebensmittel
- Benzin
- Medikamente

---

## Want

Freiwillige Ausgaben.

Zum Beispiel:

- Streaming
- Spiele
- Freizeit
- Shopping

---

# Zahlungsstatus

Einträge können als bezahlt markiert werden.

Bezahlte Einträge:

- werden optisch abgeschwächt
- bleiben nachvollziehbar
- fließen weiterhin in Statistiken ein

---

# Einnahmen

Budget unterstützt beliebig viele Einnahmen.

Beispiele:

- Gehalt
- Kindergeld
- Nebenjob
- Rückzahlungen

---

# Ausgaben

Budget unterstützt beliebig viele Ausgaben.

Sie können:

- wiederkehrend
- jährlich
- einmalig

sein.

---

# Sparziele

Mehrere Sparziele können gleichzeitig verwaltet werden.

Für jedes Ziel werden angezeigt:

- Fortschritt
- Prozent
- aktueller Betrag
- Zielbetrag

---

# Finanztipp

Am unteren Ende des Dashboards erscheint ein wechselnder Finanztipp.

Die Tipps dienen ausschließlich als Motivation und Orientierung.

---

# Suche

Budget besitzt bewusst keine Suchfunktion.

Durch die kompakte Monatsansicht bleiben alle Informationen direkt sichtbar.

---

# Speicherung

Budget speichert unter anderem:

- Kontostand
- Einnahmen
- Ausgaben
- Prioritäten
- Zahlungsstatus
- Sparziele
- Pflanzen
- Monatsdaten
- Finanzgarten-Einstellungen

Alle Daten werden lokal gespeichert.

---

# Zuständigkeiten

budget.js ist verantwortlich für:

- Monatsverwaltung
- Berechnungen
- Einnahmen
- Ausgaben
- Sparziele
- Finanzstatus
- Liquiditätsberechnung
- Finanzgarten
- Statistiken
- Speicherung

Nicht verantwortlich für:

- Kalender
- Projekte
- Guides
- Flashcards
- Games

---

# Datenmodell

Budget verwaltet:

- Monate
- Kontostand
- Einnahmen
- Ausgaben
- Sparziele
- Prioritäten
- Zahlungsstatus
- Pflanzen
- Einstellungen

Andere Module dürfen diese Daten lesen.

Budget bleibt die einzige Quelle für Finanzdaten.

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ den finanziellen Überblick verbessern

✔ möglichst wenig Eingaben erfordern

✔ verständliche Aussagen liefern

✔ motivierend wirken

✔ bestehende Daten kompatibel halten

Neue Funktionen sollen nicht:

✖ zu einer Buchhaltungssoftware werden

✖ Bankfunktionen ersetzen

✖ den Nutzer mit Zahlen überfordern

✖ unnötig kompliziert werden

---

# Zukunft

Geplante Erweiterungen:

- Statistiken über mehrere Monate
- Diagramme
- Kategorien
- CSV-Import
- CSV-Export
- Erinnerungen für Zahlungen
- automatische Sparvorschläge
- mehrere Konten
- Budget-Vorlagen
- Jahresübersicht
- Cloud-Synchronisation

---

# Entwicklungsrichtlinien

Bei Änderungen an Budget gelten folgende Regeln:

- Budget bleibt ein persönlicher Finanzplaner.
- Planung steht vor Buchhaltung.
- Die Oberfläche bleibt ruhig, freundlich und leicht verständlich.
- Bestehende Finanzdaten müssen kompatibel bleiben.
- Motivation und Übersicht haben Vorrang vor Funktionsvielfalt.