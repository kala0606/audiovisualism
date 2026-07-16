// console.js — minimal UI: an Auto (self-animate) on/off toggle, and starting
// the mic on the first interaction so manual mode can react to music.
(function () {
  const btn = document.getElementById('autoToggle');

  function sync() {
    btn.textContent = 'AUTO · ' + (VJ.auto ? 'ON' : 'OFF');
    btn.classList.toggle('on', VJ.auto);
  }

  function toggle() { VJ.auto = !VJ.auto; sync(); }

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'a' || e.key === 'A') toggle();
  });

  // First user gesture: start the mic so manual mode hears the music. (Auto
  // mode ignores it and self-animates regardless.)
  let micTried = false;
  window.addEventListener('pointerdown', () => {
    if (micTried) return;
    micTried = true;
    if (typeof Input !== 'undefined') Input.startMic(() => {}, () => {});
  });

  sync();
})();
