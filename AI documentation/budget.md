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

---

# Kopfbereich

Der Header enthält:

- Seitentitel
- aktuellen Monat
- Monatsnavigation
- Kontostand
- Aktionen
- Menü (Zahnrad): Finanzbaum konfigurieren (nur die Schwellen — die Stufen-Namen sind fest; im RPG-Theme „Schatzhort konfigurieren“ mit den Hort-Stufen), Taschengeld-Berechnung, Archiv, Monatsrückblick, Monat als CSV exportieren

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

Gerechnet wird entlang der Daten des Monats: Ausgangspunkt ist der Kontostand (Erledigtes ist dort schon verbucht), dann kommen die offenen Einnahmen an ihrem Datum (am selben Tag vor den Ausgaben) und die offenen Ausgaben an ihrem Fälligkeitstag; im laufenden Monat gilt Überfälliges als heute fällig. Eine Prioritätsstufe gilt als gedeckt, wenn der Stand mit ihren Ausgaben (plus denen der höheren Stufen) an keinem Tag unter null fällt — eine Einnahme, die vor einer Ausgabe eingeht, deckt sie also. Die Karte „Verfügbar“ zeigt dieselbe Rechnung: offene Einnahmen, offene Ausgaben je Stufe, tiefster Stand und Stand am Monatsende.

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

Im RPG-Stil (Theme-Eigenschaft „Übrige Seiten“ = Pergament, `data-pages-style="rpg"`) wird der Finanzgarten zur **Schatzkammer** (js/budget-schatzkammer.js): Jede Pflanze hat ein Schatz-Gegenstück mit denselben 6 Stufen — Sonnenblume → Sonnenamulett, Kaktus → Smaragd-Geode, Bonsai → Schatztruhe, Zimmerpflanze → Tonkrug, Kirschblüte → Krone; der Finanzbaum wird zum Schatzhort. Namen und Symbole wechseln mit (auch in der Pflanzenauswahl), gespeichert bleibt immer der Pflanzen-Schlüssel (`plantType`). Die Stufen-Namen des Finanzbaums sind fest (konfigurierbar sind nur die Schwellen) und werden im RPG-Stil mit übersetzt.

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

Jeder wiederkehrende Posten kann einzeln von der Sparplan-Berechnung ausgeschlossen werden. Das Taschengeld steht als eigene Zeile unter „Einnahmen & Ausgaben“.

Die Sparrate wird in der selbst festgelegten Reihenfolge (▲▼) auf die Sparziele verteilt. Die Priorität (Muss/Brauche/Möchte) ist dabei nur eine Markierung und erzwingt keine Reihenfolge.

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
- Gilt ab (Monat, `startMonth`) — in früheren Monaten wird der Posten nicht angezeigt; neue Posten starten im laufenden Monat, Altdaten ohne Wert gelten immer

Das Taschengeld erscheint als berechnete Einnahme mit in der Liste (Bearbeiten öffnet die Taschengeld-Einstellungen).

---

# Einmalige Zahlungen

Einmalige Zahlungen gelten nur für einen bestimmten Monat — dem Monat des gewählten Datums (nicht zwingend dem gerade angezeigten). Sie lassen sich nachträglich bearbeiten (✎); bei einer bereits erledigten Buchung wird der Kontostand dabei korrigiert.

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

Einträge können als bezahlt markiert werden. Der Status wiederkehrender Posten liegt in EINEM Objekt `budgetPaid` (`{ 'YYYY-MM': { <id>: true } }`); die früheren Einzel-Keys `rec_paid_<id>_<monat>` werden beim Laden einmalig übernommen und entfernt. Beim Löschen eines Postens wird sein Status mit entfernt.

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

# Taschengeld (optional)

