# Questboard.md

Version: 1.0

---

# Zweck

Das Questboard ist ein gamifiziertes Planungsbrett im Stil eines Tavernen-Aushangs (Vorbild: physisches „Quest Board“ mit wiederverwendbaren, angepinnten Karten).

Es löst das „Aus den Augen, aus dem Sinn“-Problem klassischer Planer: alles Wichtige hängt sichtbar auf einem Brett, erledigte Karten werden abgewischt und wiederverwendet.

---

# Designprinzip

Visuell und motivierend, aber ruhig.

- Karten wirken angepinnt (Pin-Farbe je Quest-Art, leichte Schräglage).
- Belohnungen sind optional — ohne Münzen ist das Brett eine reine Planungshilfe.
- Keine Strafen, keine Streaks, kein Druck.

---

# Module

1. **Aushang** — aktueller + nächster Monat, Termine/Fristen. Nur lesend aus dem Kalender.
2. **Daily Quests** — tägliche Checklisten, setzen sich jeden Tag zurück.
3. **Weekly & Check Quests** — Wochenliste (optional montags zurück) oder ein Projekt in Teilschritten.
4. **Time Quests** — Aufgabe + Uhrzeit oder Zeitblock, chronologisch, frei verschiebbar; die laufende Quest ist markiert. Setzen sich täglich zurück.
5. **Side Quests** — nummerierte Kleinigkeiten; ein Würfel mit so vielen Seiten wie offene Quests entscheidet, was als Nächstes dran ist (gegen Entscheidungs-Paralyse). Optional wiederholbar.
6. **Schatztruhe** — Münzen pro Quest (Faustregel 1–2 einfach, 10–20 unbeliebt), selbst definierte Belohnungen zum Einlösen.

Checklisten-Quests geben Münzen erst, wenn alle Punkte erledigt sind; wird ein Haken entfernt, gehen sie zurück.

---

# Daten

Alle Keys mit Präfix `quest` (Backup-Gruppe „Questboard“ in `settings.js`):

- `questCards` — alle Karten `{id, type, title, coins, items, start, end, duration, done, awarded, resetWeekly, repeatable, order}`
- `questRewards` — Belohnungen `{id, title, icon, cost}`
- `questWallet` — `{coins, earned, redeemed[]}`
- `questSettings` — `{coinsEnabled, lastDailyReset, lastWeeklyReset}`

---

# Zuständigkeiten

Nicht verantwortlich für:

- Kalender (Termine werden nur angezeigt, nie angelegt oder geändert)
- Heute (Heute bleibt ohne Gamification)
- Projekte (Check Quests sind schlanke Checklisten, kein Projektwald)
- Budget (Münzen sind Spielgeld, kein echtes Geld)
- Spiele / Cozy Home

---

# Erweiterungsregeln

Neue Funktionen sollen:

✔ das Brett übersichtlich halten
✔ Belohnungen optional lassen

Neue Funktionen sollen nicht:

✖ Kalender- oder Projektdaten verändern
✖ Druck aufbauen (Strafen, verlorene Streaks)
✖ die Münzen mit Budget-Geld vermischen
✖ zu einer zweiten Aufgabenverwaltung neben Heute werden
