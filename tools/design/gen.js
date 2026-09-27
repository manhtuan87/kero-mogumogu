// Stage generator for the harder worlds.
// Random layouts come from templates; the solver then tries every timing of
// the intended actions, puts the frog where ALL actions are needed and the
// timing slack is "a bit tight" (>= 0.25 s), puts stars on the solution path,
// and keeps the stage only if the real engine agrees.
//
// usage: node gen.js <world> <wanted> <seed> <out.jsonl>
//   world: one of the keys of WORLDS below (w6 ... w15)
'use strict';
const path = require('path');
const fs = require('fs');
const E = require(path.join(__dirname, '..', '..', 'js', 'engine.js'));
const P = E.P, DT = E.DT, W = E.W, H = E.H;

// ------------------------------------------------------------------ helpers

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const ri = (R, a, b) => Math.round(a + R() * (b - a));
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
const shuffle = (R, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const range = (a, b, s) => { const o = []; for (let v = a; v <= b + 1e-9; v += s) o.push(+v.toFixed(3)); return o; };
const clampX = x => Math.max(25, Math.min(335, x));
function segPointDist(p, s) { return E.segDist(p[0], p[1], s[0], s[1], s[2], s[3]).d; }

// Every "thing" in a level as points (for spacing checks).
function objectPoints(lv) {
  const pts = [];
  (lv.ropes || []).forEach(r => { pts.push([r[0], r[1], 26]); if (r[3] != null) pts.push([r[3], r[4], 26]); });
  (lv.bubbles || []).forEach(b => pts.push([b[0], b[1], 34]));
  (lv.blowers || []).forEach(b => pts.push([b[0], b[1], 36]));
  (lv.hooks || []).forEach(h => pts.push([h[0], h[1], 22]));
  (lv.hats || []).forEach(h => { pts.push([h[0], h[1], 32]); pts.push([h[2], h[3], 32]); });
  (lv.pads || []).concat(lv.spikes || []).forEach(s => { for (let k = 0; k <= 4; k++) pts.push([s[0] + (s[2] - s[0]) * k / 4, s[1] + (s[3] - s[1]) * k / 4, 16]); });
  (lv.rotors || []).forEach(r => pts.push([r[0], r[1], r[2] / 2 + 8]));
  return pts;
}

// Things must not sit on top of each other.
function spacedOK(lv) {
  const pts = objectPoints(lv);
  for (let i = 0; i < pts.length; i++) {
    if (pts[i][0] < 15 || pts[i][0] > 345 || pts[i][1] < 62 || pts[i][1] > 625) return false;
  }
  const solid = [];
  (lv.bubbles || []).forEach(b => solid.push([b[0], b[1], 32]));
  (lv.blowers || []).forEach(b => solid.push([b[0], b[1], 34]));
  (lv.hats || []).forEach(h => { solid.push([h[0], h[1], 30]); solid.push([h[2], h[3], 30]); });
  (lv.rotors || []).forEach(r => solid.push([r[0], r[1], r[2] / 2 + 6]));
  (lv.hooks || []).forEach(h => solid.push([h[0], h[1], 14]));
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    if (dist(solid[i], solid[j]) < solid[i][2] + solid[j][2] - 6) return false;
  }
  return true;
}

// ------------------------------------------------------------------ templates
// Each returns { level, orders:[[...actions]], timed } or null.

function ropesAbove(R, candy, n, spread) {
  const ropes = [];
  let tries = 0;
  while (ropes.length < n && tries++ < 80) {
    const a = [ri(R, 30, 330), ri(R, 70, Math.max(80, Math.min(candy[1] - 40, 210)))];
    if (spread && Math.abs(a[0] - candy[0]) > spread) continue;
    if (ropes.some(r => dist(r, a) < 70) || dist(a, candy) < 55) continue;
    const len = Math.round(dist(a, candy) * (1 + R() * 0.22));
    ropes.push([a[0], a[1], len]);
  }
  return ropes.length === n ? ropes : null;
}

function trapBar(R, x, y) {
  const w = ri(R, 80, 130);
  return [clampX(x - w / 2), y, clampX(x + w / 2), y];
}

function cutOrders(R, ropes, extra) {
  const ids = ropes.map((_, i) => 'c' + i), out = [];
  for (let k = 0; k < 2; k++) out.push(shuffle(R, ids).concat(extra || []));
  return out;
}

