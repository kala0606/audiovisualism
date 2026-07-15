// scenes.kolam.js — scenes built from generative Kolam patterns.
//
// Uses the Kolam engine for form, but renders in the house 3D world: strokes
// scaled by DIM, rotated by avx, pulsed by ds, coloured from the palette and
// audio-reactive in weight. Kolam scenes clear each frame (clearEveryFrame) so
// the woven geometry stays crisp — the boids/grid/sine scenes keep the trails.
//
// Both scenes are INFINITE GENERATIVE: draw-in → hold → regenerate a fresh
// pattern of the same family, forever. A ?family=... URL param (VJ.lockKolamFamily)
// pins a link to a single family so one deployment can serve per-artist links.

function registerKolamScenes() {
  // Generation params tuned per family (denser weave for Labyrinth).
  const GEN = {
    Mandala:    { sub: 0.7,  spa: 1.6 },
    Sikku:      { sub: 0.75, spa: 1.6 },
    Minimalist: { sub: 0.6,  spa: 1.4 },
    Labyrinth:  { sub: 0.95, spa: 2.4 },
  };

  function genInto(ctx, family) {
    ctx.family = family;
    const g = GEN[family] || { sub: 0.7, spa: 1.6 };
    Kolam.generate(family, g.sub, g.spa);
    ctx.strokes = Kolam.strokes.slice();
    ctx.baseSpin = random(TWO_PI);
    ctx.startFrame = frameCount;
  }

  // Shared renderer: infinite generative — draws in, holds, regenerates forever.
  function drawKolam(ctx) {
    const revealFrames = Math.max(45, 220 - VJ.tempo * 8);
    const holdFrames = 80;
    // Endless stream: once drawn-in and held, generate a fresh pattern.
    if (frameCount - ctx.startFrame > revealFrames + holdFrames) {
      genInto(ctx, ctx.family);
    }

    const strokes = ctx.strokes;
    const n = strokes.length;
    const energy = filteredSignal[3];

    // Progressive "drawing" reveal, then holds at full — independent of count.
    const t = (frameCount - ctx.startFrame) / revealFrames;
    const drawn = Math.min(n, Math.max(1, Math.floor(t * n)));

    // Keep the segment budget sane: fewer depth layers for dense patterns.
    const layers = n > 500 ? 2 : 3;
    for (let L = layers - 1; L >= 0; L--) {
      push();
      const depthT = L / layers;
      const S = DIM * (0.74 + ds * 0.10) * (1 - depthT * 0.16);
      translate(0, 0, -L * 130 * M);
      rotateZ(ctx.baseSpin + avx * (0.02 + L * 0.004));
      rotateX(sin(avx * 0.015) * 0.18);

      noFill();
      strokeCap(ROUND);
      strokeJoin(ROUND);
      const w = Math.max(0.6, (1.5 + energy * 0.05) * (1 - depthT * 0.4));
      strokeWeight(w);

      for (let i = 0; i < drawn; i++) {
        const s = strokes[i];
        const col = clr1A[(i * 3 + frameCount + L * 40) % clr1Num] || color(255);
        stroke(red(col), green(col), blue(col), 255 * (1 - depthT * 0.5));
        if (s.type === 'bezier') {
          bezier(s.x1 * S, s.y1 * S, s.cx1 * S, s.cy1 * S, s.cx2 * S, s.cy2 * S, s.x2 * S, s.y2 * S);
        } else {
          line(s.x1 * S, s.y1 * S, s.x2 * S, s.y2 * S);
        }
      }
      pop();
    }
  }

  // "Kolam": symmetric mandala family (or the locked family from ?family=).
  Scenes.register({
    name: 'Kolam',
    clearEveryFrame: true,
    enter() {
      genInto(this, VJ.lockKolamFamily || 'Mandala');
    },
    draw() { drawKolam(this); },
  });

  // "Kolam Weave": denser labyrinth field (or the locked family).
  Scenes.register({
    name: 'Kolam Weave',
    clearEveryFrame: true,
    enter() {
      genInto(this, VJ.lockKolamFamily || 'Labyrinth');
    },
    draw() { drawKolam(this); },
  });
}
