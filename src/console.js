// console.js — binds the left console UI to the VJ config, Input and Scenes.
// Pure view layer: it only reads/writes VJ and calls Input/Scenes methods.

(function () {
  const $ = (id) => document.getElementById(id);

  const el = {
    modeSeg: $('modeSeg'),
    modeHint: $('modeHint'),
    prevScene: $('prevScene'),
    nextScene: $('nextScene'),
    sceneName: $('sceneName'),
    sceneIdx: $('sceneIdx'),
    sceneChange: $('sceneChange'),
    everyRow: $('everyRow'),
    everyRange: $('everyRange'),
    everyVal: $('everyVal'),
    tempoRange: $('tempoRange'),
    tempoVal: $('tempoVal'),
    sensRange: $('sensRange'),
    sensVal: $('sensVal'),
    rotChk: $('rotChk'),
    startBtn: $('startBtn'),
    inputSelect: $('inputSelect'),
    meterFill: $('meterFill'),
    micLed: $('micLed'),
    micStatus: $('micStatus'),
    console: $('console'),
    toggleConsole: $('toggleConsole'),
  };

  const MODE_HINTS = {
    auto: 'Fully automatic — synthesised motion, timed cuts.',
    semi: 'Audio-reactive motion — cuts timed or manual.',
    manual: 'Audio-reactive motion — you cut the scenes.',
  };

  // ── Mode ────────────────────────────────────────────────────────────────
  el.modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    const mode = btn.dataset.mode;
    applyMode(mode);
    [...el.modeSeg.children].forEach((b) => b.classList.toggle('active', b === btn));
    el.modeHint.textContent = MODE_HINTS[mode];
    syncSceneChange();
  });

  // ── Scene nav ───────────────────────────────────────────────────────────
  el.prevScene.addEventListener('click', () => { Scenes.prev(); refreshScene(); });
  el.nextScene.addEventListener('click', () => { Scenes.next(); refreshScene(); });

  el.sceneChange.addEventListener('change', function () {
    VJ.sceneChange = this.value;
    el.everyRow.style.display = this.value === 'timed' ? '' : 'none';
  });

  el.everyRange.addEventListener('input', function () {
    VJ.sceneChangeEvery = parseFloat(this.value);
    el.everyVal.textContent = VJ.sceneChangeEvery.toFixed(1);
  });

  // ── Motion ──────────────────────────────────────────────────────────────
  el.tempoRange.addEventListener('input', function () {
    VJ.tempo = parseInt(this.value, 10);
    el.tempoVal.textContent = VJ.tempo;
  });
  el.sensRange.addEventListener('input', function () {
    VJ.sensitivity = parseFloat(this.value);
    el.sensVal.textContent = VJ.sensitivity.toFixed(1);
  });
  el.rotChk.addEventListener('change', function () {
    VJ.autoRotate = this.checked;
    if (!this.checked) rotCray = false;
  });

  // ── Audio ───────────────────────────────────────────────────────────────
  el.startBtn.addEventListener('click', async () => {
    try {
      if (typeof getAudioContext === 'function') await getAudioContext().resume();
      Input.startMic(
        () => {
          setMic('on', 'Mic live');
          el.startBtn.textContent = 'Audio live';
          el.startBtn.disabled = true;
          populateSources();
        },
        () => setMic('err', 'Mic failed')
      );
    } catch (err) {
      console.error(err);
      setMic('err', 'Mic error');
    }
  });

  el.inputSelect.addEventListener('change', async function () {
    const index = parseInt(this.value, 10);
    if (isNaN(index)) return;
    if (typeof getAudioContext === 'function') await getAudioContext().resume();
    Input.setSource(index, () => setMic('on', 'Mic live'), () => setMic('err', 'Switch failed'));
  });

  async function populateSources() {
    try {
      const sources = await Input.getSources();
      const cur = (Input.mic && typeof Input.mic.currentSource === 'number') ? Input.mic.currentSource : 0;
      el.inputSelect.innerHTML = '';
      sources.forEach((d, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = d.label || 'Input ' + (i + 1);
        if (i === cur) o.selected = true;
        el.inputSelect.appendChild(o);
      });
      el.inputSelect.disabled = sources.length === 0;
    } catch (err) {
      console.error('list inputs:', err);
    }
  }

  function setMic(state, label) {
    el.micLed.className = 'led' + (state === 'on' ? ' on' : state === 'err' ? ' err' : '');
    el.micStatus.textContent = label;
  }

  // ── Console show/hide ─────────────────────────────────────────────────────
  el.toggleConsole.addEventListener('click', () => el.console.classList.toggle('open'));

  // ── Sync helpers ──────────────────────────────────────────────────────────
  function syncSceneChange() {
    el.sceneChange.value = VJ.sceneChange;
    el.everyRow.style.display = VJ.sceneChange === 'timed' ? '' : 'none';
  }

  function refreshScene() {
    const s = Scenes.current();
    if (s) {
      el.sceneName.textContent = s.name;
      el.sceneIdx.textContent = (Scenes.index + 1) + ' / ' + Scenes.list.length;
    }
  }

  // Called by the engine once p5 setup() has run.
  window.onEngineReady = function () {
    el.tempoRange.value = VJ.tempo; el.tempoVal.textContent = VJ.tempo;
    el.sensRange.value = VJ.sensitivity; el.sensVal.textContent = VJ.sensitivity.toFixed(1);
    el.everyRange.value = VJ.sceneChangeEvery; el.everyVal.textContent = VJ.sceneChangeEvery.toFixed(1);
    el.rotChk.checked = VJ.autoRotate;
    [...el.modeSeg.children].forEach((b) => b.classList.toggle('active', b.dataset.mode === VJ.mode));
    el.modeHint.textContent = MODE_HINTS[VJ.mode];
    syncSceneChange();
    refreshScene();

    // Live meter + scene-name sync (scenes can auto-cut on their own).
    let lastIdx = -1;
    (function loop() {
      const lvl = (typeof filteredSignal !== 'undefined' && filteredSignal[3]) || 0;
      el.meterFill.style.width = Math.min(100, lvl * 2) + '%';
      if (Scenes.index !== lastIdx) { lastIdx = Scenes.index; refreshScene(); }
      requestAnimationFrame(loop);
    })();
  };
})();
