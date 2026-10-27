---
name: nook-modul-review
description: Gründliche Code-Kontrolle eines einzelnen Nook-Themas (Budget, Kalender, Heute, Projekte, Pinnwand, Karteikarten, Anleitungen, Questboard, Garten, Spiele, Tools, Einstellungen, Theme-Engine …) — sucht Fehler, Optimierungsmöglichkeiten, doppelten Code, Regelverstöße und fehlende Features und liefert NUR einen Bericht, ohne etwas umzusetzen. Nutze diesen Skill, wenn Casey ein Thema „vollständig anschauen“, „kontrollieren“, „durchchecken“, „reviewen“ oder „auf Fehler prüfen“ lassen möchte, oder ihn per /nook-modul-review <Thema> aufruft.
---

# Nook Modul-Review

Regelmäßige, gründliche Kontrolle EINES Themas. Ergebnis ist ein Bericht —
**nichts wird umgesetzt**, keine Datei im Code geändert. Erst nach Caseys
Auswahl („mach Punkt 3 und 5“) wird in einer normalen Aufgabe gebaut.

Argument: Thema, z. B. `budget`, `kalender`, `heute`. Ohne Argument: nachfragen.

## 1. Dateien des Themas sammeln

Mapping (bei Abweichungen gilt die echte Repo-Struktur — kurz mit `ls js css` prüfen):

| Thema | JS | CSS | Doku (`AI documentation/`) |
|---|---|---|---|
| Budget | `budget*.js` (budget, -taschengeld, -sparziele, -financing, -analysis, -debts, -sparprognose, -sparplaene, -schatzkammer) | `budget.css`, Budget-Teile von `pages-rpg.css` | `budget.md`, `testing-geldfluss.md` |
| Kalender | `calendar.js`, `google-calendar-*.js` | `calendar.css`, `calendar-rpg.css` | `calendar.md` |
| Heute | `today*.js`, `gruppendienste.js`, `national_day.js`, `positivity.js` | `today.css`, `today-rpg.css`, `national_day.css`, `positivity.css` | `today.md` |
| Projekte | `projects.js`, `forest.js`, `project-tree.js` | `projects.css`, `project-tree.css` | `projects.md` |
| Pinnwand | `pinboard.js` | `pinboard.css`, `pinboard-rpg.css` | — |
| Karteikarten | `flashcards.js` | `flashcards.css` | `flashcards.md` |
| Anleitungen | `guides.js` | `guides.css`, `guides-rpg.css` | `guides.md` |
| Questboard | `questboard.js` | `questboard.css`, `questboard-rpg.css` | `questboard.md` |
| Garten | `garden*.js` | `garden.css` | `garden.md` (Design-Vertrag, genau befolgen!) |
| Spiele | `games.js`, `games/**` | `games.css` | `games.md` |
| Tools | `tools*.js` | `tools.css` | — |
| Einstellungen | `settings.js`, `nook-version.js`, `sync*.js`, `pwa.js` | `settings.css` | — |
| Theme-Engine | `theme-engine.js`, Theme-Teile von `main.js` | `main.css`, `theme-engine.css`, `*-rpg.css` | — |

Dazu immer: Aufrufe des Themas aus geteilten Dateien (`main.js`, `hub-utils.js`,
`index.html`-Markup und Script-Reihenfolge) per `grep` auf die Funktions-/ID-Namen.

## 2. Lesen — vollständig, nicht stichprobenartig

- Die Dateien des Themas **ganz** lesen (bei großen Dateien in Abschnitten).
  Nicht nur greppen — viele Fehler stecken im Zusammenspiel.
- Die Doku des Themas lesen: sie ist der Design-Vertrag (Zweck, Zuständigkeiten,
  Erweiterungsregeln, „soll nicht werden“).
- `AGENTS.md` und die Skills `nook-architektur-guard` / `nook-konventionen`
  gelten als Prüfmaßstab.
- Bei Bedarf im Browser nachstellen (preview_start `nook-static`), aber nur mit
  Testdaten im Speicher (`DB.set` vorher stummschalten, danach Theme/Daten
  zurücksetzen) — niemals echte Daten verändern.

## 3. Prüfliste

