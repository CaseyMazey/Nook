# Ende-zu-Ende-Verschlüsselung für den Geräte-Sync

Stand: 2. November 2026. Status: Design freigegeben, Spezifikation zur Prüfung.

## Ziel

Die Inhalte in `kv_store` liegen nur noch als Chiffretext. Weder Supabase noch die Betreiberin können sie lesen. Zwei Geräte gleichen sich weiter ab, im Web und in der Desktop-App. `datenschutz.html` beschreibt den neuen Stand korrekt.

## Ausgangslage

- Es gibt ein einziges Konto, das der Betreiberin, mit 226 Zeilen in `kv_store`. Fremde Daten müssen nicht migriert werden.
- Die Funktion muss trotzdem für künftige Konten funktionieren, auch für neu registrierte.
- `kv_store` hat die Spalten `user_id`, `key`, `value` (`jsonb`) und `updated_at`. Primärschlüssel ist `(user_id, key)`, RLS ist aktiv.
- `js/sync.js` synchronisiert pro Key mit „last write wins“ über `DB.set()`, `catchUpSync()`, `runInitialMerge()` und Realtime.

## Nicht-Ziele

- Keine Verschlüsselung von `localStorage`. `DB.get()` bleibt synchron, ein entsperrtes Gerät gilt als vertrauenswürdig.
- Kein Verbergen von Key-Namen und `updated_at`, der Abgleich braucht sie.
- Kein Schutz gegen manipulierten ausgelieferten Code.
- Keine Schema-Änderung an `kv_store`.
- Kein Austausch des Datenschlüssels im laufenden Betrieb.

## Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Schlüsselquelle | Eigenes Verschlüsselungs-Passwort, nicht das Login-Passwort | Das Login-Passwort geht bei jeder Anmeldung an Supabase. Google und Anmelde-Link haben keins. |
| Datenschlüssel | Zufällig, AES-256-GCM | Passwortwechsel ändert nur die verschlüsselte Kopie des Schlüssels. |
| Ableitung | PBKDF2-SHA256, 600.000 Runden, 16 Byte Salt | In Web Crypto ohne Bibliothek verfügbar. |
| Passwortlänge | Mindestens 12 Zeichen | Der verschlüsselte Schlüssel liegt auf dem Server und ist dort offline angreifbar. |
| Wiederherstellung | Zufälliger 256-Bit-Schlüssel, einmal angezeigt | Einziger Rettungsweg ohne Passwort. |
| Gerätespeicher | Nicht exportierbarer `CryptoKey` in IndexedDB | Ein `CryptoKey` lässt sich nicht als JSON speichern. Bewusste, dokumentierte Ausnahme vom `DB`-Wrapper. |

## Bausteine

### `js/sync-crypto.js` (neu)

Lädt direkt vor `js/sync.js`. Enthält nur Kryptografie, kein DOM und kein Supabase. Dadurch läuft es auch in Node-Tests.

- `syncCryptoAvailable()`
- `createKeyring(password)` liefert Keyring, Datenschlüssel und Wiederherstellungsschlüssel.
- `unlockWithPassword(keyring, password, extractable)`
- `unlockWithRecoveryKey(keyring, recoveryKey, extractable)`
- `rewrapKeyring(keyring, dataKey, newPassword)` ersetzt nur die Passwort-Kopie.
- `encryptValue(dataKey, userId, key, value)`
- `decryptValue(dataKey, userId, key, envelope)`
- `isEncryptedEnvelope(value)`

### Datenformate

Verschlüsselter Wert in `kv_store.value`:

```json
{ "__nook_enc": 1, "iv": "<Base64, 12 Byte>", "ct": "<Base64>" }
```

Als Additional Authenticated Data dient `nook-kv:v1:<user_id>:<key>`. Eine Zeile lässt sich so nicht unbemerkt auf einen anderen Key oder ein anderes Konto kopieren.

Keyring in der eigenen Zeile mit dem Key `__nook_sync_keyring__`:

```json
{
  "v": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<Base64>" },
  "byPassword": { "iv": "<Base64>", "ct": "<Base64>" },
  "byRecovery": { "iv": "<Base64>", "ct": "<Base64>" },
  "migrationDone": false
}
```

Dieser Key zählt zu `isSyncInternalKey()`. Er landet also nie als App-Daten in `localStorage` und nie im Backup.

## Zustände eines Geräts

Die Zustände gelten pro Konto und Gerät.

| Zustand | Bedingung | Hochladen | Annehmen |
|---|---|---|---|
| `unknown` | Keyring konnte nicht gelesen werden, zum Beispiel offline, und es gibt keinen Schlüssel auf dem Gerät | Nein | Nein |
| `unconfigured` | Sicher kein Keyring in der Cloud | Nein | Nur Klartext-Altzeilen |
| `locked` | Keyring vorhanden, kein Schlüssel auf dem Gerät | Nein | Nein |
| `unlocked` | Schlüssel auf dem Gerät | Nur Chiffretext | Chiffretext; Klartext nur, solange `migrationDone` falsch ist |
| `unavailable` | `crypto.subtle` oder IndexedDB fehlt | Nein | Nein |

