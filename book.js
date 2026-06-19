// book.js — Three.js scene, page-flip logic, input handling
(async () => {

  // ── Renderer ─────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputEncoding    = THREE.sRGBEncoding;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  // ── Scene ─────────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BOOK_CONFIG.backgroundColor);

  // ── Camera — start at attract position (app opens in attract mode) ───────────
  const _wc = BOOK_CONFIG.cameras.work;
  function _readCamPos(key) {
    try { const v = localStorage.getItem('cam-' + key); if (v) return JSON.parse(v); } catch (_) {}
    return BOOK_CONFIG.cameras[key];
  }
  const _ac = _readCamPos('attract');
  const camera = new THREE.PerspectiveCamera(_ac.fov || 45, window.innerWidth / window.innerHeight, 0.5, 20);
  camera.position.set(_ac.x, _ac.y, _ac.z);
  const camState = { look: new THREE.Vector3(_ac.lx, _ac.ly, _ac.lz) };
  camera.lookAt(camState.look);

  // ── Lights ────────────────────────────────────────────────────────────────────
  const keyLight = new THREE.DirectionalLight(BOOK_CONFIG.lightColor, 1.2);
  keyLight.position.set(3, 5, 3);
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far  = 20;
  scene.add(keyLight);
  const ambient = new THREE.AmbientLight(0xffffff, BOOK_CONFIG.ambientIntensity);
  scene.add(ambient);

  // ── Textures ──────────────────────────────────────────────────────────────────
  function makePlaceholder(index) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const c = canvas.getContext('2d');
    c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, 512, 512);
    c.fillStyle = '#555'; c.font = 'bold 60px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(`Page ${index + 1}`, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }

  const texLoader = new THREE.TextureLoader();
  function loadTexture(url, i) {
    return new Promise(resolve =>
      texLoader.load(url, resolve, undefined, () => resolve(makePlaceholder(i)))
    );
  }

  // ── Video texture support ─────────────────────────────────────────────────────
  const videoElements = new Map(); // VideoTexture → HTMLVideoElement
  let videoRaf = null;

  function loadVideoTexture(url) {
    return new Promise(resolve => {
      const video = document.createElement('video');
      video.src = url;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      const onCreate = () => {
        const texture = new THREE.VideoTexture(video);
        videoElements.set(texture, video);
        resolve(texture);
      };
      if (video.readyState >= 2) { onCreate(); return; }
      video.addEventListener('loadeddata', onCreate,                      { once: true });
      video.addEventListener('error',      () => resolve(makePlaceholder(0)), { once: true });
      video.load();
    });
  }

  function loadPageAsset(url, i) {
    return /\.(mp4|webm)$/i.test(url) ? loadVideoTexture(url) : loadTexture(url, i);
  }

  function startVideos(texList) {
    const hasVideo = texList.some(t => t && t.isVideoTexture);
    if (!hasVideo) return;
    texList.forEach(t => { const v = videoElements.get(t); if (v) v.play().catch(() => {}); });
    if (videoRaf) return;
    (function loop() {
      renderer.render(scene, camera);
      videoRaf = requestAnimationFrame(loop);
    })();
  }

  function stopVideos(texList) {
    texList.forEach(t => { const v = videoElements.get(t); if (v) v.pause(); });
    if (videoRaf) { cancelAnimationFrame(videoRaf); videoRaf = null; }
  }

  // Load user-config.json FIRST so the configured language/settings apply on load.
  // (Bundled with the project for distribution.) Non-language keys only fill in
  // values this machine hasn't set; book-lang is authoritative (see below).
  let userCfg = null;
  try {
    const res = await fetch('assets/user-config.json', { cache: 'no-store' });
    if (res.ok) {
      userCfg = await res.json();
      for (const [k, v] of Object.entries(userCfg)) {
        if (k === 'book-lang') continue;                       // handled authoritatively below
        if (localStorage.getItem(k) === null)
          localStorage.setItem(k, JSON.stringify(v));
      }
    }
  } catch (_) {}

  // Configured language wins on load (a deployed kiosk always starts in the
  // language set in user-config.json, ignoring stale localStorage). The in-app
  // switcher still works during the session.
  let lang = (userCfg && userCfg['book-lang']) || localStorage.getItem('book-lang') || 'en';
  localStorage.setItem('book-lang', lang);

  async function discoverPages(l) {
    const found = [];
    const exts = ['jpg', 'jpeg', 'png', 'mp4', 'webm'];
    const MAX_GAP  = 5;     // tolerate up to this many consecutive missing numbers
    const MAX_PAGE = 999;   // hard ceiling so we never scan forever
    let misses = 0;
    for (let i = 1; i <= MAX_PAGE; i++) {
      const base = `assets/pages/${l}/page-${String(i).padStart(2, '0')}`;
      let hit = null;
      for (const ext of exts) {
        try {
          const res = await fetch(`${base}.${ext}`, { method: 'HEAD', cache: 'no-store' });
          if (res.ok) { hit = `${base}.${ext}`; break; }
        } catch (_) {}
      }
      if (hit) { found.push(hit); misses = 0; }
      else if (++misses > MAX_GAP) break;   // give up after MAX_GAP blanks in a row
    }
    return found;
  }

  const pageList = await discoverPages(lang);
  const textures = await Promise.all(pageList.map(loadPageAsset));
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  textures.forEach(t => { if (t) { t.anisotropy = maxAniso; markSRGB(t); } });
  startVideos(textures);

  // ── Mutable settings (dev panel writes here, persisted in localStorage) ───────
  const bs = {
    PAGE_W:           1.61,
    PAGE_H:           2.0,
    LAG:              0.42,
    SEGMENTS:         28,
    flipDuration:     BOOK_CONFIG.flipDuration      || 850,
    attractMs:        BOOK_CONFIG.attractTransitionMs || 2000,
    ambientIntensity: BOOK_CONFIG.ambientIntensity   || 0.35,
    keyIntensity:     1.2,
    bookX: 0, bookY: 0, bookZ: 0,
    bookRotX: 0, bookRotY: 0, bookRotZ: 0,
    bookScaleX: 1, bookScaleY: 1, bookScaleZ: 1,
    tableX: 0, tableY: 0, tableZ: -0.2,
    tableRotX: 0, tableRotY: 0, tableRotZ: 0,
    tableScaleX: 6, tableScaleY: 5,
    musicVolume:   0.4,
    showLangBtns:  true,
    flipVolume:    0.8,
    landVolume:    0.6,
    landOffset:    0,     // ms before flip end to play land sound (positive = earlier)
    exposure:      1.0,
    resolution:    Math.min(window.devicePixelRatio, 1.5),
    toneMapping:   4,       // THREE.ACESFilmicToneMapping
    shadowMapSize: 0,       // 0=off, 512=low, 1024=med, 2048=high
    filmGrain:     false,
    grainStrength: 0.05,
    vignette:      false,
    vignetteStr:   0.6,
    saturation:    1.0,
    contrast:      1.0,
    fog:           false,
    fogDensity:    0.05,
    edgeBlur:      false,
    edgeBlurStr:   10,
    bloom:         false,
    bloomRadius:   8,
    bloomStrength: 1.5,
    navMode:       'arrows',
  };
  // (user-config.json already loaded above, before language/discovery.)

  try {
    const saved = localStorage.getItem('book-settings');
    if (saved) Object.assign(bs, JSON.parse(saved));
  } catch (_) {}

  // Apply loaded settings to live objects
  ambient.intensity  = bs.ambientIntensity;
  keyLight.intensity = bs.keyIntensity;
  renderer.toneMappingExposure = bs.exposure;

  // ── Book cover (loaded after bs so applyBookTransform can read it) ────────────
  let bookModel = null;
  function applyBookTransform() {
    if (!bookModel) return;
    const d = Math.PI / 180;
    bookModel.position.set(bs.bookX, bs.bookY, bs.bookZ);
    bookModel.rotation.set(bs.bookRotX * d, bs.bookRotY * d, bs.bookRotZ * d);
    bookModel.scale.set(bs.bookScaleX, bs.bookScaleY, bs.bookScaleZ);
  }

  try {
    const gltf = await new THREE.GLTFLoader().loadAsync('assets/book/book.gltf');
    bookModel = gltf.scene;
  } catch (err) {
    console.error('[book] Failed to load book.gltf — falling back to cube:', err);
    bookModel = new THREE.Mesh(
      new THREE.BoxGeometry(3.22, 2.0, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 })
    );
  }
  applyBookTransform();
  scene.add(bookModel);

  // ── Table plane ───────────────────────────────────────────────────────────────
  const tableTex = await new Promise(resolve =>
    texLoader.load('assets/textures/table-texture.png', resolve, undefined, (err) => {
      console.error('[book] Failed to load table-texture.png:', err);
      resolve(null);
    })
  );
  const tablePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ map: tableTex, roughness: 0.9, metalness: 0 })
  );
  function applyTableTransform() {
    const d = Math.PI / 180;
    tablePlane.position.set(bs.tableX, bs.tableY, bs.tableZ);
    tablePlane.rotation.set(bs.tableRotX * d, bs.tableRotY * d, bs.tableRotZ * d);
    tablePlane.scale.set(bs.tableScaleX, bs.tableScaleY, 1);
  }
  applyTableTransform();
  scene.add(tablePlane);

  // ── Scene objects (user-placed models) ────────────────────────────────────────
  const sceneObjects = [];

  async function addSceneObject(url, savedTransform) {
    try {
      const gltf = await new THREE.GLTFLoader().loadAsync(url);
      const mesh = gltf.scene;
      if (savedTransform) {
        mesh.position.fromArray(savedTransform.pos);
        mesh.rotation.fromArray(savedTransform.rot);
        mesh.scale.fromArray(savedTransform.scale);
      }
      mesh.traverse(child => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (!mat) return;

          // There is no environment map in this scene, so metallic PBR surfaces
          // have nothing to reflect and render BLACK (e.g. the plant). Make props
          // non-metallic + matte so they show their base colour/texture instead.
          if ('metalness' in mat) {
            mat.metalness    = 0;
            mat.metalnessMap = null;          // drop the metallic map (causes black)
            mat.envMap       = null;
            if (mat.roughness === undefined || mat.roughness < 0.6) mat.roughness = 0.85;
            mat.roughnessMap = null;
            mat.needsUpdate  = true;
          }

          // Fix alpha-card foliage: cutout mode + both sides on alpha materials only
          if (mat.transparent || mat.alphaTest > 0) {
            mat.side        = THREE.DoubleSide;
            mat.transparent = false;         // switch to cutout, not blend
            mat.alphaTest   = mat.alphaTest > 0 ? mat.alphaTest : 0.5;
            mat.depthWrite  = true;          // write depth so cards occlude correctly
            mat.needsUpdate = true;
          }
        });
      });
      scene.add(mesh);
      const obj = { mesh, url };
      sceneObjects.push(obj);
      renderer.render(scene, camera);
      return obj;
    } catch (e) {
      console.warn('Scene: could not load', url, e);
      return null;
    }
  }

  function removeSceneObject(obj) {
    const idx = sceneObjects.indexOf(obj);
    if (idx === -1) return;
    scene.remove(obj.mesh);
    sceneObjects.splice(idx, 1);
    renderer.render(scene, camera);
  }

  function saveSceneState() {
    const state = sceneObjects.map(o => ({
      url:   o.url,
      pos:   o.mesh.position.toArray(),
      rot:   [o.mesh.rotation.x, o.mesh.rotation.y, o.mesh.rotation.z],
      scale: o.mesh.scale.toArray(),
    }));
    localStorage.setItem('book-scene', JSON.stringify(state));
  }

  // Restore persisted scene objects
  try {
    const saved = localStorage.getItem('book-scene');
    if (saved) {
      for (const item of JSON.parse(saved)) {
        await addSceneObject(item.url, item);
      }
    }
  } catch (_) {}

  // ── State ─────────────────────────────────────────────────────────────────────
  let currentPage = 0;
  let isFlipping  = false;
  const pages     = {};  // populated by buildPages()

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function tex(i) { return (i >= 0 && i < textures.length) ? textures[i] : null; }

  // Mark a colour texture as sRGB so it decodes correctly (otherwise pages look
  // washed-out / too bright). Guarded for both old and new three.js APIs.
  function markSRGB(t) {
    if (!t) return t;
    if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding !== undefined)     t.encoding   = THREE.sRGBEncoding;
    return t;
  }

  function makeMat(t, side) {
    // toneMapped:false → pages skip ACES tone mapping, so the scan keeps its
    // real contrast/brightness instead of the bright, de-contrasted filmic look.
    // (The table & props still use tone mapping for a cinematic feel.)
    return new THREE.MeshStandardMaterial({
      // Lower roughness gives a soft specular sheen that sweeps across the page
      // as it curls under the key light (the "shine") — without the ACES wash.
      map: markSRGB(t), roughness: 0.55, metalness: 0, side, toneMapped: false,
    });
  }

  function setTex(mesh, t) { mesh.material.map = t; mesh.material.needsUpdate = true; }

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function applyCurl(geo, origPos, t, totalAngle) {
    const lag = bs.LAG;
    const fwd = totalAngle < 0;
    const pos = geo.attributes.position;
    const arr = pos.array;
    for (let i = 0; i < arr.length; i += 3) {
      const ox = origPos[i];
      const u  = fwd ? ox / bs.PAGE_W : -ox / bs.PAGE_W;
      const lt = Math.max(0, Math.min(1, (t - (1 - u) * lag) / (1 - lag)));
      const theta = easeInOut(lt) * totalAngle;
      arr[i]     = ox * Math.cos(theta);
      arr[i + 2] = -ox * Math.sin(theta);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function resetGeo(geo, origPos) {
    geo.attributes.position.array.set(origPos);
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  function syncBack(leaf) {
    leaf.geoBack.attributes.position.array.set(leaf.geo.attributes.position.array);
    leaf.geoBack.attributes.position.needsUpdate = true;
    leaf.geoBack.computeVertexNormals();
  }

  function animateFlip(leaf, totalAngle, onDone, dur = bs.flipDuration) {
    const start = performance.now();
    const baseZ = 0.105;                 // resting height, just above static pages (0.1)
    const lift  = bs.flipLift != null ? bs.flipLift : 0.03;  // small extra height at mid-flip (eased, near the old position)
    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      applyCurl(leaf.geo, leaf.origPos, t, totalAngle);
      syncBack(leaf);
      // Ease the page up off the stack and back down (sin = 0 at both ends → no snap)
      const z = baseZ + Math.sin(Math.PI * t) * lift;
      leaf.front.position.z = leaf.back.position.z = z;
      renderer.render(scene, camera);
      if (t < 1) requestAnimationFrame(step);
      else { leaf.front.position.z = leaf.back.position.z = baseZ; onDone(); }
    }
    requestAnimationFrame(step);
  }

  // ── Page builder ──────────────────────────────────────────────────────────────
  function disposeLeaf(leaf) {
    if (!leaf) return;
    leaf.geo.dispose();    scene.remove(leaf.front); leaf.front.material.dispose();
    leaf.geoBack.dispose(); scene.remove(leaf.back);  leaf.back.material.dispose();
  }

  function disposeBg(mesh) {
    if (!mesh) return;
    mesh.geometry.dispose(); mesh.material.dispose(); scene.remove(mesh);
  }

  function makeFlipLeaf(tx) {
    const { PAGE_W, PAGE_H, SEGMENTS } = bs;
    const geo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, SEGMENTS, 1);
    geo.translate(tx, 0, 0);
    const origPos = new Float32Array(geo.attributes.position.array);
    const geoBack = geo.clone();
    const uv = geoBack.attributes.uv.array;
    for (let i = 0; i < uv.length; i += 2) uv[i] = 1 - uv[i];
    const front = new THREE.Mesh(geo,     makeMat(null, THREE.FrontSide));
    const back  = new THREE.Mesh(geoBack, makeMat(null, THREE.BackSide));
    front.position.z = back.position.z = 0.105;   // resting height (animateFlip eases the lift)
    front.visible = back.visible = false;
    scene.add(front, back);
    return { geo, geoBack, origPos, front, back };
  }

  function buildPages() {
    disposeLeaf(pages.flipR);
    disposeLeaf(pages.flipL);
    disposeBg(pages.bgLeft);
    disposeBg(pages.bgRight);

    const { PAGE_W, PAGE_H } = bs;

    const bgLGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H);
    bgLGeo.translate(-PAGE_W / 2, 0, 0);
    pages.bgLeft = new THREE.Mesh(bgLGeo, makeMat(tex(currentPage), THREE.FrontSide));
    pages.bgLeft.position.z = 0.1;
    scene.add(pages.bgLeft);

    const bgRGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H);
    bgRGeo.translate(PAGE_W / 2, 0, 0);
    pages.bgRight = new THREE.Mesh(bgRGeo, makeMat(tex(currentPage + 1), THREE.FrontSide));
    pages.bgRight.position.z = 0.1;
    scene.add(pages.bgRight);

    pages.flipR = makeFlipLeaf( PAGE_W / 2);
    pages.flipL = makeFlipLeaf(-PAGE_W / 2);

    renderer.render(scene, camera);
  }

  buildPages();

  // ── Navigation ────────────────────────────────────────────────────────────────
  function flipForward(onComplete, dur = bs.flipDuration) {
    if (isFlipping || currentPage >= textures.length - 2) { if (onComplete) onComplete(); return; }
    isFlipping = true;
    const N = currentPage;
    setTex(pages.bgRight, tex(N + 3));
    setTex(pages.flipR.front, tex(N + 1));
    setTex(pages.flipR.back,  tex(N + 2));
    resetGeo(pages.flipR.geo, pages.flipR.origPos);
    syncBack(pages.flipR);
    pages.flipR.front.visible = pages.flipR.back.visible = true;
    Audio.play('flip', bs.flipVolume);
    setTimeout(() => Audio.play('land', bs.landVolume), Math.max(0, dur - bs.landOffset));
    animateFlip(pages.flipR, -Math.PI, () => {
      setTex(pages.bgLeft, tex(N + 2));
      pages.flipR.front.visible = pages.flipR.back.visible = false;
      resetGeo(pages.flipR.geo, pages.flipR.origPos);
      syncBack(pages.flipR);
      currentPage = N + 2;
      updateHomeBtn();
      renderer.render(scene, camera);
      isFlipping = false;
      if (onComplete) onComplete();
    }, dur);
  }

  function flipBack(onComplete, dur = bs.flipDuration) {
    if (isFlipping || currentPage <= 0) { if (onComplete) onComplete(); return; }
    isFlipping = true;
    const N = currentPage;
    setTex(pages.bgLeft, tex(N - 2));
    setTex(pages.flipL.front, tex(N));
    setTex(pages.flipL.back,  tex(N - 1));
    resetGeo(pages.flipL.geo, pages.flipL.origPos);
    syncBack(pages.flipL);
    pages.flipL.front.visible = pages.flipL.back.visible = true;
    Audio.play('flip', bs.flipVolume);
    setTimeout(() => Audio.play('land', bs.landVolume), Math.max(0, dur - bs.landOffset));
    animateFlip(pages.flipL, Math.PI, () => {
      setTex(pages.bgRight, tex(N - 1));
      pages.flipL.front.visible = pages.flipL.back.visible = false;
      resetGeo(pages.flipL.geo, pages.flipL.origPos);
      syncBack(pages.flipL);
      currentPage = N - 2;
      updateHomeBtn();
      renderer.render(scene, camera);
      isFlipping = false;
      if (onComplete) onComplete();
    }, dur);
  }

  // ── Home button ───────────────────────────────────────────────────────────────
  const homeBtn = document.getElementById('home-btn');

  function updateHomeBtn() {
    homeBtn.classList.toggle('hidden', currentPage === 0 || bs.navMode === 'pages');
    buildPageNavHighlight();
  }

  function flipToStart() {
    if (currentPage === 0) return;
    const fastDur = Math.min(bs.flipDuration, 250);
    function next() { if (currentPage > 0) flipBack(next, fastDur); }
    next();
  }

  homeBtn.addEventListener('click',    flipToStart);
  homeBtn.addEventListener('touchend', e => { e.preventDefault(); flipToStart(); });

  // ── Page navigation (pages mode) ──────────────────────────────────────────────
  // Up to this many spreads → numbered buttons; above → a scrubber (slider).
  const PAGE_NAV_BTN_LIMIT = 14;

  function scrubberLabel(spread) {
    const total = textures.length;
    const a = 2 * spread + 1;
    const b = Math.min(2 * spread + 2, total);
    return (a === b ? a : a + '–' + b) + ' / ' + total;
  }

  function buildPageNavHighlight() {
    const container = document.getElementById('page-nav');
    if (!container) return;
    const spread = Math.floor(currentPage / 2);
    container.querySelectorAll('.page-nav-btn').forEach((btn, i) => {
      btn.classList.toggle('on', i === spread);
    });
    const slider = container.querySelector('#ps-slider');
    if (slider) {
      slider.value = spread;
      const label = container.querySelector('#ps-label');
      if (label) label.textContent = scrubberLabel(spread);
    }
  }

  function buildPageNav() {
    const container = document.getElementById('page-nav');
    if (!container) return;
    container.innerHTML = '';
    const numSpreads = Math.ceil(textures.length / 2);

    if (numSpreads <= PAGE_NAV_BTN_LIMIT) {
      // Few pages → numbered buttons
      for (let i = 0; i < numSpreads; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-nav-btn';
        btn.textContent = i + 1;
        const target = i * 2;
        btn.addEventListener('click',    () => jumpToPage(target));
        btn.addEventListener('touchend', e => { e.preventDefault(); jumpToPage(target); });
        container.appendChild(btn);
      }
    } else {
      // Many pages → scrubber (slider + step buttons + label)
      const wrap = document.createElement('div');
      wrap.className = 'page-scrubber';

      const prev = document.createElement('button');
      prev.className = 'ps-step'; prev.textContent = '‹';   // ‹
      prev.addEventListener('click', () => jumpToPage(currentPage - 2));

      const slider = document.createElement('input');
      slider.type = 'range'; slider.id = 'ps-slider';
      slider.min = 0; slider.max = numSpreads - 1; slider.step = 1;
      slider.value = Math.floor(currentPage / 2);
      const label = document.createElement('div');
      label.className = 'ps-label'; label.id = 'ps-label';
      // live label while dragging; jump only on release (avoids flip-storm)
      slider.addEventListener('input',  () => { label.textContent = scrubberLabel(+slider.value); });
      slider.addEventListener('change', () => jumpToPage((+slider.value) * 2));

      const next = document.createElement('button');
      next.className = 'ps-step'; next.textContent = '›';   // ›
      next.addEventListener('click', () => jumpToPage(currentPage + 2));

      wrap.append(prev, slider, label, next);
      container.appendChild(wrap);
    }
    buildPageNavHighlight();
  }

  // Instant jump to a spread (no flip-through) — used for big distances.
  function setSpread(target) {
    target = Math.max(0, Math.min(target, textures.length - 2));
    if (target % 2 !== 0) target -= 1;
    currentPage = target;
    setTex(pages.bgLeft,  tex(currentPage));
    setTex(pages.bgRight, tex(currentPage + 1));
    if (pages.flipR) pages.flipR.front.visible = pages.flipR.back.visible = false;
    if (pages.flipL) pages.flipL.front.visible = pages.flipL.back.visible = false;
    Audio.play('land', bs.landVolume);
    updateHomeBtn();
    renderer.render(scene, camera);
    buildPageNavHighlight();
  }

  function jumpToPage(target) {
    if (isFlipping) return;
    target = Math.max(0, Math.min(target, textures.length - 2));
    if (target % 2 !== 0) target = target - 1;
    if (target === currentPage) return;

    const dist = Math.abs(target - currentPage) / 2;

    // Big jump → instant (flipping through 100 spreads would take ~30s)
    if (dist > 3) { setSpread(target); return; }

    const dur = dist <= 1 ? bs.flipDuration : Math.min(bs.flipDuration, 280);
    if (target > currentPage) {
      function stepFwd() {
        if (currentPage < target && currentPage < textures.length - 2) flipForward(stepFwd, dur);
        else buildPageNavHighlight();
      }
      stepFwd();
    } else {
      function stepBack() {
        if (currentPage > target && currentPage > 0) flipBack(stepBack, dur);
        else buildPageNavHighlight();
      }
      stepBack();
    }
  }

  function applyNavMode() {
    const isArrows = bs.navMode !== 'pages';
    const navPrev = document.getElementById('nav-prev');
    const navNext = document.getElementById('nav-next');
    const pageNav = document.getElementById('page-nav');
    if (navPrev) navPrev.classList.toggle('hidden', !isArrows);
    if (navNext) navNext.classList.toggle('hidden', !isArrows);
    if (pageNav) pageNav.style.display = isArrows ? 'none' : 'flex';
    if (!isArrows) buildPageNav();
    updateHomeBtn();
  }

  // ── Language switching ────────────────────────────────────────────────────────
  const uiText = {
    en: {
      touchToBegin: 'Touch to Begin',
      backToStart:  '← Back to start',
      prev:         'Previous',
      next:         'Next',
    },
    ro: {
      touchToBegin: 'Atingeți pentru a începe',
      backToStart:  '← Înapoi la început',
      prev:         'Anterior',
      next:         'Următor',
    },
  };

  function applyLangUI(l) {
    const t = uiText[l] || uiText.en;
    const startLabel  = document.getElementById('start-label');
    const homeBtnText = document.getElementById('home-btn-text');
    const navPrev     = document.getElementById('nav-prev');
    const navNext     = document.getElementById('nav-next');
    if (startLabel)  startLabel.textContent  = t.touchToBegin;
    if (homeBtnText) homeBtnText.textContent = t.backToStart;
    if (navPrev)     navPrev.textContent     = t.prev;
    if (navNext)     navNext.textContent     = t.next;
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('on'));
    const active = document.getElementById('lang-' + l);
    if (active) active.classList.add('on');
    const langBtns = document.getElementById('lang-btns');
    if (langBtns) langBtns.style.display = bs.showLangBtns ? '' : 'none';
  }

  async function switchLanguage(newLang) {
    if (newLang === lang) return;
    lang = newLang;
    localStorage.setItem('book-lang', lang);
    const newList = await discoverPages(lang);
    if (!newList.length) { applyLangUI(lang); return; }
    const newTex = await Promise.all(newList.map(loadPageAsset));
    newTex.forEach(t => { if (t) { t.anisotropy = maxAniso; markSRGB(t); } });
    stopVideos(textures);
    textures.length = 0;
    newTex.forEach(t => textures.push(t));
    startVideos(textures);
    currentPage = Math.min(currentPage, Math.max(0, textures.length - 2));
    setTex(pages.bgLeft,  tex(currentPage));
    setTex(pages.bgRight, tex(currentPage + 1));
    updateHomeBtn();
    renderer.render(scene, camera);
    applyLangUI(lang);
    if (bs.navMode === 'pages') buildPageNav();
  }

  document.getElementById('lang-en').addEventListener('click',    () => switchLanguage('en'));
  document.getElementById('lang-ro').addEventListener('click',    () => switchLanguage('ro'));
  document.getElementById('lang-en').addEventListener('touchend', e => { e.preventDefault(); switchLanguage('en'); });
  document.getElementById('lang-ro').addEventListener('touchend', e => { e.preventDefault(); switchLanguage('ro'); });
  applyLangUI(lang);
  applyNavMode();

  // ── Input ─────────────────────────────────────────────────────────────────────
  document.getElementById('hit-left').addEventListener('click',    () => { flipBack(); updateHomeBtn(); });
  document.getElementById('hit-right').addEventListener('click',   () => { flipForward(); updateHomeBtn(); });
  document.getElementById('hit-left').addEventListener('touchend', e => { e.preventDefault(); flipBack(); updateHomeBtn(); });
  document.getElementById('hit-right').addEventListener('touchend', e => { e.preventDefault(); flipForward(); updateHomeBtn(); });

  // ── Resize ────────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.lookAt(camState.look);
    renderer.render(scene, camera);
  });

  // ── Quality settings ──────────────────────────────────────────────────────────
  function applyQuality() {
    // Resolution
    renderer.setPixelRatio(bs.resolution);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Tone mapping
    renderer.toneMapping         = bs.toneMapping;
    renderer.toneMappingExposure = bs.exposure;
    // Shadows
    const shadowOn = bs.shadowMapSize > 0;
    renderer.shadowMap.enabled     = shadowOn;
    renderer.shadowMap.needsUpdate = true;
    keyLight.castShadow = shadowOn;
    if (shadowOn && keyLight.shadow.mapSize.x !== bs.shadowMapSize) {
      keyLight.shadow.mapSize.set(bs.shadowMapSize, bs.shadowMapSize);
      if (keyLight.shadow.map) { keyLight.shadow.map.dispose(); keyLight.shadow.map = null; }
    }
    const shadowMeshes = [bookModel, tablePlane, ...sceneObjects.map(o => o.mesh)];
    shadowMeshes.forEach(m => { if (m) m.traverse(c => { if (c.isMesh) { c.castShadow = shadowOn; c.receiveShadow = shadowOn; } }); });
    // Fog
    scene.fog = bs.fog ? new THREE.FogExp2(new THREE.Color(BOOK_CONFIG.backgroundColor), bs.fogDensity) : null;
    // Saturation + contrast via CSS filter on the canvas
    renderer.domElement.style.filter = `saturate(${bs.saturation}) contrast(${bs.contrast})`;
  }
  applyQuality();

  // ── Audio ─────────────────────────────────────────────────────────────────────
  await Audio.init(BOOK_CONFIG.sounds);

  // ── Initial render ────────────────────────────────────────────────────────────
  renderer.render(scene, camera);

  // ── Notify attract/dev modules ────────────────────────────────────────────────
  document.dispatchEvent(new CustomEvent('book-ready', {
    detail: { camera, renderer, scene, camState, bs, buildPages, ambient, keyLight, bookModel, applyBookTransform, tablePlane, applyTableTransform, sceneObjects, addSceneObject, removeSceneObject, saveSceneState, applyQuality, flipForward, flipBack, updateHomeBtn, applyNavMode }
  }));

})();
