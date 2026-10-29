# Flashcard Battle

Version: 1.0 (MVP spielbar)

Stand: 29.10.2026. Zusammengeführt aus den Plänen vom 18.06.2026 (ChatGPT-Gespräch) und Caseys Beschreibung vom 29.10.2026.
MVP umgesetzt am 29.10.2026 (Umsetzungsplan: `AI documentation/plans/2026-10-29-flashcard-battle-mvp.md`).

---

# Zweck

Flashcard Battle verbindet das Lernen mit den eigenen Karteikarten mit einem kleinen Monster-Kampf.
Man kämpft sich durch einen Dungeon, steht dort Gegnern gegenüber und beantwortet Fragen. Die Antworten entscheiden den Kampf.

Flashcard Battle ist kein zweites Karteikartenprogramm mit Monstergrafik, sondern ein kleines Lernspiel: Das Beantworten der Fragen steuert direkt das Kampfgeschehen und schaltet langfristige Belohnungen frei.

Die vier Säulen:

1. **Lernen**: Fragen beantworten, Wissen festigen
2. **Kämpfen**: Combos aufbauen, Schaden machen, Monster besiegen
3. **Sammeln**: Monster entdecken, Kompendium füllen
4. **Fortschritt**: XP, Level, Statistiken, Haustiere für Cozy Home

---

# Designprinzip

Bewusst klein anfangen. Erst ein funktionierender, spielbarer Kern, kein großes RPG.
Ein Kampf dauert etwa 2–5 Minuten.

---

# Spielablauf

1. Spiel starten → **Kartenset wählen** (Fach/Thema aus dem Karteikarten-Tab) und **Spielmodus wählen**
2. Dungeon betreten → Gegner nacheinander bekämpfen
3. Pro Zug eine Frage aus dem gewählten Set
4. **Richtige Antwort** → Gegner bekommt Schaden
5. **Falsche Antwort** → Spieler bekommt Schaden, Combo bricht ab
6. Gegner besiegt → nächster Gegner. Spieler-HP auf 0 → Run verloren

## Spielmodi

Der Spieler wählt den Modus beim Start selbst:

| Modus | Ablauf | Gewonnen | Boss |
|---|---|---|---|
| **Feste Räume** | 5 Räume mit je 5 Gegnern, der 5. Gegner jedes Raums ist ein **Miniboss**; Heilung nur nach jedem Raum | großer Boss besiegt | großer Boss nach dem letzten Raum |
| **Endlos** | Gegner werden immer stärker, bis die HP leer sind | kein Sieg, der Rekord (erreichter Raum) zählt als Highscore | alle X Gegner (Startwert 5) |
| **Nach Kartenanzahl** | Dungeon ist so lang wie das Set, jede Karte kommt einmal dran | alle Karten durch, HP > 0 | mit der letzten Karte |

Die Zahlen (Räume, Heilung, X) sind Balancing-Werte und werden beim Testen angepasst.

## Fragetypen

Die Fragen werden aus den Karteikarten erzeugt, z. B.:

- Multiple Choice mit **3 Antwortmöglichkeiten** (richtige Rückseite + 2 falsche Rückseiten anderer Karten aus demselben Set)
- Ankreuzaufgaben
- weitere Typen später möglich

Sets mit weniger als 3 Karten: **weniger Optionen** (2 Antworten). Es wird nicht mit Karten aus anderen Sets aufgefüllt. Ein Set braucht mindestens 2 Karten.

Im MVP gibt es nur Multiple Choice. Ankreuzaufgaben und weitere Fragetypen kommen später.

## Combo-System

- Jede richtige Antwort erhöht die Combo
- Längere Serien erhöhen den Schaden, Multiplikator bis maximal **x5**
- Eine falsche Antwort setzt die Combo zurück

## Lesezeit

- Jede Frage erscheint zuerst allein. Die Antworten kommen nach **10 Sekunden** Lesezeit oder früher per Klick auf „Antworten zeigen“ bzw. Leertaste/Enter.

## Kritische Treffer

- Richtige Antwort **innerhalb von 5 Sekunden nach Erscheinen der Antworten** → kritischer Treffer, **+50 % Schaden**. Die Lesezeit zählt nicht mit.

