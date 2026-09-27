/* ケロちゃん もぐもぐ — physics and game rules.
   Shared by the browser game and the Node.js level tools in tools/.
   Everything runs on a fixed 1/120 s step so a level plays out identically
   in the browser and in the level checker. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 360, H = 640, DT = 1 / 120;

  var P = {
    gravity: 950,      // px/s²
    ropeGravity: 0.35, // ropes feel less gravity so they look light next to the treat
    candyR: 17,
    seg: 13,           // target rope segment length
    iter: 14,          // constraint iterations per step
    dampRope: 0.998,
    dampCandy: 0.9997,
    buoyancy: 250,     // upward pull while inside a bubble
    dampBubble: 0.985,
    bubbleR: 30,
    starR: 20,
    eatR: 44,          // candy centre within this of the frog's mouth = eaten
    openR: 130,        // frog opens its mouth
    padHalf: 8,        // half thickness of a jelly pad
    padBounce: 650,    // minimum rebound speed off a jelly pad
    padRestitution: 0.85,
    spikeHalf: 7,
    blowRange: 320,
    blowPush: 300,     // px/s added by one puff (a bubble drifts ~170px)
    cutTol: 8,         // swipe distance that still cuts a rope
    tapRope: 26,       // a tap this close to a rope cuts it
    tapBubble: 28,
    tapBlower: 44,
    hatR: 24           // the treat enters a warp hat when this close to its middle
  };

  function Pt(x, y, im) { this.x = x; this.y = y; this.px = x; this.py = y; this.im = im; }
  function copyPt(p) { var q = new Pt(p.x, p.y, p.im); q.px = p.px; q.py = p.py; return q; }
  function sq(v) { return v * v; }
  function dist2(ax, ay, bx, by) { return sq(bx - ax) + sq(by - ay); }

  // Closest point on segment ab to p.
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = ax + dx * t, cy = ay + dy * t;
    return { d: Math.sqrt(sq(px - cx) + sq(py - cy)), x: cx, y: cy };
  }

  function orient(ax, ay, bx, by, cx, cy) { return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); }

  // Distance between segments ab and cd (0 when they cross).
  function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    var d1 = orient(cx, cy, dx, dy, ax, ay), d2 = orient(cx, cy, dx, dy, bx, by);
    var d3 = orient(ax, ay, bx, by, cx, cy), d4 = orient(ax, ay, bx, by, dx, dy);
    if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
    return Math.min(segDist(ax, ay, cx, cy, dx, dy).d, segDist(bx, by, cx, cy, dx, dy).d,
      segDist(cx, cy, ax, ay, bx, by).d, segDist(dx, dy, ax, ay, bx, by).d);
  }

  function integrate(p, g, damp) {
    var vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy + g * DT * DT;
  }

  function constrain(a, b, rest) {
    var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy), w = a.im + b.im;
    if (d < 1e-6 || w === 0) return;
    var k = (d - rest) / (d * w);
    a.x += dx * k * a.im; a.y += dy * k * a.im;
    b.x -= dx * k * b.im; b.y -= dy * k * b.im;
  }

  function solveChain(pts, seg, reverse) {
    var n = pts.length - 1, i;
    if (reverse) for (i = n - 1; i >= 0; i--) constrain(pts[i], pts[i + 1], seg);
    else for (i = 0; i < n; i++) constrain(pts[i], pts[i + 1], seg);
  }

  // The treat can never be farther from a pin than its rope is long.
  // (Ropes are weightless for the treat, like in the original game; the rope
  // points only follow it for the picture.)
  function leash(c, r) {
    var a = r.pts[0], dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
    if (d2 > r.len * r.len) {
      var f = r.len / Math.sqrt(d2);
      c.x = a.x + dx * f; c.y = a.y + dy * f;
    }
  }

  // Long-range attachment: rope point i can never be farther from the anchor
  // than i segments, so ropes do not look stretched.
  function tether(pts, seg) {
    var a = pts[0];
    for (var i = 2; i < pts.length; i++) {
      var p = pts[i];
      if (p.im === 0) continue;
      var dx = p.x - a.x, dy = p.y - a.y, max = i * seg, d2 = dx * dx + dy * dy;
      if (d2 > max * max) {
        var f = max / Math.sqrt(d2);
        p.x = a.x + dx * f; p.y = a.y + dy * f;
      }
    }
  }

  // Current ends of a spinning spike bar.
  function rotorEnds(r, t) {
    var a = r.a0 + r.speed * t, hx = Math.cos(a) * r.len / 2, hy = Math.sin(a) * r.len / 2;
    return [r.x - hx, r.y - hy, r.x + hx, r.y + hy];
  }

  function moveAnchor(p, mv, t) {
    var u = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / mv.period + mv.phase);
    p.x = mv.x1 + (mv.x2 - mv.x1) * u;
    p.y = mv.y1 + (mv.y2 - mv.y1) * u;
    p.px = p.x; p.py = p.y;
  }

  function makeRope(id, ax, ay, len, candy, mv) {
    var dx = candy.x - ax, dy = candy.y - ay, d = Math.sqrt(dx * dx + dy * dy);
    if (!(len > d)) len = d;
    var n = Math.max(3, Math.round(len / P.seg)), seg = len / n;
    var sag = len > d + 1 ? Math.sqrt(3 * Math.max(d, 1) * (len - d) / 8) : 0;
    var pts = [new Pt(ax, ay, 0)];
    for (var i = 1; i < n; i++) {
      var f = i / n;
      pts.push(new Pt(ax + dx * f, ay + dy * f + sag * 4 * f * (1 - f), 1));
    }
    pts.push(candy);
    return { id: id, pts: pts, seg: seg, len: len, mv: mv || null };
  }

  /* level: { candy:[x,y], frog:[x,y],
       ropes:[[ax,ay,len?, x2?,y2?,period?,phase?]], stars:[[x,y]], bubbles:[[x,y]],
       blowers:[[x,y,deg]], hooks:[[x,y,r]], pads:[[x1,y1,x2,y2]], spikes:[[x1,y1,x2,y2]],
       hats:[[ax,ay,bx,by]] (a pair of warp hats), rotors:[[x,y,length,degPerSec,startDeg]] (spinning spikes) }
     opts.fast skips everything that is only for the picture (rope points, cut
     leftovers). The treat moves exactly the same either way: it only feels a
     rope's pin and length, never the rope points. */
  function World(level, opts) {
    this.level = level;
    this.fast = !!(opts && opts.fast);
    this.t = 0;
    this.state = 'play';           // play | won | lost
    this.reason = '';
    this.events = [];
    this.log = [];
    this.got = 0;
    var c = this.candy = new Pt(level.candy[0], level.candy[1], 0);   // rope points never pull the treat
    c.bubble = -1; c.angle = 0;
    this.frog = { x: level.frog[0], y: level.frog[1] };
    this.ropes = [];
    this.pieces = [];
    var self = this;
    (level.ropes || []).forEach(function (r, i) {
      var mv = r[3] != null ? { x1: r[0], y1: r[1], x2: r[3], y2: r[4], period: r[5] || 3, phase: r[6] || 0 } : null;
      self.ropes.push(makeRope(String(i), r[0], r[1], r[2], c, mv));
    });
    this.stars = (level.stars || []).map(function (s) { return { x: s[0], y: s[1], got: false }; });
    this.bubbles = (level.bubbles || []).map(function (b) { return { x: b[0], y: b[1], state: 0 }; });
    this.blowers = (level.blowers || []).map(function (b) { return { x: b[0], y: b[1], dir: b[2] * Math.PI / 180, last: -9 }; });
    this.hooks = (level.hooks || []).map(function (h) { return { x: h[0], y: h[1], r: h[2], used: false }; });
    this.pads = (level.pads || []).map(function (p) { return { x1: p[0], y1: p[1], x2: p[2], y2: p[3], last: -9 }; });
    this.spikes = (level.spikes || []).map(function (s) { return { x1: s[0], y1: s[1], x2: s[2], y2: s[3] }; });
    this.hats = (level.hats || []).map(function (h) { return { ax: h[0], ay: h[1], bx: h[2], by: h[3], cool: -1 }; });
    this.rotors = (level.rotors || []).map(function (r) { return { x: r[0], y: r[1], len: r[2], speed: r[3] * Math.PI / 180, a0: (r[4] || 0) * Math.PI / 180 }; });
    // The treat waits until the child's first action, so how long they look
    // before starting never changes the outcome. Swinging starts and moving
    // pins set it off at once.
    this.held = !(level.live || this.ropes.some(function (r) { return r.mv; }));
    // a treat that starts inside a bubble is already floating in it
    for (var i = 0; i < this.bubbles.length; i++) {
      if (dist2(c.x, c.y, this.bubbles[i].x, this.bubbles[i].y) < sq(P.bubbleR)) { this.bubbles[i].state = 1; c.bubble = i; break; }
    }
    if (!this.fast) this.settle();
  }

  // Let the ropes hang naturally before the level starts (candy held still).
  World.prototype.settle = function () {
    var damp = P.dampRope;
    P.dampRope = 0.9;
    for (var k = 0; k < 240; k++) { this.integrateRopes(); this.solveRopes(); }
    P.dampRope = damp;
    this.ropes.forEach(function (r) { r.pts.forEach(function (p) { p.px = p.x; p.py = p.y; }); });
  };

  World.prototype.integrateRopes = function () {
    for (var i = 0; i < this.ropes.length; i++) {
      var pts = this.ropes[i].pts;
      for (var j = 1; j < pts.length - 1; j++) integrate(pts[j], P.gravity * P.ropeGravity, P.dampRope);
    }
  };

  World.prototype.solve = function () {
    var c = this.candy, n = this.ropes.length, i, k;
    for (k = 0; k < 8 && n > 0; k++) for (i = 0; i < n; i++) leash(c, this.ropes[i]);
    if (!this.fast) this.solveRopes();
  };

  World.prototype.solveRopes = function () {
    for (var k = 0; k < P.iter; k++) {
      for (var i = 0; i < this.ropes.length; i++) {
        var r = this.ropes[i];
        solveChain(r.pts, r.seg, k & 1);
        tether(r.pts, r.seg);
      }
    }
  };

  World.prototype.step = function () {
    this.t += DT;
    if (!this.fast) this.stepPieces();
    if (this.state !== 'play') return;
    var c = this.candy, i;
    for (i = 0; i < this.ropes.length; i++) if (this.ropes[i].mv) moveAnchor(this.ropes[i].pts[0], this.ropes[i].mv, this.t);
    if (this.held) return;   // everything rests until the first touch
    if (!this.fast) this.integrateRopes();
    var inBubble = c.bubble >= 0;
    integrate(c, inBubble ? -P.buoyancy : P.gravity, inBubble ? P.dampBubble : P.dampCandy);
    this.solve();
    c.angle += (c.x - c.px) / P.candyR * (inBubble ? 0.25 : 0.6);
    this.interact();
  };

  World.prototype.stepPieces = function () {
    for (var i = this.pieces.length - 1; i >= 0; i--) {
      var pc = this.pieces[i];
      pc.fade -= DT / 1.1;
      if (pc.fade <= 0) { this.pieces.splice(i, 1); continue; }
      var pts = pc.pts, n = pts.length, j;
      if (pc.mv) moveAnchor(pts[0], pc.mv, this.t);
      if (pc.follow && this.state === 'play') { pts[n - 1].x = this.candy.x; pts[n - 1].y = this.candy.y; }
      for (j = 0; j < n; j++) if (pts[j].im) integrate(pts[j], P.gravity, 0.99);
      for (j = 0; j < 6; j++) solveChain(pts, pc.seg, j & 1);
    }
  };

  World.prototype.interact = function () {
    var c = this.candy, i;
    for (i = 0; i < this.pads.length; i++) this.bounce(i);

    for (i = 0; i < this.stars.length; i++) {
      var s = this.stars[i];
      if (!s.got && dist2(c.x, c.y, s.x, s.y) < sq(P.starR + P.candyR - 2)) {
        s.got = true; this.got++;
        this.events.push({ type: 'star', i: i, n: this.got, x: s.x, y: s.y });
      }
    }

    if (c.bubble < 0) {
      for (i = 0; i < this.bubbles.length; i++) {
        var b = this.bubbles[i];
        if (b.state === 0 && dist2(c.x, c.y, b.x, b.y) < sq(P.bubbleR + 6)) {
          b.state = 1; c.bubble = i;
          c.px = c.x - (c.x - c.px) * 0.3; c.py = c.y - (c.y - c.py) * 0.3;
          this.events.push({ type: 'bubble', i: i, x: c.x, y: c.y });
          break;
        }
      }
    }

    for (i = 0; i < this.hooks.length; i++) {
      var h = this.hooks[i];
      if (!h.used && dist2(c.x, c.y, h.x, h.y) <= h.r * h.r) {
        h.used = true;
        var r = makeRope('h' + i, h.x, h.y, h.r, c, null);
        // new rope points start moving with the candy so the catch looks smooth
        var vx = c.x - c.px, vy = c.y - c.py, n = r.pts.length - 1;
        for (var j = 1; j < n; j++) { var p = r.pts[j]; p.px = p.x - vx * j / n; p.py = p.y - vy * j / n; }
        this.ropes.push(r);
        this.events.push({ type: 'hook', i: i, x: h.x, y: h.y });
      }
    }

    for (i = 0; i < this.hats.length; i++) this.warp(this.hats[i], i);

    for (i = 0; i < this.spikes.length; i++) {
      var k = this.spikes[i];
      if (segDist(c.x, c.y, k.x1, k.y1, k.x2, k.y2).d < P.candyR + P.spikeHalf - 3) return this.lose('spike');
    }
    for (i = 0; i < this.rotors.length; i++) {
      var e = rotorEnds(this.rotors[i], this.t);
      if (segDist(c.x, c.y, e[0], e[1], e[2], e[3]).d < P.candyR + P.spikeHalf - 3) return this.lose('spike');
    }

    if (dist2(c.x, c.y, this.frog.x, this.frog.y) < sq(P.eatR)) return this.win();
    if (c.y > H + 60 || c.x < -70 || c.x > W + 70) return this.lose('fall');
    if (c.y < -80) return this.lose('fly');
  };

  World.prototype.bounce = function (i) {
    var c = this.candy, pd = this.pads[i];
    var sp = segDist(c.x, c.y, pd.x1, pd.y1, pd.x2, pd.y2), min = P.candyR + P.padHalf;
    if (sp.d >= min) return;
    var nx, ny;
    if (sp.d > 1e-4) { nx = (c.x - sp.x) / sp.d; ny = (c.y - sp.y) / sp.d; }
    else { var ex = pd.x2 - pd.x1, ey = pd.y2 - pd.y1, el = Math.sqrt(ex * ex + ey * ey) || 1; nx = ey / el; ny = -ex / el; if (ny > 0) { nx = -nx; ny = -ny; } }
    var vx = (c.x - c.px) / DT, vy = (c.y - c.py) / DT, vn = vx * nx + vy * ny;
    c.x = sp.x + nx * min; c.y = sp.y + ny * min;
    if (vn < 0) {
      var out = Math.max(-vn * P.padRestitution, c.bubble >= 0 ? 250 : P.padBounce);
      vx += (out - vn) * nx; vy += (out - vn) * ny;
      pd.last = this.t;
      this.events.push({ type: 'bounce', i: i, x: c.x, y: c.y });
    }
    c.px = c.x - vx * DT; c.py = c.y - vy * DT;
  };

  // Warp hats: going into one hat brings the treat out of the other one, still
  // moving the same way. Ropes on the treat come off, a bubble stays.
  World.prototype.warp = function (h, i) {
    var c = this.candy, r2 = P.hatR * P.hatR;
    if (h.cool >= 0) {   // wait until the treat has left the hat it came out of
      var ox = h.cool ? h.bx : h.ax, oy = h.cool ? h.by : h.ay;
      if (dist2(c.x, c.y, ox, oy) > sq(P.hatR + 16)) h.cool = -1;
      return;
    }
    var inA = dist2(c.x, c.y, h.ax, h.ay) < r2, inB = !inA && dist2(c.x, c.y, h.bx, h.by) < r2;
    if (!inA && !inB) return;
    var fx = inA ? h.ax : h.bx, fy = inA ? h.ay : h.by, tx = inA ? h.bx : h.ax, ty = inA ? h.by : h.ay;
    var dx = tx - fx, dy = ty - fy;
    c.x += dx; c.y += dy; c.px += dx; c.py += dy;
    h.cool = inA ? 1 : 0;
    while (this.ropes.length) this.cutRope(this.ropes[0], Math.floor((this.ropes[0].pts.length - 1) / 2), true);
    this.events.push({ type: 'warp', i: i, x: fx, y: fy, x2: tx, y2: ty });
  };

  World.prototype.win = function () {
    this.state = 'won';
    this.events.push({ type: 'win', x: this.candy.x, y: this.candy.y });
  };

  World.prototype.lose = function (reason) {
    this.state = 'lost'; this.reason = reason;
    if (this.candy.bubble >= 0) { this.bubbles[this.candy.bubble].state = 2; }
    this.events.push({ type: 'lose', reason: reason, x: this.candy.x, y: this.candy.y });
  };

  World.prototype.ropeById = function (id) {
    for (var i = 0; i < this.ropes.length; i++) if (this.ropes[i].id === id) return this.ropes[i];
    return null;
  };

  World.prototype.cutRope = function (r, k, silent) {
    var idx = this.ropes.indexOf(r);
    if (idx < 0) return;
    this.held = false;
    this.ropes.splice(idx, 1);
    var pts = r.pts, n = pts.length - 1;
    k = Math.max(0, Math.min(n - 1, k));
    if (!this.fast) {
      if (k >= 1) this.pieces.push({ pts: pts.slice(0, k + 1), seg: r.seg, fade: 1, mv: r.mv, follow: false });
      if (k + 1 <= n - 1) {
        var tail = pts.slice(k + 1, n);
        tail.push(new Pt(this.candy.x, this.candy.y, 0));
        this.pieces.push({ pts: tail, seg: r.seg, fade: 1, mv: null, follow: true });
      }
    }
    this.events.push({ type: silent ? 'snap' : 'cut', id: r.id, x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 });
    if (!silent) this.log.push({ t: this.t, a: 'c' + r.id });
  };

  World.prototype.pop = function () {
    var c = this.candy;
    if (c.bubble < 0) return;
    this.held = false;
    this.bubbles[c.bubble].state = 2;
    c.bubble = -1;
    this.events.push({ type: 'pop', x: c.x, y: c.y });
    this.log.push({ t: this.t, a: 'p' });
  };

  World.prototype.puff = function (i) {
    var b = this.blowers[i], c = this.candy;
    b.last = this.t;
    this.held = false;
    this.events.push({ type: 'puff', i: i, x: b.x, y: b.y });
    this.log.push({ t: this.t, a: 'b' + i });
    var ux = Math.cos(b.dir), uy = Math.sin(b.dir), rx = c.x - b.x, ry = c.y - b.y;
    var along = rx * ux + ry * uy, side = Math.abs(ry * ux - rx * uy);
    if (along > -10 && along < P.blowRange && side < 60 + along * 0.35) {
      var k = P.blowPush * (1 - 0.5 * Math.max(0, along) / P.blowRange) * (c.bubble >= 0 ? 1 : 1.5);
      c.px -= ux * k * DT; c.py -= uy * k * DT;
    }
  };

  // --- player input (world coordinates) ---

  // Finger went down: bubbles and clouds react immediately.
  World.prototype.press = function (x, y) {
    if (this.state !== 'play') return null;
    var c = this.candy;
    if (c.bubble >= 0 && dist2(x, y, c.x, c.y) < sq(P.bubbleR + P.tapBubble)) { this.pop(); return 'pop'; }
    for (var i = 0; i < this.blowers.length; i++) {
      if (dist2(x, y, this.blowers[i].x, this.blowers[i].y) < sq(P.tapBlower)) { this.puff(i); return 'puff'; }
    }
    return null;
  };

  // Finger moved from (x1,y1) to (x2,y2): cut every rope it crosses.
  World.prototype.slice = function (x1, y1, x2, y2) {
    if (this.state !== 'play') return 0;
    var cut = 0;
    for (var r = this.ropes.length - 1; r >= 0; r--) {
      var rope = this.ropes[r], pts = rope.pts;
      for (var i = 0; i < pts.length - 1; i++) {
        if (segSeg(x1, y1, x2, y2, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= P.cutTol) {
          this.cutRope(rope, i); cut++; break;
        }
      }
    }
    return cut;
  };

  // A short tap: cut the rope nearest to the finger (easier for small hands).
  World.prototype.tapCut = function (x, y) {
    if (this.state !== 'play') return false;
    var best = null, bestK = 0, bestD = P.tapRope;
    for (var r = 0; r < this.ropes.length; r++) {
      var pts = this.ropes[r].pts;
      for (var i = 0; i < pts.length - 1; i++) {
        var d = segDist(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y).d;
        if (d < bestD) { bestD = d; best = this.ropes[r]; bestK = i; }
      }
    }
    if (!best) return false;
    this.cutRope(best, bestK);
    return true;
  };

  // Scripted action used by solutions, hints and the level tools:
  // "c0" cut rope 0, "ch1" cut the rope made by hook 1, "p" pop, "b0" puff cloud 0.
  World.prototype.act = function (a) {
    if (this.state !== 'play') return false;
    var kind = a.charAt(0), rest = a.slice(1);
    if (kind === 'c') {
      var r = this.ropeById(rest);
      if (!r) return false;
      this.cutRope(r, Math.floor((r.pts.length - 1) / 2));
      return true;
    }
    if (kind === 'p') { if (this.candy.bubble < 0) return false; this.pop(); return true; }
    if (kind === 'b') { if (!this.blowers[+rest]) return false; this.puff(+rest); return true; }
    return false;
  };

  World.prototype.clone = function () {
    var w = Object.create(World.prototype), c = this.candy, nc = copyPt(c);
    nc.bubble = c.bubble; nc.angle = c.angle;
    w.level = this.level; w.fast = true; w.t = this.t; w.state = this.state; w.reason = this.reason; w.held = this.held;
    w.events = []; w.log = this.log.slice(); w.got = this.got;
    w.candy = nc; w.frog = this.frog; w.pieces = [];
    w.ropes = this.ropes.map(function (r) {
      return { id: r.id, seg: r.seg, len: r.len, mv: r.mv, pts: r.pts.map(function (p) { return p === c ? nc : copyPt(p); }) };
    });
    w.stars = this.stars.map(function (s) { return { x: s.x, y: s.y, got: s.got }; });
    w.bubbles = this.bubbles.map(function (b) { return { x: b.x, y: b.y, state: b.state }; });
    w.blowers = this.blowers.map(function (b) { return { x: b.x, y: b.y, dir: b.dir, last: b.last }; });
    w.hooks = this.hooks.map(function (h) { return { x: h.x, y: h.y, r: h.r, used: h.used }; });
    w.pads = this.pads.map(function (p) { return { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, last: p.last }; });
    w.spikes = this.spikes;
    w.hats = this.hats.map(function (h) { return { ax: h.ax, ay: h.ay, bx: h.bx, by: h.by, cool: h.cool }; });
    w.rotors = this.rotors;
    return w;
  };

  // "c0@0.5 p@1.2 b1@2" -> [{t:0.5,a:'c0'}, ...]
  function parseSol(s) {
    if (!s) return [];
    return s.trim().split(/\s+/).map(function (tok) {
      var at = tok.lastIndexOf('@');
      return { a: tok.slice(0, at), t: parseFloat(tok.slice(at + 1)) };
    }).sort(function (a, b) { return a.t - b.t; });
  }

  // Play a level with scripted actions. Returns the outcome.
  function run(level, sol, maxT) {
    var w = new World(level, { fast: true }), acts = typeof sol === 'string' ? parseSol(sol) : sol, ai = 0;
    maxT = maxT || 12;
    while (w.state === 'play' && w.t < maxT) {
      while (ai < acts.length && acts[ai].t <= w.t + 1e-9) { w.act(acts[ai].a); ai++; }
      w.step();
    }
    return { state: w.state, stars: w.got, t: w.t, reason: w.reason, world: w };
  }

  return { W: W, H: H, DT: DT, P: P, World: World, run: run, parseSol: parseSol, segDist: segDist, rotorEnds: rotorEnds };
}));
