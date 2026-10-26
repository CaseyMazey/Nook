# Budget.md

Version: 1.1

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
- Schulden und Raten getrennt von Sparzielen abbilden
- jedem Euro eine klare Zuordnung geben (Finanzierung)
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

# Sub-Tabs

Budget ist in fünf Sub-Tabs unterteilt:

1. Übersicht
2. Finanzierung
3. Prognose (Sparplaner)
4. Sparpläne
5. Schulden

Diese Struktur soll erhalten bleiben.

---

# Dashboard (Übersicht)

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

Die Vorschau rechnet bewusst immer ab dem heutigen Tag, unabhängig davon, welcher Monat gerade in der Übersicht angezeigt wird — sie beantwortet "reicht mein Geld ab jetzt", nicht "reichte es in einem beliebig gewählten Monat".

---

# Finanzgarten

Der Finanzgarten visualisiert den Fortschritt der Sparziele.

Jedes Sparziel besitzt eine Pflanze.

Je näher das Ziel erreicht wird, desto weiter wächst die Pflanze.

Unterstützt werden verschiedene Pflanzenarten.

Zusätzlich zu den Sparziel-Pflanzen wächst ein eigener Finanzbaum mit dem Kontostand — er zeigt unabhängig von einzelnen Sparzielen, wie gesund die Gesamtfinanzen gerade wirken.

Der Finanzgarten dient ausschließlich der Motivation.

Im RPG-Stil (Theme-Eigenschaft „Übrige Seiten“ = Pergament, `data-pages-style="rpg"`) wird der Finanzgarten zur **Schatzkammer** (js/budget-schatzkammer.js): Jede Pflanze hat ein Schatz-Gegenstück mit denselben 6 Stufen — Sonnenblume → Sonnenamulett, Kaktus → Smaragd-Geode, Bonsai → Schatztruhe, Zimmerpflanze → Tonkrug, Kirschblüte → Krone; der Finanzbaum wird zum Schatzhort. Namen und Symbole wechseln mit (auch in der Pflanzenauswahl), gespeichert bleibt immer der Pflanzen-Schlüssel (`plantType`). Eigene Stufen-Namen des Finanzbaums bleiben erhalten, nur die Standard-Namen werden übersetzt.

---

# Sparziele

Ein Sparziel besitzt mindestens:

- Name
- Zielbetrag
- aktueller Betrag
- Pflanze
- Emoji

Optional zusätzlich:

- Priorität (Muss/Brauche/Möchte)
- Kategorie
- Beschreibung
- Startdatum und Wunschtermin
- Finanzierungsquellen

Budget berechnet automatisch den Fortschritt.

---

# Finanzierung — "Jedem Euro einen Job"

Der Finanzierung-Sub-Tab ist die zentrale Engine, über die Einnahmen konkreten Verbrauchern (Sparzielen, Schulden, wiederkehrenden und einmaligen Ausgaben) zugeordnet werden.

Jede Zuordnung besteht aus:

- einer Einnahmequelle
- einem Betrag
- einem Verbraucher (Sparziel, Schuld oder Ausgabe)

Dadurch lässt sich für jede Einnahme nachvollziehen, wofür sie eingeplant ist, und für jeden Verbraucher, woher sein Geld kommt.

Ein interaktiver Geldfluss-Planer (Drag & Drop) erlaubt es, Einnahmen direkt auf ihre Verbraucher zu ziehen oder per Klick zuzuweisen, inklusive Kapazitätsgrenzen je Karte.

Die Finanzierung ersetzt keine Buchhaltung — sie bleibt eine Planungshilfe, keine Nachverfolgung tatsächlicher Kontobewegungen.

---

# Sparprognose (Prognose-Sub-Tab)

Die Sparprognose berechnet aus den wiederkehrenden Posten drei mögliche monatliche Sparraten:

- 🔒 Garantiert – nur feste, sichere Beträge
- 📊 Realistisch – inkl. Durchschnitt variabler Posten
- 🚀 Optimistisch – bester Fall

Jeder wiederkehrende Posten kann einzeln von der Sparplan-Berechnung ausgeschlossen werden.

## Zeitstrahl