const T = {
  ropes(R, o) {
    const candy = [ri(R, 80, 280), ri(R, 150, 250)];
    const ropes = ropesAbove(R, candy, ri(R, o.min || 2, o.max || 3));
    if (!ropes) return null;
    const level = { candy, ropes };
    if (R() < (o.spikeP == null ? 0.6 : o.spikeP)) level.spikes = [trapBar(R, candy[0] + ri(R, -20, 20), ri(R, candy[1] + 150, 480))];
    return { level, orders: cutOrders(R, ropes), timed: false };
  },

  hooks(R, o) {
    const candy = [ri(R, 70, 290), ri(R, 130, 220)];
    const ropes = ropesAbove(R, candy, ri(R, 1, 2));
    if (!ropes) return null;
    const hooks = [];
    const nh = ri(R, o.minHooks || 1, o.maxHooks || 2);
    for (let k = 0; k < 40 && hooks.length < nh; k++) {
      const h = [ri(R, 60, 300), ri(R, candy[1] + 80, 470), ri(R, 65, 95)];
      if (dist(h, candy) < h[2] + 25 || hooks.some(q => dist(q, h) < 110)) continue;
      hooks.push(h);
    }
    if (hooks.length < nh) return null;
    const level = { candy, ropes, hooks };
    if (R() < 0.5) level.spikes = [trapBar(R, ri(R, 80, 280), ri(R, 500, 590))];
    const extra = R() < 0.7 ? ['ch' + ri(R, 0, hooks.length - 1)] : [];
    return { level, orders: cutOrders(R, ropes, extra), timed: false };
  },

  bubble(R, o) {
    let candy, ropes, bubbles;
    if (R() < 0.5) {       // floating, tied from below
      candy = [ri(R, 70, 290), ri(R, 380, 520)];
      bubbles = [candy.slice()];
      ropes = [[candy[0] + ri(R, -40, 40), Math.min(615, candy[1] + ri(R, 60, 95))]];
    } else {               // hanging above a bubble
      candy = [ri(R, 70, 290), ri(R, 140, 260)];
      ropes = [[candy[0] + ri(R, -25, 25), candy[1] - ri(R, 60, 90)]];
      bubbles = [[candy[0] + ri(R, -12, 12), candy[1] + ri(R, 100, 200)]];
    }
    const blowers = [];
    const nb = ri(R, o.minBlowers == null ? 1 : o.minBlowers, o.maxBlowers || 2);
    for (let k = 0; k < 30 && blowers.length < nb; k++) {
      const left = R() < 0.5;
      const b = [left ? ri(R, 22, 40) : ri(R, 320, 338), ri(R, 150, 540), left ? ri(R, -30, 30) : 180 + ri(R, -30, 30)];
      if (blowers.some(q => Math.abs(q[1] - b[1]) < 90)) continue;
      blowers.push(b);
    }
    const level = { candy, ropes, bubbles };
    if (blowers.length) level.blowers = blowers;
    if (R() < 0.55) level.spikes = [trapBar(R, ri(R, 90, 270), ri(R, 150, 330))];
    if (o.hats && R() < 0.6) level.hats = [[ri(R, 60, 300), ri(R, 120, 300), ri(R, 60, 300), ri(R, 330, 560)]];
    if (o.rotors && R() < 0.6) level.rotors = [[ri(R, 90, 270), ri(R, 200, 360), ri(R, 90, 120), pick(R, [-1, 1]) * ri(R, 50, 90), ri(R, 0, 180)]];
    const acts = [];
    const k = ri(R, 1, 3);
    for (let i = 0; i < k; i++) acts.push(blowers.length && R() < 0.65 ? 'b' + ri(R, 0, blowers.length - 1) : 'p');
    const seq = ['c0'].concat(acts.filter((a, i) => a !== 'p' || acts.indexOf('p') === i));
    return { level, orders: [seq], timed: !!level.rotors };
  },

  jelly(R, o) {
    const candy = [ri(R, 70, 290), ri(R, 130, 230)];
    const ropes = ropesAbove(R, candy, ri(R, 1, 2));
    if (!ropes) return null;
    const pads = [];
    const np = ri(R, 1, o.maxPads || 2);
    for (let k = 0; k < 30 && pads.length < np; k++) {
      const cx = ri(R, 60, 300), cy = ri(R, candy[1] + 160, 585), a = ri(R, -28, 28) * Math.PI / 180, L = ri(R, 90, 120);
      const p = [Math.round(cx - Math.cos(a) * L / 2), Math.round(cy - Math.sin(a) * L / 2), Math.round(cx + Math.cos(a) * L / 2), Math.round(cy + Math.sin(a) * L / 2)];
      if (pads.some(q => Math.abs((q[1] + q[3]) / 2 - cy) < 70 && Math.abs((q[0] + q[2]) / 2 - cx) < 130)) continue;
      pads.push(p);
    }
    const level = { candy, ropes, pads };
    if (o.hooks && R() < 0.6) level.hooks = [[ri(R, 70, 290), ri(R, 200, 420), ri(R, 65, 90)]];
    if (o.hats && R() < 0.5) level.hats = [[ri(R, 60, 300), ri(R, 260, 480), ri(R, 60, 300), ri(R, 110, 300)]];
    if (o.bubbles && R() < 0.4) level.bubbles = [[ri(R, 70, 290), ri(R, 250, 420)]];
    return { level, orders: cutOrders(R, ropes), timed: false };
  },

  warp(R, o) {
    const candy = [ri(R, 70, 290), ri(R, 130, 210)];
    const ropes = ropesAbove(R, candy, o.oneRope ? 1 : (R() < 0.65 ? 2 : 1), 90);
    if (!ropes) return null;
    const A = [candy[0] + ri(R, -14, 14), candy[1] + ri(R, 110, 230)];
    let B = null;
    for (let k = 0; k < 30 && !B; k++) {
      const b = [ri(R, 50, 310), ri(R, 110, 470)];
      if (dist(b, A) > 140 && dist(b, candy) > 90) B = b;
    }
    if (!B) return null;
    const level = { candy, ropes, hats: [[A[0], A[1], B[0], B[1]]] };
    if (o.second && R() < 0.5) level.hats.push([ri(R, 50, 310), ri(R, 330, 560), ri(R, 50, 310), ri(R, 110, 330)]);
    if (o.pads && R() < 0.5) level.pads = [(cx => [cx - 50, ri(R, 540, 590), cx + 50, ri(R, 540, 590)])(ri(R, 80, 280))];
    if (o.hooks && R() < 0.5) level.hooks = [[ri(R, 70, 290), ri(R, 250, 470), ri(R, 65, 90)]];
    if (o.rotors && R() < 0.5) level.rotors = [[ri(R, 90, 270), ri(R, 300, 450), ri(R, 90, 120), pick(R, [-1, 1]) * ri(R, 50, 90), ri(R, 0, 180)]];
    if (o.bubbles && R() < 0.4) level.bubbles = [[ri(R, 70, 290), ri(R, 300, 500)]];
    if (R() < 0.4) level.spikes = [trapBar(R, ri(R, 90, 270), ri(R, 480, 600))];
    let extra = [];
    if (!o.oneRope && ropes.length === 1 && !level.rotors) {
      // one rope: something to do after the treat comes out of the hat
      if (R() < 0.5) { level.hooks = [[ri(R, 70, 290), ri(R, 180, 470), ri(R, 65, 90)]]; extra = ['ch0']; }
      else { level.bubbles = [[ri(R, 70, 290), ri(R, 250, 520)]]; extra = ['p']; }
    }
    return { level, orders: cutOrders(R, ropes, extra), timed: !!level.rotors };
  },

  rotor(R, o) {
    const candy = [ri(R, 90, 270), ri(R, 130, 210)];
    const ropes = ropesAbove(R, candy, ri(R, 1, o.maxRopes || 2), 70);
    if (!ropes) return null;
    const off = o.offset || 25, sp = o.speed || [55, 105], ln = o.len || [90, 130];
    const rotors = [[candy[0] + ri(R, -off, off), ri(R, 290, 420), ri(R, ln[0], ln[1]), pick(R, [-1, 1]) * ri(R, sp[0], sp[1]), ri(R, 0, 180)]];
    if (o.two && R() < 0.5) rotors.push([ri(R, 80, 280), ri(R, 440, 540), ri(R, 80, 110), pick(R, [-1, 1]) * ri(R, 55, 100), ri(R, 0, 180)]);
    const level = { candy, ropes, rotors };
    if (o.hooks && R() < 0.5) level.hooks = [[ri(R, 70, 290), ri(R, 230, 470), ri(R, 65, 90)]];
    return { level, orders: cutOrders(R, ropes, level.hooks && R() < 0.5 ? ['ch0'] : []), timed: true };
  },

  moving(R, o) {
    const y = ri(R, 80, 130), x1 = ri(R, 40, 120), x2 = ri(R, 240, 320), len = ri(R, 90, 140);
    const flip = R() < 0.5;
    const ropes = [flip ? [x2, y, len, x1, y, ri(R, 4, 7)] : [x1, y, len, x2, y, ri(R, 4, 7)]];
    const candy = [ropes[0][0], y + len];
    const level = { candy, ropes };
    if (R() < 0.6) level.hooks = [[ri(R, 70, 290), ri(R, 280, 470), ri(R, 65, 95)]];
    if (o.rotors && R() < 0.5) level.rotors = [[ri(R, 90, 270), ri(R, 330, 470), ri(R, 90, 120), pick(R, [-1, 1]) * ri(R, 50, 90), ri(R, 0, 180)]];
    if (R() < 0.5) level.spikes = [trapBar(R, ri(R, 90, 270), ri(R, 500, 600))];
    if (o.hats && R() < 0.4) level.hats = [[ri(R, 60, 300), ri(R, 330, 520), ri(R, 60, 300), ri(R, 150, 330)]];
    const seq = ['c0'];
    if (level.hooks && R() < 0.5) seq.push('ch0');
    return { level, orders: [seq], timed: true };
  },

  mix(R, o) {
    const base = pick(R, o.bases || ['ropes', 'hooks', 'jelly', 'warp', 'rotor', 'moving', 'bubble']);
    const opts = { hats: true, rotors: true, hooks: true, bubbles: true, pads: true, second: true, two: true, min: 2, max: 3, maxHooks: 2 };
    return T[base](R, opts);
  }
};