Persönliche Einnahme, die monatlich aus Tagessätzen berechnet wird (js/budget-taschengeld.js, Einstellungen im Zahnrad-Menü). Im Kalender des Fensters werden die Tage angeklickt, an denen man da ist und bezahlt wird; ein Monat mit markierten Tagen wird exakt daraus berechnet. Monate ohne Markierung werden mit den Regeln geschätzt (Freitag immer bezahlt, Heimfahrt-Wochenenden ohne Sa/So, Feiertage zählen wie ihr Wochentag). Sobald das Taschengeld als erhalten markiert ist, wird der Betrag des Monats fixiert. Der Auszahlungstag ist einstellbar (Standard: letzter Tag des Monats, sonst ein fester Tag 1–28); an diesem Tag zählt das Geld in Status, Karte „Verfügbar“ und Liquiditätsvorschau als eingegangen. Taschengeld ist kein Eintrag in budgetRecurring, sondern eine virtuelle Einnahme (`budgetIncomeSources()`).

---

# Archiv

Erfüllte Sparziele und beglichene Schulden können archiviert werden. Archivierte Einträge zählen nirgends mehr mit (keine Reservierung, keine Finanzierung, keine Prognose) und lassen sich im Archiv wiederherstellen.

---

# Kontoauszug importieren

Zahnrad-Menü → „Kontoauszug importieren“ (js/budget-import.js). Man wählt einen Umsatz-Export aus dem Online-Banking (CSV, OFX oder QIF; am besten drei bis sechs Monate). Nook sucht darin Zahlungen mit festem Rhythmus (wöchentlich, alle 2 Wochen, monatlich, jährlich) und schlägt sie als wiederkehrende Posten vor. Übernommen wird nur, was angehakt ist; der Name ist vorher änderbar.

- Die Buchungen selbst werden nie gespeichert und es gibt keinen neuen localStorage-Key — nur die übernommenen Einträge landen in `budgetRecurring` (Startmonat = laufender Monat). Das hält Budget ein Planer, keine Buchhaltung.
- Monatliche Posten mit schwankendem Betrag (Strom, Handy) kommen als „variabel“ mit Min/Max. Priorität wird aus dem Namen geraten (Miete, Strom, Versicherung → Muss; Streaming, Spiele → Möchte; sonst Brauche).
- Wöchentliche Ausgaben zählen nur bei fast gleichem Betrag (sonst wäre der Wocheneinkauf ein „Abo“). Umbuchungen und Bargeld werden übersprungen, beendete Rhythmen nicht vorgeschlagen, vierteljährliche ausgelassen (kennt Nook nicht).
- Ein Posten mit ähnlichem Namen in `budgetRecurring` ist vorab abgewählt und markiert. Passt sein fester Betrag nicht mehr zur Bank (gleicher Rhythmus, mindestens 0,50 € Unterschied), bietet die Zeile „Betrag anpassen“ an statt eines neuen Postens — vorab angehakt, wenn eine Preiserhöhung erkannt wurde.
- Preiserhöhung: mindestens zwei Abbuchungen zum gleichen alten Preis (±2 %), danach alle zum neuen, 2 % und mindestens 0,50 € höher (Regel aus broke). Die Zeile zeigt „teurer seit …: alt → neu“, übernommen wird der neue Preis statt des Durchschnitts.
- Deutsche Exporte (Sparkasse, ING, DKB, Volksbank, N26, comdirect): Vorspann-Zeilen, Windows-1252, Dezimalkomma, getrennte Empfänger-/Zahler-Spalten, PayPal & Co. (Händler aus dem Verwendungszweck). Spalten lassen sich im Dialog korrigieren. PDF geht nicht.
- Erkennung nach broke (MIT, NextWork), siehe Kopf der Datei. Tests: `node --test tests/`.

---

# Abo-Hinweise

js/budget-abos.js. Ruhige Hinweise, keine Warnungen:

- **Doppelte Abos:** Über der Liste der wiederkehrenden Posten erscheint ein Hinweis, wenn im angezeigten Monat zwei Ausgaben derselben Art gelten (zwei Musik-Abos, zwei Streaming-Dienste, zweimal Cloud-Speicher, Hörbuch- oder Gaming-Abos) oder derselbe Name zweimal vorkommt — mit Monatssumme (jährliche Posten anteilig) und Kündigen-Links. „Passt so“ blendet ihn aus (`budgetAboHintsOff`, Hinweis-IDs aus Gruppe + Posten-IDs); kommt ein weiteres Abo dazu, erscheint er wieder.
- **Kündigen-Link:** Im Posten-Dialog steht unter dem Namen „Bei … kündigen ↗“, wenn der Dienst bekannt ist und eine geprüfte Kündigungsseite hat. Unbekannte oder nicht prüfbare Seiten bekommen keinen Link (in der Tabelle `cancel: null`) — nie raten.
- **Preiserhöhungen** erkennt der Kontoauszug-Import (siehe oben), weil dafür die Abbuchungen nötig sind.

