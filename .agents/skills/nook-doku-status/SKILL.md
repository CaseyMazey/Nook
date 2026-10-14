---
name: nook-doku-status
description: Pflegt automatisch ein "Momentan in Bearbeitung"-Label in der Nook-Projektdokumentation (README.md / GitHub-Wiki-Übersicht), sobald Casey an einem Nook-Thema arbeitet (Budget, Projekte, Kalender, Karteikarten, Tools, Spiele, Pinnwand, Einstellungen, ...). IMMER am Ende jeder Aufgabe im Nook-Repo aufrufen, auch wenn nicht explizit nach Doku gefragt wurde — das Label-Update ist Teil jeder Code-Änderung, nicht ein separater Auftrag. NICHT verwechseln mit dem In-App-Tab "Wiki" von Nook selbst (das ist eine Nook-Funktion, keine Projektdokumentation) — dieser Skill betrifft ausschließlich die externe Projektdoku (README.md bzw. GitHub-Wiki-Repo).
---

# Nook – Bearbeitungsstatus-Label (Modul von "Doku & Pflege")

## Zweck

Wenn Casey an einem Nook-Thema arbeitet, soll die Projektdoku automatisch zeigen, woran
gerade gearbeitet wird — per Label hinter dem Themennamen, z. B.:

```
## Budget 🔧 *Momentan in Bearbeitung*
```

Das Label wird **nur beim ersten Task zu einem Thema** gesetzt. Arbeitet Casey mehrere
Tage am selben Thema weiter, bleibt es unverändert stehen. Wechselt Casey das Thema,
wandert das Label automatisch mit: alt entfernen, neu setzen.

## Bindende Nook-Regeln (gelten auch für Doku-Änderungen)

- Bestehende Architektur/Struktur der Doku respektieren, keine Neustrukturierung
- Nur die Label-Zeile ändern, sonst nichts — chirurgische Edits, kein Reformatieren
  ganzer Abschnitte
- Keine Duplikate: wenn irgendwo bereits ein Label steht, das verschieben statt ein
  zweites zu erzeugen
- Label-Format/Wording einheitlich halten, keine neue Variante pro Thema erfinden
- Erweiterbar bauen: neue Themen sollen sich ohne Logikänderung ergänzen lassen
  (siehe Themen-Mapping unten — das ist eine Datenliste, keine Verzweigung im Code)

## Ablauf (am Ende jeder Aufgabe, nicht am Anfang)

### 1. Betroffenes Thema ermitteln

Nicht aus der Formulierung des Auftrags ableiten, sondern aus den tatsächlich
geänderten/neuen Dateien:

```bash
git diff --name-only HEAD
# bzw. bei noch nicht committeten Änderungen:
git status --porcelain
```

Jede Datei über das Themen-Mapping (unten) einem Thema zuordnen. Dateien, die keinem
Thema zugeordnet werden können (globale/geteilte Dateien wie `main.js`, `hub-utils.js`,
globale CSS-Tokens), bei der Themenbestimmung **ignorieren** — die gehören zu keinem
einzelnen Thema.

**Ergebnis der Zuordnung:**
- **Genau ein Thema betroffen** → das ist das aktuelle Thema, weiter mit Schritt 2.
- **Kein Thema betroffen** (nur globale Dateien) → nichts tun, bestehendes Label bleibt
  unangetastet.
- **Mehrere Themen klar betroffen** (z. B. echte Arbeit an Budget *und* Projekte in
  einem Task) → nicht raten. Bestehendes Label unverändert lassen und Casey am Ende
  der Zusammenfassung kurz darauf hinweisen, dass hier manuell entschieden werden muss.

### 2. Aktuellen Doku-Zustand einlesen

Doku-Quelle in dieser Reihenfolge prüfen (erste vorhandene nehmen):

1. Lokaler Klon des GitHub-Wikis, falls im Repo/Workspace vorhanden
   (`<repo>.wiki` bzw. `CaseyMazey/Nook.wiki`), konkret die Übersichtsseite, auf der
   alle Themen mit Link aufgelistet sind (vermutlich `Home.md`)