// ------------------------------------------------------------------ exploring timings

function runPath(w, until) {
  const pts = [], ev = new Set();
  let k = 0;
  while (w.state === 'play' && w.t < until) {
    w.step();
    for (const e of w.events) ev.add(e.type);
    w.events.length = 0;
    if ((k++ & 1) === 0) pts.push(w.candy.x, w.candy.y);
  }
  pts.push(w.candy.x, w.candy.y);
  return { path: Float32Array.from(pts), ev, end: w.state };
}

function advanceTo(w, t) { while (w.state === 'play' && w.t < t - 1e-9) { w.step(); w.events.length = 0; } }

// Try every timing (grid) of the action order.
function explore(level, order, timed) {
  const L = Object.assign({}, level, { frog: [-9999, -9999] });
  const n = order.length;
  const g = n >= 4 ? 0.2 : 0.1;
  const t1s = timed ? range(0.3, n >= 3 ? 3.0 : 3.6, timed && n >= 3 ? 0.2 : 0.1) : [0.5];
  const deltas = range(0.1, n >= 3 ? 2.6 : 3.0, g);
  const combos = [], idles = [];
  const base = new E.World(L, { fast: true });
  idles.push(runPath(base.clone(), 9).path);                 // nothing done at all
  const cur = base.clone();
  t1s.forEach((t1, i1) => {
    advanceTo(cur, t1);
    if (cur.state !== 'play') return;
    step(cur, 0, [t1], [i1]);
  });
  function step(wAt, k, times, idx) {
    const w2 = wAt.clone();
    if (!w2.act(order[k])) return;                           // action impossible at this moment
    if (k === n - 1) {
      const r = runPath(w2, times[k] + 5);
      combos.push({ times, idx, path: r.path, ev: r.ev });
      return;
    }
    idles.push(runPath(w2.clone(), times[k] + 7).path);     // stop after this action
    const walker = w2.clone();
    deltas.forEach((d, j) => {
      const t = +(times[k] + d).toFixed(3);
      advanceTo(walker, t);
      if (walker.state !== 'play') return;
      step(walker, k + 1, times.concat([t]), idx.concat([j]));
    });
  }
  return { combos, idles, t1s, deltas, g, n, timed };
}