Grundregel: Der neue Client lädt in keinem Zustand Klartext hoch. „Lesefehler“ und „keine Zeile“ werden streng unterschieden, damit ein Netzfehler nie als `unconfigured` gilt.

`DB.set()` schreibt in jedem Zustand lokal wie bisher und setzt den Zeitstempel. Die Änderung wird nachgeholt, sobald das Gerät entsperrt ist.

## Abläufe

### Einrichtung und Migration (`unconfigured`)

Startet nur durch die Nutzerin oder den Nutzer, nie automatisch.

1. Passwort zweimal eingeben. Ein Hinweis sagt, dass es sich vom Login-Passwort unterscheiden muss.
2. Wiederherstellungsschlüssel anzeigen, mit Kopieren-Knopf. Weiter geht es erst nach dem Häkchen „Ich habe ihn sicher gespeichert“.
3. Mit der Cloud abgleichen und die Backup-Datei über den bestehenden Export aus `settings.js` lokal herunterladen.
4. Keyring per `insert` anlegen, mit `migrationDone: false`. Schlägt das wegen eines vorhandenen Keyrings fehl, wechselt das Gerät nach `locked`.
5. Für jeden synchronisierbaren Key den neuesten Stand aus lokal und Cloud bestimmen. Keys, die es nur auf einer Seite gibt, zählen mit.
6. Alle Werte verschlüsseln und probeweise entschlüsseln. Bei einer Abweichung bricht die Migration ab, bevor etwas hochgeladen wird.
7. Alle Zeilen in einem `upsert` hochladen, Zeitstempel bleiben erhalten.
8. Zeilen neu abrufen und prüfen, dass jede Zeile außer dem Keyring verschlüsselt ist.
9. `migrationDone` auf wahr setzen.

Bricht der Ablauf nach Schritt 4 ab, setzt das nächste Entsperren bei Schritt 5 fort, solange `migrationDone` falsch ist. Gemischte Zeilen sind in diesem Zustand erlaubt, und der Klartext wird nicht gelöscht, sondern erst durch das `upsert` ersetzt.

### Weiteres Gerät (`locked`)

1. Die Einstellungen und ein einmaliger Hinweis fragen nach dem Passwort.
2. Der Schlüssel wird mit `extractable: false` entpackt und in IndexedDB gespeichert.
3. Danach läuft der Erstabgleich beziehungsweise `catchUpSync()`.

Der Merker `INITIAL_MERGE_DONE_KEY` wird erst gesetzt, wenn das Gerät entsperrt ist. Sonst wäre der Erstabgleich verloren.

### Hochladen

- Der Wert wird in `DB.set()` synchron zu JSON serialisiert, denn Aufrufer können das Objekt danach ändern.
- Pro Key läuft höchstens ein Upload. Kommt währenddessen ein neuer Wert, ersetzt er den wartenden.
- `syncFlushPending()` wartet auch auf die Verschlüsselung und die Warteschlange.

### Herunterladen

- `catchUpSync()` und Realtime entschlüsseln vor dem Zeitstempel-Vergleich und vergleichen danach noch einmal, weil Entschlüsseln asynchron ist.
- `runInitialMerge()` entschlüsselt erst alles und schreibt dann. Scheitert eine Zeile, schreibt der Erstabgleich nichts, das Gerät bleibt ohne Merker und meldet den Fehler.
- `catchUpSync()` und Realtime überspringen eine nicht entschlüsselbare Zeile, behalten den lokalen Wert und zeigen einen Hinweis.

### Nachholen lokaler Änderungen

`catchUpSync()` übernimmt bisher nur neuere Cloud-Werte. Neu ist:

- Ist der lokale Zeitstempel neuer als der der Cloud-Zeile, wird der lokale Wert hochgeladen.
- Fehlt die Cloud-Zeile, wird nur hochgeladen, wenn der lokale Zeitstempel neuer ist als der letzte erfolgreiche Abgleich dieses Geräts (neuer interner Key `__nook_sync_last_catchup__`). Sonst käme ein auf einem anderen Gerät gelöschter Key zurück.

### Klartext nach der Migration

Taucht bei `migrationDone: true` eine Klartext-Zeile auf, stammt sie von einem alten Client. Sie wird nicht übernommen. Gibt es einen lokalen Wert, ersetzt ihn der Client verschlüsselt mit aktuellem Zeitstempel. Sonst bleibt die Zeile liegen und ein Hinweis erscheint.

### Passwort ändern

Das aktuelle Passwort ist nötig, weil der Schlüssel auf dem Gerät nicht exportierbar ist. Damit wird der Schlüssel kurz exportierbar entpackt und mit dem neuen Passwort neu verschlüsselt, dann wird die Keyring-Zeile aktualisiert. Andere Geräte behalten ihren Schlüssel.

