// scenes.kolam.js — one scene per Kolam family, rendered as an INFINITE FLIGHT
// through a corridor of kolams.
//
// Model: a stack of L kolam "planes" at increasing depth. The camera flies
// straight forward at a constant speed (one direction — no oscillation). Each
// frame every plane moves toward the camera; when one passes the near point it
// recycles to the far end with a freshly generated kolam. Each plane is sized so
// the nearest one always covers the whole viewport at any resolution/aspect —
// full-bleed, no gaps, no visible border. Depth reads from perspective + fading.

function registerKolamScenes() {
  const FAMILIES = [
    { name: 'Mandala', family: 'Mandala', sub: 0.55, spa: 1.5,
      palette: [[255, 96, 110], [206, 32, 58], [104, 16, 30], [12, 4, 6]] },
    { name: 'Sikku', family: 'Sikku', sub: 0.6, spa: 1.5,
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
  const FOV = Math.PI / 3;  // 60° vertical field of view
  const TAN_H = Math.tan(FOV / 2);

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

  function genStrokes(ctx) {
    Kolam.generate(ctx.family, ctx.sub, ctx.spa);
    return Kolam.strokes.slice();
  }

  function newLayer(ctx, dist) {
    return { dist, strokes: genStrokes(ctx), tint: Math.floor(random(COL_N)) };
  }

  function drawFlight(ctx) {
    const energy = filteredSignal[3];

    // Camera at origin looking straight down -Z; planes live at z = -dist.
    perspective(FOV, width / height, 1, 40000);
    camera(0, 0, 0, 0, 0, -1, 0, 1, 0);

    // Plane size so the NEAREST plane (dist <= SP) always covers the viewport,
    // at any aspect ratio → full-bleed, resolution-independent.
    const aspect = width / height;
    const W = 2 * SP * TAN_H * Math.max(1, aspect) * 1.14;

    // Constant forward speed (one direction), lightly nudged by audio + tempo.
    const speed = (2.2 + VJ.tempo * 0.55) * (1 + energy * 0.015);
    const maxDist = NEAR + L * SP;

    // Advance and recycle planes.
    for (const lyr of ctx.layers) {
      lyr.dist -= speed;
      if (lyr.dist <= NEAR) {
        lyr.dist += L * SP;            // send to the far end
        lyr.strokes = genStrokes(ctx); // a brand-new kolam gets "made" ahead
        lyr.tint = Math.floor(random(COL_N));
      }
    }

    // Draw far → near so nearer planes layer on top.
    const order = ctx.layers.slice().sort((a, b) => b.dist - a.dist);
    noFill();
    strokeCap(ROUND);
    strokeJoin(ROUND);
    const tbl = ctx.colTable, tn = tbl.length;

    for (const lyr of order) {
      const dist = lyr.dist;
      // Full brightness through the corridor; only ramp in at the far end and
      // fade out in the last stretch before it passes the camera (no pop).
      let a = 255;
      a *= constrain(map(dist, maxDist, maxDist - SP * 0.6, 0, 1), 0, 1); // fade in far
      a *= constrain(map(dist, NEAR, NEAR + 110, 0, 1), 0, 1);            // fade out near
      if (a <= 2) continue;

      const wt = constrain((SP * 1.05) / dist, 0.5, 3.4) * (1 + energy * 0.02);
      push();
      translate(0, 0, -dist);
      strokeWeight(wt);
      const strokes = lyr.strokes;
      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        const c = tbl[(i * 3 + lyr.tint) % tn] || color(255);
        stroke(red(c), green(c), blue(c), a);
        if (s.type === 'bezier') {
          bezier(s.x1 * W, s.y1 * W, s.cx1 * W, s.cy1 * W, s.cx2 * W, s.cy2 * W, s.x2 * W, s.y2 * W);
        } else {
          line(s.x1 * W, s.y1 * W, s.x2 * W, s.y2 * W);
        }
      }
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
          // Spread evenly through the corridor.
          this.layers.push(newLayer(this, NEAR + (i + 0.5) * SP));
        }
      },
      draw() { drawFlight(this); },
    });
  }
}