// ------------------------------------------------------------------ frog placement

const GX = range(65, 295, 15), GY = range(126, 572, 14);
function cellsNear(x, y, r, out) {
  const r2 = r * r;
  for (let i = 0; i < GX.length; i++) {
    const dx = GX[i] - x;
    if (dx * dx > r2) continue;
    for (let j = 0; j < GY.length; j++) {
      const dy = GY[j] - y;
      if (dx * dx + dy * dy < r2) out[i * GY.length + j] = 1;
    }
  }
}
function markPath(p, r, out) { for (let i = 0; i < p.length; i += 2) cellsNear(p[i], p[i + 1], r, out); }

function fitFrog(level, ex, target) {
  const NC = GX.length * GY.length;
  const bad = new Uint8Array(NC);
  ex.idles.forEach(p => markPath(p, P.eatR + 6, bad));       // reachable with fewer actions
  objectPoints(level).forEach(q => cellsNear(q[0], q[1] - 10, q[2] + 58, bad));
  cellsNear(level.candy[0], level.candy[1], 90, bad);
  const hits = ex.combos.map(c => { const m = new Uint8Array(NC); markPath(c.path, P.eatR - 4, m); return m; });
  // dense index over the timing grid
  const dims = [ex.t1s.length].concat(Array(ex.n - 1).fill(ex.deltas.length));
  const strides = dims.map((_, i) => dims.slice(i + 1).reduce((a, b) => a * b, 1));
  const size = dims.reduce((a, b) => a * b, 1);
  const dense = new Int32Array(size).fill(-1);
  ex.combos.forEach((c, ci) => { dense[c.idx.reduce((s, v, i) => s + v * strides[i], 0)] = ci; });
  const stepOf = a => (a === 0 ? (ex.timed ? ex.t1s[1] - ex.t1s[0] : 0) : ex.g);
  let best = null;
  for (let cell = 0; cell < NC; cell++) {
    if (bad[cell]) continue;
    let wins = 0;
    for (let ci = 0; ci < hits.length; ci++) if (hits[ci][cell]) wins++;
    if (!wins) continue;
    // for each winning combo: the shortest contiguous run over the axes that matter
    let bestR = -1, bestC = -1;
    for (let ci = 0; ci < hits.length; ci++) {
      if (!hits[ci][cell]) continue;
      const idx = ex.combos[ci].idx;
      let r = Infinity;
      for (let a = 0; a < dims.length; a++) {
        if (a === 0 && !ex.timed) continue;
        let run = 1;
        for (const dir of [-1, 1]) {
          for (let v = idx[a] + dir; v >= 0 && v < dims[a]; v += dir) {
            const di = idx.reduce((s, x, i) => s + (i === a ? v : x) * strides[i], 0);
            const cj = dense[di];
            if (cj >= 0 && hits[cj][cell]) run++; else break;
          }
        }
        r = Math.min(r, run * stepOf(a));
      }
      if (r > bestR) { bestR = r; bestC = ci; }
    }
    const score = (bestR === Infinity ? 5 : bestR);
    if (score < target.min) continue;
    // aim for "a bit tight": close to target.ideal, never below target.min
    const fitness = -Math.abs(Math.min(score, 3) - target.ideal) + Math.min(wins, 50) * 0.002;
    if (!best || fitness > best.fitness) {
      best = { cell, x: GX[Math.floor(cell / GY.length)], y: GY[cell % GY.length], r: score, wins, combo: ex.combos[bestC], fitness };
    }
  }
  return best;
}

