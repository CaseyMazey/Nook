# Garden.md

Version: 0.3

---

# Zweck

Garden ist kein Farming- oder Idle-Game und kein reiner Garten-Editor.

Es ist ein kleiner, lebendiger, gemütlicher **Bilderbuch-Garten**, den man gerne öffnet und einfach eine Weile betrachtet — auch auf einem zweiten Bildschirm, während man arbeitet.

Der wichtigste Gedanke: Der Garten soll auch dann schön und interessant sein, wenn man gerade nichts tut.

---

# Das wichtigste Designprinzip

„Show the moments, not the movement."

Keine 60-FPS-Animationen, kein permanentes Wuseln, keine hektischen Idle-Animationen, keine überladene UI, keine Benachrichtigungen, kein FOMO.

Zustände wechseln sichtbar, aber selten und in klar unterscheidbaren Sprüngen (Frame 1 → Pause → Frame 2 → Pause → Frame 3 …), nicht durch flüssige Interpolation. Die Welt darf fast vollständig stillstehen und sich nur gelegentlich verändern. Der Garten soll Ruhe ausstrahlen — wie ein lebendiges Bilderbuch, nicht wie ein Effekt-Showcase.

Gilt insbesondere für Tiere/Bewohner (siehe „Beau" unten): kein flüssiges Laufen. Moment 1 zeigt eine Position/Pose, eine Weile später Moment 2 an anderer Stelle — der Weg dazwischen wird nicht gezeigt, das Gehirn ergänzt ihn selbst.

---

# Was Garden ausdrücklich NICHT sein soll

- keine hektischen Animationen, kein permanentes Wuseln
- kein FOMO, keine täglichen Pflichtaufgaben, keine Energiebegrenzung
- keine Pflanzen, die verwelken, wenn man nicht kommt
- kein „Du musst jetzt spielen"
- keine permanenten Benachrichtigungen, keine blinkenden „KLICK HIER"-Buttons
- keine Smooth-Animation um der Animation willen
- kein Zwangs-Slot-System — Beete/Anzuchtfeld sind Vorschläge, keine Regeln

**Wichtigster Design-Test** vor jedem neuen Feature:

> „Macht das den Garten schöner, lebendiger oder interessanter — oder macht es ihn nur beschäftigender?"

Bevorzugt: Features, die Atmosphäre schaffen, Neugier erzeugen, Entdeckungen ermöglichen, den eigenen Garten persönlicher machen, zum gelegentlichen Hinschauen einladen.
Nicht gewünscht: Features, die nur mehr Klicks oder täglichen Druck erzeugen.

**Das gewünschte Endgefühl:** Man öffnet Garden auf dem zweiten Bildschirm, arbeitet weiter, schaut nach einer Weile hin — vielleicht ist Beau woanders hin gelaufen, ein Schmetterling sitzt auf einer Blume, es regnet gerade, oder gar nichts Besonderes ist passiert. Der Garten ist trotzdem schön anzusehen. Nook Garden ist ein Ort, den man gerne besucht — keine weitere Aufgabe, die man erledigen muss.

---

# Umsetzungsrahmen (gilt für jede Phase)

- Bestehende Nook-Styles, Komponenten und Navigation soweit möglich weiterverwenden (siehe CLAUDE.md: Theming über `data-theme`/`data-theme-family`, `DB.get`/`DB.set` für Persistenz, `.view`/`.dash-content`/`.panel`-Konventionen).
- Keine großen Änderungen an bestehenden Nook-Komponenten oder anderen Tabs nur um Garden umzusetzen. Garden fügt sich visuell ein, bekommt aber seine eigene illustrierte Gartenwelt (`js/garden*.js`, `css/garden.css`). Bestehende Desktop-/Mobile-Layouts anderer Bereiche bleiben unangetastet.
- Implementierungsdetails, die das Konzept bewusst offen lässt (z. B. genaue Wachstumsdauer, genaue Ereignis-Frequenz), dürfen sinnvoll im bestehenden Nook-Designsprache-Rahmen entschieden werden — aber nicht so, dass sie den obigen Design-Test verletzen.

---

# Phase 1 (Basis) — aktueller Stand

Bereits umgesetzt: einheitliche Sticker-Architektur, Anzuchtfeld mit Wachstumsstufen, freies Umpflanzen/Verschieben ausgewachsener Pflanzen im Garten, Pflanzenstand (Gartenrätsel-Drop-Zone) + Pflanzendex-Grundgerüst.

## Sticker-Architektur

Jedes platzierbare Element im Garten ist EIN gemeinsamer Sticker-Datensatz in `gardenStickers` (`js/garden.js`, DB-Key `gardenStickers`) — es gibt bewusst kein eigenes Parallel-System pro Item-Art (Pflanze/Deko/Easter-Egg/…), nur unterschiedliche `type`/`tags`-Werte auf demselben Datensatz:

```js
{
  id, type: 'plant', plantId: 'anemone', tags: ['colorful', 'spring', 'flowering', 'flower'],
  scene: 'nursery' | 'canvas' | 'stand',   // wo der Sticker gerade liegt
  x, y, scale, flipX, order,               // gemeinsame Transform-/Layer-Eigenschaften
  growthStage: 'seed'|'sprout'|'young'|'grown',  // nur bei type:'plant' gepflegt
  decorationAsset, plantedAt,
}
```

- **`tags`** werden nicht redundant gespeichert, sondern live über `gardenStickerTags()`/`gardenTagsForVariant()` aus dem Katalog abgeleitet (`plant.tags` + `plant.category` + variantenspezifische Zusatz-Tags aus `GARDEN_VARIANT_TAGS`, Kategorie zählt als Tag mit — „eine Frucht" == Tag `fruit`). Tags sind komplett Englisch (interne Daten, keine UI-Strings) — Namen/Hinweistexte bleiben Deutsch. Single Source of Truth bleibt `GARDEN_PLANT_META`/`GARDEN_VARIANT_TAGS` in `js/garden-catalog.js`. Farbe/„shiny" sind bei Pflanzen mit mehreren Farbvarianten (rose, daisy, hortensie, peony, grapes, spiderlily, lemon) NICHT in `GARDEN_PLANT_META.tags`, sondern pro Datei in `GARDEN_VARIANT_TAGS` gepflegt, da sich Farbvarianten derselben Pflanze unterscheiden — `gardenTagsForVariant(plant, file)` führt beides zusammen.
- **`decorationAsset`** ist die einmal gewürfelte, danach fixe Farbvariante (z. B. `rose_red.png`). Der Körper (`baseAsset`, z. B. `stem_small.png`) wird dagegen NIE auf dem Sticker gespeichert, sondern bei jedem Rendern live aus `plantId` → Wuchsform → `GARDEN_FORM_DEFS` abgeleitet (siehe `gardenComposeVisualHTML()`) — verhindert, dass alte Sticker einen veralteten Körper "einfrieren", falls sich die Form-Zuordnung später ändert.
- **`scale`/`flipX`** sind auf jedem Sticker vorbereitet und werden beim Rendern bereits angewendet (`transform: scale(...) scaleX(...)` auf `.garden-plant-visual`) — es gibt aktuell aber noch KEINE Bedienelemente, um sie interaktiv zu ändern (Standardwerte `1`/`false` für jeden neuen Sticker). Das ist bewusst vorbereitete, aber noch nicht angeschlossene Funktionalität für eine spätere Resize-/Spiegeln-UI.
- **`order`** ist ein einfacher Zeitstempel-Ersatz für Layer/Z-Index: beim Anfassen eines Stickers (Drag-Start) wird er auf `Date.now()` gesetzt und als `z-index` gerendert — der zuletzt angefasste Sticker liegt automatisch oben.
- **Wachsen verändert nur Felder, nie das Objekt selbst**: Ein Samen ist von Anfang an ein vollständiger Sticker (`scene:'nursery'`, `growthStage:'seed'`). `gardenGrowthStage()` berechnet die aktuelle Stufe live aus `plantedAt` und schreibt sie bei jedem Nursery-Render zurück auf `sticker.growthStage` — kein Löschen/Neuerzeugen. Ist die Pflanze ausgewachsen und wird ins Beet gezogen, ändert `transplantGardenNurseryItem()` nur `scene` (`'nursery' → 'canvas'`) + `x`/`y` **desselben** Datensatzes (gleiche `id`).
- **Rendern/Ziehen ist für alle Szenen identisch**: `renderGardenCanvasPlants()`/`renderGardenNursery()`/`renderGardenStand()` sind reine Filter über `gardenStickers` nach `scene`, alle nutzen dieselbe `gardenComposeVisualHTML()`. Drag&Drop läuft für Anzuchtfeld und Garten-Fläche über dieselbe Pointer-Event-Logik (`bindGardenNurseryDrag()`/`bindGardenPlantDrag()`).
- Noch nicht real befüllt: `type` außer `'plant'` (Deko/Easter-Eggs/Bären-Plüschtier) — dafür fehlen bislang die Assets (siehe Abschnitt „Zukunft"). Die Architektur ist dafür bereits offen: ein `type:'deco'`-Sticker mit eigenen `tags` würde vom Pflanzenstand (siehe unten) ohne Codeänderung genauso akzeptiert wie eine Pflanze.
- Migration: Beim ersten Laden nach diesem Umbau werden alte, getrennte `gardenPlants`/`gardenNursery`-Arrays (falls vorhanden) einmalig in `gardenStickers` überführt und die alten DB-Keys danach gelöscht — nach demselben Migrations-Prinzip wie z. B. `migrateTasksIfNeeded` in `main.js` (siehe CLAUDE.md).

## Datenmodell (übrige Keys)

- `gardenDex` (DB-Key `gardenDex`): `{ plantId: { firstSeen, variants: { variantName: timestamp } } }` — wird beim ersten Platzieren einer Pflanze bzw. Farbvariante aktualisiert, unabhängig davon, ob die Pflanze später wieder entfernt wird.
- `gardenQuestState` (DB-Key `gardenQuestState`): `{ activeQuestId, filled: [stickerId|null, ...] }` — siehe Abschnitt „Pflanzenstand" unten.
- Katalog (`js/garden-catalog.js`, rein statisch, kein Nutzer-State): `GARDEN_ASSET_FILES` listet alle Bilddateien aus `img/decor/`. `buildGardenCatalog()` gruppiert sie automatisch über den Dateinamen-Präfix vor dem ersten `_` zu Pflanzen mit Farbvarianten (z. B. `hortensie_pink.png` + `hortensie_white.png` → eine Pflanze „Hortensie" mit zwei Varianten). Ausnahme: Präfixe in `GARDEN_STANDALONE_PREFIXES` (aktuell `berry`) werden NICHT gruppiert, weil der Namensteil vor dem `_` dort nur eine lose Kategorie ist, keine Farbvariante — `berry_strawberry.png` und `berry_blueberry.png` sind zwei komplett verschiedene Pflanzen, keine Farben derselben Beere. Eine neue Farbvariante hinzufügen heißt: Datei ablegen, Dateinamen in `GARDEN_ASSET_FILES` eintragen — fertig. Eine neue Pflanze (neuer Präfix bzw. neue Beeren-Art) braucht zusätzlich einen Eintrag in `GARDEN_PLANT_META`.
- Kategorien: `flower`, `fruit`, `nut` (Eichel/Kastanie/Haselnuss) — steuern nur, unter welcher Überschrift eine Pflanze in Palette/Dex einsortiert wird (deutsche Überschriften „Blumen"/„Obst"/„Nüsse" bleiben unverändert, nur die internen Kategorie-Keys sind Englisch), zählen für Gartenrätsel aber zusätzlich als Tag (siehe „Sticker-Architektur" oben).
- Farbvariante ist bei der Erzeugung eines Stickers fix und wird gespeichert (`decorationAsset`) — ein Reload darf die Farbe nie ändern.
- `shiny`-Varianten sind bewusst selten (`GARDEN_SHINY_WEIGHT`), alle übrigen Varianten einer Pflanze sind gleich wahrscheinlich.

## Pflanzenstand

Drop-Zone für optionale Gartenrätsel, rechts neben dem Anzuchtfeld (`#garden-stand`, `renderGardenStand()` in `js/garden.js`) — **kein zweites Pflanzenlager**. Das Pflanzen-Inventar (Palette/Tray) bleibt die einzige Quelle für neue Pflanzen; ein Ziehen aus der Palette auf den Pflanzenstand erzeugt einen neuen Sticker direkt mit `scene:'stand'` (kein Umweg über das Anzuchtfeld — der Pflanzenstand ist kein Wachstumsort).

- `GARDEN_QUESTS` (`js/garden-catalog.js`, statisch): Liste von Rätseln, jedes mit `slots: [{ tag, hint }, ...]`. Rein tag-basiert geprüft (`tryFulfillGardenQuestSlot()`) — kennt keine Pflanzen-Sonderfälle, ein künftiger `type:'deco'`- oder Easter-Egg-Sticker mit passendem Tag würde genauso akzeptiert.
- Ein Ziehen aus der Palette sucht den ersten noch offenen Slot, dessen `tag` in den Tags der gezogenen Pflanze enthalten ist. Passt keiner, wird nichts abgelegt (kurze Rückmeldung über die vorhandene Discovery-Note). Reihenfolge der befüllten Slots entspricht der Ablage-Reihenfolge (`gardenQuestState.filled`, Index = Slot).
- Sind alle Slots befüllt, gilt das Rätsel als gelöst: kurze Erfolgs-Meldung, die abgelegten Sticker werden entfernt, ein neues (zufälliges, nicht dasselbe) Rätsel wird aktiv. Aktuell ohne Belohnung (kein Münzen-System, siehe „Zukunft") — rein zur Beobachtung/zum Spielen mit den Tags gedacht.
- Optischer Rahmen: `img/garden/stall.png` (1671×941) als vollständige Szene, gleiches Cover/Aspect-Ratio-Prinzip wie `garden1.png`/„cultivation plot.png" (siehe oben) — Rätseltext + Slots liegen als eigener Layer auf der Theke, in festen warmen Holz-/Cremetönen statt Theme-Variablen, damit sie über dem Foto immer lesbar bleiben. Siehe `.garden-stand`/`.garden-stand-content` in `css/garden.css`.

## Pflanzen-Visual: Körper + Blüte/Frucht

Die meisten Dateien in `img/decor/` sind **keine vollständigen Pflanzen**, sondern nur Blüte, Frucht oder ein anderes dekoratives Element (z. B. `rose_red.png` ist nur die Blüte). Damit im Garten trotzdem eine vollständige Pflanze zu sehen ist, wird jede Pflanze aus zwei Ebenen zusammengesetzt:

1. **Körper** — einer von 9 generischen Pflanzenkörpern in `img/decor/` (`seedling.png`, `stem_small.png`, `stem_tall.png`, `bush_small.png`, `bush_large.png`, `berry_bush.png`, `groundcover.png`, `vine.png`, `hanging_plant.png`), plus `seed.png` für die allererste Wachstumsstufe (siehe unten). Diese sind für alle Pflanzen gleich — keine eigenen Körper-Sprites pro Pflanzenart nötig.
2. **Blüte/Frucht** — das eigentliche Katalogbild (die gespeicherte Farbvariante der Instanz), auf den Körper gesetzt.

Jede Pflanze hat in `GARDEN_PLANT_META` (`js/garden-catalog.js`) ein Feld `form`, das auf einen Eintrag in `window.GARDEN_FORM_DEFS` verweist:

| `form` | Körper (jung → ausgewachsen) | Beispiele |
|---|---|---|
| `flower` | `stem_small.png` → `stem_small.png` | Rose, Lilie, Sonnenblume |
| `tree` | `stem_small.png` → `stem_tall.png` | Apfel, Kirsche, Zitrone, alle Obstbäume |
| `bush` | `bush_small.png` → `bush_large.png` | Hortensie, Hibiskus, Tomate |
| `berry` | `berry_bush.png` → `berry_bush.png` | alle `berry_*`-Beeren |
| `vine` | `vine.png` → `vine.png` | Glyzinie/Wisteria, Weintrauben, Passionsblume |
| `hanging` | `hanging_plant.png` → `hanging_plant.png` | Fuchsie, Tränendes Herz |
| `groundcover` | `groundcover.png` → `groundcover.png` | Gänseblümchen, Lotus |

`GARDEN_FORM_DEFS` legt außerdem pro Form eine oder mehrere Anker-Positionen fest (Prozentwerte innerhalb des Körperbildes), an denen die Blüte/Frucht sitzt — bei `bush`/`berry`/`vine`/`hanging`/`groundcover` mehrere Anker (mehrere Blüten/Früchte über den Körper verteilt), bei `flower`/`tree` genau einer (an der Stängel-/Kronenspitze). `gardenComposeVisualHTML()` in `js/garden.js` baut daraus die verschachtelte `<div class="garden-plant-visual">`-Struktur (Körperbild + ein `<img class="garden-plant-bloom">` pro Anker).

Die genaue Position/Rotation/Größe jeder Blüte um ihren Anker herum ist "leicht zufällig" gestreut (`gardenBloomJitter()`), aber **deterministisch aus der Instanz-ID abgeleitet** statt bei jedem Render neu gewürfelt — dieselbe Pflanze sieht nach jedem Reload exakt gleich aus, ohne dass die Streuung zusätzlich gespeichert werden müsste.

Formen mit zwei Körpergrößen (`bush`, `tree`) zeigen dadurch automatisch einen sichtbaren Größensprung beim Wachstum; Formen mit nur einem Körper-Asset (`berry`, `vine`, `hanging`, `groundcover`) zeigen den Wachstumsschritt ausschließlich am Erscheinen der Blüte/Frucht.

## Garten-Ansicht & Anzuchtfeld

- **`#garden-canvas`** (Garten-Fläche) und **`#garden-nursery`** (Anzuchtfeld) sind zwei getrennte, untereinander stehende Container, jeder mit einem vollständigen Illustrations-Hintergrund als eigenem `background-image` (nicht mit CSS erzeugt, keine Platzhalter): `img/garden/garden1.png` (Garten-Szene) bzw. `img/garden/cultivation plot.png` (Anzuchtfeld-Szene). Jeder Container übernimmt per `aspect-ratio` exakt das Seitenverhältnis seines Bildes, `background-size: cover` deckt die Fläche dadurch ohne Zuschneiden oder Verzerren ab. Pflanzen liegen als eigene, absolut positionierte `<img>`-Elemente darüber — die Hintergrundbilder selbst werden nie verändert. Gilt unverändert in beiden Themes (ein Foto braucht keine Theme-Einfärbung).
- Klick auf einen Katalogeintrag in der Palette pflanzt einen Samen ins Anzuchtfeld statt sofort eine ausgewachsene Pflanze zu erzeugen. Farbvariante wird sofort fix gewählt (siehe oben) und in `gardenNursery` (DB-Key `gardenNursery`) gespeichert: `{ id, plantId, file, x, y, plantedAt }`. Position im Anzuchtfeld wird automatisch/zufällig vergeben, nicht vom Nutzer gewählt.
- Wachstum läuft in vier sichtbar unterschiedlichen Stufen (Standard-Dauer je Stufe in `GARDEN_DEFAULT_DURATIONS_MS` in `js/garden.js`, bewusst gewählte Startwerte): **Samen** (`seed.png`, 5 Min.) → **Keimling** (`seedling.png`, 10 Min.) → **junge Pflanze** (plantentyp-spezifischer Körper ohne Blüte/Frucht, siehe oben, 15 Min.) → **ausgewachsen** (Körper + Blüte/Frucht). Insgesamt 30 Min. von Samen bis ausgewachsen. `gardenStageDurations()` ist die einzige Stelle, die die tatsächlich verwendete Dauer liefert (Standardwerte oder, falls gesetzt, der Debug-Override aus `gardenDebugDurationsMs`, siehe unten) — Wachstum läuft über echte verstrichene Zeit seit `plantedAt`, unabhängig davon ob der Garten offen ist.
- Über jeder noch wachsenden Anzuchtfeld-Pflanze zeigt ein kleiner Countdown (`mm:ss`) die verbleibende Zeit bis zur nächsten Stufe (`gardenNextStageRemainingMs()`) — bei „ausgewachsen" verschwindet der Countdown.
- Erst **ausgewachsene** Anzuchtfeld-Einträge sind per Drag herausziehbar. Loslassen innerhalb von `#garden-canvas` pflanzt an dieser Stelle um: Eintrag wandert von `gardenNursery` nach `gardenPlants`. Loslassen im Anzuchtfeld selbst tut nichts.
- Ein Timer (1s-Intervall, nur aktiv solange die Garten-Unteransicht offen ist und noch etwas wächst) rendert das Anzuchtfeld neu, damit Countdown und Stufenwechsel live sichtbar sind. Pausiert automatisch, während eine ausgewachsene Pflanze gerade per Drag gezogen wird, damit das Rendering die laufende Geste nicht unterbricht.
- In `#garden-canvas`: Anklicken+Ziehen verschiebt eine bereits gepflanzte Pflanze frei, ohne Kosten oder Einschränkung.
- Tray/Palette unter dem Anzuchtfeld listet den Katalog (gruppiert nach Blumen/Obst/Nüsse). Klick auf einen Katalogeintrag pflanzt einen Samen ins Anzuchtfeld (siehe oben).

### Debug: Wachstumszeiten (vorübergehendes Test-Werkzeug)

Kleines, klar als „🐛 Debug" gekennzeichnetes, eingeklapptes Panel unter der Pflanzen-Palette (`.garden-debug` in `index.html`/`css/garden.css`, Logik in `js/garden.js`) — dient nur zum schnellen manuellen Testen des Wachstumssystems (z. B. alle drei Stufen auf 5 Sekunden stellen) und ist **kein** Teil des eigentlichen Garten-Designs. Überschreibt `gardenDebugDurationsMs` (DB-Key, rein lokal), wovon `gardenStageDurations()` liest — da die Wachstumsstufe bei jedem Render live aus `plantedAt` + aktueller Dauer berechnet wird, wirkt eine Änderung automatisch sofort auch auf bereits laufende Pflanzen, nicht nur auf neu gepflanzte. „Zurücksetzen" löscht den Override wieder (zurück zu `GARDEN_DEFAULT_DURATIONS_MS`). Sollte entfernt werden, sobald das Wachstumssystem nicht mehr aktiv weiterentwickelt wird.

## Pflanzendex

- Zeigt jede Katalog-Pflanze; unentdeckte erscheinen als „???"-Kachel.
- Entdeckte Pflanzen zeigen Bild, Name, „x/y Varianten entdeckt" und das Erstentdeckungsdatum.
- Entdeckung passiert automatisch beim ersten Platzieren — kein extra Klick, nur eine kleine, kurz sichtbare Notiz im Garten selbst.

---

# Zukunft — detaillierter Fahrplan

Aus dem Gesamtkonzept, in ungefährer Reihenfolge sinnvoller nächster Schritte. Nichts davon ist Teil der Basis (Phase 1).

## A. Gartenfläche als illustrierte Landschaft

Die Hauptfläche soll langfristig eine große, zusammenhängende illustrierte Landschaft sein statt einer einfarbigen Fläche: freie Rasenflächen, vorbereitete Blumenbeete, natürliche Bereiche, feste Plätze für größere Bäume, Wege/Landschaftselemente. Soll schon schön aussehen, wenn der Garten noch fast leer ist. Beete/vorgesehene Plätze sind **Vorschläge, keine Zwangs-Slots** — Pflanzen dürfen auch außerhalb platziert werden.

## B. Beau, die Katze

Kein Minigame, keine Bedürfnisse/Hungerbalken, keine Pflicht ihn zu versorgen. Wandert selbstständig zwischen wenigen Zuständen (steht/läuft-Pose an Position A, später an Position B — Bewegung dazwischen wird nicht gezeigt), z. B.: schläft unter einem Baum, sitzt auf einer Bank, steht bei Blumen, sitzt am Teich, beobachtet einen Schmetterling. Per Klick streichelbar. Eigener Beau-Shop für rein kosmetische Accessoires (Schleife, Halstuch, Hut, Blumenkranz, Bienchen-Accessoire, Apfel-Halsband, Winterschal, …).

## C. Lebendige Ereignisse

Seltene, unaufdringliche Ereignisse statt Dauerbetrieb: Schmetterling erscheint, Vogel landet, Beau wechselt Ort, eine Frucht liegt am Boden, eine Blüte öffnet sich, Regen beginnt, Regenbogen erscheint, seltene Pflanze wird entdeckt, eine kleine Fee erscheint. Ziel: „Oh, da ist gerade etwas passiert" — nicht permanent, nicht planbar erzwungen.

## D. Die Fee & Shiny-Verwandlung

Sehr selten kann eine kleine Gartenfee erscheinen. Besitzt der Garten eine Pflanze, für die eine Shiny-Version existiert, kann die Fee diese Pflanze in ihre Shiny-Variante verwandeln. Muss selten, nicht planbar, nicht farmbar und ruhig inszeniert bleiben — keine Effektshow, kein tägliches Event.

## E. Mystery-Samen

Beim ersten Öffnen des Gartens an einem neuen Tag: eine kleine freundliche Willkommensnachricht mit einem Mystery-Samen. Kann jederzeit gepflanzt werden, verfällt nie, erzeugt keinen Zeitdruck.

## F. Pflanzendex — Erweiterung

Zusätzlich zu Phase 1 (Bild, Name, Varianten, Erstentdeckung) langfristig: erstmals gepflanzt/geerntet, Anzahl gepflanzt/geerntet, Eigenschaften/Tags-Anzeige (siehe H). „Geerntet" setzt eine Ernte-Aktion voraus, die es in Phase 1 noch nicht gibt (aktuell keine Unterscheidung zwischen Zierpflanze und Ernten).

## G. Pflanzen-Tags & Gartenrätsel

**Basis bereits umgesetzt** (siehe Phase 1, Abschnitt „Pflanzenstand"): Jede Pflanze hat mehrere Eigenschaften/Tags (Farbe, fruit/flower/nut, tree/bush/hanging/vine, exotic, Jahreszeit, botanical_*, edible/flowering, …) über `GARDEN_PLANT_META.tags` + `GARDEN_VARIANT_TAGS` (Farbvarianten/„shiny", siehe „Sticker-Architektur" oben). Tag-Werte sind Englisch, Rätsel-Hinweistexte bleiben Deutsch. Der Pflanzenstand prüft Rätsel-Slots rein über diese Tags — keine Aufgabe wird einzeln programmiert.

Noch offen: Münzen als Belohnung (aktuell kein Wirtschaftssystem, siehe „I. Laden & Münzen"), Rätsel mit strikt vorgegebener Ablage-Reihenfolge statt „passt in irgendeinen offenen Slot", größerer `GARDEN_QUESTS`-Pool.

### Hidden Achievements (Easter Eggs)

Kleine humorvolle Sammel-Achievements, die Tag-Mehrdeutigkeiten ausnutzen — z. B. „Pflanze eine rote Frucht" mit einer Tomate lösen (botanisch eine Frucht) löst ein verstecktes Achievement wie „Botanischer Meister" aus; eine Reihe ähnlicher botanischer Gemüse-als-Frucht-Pflanzen (Tomate, Gurke, Kürbis, Paprika, Aubergine, Chili, Avocado, …) könnte ein Sammel-Achievement ergeben. Ebenso: ein Bärenplüsch aus dem Shop als absurde „gültige" Lösung für „Pflanze eine Beere" akzeptieren, mit eigenem Achievement. Der Witz wird nicht erklärt — er soll selbst entdeckt werden.

## H. Gartenchronik / Ereignislogbuch

Während Garden offen ist, werden ausgewählte, interessante Ereignisse (nicht jede Kleinigkeit) automatisch mit Zeitstempel protokolliert, z. B. „Ein Schmetterling hat die Hortensien besucht", „Beau schläft unter dem Apfelbaum", „Eine Rose wurde in eine Shiny-Variante verwandelt", „Es hat angefangen zu regnen". Zweck: Wer während der Arbeit etwas verpasst, kann später nachlesen, was währenddessen passiert ist.

## I. Laden & Münzen

Kleiner Laden, finanziert durch Rätsel-Münzen. Drei Bereiche: Samenpakete (thematisch, z. B. Frühlingspaket, Obstpaket, exotische Pflanzen, Mystery-Paket), Gartendeko (Bänke, Tische, Laternen, Vogelhäuschen, Zäune, Wegsteine, Brunnen, Teich, Blumentöpfe, Schubkarre, Gießkanne, Gartenfiguren), Beau-Accessoires. Kreislauf: Rätsel → Münzen → Laden → Samen/Deko/Accessoires → schönerer Garten → mehr Entdeckungen. Nutzung dieses Kreislaufs bleibt optional, kein Zwang.

## J. Atmosphäre — Tageszeit & Wetter

Licht verändert sich langsam über den Tag (Morgen/Tag/Abend/Nacht), gelegentlich Wetterwechsel (Sonne/Regen/Nebel/Schnee). Immer subtil, keine Effektshow.

## K. Langfristige Erweiterungen

Weitere Gartenbereiche (Obstgarten, Blumengarten, Wald, Teich, Gewächshaus, geheimnisvoller Garten), weitere Tiere/Pflanzenfamilien, Fotomodus, Pflanzenkombinationen mit kleinen Effekten, seltene Besucher, saisonale Inhalte, weitere Hidden Achievements.

---

# Zuständigkeiten

`js/garden.js` + `js/garden-catalog.js` + `css/garden.css` sind verantwortlich für:

- Katalog-Aufbau aus den `img/decor/`-Assets
- Platzieren/Verschieben/Entfernen von Pflanzen-Instanzen (und künftig: Anzuchtfeld/Wachstum)
- Pflanzendex-Anzeige und Entdeckungs-Logik
- eigene Persistenz (`gardenPlants`, `gardenDex`, `gardenActiveSubtab`, künftige Garden-Keys)

Nicht verantwortlich für:

- Projektbäume/Wald (`js/project-tree.js`, `js/forest.js`) — eigenständiges System. Die fünf Projektbaum-Varianten samt Herbstversion bleiben unverändert; Garden darf die Optik aufgreifen, aber kein eigenes Baum-System auf deren Kosten bauen
- Budget/Münzen-Ökonomie außerhalb von Garden
- Cozy-Home-Haustiersystem (`games/cozy-home/`) — Beau ist ein eigenständiger Garten-Bewohner, keine Cozy-Home-Integration

---

# Entwicklungsrichtlinien

- Jedes neue Feature muss den „wichtigsten Design-Test" oben bestehen, bevor es gebaut wird.
- Keine großen Änderungen an bestehenden Nook-Komponenten/Tabs nur um ein Garden-Feature umzusetzen (siehe „Umsetzungsrahmen").
- Neue Pflanzen-Assets: Datei in `img/decor/` + Dateiname in `GARDEN_ASSET_FILES` reicht für eine neue Farbvariante. Neue Pflanze (neuer Namens-Präfix, oder neue Art unter einem Standalone-Präfix wie `berry`) zusätzlich mit Eintrag in `GARDEN_PLANT_META`. Falls ein neuer Präfix nur eine lose Kategorie ist (mehrere unterschiedliche Pflanzen, keine Farbvarianten derselben Pflanze), gehört er in `GARDEN_STANDALONE_PREFIXES`.
- Keine Spielmechanik, die tägliches Wiederkommen erzwingt oder bestraft, wenn man nicht kommt.
- Farbvariante einer bestehenden Instanz ist unveränderlich, sobald sie erzeugt wurde (Ausnahme: bewusste Fee-Verwandlung, siehe Zukunft E).
