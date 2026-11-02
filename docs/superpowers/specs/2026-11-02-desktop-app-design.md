# Nook als Desktop-App (Design)

Stand: 2026-11-02

## Ziel

Andere Menschen können Nook als richtige App für Windows, macOS und Linux über
GitHub Releases von `CaseyMazey/Nook` herunterladen. Die App aktualisiert sich,
soweit das ohne Signatur möglich ist, selbst.

Erfolgreich ist das Vorhaben, wenn:

- ein Git-Tag ohne weitere Handarbeit einen Release mit Downloads für alle drei
  Systeme erzeugt,
- Nutzerdaten Updates und Neustarts überstehen,
- keine privaten Dateien in den Downloads landen,
- Nook weiter ohne Build per `index.html` läuft und der Cloudflare-Deploy
  unverändert funktioniert.

## Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Zielgruppe | Andere Nutzer, alle Desktop-Systeme | Vorgabe von Casey |
| Technik | Electron mit `electron-builder` und `electron-updater` | Gleiche Darstellung überall, ausgereifte Updates über GitHub Releases |
| Adresse der App | Eigenes Protokoll `app://nook/` | Stabiler Ursprung für `localStorage`, keine Portkonflikte |
| Signatur | Vorerst keine | Kosten; Warnungen werden im README erklärt |
| Google-Kalender | In Version 1 aus | Google akzeptiert das Protokoll nicht als OAuth-Ursprung |
| Sync | In Version 1 aus | `js/sync-config.js` ist nicht im Repo und kommt nicht ins Paket |
| CDN-Inhalte | Bleiben online | Ohne Internet laufen Ersatzschriften, nur der PDF-Export fehlt |

## Aufbau

Neue Dateien:

- `desktop/package.json`: Abhängigkeiten, Build-Konfiguration, feste `appId`
- `desktop/main.js`: Hauptprozess (Protokoll, Fenster, Updates)
- `desktop/` enthält außerdem die Skripte für Paketinhalt, Paketprüfung und Smoke-Test
- `.github/workflows/release.yml`: Release-Build

Der App-Code im Hauptordner bleibt bis auf den Hinweistext (siehe unten)
unverändert, ein Build-Schritt für die Web-Version entsteht nicht.
`.assetsignore` schließt `desktop/`, `.github/` und `docs/` vom
Cloudflare-Deploy aus.

### Laden der App

`main.js` registriert `app` vor dem Start als privilegiertes Protokoll
(`standard`, `secure`, `supportFetchAPI`) und liefert Dateien aus dem Paket aus.
Pfade, die aus dem Paketordner herausführen, werden abgewiesen.

Die Kombination aus `appId` und `app://nook` ist ab dem ersten Release fest und
darf sich nie mehr ändern, weil sonst der `localStorage` scheinbar verschwindet.
Deinstallation und Neuinstallation behalten die Daten, solange der
Benutzerdaten-Ordner erhalten bleibt. Der Windows-Installer löscht ihn deshalb
nicht.

### Service Worker

`index.html` registriert `sw.js`. Die Umsetzung prüft, wie sich das unter `app://`
verhält. Schlägt die Registrierung fehl, darf das Nook nicht beeinträchtigen, weil
in der App ohnehin alle Dateien lokal liegen. Ein Fehler beim Start wäre ein Bug,
den der Smoke-Test abfangen muss.

### Sicherheit und Fenster

- `contextIsolation` an, `nodeIntegration` aus, `sandbox` an
- Externe `http(s)`-Links öffnen im Standardbrowser, die App navigiert nie selbst
  auf fremde Seiten
- Fenstergröße und -position werden in einer Datei im Benutzerdaten-Ordner gespeichert

### Paketinhalt

Ein Skript kopiert die Laufzeitdateien anhand der Ausschlüsse aus `.assetsignore`
in einen Staging-Ordner, wie es `scripts/deploy.ps1` schon tut. Im Paket liegen
damit dieselben Dateien wie auf Cloudflare. `js/sync-config.js` fehlt zusätzlich.

