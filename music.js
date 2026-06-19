// music.js — background music with crossfade
const Music = (() => {
  const FADE_S = 3;
  let tracks = [], idx = 0, volume = 0.4;
  let ctx = null, masterGain = null;
  let chA = null, chB = null, current = null, crossfading = false;

  function makeChannel() {
    const el = new window.Audio();
    const node = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    node.connect(gain);
    gain.connect(masterGain);
    gain.gain.value = 0;
    el.addEventListener('timeupdate', onTimeUpdate);
    return { el, gain };
  }

  function ramp(gain, from, to, dur) {
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(from, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(to, ctx.currentTime + dur);
  }

  function onTimeUpdate(e) {
    if (crossfading || e.target !== current.el) return;
    const el = current.el;
    if (!el.duration || el.duration - el.currentTime > FADE_S + 0.3) return;
    crossfading = true;

    idx = (idx + 1) % tracks.length;
    const next = current === chA ? chB : chA;
    next.el.src = tracks[idx];
    next.el.play().catch(() => {});
    ramp(current.gain, 1, 0, FADE_S);
    ramp(next.gain,    0, 1, FADE_S);

    const prev = current;
    current = next;
    setTimeout(() => {
      prev.el.pause();
      prev.el.src = '';
      prev.gain.gain.cancelScheduledValues(ctx.currentTime);
      prev.gain.gain.setValueAtTime(0, ctx.currentTime);
      crossfading = false;
    }, (FADE_S + 0.2) * 1000);
  }

  async function discoverTracks() {
    try {
      const res = await fetch('assets/music/');
      if (res.ok) {
        const html = await res.text();
        const hits = [...html.matchAll(/href="([^"/]+\.(mp3|wav))"/gi)];
        if (hits.length) return hits.map(m => `assets/music/${m[1]}`);
      }
    } catch (_) {}
    // Fallback: manifest.json (for servers that don't list directories)
    try {
      const res = await fetch('assets/music/manifest.json');
      if (res.ok) {
        const list = await res.json();
        return list.map(f => `assets/music/${f}`);
      }
    } catch (_) {}
    return [];
  }

  // Fires on every user gesture until music is actually playing
  function onGesture() {
    if (!ctx || !current || !current.el.src) return;
    ctx.resume().then(() => {
      if (current.el.paused) {
        current.el.play()
          .then(() => ramp(current.gain, 0, 1, FADE_S))
          .catch(() => {});
      }
    });
  }
  ['pointerdown', 'touchstart', 'click'].forEach(ev =>
    document.addEventListener(ev, onGesture, { passive: true })
  );

  async function start(vol) {
    tracks = await discoverTracks();
    if (!tracks.length) { console.warn('Music: no tracks found in assets/music/'); return; }

    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    volume = vol;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);

    chA = makeChannel();
    chB = makeChannel();
    current = chA;
    current.el.src = tracks[0];

    // Try immediately (works in kiosk / if user already interacted)
    ctx.resume().then(() => {
      current.el.play()
        .then(() => ramp(current.gain, 0, 1, FADE_S))
        .catch(() => {}); // onGesture will retry on next interaction
    });
  }

  function setVolume(v) {
    volume = v;
    if (masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(v, ctx.currentTime);
    }
  }

  return { start, setVolume };
})();

document.addEventListener('book-ready', ({ detail: { bs } }) => {
  Music.start(bs.musicVolume !== undefined ? bs.musicVolume : 0.4);
});
