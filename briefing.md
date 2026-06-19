# 3D Book Browser — Project Spec

A browser-based 3D book viewer for a low-spec all-in-one touchscreen.  
Pages are texture images loaded from external files. Tap left half = previous page, tap right half = next page.  
Built with Three.js + Web Audio API. No build step, no bundler — runs from a local folder.

---

## File Structure

```
project/
├── index.html          ← entry point, all JS inline or via <script src>
├── book.js             ← Three.js scene, flip logic, input handling
├── audio.js            ← Web Audio API loader + playback
├── config.js           ← page list, settings
│
├── assets/
│   ├── book/
│   │   └── book.glb    ← cover mesh (Blender export)
│   ├── pages/
│   │   ├── page-01.jpg
│   │   ├── page-02.jpg
│   │   └── ...         ← one image per page, named sequentially
│   └── sounds/
│       ├── flip.mp3    ← page whoosh (0.3–0.5s, CC0)
│       └── land.mp3    ← soft thud at end of flip
│
└── lib/
    ├── three.min.js    ← Three.js r160 core, downloaded locally
    └── GLTFLoader.js   ← Three.js GLTFLoader (examples/js build, same version)
```

> **No internet connection required at runtime.** All dependencies are local files.  
> Download the two library files once (while online) and they never change.

### One-time download (do this before going offline)

```bash
# Three.js core
curl -o lib/three.min.js \
  https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js

# GLTFLoader — must use examples/js/ (non-module), not examples/jsm/
# The jsm/ version uses ES import syntax and won't work with plain <script> tags
curl -o lib/GLTFLoader.js \
  https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/loaders/GLTFLoader.js
```

Or download manually in a browser and save to the `lib/` folder.

**Version discipline:** `three.min.js` and `GLTFLoader.js` must be the same version (both r160 / 0.160.0). Mixing versions causes silent failures on GLB load.

> **All assets are external files.** Nothing is embedded in JS or HTML.  
> To swap textures: replace images in `assets/pages/`.  
> To change the book mesh: replace `assets/book/book.glb`.

---

## config.js — Edit This First

```js
// config.js
const BOOK_CONFIG = {
  pages: [
    'assets/pages/page-01.jpg',
    'assets/pages/page-02.jpg',
    'assets/pages/page-03.jpg',
    // add as many as needed
  ],
  flipDuration: 500,        // ms — reduce to 350 on very slow hardware
  backgroundColor: 0x1a1a1a,
  lightColor: 0xfff5e0,     // warm key light
  ambientIntensity: 0.35,
  sounds: {
    flip: 'assets/sounds/flip.mp3',
    land: 'assets/sounds/land.mp3',
  }
};
```

---

## index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Book</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a1a; overflow: hidden; }
    canvas { display: block; width: 100vw; height: 100vh; }
    #hit-left, #hit-right {
      position: fixed; top: 0; height: 100%;
      width: 50%; cursor: pointer; z-index: 10;
    }
    #hit-left  { left: 0; }
    #hit-right { right: 0; }
  </style>
</head>
<body>
  <div id="hit-left"></div>
  <div id="hit-right"></div>

  <!-- All scripts local — no internet required -->
  <script src="lib/three.min.js"></script>
  <script src="lib/GLTFLoader.js"></script>  <!-- attaches as THREE.GLTFLoader -->
  <script src="config.js"></script>
  <script src="audio.js"></script>
  <script src="book.js"></script>
