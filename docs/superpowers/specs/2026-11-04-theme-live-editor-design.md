# Theme live bearbeiten

Stand: 4. November 2026. Status: Design freigegeben, Spezifikation zur Prüfung.

## Ziel

Eigene Themes sollen so weit gestaltbar sein wie das RPG-Theme. Heute kann der Theme-Editor pro Seite nur zwischen zwei fertigen Seitenstilen wählen (Cozy oder RPG). Der neue Modus „Theme live bearbeiten“ zeigt Nook mit Musterdaten. Auf jedem gestaltbaren Element sitzt ein Stift. Ein Klick darauf legt Bild, Farben, Schrift, Form und Befestigung genau dieses Elements fest. Das Ergebnis wird am eigenen Theme gespeichert, gilt im echten Nook und reist beim Export mit.

## Ausgangslage

- Themes liegen in `customThemes` (`js/theme-engine.js`). Seitenstile setzen Attribute wie `data-today-style="rpg"` auf `<html>`. Die RPG-Optik steckt in `css/*-rpg.css`, überwiegend als Rahmenbilder in 9-Teilung (`border-image … fill`), dazu Pins, Nägel und Siegel über `::after`.
- Eigene Bilder gibt es bisher nur für Hintergrund, Kalenderbilder, Start-Banner und Icon (`ct.bg`, `ct.images`).
- Nook speichert über `DB` in `localStorage`. Mehrere Stellen schreiben aber direkt in `localStorage`: Spiele, Garten, Einstellungen, Sync und Budget-Migration.
- Ein eingebettetes Fenster derselben Seite teilt sich `localStorage` mit dem Hauptfenster.
- Seiten melden sich schon heute selbst bei der globalen Suche an (`registerSearchProvider`). Dasselbe Muster eignet sich für gestaltbare Elemente.

## Nicht-Ziele

- Kein freies CSS. Nutzer wählen nur aus festen Einstellungen.
- Keine Gestaltung einzelner Datensätze, zum Beispiel einer bestimmten Pinnwand-Karte. Gleiche Elemente teilen sich ein Design.
- Keine getrennten Element-Designs für Tag und Nacht. Bild und Form gelten für beide, Farben folgen dem Theme, außer sie sind fest gewählt.
- Keine Bearbeitung auf dem Handy. Dort lässt sich der Modus ansehen, mit Hinweis auf größere Bildschirme.
- In Etappe 1 nur die Elemente von „Heute“ und die übergreifenden Elemente. Die übrigen Seiten folgen in eigenen Etappen.

## Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Ort der Bearbeitung | Zweites Nook in einem Vollbild-Fenster (`index.html?themeLab=1`) | Zeigt den echten Code. Echte Daten sind technisch getrennt. |
| Datentrennung | Im Fenster wird `window.localStorage` vor allen anderen Skripten durch einen Speicher im Arbeitsspeicher ersetzt | Fängt auch die direkten `localStorage`-Zugriffe ab, nicht nur `DB`. Ohne gespeicherte Sitzung ist dort niemand angemeldet, Sync und Google bleiben aus. |
| Prüfung der Trennung | Das Fenster prüft beim Start, ob der Ersatz greift. Wenn nicht, öffnet es nicht | Lieber kein Editor als Musterdaten in echten Daten. |
| Ausgangs-Theme | Ein mitgeliefertes Theme wird vorher als eigenes Theme kopiert | Presets bleiben unverändert. |
| Umfang pro Element | Bild, Farben, Schrift, Form, Befestigung, Extra-Bilder | Nötig, um RPG nachbauen zu können (Variante C). |
| Bildarten | Keins, Fläche (füllen oder kacheln), Rahmen in 9-Teilung | RPG nutzt fast nur 9-Teilung. |
| Anmeldung der Elemente | Jede Seite meldet ihre Elemente selbst an, als Datenliste | Neue Seiten brauchen keine Änderung am Editor. |
| Speicherort | `ct.skins` am eigenen Theme | Reist mit Export und Sync mit, wie `ct.images`. |
| Vorrang | Element-Design über Seitenstil. Einzelnes Element über „Alle Karten dieser Seite“ | Was man nicht anfasst, bleibt beim Seitenstil. |

## Bausteine

### `js/theme-lab-boot.js` (neu)

Steht als erstes Skript in `index.html`, vor `main.js`. Tut nur etwas, wenn die Adresse `themeLab=1` enthält.

