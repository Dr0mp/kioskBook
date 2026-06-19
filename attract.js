// attract.js — inactivity timer, attract camera, start-screen overlay
document.addEventListener('book-ready', ({ detail: { camera, renderer, scene, camState } }) => {

  const overlay  = document.getElementById('start-screen');
  let attractActive = false;
  let animating     = false;

  // ── Saved positions (localStorage overrides config) ──────────────────────────
  function loadPos(key) {
    try {
      const v = localStorage.getItem('cam-' + key);
      if (v) return JSON.parse(v);
    } catch (_) {}
    return BOOK_CONFIG.cameras[key];
  }

  // ── Camera animation ──────────────────────────────────────────────────────────
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  function animateCam(toPos, toLook, toFov, onDone) {
    if (animating) return;
    animating = true;
    const fromPos  = camera.position.clone();
    const fromLook = camState.look.clone();
    const fromFov  = camera.fov;
    const toPosV   = new THREE.Vector3(toPos.x,  toPos.y,  toPos.z);
    const toLookV  = new THREE.Vector3(toLook.x, toLook.y, toLook.z);
    const dur      = BOOK_CONFIG.attractTransitionMs;
    const start    = performance.now();

    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const e = easeInOut(t);
      camera.position.lerpVectors(fromPos, toPosV, e);
      camState.look.lerpVectors(fromLook, toLookV, e);
      camera.fov = fromFov + (toFov - fromFov) * e;
      camera.updateProjectionMatrix();
      camera.lookAt(camState.look);
      renderer.render(scene, camera);
      if (t < 1) requestAnimationFrame(step);
      else { animating = false; if (onDone) onDone(); }
    }
    requestAnimationFrame(step);
  }

  // ── Attract enter / exit ──────────────────────────────────────────────────────
  function enterAttract(force = false, snap = false) {
    if (attractActive || (window._devMode && !force)) return;
    attractActive = true;
    overlay.classList.add('visible');
    const ap = loadPos('attract');
    if (snap) {
      camera.position.set(ap.x, ap.y, ap.z);
      camState.look.set(ap.lx, ap.ly, ap.lz);
      camera.fov = ap.fov || 45;
      camera.updateProjectionMatrix();
      camera.lookAt(camState.look);
      renderer.render(scene, camera);
    } else {
      animateCam({ x: ap.x, y: ap.y, z: ap.z }, { x: ap.lx, y: ap.ly, z: ap.lz }, ap.fov || 45);
    }
  }

  function exitAttract() {
    if (!attractActive) return;
    attractActive = false;
    overlay.classList.remove('visible');
    const wp = loadPos('work');
    animateCam(
      { x: wp.x, y: wp.y, z: wp.z },
      { x: wp.lx, y: wp.ly, z: wp.lz },
      wp.fov || 45,
      () => {
        camera.position.set(wp.x, wp.y, wp.z);
        camState.look.set(wp.lx, wp.ly, wp.lz);
        camera.fov = wp.fov || 45;
        camera.updateProjectionMatrix();
        camera.lookAt(camState.look);
        renderer.render(scene, camera);
      }
    );
  }

  overlay.addEventListener('click',    exitAttract);
  overlay.addEventListener('touchend', e => { e.preventDefault(); exitAttract(); });

  // ── Inactivity timer ──────────────────────────────────────────────────────────
  // Use ?timeout=5000 in the URL to shorten the delay for testing
  const params  = new URLSearchParams(location.search);
  const timeout = parseInt(params.get('timeout')) || BOOK_CONFIG.inactivityMs;
  let timer = null;

  function resetTimer() {
    if (attractActive) return;
    clearTimeout(timer);
    timer = setTimeout(enterAttract, timeout);
  }

  ['click', 'touchstart', 'mousemove', 'keydown'].forEach(ev =>
    document.addEventListener(ev, resetTimer, { passive: true })
  );

  enterAttract(false, true);

  // Expose so dev.js can trigger a test
  window._attract = { enter: () => enterAttract(true), exit: exitAttract, active: () => attractActive };
});