Die Dienste-Tabelle (`SERVICES`) ist der einzige Ort für Namen, Gruppen und Links. Neuen Dienst = eine Zeile.

- **Abo-Kosten aufs Jahr:** Ab zwei erkannten Abos steht unter der Liste der wiederkehrenden Posten eine Zeile „Deine 6 erkannten Abos kosten zusammen … im Monat, also … im Jahr“ (nur Dienste aus `SERVICES`, jährliche anteilig).

---

# Tipps

js/budget-tipps.js, zwischen den drei Karten und der Liquiditätsvorschau (`#budget-tips`). Jeder Tipp ist ein Vorschlag: nichts passiert ohne Klick, ✕ blendet ihn aus (`budgetTippsAus`).

- **Vorlagen zum Start:** Solange es keine wiederkehrenden Posten gibt: Ausbildung, Studium, WG, Schule. Der Dialog zeigt typische Posten mit Beispielbeträgen (Stand 2026), Name und Betrag sind änderbar, übernommen wird, was angehakt ist (Startmonat = laufender Monat, mit Rückgängig). Später über das Zahnrad → „Vorlage laden“.
- **Rücklage für Jahreskosten:** Gibt es jährliche Ausgaben und noch keine Rücklage, schlägt Nook ein Sparziel „Rücklage für Jahreskosten“ vor: Ziel = Summe der Jahreskosten, monatlich ein Zwölftel (aufgerundet), finanziert aus der größten Einnahme über die Finanzierungs-Engine (ohne Einnahme: ohne Reservierung). Markiert mit `yearlyReserve: true`. Ändern sich die Jahreskosten, bietet der Tipp „Auf … anpassen“ an (Ziel und, bei genau einer Quelle, der Monatsbetrag). Ist eine Jahreszahlung in 45 Tagen fällig, sagt der Tipp, ob die Rücklage reicht. Bezahlt wird sie, indem man den Betrag aus der Rücklage abhebt.
- **Sparvorschlag am Monatsende:** In den letzten 7 Tagen eines Monats, wenn nach dem Monat und den Ausgaben vor dem nächsten Geld (`calcMonthProjection().gap`) mindestens etwas übrig bleibt: „Diesen Monat bleiben etwa … übrig. Magst du davon … in [Sparziel] stecken?“ Vorschlag = 80 % des Überschusses, auf 5 € abgerundet, höchstens was dem Ziel fehlt; wichtigstes offenes Ziel zuerst. „Einzahlen“ öffnet das Einzahlen-Fenster mit dem Betrag. ✕ blendet ihn für diesen Monat aus.
- **Bis zum nächsten Geld** (Heute-Seite, js/today-budget.js): nächste Einnahme nach heute (wiederkehrend, Taschengeld, Einmalbuchung; höchstens 45 Tage voraus). Frei = Kontostand + heute fällige/überfällige Einnahmen − alle offenen Ausgaben bis zum Vortag. Geteilt durch die Tage bis dahin. Ist nichts frei: „bis dahin ist alles verplant“.

Tests: `node --test tests/` (tests/budget-tipps.test.js).

---

# Sparziel einzahlen / abheben / Schuld bezahlen

Im Betrag-Fenster ist „Kontostand anpassen“ standardmäßig an (die letzte Wahl wird gemerkt): Einzahlen und Tilgen ziehen den Betrag vom Kontostand ab und legen eine erledigte Einmalbuchung an, Abheben schreibt ihn gut — dieselbe Regel wie bei einer erledigten Sparplan-Rate.

---

# Monatsrückblick & CSV-Export

Der Monatsrückblick (Zahnrad-Menü) zeigt ruhige Balken für Einnahmen und Ausgaben der letzten sechs Monate (wiederkehrende Posten nach heutigem Stand + Einmalbuchungen) und den Durchschnitts-Saldo; ein Klick öffnet den Monat. Der CSV-Export schreibt den angezeigten Monat (Semikolon, Dezimalkomma, UTF-8) — für Excel/Numbers, keine Buchhaltungsfunktion.