// ------------------------------------------------------------------ stars & final checks

function fullPath(level, sol) {
  const w = new E.World(level, { fast: true }), acts = E.parseSol(sol);
  let ai = 0; const pts = [], ev = new Set();
  while (w.state === 'play' && w.t < 14) {
    while (ai < acts.length && acts[ai].t <= w.t + 1e-9) { w.act(acts[ai].a); ai++; }
    w.step();
    for (const e of w.events) ev.add(e.type);
    w.events.length = 0;
    if (!w.held) pts.push([w.candy.x, w.candy.y]);
  }
  return { pts, ev, state: w.state };
}

function placeStars(level, pts) {
  const frog = level.frog, objs = objectPoints(level);
  let end = pts.length;
  for (let i = 0; i < pts.length; i++) if (dist(pts[i], frog) < 72) { end = i; break; }
  const p = pts.slice(0, end), cum = [0];
  // a jump through a warp hat is not distance travelled
  for (let i = 1; i < p.length; i++) { const dd = dist(p[i], p[i - 1]); cum.push(cum[i - 1] + (dd > 40 ? 0 : dd)); }
  const L = cum[cum.length - 1];
  if (L < 180) return null;
  const ok = s => s[0] > 26 && s[0] < 334 && s[1] > 80 && s[1] < 608 && dist(s, level.candy) > 60 &&
    objs.every(q => dist(q, s) > Math.min(q[2], 30) + 16);
  const at = f => { const i = Math.max(0, cum.findIndex(c => c >= f * L)); return [Math.round(p[i][0]), Math.round(p[i][1])]; };
  const stars = [];
  for (const f0 of [0.22, 0.52, 0.8]) {
    let s = null;
    for (const df of [0, 0.04, -0.04, 0.08, -0.08, 0.12, -0.12, 0.16, -0.16]) {
      const c = at(Math.min(0.97, Math.max(0.05, f0 + df)));
      if (ok(c) && stars.every(q => dist(q, c) > 56)) { s = c; break; }
    }
    if (!s) return null;
    stars.push(s);
  }
  return stars;
}