---

# MVP (erste Version)

| Feature | Inhalt |
|---|---|
| Monsterkämpfe | kurze Kämpfe, 2–5 Minuten, im Dungeon hintereinander |
| Spielmodi | Feste Räume, Endlos, Nach Kartenanzahl |
| Bosse | siehe Spielmodi |
| Seltenheit | normale und seltene Monster (für die Haustier-Freischaltung) |
| Pixelmonster | Casey gestaltet die Monster als Assets (GIMP oder `scripts/gen-image.py`), gepflegt als Daten in einer Monster-Registry |
| Schaden | richtig → Gegner, falsch → Spieler |
| Combo | bis x5 |
| Kritische Treffer | < 5 s → +50 % |
| XP und Level | durch Kämpfe aufsteigen |
| Monster-Kompendium | besiegte/entdeckte Monster sammeln |
| Statistiken | Lern- und Kampfleistung |
| Set-Auswahl | Karten aus dem Karteikarten-Tab |

## Statistiken

- Gewonnene Kämpfe
- Besiegte Monster
- Richtige Antworten
- Höchste Combo
- Kritische Treffer
- Gesammelte XP
- Lern-Streaks

---

# Bewusst später (nicht im MVP)

- Klassen
- Skills/Fähigkeiten
- Verschiedene Gebiete
- Items und Ausrüstung
- Spielwährung
- weitere Seltenheitsstufen über normal/selten/Boss hinaus
- Tägliche Herausforderungen (die fest eingebaute Challenge „Gewinne 1 Spiel in Flashcard Battle“ in `js/games.js` bleibt bis dahin Platzhalter)
- Pixel-Editor im Spiel

---

# Cozy-Home-Haustiere

Monster lassen sich durch Siege als Haustiere für Cozy Home freischalten.

| Monsterart | Benötigte Siege |
|---|---:|
| Normales Monster | 50 |
| Seltenes Monster | 25 |
| Bossmonster | 10 |

(Seltenere Monster brauchen weniger Siege, weil man sie seltener trifft.)

Technik: Im ursprünglichen Plan war eine `getPets()`-Schnittstelle vorgesehen. Im aktuellen Code deklarieren Spiele ihre Haustiere aber als `pets: [...]` direkt im `manifest.js` (Vorbild: `games/snake/manifest.js`, mit `sourceGame` und `unlock`). Diesem bestehenden Muster folgen.
`checkUnlock()` in `games/cozy-home/pets.js` kennt bisher nur `highscore` und `gamesPlayed`. Für „X Siege gegen Monster Y“ braucht es dort einen neuen Unlock-Typ.

---

# Zuständigkeiten

Flashcard Battle:

- **liest** Fächer/Gruppen/Karten aus dem Karteikarten-Tab (`subjects`, über `DB`), schreibt sie aber nie
- speichert eigenen Spielstand, XP und Statistiken unter eigenen DB-Keys
- verändert keine Lernstatistik und keine Fälligkeiten des Karteikarten-Tabs

Das Import-/Exportformat der Karteikarten (`flashcards-import-format.md`) ist ausdrücklich stabil gehalten, damit Flashcard Battle darauf aufbauen kann.

---

# Balancing-Startwerte

Alle Zahlen stehen gesammelt in `CONFIG` in `games/flashcard-battle/fb-core.js` und werden nur dort geändert:

| Wert | Start |
|---|---|
| Spieler-HP | 100 |
| Grundschaden | 10 |
| Combo | +0,5 pro Treffer in Folge, max. x5 (ab dem 9. Treffer) |
| Lesezeit | 10 s, per Klick überspringbar |
| Kritisch | Antwort unter 5 s nach Erscheinen der Antworten, ×1,5 |
| Heilung nach jedem Raum (Feste Räume) | 40 |
| Feste Räume | 5 Räume à 5 Gegner (4 + Miniboss), danach der große Boss = 26 Kämpfe |
| Endlos | Boss alle 5 Räume, Gegner +10 % HP/Angriff pro Raum |
| Kartenmodus | Boss bei ≤ 5 übrigen Karten |
| Seltene Monster | 15 % |
| Gegner normal / selten / Miniboss / Boss | 30/15/10 · 40/20/25 · 50/20/35 · 80/25/50 (HP/Angriff/XP) |
| Level | von Level L auf L+1: 100 × L XP |

