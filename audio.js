// audio.js — Web Audio API, no library
const Audio = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buffers = {};

  async function load(name, url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const raw = await res.arrayBuffer();
      buffers[name] = await ctx.decodeAudioData(raw);
    } catch (e) {
      // file missing or decode error — silently skip
    }
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