// Timing slack of each action (the same rules as tools/verify.js).
function windows(level, acts, stars) {
  const ok = r => r.state === 'won' && (stars == null || r.stars === stars);
  const run = a => E.run(level, a, 15);
  return acts.map((_, i) => {
    const shift = (d, alone) => acts.map((a, j) => (j === i || (j > i && !alone) ? { a: a.a, t: a.t + d } : a));
    const one = alone => {
      let lo = 0, hi = 0;
      for (let d = 0.05; d <= 1.001; d += 0.05) {
        const b = shift(-d, alone);
        if (b[i].t < 0.05 || (i > 0 && b[i].t < acts[i - 1].t)) break;
        if (ok(run(b))) lo = d; else break;
      }
      for (let d = 0.05; d <= 1.001; d += 0.05) {
        const b = shift(d, alone);
        if (alone && i + 1 < acts.length && b[i].t > b[i + 1].t) break;
        if (ok(run(b))) hi = d; else break;
      }
      return lo + hi;
    };
    let best = one(false);
    if (i + 1 < acts.length) best = Math.max(best, one(true));
    if (i === acts.length - 2) {
      const last = acts.length - 1;
      const wins = d => { for (let d2 = -1; d2 <= 1.001; d2 += 0.1) { const b = acts.map((a, j) => (j === i ? { a: a.a, t: a.t + d } : j === last ? { a: a.a, t: a.t + d2 } : a)); if (b[last].t <= b[i].t || b[i].t < 0.05) continue; if (ok(run(b))) return true; } return false; };
      let lo = 0, hi = 0;
      for (let d = 0.05; d <= 1.001; d += 0.05) { if (wins(-d)) lo = d; else break; }
      for (let d = 0.05; d <= 1.001; d += 0.05) { if (wins(d)) hi = d; else break; }
      best = Math.max(best, lo + hi);
    }
    return +best.toFixed(2);
  });
}

function usesGimmicks(level, fp) {
  if ((level.bubbles || []).length && !fp.ev.has('bubble')) return false;
  if ((level.hooks || []).length && !fp.ev.has('hook')) return false;
  if ((level.hats || []).length && !fp.ev.has('warp')) return false;
  if ((level.pads || []).length && !fp.ev.has('bounce')) return false;
  for (const r of level.rotors || []) {
    if (!fp.pts.some(p => dist(p, r) < r[2] / 2 + 30)) return false;
  }
  return true;
}

