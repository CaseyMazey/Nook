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
4. **Fortschritt**: XP, Level, Statistiken

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
| Seltenheit | normale und seltene Monster |
| Dungeons | 3 Dungeons mit je einem Hintergrund und 5 eigenen Monstern (siehe unten) |
| Pixelmonster | Casey liefert je Monster eine Grafik, gepflegt als Daten in `FB_MONSTERS` |
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
- Weitere Dungeons mit eigenen Monstern
- Animierte Hintergründe und Monster-Animationen
- Seltene Farbvarianten von Monstern und Bossen
- Cozy-Home-Haustiere (siehe Hinweis unten)
- Items und Ausrüstung
- Spielwährung
- weitere Seltenheitsstufen über normal/selten/Boss hinaus
- Tägliche Herausforderungen (die fest eingebaute Challenge „Gewinne 1 Spiel in Flashcard Battle“ in `js/games.js` bleibt bis dahin Platzhalter)
- Pixel-Editor im Spiel

---

# Dungeons

Dungeons heißen im Spiel vorerst „Räume“. Sie sind eine visuelle und inhaltliche Ebene ohne eigene Mechanik: ein statisches Hintergrundbild und eine eigene Monsterliste.

| Dungeon | Atmosphäre | Farbpalette | Gegner-Thema |
|---|---|---|---|
| 🌿 Der überwucherte Tempel | alte Ruinen, Wurzeln, magische Pflanzen | Moosgrün, Beige, Türkis | Schleime, Pflanzenwesen, Insekten |
| 🔮 Die verzauberte Bibliothek | verstaubte Bücher, schwebende Schriftrollen, Magie | Dunkelblau, Violett, Gold | Büchergeister, Fledermäuse, magische Kreaturen |
| 🌋 Die Drachenhöhlen | Kristalle, Lava, uralte Schätze | Dunkelrot, Orange, Anthrazit | Feuerwesen, Kristallmonster, Drachen |

| ID | Monster | Stufe | Dungeon | Designidee |
|---|---|---|---|---|
| `schleimling` | Schleimling | Normal | Tempel | kleiner grüner Schleim mit großen Augen |
| `pilzling` | Pilzling | Normal | Tempel | kleiner wandelnder Pilz mit gepunktetem Hut |
| `dornwusel` | Dornwusel | Normal | Tempel | Pflanzenwesen mit Ranken und kleinen Dornen |
| `moosgeist` | Moosgeist | Selten | Tempel | leuchtender Naturgeist mit schwebenden Blättern |
| `wurzelhueter` | Der uralte Wurzelhüter | Boss | Tempel | großes Pflanzenwesen mit leuchtenden Augen und gewaltigen Wurzeln |
| `flatterfrage` | Flatterfrage | Normal | Bibliothek | flatterndes, aufgeschlagenes Buch mit Auge |
| `buecherwurm` | Bücherwurm | Normal | Bibliothek | Wurm aus Buchseiten |
| `tintenrabe` | Tintenrabe | Normal | Bibliothek | schwarzer Rabe aus magischer Tinte |
| `runenwaechter` | Runenwächter | Selten | Bibliothek | schwebender Wächter mit leuchtenden Runen |
| `archivar` | Der Archivar | Boss | Bibliothek | Gestalt in Robe mit schwebenden Büchern und Seiten |
| `funkenkobold` | Funkenkobold | Normal | Höhlen | Feuerwesen aus Lava mit glühendem Kern |
| `kristallkrabbler` | Kristallkrabbler | Normal | Höhlen | kleine Kreatur mit kristallinem Panzer |
| `hoehlendrache` | Höhlendrache | Normal | Höhlen | junge Lava-Echse |
| `kristallfuchs` | Kristallfuchs | Selten | Höhlen | leuchtender Fuchs mit Kristallen am Körper |
| `urdrache` | Der Urdrache | Boss | Höhlen | mächtiger Drache mit Kristallhörnern und glühenden Schuppen |

## Einsatz in den Modi

- **Feste Räume**: Raum 1 Tempel, Raum 2 Bibliothek, Raum 3 Höhlen, Raum 4 Tempel, Raum 5 Bibliothek, Endboss in den Höhlen. Der Miniboss am Raumende ist der Boss des Dungeons (mit den Miniboss-Werten), der Endboss der Urdrache (mit den Boss-Werten).
- **Endlos und Nach Kartenanzahl**: Start in einem zufälligen Dungeon, nach jedem besiegten Boss der nächste.

## Grafiken

Die Monster sind detaillierte Illustrationen (keine Pixel-Art) von Casey. Die Originale liegen unter `assets/_raw/flashcard-battle/{dungeons,monsters}/` und werden weder committet noch deployt, also separat sichern. `python scripts/optimize-fb-assets.py` erzeugt daraus die Spiel-Versionen:

