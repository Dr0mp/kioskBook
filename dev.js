// dev.js — camera positioning panel + scene settings (press D to toggle)
document.addEventListener('book-ready', ({ detail: { camera, renderer, scene, camState, bs, buildPages, ambient, keyLight, bookModel, applyBookTransform, tablePlane, applyTableTransform, sceneObjects, addSceneObject, removeSceneObject, saveSceneState, applyQuality, applyNavMode } }) => {
  console.log('[dev] book-ready received, setting up dev panel');

  const panel   = document.getElementById('dev-panel');
  const overlay = document.getElementById('dev-overlay');
  window._devMode = false;

  // ── Tab switching ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.dev-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dev-tab').forEach(t => t.classList.remove('on'));
      document.querySelectorAll('.dev-pane').forEach(p => p.classList.add('hidden'));
      tab.classList.add('on');
      document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    });
  });

  // ── Saved positions ───────────────────────────────────────────────────────────
  function loadPos(key) {
    try { const v = localStorage.getItem('cam-' + key); if (v) return JSON.parse(v); }
    catch (_) {}
    return BOOK_CONFIG.cameras[key];
  }

  function savePos(key, pos, look) {
    localStorage.setItem('cam-' + key, JSON.stringify({
      x: +pos.x.toFixed(3), y: +pos.y.toFixed(3), z: +pos.z.toFixed(3),
      lx: +look.x.toFixed(3), ly: +look.y.toFixed(3), lz: +look.z.toFixed(3),
      fov: +camera.fov.toFixed(1),
    }));
  }

  // ── Live position display ─────────────────────────────────────────────────────
  const posEl  = document.getElementById('dev-pos');
  const lookEl = document.getElementById('dev-look');

  const fovInput = document.getElementById('dev-fov');

  function refreshDisplay() {
    const p = camera.position;
    const l = camState.look;
    posEl.textContent  = `pos  ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`;
    lookEl.textContent = `look ${l.x.toFixed(2)}, ${l.y.toFixed(2)}, ${l.z.toFixed(2)}`;
    fovInput.value = camera.fov.toFixed(1);
  }

  fovInput.addEventListener('input', () => {
    camera.fov = parseFloat(fovInput.value);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  });

  // ── Orbit controls ────────────────────────────────────────────────────────────
  // Spherical coordinates around camState.look
  let sphere = { r: 0, theta: 0, phi: 0 };
  let rafId  = null;

  function initSphere() {
    const d = new THREE.Vector3().subVectors(camera.position, camState.look);
    sphere.r     = d.length();
    sphere.theta = Math.atan2(d.x, d.z);
    sphere.phi   = Math.asin(Math.max(-1, Math.min(1, d.y / (sphere.r || 1))));
  }

  function applyOrbit() {
    sphere.phi = Math.max(-1.4, Math.min(1.4, sphere.phi));
    sphere.r   = Math.max(0.5, sphere.r);
    camera.position.set(
      camState.look.x + sphere.r * Math.cos(sphere.phi) * Math.sin(sphere.theta),
      camState.look.y + sphere.r * Math.sin(sphere.phi),
      camState.look.z + sphere.r * Math.cos(sphere.phi) * Math.cos(sphere.theta)
    );
    camera.lookAt(camState.look);
    renderer.render(scene, camera);
    refreshDisplay();
  }

  // Mouse drag → orbit
  let drag = null;
  overlay.addEventListener('mousedown', e => {
    drag = { x: e.clientX, y: e.clientY };
    overlay.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!drag || !window._devMode) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    sphere.theta -= dx * 0.005;
    sphere.phi   += dy * 0.005;
    applyOrbit();
  });
  window.addEventListener('mouseup', () => {
    drag = null;
    overlay.style.cursor = 'grab';
  });

  // Scroll → zoom
  overlay.addEventListener('wheel', e => {
    e.preventDefault();
    sphere.r *= 1 + e.deltaY * 0.001;
    applyOrbit();
  }, { passive: false });

  // Touch drag → orbit
  let lastTouch = null;
  overlay.addEventListener('touchstart', e => {
    if (e.touches.length === 1) lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  overlay.addEventListener('touchmove', e => {
    if (!lastTouch || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastTouch.x;
    const dy = e.touches[0].clientY - lastTouch.y;
    lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    sphere.theta -= dx * 0.005;
    sphere.phi   += dy * 0.005;
    applyOrbit();
  }, { passive: true });

  // ── Panel buttons ─────────────────────────────────────────────────────────────
  document.getElementById('dev-save-work').addEventListener('click', () => {
    savePos('work', camera.position, camState.look);
    flash('dev-save-work', 'Work saved ✓');
  });

  document.getElementById('dev-save-attract').addEventListener('click', () => {
    savePos('attract', camera.position, camState.look);
    flash('dev-save-attract', 'Attract saved ✓');
  });

  document.getElementById('dev-goto-work').addEventListener('click', () => {
    const wp = loadPos('work');
    camera.position.set(wp.x, wp.y, wp.z);
    camState.look.set(wp.lx, wp.ly, wp.lz);
    camera.fov = wp.fov || 45;
    camera.updateProjectionMatrix();
    camera.lookAt(camState.look);
    renderer.render(scene, camera);
    initSphere();
    refreshDisplay();
  });

  document.getElementById('dev-goto-attract').addEventListener('click', () => {
    const ap = loadPos('attract');
    camera.position.set(ap.x, ap.y, ap.z);
    camState.look.set(ap.lx, ap.ly, ap.lz);
    camera.fov = ap.fov || 45;
    camera.updateProjectionMatrix();
    camera.lookAt(camState.look);
    renderer.render(scene, camera);
    initSphere();
    refreshDisplay();
  });

  document.getElementById('dev-test-attract').addEventListener('click', () => {
    if (window._attract) window._attract.enter();
  });

  document.getElementById('dev-reset').addEventListener('click', () => {
    localStorage.removeItem('cam-work');
    localStorage.removeItem('cam-attract');
    flash('dev-reset', 'Reset ✓');
  });

  // ── Scene settings ────────────────────────────────────────────────────────────
  function bindRange(id, valId, key, onChange) {
    const el = document.getElementById(id);
    if (!el) { console.warn('dev: missing element', id); return; }
    const vl = valId ? document.getElementById(valId) : null;
    el.value = bs[key];
    if (vl) vl.textContent = (+bs[key]).toFixed(2);
    el.addEventListener('input', () => {
      bs[key] = parseFloat(el.value);
      if (vl) vl.textContent = (+bs[key]).toFixed(2);
      if (onChange) onChange();
    });
  }

  function bindNumber(id, key, onChange) {
    const el = document.getElementById(id);
    if (!el) { console.warn('dev: missing element', id); return; }
    el.value = bs[key];
    const handler = () => {
      const v = parseFloat(el.value);
      if (isNaN(v)) return;
      bs[key] = v;
      if (onChange) onChange();
    };
    el.addEventListener('input',  handler);
    el.addEventListener('change', handler);
  }

  const rerender = () => renderer.render(scene, camera);

  bindRange ('s-music-vol', 's-music-vol-v', 'musicVolume', () => Music.setVolume(bs.musicVolume));
  bindRange ('s-flip-vol',  's-flip-vol-v',  'flipVolume');
  bindRange ('s-land-vol',  's-land-vol-v',  'landVolume');
  bindRange ('s-land-off',  's-land-off-v',  'landOffset');
  bindRange ('s-lag',       's-lag-v',     'LAG');
  bindNumber('s-flip',                     'flipDuration');
  bindNumber('s-attract-ms',               'attractMs',        () => { BOOK_CONFIG.attractTransitionMs = bs.attractMs; });
  bindRange ('s-ambient',   's-ambient-v', 'ambientIntensity', () => { ambient.intensity  = bs.ambientIntensity; rerender(); });
  bindRange ('s-key',       's-key-v',     'keyIntensity',     () => { keyLight.intensity = bs.keyIntensity;     rerender(); });
  bindRange ('s-exposure',  's-exposure-v','exposure',         () => { renderer.toneMappingExposure = bs.exposure; rerender(); });
  bindNumber('s-pw',                       'PAGE_W');
  bindNumber('s-ph',                       'PAGE_H');
  bindNumber('s-seg',                      'SEGMENTS');

  // ── Book origin helper (axes at book model's local 0,0,0) ────────────────────
  const bookAxes = new THREE.AxesHelper(0.5);
  bookAxes.visible = false;
  if (bookModel) bookModel.add(bookAxes);

  // ── Transform gizmo ───────────────────────────────────────────────────────────
  const gizmo = new THREE.TransformControls(camera, renderer.domElement);
  scene.add(gizmo);

  // When gizmo moves an object, sync bs + number inputs
  const d2r = Math.PI / 180;
  const r2d = 180 / Math.PI;

  function syncInput(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = +v.toFixed(3);
  }
  function syncBookInputs() {
    const o = bookModel;
    if (!o) return;
    bs.bookX = o.position.x; bs.bookY = o.position.y; bs.bookZ = o.position.z;
    bs.bookRotX = o.rotation.x * r2d; bs.bookRotY = o.rotation.y * r2d; bs.bookRotZ = o.rotation.z * r2d;
    bs.bookScaleX = o.scale.x; bs.bookScaleY = o.scale.y; bs.bookScaleZ = o.scale.z;
    syncInput('s-bx', bs.bookX); syncInput('s-by', bs.bookY); syncInput('s-bz', bs.bookZ);
    syncInput('s-brotx', bs.bookRotX); syncInput('s-broty', bs.bookRotY); syncInput('s-brotz', bs.bookRotZ);
    syncInput('s-bscalex', bs.bookScaleX); syncInput('s-bscaley', bs.bookScaleY); syncInput('s-bscalez', bs.bookScaleZ);
  }
  function syncTableInputs() {
    const o = tablePlane;
    if (!o) return;
    bs.tableX = o.position.x; bs.tableY = o.position.y; bs.tableZ = o.position.z;
    bs.tableRotX = o.rotation.x * r2d; bs.tableRotY = o.rotation.y * r2d; bs.tableRotZ = o.rotation.z * r2d;
    bs.tableScaleX = o.scale.x; bs.tableScaleY = o.scale.y;
    syncInput('s-tx', bs.tableX); syncInput('s-ty', bs.tableY); syncInput('s-tz', bs.tableZ);
    syncInput('s-trx', bs.tableRotX); syncInput('s-try', bs.tableRotY); syncInput('s-trz', bs.tableRotZ);
    syncInput('s-tsw', bs.tableScaleX); syncInput('s-tsh', bs.tableScaleY);
  }

  gizmo.addEventListener('change', () => {
    if (gizmo.object === bookModel)  syncBookInputs();
    if (gizmo.object === tablePlane) syncTableInputs();
    rerender();
  });

  // While gizmo is dragging, disable the camera-orbit overlay so events reach canvas
  gizmo.addEventListener('dragging-changed', e => {
    overlay.style.pointerEvents = e.value ? 'none' : (gizmo.object ? 'none' : '');
  });

  function attachGizmo(object) {
    gizmo.attach(object);
    overlay.style.pointerEvents = 'none'; // let events reach canvas for gizmo interaction
    rerender();
  }
  function detachGizmo() {
    gizmo.detach();
    overlay.style.pointerEvents = ''; // restore camera orbit
    rerender();
  }

  // Deselect button
  function setGizmoNone() {
    document.getElementById('g-none').classList.add('on');
    rerender();
  }
  document.getElementById('g-none').addEventListener('click', () => {
    detachGizmo();
    setGizmoNone();
    refreshSceneList();
  });

  // Mode buttons
  function setModeBtn(id) {
    ['g-translate', 'g-rotate', 'g-scale'].forEach(b => document.getElementById(b).classList.remove('on'));
    document.getElementById(id).classList.add('on');
  }
  gizmo.space = 'local';

  document.getElementById('g-translate').addEventListener('click', () => { gizmo.setMode('translate'); setModeBtn('g-translate'); });
  document.getElementById('g-rotate').addEventListener('click',    () => { gizmo.setMode('rotate');    setModeBtn('g-rotate'); });
  document.getElementById('g-scale').addEventListener('click',     () => { gizmo.setMode('scale');     setModeBtn('g-scale'); });

  const spaceBtn = document.getElementById('g-space');
  spaceBtn.addEventListener('click', () => {
    gizmo.space = gizmo.space === 'local' ? 'world' : 'local';
    spaceBtn.textContent = gizmo.space === 'local' ? 'Local' : 'World';
    spaceBtn.classList.toggle('on', gizmo.space === 'local');
    rerender();
  });

  // Shift = snap (0.1 units · 15° · 0.1 scale)
  window.addEventListener('keydown', e => {
    if (e.key !== 'Shift') return;
    gizmo.setTranslationSnap(0.1);
    gizmo.setRotationSnap(Math.PI / 12);
    gizmo.setScaleSnap(0.1);
  });
  window.addEventListener('keyup', e => {
    if (e.key !== 'Shift') return;
    gizmo.setTranslationSnap(null);
    gizmo.setRotationSnap(null);
    gizmo.setScaleSnap(null);
  });


  document.getElementById('s-rebuild').addEventListener('click', () => {
    buildPages();
    flash('s-rebuild', 'Built ✓');
  });

  document.getElementById('s-reset').addEventListener('click', () => {
    localStorage.removeItem('book-settings');
    flash('s-reset', 'Reset ✓');
  });

  function setLangBtns(on) {
    bs.showLangBtns = on;
    const el = document.getElementById('toggle-lang');
    if (el) { el.textContent = `Language switcher: ${on ? 'ON' : 'OFF'}`; el.classList.toggle('on', on); }
    const langBtns = document.getElementById('lang-btns');
    if (langBtns) langBtns.style.display = on ? '' : 'none';
  }
  setLangBtns(bs.showLangBtns);
  document.getElementById('toggle-lang').addEventListener('click', () => setLangBtns(!bs.showLangBtns));

  document.getElementById('save-all').addEventListener('click', () => {
    console.log('[dev] save-all clicked, bs:', bs);
    try {
      localStorage.setItem('book-settings', JSON.stringify(bs));
      saveSceneState();
      flash('save-all', 'Saved ✓');
    } catch(e) { console.error('[dev] save-all error:', e); }
  });

  document.getElementById('export-cfg').addEventListener('click', () => {
    console.log('[dev] export-cfg clicked');
    const keys = ['book-settings', 'book-scene', 'cam-work', 'cam-attract', 'book-lang'];
    const cfg = {};
    keys.forEach(k => {
      const raw = localStorage.getItem(k);
      if (raw !== null) cfg[k] = k === 'book-lang' ? raw : JSON.parse(raw);
    });
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'user-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash('export-cfg', 'Downloaded ✓');
  });

  function flash(id, label) {
    const btn = document.getElementById(id);
    const orig = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { btn.textContent = orig; }, 1200);
  }

  // ── Scene builder ─────────────────────────────────────────────────────────────
  const sceneListEl   = document.getElementById('sc-list');
  const sceneSelectEl = document.getElementById('sc-select');

  function makePermanentRow(label, mesh) {
    const row = document.createElement('div');
    row.className = 'sc-row';
    const isActive = gizmo.object === mesh;
    if (isActive) row.style.background = 'rgba(100,150,255,0.08)';

    const name = document.createElement('span');
    name.className = 'sc-name';
    name.textContent = label;
    name.style.color = '#f5e6c8';

    const selBtn = document.createElement('button');
    selBtn.textContent = isActive ? '✦ selected' : '✦ select';
    selBtn.title = 'Select with gizmo';
    selBtn.style.width = '56px';
    selBtn.style.minWidth = '56px';
    if (isActive) selBtn.classList.add('on');
    selBtn.onclick = () => {
      if (isActive) { detachGizmo(); setGizmoNone(); }
      else { attachGizmo(mesh); document.getElementById('g-none').classList.remove('on'); }
      refreshSceneList();
    };

    row.append(name, selBtn);
    return row;
  }

  function refreshSceneList() {
    sceneListEl.innerHTML = '';

    // Permanent objects — book and table always at top
    if (bookModel)  sceneListEl.appendChild(makePermanentRow('📖 Book',  bookModel));
    if (tablePlane) sceneListEl.appendChild(makePermanentRow('🪵 Table', tablePlane));

    if (sceneObjects.length > 0) {
      const sep = document.createElement('div');
      sep.style.cssText = 'border-top:1px solid #333;margin:6px 0 4px';
      sceneListEl.appendChild(sep);
    }

    sceneObjects.forEach(obj => {
      const label = obj.url.split('/').pop().replace(/\.(glb|gltf)$/i, '');
      const row = document.createElement('div');
      row.className = 'sc-row';
      const isActive = gizmo.object === obj.mesh;
      if (isActive) row.style.background = 'rgba(100,150,255,0.08)';

      const name = document.createElement('span');
      name.className = 'sc-name';
      name.textContent = label;

      const selBtn = document.createElement('button');
      selBtn.textContent = '✦';
      selBtn.title = 'Select with gizmo';
      if (isActive) selBtn.classList.add('on');
      selBtn.onclick = () => {
        attachGizmo(obj.mesh);
        document.getElementById('g-none').classList.remove('on');
        refreshSceneList();
      };

      const dupBtn = document.createElement('button');
      dupBtn.textContent = '⧉';
      dupBtn.title = 'Duplicate';
      dupBtn.onclick = async () => {
        const saved = {
          pos:   obj.mesh.position.toArray().map((v, i) => i === 0 ? v + 0.3 : v),
          rot:   [obj.mesh.rotation.x, obj.mesh.rotation.y, obj.mesh.rotation.z],
          scale: obj.mesh.scale.toArray(),
        };
        const newObj = await addSceneObject(obj.url, saved);
        if (newObj) { attachGizmo(newObj.mesh); document.getElementById('g-none').classList.remove('on'); refreshSceneList(); }
      };

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.title = 'Remove';
      delBtn.onclick = () => {
        if (gizmo.object === obj.mesh) { detachGizmo(); setGizmoNone(); }
        removeSceneObject(obj);
        refreshSceneList();
      };

      row.append(name, selBtn, dupBtn, delBtn);
      sceneListEl.appendChild(row);
    });
  }

  async function loadManifest() {
    // Primary: parse Python's auto-generated directory listing
    try {
      const res = await fetch('assets/models/');
      if (res.ok) {
        const html = await res.text();
        const hits = [...html.matchAll(/href="([^"/]+\.(glb|gltf))"/gi)];
        if (hits.length) return hits.map(m => m[1]);
      }
    } catch (_) {}
    // Fallback: manifest.json (useful with servers that don't list directories)
    try {
      const res = await fetch('assets/models/manifest.json');
      if (res.ok) return await res.json();
    } catch (_) {}
    return [];
  }

  (async () => {
    const manifest = await loadManifest();
    manifest.forEach(filename => {
      const opt = document.createElement('option');
      opt.value = `assets/models/${filename}`;
      opt.textContent = filename.replace(/\.(glb|gltf)$/i, '');
      sceneSelectEl.appendChild(opt);
    });
    refreshSceneList();
  })();

  document.getElementById('sc-add').addEventListener('click', async () => {
    const url = sceneSelectEl.value;
    if (!url) return;
    const btn = document.getElementById('sc-add');
    btn.textContent = '…';
    const obj = await addSceneObject(url);
    btn.textContent = 'Add';
    if (obj) {
      attachGizmo(obj.mesh);
      refreshSceneList();
    }
  });

  document.getElementById('sc-clear').addEventListener('click', () => {
    [...sceneObjects].forEach(o => {
      if (gizmo.object === o.mesh) detachGizmo();
      removeSceneObject(o);
    });
    refreshSceneList();
    saveSceneState();
    flash('sc-clear', 'Cleared ✓');
  });

  // ── Quality controls ──────────────────────────────────────────────────────────
  const fpsEl = document.getElementById('q-fps');

  function qApply() { applyQuality(); rerender(); }

  // Tone mapping
  const tmMap = { 'q-tm0': 0, 'q-tm1': 2, 'q-tm2': 3, 'q-tm3': 4 };
  function setToneMapping(id) {
    bs.toneMapping = tmMap[id];
    Object.keys(tmMap).forEach(k => document.getElementById(k).classList.toggle('on', k === id));
    qApply();
  }
  const initTmId = Object.entries(tmMap).reduce((best, [k, v]) =>
    Math.abs(v - bs.toneMapping) < Math.abs(tmMap[best] - bs.toneMapping) ? k : best, 'q-tm3');
  setToneMapping(initTmId);
  Object.keys(tmMap).forEach(k => document.getElementById(k).addEventListener('click', () => setToneMapping(k)));

  // Shadow quality
  const shMap = { 'q-sh0': 0, 'q-sh1': 512, 'q-sh2': 1024, 'q-sh3': 2048 };
  function setShadowQuality(id) {
    bs.shadowMapSize = shMap[id];
    Object.keys(shMap).forEach(k => document.getElementById(k).classList.toggle('on', k === id));
    qApply();
  }
  const initShId = Object.entries(shMap).reduce((best, [k, v]) =>
    Math.abs(v - bs.shadowMapSize) < Math.abs(shMap[best] - bs.shadowMapSize) ? k : best, 'q-sh0');
  setShadowQuality(initShId);
  Object.keys(shMap).forEach(k => document.getElementById(k).addEventListener('click', () => setShadowQuality(k)));

  // Resolution
  const resMap = { 'q-r0': 0.75, 'q-r1': 1, 'q-r2': 1.5 };
  function setResolution(id) {
    bs.resolution = resMap[id];
    Object.keys(resMap).forEach(k => document.getElementById(k).classList.toggle('on', k === id));
    qApply();
  }
  const initResId = Object.entries(resMap).reduce((best, [k, v]) =>
    Math.abs(v - bs.resolution) < Math.abs(resMap[best] - bs.resolution) ? k : best, 'q-r2');
  setResolution(initResId);
  Object.keys(resMap).forEach(k => document.getElementById(k).addEventListener('click', () => setResolution(k)));

  // Fog
  function setFog(on) {
    bs.fog = on;
    document.getElementById('q-fog').classList.toggle('on', on);
    document.getElementById('q-fog').textContent = `Fog: ${on ? 'ON' : 'OFF'}`;
    qApply();
  }
  setFog(bs.fog);
  document.getElementById('q-fog').addEventListener('click', () => setFog(!bs.fog));
  bindRange('q-fog-den', 'q-fog-den-v', 'fogDensity', qApply);

  // Saturation + contrast
  bindRange('q-sat', 'q-sat-v', 'saturation', qApply);
  bindRange('q-con', 'q-con-v', 'contrast',   qApply);

  // Vignette canvas overlay
  const vigCanvas = document.createElement('canvas');
  vigCanvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:4;display:none;';
  document.body.appendChild(vigCanvas);

  function drawVignette() {
    const w = vigCanvas.width  = window.innerWidth;
    const h = vigCanvas.height = window.innerHeight;
    const ctx = vigCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.sqrt(w*w + h*h) * 0.55);
    grad.addColorStop(0.4, 'rgba(0,0,0,0)');
    grad.addColorStop(1,   `rgba(0,0,0,${bs.vignetteStr})`);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    vigCanvas.style.display = 'block';
  }

  function setVignette(on) {
    bs.vignette = on;
    document.getElementById('q-vignette').classList.toggle('on', on);
    document.getElementById('q-vignette').textContent = `Vignette: ${on ? 'ON' : 'OFF'}`;
    if (on) drawVignette(); else vigCanvas.style.display = 'none';
  }
  setVignette(bs.vignette);
  document.getElementById('q-vignette').addEventListener('click', () => setVignette(!bs.vignette));
  bindRange('q-vig-str', 'q-vig-str-v', 'vignetteStr', () => { if (bs.vignette) drawVignette(); });

  // Film grain canvas overlay
  const grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:5;display:none;';
  document.body.appendChild(grainCanvas);
  const grainCtx = grainCanvas.getContext('2d');
  let grainImg = null, grainRaf = null;

  function tickGrain() {
    if (!bs.filmGrain) { grainCanvas.style.display = 'none'; grainRaf = null; return; }
    const w = window.innerWidth  >> 1;
    const h = window.innerHeight >> 1;
    if (!grainImg || grainCanvas.width !== w || grainCanvas.height !== h) {
      grainCanvas.width = w; grainCanvas.height = h;
      grainImg = grainCtx.createImageData(w, h);
    }
    const d = grainImg.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255; }
    grainCtx.putImageData(grainImg, 0, 0);
    grainCanvas.style.opacity = bs.grainStrength;
    grainCanvas.style.display = 'block';
    grainRaf = requestAnimationFrame(tickGrain);
  }

  function setGrain(on) {
    bs.filmGrain = on;
    document.getElementById('q-grain').classList.toggle('on', on);
    document.getElementById('q-grain').textContent = `Film grain: ${on ? 'ON' : 'OFF'}`;
    if (on && !grainRaf) tickGrain(); else if (!on) grainCanvas.style.display = 'none';
  }
  setGrain(bs.filmGrain);
  document.getElementById('q-grain').addEventListener('click', () => setGrain(!bs.filmGrain));
  bindRange('q-grain-str', 'q-grain-str-v', 'grainStrength', () => { grainCanvas.style.opacity = bs.grainStrength; });

  // Bloom — canvas copy at half-res, blurred + brightened, screen-blended on top
  const bloomCanvas = document.createElement('canvas');
  bloomCanvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:6;mix-blend-mode:screen;display:none;';
  document.body.appendChild(bloomCanvas);
  const bloomCtx = bloomCanvas.getContext('2d');
  let bloomRaf = null;

  function tickBloom() {
    if (!bs.bloom) { bloomCanvas.style.display = 'none'; bloomRaf = null; return; }
    const w = window.innerWidth  >> 1;
    const h = window.innerHeight >> 1;
    if (bloomCanvas.width !== w || bloomCanvas.height !== h) {
      bloomCanvas.width = w; bloomCanvas.height = h;
    }
    bloomCtx.clearRect(0, 0, w, h);
    bloomCtx.filter = `blur(${bs.bloomRadius}px) brightness(${bs.bloomStrength})`;
    bloomCtx.drawImage(renderer.domElement, 0, 0, w, h);
    bloomCanvas.style.display = 'block';
    bloomRaf = requestAnimationFrame(tickBloom);
  }

  function setBloom(on) {
    bs.bloom = on;
    document.getElementById('q-bloom').classList.toggle('on', on);
    document.getElementById('q-bloom').textContent = `Bloom: ${on ? 'ON' : 'OFF'}`;
    if (on && !bloomRaf) tickBloom();
    else if (!on) bloomCanvas.style.display = 'none';
  }
  setBloom(bs.bloom);
  document.getElementById('q-bloom').addEventListener('click', () => setBloom(!bs.bloom));
  bindRange('q-bloom-rad', 'q-bloom-rad-v', 'bloomRadius');
  bindRange('q-bloom-str', 'q-bloom-str-v', 'bloomStrength');

  // Edge blur
  const edgeBlurEl = document.getElementById('edge-blur');
  function applyEdgeBlur() {
    edgeBlurEl.style.backdropFilter         = `blur(${bs.edgeBlurStr}px)`;
    edgeBlurEl.style.webkitBackdropFilter   = `blur(${bs.edgeBlurStr}px)`;
  }
  function setEdgeBlur(on) {
    bs.edgeBlur = on;
    document.getElementById('q-eblur').classList.toggle('on', on);
    document.getElementById('q-eblur').textContent = `Edge blur: ${on ? 'ON' : 'OFF'}`;
    edgeBlurEl.style.display = on ? 'block' : 'none';
    if (on) applyEdgeBlur();
  }
  setEdgeBlur(bs.edgeBlur);
  document.getElementById('q-eblur').addEventListener('click', () => setEdgeBlur(!bs.edgeBlur));
  bindRange('q-eblur-str', 'q-eblur-str-v', 'edgeBlurStr', () => { if (bs.edgeBlur) applyEdgeBlur(); });

  // FPS counter — only runs while dev panel is open
  let fpsCount = 0, fpsLast = 0, fpsRafId = null;
  function fpsLoop(now) {
    fpsCount++;
    if (now - fpsLast >= 1000) { fpsEl.textContent = `FPS: ${fpsCount}`; fpsCount = 0; fpsLast = now; }
    fpsRafId = requestAnimationFrame(fpsLoop);
  }

  // ── Toggle ────────────────────────────────────────────────────────────────────
  const safeArea = document.getElementById('safe-area');

  const hitLeft  = document.getElementById('hit-left');
  const hitRight = document.getElementById('hit-right');

  function openDev() {
    window._devMode = true;
    panel.classList.add('open');
    overlay.classList.add('active');
    safeArea.classList.add('active');
    bookAxes.visible = true;
    hitLeft.style.pointerEvents  = 'none';
    hitRight.style.pointerEvents = 'none';
    refreshSceneList();
    initSphere();
    refreshDisplay();
    rerender();
    fpsCount = 0; fpsLast = performance.now();
    fpsRafId = requestAnimationFrame(fpsLoop);
  }

  function closeDev() {
    window._devMode = false;
    panel.classList.remove('open');
    overlay.classList.remove('active');
    safeArea.classList.remove('active');
    bookAxes.visible = false;
    hitLeft.style.pointerEvents  = '';
    hitRight.style.pointerEvents = '';
    detachGizmo();
    setGizmoNone();
    rerender();
    if (fpsRafId) { cancelAnimationFrame(fpsRafId); fpsRafId = null; }
    fpsEl.textContent = 'FPS: —';
  }

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'd' || e.key === 'D') {
      window._devMode ? closeDev() : openDev();
    }
  });

  // ── Navigation mode ───────────────────────────────────────────────────────────
  function setNavMode(mode) {
    bs.navMode = mode;
    document.getElementById('nav-mode-arrows').classList.toggle('on', mode === 'arrows');
    document.getElementById('nav-mode-pages').classList.toggle('on', mode === 'pages');
    applyNavMode();
  }
  setNavMode(bs.navMode || 'arrows');
  document.getElementById('nav-mode-arrows').addEventListener('click', () => setNavMode('arrows'));
  document.getElementById('nav-mode-pages').addEventListener('click', () => setNavMode('pages'));
});