function evaluate(cand, target) {
  if (!spacedOK(cand.level)) return { why: 'crowded' };
  let bestOut = null;
  for (const order of cand.orders) {
    if (order.length < (cand.timed ? 1 : target.minActions)) continue;
    const ex = explore(cand.level, order, cand.timed);
    if (!ex.combos.length) continue;
    const fit = fitFrog(cand.level, ex, target);
    if (!fit) continue;
    const level = Object.assign({}, cand.level, { frog: [fit.x, fit.y] });
    const sol = fit.combo.times.map((t, i) => `${order[i]}@${(+t).toFixed(2).replace(/0$/, '')}`).join(' ');
    const fp = fullPath(level, sol);
    if (fp.state !== 'won' || !usesGimmicks(level, fp)) continue;
    const stars = placeStars(level, fp.pts);
    if (!stars) continue;
    level.stars = stars;
    const acts = E.parseSol(sol);
    const res = E.run(level, acts, 15);
    if (res.state !== 'won' || res.stars !== 3) continue;
    if (E.run(level, [], 12).state === 'won') continue;
    const clear = windows(level, acts, null);
    const three = windows(level, acts, 3);
    const clearMin = Math.min(...clear.filter((_, i) => i > 0 || cand.timed).concat([9]));
    const threeMin = Math.min(...three.filter((_, i) => i > 0 || cand.timed).concat([9]));
    if (clearMin < target.min || threeMin < 0.1) continue;
    level.sol = sol;
    const kinds = ['bubbles', 'blowers', 'hooks', 'pads', 'spikes', 'hats', 'rotors'].filter(k => (level[k] || []).length);
    const diff = order.length + Math.max(0, 0.9 - Math.min(clearMin, 0.9)) * 3 + kinds.length * 0.3 + (cand.timed ? 0.5 : 0);
    const out = { level, n: order.length, clear, three, clearMin, diff: +diff.toFixed(2), kinds };
    if (!bestOut || Math.abs(clearMin - target.ideal) < Math.abs(bestOut.clearMin - target.ideal)) bestOut = out;
  }
  return bestOut || { why: 'no fit' };
}

// ------------------------------------------------------------------ worlds

const WORLDS = {
  w6: { mix: [['ropes', { min: 3, max: 4, spikeP: 0.7 }], ['hooks', { minHooks: 1, maxHooks: 2 }]] },
  w7: { mix: [['bubble', { minBlowers: 1, maxBlowers: 2 }]] },
  w8t: { mix: [['warp', { oneRope: true }]], minActions: 1 },
  w8: { mix: [['warp', { hooks: true, pads: true }], ['warp', { second: true, bubbles: true }]] },
  w9t: { mix: [['rotor', { maxRopes: 1, speed: [25, 45], len: [70, 95], offset: 45 }]], minActions: 1, min: 0.45, ideal: 0.9 },
  w9: { mix: [['rotor', { hooks: true }], ['rotor', { two: true }]] },
  w10: { mix: [['jelly', { hooks: true, hats: true }], ['warp', { pads: true, hooks: true }], ['hooks', { maxHooks: 3 }]] },
  w11: { mix: [['moving', { rotors: true }], ['rotor', { hooks: true, two: true, maxRopes: 3 }]] },
  w12: { mix: [['bubble', { hats: true, rotors: true, maxBlowers: 2 }], ['warp', { bubbles: true, rotors: true }]] },
  w13: { mix: [['mix', {}]] },
  w14: { mix: [['mix', {}]] },
  w15: { mix: [['mix', { bases: ['moving', 'warp', 'rotor', 'bubble', 'jelly'] }]] }
};

function main() {
  const [world, wantedS, seedS, out] = process.argv.slice(2);
  const cfg = WORLDS[world];
  if (!cfg) { console.error('unknown world', world); process.exit(1); }
  const wanted = +wantedS || 20, R = rng(+seedS || 1);
  const target = { min: cfg.min || 0.25, ideal: cfg.ideal || 0.5, minActions: cfg.minActions || 2 };
  let tried = 0, kept = 0;
  const t0 = Date.now();
  while (kept < wanted && tried < 4000) {
    tried++;
    const [tpl, o] = pick(R, cfg.mix);
    const cand = T[tpl](R, o);
    if (!cand) continue;
    let res;
    try { res = evaluate(cand, target); } catch (e) { continue; }
    if (!res || res.why) continue;
    kept++;
    fs.appendFileSync(out, JSON.stringify(Object.assign({ world, tpl }, res)) + '\n');
    console.log(`${world} kept ${kept}/${wanted} (tried ${tried}, ${((Date.now() - t0) / 1000).toFixed(0)}s) n=${res.n} clear=${res.clear} diff=${res.diff} kinds=${res.kinds}`);
  }
  console.log(`${world} done: kept ${kept} of ${tried} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (require.main === module) main();
module.exports = { T, explore, fitFrog, evaluate, windows, rng };
