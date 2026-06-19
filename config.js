// config.js — edit this file to set your pages, timing, and colours
const BOOK_CONFIG = {
  pages: [
    'assets/pages/page-01.jpg',
    'assets/pages/page-02.jpg',
    'assets/pages/page-03.jpg',
    // add more entries as needed
  ],
  flipDuration: 850,         // ms — matches flip.wav active content (1000ms − 50ms head − 100ms tail)
  backgroundColor: 0x1a1a1a,
  lightColor: 0xfff5e0,      // warm key light
  ambientIntensity: 0.35,
  sounds: {
    flip: 'assets/sounds/flip.wav',
    land: 'assets/sounds/land.wav',
  },

  // ── Camera positions ──────────────────────────────────────────────────────────
  // Override at runtime via dev panel (saved to localStorage)
  cameras: {
    work:    { x: 0, y: 1.5, z: 4,  lx: 0, ly: 0, lz: 0, fov: 45 },
    attract: { x: 0, y: 5,   z: 11, lx: 0, ly: 0, lz: 0, fov: 30 },
  },
  attractTransitionMs: 2000, // camera move duration (ms)
  inactivityMs: 600000,      // 10 minutes — use ?timeout=5000 in URL for quick testing
};
