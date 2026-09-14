# Calendar.md

Version: 1.1

---

# Zweck

Der Kalender ist die zentrale Planungsinstanz des Personal Hub.

Er verwaltet alle zeitbezogenen Informationen des Nutzers und dient als einzige Quelle für Termine.

Andere Module wie Today greifen auf die Kalenderdaten zu, verwalten sie jedoch nicht selbst.

Der Kalender ist für kurz-, mittel- und langfristige Planung ausgelegt.

---

# Ziele

Der Kalender soll:

- alle Termine übersichtlich darstellen
- wiederkehrende Ereignisse verwalten
- mehrtägige Termine unterstützen
- Feiertage und Geburtstage integrieren
- Monatsinformationen bereitstellen
- langfristige Planung ermöglichen

Der Kalender ersetzt keine Projektverwaltung und keine Aufgabenverwaltung.

---

# Designprinzip

Der Kalender soll ruhig, aufgeräumt und angenehm wirken.

Nicht wie Outlook.

Nicht wie Google Calendar.

Nicht wie ein Business-Tool.

Der Fokus liegt auf einem persönlichen Planer im Cozy-Stil.

Illustrationen, Farben und saisonale Gestaltung unterstützen den Charakter des Personal Hub.

---

# Hauptbereiche

Der Kalender besteht aus fünf Bereichen:

1. Saisonaler Hero
2. Monatsansicht
3. Tagesansicht
4. Terminverwaltung
5. Monatsplaner (Sidebar)

Diese Struktur soll erhalten bleiben.

---

# Hero

Der Hero bildet den Einstieg in jeden Monat.

Er zeigt:

- Monat
- Jahr
- aktuelle Jahreszeit
- saisonalen Spruch
- Wetter
- Mondphase
- Countdown bis zur nächsten Jahreszeit

Der Hero passt sich automatisch der Jahreszeit an.

---

# Monatsansicht

Die Monatsansicht ist die Hauptansicht des Kalenders.

Sie zeigt:

- Kalenderwochen
- Wochentage
- Termine
- Aufgaben
- Feiertage
- Geburtstage

Jeder Tag besitzt eine kompakte Vorschau.

Die Anzahl sichtbarer Elemente ist bewusst begrenzt.

Weitere Einträge werden zusammengefasst.

---

# Tagesansicht

Beim Anklicken eines Tages öffnet sich das Tagesmodal.

Es zeigt:

- Termine
- offene Aufgaben
- erledigte Aufgaben

Die Tagesansicht dient ausschließlich zur Anzeige eines einzelnen Tages.

Sie ersetzt keine Wochenansicht.

---

# Termine

Ein Termin besitzt mindestens:

- Titel
- Datum

Optional:

- Uhrzeit
- Notizen
- Farbe
- Countdown
- Enddatum
- Wiederholung
- Sichtbarkeit in Terminlisten ("In Agenda anzeigen")

Termine können bearbeitet und gelöscht werden.

---

# Mehrtägige Termine

Mehrtägige Termine besitzen:

- Startdatum
- Enddatum

Sie werden als durchgehender Balken dargestellt.

Der Balken beginnt am Starttag.

Zwischentage zeigen keinen wiederholten Text.

Der Endtag beendet den Balken.

---

# Wiederkehrende Termine

Der Kalender unterstützt Terminserien.

Mögliche Wiederholungen:

- täglich
- wöchentlich
- monatlich
- jährlich

Zusätzlich:

- eigenes Intervall
- mehrere Wochentage
- Enddatum
- Anzahl Wiederholungen

Vorkommen werden dynamisch berechnet.

Sie werden nicht einzeln gespeichert.

---

# Serienbearbeitung

Beim Bearbeiten einer Terminserie kann gewählt werden:

- nur dieses Vorkommen
- dieses und alle folgenden
- gesamte Serie

Ausnahmen werden separat gespeichert.

Dadurch bleiben Serien klein und effizient.

---

# Countdown-Termine

Ein Termin kann als Countdown markiert werden.

Countdowns erscheinen zusätzlich:

