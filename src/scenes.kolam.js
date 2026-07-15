// scenes.kolam.js — scenes built from generative Kolam patterns.
//
// Uses the Kolam engine for form, but renders in the house 3D world: strokes
// scaled by DIM, rotated by avx, pulsed by ds, coloured from the palette and
// audio-reactive in weight. Kolam scenes clear each frame (clearEveryFrame) so
// the woven geometry stays crisp — the boids/grid/sine scenes keep the trails.

function registerKolamScenes() {
  const FAMILIES = ['Mandala', 'Sikku', 'Minimalist', 'Labyrinth'];

  // Shared renderer: draws the current Kolam.strokes as a layered 3D mandala.
  function drawKolam(ctx) {
    const strokes = ctx.strokes;
    const n = strokes.length;
    const energy = filteredSignal[3];

    // Progressive "drawing" reveal over a fixed window (~2.4s at tempo 10,
    // faster at higher tempo), then holds at full — independent of stroke count.
    const revealFrames = Math.max(45, 220 - VJ.tempo * 8);
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

  Scenes.register({
    name: 'Kolam',
    clearEveryFrame: true,
    enter() {
      this.fam = FAMILIES[Math.floor(random(3))]; // Mandala/Sikku/Minimalist (symmetric)
      Kolam.generate(this.fam, 0.7, 1.6);
      this.strokes = Kolam.strokes.slice();
      this.baseSpin = random(TWO_PI);
      this.startFrame = frameCount;
    },
    draw() { drawKolam(this); },
  });

  Scenes.register({
    name: 'Kolam Weave',
    clearEveryFrame: true,
    enter() {
      // Denser, deeper labyrinth weave for a busier, hypnotic field.
      Kolam.generate('Labyrinth', 0.95, 2.4);
      this.strokes = Kolam.strokes.slice();
      this.baseSpin = random(TWO_PI);
      this.startFrame = frameCount;
    },
    draw() { drawKolam(this); },
  });
}
