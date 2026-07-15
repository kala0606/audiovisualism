// config.js — central state for the audiovisualism webkit.
//
// This single object IS the per-artist preset: everything the console edits
// lives here, and this is what a private link will eventually load/save.

const VJ = {
  // A "mode" is just a policy over two independent switches:
  //   motionSource  — what drives the motion
  //   sceneChange   — what triggers a scene cut
  mode: 'auto',            // 'auto' | 'semi' | 'manual'
  motionSource: 'fake',    // 'fake' | 'audio'
  sceneChange: 'timed',    // 'timed' | 'manual' | 'audio'
  sceneChangeEvery: 6.0,   // seconds, used when sceneChange === 'timed'

  tempo: 10,               // 1-20: fake-beat tempo & overall motion intensity
  sensitivity: 1.0,        // gain applied to live audio input
  autoRotate: false,       // periodic global rotation toggling

  activeScene: 0,          // index into Scenes.list (kept in sync by the manager)

  // Palette: ordered colour stops the artwork lerps between. Editable in the
  // console. Defaults to the current royal/red house palette.
  palette: [
    [255, 0, 0],
    [139, 0, 0],
    [220, 20, 60],
    [178, 34, 34],
    [64, 64, 64],
    [0, 0, 0],
  ],
};

// Named modes = presets over (motionSource, sceneChange). The console can still
// tweak sceneChange independently afterwards (e.g. semi-auto with manual cuts).
const VJ_MODE_PRESETS = {
  auto:   { motionSource: 'fake',  sceneChange: 'timed'  }, // Fully Automatic
  semi:   { motionSource: 'audio', sceneChange: 'timed'  }, // Semi-Automatic
  manual: { motionSource: 'audio', sceneChange: 'manual' }, // Manual
};

function applyMode(mode) {
  const preset = VJ_MODE_PRESETS[mode] || VJ_MODE_PRESETS.auto;
  VJ.mode = mode;
  VJ.motionSource = preset.motionSource;
  VJ.sceneChange = preset.sceneChange;
}

// Serialise / restore the preset (foundation for private-link presets later).
function exportPreset() {
  return JSON.stringify(VJ);
}
function importPreset(json) {
  try {
    Object.assign(VJ, JSON.parse(json));
  } catch (e) {
    console.error('Bad preset:', e);
  }
}