- in der Sidebar
- im Countdown-Widget

Abgelaufene Countdowns werden automatisch entfernt.

---

# Individuelle Farben

Jeder Termin kann eine eigene Farbe besitzen.

Diese Farbe beeinflusst:

- Monatsansicht
- Tagesansicht
- Mehrtagesbalken

Fehlt eine Farbe, wird die Standardfarbe verwendet.

---

# Geburtstage

Geburtstage sind ein eigenes System.

Sie gehören nicht zu den normalen Terminen.

Eigenschaften:

- Name
- Tag
- Monat
- optional Geburtsjahr

Geburtstage wiederholen sich automatisch jedes Jahr.

Das Alter wird dynamisch berechnet.

---

# Feiertage

Feiertage werden vollständig offline berechnet.

Unterstützt werden:

- bundesweite Feiertage
- Bundesland-spezifische Feiertage

Das Bundesland wird in den Kalendereinstellungen gespeichert.

Es werden keine externen APIs verwendet.

---

# Monatsziele

Jeder Monat besitzt eigene Ziele.

Ein Ziel besitzt:

- Titel
- Erledigt-Status

Die Ziele sind unabhängig von Projekten.

Später können Projekte optionale Ziele automatisch erzeugen.

---

# Monatsstatistik

Die Statistik berechnet automatisch:

- Anzahl Termine
- erledigte Aufgaben
- aktive Tage
- durchschnittliche Termine pro Woche

Sie dient ausschließlich der Übersicht.

---

# Wetter

Das Wetter wird aus dem Today-Modul übernommen.

Der Kalender speichert keine eigenen Wetterdaten.

---

# Mondphase

Die Mondphase wird lokal berechnet.

Es wird keine externe API verwendet.

Angezeigt werden:

- Mondphase
- Symbol
- Beleuchtungsgrad

---

# Sidebar

Die Sidebar enthält ergänzende Monatsinformationen.

Aktuell:

- Countdowns
- Geburtstage
- Feiertage
- Monatsziele
- Statistik

Die Sidebar soll den Kalender ergänzen.

Sie ersetzt keine Hauptfunktionen.

---

# Kalendernavigation

Der Nutzer kann:

- Monate wechseln
- Tage öffnen
- Termine anlegen
- Termine bearbeiten
- Termine löschen

Eine Wochenansicht existiert derzeit nicht.

---

# Zuständigkeiten

calendar.js ist verantwortlich für:

- Monatsansicht
- Tagesansicht
- Terminverwaltung
- Serienverwaltung
- Mehrtagestermine
- Geburtstage
- Feiertage
- Countdowns
- Monatsziele
- Monatsstatistik
- saisonalen Hero
- Wetteranzeige
- Mondphase

Nicht verantwortlich für:

- Projektplanung
- Budget
- Today-Aufgaben
- Spiele
- Bibliothek

Die Google-Calendar-Integration (siehe Abschnitt „Google Calendar Integration“) liegt in eigenen `google-calendar-*.js`-Dateien, nicht in calendar.js.

---

# Datenmodell

Der Kalender verwaltet unter anderem:

- Termine
- Terminserien
- Ausnahmen
- Geburtstage
- Monatsziele
- Kalendereinstellungen
- sichtbare Countdowns

Andere Module lesen diese Daten.

Sie sollen keine eigenen Kalenderkopien erzeugen.

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ langfristige Planung unterstützen

✔ bestehende Datenmodelle wiederverwenden

✔ die Monatsansicht übersichtlich halten

✔ saisonal zum Design passen

✔ ohne externe Dienste funktionieren, wenn möglich

Neue Funktionen sollen nicht:

✖ den Today-Tab ersetzen

✖ Projektfunktionen übernehmen

✖ Aufgaben doppelt verwalten

✖ den Hero überladen

✖ die Monatsansicht mit zu vielen Informationen füllen

---

# Datenquellen

Der Kalender liest Daten aus:

- Termine
- Aufgaben
- Einstellungen
- Wetter-Cache
- Geburtstage
- Feiertagsberechnung
- LocalStorage