Zeigt anhand des gewählten Szenarios, wann Sparziele voraussichtlich erreicht werden.

## Was-wäre-wenn?

Simulator zum Durchspielen einer frei wählbaren monatlichen Sparrate, ohne das eigentliche Szenario zu verändern.

Die Sparprognose ist bewusst von den Sparplänen getrennt: Sie beantwortet "was ist realistisch möglich", während Sparpläne konkrete, vom Nutzer festgelegte Vorhaben sind (siehe unten).

---

# Sparpläne (Sparpläne-Sub-Tab)

Sparpläne sind eigenständige, vom Nutzer angelegte Sparvorhaben mit Zielbetrag, Zieldatum und Spar-Methode.

Ein Sparplan kann optional mit einem bestehenden Sparziel verknüpft werden, ist aber kein Pflichtbestandteil eines Sparziels.

Sparpläne bestehen aus einzelnen Einträgen (Einzahlungen), über die der tatsächliche Fortschritt nachvollzogen wird.

---

# Schulden & Raten (Schulden-Sub-Tab)

Schulden und Raten werden bewusst getrennt von Sparzielen verwaltet — strukturell ähnlich (Betrag, Fortschritt, Finanzierung), aber mit anderer Bedeutung: eine Schuld wird **getilgt**, nicht **gespart**.

Eine Schuld besitzt mindestens:

- Name
- Gesamtbetrag
- bereits getilgter Betrag

Wie bei Sparzielen kann auch eine Schuld über die Finanzierung-Engine aus Einnahmen bedient werden.

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
- Schulden/Raten
- Finanzierungszuordnungen
- Sparpläne
- Pflanzen
- Monatsdaten
- Finanzgarten-Einstellungen

Alle Daten werden lokal gespeichert.

---

# Zuständigkeiten

Budget ist auf mehrere Dateien aufgeteilt, die zusammen den Sub-Tab-Verbund bilden (feste Ladereihenfolge):

- **budget.js** — Datenmodell-Kern, Monatsverwaltung, Berechnungen, Übersicht-Rendering, Finanzgarten, Sub-Tab-Switcher
- **budget-sparziele.js** — Rendering der Sparziele (Datenquelle bleibt budgetGoals aus budget.js)
- **budget-financing.js** — Finanzierungs-/Reservierungs-Engine ("Jedem Euro einen Job"), gemeinsamer Funding-Editor
- **budget-debts.js** — Schulden/Raten
- **budget-analysis.js** — Geldfluss-Planer (Drag & Drop)
- **budget-sparprognose.js** — Sparprognose (Szenarien, Zeitstrahl, Was-wäre-wenn)
- **budget-sparplaene.js** — Sparpläne (eigenständige Spar-Vorhaben mit Einträgen)

Zusammen sind sie verantwortlich für:

- Monatsverwaltung
- Berechnungen
- Einnahmen
- Ausgaben
- Sparziele
- Schulden/Raten
- Finanzierung
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
- Schulden/Raten
- Finanzierungszuordnungen (funding)
- Sparpläne
- Prioritäten
- Zahlungsstatus
- Pflanzen
- Einstellungen

Andere Module dürfen diese Daten lesen.

Budget bleibt die einzige Quelle für Finanzdaten.

Hinweis: Der Finanzgarten (Finanzbaum + Sparziel-Pflanzen) lebt vollständig innerhalb von Budget. Er hat keine Verbindung zum Projektwald (Projekte-Tab, `forest.js`/`project-tree.js`) — beide sind unabhängig entstandene, ähnliche Wachstums-Visualisierungen für unterschiedliche Daten.

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ den finanziellen Überblick verbessern

✔ möglichst wenig Eingaben erfordern

✔ verständliche Aussagen liefern

✔ motivierend wirken

✔ bestehende Daten kompatibel halten

✔ die Finanzierungs-Engine wiederverwenden statt eigene Zuordnungslogik zu erfinden

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
- Änderungen am Geldfluss-Planer (budget-analysis.js) besonders sorgfältig testen — dort sind in der Vergangenheit mehrfach subtile Bugs rund um Drag & Drop und doppelte Funding-Einträge aufgetreten (siehe `testing-geldfluss.md`).
