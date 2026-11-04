# Sync-Anmeldung einrichten (Google + eigene Mails)

Anleitung für Casey. Diese Einstellungen liegen in Google Cloud und Supabase und lassen sich nicht aus dem Code heraus setzen. Stand der Supabase-Doku: 2. November 2026.

Der Code ist vorbereitet: Der Button „Mit Google anmelden“ erscheint von selbst, sobald der Google-Provider in Supabase aktiv ist. Nook fragt das beim Start über `/auth/v1/settings` ab. Vorher bleibt er unsichtbar.

## Empfohlen: E-Mail und Passwort (5 Minuten)

Dieser Weg braucht weder Google noch eigene Domain oder Mailanbieter. Teil 1 und Teil 2 weiter unten kannst du dann auslassen.

1. Öffne in Supabase die Seite [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/providers) und schalte im oberen Abschnitt **User Signups** den Punkt **Confirm email** aus. Er steht nicht im Fenster, das sich beim Klick auf den Provider „Email“ öffnet. Danach verschickt die Registrierung keine Mail mehr.
2. Melde dich in Nook per **Anmelde-Link senden** an. Das klappt nur mit der Adresse, mit der du Mitglied deiner Supabase-Organisation bist.
3. Öffne **Einstellungen → Geräte-Sync → Passwort** und lege dein Passwort fest.

Wer sein Passwort vergisst, schreibt dir. Das Konto findest du unter [Authentication → Users](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/users).

## Die anderen Wege

Google und der E-Mail-Link funktionieren unabhängig vom Passwort:

| | Mit Google anmelden | E-Mail-Link |
|---|---|---|
| **Einrichtung** | Teil 1 | Teil 2 |
| **Verschickt Mails** | Nein | Ja, bei jeder Anmeldung |
| **Mail-Limit** | Gilt hier nicht | Gilt hier |
| **Wer sich anmelden kann** | Alle mit Google-Konto | Ohne Teil 2 nur Mitglieder deiner Supabase-Organisation |

**Mit Teil 1 können sich mehrere Leute gleichzeitig anmelden.** Teil 2 brauchst du nur für Leute, die sich nicht mit Google anmelden können oder wollen.

## Was du wissen solltest

- **Das Limit von 2 Mails pro Stunde betrifft nur den E-Mail-Link.** Der eingebaute Mailversand von Supabase ist nur zum Ausprobieren gedacht: Er schickt projektweit höchstens 2 Mails pro Stunde und nur an Mitglieder deiner Supabase-Organisation. Alle anderen Adressen scheitern mit `email_address_not_authorized`.
- **Die Inhalte sind Ende-zu-Ende-verschlüsselt.** Nook verschlüsselt jeden Wert auf dem Gerät (AES-256-GCM), bevor er in `kv_store` landet. Der Schlüssel stammt aus einem eigenen Verschlüsselungs-Passwort (PBKDF2-SHA256, 600000 Durchläufe). Das Passwort verlässt das Gerät nie. Du und Supabase könnt die Inhalte nicht lesen. Sichtbar bleiben Konto-Daten, die Key-Namen, `updated_at`, die Zeilenzahl und die ungefähre Größe. In einer eigenen Zeile (Keyring) liegen die Datenschlüssel, jeweils mit Passwort und Wiederherstellungsschlüssel umhüllt. Auf dem Gerät liegt der entsperrte Schlüssel in IndexedDB, `localStorage` bleibt unverschlüsselt.
- **„Passwort vergessen → schreib mir“ stellt nur die Anmeldung wieder her.** Du setzt das Login-Passwort in Supabase zurück, mehr nicht. Das Verschlüsselungs-Passwort kennst du nicht und kannst es nicht zurücksetzen. Wer es vergisst, nimmt den Wiederherstellungsschlüssel (wird bei der Einrichtung einmal angezeigt). Fehlen beide, sind die Cloud-Daten unlesbar. Der Ausweg ist **Einstellungen → Geräte-Sync → Cloud-Daten zurücksetzen**: Das löscht die Cloud-Daten und legt Verschlüsselung neu an. Die lokalen Daten auf den Geräten bleiben.
- **Reihenfolge bei der Einführung:** Aktualisiere zuerst alle deine Geräte auf die Version mit Verschlüsselung. Richte die Verschlüsselung dann auf dem Gerät mit den neuesten Daten ein, denn dessen Stand wird hochgeladen. Danach entsperrst du die anderen Geräte mit dem Passwort.
- **Daten sind pro Konto getrennt.** Jedes Konto kann nur die eigenen Zeilen lesen und ändern (Row Level Security auf `kv_store`).
- **Bestehende Konten bleiben erhalten.** Supabase verknüpft eine Google-Anmeldung automatisch mit dem Konto, das dieselbe E-Mail-Adresse hat. Dabei entfernt Supabase unbestätigte Identitäten dieses Kontos. Ein Konto, das schon einmal per Magic Link angemeldet war, ist bestätigt.
- **Andere Google-Adresse = neues Konto.** Wer sich mit einer anderen Adresse als bisher anmeldet, bekommt ein neues, leeres Cloud-Konto. Die Daten im alten Konto bleiben dort liegen.