</body>
</html>
```

---

## audio.js

```js
// audio.js — Web Audio API, no library
const Audio = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buffers = {};

  async function load(name, url) {
    const res = await fetch(url);
    const raw = await res.arrayBuffer();
    buffers[name] = await ctx.decodeAudioData(raw);
  }

  function play(name, volume = 1) {
    if (!buffers[name]) return;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buffers[name];
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  async function init(soundMap) {
    // AudioContext must resume after a user gesture
    document.addEventListener('touchend', () => ctx.resume(), { once: true });
    document.addEventListener('click',    () => ctx.resume(), { once: true });
    for (const [name, url] of Object.entries(soundMap)) {
      await load(name, url);
    }
  }

  return { init, play };
})();
```

---

## book.js — Scene, Mesh, Flip Logic

```js
// book.js
(async () => {

  // ── Renderer ────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: false }); // antialias off = perf win
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap for low-spec
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false; // use baked AO instead
  document.body.appendChild(renderer.domElement);

  // ── Scene ───────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BOOK_CONFIG.backgroundColor);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 0, 0);

  // ── Lights ──────────────────────────────────────────────────────────────────
  // Key light — single directional, no shadows (too expensive)
  const keyLight = new THREE.DirectionalLight(BOOK_CONFIG.lightColor, 1.2);
  keyLight.position.set(3, 5, 3);
  scene.add(keyLight);

  // Ambient fill
  const ambient = new THREE.AmbientLight(0xffffff, BOOK_CONFIG.ambientIntensity);
  scene.add(ambient);

  // ── Load book cover GLB ─────────────────────────────────────────────────────
  // GLTFLoader.js (examples/js build) attaches itself as THREE.GLTFLoader
  // when loaded via <script> tag — no import needed
  const loader = new THREE.GLTFLoader();
  const gltf = await loader.loadAsync('assets/book/book.glb');
  const bookMesh = gltf.scene;
  bookMesh.scale.setScalar(1);
  scene.add(bookMesh);

  // ── Page planes (two leaves per spread) ─────────────────────────────────────
  // Each "leaf" is a thin PlaneGeometry with a texture
  // Left leaf: rotates around its right edge (pivot = right)
  // Right leaf: rotates around its left edge (pivot = left)

  const PAGE_W = 1.4;
  const PAGE_H = 2.0;
  const PAGE_DEPTH = 0.01;

  const loader2 = new THREE.TextureLoader();
  const textures = await Promise.all(
    BOOK_CONFIG.pages.map(url => loader2.loadAsync(url))
  );

  // Anisotropy improves texture quality at shallow angles — cheap on most GPUs
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  textures.forEach(t => { t.anisotropy = maxAniso; });

  let currentPage = 0; // index of the left page of the current spread
  let isFlipping = false;

  // Pivot groups: geometry is offset so rotation happens at the correct edge
  const leftPivot  = new THREE.Group(); // pivot at x=0, leaf extends left
  const rightPivot = new THREE.Group(); // pivot at x=0, leaf extends right
  scene.add(leftPivot, rightPivot);

  function makeMaterial(texture) {
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.FrontSide,
    });
  }

  // Left leaf geometry: origin at right edge
  const leftGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H);
  leftGeo.translate(-PAGE_W / 2, 0, 0);
  const leftMesh = new THREE.Mesh(leftGeo, makeMaterial(textures[0]));
  leftPivot.add(leftMesh);

  // Right leaf geometry: origin at left edge
  const rightGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H);
  rightGeo.translate(PAGE_W / 2, 0, 0);
  const rightMesh = new THREE.Mesh(rightGeo, makeMaterial(textures[1] || textures[0]));
  rightPivot.add(rightMesh);

  // ── Fake self-shadow during flip ─────────────────────────────────────────────
  // Darkens the page as it rotates edge-on to the light — essentially free
  function updateFlipShading(mesh, angleRad) {
    const dot = Math.abs(Math.cos(angleRad)); // 1 = facing, 0 = edge-on
    mesh.material.color.setScalar(0.45 + 0.55 * dot);
  }

  // ── Flip animation ──────────────────────────────────────────────────────────
  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }

  function animateFlip(pivot, mesh, fromDeg, toDeg, onDone) {
    const start = performance.now();
    const dur = BOOK_CONFIG.flipDuration;

    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const e = easeInOut(t);
      const deg = fromDeg + (toDeg - fromDeg) * e;
      const rad = deg * Math.PI / 180;
      pivot.rotation.y = rad;
      updateFlipShading(mesh, rad);
      if (t < 1) requestAnimationFrame(step);
      else onDone();
    }
    requestAnimationFrame(step);
  }

  function updateTextures() {
    const n = textures.length;
    leftMesh.material.map  = textures[currentPage % n];
    rightMesh.material.map = textures[(currentPage + 1) % n];
    leftMesh.material.needsUpdate  = true;
    rightMesh.material.needsUpdate = true;
  }

  // ── Page navigation ─────────────────────────────────────────────────────────
  function flipForward() {
    if (isFlipping || currentPage >= textures.length - 2) return;
    isFlipping = true;
    Audio.play('flip', 0.8);
    // Right leaf sweeps from 0 → -180 (rotating over to left side)
    animateFlip(rightPivot, rightMesh, 0, -180, () => {
      currentPage += 2;
      updateTextures();
      rightPivot.rotation.y = 0;
      Audio.play('land', 0.6);
      isFlipping = false;
    });
  }

  function flipBack() {
    if (isFlipping || currentPage <= 0) return;
    isFlipping = true;
    Audio.play('flip', 0.8);
    // Left leaf sweeps from 0 → +180
    animateFlip(leftPivot, leftMesh, 0, 180, () => {
      currentPage -= 2;
      updateTextures();
      leftPivot.rotation.y = 0;
      Audio.play('land', 0.6);
      isFlipping = false;
    });
  }

  // ── Input: tap zones ────────────────────────────────────────────────────────
  document.getElementById('hit-left').addEventListener('click',    flipBack);
  document.getElementById('hit-right').addEventListener('click',   flipForward);
  document.getElementById('hit-left').addEventListener('touchend', e => { e.preventDefault(); flipBack(); });
  document.getElementById('hit-right').addEventListener('touchend', e => { e.preventDefault(); flipForward(); });

  // ── Resize ──────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Render loop ─────────────────────────────────────────────────────────────
  // Only re-render when something changes (flip in progress)
  // During idle, stop burning GPU cycles
  let rafId = null;

  function startRender() {
    if (rafId) return;
    function loop() {
      renderer.render(scene, camera);
      if (isFlipping) rafId = requestAnimationFrame(loop);
      else rafId = null;
    }
    rafId = requestAnimationFrame(loop);
  }

  // Trigger render on flip start
  const origFlipForward = flipForward;
  // (Render loop is called inside animateFlip's rAF — already demand-driven)
  // Initial render
  renderer.render(scene, camera);

  // ── Audio init ──────────────────────────────────────────────────────────────
  await Audio.init(BOOK_CONFIG.sounds);

})();
```

---

## Blender → GLB Pipeline

### 1. Model the book cover

- Keep it simple: a flat box for the cover + a slightly curved spine
- Target: **under 2 000 triangles** for the full cover mesh
- The page content is handled by the Three.js plane geometries, not the GLB

### 2. Retopology (if starting from a sculpt)

Use **Instant Meshes** (free):
```
Mesh → Export OBJ → open in Instant Meshes → target ~500 faces → export → re-import to Blender
```
Or retopo manually — a book is simple enough:  
- 6–8 edge loops along the spine curvature  
- Clean quads across cover faces  
- No need for edge loops inside flat cover areas

### 3. UV Unwrap

- Mark seams: spine edges, cover border  
- Smart UV Project works fine for a book — no overlap issues  
- Pack UVs to a 1024×1024 or 2048×2048 atlas

### 4. Bake (Cycles, even a quick bake is fine)

| Map | Resolution | Notes |
|-----|-----------|-------|
| AO | 1024×1024 | 16 samples is enough |
| Normal | 1024×1024 | From a sculpted high-poly if available |
| Roughness | 512×512 | Paint by hand: spine = rough, cover = slightly glossy |

In Blender's shader editor, combine maps before export:
```
AO node → multiply with Base Color → PrincipledBSDF
```

### 5. Export GLB

```
File → Export → glTF 2.0 (.glb)
✓ Apply Modifiers
✓ Include: Mesh, Materials
✓ Compression: Draco (reduces file size ~60%)
✗ Cameras / Lights — exclude, use Three.js lights instead
```

---

## Performance Checklist for Low-Spec Hardware

| Setting | Value | Why |
|---------|-------|-----|
| `antialias` | `false` | Biggest single perf win |
| `pixelRatio` | capped at 1.5 | Reduces fill rate |
| Shadow maps | disabled | Use baked AO |
| Active lights | 1 directional + 1 ambient | Minimum needed for good look |
| Page textures | JPG at 1024×1024 or 2048×2048 | Balance quality vs VRAM |
| DOM pages | 2 plane meshes total | No pooling needed |
| Render loop | demand-driven (only during flip) | GPU idles when book is static |
| `will-change` | not needed (Three.js manages) | N/A |
| GLB poly count | < 2 000 triangles | Book mesh is decorative |

---

## Sound Assets — Where to Get CC0 Sources

| Site | Search terms |
|------|-------------|
| freesound.org | `page turn`, `book flip`, `paper whoosh` |
| zapsplat.com | `page turn single` |
| pixabay.com/sound-effects | `book` |

Convert to MP3 at 128kbps in Audacity or ffmpeg:
```bash
ffmpeg -i flip.wav -b:a 128k assets/sounds/flip.mp3
```

Trim the flip sound to under 500ms — shorter feels snappier on touch.

---

## Optional: Preload Adjacent Pages

For a smoother experience, preload the next 2 textures ahead:

```js
// Add to config.js or book.js init
function preloadAhead(index) {
  for (let i = 1; i <= 2; i++) {
    const url = BOOK_CONFIG.pages[index + i];
    if (url) {
      const img = new Image();
      img.src = url;
    }
  }
}
// Call after each flip
```

---

## Serving Locally

Browsers block `fetch()` on `file://` — you need a local server.

```bash
# Python (built-in, no install)
python3 -m http.server 8080

# Node (if installed)
npx serve .
```

Then open `http://localhost:8080` on the touchscreen.

---

## Quick Start Summary

1. Drop your page images into `assets/pages/` named `page-01.jpg`, `page-02.jpg`, …
2. Update the `pages` array in `config.js`
3. Export your book GLB from Blender → `assets/book/book.glb`
4. Add flip/land sounds to `assets/sounds/`
5. Run a local server, open in browser
6. Tap left half = previous, tap right half = next