---

# Technik

| Datei | Inhalt |
|---|---|
| `games/flashcard-battle/manifest.js` | Monster-Registry `window.FB_MONSTERS`, Haustier-Schwellen `window.FB_PET_WINS`, `getStats`/`resetStats`, `pets`, lädt `fb-core.js` vor |
| `games/flashcard-battle/fb-core.js` | reine Spiellogik `window.FBCore` (Fragen, Schaden, Run, Fortschritt), ohne DOM und ohne DB |
| `games/flashcard-battle/flashcard-battle.js` / `.css` | UI: Setup, Kampf, Ergebnis, Kompendium, Statistik |
| `scripts/tests/fb-core.test.js` | Tests für `fb-core.js`: `node --test "scripts/tests/*.test.js"` |

- **Debug-Menü** (🐞 im Setup und im Kampf): Lesezeit, Schnellangriff-Fenster und -Bonus, Spieler-HP, Schaden, Combo, Heilung, HP/Angriff/XP je Gegnerstufe und Dungeon-Werte anpassen, im Kampf zusätzlich die aktuellen HP von Spieler und Monster sowie den Monster-Angriff. Die Werte liegen unter DB `fb_debug` und werden per `FBCore.applyConfig()` auf `CONFIG` angewendet; „Standardwerte“ löscht sie. Im Setup zeigt „Debug-Werte aktiv“, wenn etwas abweicht.
- **Karteninhalt**: Markdown wird per `FBCore.plainText()` in Klartext umgewandelt (nur Formatierung, Zeichen wie `_ * |` bleiben, Zeilenumbrüche auch). Ein Set braucht mindestens 2 unterschiedliche Antworten.
- **Speicher**: alles unter `gameHighscores['flashcard-battle']` (Siege, XP, Zähler, gesehene Monster, Streak). Wird nach jeder Antwort geschrieben, ein abgebrochener Run verliert also nichts.
- **Monster ergänzen**: Eintrag in `FB_MONSTERS` mit `id`, `name`, `tier`, `emoji`. Für eine Grafik `sprite: 'games/flashcard-battle/assets/monsters/<id>.png'` ergänzen, ohne Grafik wird das Emoji gezeigt.
- **Haustier freischalten**: dem Monster ein `pet`-Objekt geben (Felder wie bei Snake) und unter `games/flashcard-battle/assets/pets/<id>/` die Bilder `default.png`, `icon.png` und `sleep.png` ablegen. Cozy Home prüft das über den allgemeinen Unlock-Typ `counter` (`games/cozy-home/pets.js`), der Zähler heißt `defeat:<id>`.

---

# Entscheidungen (29.10.2026)

- **Bosse und Seltenheit** sind im MVP enthalten (abweichend vom Juni-Plan), damit die Haustier-Tabelle normal/selten/Boss funktioniert.
- **Spielmodi**: Der Spieler wählt selbst zwischen Feste Räume, Endlos und Nach Kartenanzahl.
- **Boss-Position**: Feste Räume am Ende (nach 5 Räumen mit je einem Miniboss), Endlos alle X Gegner, Kartenanzahl mit der letzten Karte.
- **Minibosse** (29.10.2026): nur in „Feste Räume“, als 5. Gegner jedes Raums. Sie werden keine Cozy-Home-Haustiere (keine Stufe in `FB_PET_WINS`).
- **Kleine Sets**: weniger Antwortmöglichkeiten statt Auffüllen aus anderen Sets.
- **Monster**: Casey gestaltet sie als Assets, kein Editor im MVP.
- **Tägliche Challenge**: bleibt Platzhalter, kommt später.
- **Kartenmodus, Boss früh besiegt**: Sind noch Karten übrig, erscheint der nächste Boss. Der Run endet erst nach der letzten Karte, damit jede Karte drankommt.
- **Aufgeben/Schließen** zählt nie als Sieg, ein erreichter Endlos-Rekord bleibt aber gespeichert.
