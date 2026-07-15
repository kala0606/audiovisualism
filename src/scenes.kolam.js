// scenes.kolam.js — one scene per Kolam family, each with its own colour scheme.
//
// Design: compose a full-frame kolam (resolution-independent, unit-square strokes
// scaled to fill), draw it flat facing the camera — NO geometry rotation. The
// only motion is a slow camera oscillation along Z plus a cast drop-shadow for
// depth. Infinite generative: draw-in -> hold -> regenerate a fresh pattern.

function registerKolamScenes() {
  // Each family: generation params + its single baked colour scheme (light -> dark).
  const FAMILIES = [
    {
      name: 'Mandala', family: 'Mandala', sub: 0.55, spa: 1.5,
      palette: [[255, 96, 110], [206, 32, 58], [104, 16, 30], [12, 4, 6]], // crimson/rose
    },
    {
      name: 'Sikku', family: 'Sikku', sub: 0.6, spa: 1.5,
      palette: [[255, 196, 92], [214, 120, 38], [110, 44, 18], [10, 6, 3]], // gold/amber
    },
    {
      name: 'Labyrinth', family: 'Labyrinth', sub: 0.7, spa: 2.0,
      palette: [[124, 232, 224], [36, 150, 176], [16, 54, 86], [4, 8, 16]], // cyan/teal
    },
    {
      name: 'Minimalist', family: 'Minimalist', sub: 0.5, spa: 1.3,
      palette: [[238, 238, 232], [150, 150, 148], [60, 60, 60], [8, 8, 8]], // mono
    },
  ];

  const COL_N = 160;

  // Build a smooth colour lookup table from a palette (light -> dark stops).
  function buildColTable(pal) {
    const len = pal.length, blk = Math.floor(COL_N / len), tbl = [];
    let cnt = -1;
    for (let i = 0; i < COL_N; i++) {
      if (i % blk === 0) cnt = (cnt + 1) % len;
      const c1 = color(pal[cnt][0], pal[cnt][1], pal[cnt][2]);
      const nx = (cnt + 1) % len;
      const c2 = color(pal[nx][0], pal[nx][1], pal[nx][2]);
      tbl[i] = lerpColor(c1, c2, map(i, cnt * blk, (cnt + 1) * blk, 0, 1));
    }
    return tbl;
  }

  function genInto(ctx) {
    Kolam.generate(ctx.family, ctx.sub, ctx.spa);
    ctx.strokes = Kolam.strokes.slice();
    ctx.startFrame = frameCount;
  }

  // Draw the revealed strokes once, at scale S. mode 'shadow' draws a dark,
  // offset, slightly-back copy for the cast-shadow depth cue.
  function drawStrokes(ctx, drawn, S, weight, mode) {
    push();
    if (mode === 'shadow') translate(11 * M, 13 * M, -32 * M);
    noFill();
    strokeCap(ROUND);
    strokeJoin(ROUND);
    strokeWeight(mode === 'shadow' ? weight * 1.5 : weight);
    const tbl = ctx.colTable, tn = tbl.length;
    for (let i = 0; i < drawn; i++) {
      const s = ctx.strokes[i];
      if (mode === 'shadow') stroke(0, 0, 0, 130);
      else stroke(tbl[(i * 3) % tn] || color(255));
      if (s.type === 'bezier') {
        bezier(s.x1 * S, s.y1 * S, s.cx1 * S, s.cy1 * S, s.cx2 * S, s.cy2 * S, s.x2 * S, s.y2 * S);
      } else {
        line(s.x1 * S, s.y1 * S, s.x2 * S, s.y2 * S);
      }
    }
    pop();
  }

  function drawKolam(ctx) {
    const revealFrames = Math.max(50, 200 - VJ.tempo * 6);
    const holdFrames = 260; // let each composed kolam breathe a while
    if (frameCount - ctx.startFrame > revealFrames + holdFrames) genInto(ctx);

    const n = ctx.strokes.length;
    const energy = filteredSignal[3];
    const t = (frameCount - ctx.startFrame) / revealFrames;
    const drawn = Math.min(n, Math.max(1, Math.floor(t * n)));

    // Full-frame composition scale (unit square -> ~92% of the short side).
    const S = DIM * 0.92;
    // Slow camera oscillation along Z (a gentle breath), nudged a touch by audio.
    const zBreath = sin(frameCount * 0.006) * 170 * M + energy * 2.2 * M;
    const weight = Math.max(0.75, 1.15 + energy * 0.03);

    push();
    translate(0, 0, zBreath);
    drawStrokes(ctx, drawn, S, weight, 'shadow');
    drawStrokes(ctx, drawn, S, weight, 'main');
    pop();
  }

  // Register one scene per family.
  for (const F of FAMILIES) {
    Scenes.register({
      name: F.name,
      family: F.family,
      sub: F.sub,
      spa: F.spa,
      clearEveryFrame: true,
      enter() {
        if (!this.colTable) this.colTable = buildColTable(F.palette);
        genInto(this);
      },
      draw() { drawKolam(this); },
    });
  }
}