Er ist die primäre Quelle für Kalenderdaten.

---

# Google Calendar Integration

Nook kann optional mit einem Google-Konto verbunden werden (Einstellungen → „Google Calendar“).

Eigene Dateien (`js/google-calendar-auth.js`, `js/google-calendar-api.js`, `js/google-calendar-sync.js`, `js/google-calendar-settings.js`, `css/google-calendar.css`), bewusst getrennt von `calendar.js` — dieses ruft die Integration nur über optionale `typeof`-Prüfungen auf und funktioniert unverändert, wenn sie fehlt oder nicht verbunden ist.

Architektur (vier Schichten, damit später weitere Anbieter als eigenes Datei-Set neben Google ergänzt werden können):

- **auth**: OAuth-Verbindungsaufbau (Google Identity Services). Funktioniert nur über `https://`/`http://localhost`, nicht über `file://` (Google-seitige Einschränkung).
- **api**: reiner REST-Zugriff auf die Google Calendar API.
- **sync**: hält importierte Google-Termine als eigenen, von `events`/`eventSeries` getrennten Nur-Lese-Spiegel (`googleCalCache`). Inkrementeller Abgleich inkl. Löschungen über Googles `syncToken`.
- **settings**: das Einstellungen-Panel (Verbinden/Trennen, Kalenderauswahl, Sync-Intervall, optionaler Export).

Google-Termine erscheinen read-only in Monatsansicht/Tagesmodal (gestrichelter Rand + „Google“-Badge, Link „In Google öffnen“ statt Bearbeiten/Löschen) — bearbeitet werden sie weiterhin in Google, Änderungen zieht Nook beim nächsten Sync nach.

Optional können einmalige/mehrtägige Nook-Termine zu Google übertragen werden (Termin-Modal → „Zu Google Calendar übertragen“). Terminserien werden bewusst NICHT exportiert (Nooks Serien-Engine müsste dafür in Googles RRULE-Format inkl. Ausnahmen übersetzt werden — eigenständiges Folge-Feature).

Der Kalender bleibt dadurch weiterhin die alleinige Quelle für Nook-eigene Terminverwaltung — Google-Termine sind ein zusätzlicher, klar unterscheidbarer Anzeige-Layer, keine zweite Terminverwaltung.

---

# Zukunft

Geplante Erweiterungen:

- Wochenansicht
- Jahresübersicht
- Drag & Drop für Termine
- Kategorien
- Erinnerungen
- Anhänge
- Kalenderfreigaben
- Import und Export (ICS)
- Zeitleistenansicht
- Weitere externe Kalender-Anbieter (z.B. Outlook/CalDAV) neben Google

---

# Bekannte Erweiterungspunkte

Neue Komponenten dürfen ergänzt werden:

- Sidebar
- Hero
- Tagesmodal
- Terminmodal
- Monatsstatistik
- Monatsziele
- Einstellungen

Neue Informationen dürfen innerhalb der Tagesansicht ergänzt werden:

- Wetter des Tages
- Tagesnotizen
- Tagesziele
- Fokusmodus
- Zeiterfassung

Neue Funktionen sollen **nicht** ergänzt werden:

- direkt innerhalb einzelner Kalendertage, wenn dadurch die Übersicht leidet
- innerhalb des Hero-Bereichs über die vorhandenen Informationen hinaus
- als zweite Terminverwaltung neben dem bestehenden System
- durch Duplizieren bereits vorhandener Kalenderdaten

---

# Entwicklungsrichtlinien

Bei Änderungen am Kalender gelten folgende Regeln:

- Bestehendes Verhalten darf nicht ohne ausdrücklichen Auftrag verändert werden.
- Neue Funktionen sollen bestehende Datenmodelle erweitern statt ersetzen.
- Wiederkehrende Termine müssen weiterhin dynamisch berechnet werden.
- Neue Features sollen mit allen bestehenden Kalenderfunktionen kompatibel bleiben.
- Der Kalender bleibt die einzige Quelle für Terminverwaltung innerhalb des Personal Hub.