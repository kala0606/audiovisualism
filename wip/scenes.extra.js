// scenes.extra.js — new scenes that EXTEND the visual vocabulary.
//
// Each still reads only the house bus (filteredSignal[] energy, ds size,
// avx rotation phase, palette clr1A/clr1Num) so they stay coherent in form and
// speed with the original artwork — just new primitives.

function registerExtraScenes() {
  // ── Tunnel: colour rings receding in Z, rotating with the phase. ──────────
  Scenes.register({
    name: 'Tunnel',
    enter() {
      this.count = 42;
      this.spacing = 220;
    },
    draw() {
      push();
      for (let i = this.count - 1; i >= 0; i--) {
        push();
        const z = -i * this.spacing + ((frameCount * 6) % this.spacing);
        translate(0, 0, z);
        rotateZ(avx * 0.04 + i * 0.18);
        const col = clr1A[(i * 6 + frameCount) % clr1Num] || color(255);
        noStroke();
        fill(col);
        const r = (150 + i * 6) * M * (0.65 + ds * 0.35);
        const tube = (6 + i * 0.4) * M * ds;
        torus(r, tube, 28, 8);
        pop();
      }
      pop();
    },
  });

  // ── Lattice: a breathing 3D grid of cubes, slowly tumbling. ───────────────
  Scenes.register({
    name: 'Lattice',
    enter() {
      this.n = 6;
      this.gap = 130;
    },
    draw() {
      push();
      rotateY(avx * 0.02);
      rotateX(avx * 0.012);
      const gap = this.gap * M;
      const half = (this.n - 1) / 2;
      for (let x = 0; x < this.n; x++) {
        for (let y = 0; y < this.n; y++) {
          for (let z = 0; z < this.n; z++) {
            push();
            translate((x - half) * gap, (y - half) * gap, (z - half) * gap);
            const idx = (x * 13 + y * 7 + z * 3 + frameCount) % clr1Num;
            fill(clr1A[idx] || color(255));
            noStroke();
            const pulse = 0.5 + 0.5 * sin(frameCount * 0.09 + x + y + z);
            box(20 * M * ds * (0.4 + pulse));
            pop();
          }
        }
      }
      pop();
    },
  });

  // ── Ribbons: flowing horizontal strips driven by the phase + energy. ──────
  Scenes.register({
    name: 'Ribbons',
    enter() {
      this.rows = 6;
    },
    draw() {
      push();
      rotateX(-0.35);
      const w2 = width / 2;
      const step = Math.max(6, 22 * M);
      for (let r = 0; r < this.rows; r++) {
        const yBase = map(r, 0, this.rows - 1, -height * 0.28, height * 0.28);
        const col = clr1A[(r * 22 + frameCount) % clr1Num] || color(255);
        noFill();
        stroke(col);
        strokeWeight((2 + ds * 3) * M);
        beginShape();
        for (let x = -w2; x <= w2; x += step) {
          const y = yBase + sin(x * 0.01 + avx * 0.1 + r) * 90 * M * ds;
          const z = cos(x * 0.008 + frameCount * 0.02 + r) * 220 * M;
          vertex(x, y, z);
        }
        endShape();
      }
      pop();
    },
  });
}
