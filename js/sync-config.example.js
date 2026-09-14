// =========================
// SYNC-KONFIGURATION — VORLAGE
// Nook ist ein offenes Projekt — jeder kann sich seine eigene Instanz mit
// eigenem Geräte-Sync aufsetzen, ohne den Kern-Code (js/sync.js) anfassen
// zu müssen.
//
// So richtest du deinen eigenen Sync ein:
//   1. Kostenloses Projekt auf https://supabase.com anlegen
//   2. Im SQL Editor das Schema aus der Projekt-Doku ausführen
//      (Tabelle kv_store + Row-Level-Security-Policy + Realtime)
//   3. Unter Project Settings → API: Project URL und den
//      "Publishable"/"anon"-Key kopieren (NICHT den "Secret"-Key!)
//   4. Diese Datei kopieren zu "sync-config.js" (liegt im selben
//      Ordner) und die beiden Werte unten eintragen
//
// sync-config.js ist in .gitignore eingetragen — deine eigenen
// Zugangsdaten landen dadurch nie im Git-Repo.
// =========================

const SUPABASE_URL = "https://DEIN-PROJEKT.supabase.co";
const SUPABASE_ANON_KEY = "DEIN-PUBLISHABLE-KEY";

// =========================
// GOOGLE CALENDAR — optional
// Ohne diese Konstante (bzw. leer gelassen) gilt Google Calendar für diese
// Nook-Instanz einfach als "nicht konfiguriert" — kein Eingabefeld im UI,
// kein Fehlerzustand, der Rest von Nook läuft unverändert weiter (siehe
// isGoogleCalendarConfigured() in js/google-calendar-auth.js).
//
// So richtest du deine eigene Google-Client-ID ein:
//   1. In der Google Cloud Console (console.cloud.google.com) ein Projekt
//      anlegen (oder ein bestehendes nutzen)
//   2. APIs & Dienste → Bibliothek → "Google Calendar API" aktivieren
//   3. APIs & Dienste → OAuth-Zustimmungsbildschirm einrichten
//      (Nutzertyp "Extern" reicht, Testnutzer = deine eigene E-Mail-Adresse)
//   4. APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen →
//      OAuth-Client-ID, Typ "Webanwendung"
//   5. Bei "Autorisierte JavaScript-Quellen" die Nook-URL eintragen
//      (z.B. https://nook-ci7.pages.dev, oder http://localhost:<port> für
//      lokale Tests — nicht file://, siehe isGoogleCalendarSupported())
//   6. Die erzeugte Client-ID unten eintragen
// =========================

const GOOGLE_CLIENT_ID = "DEINE-CLIENT-ID.apps.googleusercontent.com";