### Passwort vergessen

Mit dem Wiederherstellungsschlüssel wird der Datenschlüssel entpackt und ein neues Passwort gesetzt.

### Beides verloren

„Cloud-Daten zurücksetzen“ löscht nach einer deutlichen Warnung alle Zeilen des Kontos einschließlich Keyring. Das Gerät steht danach auf `unconfigured` und kann mit seinen lokalen Daten neu einrichten. Andere Geräte wechseln beim nächsten Start ebenfalls auf `unconfigured` und behalten ihre lokalen Daten.

### Abmelden

Der Schlüssel des Kontos wird aus IndexedDB gelöscht. Lokale Daten bleiben wie bisher liegen.

## Oberfläche

- Einstellungen → Geräte-Sync bekommt eine Zeile „Verschlüsselung“ mit dem aktuellen Zustand und passenden Knöpfen: Einrichten, Entsperren, Passwort ändern.
- Das Modal deckt Einrichtung, Entsperren, Wiederherstellung und Zurücksetzen ab.
- Die Statuszeile sagt klar, wenn nicht synchronisiert wird, zum Beispiel: „Sync pausiert: Verschlüsselung einrichten“.
- Alle Texte sind deutsch, alle Farben kommen aus den Theme-Variablen.
- Der Hinweis „Passwort vergessen?“ im Login-Modal bleibt, gilt aber nur für das Login-Passwort. Der Text sagt, dass damit die verschlüsselten Daten nicht lesbar werden.

## Einführung

1. Tests bestanden, Web deployen und Desktop-Release veröffentlichen (`NOOK_VERSION` erhöhen, Changelog, Tag). Ab jetzt pausiert der Sync, bis die Verschlüsselung eingerichtet ist.
2. Die Betreiberin legt in einem getrennten Browser-Profil selbst ein Testkonto an und prüft zwei Geräte gegen das echte Supabase. Danach wird das Testkonto gelöscht.
3. Alle Geräte auf die neue Version bringen und alte Tabs schließen.
4. Migration auf dem Gerät mit dem aktuellsten Stand starten.
5. Weitere Geräte entsperren und einen Abgleich in beide Richtungen prüfen.
6. Per SQL nur Zählwerte prüfen, ohne Inhalte zu lesen: Anzahl der Zeilen ohne `__nook_enc`, außer dem Keyring, muss 0 sein.

## Fehlerfälle

| Fall | Verhalten |
|---|---|
| Falsches Passwort | AES-GCM schlägt fehl, Fehlermeldung, nichts ändert sich |
| Offline mit Schlüssel | Arbeitet lokal, holt beim nächsten Abgleich nach |
| Offline ohne Schlüssel | `unknown`, kein Hochladen und kein Annehmen |
| Beschädigte oder vertauschte Zeile | Wird nicht übernommen, Hinweis |
| Upload scheitert | Lokaler Zeitstempel bleibt neuer, nächster Abgleich holt nach |
| Zwei Geräte richten gleichzeitig ein | Das `insert` lässt nur eins gewinnen, das andere wechselt nach `locked` |
| IndexedDB gelöscht | Gerät wechselt nach `locked` |

## Tests

- **Automatisch (`desktop/test/sync-crypto.test.js`, `node:test`):** Hin- und Rückweg, falsches Passwort, vertauschte Zeile, Wiederherstellung, Passwortwechsel.
- **Automatisch, Sync-Logik:** Zwei simulierte Clients gegen einen In-Memory-Ersatz für `sbClient`: Migration mit Abbruch an jedem Schritt und Fortsetzung, Abgleich, Nachholen, gelöschte Keys, Klartext von alten Clients.
- **Browser:** Einrichtung, Entsperren und Normalbetrieb lokal, dazu das Verhalten unter `file://`.
- **Desktop:** `npm test` und ein Durchlauf der App mit `app://nook`.
- **Echtes Supabase:** Testkonto wie unter „Einführung“, dann die echte Migration mit Backup-Datei.

## Dokumentation

- `datenschutz.html`:
  - Inhalte sind Ende-zu-Ende-verschlüsselt, Betreiberin und Supabase können sie nicht lesen.
  - Sichtbar bleiben Konto-Daten, Key-Namen, Zeitstempel und ungefähre Datenmenge.
  - Bei Verlust von Passwort und Wiederherstellungsschlüssel sind die Cloud-Daten verloren.
  - Frühere unverschlüsselte Stände können in Backups des Anbieters bis zu deren Ablauf enthalten sein.
  - Der Schutz setzt voraus, dass der ausgelieferte Code nicht manipuliert ist.
  - Der neue Text geht erst nach der abgeschlossenen Migration live, das Stand-Datum wird angepasst.
- `AI documentation/sync-anmeldung-einrichtung.md`: Abschnitt zur Verschlüsselung und den Support-Grenzen aktualisieren.
- Backup-Hinweis: Die lokale Backup-Datei aus der Migration ist unverschlüsselt.