---

# Heute-Seite

Die Heute-Seite zeigt optional eine nur lesende Zeile „Heute fällig“ (js/today-budget.js, Einstellungen > Heute fällig). Sie hakt nichts ab; ein Klick öffnet Budget.

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
- Taschengeld-Einstellungen und markierte Tage

Alle Daten werden lokal gespeichert (Keys mit Präfix `budget…` plus `kontostand`, `finanzbaumLevels`, `sparplanerScenario`, `gardenActiveGoalId` — siehe `NOOK_DATA_GROUPS` in settings.js).

---

# Zuständigkeiten

Budget ist auf mehrere Dateien aufgeteilt, die zusammen den Sub-Tab-Verbund bilden (feste Ladereihenfolge):

- **budget.js** — Datenmodell-Kern, Monatsverwaltung, Berechnungen, Übersicht-Rendering, Finanzgarten, Sub-Tab-Switcher, Monatsrückblick, CSV-Export
- **budget-schatzkammer.js** — Schatzkammer-Grafiken und -Namen für den RPG-Stil
- **budget-taschengeld.js** — Taschengeld-Berechnung und Tage-Kalender
- **budget-sparziele.js** — Rendering der Sparziele (Datenquelle bleibt budgetGoals aus budget.js)
- **budget-financing.js** — Finanzierungs-/Reservierungs-Engine ("Jedem Euro einen Job"), gemeinsamer Funding-Editor
- **budget-debts.js** — Schulden/Raten
- **budget-analysis.js** — Geldfluss-Planer (Drag & Drop)
- **budget-sparprognose.js** — Sparprognose (Szenarien, Zeitstrahl, Was-wäre-wenn)
- **budget-sparplaene.js** — Sparpläne (eigenständige Spar-Vorhaben mit Einträgen)
- **budget-import.js** — Kontoauszug importieren (wiederkehrende Posten aus einem Bank-Export vorschlagen; speichert keine Buchungen)
- **budget-abos.js** — Abo-Hinweise (doppelte Abos, Kündigen-Links, Abo-Kosten aufs Jahr)
- **budget-tipps.js** — Tipps: Vorlagen zum Start, Rücklage für Jahreskosten, Sparvorschlag am Monatsende, Rechnung für „Bis zum nächsten Geld“
- (**today-budget.js** gehört zur Heute-Seite und liest nur)

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

- Diagramme
- Kategorien
- CSV-Import von Buchungen (der Kontoauszug-Import schlägt bisher nur wiederkehrende Posten vor)
- weitere automatische Sparvorschläge (der Monatsend-Vorschlag ist umgesetzt)
- mehrere Konten
- eigene Budget-Vorlagen speichern (feste Vorlagen zum Start sind umgesetzt)
- Jahresübersicht (der Monatsrückblick deckt die letzten 6 Monate ab)
- Cloud-Synchronisation

Umgesetzt: Monatsrückblick (Statistik über mehrere Monate), CSV-Export, „Heute fällig“ auf der Heute-Seite (Erinnerung), Kontoauszug-Import für wiederkehrende Posten, Abo-Hinweise, Rücklage für Jahreskosten, Sparvorschlag am Monatsende, „Bis zum nächsten Geld“, Vorlagen zum Start.

---

# Entwicklungsrichtlinien

Bei Änderungen an Budget gelten folgende Regeln:

- Budget bleibt ein persönlicher Finanzplaner.
- Planung steht vor Buchhaltung.
- Die Oberfläche bleibt ruhig, freundlich und leicht verständlich.
- Bestehende Finanzdaten müssen kompatibel bleiben.
- Motivation und Übersicht haben Vorrang vor Funktionsvielfalt.
- Änderungen am Geldfluss-Planer (budget-analysis.js) besonders sorgfältig testen — dort sind in der Vergangenheit mehrfach subtile Bugs rund um Drag & Drop und doppelte Funding-Einträge aufgetreten (siehe `testing-geldfluss.md`).
