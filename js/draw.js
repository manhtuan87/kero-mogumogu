/* ケロちゃん もぐもぐ — drawing (canvas 2D, world pixels).
   Sticker style: every shape gets the same warm brown outline. */
var Draw = (function () {
  'use strict';
  var TAU = Math.PI * 2;
  var INK = '#5a3825';
  var GREEN = '#86d65c', BELLY = '#e9f9cf', CHEEK = '#ff9db6';

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
  function ellipse(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); }
  function paint(ctx, fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 3; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- frog

  function lilyPad(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.ellipse(0, 50, 68, 17, 0, 0.36 * Math.PI, 2.2 * Math.PI);
    ctx.closePath();
    paint(ctx, '#5dbb5f', '#2f7d3b', 3);
    ctx.strokeStyle = 'rgba(190,240,170,.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var i = 0; i < 5; i++) {
      var q = 0.55 * Math.PI + i * 0.3 * Math.PI;
      ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(Math.cos(q) * 50, 50 + Math.sin(q) * 12); ctx.stroke();
    }
  }

  function eyeOpen(ctx, x, y, lx, ly, k) {
    k = k || 1;
    circle(ctx, x, y, 12.5 * k); paint(ctx, '#fff', INK, 2.6);
    var px = x + lx * 4.2 * k, py = y + ly * 4.2 * k;
    circle(ctx, px, py, 6.8 * k); paint(ctx, '#2e1d14');
    circle(ctx, px - 2.3 * k, py - 2.5 * k, 2.5 * k); paint(ctx, '#fff');
    circle(ctx, px + 2.2 * k, py + 2.2 * k, 1.1 * k); paint(ctx, '#fff');
  }

  function eyeClosed(ctx, x, y, happy, fill, k) {
    k = k || 1;
    circle(ctx, x, y, 12.5 * k + 0.5); paint(ctx, fill || GREEN);
    ctx.beginPath();
    if (happy) { ctx.moveTo(x - 8 * k, y + 3 * k); ctx.quadraticCurveTo(x, y - 8 * k, x + 8 * k, y + 3 * k); }
    else { ctx.moveTo(x - 8 * k, y - k); ctx.quadraticCurveTo(x, y + 7 * k, x + 8 * k, y - k); }
    ctx.lineCap = 'round'; paint(ctx, null, INK, 3);
  }

  function bow(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.35);
    ellipse(ctx, -8, 0, 9, 6.5, -0.35); paint(ctx, '#ff7fb5', INK, 2.2);
    ellipse(ctx, 8, 0, 9, 6.5, 0.35); paint(ctx, '#ff7fb5', INK, 2.2);
    circle(ctx, 0, 0, 4); paint(ctx, '#ff5d9e', INK, 2.2);
    circle(ctx, -9, -2, 1.8); paint(ctx, 'rgba(255,255,255,.8)');
    ctx.restore();
  }

  var PERCH = [[-54, 62, 15], [-28, 70, 20], [4, 73, 21], [36, 69, 19], [60, 61, 14], [-2, 60, 18]];
  function cloudPerch(ctx) {
    ctx.lineJoin = 'round';
    PERCH.forEach(function (c) { circle(ctx, c[0], c[1], c[2]); paint(ctx, null, '#8fb9e0', 5); });
    PERCH.forEach(function (c) { circle(ctx, c[0], c[1], c[2]); paint(ctx, '#ffffff'); });
    ellipse(ctx, -30, 64, 10, 4, -0.2); paint(ctx, 'rgba(200,225,255,.8)');
  }

  // --- parts shared by every character (the mouth centre is the local origin)

  // Seat (cloud perch + lily pad or cushion) and the bouncy body transform.
  function pose(ctx, f, seat) {
    var t = f.t, mt = f.mt || 0, mode = f.mode || 'idle';
    ctx.translate(f.x, f.y);
    // slide the seat inward when the character sits near a screen edge
    var shift = Math.max(0, 72 - f.x) - Math.max(0, f.x + 72 - 360);
    ctx.save(); ctx.translate(shift, 0);
    if (f.perch) cloudPerch(ctx);
    ctx.translate(-shift * 0.4, 0);
    seat(ctx);
    ctx.restore();
    var hop = 0, sx = 1, sy = 1, breathe = Math.sin(t * 2.4) * 0.02;
    if (mode === 'happy') hop = -Math.abs(Math.sin(mt * 6.5)) * 13;
    if (mode === 'eat' && mt < 1) { var w = Math.sin(mt * 24) * 0.06 * (1 - mt); sx += w; sy -= w; }
    sx += breathe * 0.5; sy -= breathe;
    ctx.translate(0, 46 + hop); ctx.scale(sx, sy); ctx.translate(0, -46);
  }

  // Eyes follow the treat; they close when blinking, happy or chewing.
  function eyes(ctx, f, ex, ey, k, fills) {
    var mode = f.mode || 'idle', mt = f.mt || 0, lx = 0, ly = 0.2;
    if (mode === 'sad') { ly = 0.8; }
    else if (f.look) {
      var dx = f.look.x - f.x, dy = f.look.y - (f.y + ey), d = Math.sqrt(dx * dx + dy * dy) || 1;
      lx = dx / d; ly = dy / d;
    }
    if (mode === 'happy' || (mode === 'eat' && mt > 0.25)) { eyeClosed(ctx, -ex, ey, true, fills[0], k); eyeClosed(ctx, ex, ey, true, fills[1], k); }
    else if (f.blink) { eyeClosed(ctx, -ex, ey, false, fills[0], k); eyeClosed(ctx, ex, ey, false, fills[1], k); }
    else { eyeOpen(ctx, -ex, ey, lx, ly, k); eyeOpen(ctx, ex, ey, lx, ly, k); }
    if (mode === 'sad') {
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-ex - 8, ey - 18); ctx.lineTo(-ex + 6, ey - 14); paint(ctx, null, INK, 2.6);
      ctx.beginPath(); ctx.moveTo(ex + 8, ey - 18); ctx.lineTo(ex - 6, ey - 14); paint(ctx, null, INK, 2.6);
    }
  }

  function cheeks(ctx, f, cx, cy) {
    var puffed = f.mode === 'eat' && (f.mt || 0) < 1.1;
    ellipse(ctx, -cx, cy, puffed ? 11 : 8.5, puffed ? 7 : 5.5); paint(ctx, CHEEK);
    ellipse(ctx, cx, cy, puffed ? 11 : 8.5, puffed ? 7 : 5.5); paint(ctx, CHEEK);
  }

  // Mouth while chewing / sad / happy / wide open; `idle` draws the resting mouth.
  function mouth(ctx, f, y, idle) {
    var mode = f.mode || 'idle', mt = f.mt || 0, o = f.open || 0;
    ctx.lineCap = 'round';
    if (mode === 'eat' && mt < 1.1) {
      var chew = 0.5 + 0.5 * Math.sin(mt * 18);
      ellipse(ctx, 0, y + 5, 7 + 3 * chew, 2 + 4 * chew); paint(ctx, '#b0304f', INK, 2.4);
    } else if (mode === 'sad') {
      ctx.beginPath(); ctx.moveTo(-10, y + 9); ctx.quadraticCurveTo(0, y, 10, y + 9); paint(ctx, null, INK, 3);
    } else if (mode === 'happy') {
      ctx.beginPath(); ctx.moveTo(-14, y); ctx.quadraticCurveTo(0, y + 20, 14, y); ctx.closePath();
      paint(ctx, '#b0304f', INK, 2.6);
      ctx.save(); ctx.clip(); ellipse(ctx, 0, y + 12, 9, 5); paint(ctx, '#ff7ea0'); ctx.restore();
    } else if (o > 0.04) {
      var rx = 7 + 15 * o, ry = 3 + 13 * o;
      ellipse(ctx, 0, y + 6, rx, ry); paint(ctx, '#b0304f', INK, 2.6);
      ctx.save(); ellipse(ctx, 0, y + 6, rx - 1, ry - 1); ctx.clip();
      ellipse(ctx, 0, y + 6 + ry * 0.75, rx * 0.6, ry * 0.5); paint(ctx, '#ff7ea0');
      ctx.restore();
    } else idle();
  }

  function tears(ctx, f, ex) {
    if (f.mode !== 'sad') return;
    for (var s = -1; s <= 1; s += 2) {
      var ty = f.y - 8 + (((f.mt || 0) * 40 + (s + 1) * 9) % 26);
      teardrop(ctx, f.x + s * ex, ty, 4.5);
    }
  }

  /* f = { x, y, t, look:{x,y}|null, open:0..1, mode:'idle'|'eat'|'happy'|'sad', mt, blink, perch, kind } */
  function frog(ctx, f) {
    ctx.save();
    pose(ctx, f, lilyPad);
    // body silhouette: outline all parts first, then fill, so they merge
    var parts = [[0, 14, 45, 36], [-20, -20, 17, 17], [20, -20, 17, 17], [-28, 43, 15, 7], [28, 43, 15, 7]];
    ctx.lineJoin = 'round';
    parts.forEach(function (p) { ellipse(ctx, p[0], p[1], p[2], p[3]); paint(ctx, null, INK, 6); });
    parts.forEach(function (p) { ellipse(ctx, p[0], p[1], p[2], p[3]); paint(ctx, GREEN); });
    ellipse(ctx, 0, 24, 29, 21); paint(ctx, BELLY);
    // little hands on the tummy
    ellipse(ctx, -30, 26, 8, 11, 0.35); paint(ctx, GREEN, INK, 2.4);
    ellipse(ctx, 30, 26, 8, 11, -0.35); paint(ctx, GREEN, INK, 2.4);
    // spots
    circle(ctx, -33, 2, 3.2); paint(ctx, 'rgba(70,160,50,.35)');
    circle(ctx, 36, 8, 2.4); paint(ctx, 'rgba(70,160,50,.35)');
    eyes(ctx, f, 20, -22, 1, [GREEN, GREEN]);
    bow(ctx, 30, -38);
    cheeks(ctx, f, 31, 4);
    mouth(ctx, f, 0, function () {
      ctx.beginPath(); ctx.moveTo(-12, 1); ctx.quadraticCurveTo(0, 12, 12, 1); paint(ctx, null, INK, 3);
    });
    ctx.restore();
    tears(ctx, f, 22);
  }

  // --- friends from the shop: ミミちゃん (rabbit), ニャーちゃん (cat), ワンちゃん (dog)

  var FRIENDS = {
    rabbit: { body: '#fffaf6', belly: '#ffeef3', inner: '#ffb6ca', seat: '#ffc9dc', seat2: '#ff8fb8', nose: '#ff8fae' },
    cat: { body: '#ffcf8f', belly: '#fff3dd', inner: '#ffb3a7', stripe: '#ec9a4a', seat: '#ddd0ff', seat2: '#a98bf0', nose: '#ff8fa3' },
    dog: { body: '#f5d6ad', belly: '#fff6e9', ear: '#b88456', patch: '#e6b884', seat: '#c7e7ff', seat2: '#7cc0f0', nose: '#3a2618' }
  };

  function cushion(ctx, sp) {
    ellipse(ctx, 0, 52, 64, 15); paint(ctx, sp.seat, INK, 3);
    ellipse(ctx, -4, 48, 46, 7); paint(ctx, 'rgba(255,255,255,.45)');
    circle(ctx, -62, 56, 4.5); paint(ctx, sp.seat2, INK, 2);
    circle(ctx, 62, 56, 4.5); paint(ctx, sp.seat2, INK, 2);
  }

  function buddy(ctx, f, kind) {
    var sp = FRIENDS[kind], t = f.t, mode = f.mode || 'idle', i, k;
    var excited = mode === 'happy' || (f.open || 0) > 0.3;
    ctx.save();
    pose(ctx, f, function (c) { cushion(c, sp); });
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // tails peek out from behind
    if (kind === 'cat') {
      ctx.save(); ctx.translate(36, 40); ctx.rotate(Math.sin(t * 2.2) * 0.18);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(26, 2, 34, -22, 22, -40);
      paint(ctx, null, INK, 14); paint(ctx, null, sp.body, 8.5);
      ctx.beginPath(); ctx.moveTo(28, -28); ctx.quadraticCurveTo(27, -35, 22, -40);
      paint(ctx, null, sp.stripe, 8.5);
      ctx.restore();
    } else if (kind === 'dog') {
      ctx.save(); ctx.translate(38, 36); ctx.rotate(-0.5 + Math.sin(t * (excited ? 16 : 5)) * 0.35);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(18, -6, 20, -24);
      paint(ctx, null, INK, 13); paint(ctx, null, sp.body, 7.5);
      ctx.restore();
    }
    // ears behind the head
    if (kind === 'rabbit') {
      for (i = -1; i <= 1; i += 2) {
        ctx.save(); ctx.translate(i * 15, -26); ctx.rotate(i * 0.16 + (i > 0 ? Math.sin(t * 1.6) * 0.06 : 0));
        ellipse(ctx, 0, -30, 11.5, 31); paint(ctx, sp.body, INK, 3);
        ellipse(ctx, 0, -27, 5.5, 21); paint(ctx, sp.inner);
        ctx.restore();
      }
    } else if (kind === 'cat') {
      for (i = -1; i <= 1; i += 2) {
        ctx.beginPath(); ctx.moveTo(i * 12, -28); ctx.lineTo(i * 33, -60); ctx.lineTo(i * 44, -16); ctx.closePath();
        paint(ctx, sp.body, INK, 3);
        ctx.beginPath(); ctx.moveTo(i * 19, -28); ctx.lineTo(i * 32, -50); ctx.lineTo(i * 38, -24); ctx.closePath();
        paint(ctx, sp.inner);
      }
    }
    // round body: head and body in one, like a daifuku
    ellipse(ctx, 0, 10, 46, 42); paint(ctx, sp.body, INK, 3.2);
    ellipse(ctx, 0, 30, 28, 18); paint(ctx, sp.belly);
    if (kind === 'cat') {
      [[-7, -31, -5, -22], [0, -33, 0, -23], [7, -31, 5, -22]].forEach(function (l) {
        ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); paint(ctx, null, sp.stripe, 3.2);
      });
    }
    if (kind === 'dog') { ellipse(ctx, 17, -11, 13, 11.5, 0.2); paint(ctx, sp.patch); }
    // paws
    ellipse(ctx, -30, 32, 8.5, 10, 0.3); paint(ctx, sp.body, INK, 2.4);
    ellipse(ctx, 30, 32, 8.5, 10, -0.3); paint(ctx, sp.body, INK, 2.4);
    // the dog's floppy ears hang in front
    if (kind === 'dog') {
      for (i = -1; i <= 1; i += 2) {
        ctx.save(); ctx.translate(i * 38, -22); ctx.rotate(-i * 0.35 + i * Math.sin(t * 3) * 0.05);
        ellipse(ctx, 0, 14, 11, 21); paint(ctx, sp.ear, INK, 3);
        ctx.restore();
      }
    }
    eyes(ctx, f, 17, -10, 0.85, [sp.body, kind === 'dog' ? sp.patch : sp.body]);
    cheeks(ctx, f, 29, 7);
    // nose
    if (kind === 'dog') {
      ellipse(ctx, 0, -1, 6.5, 5); paint(ctx, sp.nose);
      ellipse(ctx, -2, -2.6, 2, 1.2); paint(ctx, 'rgba(255,255,255,.7)');
    } else {
      ctx.beginPath(); ctx.moveTo(-4.5, -3); ctx.lineTo(4.5, -3); ctx.lineTo(0, 2); ctx.closePath();
      paint(ctx, sp.nose, INK, 1.6);
    }
    mouth(ctx, f, 4, function () {
      ctx.beginPath(); ctx.moveTo(-9, 5); ctx.quadraticCurveTo(-4.5, 11, 0, 6); ctx.quadraticCurveTo(4.5, 11, 9, 5);
      paint(ctx, null, INK, 2.6);
      if (kind === 'dog') { ellipse(ctx, 0, 12, 4.5, 5.5); paint(ctx, '#ff7ea0', INK, 2); }
    });
    if (kind === 'cat') {
      ctx.strokeStyle = 'rgba(90,56,37,.75)'; ctx.lineWidth = 1.6;
      for (i = -1; i <= 1; i += 2) {
        for (k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(i * 23, 4 + k * 4); ctx.lineTo(i * 43, 2 + k * 7); ctx.stroke(); }
      }
    }
    ctx.restore();
    tears(ctx, f, 17);
  }

  function critter(ctx, f) {
    if (FRIENDS[f.kind]) buddy(ctx, f, f.kind);
    else frog(ctx, f);
  }

  function teardrop(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.8);
    ctx.quadraticCurveTo(x + r * 1.2, y, x, y + r);
    ctx.quadraticCurveTo(x - r * 1.2, y, x, y - r * 1.8);
    paint(ctx, '#8fd3ff', '#3f8fc9', 1.6);
  }

  // ---------------------------------------------------------------- treats

  function candy(ctx, r) {
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(s * r * 0.7, 0);
      ctx.lineTo(s * r * 1.72, -r * 0.74);
      ctx.quadraticCurveTo(s * r * 1.42, 0, s * r * 1.72, r * 0.74);
      ctx.closePath();
      ctx.lineJoin = 'round';
      paint(ctx, '#ffe27a', INK, 2.4);
      ctx.beginPath(); ctx.moveTo(s * r * 1.05, -r * 0.2); ctx.lineTo(s * r * 1.4, -r * 0.4);
      paint(ctx, null, 'rgba(90,56,37,.35)', 1.6);
    }
    circle(ctx, 0, 0, r); paint(ctx, '#ff6fa8', INK, 2.6);
    ctx.save(); circle(ctx, 0, 0, r - 1.4); ctx.clip();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.3; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var q = i * TAU / 3;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(q + 0.9) * r * 0.95, Math.sin(q + 0.9) * r * 0.95, Math.cos(q + 0.15) * r * 1.3, Math.sin(q + 0.15) * r * 1.3);
      ctx.stroke();
    }
    ctx.restore();
    circle(ctx, 0, 0, r * 0.2); paint(ctx, '#ff6fa8');
    ellipse(ctx, -r * 0.38, -r * 0.44, r * 0.27, r * 0.14, -0.7); paint(ctx, 'rgba(255,255,255,.9)');
  }

  var SEEDS = [[-0.45, -0.28], [0, -0.4], [0.45, -0.28], [-0.62, 0.12], [-0.2, 0.06], [0.22, 0.06], [0.62, 0.12], [-0.36, 0.48], [0.06, 0.46], [0.4, 0.48], [0, 0.82]];
  function strawberry(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(0, r * 1.15);
    ctx.bezierCurveTo(-r * 0.95, r * 0.75, -r * 1.22, -r * 0.3, -r * 0.62, -r * 0.74);
    ctx.quadraticCurveTo(0, -r * 1.02, r * 0.62, -r * 0.74);
    ctx.bezierCurveTo(r * 1.22, -r * 0.3, r * 0.95, r * 0.75, 0, r * 1.15);
    ctx.closePath();
    paint(ctx, '#ff4f6f', INK, 2.6);
    ctx.fillStyle = '#ffe98f';
    SEEDS.forEach(function (s) { ellipse(ctx, s[0] * r, s[1] * r, r * 0.065, r * 0.11); ctx.fill(); });
    ellipse(ctx, -r * 0.42, -r * 0.3, r * 0.2, r * 0.12, -0.8); paint(ctx, 'rgba(255,255,255,.75)');
    // leaves
    var dirs = [2.75, 2.1, 1.57, 1.04, 0.39];
    dirs.forEach(function (q) {
      ellipse(ctx, Math.cos(q) * r * 0.34, -r * 0.8 + Math.sin(q) * r * 0.2, r * 0.36, r * 0.14, q);
      paint(ctx, '#64c85a', INK, 2);
    });
    ctx.beginPath(); ctx.moveTo(0, -r * 0.82); ctx.quadraticCurveTo(r * 0.05, -r * 1.1, r * 0.22, -r * 1.25);
    ctx.lineCap = 'round'; paint(ctx, null, '#3d8a39', 3.2);
  }

  var SPRINKLES = ['#ffffff', '#7fd3ff', '#ffe066', '#8ff08f', '#c79cff', '#ffffff', '#7fd3ff', '#ffe066', '#8ff08f', '#c79cff'];
  function donut(ctx, r) {
    var R = r * 1.08, h = r * 0.36;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.moveTo(h, 0); ctx.arc(0, 0, h, 0, TAU, true);
    paint(ctx, '#f1b46e', INK, 2.6);
    ctx.beginPath();
    for (var i = 0; i <= 48; i++) {
      var q = i / 48 * TAU, rr = R * 0.84 + Math.sin(q * 7) * R * 0.07;
      if (i) ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); else ctx.moveTo(rr, 0);
    }
    ctx.closePath();
    ctx.moveTo(h * 1.3, 0); ctx.arc(0, 0, h * 1.3, 0, TAU, true);
    paint(ctx, '#ff8fc6');
    circle(ctx, 0, 0, h); paint(ctx, null, INK, 2.4);
    ctx.lineCap = 'round'; ctx.lineWidth = 2.4;
    for (var k = 0; k < SPRINKLES.length; k++) {
      var a = k * 0.63 + 0.2, rad = h * 1.55 + (k % 3) * R * 0.1;
      var x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      ctx.strokeStyle = SPRINKLES[k];
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a * 3) * 2.5, y - Math.sin(a * 3) * 2.5); ctx.lineTo(x + Math.cos(a * 3) * 2.5, y + Math.sin(a * 3) * 2.5); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 3.5, 4.3); paint(ctx, null, 'rgba(255,255,255,.7)', 3);
  }

  var CHIPS = [[-0.45, -0.38, 0.17], [0.3, -0.48, 0.14], [0.52, 0.12, 0.16], [-0.08, 0.05, 0.13], [-0.52, 0.38, 0.14], [0.14, 0.55, 0.15]];
  function cookie(ctx, r) {
    ctx.beginPath();
    for (var i = 0; i <= 40; i++) {
      var q = i / 40 * TAU, rr = r * 1.06 * (1 + 0.035 * Math.sin(q * 9));
      if (i) ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); else ctx.moveTo(rr, 0);
    }
    ctx.closePath();
    paint(ctx, '#e8b26c', INK, 2.6);
    circle(ctx, -r * 0.12, -r * 0.12, r * 0.72); paint(ctx, 'rgba(255,232,178,.5)');
    CHIPS.forEach(function (c) {
      ellipse(ctx, c[0] * r, c[1] * r, c[2] * r * 1.15, c[2] * r * 0.9, c[0] * 2); paint(ctx, '#6b3b22');
      circle(ctx, c[0] * r - 1, c[1] * r - 1, 1.1); paint(ctx, 'rgba(255,255,255,.5)');
    });
  }

  function food(ctx, kind, x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a || 0);
    if (kind === 'strawberry') strawberry(ctx, r);
    else if (kind === 'donut') donut(ctx, r);
    else if (kind === 'cookie') cookie(ctx, r);
    else candy(ctx, r);
    ctx.restore();
  }

  // ---------------------------------------------------------------- level objects

  function tracePath(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  function rope(ctx, pts, alpha) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : Math.max(0, alpha);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    tracePath(ctx, pts);
    ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.stroke();
    ctx.strokeStyle = '#f3c58c'; ctx.lineWidth = 3.8; ctx.stroke();
    ctx.setLineDash([4, 5]); ctx.strokeStyle = '#d58f52'; ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }

  function pin(ctx, x, y, color) {
    circle(ctx, x, y + 2, 8.5); paint(ctx, 'rgba(60,30,10,.15)');
    circle(ctx, x, y, 8.5); paint(ctx, color || '#ff8fba', INK, 2.6);
    circle(ctx, x - 2.6, y - 2.6, 2.6); paint(ctx, 'rgba(255,255,255,.9)');
  }

  function rail(ctx, mv) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mv.x1, mv.y1); ctx.lineTo(mv.x2, mv.y2);
    ctx.strokeStyle = 'rgba(90,56,37,.28)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.setLineDash([2, 9]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
    circle(ctx, mv.x1, mv.y1, 5); paint(ctx, 'rgba(90,56,37,.35)');
    circle(ctx, mv.x2, mv.y2, 5); paint(ctx, 'rgba(90,56,37,.35)');
    ctx.restore();
  }

  function starPath(ctx, R, r) {
    ctx.beginPath();
    for (var k = 0; k < 10; k++) {
      var q = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r : R;
      if (k) ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); else ctx.moveTo(Math.cos(q) * rr, Math.sin(q) * rr);
    }
    ctx.closePath();
  }

  function star(ctx, x, y, t, i, scale) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2.6 + i * 1.7) * 3);
    ctx.rotate(Math.sin(t * 1.8 + i) * 0.12);
    ctx.scale(scale || 1, scale || 1);
    circle(ctx, 0, 0, 23 + Math.sin(t * 4 + i) * 1.5); paint(ctx, 'rgba(255,245,160,.4)');
    ctx.lineJoin = 'round';
    starPath(ctx, 18, 9.5); paint(ctx, '#ffd93d', '#dc8f00', 3.2);
    starPath(ctx, 11, 6); paint(ctx, 'rgba(255,240,150,.7)');
    circle(ctx, -4.3, -1.5, 1.9); paint(ctx, INK);
    circle(ctx, 4.3, -1.5, 1.9); paint(ctx, INK);
    ctx.beginPath(); ctx.arc(0, 1.2, 2.6, 0.2, Math.PI - 0.2); ctx.lineCap = 'round'; paint(ctx, null, INK, 1.5);
    ellipse(ctx, -7.5, 2.5, 2.4, 1.5); paint(ctx, 'rgba(255,140,160,.7)');
    ellipse(ctx, 7.5, 2.5, 2.4, 1.5); paint(ctx, 'rgba(255,140,160,.7)');
    ctx.restore();
  }

  function bubble(ctx, x, y, r, t) {
    var w = Math.sin(t * 5) * 0.035;
    ctx.save(); ctx.translate(x, y); ctx.scale(1 + w, 1 - w);
    circle(ctx, 0, 0, r);
    var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.12)');
    g.addColorStop(0.75, 'rgba(170,220,255,.22)');
    g.addColorStop(1, 'rgba(120,190,255,.5)');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, r - 5, 0.35, 1.25); paint(ctx, null, 'rgba(255,150,215,.65)', 3);
    ctx.beginPath(); ctx.arc(0, 0, r - 5, 1.45, 2.1); paint(ctx, null, 'rgba(130,215,255,.75)', 3);
    ellipse(ctx, -r * 0.42, -r * 0.46, r * 0.23, r * 0.12, -0.7); paint(ctx, 'rgba(255,255,255,.95)');
    circle(ctx, -r * 0.12, -r * 0.64, r * 0.06); paint(ctx, '#fff');
    ctx.restore();
  }

  var CLOUD = [[-15, 2, 15], [0, -8, 16], [15, 1, 14], [-6, 10, 13], [9, 11, 12]];
  function blower(ctx, b, t) {
    var since = t - b.last, puff = since >= 0 && since < 0.4 ? Math.sin(since / 0.4 * Math.PI) : 0;
    var ux = Math.cos(b.dir), uy = Math.sin(b.dir);
    // direction chevrons (always visible so children know where the wind goes)
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.dir);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (var k = 0; k < 3; k++) {
      var ph = ((t * 1.2 + k / 3) % 1), x = 34 + ph * 30;
      ctx.globalAlpha = 0.85 * (1 - ph);
      ctx.beginPath(); ctx.moveTo(x - 5, -7); ctx.lineTo(x + 2, 0); ctx.lineTo(x - 5, 7);
      paint(ctx, null, 'rgba(90,56,37,.45)', 7);
      paint(ctx, null, '#ffffff', 4);
    }
    ctx.restore();
    ctx.save(); ctx.translate(b.x, b.y);
    var s = 1 + puff * 0.12;
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    CLOUD.forEach(function (c) { circle(ctx, c[0], c[1], c[2]); paint(ctx, null, INK, 6); });
    CLOUD.forEach(function (c) { circle(ctx, c[0], c[1], c[2]); paint(ctx, '#ffffff'); });
    ellipse(ctx, -8, -12, 6, 3, -0.4); paint(ctx, 'rgba(200,230,255,.8)');
    // face looks toward the wind direction
    var fx = ux * 4, fy = uy * 3;
    if (puff > 0.05) {
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-9 + fx, 0 + fy); ctx.lineTo(-4 + fx, 2 + fy); ctx.lineTo(-9 + fx, 4 + fy); paint(ctx, null, INK, 2.2);
      ctx.beginPath(); ctx.moveTo(9 + fx, 0 + fy); ctx.lineTo(4 + fx, 2 + fy); ctx.lineTo(9 + fx, 4 + fy); paint(ctx, null, INK, 2.2);
    } else {
      circle(ctx, -6 + fx, 1 + fy, 2.4); paint(ctx, INK);
      circle(ctx, 6 + fx, 1 + fy, 2.4); paint(ctx, INK);
    }
    ellipse(ctx, -12 + fx, 7 + fy, 4 + puff * 2, 2.6 + puff); paint(ctx, CHEEK);
    ellipse(ctx, 12 + fx, 7 + fy, 4 + puff * 2, 2.6 + puff); paint(ctx, CHEEK);
    var mx = ux * 13, my = uy * 11 + 7;
    ellipse(ctx, mx, my, 2.4 + puff * 2.4, 2.4 + puff * 2.4); paint(ctx, '#b0304f', INK, 1.8);
    ctx.restore();
  }

  function hook(ctx, h, t) {
    if (!h.used) {
      circle(ctx, h.x, h.y, h.r); paint(ctx, 'rgba(255,255,255,.13)');
      ctx.save(); ctx.setLineDash([7, 8]); ctx.lineDashOffset = -t * 16;
      circle(ctx, h.x, h.y, h.r); paint(ctx, null, 'rgba(255,255,255,.9)', 2.6);
      ctx.restore();
    }
    pin(ctx, h.x, h.y, '#ffc94d');
  }

  function jelly(ctx, p, t) {
    var x1 = p.x1, y1 = p.y1, x2 = p.x2, y2 = p.y2;
    if (x2 < x1) { x1 = p.x2; y1 = p.y2; x2 = p.x1; y2 = p.y1; }
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy);
    var since = t - p.last, wob = since >= 0 && since < 0.6 ? Math.exp(-since * 7) * Math.cos(since * 32) : 0;
    ctx.save(); ctx.translate((x1 + x2) / 2, (y1 + y2) / 2); ctx.rotate(Math.atan2(dy, dx));
    var hw = L / 2 + 8 + wob * 5, hh = 11 - wob * 4;
    roundRect(ctx, -hw, -hh, hw * 2, hh * 2, hh); paint(ctx, '#ff9fd0', INK, 2.6);
    roundRect(ctx, -hw + 6, -hh + 3, hw * 2 - 12, hh * 0.7, hh * 0.35); paint(ctx, 'rgba(255,255,255,.5)');
    var happy = since >= 0 && since < 0.7;
    ctx.lineCap = 'round';
    if (happy) {
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-5, 2.5); ctx.lineTo(-9, 5); paint(ctx, null, INK, 2);
      ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(5, 2.5); ctx.lineTo(9, 5); paint(ctx, null, INK, 2);
    } else {
      circle(ctx, -7, 2, 2); paint(ctx, INK);
      circle(ctx, 7, 2, 2); paint(ctx, INK);
    }
    ctx.beginPath(); ctx.arc(0, 4, 3, 0.2, Math.PI - 0.2); paint(ctx, null, INK, 1.8);
    ctx.restore();
  }

  // Warp hats: a magician's hat standing upside down; hats of the same colour are a pair.
  var HAT_COLORS = [['#a58bff', '#6f53d9'], ['#57c9cf', '#2e8f95'], ['#ffa46e', '#d9723c']];
  function hat(ctx, x, y, t, pair) {
    var col = HAT_COLORS[pair % HAT_COLORS.length];
    ctx.save(); ctx.translate(x, y);
    ctx.lineJoin = 'round';
    // crown under the brim
    ctx.beginPath();
    ctx.moveTo(-19, 2); ctx.lineTo(-16, 26); ctx.quadraticCurveTo(0, 32, 16, 26); ctx.lineTo(19, 2); ctx.closePath();
    paint(ctx, col[1], INK, 3);
    roundRect(ctx, -18, 9, 36, 8, 3); paint(ctx, col[0]);
    D_star(ctx, 0, 13, 4.5);
    // brim and the swirling opening
    ellipse(ctx, 0, 0, 29, 10); paint(ctx, col[0], INK, 3);
    ellipse(ctx, 0, -1, 21, 6.5); paint(ctx, '#2b1d40');
    ctx.save(); ellipse(ctx, 0, -1, 20, 6); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    for (var k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(0, -1, 17 - k * 5.5, 5 - k * 1.5, 0, t * 3.5 + k * 2, t * 3.5 + k * 2 + 3.6); ctx.stroke();
    }
    ctx.restore();
    // twinkles
    for (var j = 0; j < 3; j++) {
      var ph = (t * 0.8 + j / 3) % 1, a = j * 2.1 + t * 0.6;
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      sparkle(ctx, Math.cos(a) * 30, -10 - ph * 22, 3.5, '#fff7b0');
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function D_star(ctx, x, y, r) {
    ctx.save(); ctx.translate(x, y); starPath(ctx, r, r * 0.5); paint(ctx, '#ffe066'); ctx.restore();
  }

  // Spinning spike bar with a bolt in the middle.
  function rotor(ctx, e, cx, cy) {
    spikes(ctx, { x1: e[0], y1: e[1], x2: e[2], y2: e[3] });
    circle(ctx, cx, cy, 9); paint(ctx, '#ffd35c', INK, 2.6);
    ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4);
    ctx.lineCap = 'round'; paint(ctx, null, INK, 2);
  }

  function spikes(ctx, s) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = Math.sqrt(dx * dx + dy * dy);
    ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(Math.atan2(dy, dx));
    var n = Math.max(2, Math.round(L / 13)), st = L / n, i;
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (i = 0; i < n; i++) { ctx.lineTo(i * st + st / 2, -11); ctx.lineTo((i + 1) * st, 0); }
    for (i = n; i > 0; i--) { ctx.lineTo(i * st - st / 2, 11); ctx.lineTo((i - 1) * st, 0); }
    ctx.closePath(); ctx.lineJoin = 'round';
    paint(ctx, '#c5b3f0', '#5b418f', 2.4);
    roundRect(ctx, -4, -4, L + 8, 8, 4); paint(ctx, '#8f73d6', '#5b418f', 2);
    ctx.restore();
  }

  // ---------------------------------------------------------------- effects

  function heart(ctx, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 10, s / 10);
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-12, -1, -7, -12, 0, -5);
    ctx.bezierCurveTo(7, -12, 12, -1, 0, 7);
    ctx.closePath();
    ctx.restore();
    paint(ctx, color || '#ff6f9f', INK, 1.8);
  }

  function sparkle(ctx, x, y, s, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    paint(ctx, color || '#fff6a8');
  }

  function hand(ctx, x, y, scale, press) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.rotate(-0.35);
    ctx.lineJoin = 'round';
    var dy = press ? 3 : 0;
    // finger points at (0,0)
    roundRect(ctx, -5.5, -2 + dy, 11, 30, 5.5); paint(ctx, '#fff', INK, 2.4);
    roundRect(ctx, -13, 18 + dy, 30, 26, 11); paint(ctx, '#fff', INK, 2.4);
    roundRect(ctx, -5.5, -2 + dy, 11, 26, 5.5); paint(ctx, '#fff');
    ctx.beginPath(); ctx.moveTo(-1, 30 + dy); ctx.lineTo(-1, 36 + dy); ctx.moveTo(6, 30 + dy); ctx.lineTo(6, 36 + dy);
    ctx.lineCap = 'round'; paint(ctx, null, 'rgba(90,56,37,.5)', 1.8);
    ctx.restore();
  }

  // ---------------------------------------------------------------- backgrounds

  var THEMES = [
    { sky: ['#9fdcff', '#e6f7ff'], hill: ['#a4e384', '#83cf66'], deco: 'clouds' },
    { sky: ['#ffc4db', '#fff1f7'], hill: ['#b4e79a', '#8fd476'], deco: 'hearts' },
    { sky: ['#c9b6ff', '#f4efff'], hill: ['#ffd3ea', '#f7b3d7'], deco: 'sprinkles' },
    { sky: ['#ffd7a3', '#fff5e4'], hill: ['#d4ad74', '#bb9157'], deco: 'trees' },
    { sky: ['#aef0dd', '#f1fffb'], hill: ['#a9e8cd', '#86d8b6'], deco: 'rainbow' }
  ];

  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  // Draws in world coordinates; (x0,y0,x1,y1) is the visible area (may extend past 0..W/0..H).
  function background(ctx, theme, x0, y0, x1, y1) {
    var th = THEMES[theme] || THEMES[0], r = rnd(7 + theme * 13), i;
    var g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    var w = x1 - x0;
    if (th.deco === 'rainbow') {
      var cols = ['#ffb3c7', '#ffd59e', '#fff3a3', '#bff0b0', '#b3dcff', '#d7c2ff'];
      ctx.lineWidth = 14;
      cols.forEach(function (c, k) { ctx.beginPath(); ctx.arc(180, 330, 250 - k * 14, Math.PI, 0); ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < 14; i++) {
      var x = x0 + r() * w, y = y0 + r() * (y1 - y0) * 0.8, s = 0.6 + r() * 0.8;
      if (th.deco === 'clouds' || th.deco === 'rainbow') {
        if (i > 6) continue;
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ellipse(ctx, x, y, 30 * s, 14 * s); ctx.fill();
        ellipse(ctx, x - 18 * s, y + 4 * s, 18 * s, 10 * s); ctx.fill();
        ellipse(ctx, x + 20 * s, y + 3 * s, 20 * s, 11 * s); ctx.fill();
      } else if (th.deco === 'hearts') {
        ctx.save(); ctx.globalAlpha = 0.35; heartPlain(ctx, x, y, 9 * s, '#ffffff'); ctx.restore();
      } else if (th.deco === 'sprinkles') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 3);
        ctx.fillStyle = ['rgba(255,255,255,.7)', 'rgba(255,190,225,.8)', 'rgba(170,220,255,.8)', 'rgba(255,240,160,.8)'][i % 4];
        roundRect(ctx, -9 * s, -2.6, 18 * s, 5.2, 2.6); ctx.fill(); ctx.restore();
      } else if (th.deco === 'trees') {
        if (i > 7) continue;
        var ty = y1 - 70 - r() * 60;
        ctx.fillStyle = 'rgba(160,110,60,.25)';
        roundRect(ctx, x - 4 * s, ty, 8 * s, 50 * s, 3); ctx.fill();
        ctx.fillStyle = 'rgba(120,170,80,.28)';
        circle(ctx, x, ty - 6 * s, 26 * s); ctx.fill();
        circle(ctx, x - 16 * s, ty + 6 * s, 17 * s); ctx.fill();
        circle(ctx, x + 16 * s, ty + 6 * s, 17 * s); ctx.fill();
      }
    }
    // hills at the bottom
    var hy = Math.max(600, y1 - 60);
    ctx.fillStyle = th.hill[0];
    ellipse(ctx, x0 + w * 0.2, hy + 30, w * 0.55, 70); ctx.fill();
    ctx.fillStyle = th.hill[1];
    ellipse(ctx, x0 + w * 0.85, hy + 40, w * 0.6, 70); ctx.fill();
    ctx.fillRect(x0, hy + 40, w, y1 - hy);
  }

  function heartPlain(ctx, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 10, s / 10);
    ctx.beginPath(); ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-12, -1, -7, -12, 0, -5);
    ctx.bezierCurveTo(7, -12, 12, -1, 0, 7);
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  return {
    INK: INK, THEMES: THEMES,
    circle: circle, ellipse: ellipse, paint: paint, roundRect: roundRect,
    frog: frog, critter: critter, food: food, rope: rope, pin: pin, rail: rail, star: star, starPath: starPath,
    bubble: bubble, blower: blower, hook: hook, jelly: jelly, spikes: spikes, hat: hat, rotor: rotor,
    heart: heart, sparkle: sparkle, hand: hand, background: background, teardrop: teardrop
  };
}());
