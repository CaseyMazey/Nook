// =========================
// GAMES-LISTE
// Einziger Ort, der beim Hinzufügen oder Entfernen eines Spiels
// angefasst werden muss. games.js selbst bleibt dabei unverändert —
// der Hub liest nur diese Liste und lädt pro ID games/<id>/manifest.js.
//
// Reihenfolge hier = Reihenfolge in der Library.
// =========================

window.GAMES_LIST = [
  'ttt',
  'memory',
  'snake',
  'flashcard-battle',
  'debug-hero',
  'virtual-pet'
];