1. **Fehler / Bugs** — falsche Logik, Rand- und Datumsfälle (Monatsende, Schaltjahr,
   Sommerzeit, Jahreswechsel), Rundung/Geldbeträge, `null`/leere Listen,
   Abstürze (`TypeError`), Event-Listener doppelt registriert, Zustand nach
   Löschen/Archivieren, Datenformat-Altlasten ohne Migration.
2. **Datenintegrität** — verwaiste Referenzen (IDs auf gelöschte Einträge),
   Speichern ohne `saveX()`, direkter `localStorage`-Zugriff statt `DB`,
   Backup-Gruppe in `settings.js` (`NOOK_DATA_GROUPS`) unvollständig.
3. **Doppelter Code** — gleiche Berechnung/Render-Logik an mehreren Stellen,
   Kopien von Helfern, die es schon in `main.js`/`hub-utils.js` gibt
   (Datum, Euro-Format, Farben, Modals, Code-Blöcke).
4. **Optimierung / Performance** — unnötiges Neu-Rendern, O(n²)-Schleifen,
   wiederholtes `DB.get`, große `innerHTML`-Blöcke bei jedem Tastendruck,
   Layout-Thrashing, tote/ungenutzte Funktionen, CSS-Regeln ohne Treffer.
5. **Regeln des Projekts** — feste Farben außerhalb von Illustrationen/Spielen,
   ES-Module/`fetch()` für lokale Daten, Tab greift in fremdes DOM, Theme nicht
   über `setTheme()`, RPG-/Dark-Mode-Lesbarkeit, Mobilansicht (≤480 px).
6. **Doku-Abgleich** — Code tut etwas anderes als die Doku beschreibt, Doku
   veraltet, Feature verletzt „soll nicht werden“.
7. **UX / Barrierefreiheit** — fehlende Leerzustände, unklare Texte, kein
   Bestätigen vor Löschen, Fokus/Tastatur, `title`/`aria-*`, Kontraste.
8. **Fehlende Features / Ideen** — was im Alltag fehlt, passend zur Doku
   (nichts vorschlagen, was die Doku ausschließt).

## 4. Bericht

Auf Deutsch, knapp, konkret. Jeder Punkt mit Datei:Zeile und einem Satz, *warum*
es ein Problem ist und *was* man tun würde. Nummeriert über alle Abschnitte,
damit Casey einfach „mach 2, 5 und 9“ sagen kann.

```
# Review: <Thema> — <Datum>
Kurzfazit (2–3 Sätze: Zustand, größte Baustelle)

## 🐞 Fehler            (nach Schwere: hoch → niedrig)
1. **[hoch]** Titel — `datei.js:123` — was passiert, wann, Vorschlag
## 🧹 Doppelter Code & Aufräumen
## ⚡ Optimierung
## 📏 Regelverstöße (Farben, Architektur, Doku)
## 💡 Verbesserungen & fehlende Features
## Empfohlene Reihenfolge   (Top 3–5 mit Aufwand klein/mittel/groß)
```

- **Schwere:** hoch = Datenverlust/falsche Beträge/Absturz; mittel = sichtbarer
  Fehler mit Umweg; niedrig = Kosmetik.
- Unsichere Funde ehrlich als „Verdacht“ markieren, nicht als Fakt.
- Den Bericht zusätzlich als Datei ablegen:
  `AI documentation/reviews/<thema>-<YYYY-MM-DD>.md` (Ordner wird nicht
  deployt). So lassen sich spätere Reviews vergleichen — beim nächsten Lauf
  den letzten Bericht lesen und erwähnen, was inzwischen erledigt ist.
- Im Chat: Kurzfazit + die nummerierte Liste (ggf. gekürzt auf das Wichtigste),
  mit Verweis auf die Datei für Details.

## 5. Nicht tun

- Nichts umsetzen, keine Commits außer der Berichtsdatei (nur wenn Casey das
  Committen wünscht), kein Deploy.
- Keine echten Nutzerdaten im Browser verändern.
- Keine Vorschläge, die einem Design-Vertrag (`garden.md` etc.) widersprechen,
  oder Projekte-Optik für Kuros Themes ändern (siehe Gedächtnis).