## Teil 1: Google einrichten (etwa 20 Minuten, ohne Mailversand)

Die Google-Schritte nennen die Begriffe der deutschen Oberfläche. Einzelne Beschriftungen können bei Google leicht abweichen. Die Testguthaben-Leiste oben kannst du ablehnen, die Anmeldung braucht sie nicht. Das Supabase-Dashboard ist englisch, deshalb stehen die Begriffe dort auf Englisch.

### 1. Projekt und Zustimmungsbildschirm

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) und lege ein Projekt an, zum Beispiel `Nook`. Du kannst auch das Projekt nehmen, das du schon für den Google Kalender nutzt.
2. Öffne die [Google Auth Platform](https://console.cloud.google.com/auth/overview) und klicke auf **Erste Schritte**.
3. Trage als App-Namen `Nook` und deine Support-Mail ein, wähle als Zielgruppe **Extern** und schließe den Assistenten ab.
4. Klicke links unter **Datenzugriff** auf **Bereiche hinzufügen oder entfernen**, setze Häkchen bei `openid`, `.../auth/userinfo.email` und `.../auth/userinfo.profile`, übernimm die Auswahl und klicke unten auf **Save**. Weitere Bereiche brauchst du nicht.
5. Klicke links unter **Zielgruppe** auf **App veröffentlichen**. Im Status „Test“ können sich nur eingetragene Testnutzer anmelden.

### 2. OAuth-Client anlegen

1. Öffne in Supabase **Authentication → Providers → Google** und kopiere die dort angezeigte **Callback URL**. Sie lautet für Nook: `https://iaatlbaawjjfthtxrfls.supabase.co/auth/v1/callback`
2. Wähle in Google links unter **Clients** den Punkt **Client erstellen** und als Anwendungstyp **Webanwendung**, Name `Nook`.
3. Trage unter **Autorisierte JavaScript-Quellen** ein: `https://nook-ci7.pages.dev`
4. Trage unter **Autorisierte Weiterleitungs-URIs** die Callback URL aus Schritt 1 ein.
5. Klicke auf **Erstellen** und notiere **Client-ID** und **Clientschlüssel**. In Supabase heißen sie **Client ID** und **Client Secret**.

### 3. In Supabase eintragen

1. Öffne [Authentication → Providers → Google](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/providers?provider=Google).
2. Aktiviere den Provider, trage Client ID und Client Secret ein und speichere.

Das Client Secret gehört nur in dieses Feld, nicht in `js/sync-config.js` und nicht ins Repo.

### 4. Redirect-URLs

Öffne [Authentication → URL Configuration](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/url-configuration):

1. **Site URL:** `https://nook-ci7.pages.dev/`
2. **Redirect URLs:** Füge genau diese Adresse hinzu, mit dem Schrägstrich am Ende: `https://nook-ci7.pages.dev/`
3. Nur zum lokalen Testen, danach wieder entfernen: `http://localhost:8765/`

Nook schickt als Rücksprung immer Domain plus Pfad, online also `https://nook-ci7.pages.dev/`.

### 5. Der Name „Nook“ auf dem Google-Bildschirm

Ohne weitere Schritte zeigt Google dort die Adresse `iaatlbaawjjfthtxrfls.supabase.co` statt „Nook“. Das wirkt nicht vertrauenswürdig, und es gibt zwei Wege dagegen. Der erste ist kostenlos und reicht für den Anfang:

- **Marke bestätigen lassen:** Reiche unter **Branding** Name und Logo zur Prüfung ein. Laut Supabase dauert das ein paar Werktage. Google verlangt dafür Angaben wie Startseite und Datenschutzerklärung, und unter Umständen eine eigene, bestätigte Domain. Prüfe die Anforderungen direkt auf der Seite.
- **Eigene Domain für Supabase:** Mit zum Beispiel `auth.deine-domain.de` steht diese Adresse statt der Supabase-Adresse auf dem Bildschirm. Das ist eine kostenpflichtige Erweiterung. Prüfe den aktuellen Preis im Dashboard. Die Callback URL ändert sich dabei, trage sie dann auch in Google ein.

### 6. Testen

1. Melde dich in Nook ab und öffne **Einstellungen → Geräte-Sync → Anmelden**.
2. Prüfe, ob der Button „Mit Google anmelden“ über dem E-Mail-Feld steht.
3. Melde dich mit der Adresse deines bestehenden Kontos an. Danach muss Nook einmal neu laden und „Angemeldet als …“ anzeigen, und deine Daten müssen da sein.
4. Prüfe unter [Authentication → Users](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/users), dass es **keinen zweiten Eintrag** mit derselben Adresse gibt und der vorhandene nun auch Google als Anbieter nennt.

## Teil 2: Eigene Mails (optional, nur für den E-Mail-Link)

Die Google-Anmeldung funktioniert auch ohne diesen Teil. Ohne ihn können nur Mitglieder deiner Supabase-Organisation den E-Mail-Link nutzen, alle anderen sehen beim Anfordern eine Fehlermeldung.

Du brauchst dafür eine eigene Domain, denn von `pages.dev` kannst du keine Mails verschicken.

1. Erstelle ein Konto bei einem Mailanbieter. Supabase nennt unter anderem Resend, Brevo, Postmark, AWS SES, SendGrid und ZeptoMail.
2. Bestätige dort deine Domain. Der Anbieter nennt dir die DNS-Einträge für SPF und DKIM. Supabase empfiehlt zusätzlich DMARC. Eine Subdomain wie `mail.deine-domain.de` hält den Ruf deiner Hauptdomain getrennt.
3. Trage unter [Authentication → SMTP](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/smtp) ein:
   - Absenderadresse: zum Beispiel `no-reply@mail.deine-domain.de`
   - Absendername: `Nook`
   - Host, Port, Benutzer und Passwort: vom Mailanbieter
4. Setze unter [Authentication → Rate Limits](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/rate-limits) das Mail-Limit passend. Nach der Umstellung liegt es zunächst bei 30 Mails pro Stunde.
5. Ersetze unter [Authentication → Email Templates](https://supabase.com/dashboard/project/iaatlbaawjjfthtxrfls/auth/templates) die Vorlagen **Magic Link** und **Confirm signup** durch den Text unten.
6. Schicke dir einen Link und prüfe Absender, Text und Spam-Ordner.

**Betreff:** `Dein Anmelde-Link für Nook`

```html
<h2>Willkommen zurück bei Nook</h2>
<p>Mit diesem Link meldest du dich an und deine Daten werden zwischen deinen Geräten abgeglichen. Du brauchst kein Passwort.</p>
<p><a href="{{ .ConfirmationURL }}">Bei Nook anmelden</a></p>
<p>Der Link gilt nur einmal und läuft nach kurzer Zeit ab. Du hast ihn nicht angefordert? Dann kannst du diese Mail einfach ignorieren.</p>
```

## Quellen

- [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