Die Paketprüfung bricht den Build ab, wenn im Staging-Ordner einer dieser Treffer
vorkommt: `Backups/`, `*.xcf`, `*.docx`, `*.xlsx`, `*.keystore`, `*.jks`,
`js/sync-config.js`, `AI documentation/`, `.git/`.

Weil GitHub Actions nur versionierte Dateien sieht, fehlen dort lokale Dateien
ohnehin. Lokale Builds auf Caseys Rechner sehen sie aber, daher gilt die Prüfung
für beide Wege.

### Eingeschränkte Funktionen

`isGoogleCalendarProtocolAllowed` (in `js/google-calendar-auth.js`) liefert unter
`app://` schon heute `false`. Der Hinweis in den Einstellungen spricht aber vom
direkten Öffnen der `index.html` und wird so angepasst, dass er auch in der
Desktop-App stimmt. Sync verhält sich wie bei jeder Instanz ohne Konfiguration.

### Datenübernahme

Website und App speichern getrennt. Die Übernahme läuft über die vorhandene
Backup-Funktion. Die Umsetzung prüft, ob sie alle `localStorage`-Schlüssel abdeckt.
Falls nicht, wird das als Befund gemeldet und nicht stillschweigend hingenommen.

## Release

1. `NOOK_VERSION` in `js/nook-version.js` hochzählen.
2. Tag `v<NOOK_VERSION>` pushen, zum Beispiel `v2026.11.2`.
3. GitHub Actions baut in einer Matrix aus `windows-latest`, `macos-latest` und
   `ubuntu-latest` und veröffentlicht einen gemeinsamen Release.

Der Workflow bricht ab, wenn Tag und `NOOK_VERSION` nicht übereinstimmen. Die
Paketversion wird aus dem Tag gesetzt. Die Versionen werden ohne führende Nullen
geschrieben, damit sie gültiges SemVer bleiben. Das bisherige Schema
`Jahr.Monat.Laufnummer` erfüllt das.

Die Builds legen zunächst einen Release-Entwurf an. Erst wenn alle drei Builds
erfolgreich waren, veröffentlicht ein letzter Job den Entwurf. So gibt es keine
halben Versionen. Normale Commits lösen keinen Release aus.

| System | Datei | Update |
|---|---|---|
| Windows | `.exe` (NSIS) | Automatisch |
| Linux | `.AppImage` | Automatisch |
| macOS (Intel und Apple Silicon) | `.dmg` | Hinweis in der App, Download von Hand |

macOS kann ohne Signatur nicht automatisch aktualisieren. Dort vergleicht die App
ihre Version mit dem neuesten Release und bietet einen Link zur Download-Seite an.

## Updates

- Prüfung beim Start im Hintergrund, Download auf Windows und Linux automatisch
- Installation beim nächsten Beenden oder sofort über einen nativen Hinweisdialog
- Keine erzwungene Unterbrechung
- Fehler und fehlendes Internet werden nur geloggt, die App startet normal

## Tests

Automatisch im Workflow, auf allen drei Systemen:

- Paketprüfung (siehe oben)
- Smoke-Test: Die gepackte App startet, `app://nook/index.html` lädt und es gibt
  keine unbehandelten Fehler in der Konsole.

Von Hand auf Windows, vor dem ersten öffentlichen Release:

- Daten anlegen, App neu starten, Daten prüfen
- Backup aus der Web-Version in die App übernehmen
- Update von einer älteren auf eine neuere Version, Daten bleiben erhalten
- Tabs und Spiele stichprobenartig, insbesondere das Nachladen der Spiele

macOS und Linux lassen sich hier nicht von Hand prüfen. Dort gibt es nur den
Smoke-Test, und das wird beim ersten Release so benannt.

## Doku

- `README.md`: Download-Abschnitt mit den Schritten für SmartScreen und Gatekeeper
- `CLAUDE.md`: Hinweis auf `desktop/`, weil dort bisher steht, dass es keine
  `package.json` gibt. Der Hauptordner bleibt build-frei.

## Nicht Teil dieser Version

- Code-Signatur und Notarisierung
- Google-Kalender und Sync in der App
- Fest eingebaute Schriften und Bibliotheken
- Android, iPhone, Microsoft Store, Mac App Store
- Automatische Übernahme der Daten aus der Web-Version