- Ersetzt `window.localStorage` durch ein Objekt mit derselben Schnittstelle (`getItem`, `setItem`, `removeItem`, `clear`, `key`, `length`), das nur im Arbeitsspeicher lebt.
- Prüft danach, ob `window.localStorage` wirklich der Ersatz ist. Wenn nicht, setzt es `window.NOOK_THEME_LAB_FAILED = true`, und die restlichen Lab-Skripte zeigen nur eine Fehlermeldung.
- Füllt den Ersatz-Speicher mit `window.THEME_LAB_SAMPLE` (siehe unten) und dem zu bearbeitenden Theme, das das Hauptfenster per `postMessage` liefert.
- Setzt `window.NOOK_THEME_LAB = true`. Andere Dateien schalten damit Sync-Start, Google-Kalender, Service-Worker-Registrierung, Backup-Erinnerungen und Update-Prüfung ab.

### `js/theme-lab-sample.js` (neu)

Reine Daten: `window.THEME_LAB_SAMPLE = { <DB-Key>: <Wert>, … }`. Erfundene, neutrale Beispielinhalte, ohne echte Namen.

Enthält Daten für alle Seiten: Unterrichtsblöcke, Aufgaben, Gruppenpflichten, Speiseplan, Schnellnotiz, Termine, Countdowns, Karteikarten-Fächer mit Themen, Anleitungen, Projekte, Pinnwand-Karten, Questboard und Budget-Posten mit Kontostand. Jedes in Etappe 1 angemeldete Element muss mit diesen Daten sichtbar sein. Ein Speiseplan ohne Daten würde sonst gar nicht erscheinen.

### `js/theme-skins.js` (neu)

Lädt nach `theme-engine.js`. Kein Zugriff auf Speicher, rein rechnend plus ein `<style>`-Element.

- `registerSkinTarget({ id, label, view, selector, group?, extras? })`: wird von jeder Seite am Ende ihrer Datei aufgerufen. `extras` beschreibt zusätzliche Bilder, die das Element über eine CSS-Variable nutzt (zum Beispiel `--skin-clock-face`).
- `buildSkinCss(skins, targets)`: reine Funktion. Erzeugt aus `ct.skins` den Text des Stylesheets. Testbar in Node.
- `applyThemeSkins(themeId)`: schreibt das Ergebnis in `<style id="theme-skins">`. Wird von `applyThemeEngine()` aufgerufen.
- `sanitizeSkins(raw, notes)`: prüft Element-Designs aus Export-Dateien und aus dem Musterfenster. Nutzt dieselben Regeln wie der Theme-Import.

### `js/theme-lab.js` (neu)

Läuft nur im Musterfenster.

- Leiste oben: Seite wechseln, Rückgängig, Speicherbedarf, Speichern, Abbrechen.
- Legt auf jedes angemeldete Element der sichtbaren Seite einen Stift.
- Panel rechts mit den Einstellungen (siehe „Einstellungen pro Element“). Jede Änderung wird sofort mit `applyThemeSkins` sichtbar.
- „Speichern“ schickt die Designs per `postMessage` ans Hauptfenster. „Abbrechen“ fragt nach, wenn etwas geändert wurde.

### Hauptfenster (`js/theme-engine.js`)

- Knopf „Theme live bearbeiten“ im Theme-Editor und am eigenen Theme.
- Öffnet das Vollbild-Fenster und schickt das Theme hinein.
- Nimmt die Nachricht „speichern“ nur vom eigenen Fenster an (Herkunft und Quelle geprüft). Prüft mit `sanitizeSkins`, speichert in `ct.skins` und wendet das Theme neu an.
- Export und Import nehmen `ct.skins` mit und prüfen es.

## Einstellungen pro Element

1. **Bild**
   - Keins, Fläche (füllen oder kacheln) oder Rahmen in 9-Teilung.
   - Beim Rahmen: Ecken im Bild (oben, rechts, unten, links in Bildpixeln) und Randbreite am Element. Hilfslinien über der Bildvorschau zeigen die Teilung.
   - Vorlagen: die vorhandenen RPG-Bilder (Tafel, Holzschild, Pergament, Buchseiten, Brief, Notizblock, Riemen).
   - Ein Bild am Element schaltet das Bild des Seitenstils an dieser Stelle ab.
2. **Farben:** Fläche, Text, Überschrift, Akzent, Rahmenlinie. Jeweils „vom Theme“ oder fester Farbcode.
3. **Schrift:** Überschrift und Text getrennt, aus den bekannten Nook-Schriften. Größe 80 bis 140 %.
4. **Form:** Ecken 0 bis 40 px, Schatten (keiner, weich, stark), Schräglage −3° bis 3°, Innenabstand, Deckkraft 30 bis 100 %.
5. **Befestigung:** keine, Pin, Reißzwecke, Kupfernägel, Schmiedenagel, Wachssiegel (mit Farbe) oder eigenes Bild. Position links, Mitte oder rechts.
6. **Extra-Bilder**, wenn das Element welche anmeldet.
7. **Zurücksetzen:** entfernt das Design dieses Elements.

