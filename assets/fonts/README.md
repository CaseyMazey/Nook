# assets/fonts/

Eigene Schriftdateien für den Theme-Editor („Schriftart → Eigene Fonts“).
Übernommen aus Core (Fork von Nook), aber nur die Dateien, deren eingebettete
Lizenz eine öffentliche Weitergabe erlaubt — Nook wird öffentlich deployed.

| Datei | Familie | Lizenz (laut Font-Metadaten) |
|---|---|---|
| `Blackwood-Castle.ttf` | Blackwood Castle | 1001Fonts Free For Commercial Use License (FFC), laut 1001fonts.com |
| `Coralines-Cat.ttf` | Coraline's Cat | Freeware, privat + kommerziell |
| `Dune_Rise.ttf` | Dune Rise | SIL Open Font License |
| `HelpMe.ttf` | Help Me | SIL Open Font License 1.1 |
| `Klaxon-Crunchy.otf` | Klaxon Crunchy | „100% free“ |
| `Searle.ttf` | Searle | SIL Open Font License |
| `cubic.ttf` | Cubic | frei verwendbar, Font selbst nicht verändern/umbenennen |

Bewusst **nicht** übernommen (nur privater Gebrauch, keine öffentliche
Auslieferung erlaubt): Shizuoka Cyberpunk (Chequered Ink), Technical Stencil VP
— in Core für Cyberpunk bzw. Lab genutzt.

## Eine Datei hinzufügen

1. Datei hierher legen (bevorzugt `.woff2`, sonst `.woff`/`.ttf`/`.otf`).
2. Eintrag in `CUSTOM_FONT_FILES` (`js/theme-engine.js`) ergänzen.
3. Lizenz prüfen: keine „Demo“-, „Personal Use Only“- oder „All Rights
   Reserved“-Schriften — die dürfen nicht öffentlich ausgeliefert werden.