- Hintergrund: `games/flashcard-battle/assets/dungeons/<tempel|bibliothek|hoehlen>.png`, 1024 px breit
- Monster: `games/flashcard-battle/assets/monsters/<id>.png`, transparent und auf das Motiv zugeschnitten, längste Seite normal und selten 320 px, Boss 512 px; im Spiel 128 px bzw. 256 px groß

Fehlt eine Datei, zeigt das Spiel einen Farbverlauf in der Dungeon-Palette bzw. das Emoji. Vorerst gibt es genau eine Grafik pro Monster und statische Hintergründe.

## Cozy-Home-Haustiere

Vorerst komplett zurückgestellt: Im Spiel gibt es keine Haustier-Anbindung und keine Anzeige dazu. Der allgemeine Unlock-Typ `counter` in `games/cozy-home/pets.js` bleibt bestehen und liest die Zähler `defeat:<id>`, falls das später wieder aufgegriffen wird.

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
| `games/flashcard-battle/manifest.js` | Dungeons `window.FB_DUNGEONS`, Monster `window.FB_MONSTERS`, `getStats`/`resetStats`, lädt `fb-core.js` vor |
| `games/flashcard-battle/fb-core.js` | reine Spiellogik `window.FBCore` (Fragen, Schaden, Run, Fortschritt), ohne DOM und ohne DB |
| `games/flashcard-battle/flashcard-battle.js` / `.css` | UI: Setup, Kampf, Ergebnis, Kompendium, Statistik |
| `scripts/tests/fb-core.test.js` | Tests für `fb-core.js`: `node --test "scripts/tests/*.test.js"` |

- **Debug-Menü** (🐞 im Setup und im Kampf): Lesezeit, Schnellangriff-Fenster und -Bonus, Spieler-HP, Schaden, Combo, Heilung, HP/Angriff/XP je Gegnerstufe und Dungeon-Werte anpassen, im Kampf zusätzlich die aktuellen HP von Spieler und Monster sowie den Monster-Angriff. Die Werte liegen unter DB `fb_debug` und werden per `FBCore.applyConfig()` auf `CONFIG` angewendet; „Standardwerte“ löscht sie. Im Setup zeigt „Debug-Werte aktiv“, wenn etwas abweicht.
- **Karteninhalt**: Markdown wird per `FBCore.plainText()` in Klartext umgewandelt (nur Formatierung, Zeichen wie `_ * |` bleiben, Zeilenumbrüche auch). Ein Set braucht mindestens 2 unterschiedliche Antworten.
- **Speicher**: alles unter `gameHighscores['flashcard-battle']` (Siege, XP, Zähler, gesehene Monster, Streak). Wird nach jeder Antwort geschrieben, ein abgebrochener Run verliert also nichts.
- **Dungeon oder Monster ergänzen**: Eintrag in `FB_DUNGEONS` (`id`, `name`, `icon`, `colors`) bzw. `FB_MONSTERS` (`id`, `name`, `tier`, `dungeon`, `emoji`), Grafiken wie unter „Dungeons“ ablegen. Jeder Dungeon braucht mindestens ein normales Monster und einen Boss.

---

# Entscheidungen (29.10.2026)

- **Bosse und Seltenheit** sind im MVP enthalten (abweichend vom Juni-Plan), damals wegen der geplanten Haustier-Stufen.
- **Spielmodi**: Der Spieler wählt selbst zwischen Feste Räume, Endlos und Nach Kartenanzahl.
- **Boss-Position**: Feste Räume am Ende (nach 5 Räumen mit je einem Miniboss), Endlos alle X Gegner, Kartenanzahl mit der letzten Karte.
- **Minibosse** (29.10.2026): nur in „Feste Räume“, als 5. Gegner jedes Raums.
- **Dungeons** (30.10.2026): 3 Dungeons mit je 5 Monstern. „Feste Räume“ behält 5 Räume und einen Endboss, die Dungeons wechseln sich ab; die Bosse der Dungeons dienen als Minibosse. Haustiere sind zurückgestellt.
- **Kleine Sets**: weniger Antwortmöglichkeiten statt Auffüllen aus anderen Sets.
- **Monster**: Casey gestaltet sie als Assets, kein Editor im MVP.
- **Tägliche Challenge**: bleibt Platzhalter, kommt später.
- **Kartenmodus, Boss früh besiegt**: Sind noch Karten übrig, erscheint der nächste Boss. Der Run endet erst nach der letzten Karte, damit jede Karte drankommt.
- **Aufgeben/Schließen** zählt nie als Sieg, ein erreichter Endlos-Rekord bleibt aber gespeichert.
