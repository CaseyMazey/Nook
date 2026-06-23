// =========================
// MANIFEST: COZY HOME
// Lädt pets.js vorab, damit PET_DEFINITIONS beim Mount von cozy-home.js
// bereits im globalen Scope vorhanden ist.
// =========================

(function () {
  if (!document.querySelector('script[src="games/cozy-home/pets.js"]')) {
    const s = document.createElement('script');
    s.src = 'games/cozy-home/pets.js';
    document.head.appendChild(s);
  }
})();

window.registerGame({
  id: 'cozy-home',
  title: 'Cozy Home',
  modalSize: "very-big",
  description: 'Sammle süße Pets und kümmer dich um sie.',
  icon: '🏠',
  accent: 'pink',
  // comingSoon: true
});