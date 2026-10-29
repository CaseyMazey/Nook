# Flashcard Battle

Version: 0.2 (Konzept, noch keine Spiellogik)

Stand: 29.10.2026. Zusammengeführt aus den Plänen vom 18.06.2026 (ChatGPT-Gespräch) und Caseys Beschreibung vom 29.10.2026.
Aktueller Code: nur `games/flashcard-battle/manifest.js` als Platzhalter mit `comingSoon: true`.

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
| **Feste Räume** | feste Anzahl Gegner hintereinander, kleine Heilung zwischen den Kämpfen | alle Gegner besiegt | am Dungeon-Ende |
| **Endlos** | Gegner werden immer stärker, bis die HP leer sind | kein Sieg, der Rekord (erreichter Raum) zählt als Highscore | alle X Gegner (Startwert 5) |
| **Nach Kartenanzahl** | Dungeon ist so lang wie das Set, jede Karte kommt einmal dran | alle Karten durch, HP > 0 | mit der letzten Karte |

Die Zahlen (Räume, Heilung, X) sind Balancing-Werte und werden beim Testen angepasst.

## Fragetypen

Die Fragen werden aus den Karteikarten erzeugt, z. B.:

- Multiple Choice mit **3 Antwortmöglichkeiten** (richtige Rückseite + 2 falsche Rückseiten anderer Karten aus demselben Set)
- Ankreuzaufgaben
- weitere Typen später möglich

Sets mit weniger als 3 Karten: **weniger Optionen** (2 Antworten bzw. Richtig/Falsch). Es wird nicht mit Karten aus anderen Sets aufgefüllt.

## Combo-System

- Jede richtige Antwort erhöht die Combo
- Längere Serien erhöhen den Schaden, Multiplikator bis maximal **x5**
- Eine falsche Antwort setzt die Combo zurück

## Kritische Treffer

- Richtige Antwort **innerhalb von 5 Sekunden** → kritischer Treffer, **+50 % Schaden**

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

# Entscheidungen (29.10.2026)

- **Bosse und Seltenheit** sind im MVP enthalten (abweichend vom Juni-Plan), damit die Haustier-Tabelle normal/selten/Boss funktioniert.
- **Spielmodi**: Der Spieler wählt selbst zwischen Feste Räume, Endlos und Nach Kartenanzahl.
- **Boss-Position**: Feste Räume am Ende, Endlos alle X Gegner, Kartenanzahl mit der letzten Karte.
- **Kleine Sets**: weniger Antwortmöglichkeiten statt Auffüllen aus anderen Sets.
- **Monster**: Casey gestaltet sie als Assets, kein Editor im MVP.
- **Tägliche Challenge**: bleibt Platzhalter, kommt später.
