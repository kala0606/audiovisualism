// kolam.js — generative Kolam pattern engine (ported from KALA Kolam).
//
// Wave Function Collapse places curve-tiles on a square grid, then emits bezier
// "loop" curves through the cell-edge midpoints — the classic sikku kolam look.
// Output is resolution-independent: strokes live in a unit square centred on the
// origin (coords in [-0.5, 0.5]) so a 3D scene can scale/rotate them freely.

const Kolam = {
  SUB_N: [3, 3],

  TILES: [
    { id: 'blank',  e: [0, 0, 0, 0], type: 'BLANK' },
    { id: 'cross',  e: [1, 1, 1, 1], type: 'CROSS' },
    { id: 'curves', e: [1, 1, 1, 1], type: 'CURVES' },
    { id: 'loops',  e: [1, 1, 1, 1], type: 'LOOPS' },
    { id: 'cap_t',  e: [0, 1, 1, 1], type: 'CAP_T' },
    { id: 'cap_r',  e: [1, 0, 1, 1], type: 'CAP_R' },
    { id: 'cap_b',  e: [1, 1, 0, 1], type: 'CAP_B' },
    { id: 'cap_l',  e: [1, 1, 1, 0], type: 'CAP_L' },
  ],

  FAMILIES: {
    Sikku:      { gridCols: 7, symmetry: '4',    wts: [1, 2, 4, 8, 1, 1, 1, 1], maxDepth: 1 },
    Labyrinth:  { gridCols: 9, symmetry: 'none', wts: [0, 8, 1, 0, 3, 3, 3, 3], maxDepth: 0 },
    Mandala:    { gridCols: 5, symmetry: '4',    wts: [1, 1, 6, 4, 1, 1, 1, 1], maxDepth: 1 },
    Minimalist: { gridCols: 5, symmetry: 'v',    wts: [4, 1, 2, 1, 2, 2, 2, 2], maxDepth: 1 },
  },

  strokes: [],
  P: {},

  // Generate a pattern; fills this.strokes (unit-square, origin-centred).
  generate(family, sub = 0.7, spa = 1.5) {
    const fam = this.FAMILIES[family] ? family : 'Mandala';
    const f = this.FAMILIES[fam];
    this.P = {
      family: fam, subdivide: sub, spatial: spa, decay: 0.6,
      wts: f.wts, maxDepth: f.maxDepth, symmetry: f.symmetry, gridCols: f.gridCols,
    };

    const cols = f.gridCols, rows = f.gridCols; // square grid for symmetry
    const cell = 1.0 / cols;
    const off = -0.5;

    this.strokes = [];
    const root = this._runWFC(rows, cols, null);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this._processCell(root[r][c], off + c * cell, off + r * cell, cell, cell, 0);
      }
    }
    this._applySymmetry();
    return this.strokes;
  },

  _processCell(tileIdx, x, y, w, h, depth) {
    if (this._shouldSubdivide(tileIdx, depth, x + w / 2, y + h / 2)) {
      const N = this.SUB_N[Math.min(depth, this.SUB_N.length - 1)];
      const sw = w / N, sh = h / N;
      const sub = this._runWFC(N, N, this.TILES[tileIdx].e);
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          this._processCell(sub[r][c], x + c * sw, y + r * sh, sw, sh, depth + 1);
        }
      }
    } else {
      this._emit(tileIdx, x, y, w, h);
    }
  },

  _emit(tileIdx, x, y, w, h) {
    const tile = this.TILES[tileIdx];
    if (tile.type === 'BLANK') return;

    const xL = x, xR = x + w, yT = y, yB = y + h;
    const xC = x + w / 2, yC = y + h / 2;
    const pts = [
      { x: xC, y: yT }, { x: xR, y: yC }, { x: xC, y: yB }, { x: xL, y: yC },
    ];

    const curve = (a, b) => {
      const s = pts[a], e = pts[b];
      this.strokes.push({
        type: 'bezier',
        x1: s.x, y1: s.y,
        cx1: s.x + (xC - s.x) * 0.58, cy1: s.y + (yC - s.y) * 0.58,
        cx2: e.x + (xC - e.x) * 0.58, cy2: e.y + (yC - e.y) * 0.58,
        x2: e.x, y2: e.y,
      });
    };

    switch (tile.type) {
      case 'CROSS':  curve(0, 2); curve(1, 3); break;
      case 'CURVES': curve(0, 3); curve(1, 2); break;
      case 'LOOPS':  curve(0, 1); curve(2, 3); break;
      case 'CAP_T':  curve(1, 2); curve(2, 3); break;
      case 'CAP_R':  curve(0, 3); curve(2, 3); break;
      case 'CAP_B':  curve(0, 1); curve(0, 3); break;
      case 'CAP_L':  curve(0, 1); curve(1, 2); break;
    }
  },

  _runWFC(rows, cols, borderEdges) {
    const TILES = this.TILES;
    const total = rows * cols;
    const wave = Array.from({ length: total }, () => new Set(TILES.map((_, i) => i)));
    const idx = (r, c) => r * cols + c;
    const toRC = (i) => [Math.floor(i / cols), i % cols];

    const clampEdge = (wi, edgeIdx, required) => {
      for (const t of [...wave[wi]]) if (TILES[t].e[edgeIdx] !== required) wave[wi].delete(t);
      if (wave[wi].size === 0) wave[wi].add(0);
    };

    const propagate = (stack) => {
      let safety = 0;
      while (stack.length && safety < 10000) {
        safety++;
        const cur = stack.pop();
        const [r, c] = toRC(cur);
        for (const [dr, dc, myE, theirE] of [[-1, 0, 0, 2], [0, 1, 1, 3], [1, 0, 2, 0], [0, -1, 3, 1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const ni = idx(nr, nc);
          if (wave[ni].size <= 1) continue;
          const myVals = new Set();
          for (const t of wave[cur]) myVals.add(TILES[t].e[myE]);
          const before = wave[ni].size;
          for (const t of [...wave[ni]]) if (!myVals.has(TILES[t].e[theirE])) wave[ni].delete(t);
          if (wave[ni].size === 0) wave[ni].add(0);
          if (wave[ni].size < before) stack.push(ni);
        }
      }
    };

    if (borderEdges) {
      const seeds = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wi = idx(r, c); let s = false;
          if (r === 0)        { clampEdge(wi, 0, borderEdges[0]); s = true; }
          if (c === cols - 1) { clampEdge(wi, 1, borderEdges[1]); s = true; }
          if (r === rows - 1) { clampEdge(wi, 2, borderEdges[2]); s = true; }
          if (c === 0)        { clampEdge(wi, 3, borderEdges[3]); s = true; }
          if (s) seeds.push(wi);
        }
      }
      propagate(seeds);
    }

    for (let iter = 0; iter < total; iter++) {
      let minE = Infinity, minI = -1;
      for (let i = 0; i < total; i++) {
        if (wave[i].size <= 1) continue;
        const e = wave[i].size + Math.random() * 0.01;
        if (e < minE) { minE = e; minI = i; }
      }
      if (minI === -1) break;
      const opts = [...wave[minI]];
      const sum = opts.reduce((a, b) => a + this.P.wts[b], 0);
      let rv = Math.random() * sum, chosen = opts[opts.length - 1];
      for (let k = 0; k < opts.length; k++) { rv -= this.P.wts[opts[k]]; if (rv <= 0) { chosen = opts[k]; break; } }
      wave[minI] = new Set([chosen]);
      propagate([minI]);
    }

    const g = [];
    for (let r = 0; r < rows; r++) {
      g[r] = [];
      for (let c = 0; c < cols; c++) { const s = wave[idx(r, c)]; g[r][c] = s.size ? [...s][0] : 0; }
    }
    return g;
  },

  _shouldSubdivide(tileIdx, depth, cx, cy) {
    if (depth >= this.P.maxDepth) return false;
    const tile = this.TILES[tileIdx];
    const nx = cx / 0.5, ny = cy / 0.5; // unit square, half-extent 0.5
    const spatial = 1.0 + this.P.spatial * (0.15 - 0.35 * (nx * nx + ny * ny));
    const depthDecay = depth === 0 ? 1.0 : Math.pow(this.P.decay, depth);
    const cWeight = tile.type === 'BLANK' ? 0 : 4;
    if (cWeight === 0) return depth === 0 && Math.random() < 0.06 * this.P.subdivide * spatial;
    return Math.random() < (cWeight / 4) * 0.82 * this.P.subdivide * spatial * depthDecay;
  },

  _applySymmetry() {
    if (this.P.symmetry === 'none') return;
    const mx = (s) => (s.x1 + s.x2) / 2;
    const my = (s) => (s.y1 + s.y2) / 2;
    const reflect = (s, rx, ry) => ({
      ...s,
      x1: rx ? -s.x1 : s.x1, y1: ry ? -s.y1 : s.y1,
      cx1: rx ? -s.cx1 : s.cx1, cy1: ry ? -s.cy1 : s.cy1,
      cx2: rx ? -s.cx2 : s.cx2, cy2: ry ? -s.cy2 : s.cy2,
      x2: rx ? -s.x2 : s.x2, y2: ry ? -s.y2 : s.y2,
    });

    // Interleave each source stroke with its reflections so a progressive
    // reveal grows symmetrically (radially) instead of one lopsided quadrant.
    const out = [];
    if (this.P.symmetry === 'h') {
      for (const s of this.strokes.filter((s) => mx(s) <= 0)) {
        out.push(s, reflect(s, true, false));
      }
    } else if (this.P.symmetry === 'v') {
      for (const s of this.strokes.filter((s) => my(s) <= 0)) {
        out.push(s, reflect(s, false, true));
      }
    } else if (this.P.symmetry === '4') {
      for (const s of this.strokes.filter((s) => mx(s) <= 0 && my(s) <= 0)) {
        out.push(s, reflect(s, true, false), reflect(s, false, true), reflect(s, true, true));
      }
    }
    this.strokes = out;
  },
};