## Datenformat

```js
ct.skins = {
  'today.menu': {
    image: { mode: 'frame', data: 'data:image/webp;base64,…', slice: [48, 48, 78, 48], width: [16, 16, 26, 16] },
    colors: { surface: '#1f2a24', text: '#f2efe6', heading: null, accent: null, border: null },
    font: { heading: "'Alegreya', Georgia, serif", text: null, size: 100 },
    shape: { radius: 6, shadow: 'soft', tilt: 0, padding: null, opacity: 100 },
    fastener: { kind: 'nail', position: 'center', color: null, data: null },
    extras: { },
  },
  'today.cards': { … },   // „Alle Karten dieser Seite“
}
```

`null` heißt jeweils „vom Seitenstil bzw. Theme“. Fehlende Felder gelten als `null`.

## Elemente in Etappe 1

| ID | Element | Extras |
|---|---|---|
| `global.sidebar` | Seitenleiste | – |
| `global.nav` | Navigationseintrag | – |
| `global.nav-active` | Aktiver Navigationseintrag | – |
| `global.button` | Knöpfe | – |
| `today.cards` | Alle Karten auf Heute | – |
| `today.board` | Seitenfläche (Holzbrett) | – |
| `today.banner` | Start-Banner | – |
| `today.blocks` | Unterrichtsblöcke | – |
| `today.tasks` | Aufgaben | Lesezeichen |
| `today.duties` | Gruppenpflichten | – |
| `today.clock` | Uhr | Gehäuse, Zifferblatt |
| `today.quicknote` | Schnellnotiz | – |
| `today.minical` | Mini-Kalender | Riemen |
| `today.menu` | Speiseplan | – |
| `today.dayinfo` | „Heute ist“ | – |

Die genauen Selektoren legt der Plan fest.

## Speicher

- Hochgeladene Bilder werden verkleinert: Rahmen und Flächen höchstens 1200 px Kantenlänge, Befestigungen und Extras höchstens 256 px. Ohne Transparenz als WebP (JPEG als Rückfall), mit Transparenz als PNG.
- Die Leiste im Musterfenster zeigt den Speicherbedarf des Themes.
- Schlägt das Speichern im Hauptfenster fehl (Speicher voll), bleibt das Musterfenster offen und zeigt den Grund. Nichts geht verloren.

## Fehlerfälle

- **Datentrennung greift nicht:** Das Fenster öffnet nicht und zeigt einen Hinweis.
- **Nachricht von fremder Quelle:** wird ignoriert.
- **Unbekannte Element-IDs oder Werte** (Import, ältere oder neuere Version): werden verworfen, mit Hinweis beim Import.
- **Element gerade nicht sichtbar:** Die Musterdaten sorgen dafür, dass alle Elemente der Etappe vorhanden sind. Fehlt eines trotzdem, bekommt es keinen Stift.
- **Abbrechen mit Änderungen:** fragt nach.

## Tests

Automatisch in `desktop/test` (Node, wie die Sync-Tests):

- `buildSkinCss`: erzeugt für jede Einstellung die erwarteten Regeln, `null` erzeugt nichts, Vorrang Einzel- vor Sammelelement.
- `sanitizeSkins`: lässt gültige Designs durch und verwirft unbekannte IDs, ungültige Farben, fremde Schriften, Zahlen außerhalb der Grenzen und Nicht-Bild-Daten.
- Datentrennung: Nach dem Boot-Skript landen weder `DB.set` noch direkte `localStorage`-Schreibzugriffe im echten Speicher.

Von Hand im Browser:

- Musterfenster öffnen, den Speiseplan als Tafel mit Rahmenbild, Kreideschrift und Nagel gestalten, speichern. Das echte Nook zeigt den Speiseplan so, die echten Daten sind unverändert.
- Theme mit Element-Designs exportieren und wieder importieren.

## Etappen

1. **Grundgerüst und Heute:** Boot-Skript, Musterdaten für alle Seiten, `theme-skins.js`, `theme-lab.js`, Speichern, Export und Import, Elemente der Tabelle oben.
2. **Weitere Seiten**, jeweils eigene Etappe: Kalender, Pinnwand, Karteikarten, Budget, Anleitungen, Projekte, Questboard, Spiele und Tools. Jede Seite meldet ihre Elemente an. Der Editor ändert sich dabei nicht.
