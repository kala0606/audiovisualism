// scenes.kolam.js — one scene per Kolam family, rendered as an INFINITE FLIGHT
// through a Z-corridor of kolams.
//
// Perf model (the plotter insight): each kolam is many short bezier arcs. Drawing
// them as separate bezier() calls = one WebGL draw call each = slow. Instead we
// pre-sample every arc into line segments ONCE (on generate), then draw a whole
// kolam plane as a SINGLE batched beginShape(LINES) — one draw call per plane.
// Each kolam is one colour, one weight (no per-stroke dissection).
//
// Motion: constant forward flight whose SPEED is driven by FFT energy (louder =
// faster). Planes recycle to the far end with a fresh kolam as they pass.

function registerKolamScenes() {
  const FAMILIES = [
    { name: 'Mandala', family: 'Mandala', sub: 0.55, spa: 1.5,
      palette: [[255, 96, 110], [206, 32, 58], [104, 16, 30], [12, 4, 6]] },
    { name: 'Sikku', family: 'Sikku', sub: 0.42, spa: 1.4,
      palette: [[255, 196, 92], [214, 120, 38], [110, 44, 18], [10, 6, 3]] },
    { name: 'Labyrinth', family: 'Labyrinth', sub: 0.7, spa: 2.0,
      palette: [[124, 232, 224], [36, 150, 176], [16, 54, 86], [4, 8, 16]] },
    { name: 'Minimalist', family: 'Minimalist', sub: 0.5, spa: 1.3,
      palette: [[238, 238, 232], [150, 150, 148], [60, 60, 60], [8, 8, 8]] },
  ];

  const COL_N = 160;
  const L = 5;              // planes in the corridor
  const SP = 850;           // world-space spacing between planes
  const NEAR = 70;          // recycle a plane once it gets this close
  const FOV = Math.PI / 3;
  const TAN_H = Math.tan(FOV / 2);
  const SAMPLES = 6;        // segments per bezier arc (smooth, but batched)

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

  // Pre-sample all strokes into a flat segment list [ax,ay,bx,by, ...] (unit sq).
  function toSegments(strokes) {
    const segs = [];
    for (const s of strokes) {
      if (s.type === 'bezier') {
        let px = s.x1, py = s.y1;
        for (let k = 1; k <= SAMPLES; k++) {
          const t = k / SAMPLES, u = 1 - t;
          const x = u * u * u * s.x1 + 3 * u * u * t * s.cx1 + 3 * u * t * t * s.cx2 + t * t * t * s.x2;
          const y = u * u * u * s.y1 + 3 * u * u * t * s.cy1 + 3 * u * t * t * s.cy2 + t * t * t * s.y2;
          segs.push(px, py, x, y);
          px = x; py = y;
        }
      } else {
        segs.push(s.x1, s.y1, s.x2, s.y2);
      }
    }
    return segs;
  }

  function genSegments(ctx) {
    Kolam.generate(ctx.family, ctx.sub, ctx.spa);
    return toSegments(Kolam.strokes);
  }

  function drawFlight(ctx) {
    const energy = filteredSignal[3];

    perspective(FOV, width / height, 1, 40000);
    camera(0, 0, 0, 0, 0, -1, 0, 1, 0);

    // Plane size so the nearest plane always covers the viewport (full-bleed).
    const aspect = width / height;
    const W = 2 * SP * TAN_H * Math.max(1, aspect) * 1.14;

    // Flight SPEED driven by FFT energy (louder = faster). Small base drift so
    // it always moves forward; no slider.
    const speed = 1.6 + energy * 0.30;
    const maxDist = NEAR + L * SP;

    for (const lyr of ctx.layers) {
      lyr.dist -= speed;
      if (lyr.dist <= NEAR) {
        lyr.dist += L * SP;
        lyr.segs = genSegments(ctx); // a fresh kolam is "made" up ahead
      }
    }

    const order = ctx.layers.slice().sort((a, b) => b.dist - a.dist);
    noFill();
    strokeCap(ROUND);
    strokeJoin(ROUND);

    for (const lyr of order) {
      const dist = lyr.dist;
      let a = 255;
      a *= constrain(map(dist, maxDist, maxDist - SP * 0.6, 0, 1), 0, 1);
      a *= constrain(map(dist, NEAR, NEAR + 110, 0, 1), 0, 1);
      if (a <= 2) continue;

      const wt = constrain((SP * 1.05) / dist, 0.6, 3.6) * (1 + energy * 0.02);
      const col = lyr.col;
      stroke(red(col), green(col), blue(col), a);
      strokeWeight(wt);

      push();
      translate(0, 0, -dist);
      // ONE batched draw call for the whole kolam plane.
      beginShape(LINES);
      const segs = lyr.segs;
      for (let i = 0; i < segs.length; i += 4) {
        vertex(segs[i] * W, segs[i + 1] * W, 0);
        vertex(segs[i + 2] * W, segs[i + 3] * W, 0);
      }
      endShape();
      pop();
    }
  }

  for (const F of FAMILIES) {
    Scenes.register({
      name: F.name,
      family: F.family,
      sub: F.sub,
      spa: F.spa,
      clearEveryFrame: true,
      enter() {
        if (!this.colTable) this.colTable = buildColTable(F.palette);
        this.layers = [];
        for (let i = 0; i < L; i++) {
          // Each plane: one colour graded across the family's brighter tones.
          const col = this.colTable[Math.floor(map(i, 0, L - 1, 0, COL_N * 0.55))] || color(255);
          this.layers.push({ dist: NEAR + (i + 0.5) * SP, segs: null, col });
        }
        for (const lyr of this.layers) lyr.segs = genSegments(this);
      },
      draw() { drawFlight(this); },
    });
  }
}