2. Sonst `README.md` im Hauptrepo, Abschnitt mit der Themen-/Feature-Übersicht

> Platzhalter — von Codex beim ersten Lauf gegen das echte Repo zu verifizieren:
> genauer Dateipfad und exakte Überschriften-Syntax der Themenliste.

Datei nach dem aktuellen Label-String durchsuchen (z. B. `🔧` oder
`Momentan in Bearbeitung`), um herauszufinden, ob und wo es aktuell gesetzt ist.

### 3. Entscheiden

- **Label steht bereits beim ermittelten Thema** → nichts tun. Das ist nicht der erste
  Task zu diesem Thema, alles bleibt wie es ist.
- **Label steht bei einem anderen Thema** → Label dort entfernen, beim ermittelten
  Thema setzen. Das ist der Themenwechsel.
- **Kein Label irgendwo gesetzt** → Label beim ermittelten Thema neu setzen. Das ist
  der allererste Task überhaupt bzw. nach einem manuellen Reset.

### 4. Ändern & committen

- Nur die betroffene(n) Zeile(n) anfassen, Rest der Datei unverändert lassen
- Diff vor dem Schreiben kurz prüfen (Zeilenanzahl-Delta = erwartete Änderung, nicht mehr)
- Separaten, kleinen Commit für die Doku-Änderung machen, getrennt vom eigentlichen
  Feature-Commit — z. B.:
  ```
  docs(status): Bearbeitungs-Label von Budget zu Projekte verschoben
  ```
  (bzw. „... Label für Budget gesetzt" beim ersten Mal)

## Themen-Mapping (Platzhalter — gegen echte Repo-Struktur verifizieren/erweitern)

| Datei-/Ordnermuster                          | Thema         |
|-----------------------------------------------|---------------|
| `budget*.js`, `budget-*.js`                   | Budget        |
| `calendar*.js`, `kalender*.js`                | Kalender      |
| `flashcards*.js`, `karteikarten*.js`          | Karteikarten  |
| `projekte*.js`, `projektwald*.js`             | Projekte      |
| `tools/*.js`, `tools*.js`                     | Tools         |
| `games/**`, `games.js`, `games.css`           | Spiele        |
| `pinboard*.js`, `pinnwand*.js`                | Pinnwand      |
| `guides*.js`, `library*.js`                   | Guides        |
| `positivity*.js`                              | Positivity    |
| `settings*.js`, `einstellungen*.js`           | Einstellungen |
| `today*.js`, `heute*.js`                      | Heute         |
| `wiki*.js` *(In-App-Tab, nicht die Doku!)*    | Wiki (In-App) |
| `main.js`, `hub-utils.js`, globale `*.css`    | — (ignorieren, siehe Schritt 1) |

Neue Themen einfach als weitere Zeile ergänzen, keine Logik anfassen.

## Randfälle

- **Mehrere Themen in einem Task** → siehe Schritt 1, nicht automatisch entscheiden.
- **Rein globale/geteilte Änderung** → Label bleibt unangetastet.
- **Casey pausiert Nook-Arbeit länger** → es gibt aktuell keinen automatischen Timeout,
  das Label bliebe stehen bis zum nächsten Themenwechsel. Falls gewünscht: optionaler
  manueller Trigger „Nook: Bearbeitungsstatus zurücksetzen", der das Label ohne neues
  Ziel entfernt. Nicht automatisch implementieren, nur auf expliziten Wunsh.
- **Label-Text/Format ändern** → einheitlich an einer Stelle in diesem Skill pflegen,
  nicht pro Thema individuell formulieren.

## Beispielablauf

1. Tag 1, Task 1: Casey lässt an `budget-sparziele.js` arbeiten → Thema = Budget, kein
   Label gesetzt → Label wird bei Budget gesetzt, Commit `docs(status): ...`
2. Tag 1, Task 2 und Tag 2, Task 1–3: weitere Arbeit an Budget-Dateien → Label steht
   schon bei Budget → keine Doku-Änderung
3. Tag 3: Casey lässt an `projekte-routing.js` arbeiten → Thema = Projekte, Label steht
   noch bei Budget → Label von Budget entfernen, bei Projekte setzen, Commit
