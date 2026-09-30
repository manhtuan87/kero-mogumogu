/* ケロちゃん もぐもぐ — screens, input, effects and the main loop. */
(function () {
  'use strict';
  var E = window.Engine, D = window.Draw, S = window.Sound, SP = window.SoundPanel, WORLDS = window.LEVELS;
  var W = E.W, H = E.H, P = E.P;
  var FOODS = ['candy', 'strawberry', 'donut', 'cookie'];
  var $ = function (id) { return document.getElementById(id); };

  var TIPS = {
    rope: 'ゆびで ロープを スーッと きってね',
    two: 'ロープが 2ほん。きる じゅんばんを かんがえてね',
    swing: 'ゆらゆら…いい ところで きってね',
    star: 'ほしも ぜんぶ あつめられるかな？',
    bubble: 'しゃぼんだまに はいると ふわふわ。タッチで われるよ',
    blower: 'くもを タッチすると ふーっ！と かぜが でるよ',
    jelly: 'ゼリーに あたると ぽよーんと はねるよ',
    hook: 'ピンに ちかづくと ロープが くっつくよ',
    move: 'ピンが うごくよ。よく みて きってね',
    spike: 'トゲトゲに さわると おやつが われちゃう！',
    warp: 'ぼうしに はいると、おなじ いろの ぼうしから でてくるよ',
    rotor: 'くるくる まわる トゲに きをつけて。すきまを ねらってね'
  };

  // ---------------------------------------------------------------- save data

  // The records are kept per player (the players are shared by every game on the site: js/accounts.js);
  // sound, music and the admin switch belong to the phone. Before the shared players there was one record for the
  // phone ('kero-mogumogu-v1'): it becomes the first player's (the old key is left as it was).
  var SAVE_KEY = 'kero-mogumogu-v2', OLD_KEY = 'kero-mogumogu-v1', DEVICE = ['sfx', 'music', 'all'];
  function readKey(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  var root = (function () {
    var r = readKey(SAVE_KEY);
    if (!r || typeof r !== 'object' || !r.per || typeof r.per !== 'object') {
      var old = readKey(OLD_KEY);
      r = { v: 2, sfx: true, music: true, all: false, per: {} };
      if (old && typeof old === 'object' && old.stars) {
        DEVICE.forEach(function (k) { if (old[k] != null) r[k] = old[k]; delete old[k]; });
        r.per[Accounts.list()[0].id] = old;
      }
    }
    // (the records of a player removed from the shared list go)
    var ids = Accounts.list().map(function (u) { return u.id; });
    Object.keys(r.per).forEach(function (id) { if (ids.indexOf(id) < 0) delete r.per[id]; });
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(r)); } catch (e) { /* ignore */ }   // (kept in the new form at once)
    return r;
  }());
  var save = (function () {
    var id = Accounts.cur().id, s = root.per[id];
    if (!s || typeof s !== 'object' || !s.stars) s = root.per[id] = { stars: {} };
    DEVICE.forEach(function (k) {
      delete s[k];
      Object.defineProperty(s, k, { get: function () { return root[k]; }, set: function (v) { root[k] = v; }, enumerable: false, configurable: true });
    });
    s.seen = s.seen || {};
    s.spent = s.spent || 0;            // ★ spent in the shop
    s.owned = s.owned || ['frog'];     // characters bought
    s.chara = s.chara || 'frog';       // character in use
    s.oni = s.oni || {};               // the stages cleared at おに
    return s;
  }());
  function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(root)); } catch (e) { /* ignore */ } }
  function skey(wi, si) { return wi + '-' + si; }
  function cleared(wi, si) { return save.stars[skey(wi, si)] != null; }
  function starsOf(wi, si) { return save.stars[skey(wi, si)] || 0; }
  function worldOpen(wi) { return save.all || wi === 0 || cleared(wi - 1, WORLDS[wi - 1].stages.length - 1); }
  function stageOpen(wi, si) { return save.all || (worldOpen(wi) && (si === 0 || cleared(wi, si - 1))); }
  // おに (2026-09-30): a stage cleared with ★3 can be played again as おに (the admin switch opens every stage)
  function oniOpen(wi, si) { return save.all || starsOf(wi, si) >= 3; }
  // Its time: what the checked solution needs to feed the frog, × 1.3 and 4 s more (rounded up)
  var oniTimes = {};
  function oniLimit(wi, si) {
    var k = skey(wi, si);
    if (oniTimes[k] == null) {
      var lv = WORLDS[wi].stages[si], res = E.run(lv, lv.sol, 30);
      oniTimes[k] = Math.ceil((res.state === 'won' ? res.t : 12) * 1.3 + 4);
    }
    return oniTimes[k];
  }
  var stagesOni = false;   // (the stage list shows おに)
  function worldStars(wi) {
    var n = 0;
    for (var i = 0; i < WORLDS[wi].stages.length; i++) n += starsOf(wi, i);
    return n;
  }
  function foodOf(wi, si) { var f = WORLDS[wi].food; return f === 'mix' ? FOODS[si % 4] : f; }

  // Characters that eat the treats. Stars earned in stages are the shop money;
  // buying spends from the wallet but never changes a stage's star record.
  var CHARAS = [
    { id: 'frog', name: 'ケロちゃん', price: 0 },
    { id: 'rabbit', name: 'ミミちゃん', price: 10 },
    { id: 'cat', name: 'ニャーちゃん', price: 20 },
    { id: 'dog', name: 'ワンちゃん', price: 30 }
  ];
  function charaById(id) { for (var i = 0; i < CHARAS.length; i++) if (CHARAS[i].id === id) return CHARAS[i]; return CHARAS[0]; }
  function owns(id) { return save.owned.indexOf(id) >= 0; }
  function totalStars() { var n = 0; for (var k in save.stars) n += save.stars[k] || 0; return n; }
  function wallet() { return Math.max(0, totalStars() - save.spent); }

  if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- view

  var canvas = $('game'), ctx = canvas.getContext('2d'), stageEl = $('stage');
  var view = { cw: 1, ch: 1, dpr: 1, s: 1, ox: 0, oy: 0 };
  var bg = { canvas: null, theme: -1 };

  function resize() {
    var cw = window.innerWidth, ch = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    var s = Math.min(cw / W, ch / H);
    view = { cw: cw, ch: ch, dpr: dpr, s: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2 };
    stageEl.style.transform = 'translate(' + view.ox + 'px,' + view.oy + 'px) scale(' + s + ')';
    bg.canvas = null;
  }

  // おに: the whole background turns reddish and darker at the edges.
  function oniTint(b, v) {
    b.save();
    b.fillStyle = 'rgba(214,40,57,.2)';
    b.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    var cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2, rr = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) / 2;
    var g = b.createRadialGradient(cx, cy, rr * 0.45, cx, cy, rr);
    g.addColorStop(0, 'rgba(90,10,20,0)'); g.addColorStop(1, 'rgba(90,10,20,.32)');
    b.fillStyle = g;
    b.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    b.restore();
  }
  function worldTransform(c) { c.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy); }

  function drawBackground(theme, oni) {
    if (!(view.s > 0)) return;   // (a window with no size yet)
    var key = theme + (oni ? '/oni' : '');
    if (!bg.canvas || bg.theme !== key) {
      bg.canvas = document.createElement('canvas');
      bg.canvas.width = canvas.width; bg.canvas.height = canvas.height;
      var b = bg.canvas.getContext('2d');
      worldTransform(b);
      var x0 = -view.ox / view.s, y0 = -view.oy / view.s;
      D.background(b, theme, x0, y0, x0 + view.cw / view.s, y0 + view.ch / view.s);
      if (oni) oniTint(b, { x0: x0, y0: y0, x1: x0 + view.cw / view.s, y1: y0 + view.ch / view.s });
      bg.theme = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg.canvas, 0, 0);
  }

  function toWorld(e) { return { x: (e.clientX - view.ox) / view.s, y: (e.clientY - view.oy) / view.s }; }

  // ---------------------------------------------------------------- scene (a level being played)

  function noop() {}
  function Scene(level, food, onEvent) {
    this.level = level;
    this.food = food;
    this.onEvent = onEvent || noop;
    this.world = new E.World(level);
    this.frog = { mode: 'idle', mt: 0, open: 0, blinkT: 1.5 + Math.random() * 2, blink: false, wasOpen: false };
    this.fx = [];
    this.trail = [];
    this.eaten = null;
    this.acc = 0;
    this.t = 0;
    this.endT = 0;
    this.appear = 0;
  }

  Scene.prototype.update = function (dt) {
    var w = this.world, steps = 0;
    this.t += dt; this.appear += dt;
    this.acc += dt;
    while (this.acc >= E.DT && steps < 10) {
      w.step(); this.acc -= E.DT; steps++;
      if (w.events.length) this.handle();
    }
    if (steps === 10) this.acc = 0;
    if (w.state !== 'play') this.endT += dt;
    this.updateFrog(dt);
    updateFx(this.fx, dt);
    var now = this.t;
    this.trail = this.trail.filter(function (p) { return now - p.t < 0.22; });
    if (this.eaten) this.eaten.t += dt;
  };

  Scene.prototype.handle = function () {
    var w = this.world, evs = w.events;
    w.events = [];
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      switch (e.type) {
        case 'cut':
          S.play('cut'); burst(this.fx, e.x, e.y, 'spark', 6, '#ffffff'); if (this.onEvent !== noop) vibrate(12); break;
        case 'star':
          S.play('star', e.n); burst(this.fx, e.x, e.y, 'spark', 12, '#fff27a'); ring(this.fx, e.x, e.y, '#ffe45c'); break;
        case 'bubble': S.play('bubble'); break;
        case 'pop': S.play('pop'); burst(this.fx, e.x, e.y, 'drop', 10, 'rgba(180,225,255,.9)'); break;
        case 'puff':
          S.play('puff');
          var b = w.blowers[e.i];
          for (var k = 0; k < 7; k++) {
            var a = b.dir + (Math.random() - 0.5) * 0.5, sp = 160 + Math.random() * 140;
            this.fx.push({ kind: 'wind', x: b.x + Math.cos(b.dir) * 26, y: b.y + Math.sin(b.dir) * 26, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.55, max: 0.55, size: 8 + Math.random() * 6, rot: a });
          }
          break;
        case 'bounce': S.play('boing'); burst(this.fx, e.x, e.y + 10, 'dot', 5, '#ffc2e2'); break;
        case 'hook': S.play('hook'); ring(this.fx, e.x, e.y, '#fff3a0'); break;
        case 'warp':
          S.play('warp'); ring(this.fx, e.x, e.y, '#d9c7ff'); ring(this.fx, e.x2, e.y2, '#d9c7ff');
          burst(this.fx, e.x2, e.y2, 'spark', 8, '#fff7b0'); break;
        case 'snap': S.play('cut'); burst(this.fx, e.x, e.y, 'spark', 4, '#ffffff'); break;
        case 'win':
          this.eaten = { x: e.x, y: e.y, t: 0 };
          this.frog.mode = 'eat'; this.frog.mt = 0;
          S.play('eat'); S.play('win'); if (this.onEvent !== noop) vibrate(30);
          break;
        case 'lose':
          this.frog.mode = 'sad'; this.frog.mt = 0;
          if (e.reason === 'spike') { S.play('spike'); burst(this.fx, e.x, e.y, 'crumb', 14, crumbColor(this.food)); if (this.onEvent !== noop) vibrate(60); }
          else S.play('lose');
          break;
      }
      this.onEvent(e);
    }
  };

  Scene.prototype.updateFrog = function (dt) {
    var f = this.frog, w = this.world, c = w.candy;
    f.mt += dt;
    var want = 0;
    if (w.state === 'play') {
      var dx = c.x - w.frog.x, dy = c.y - w.frog.y;
      want = dx * dx + dy * dy < P.openR * P.openR ? 1 : 0;
      if (want && !f.wasOpen) S.play('open');
      f.wasOpen = !!want;
    }
    f.open += (want - f.open) * Math.min(1, dt * 12);
    if (f.mode === 'eat') {
      if (f.mt > 0.6 && !f.hearts) { f.hearts = true; for (var i = 0; i < 5; i++) this.fx.push({ kind: 'heart', x: w.frog.x + (Math.random() - 0.5) * 60, y: w.frog.y - 30, vx: (Math.random() - 0.5) * 50, vy: -60 - Math.random() * 50, life: 1.4, max: 1.4, size: 9 + Math.random() * 6 }); }
      if (f.mt > 1.1) { f.mode = 'happy'; f.mt = 0; }
    }
    f.blinkT -= dt;
    if (f.blinkT < 0) { f.blink = true; if (f.blinkT < -0.13) { f.blink = false; f.blinkT = 2 + Math.random() * 3; } }
  };

  Scene.prototype.addTrail = function (x, y) { this.trail.push({ x: x, y: y, t: this.t }); };

  Scene.prototype.draw = function (c, hint) {
    var w = this.world, t = this.t, i, lv = this.level;
    worldTransform(c);
    for (i = 0; i < w.ropes.length; i++) if (w.ropes[i].mv) D.rail(c, w.ropes[i].mv);
    for (i = 0; i < w.pieces.length; i++) if (w.pieces[i].mv) D.rail(c, w.pieces[i].mv);
    for (i = 0; i < w.hooks.length; i++) D.hook(c, w.hooks[i], t);
    for (i = 0; i < w.spikes.length; i++) D.spikes(c, w.spikes[i]);
    for (i = 0; i < w.hats.length; i++) { D.hat(c, w.hats[i].ax, w.hats[i].ay, t, i); D.hat(c, w.hats[i].bx, w.hats[i].by, t + 0.5, i); }
    for (i = 0; i < w.rotors.length; i++) D.rotor(c, E.rotorEnds(w.rotors[i], w.t), w.rotors[i].x, w.rotors[i].y);
    for (i = 0; i < w.pads.length; i++) D.jelly(c, w.pads[i], w.t);
    for (i = 0; i < w.bubbles.length; i++) if (w.bubbles[i].state === 0) D.bubble(c, w.bubbles[i].x, w.bubbles[i].y, P.bubbleR, t + i);
    for (i = 0; i < w.stars.length; i++) if (!w.stars[i].got) D.star(c, w.stars[i].x, w.stars[i].y, t, i, 1);
    for (i = 0; i < w.blowers.length; i++) D.blower(c, w.blowers[i], w.t);

    var look = w.state === 'play' || w.state === 'lost' ? w.candy : null;
    var f = this.frog;
    D.critter(c, { x: w.frog.x, y: w.frog.y, t: t, look: look, open: f.open, mode: f.mode, mt: f.mt, blink: f.blink, perch: w.frog.y < 530, kind: save.chara, horns: !!this.oni });

    for (i = 0; i < w.pieces.length; i++) D.rope(c, w.pieces[i].pts, w.pieces[i].fade);
    for (i = 0; i < w.ropes.length; i++) D.rope(c, w.ropes[i].pts, 1);
    // pins stay even after their rope is cut
    (lv.ropes || []).forEach(function (r, k) {
      var rope = w.ropeById(String(k));
      var p = rope ? rope.pts[0] : anchorAt(r, w.t);
      D.pin(c, p.x, p.y);
    });

    var cd = w.candy, sc = Math.min(1, this.appear / 0.25);
    sc = sc < 1 ? 1 - Math.pow(1 - sc, 3) * 1 : 1;
    if (this.eaten) {
      var k = Math.min(1, this.eaten.t / 0.22), ex = this.eaten.x + (w.frog.x - this.eaten.x) * k, ey = this.eaten.y + (w.frog.y + 4 - this.eaten.y) * k;
      if (k < 1) D.food(c, this.food, ex, ey, P.candyR * (1 - k * 0.7), cd.angle);
    } else if (!(w.state === 'lost' && w.reason === 'spike')) {
      if (sc > 0.1) D.food(c, this.food, cd.x, cd.y, P.candyR * sc, cd.angle);
      if (cd.bubble >= 0) D.bubble(c, cd.x, cd.y, P.bubbleR + 2, t);
    }

    drawFx(c, this.fx);
    if (hint) drawHint(c, hint, this);
    drawTrail(c, this.trail, t);
  };

  function anchorAt(r, t) {
    if (r[3] == null) return { x: r[0], y: r[1] };
    var period = r[5] || 3, phase = r[6] || 0, u = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / period + phase);
    return { x: r[0] + (r[3] - r[0]) * u, y: r[1] + (r[4] - r[1]) * u };
  }

  function crumbColor(food) { return { candy: '#ff6fa8', strawberry: '#ff4f6f', donut: '#ff8fc6', cookie: '#c98a45' }[food] || '#ff6fa8'; }

  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  // ---------------------------------------------------------------- particles

  function burst(list, x, y, kind, n, color) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
      list.push({ kind: kind, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + Math.random() * 0.3, max: 0.8, size: 3 + Math.random() * 4, color: color, rot: Math.random() * 6 });
    }
  }
  function ring(list, x, y, color) { list.push({ kind: 'ring', x: x, y: y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: 10, color: color }); }

  function updateFx(list, dt) {
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'crumb' || p.kind === 'drop' || p.kind === 'confetti') p.vy += 500 * dt;
      if (p.kind === 'wind') { p.vx *= 0.97; p.vy *= 0.97; }
      if (p.kind === 'heart') p.vx = Math.sin(p.life * 6) * 25;
      if (p.kind === 'confetti') { p.vx *= 0.99; p.rot += dt * 8; }
    }
  }

  function drawFx(c, list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i], a = Math.max(0, Math.min(1, p.life / (p.max * 0.6)));
      c.globalAlpha = a;
      switch (p.kind) {
        case 'spark': D.sparkle(c, p.x, p.y, p.size * 1.6, p.color); break;
        case 'dot': case 'drop': D.circle(c, p.x, p.y, p.size * 0.8); D.paint(c, p.color); break;
        case 'crumb': D.circle(c, p.x, p.y, p.size); D.paint(c, p.color, D.INK, 1.5); break;
        case 'heart': D.heart(c, p.x, p.y, p.size); break;
        case 'ring':
          var k = 1 - p.life / p.max;
          D.circle(c, p.x, p.y, p.size + k * 40); D.paint(c, null, p.color, 5 * (1 - k)); break;
        case 'wind':
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.beginPath(); c.moveTo(-p.size, 0); c.quadraticCurveTo(0, -p.size * 0.5, p.size, 0);
          c.lineCap = 'round'; D.paint(c, null, 'rgba(255,255,255,.9)', 3); c.restore(); break;
        case 'confetti':
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color;
          c.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); c.restore(); break;
      }
    }
    c.globalAlpha = 1;
  }

  function drawTrail(c, trail, now) {
    if (trail.length < 2) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    for (var i = 1; i < trail.length; i++) {
      var p = trail[i - 1], q = trail[i];
      if (q.start) continue;
      var k = 1 - (now - q.t) / 0.22;
      c.strokeStyle = 'rgba(255,255,255,' + (0.9 * k).toFixed(3) + ')';
      c.lineWidth = 2 + 7 * k;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke();
    }
    c.restore();
  }

  // ---------------------------------------------------------------- hints
  // The hint replays the level's checked solution: it points at the next
  // thing to touch, keeping the solution's timing relative to the child's
  // previous action.

  function makeHint(level) {
    return { acts: E.parseSol(level.sol), idx: 0, base: 0, seen: 0, period: hintPeriod(level) };
  }

  // When the first cut only waits for one spinning spike bar (the treat is
  // still), the right moment comes back every half turn, and so does the hint.
  function hintPeriod(level) {
    var movers = (level.ropes || []).some(function (r) { return r[3] != null; }), rotors = level.rotors || [];
    if (rotors.length === 1 && !movers && !level.live) return 180 / Math.abs(rotors[0][3]);
    return 0;
  }

  function updateHint(h, w) {
    while (h.seen < w.log.length) {
      var entry = w.log[h.seen++];
      if (h.idx < h.acts.length && entry.a === h.acts[h.idx].a) { h.idx++; h.base = entry.t; }
    }
  }

  function hintTarget(h, w) {
    if (h.idx >= h.acts.length || w.state !== 'play') return null;
    var a = h.acts[h.idx], prevT = h.idx ? h.acts[h.idx - 1].t : 0;
    var due = h.base + (a.t - prevT);
    if (h.idx === 0 && h.period) while (due < w.t - 0.35) due += h.period;
    var lead = due - w.t;
    if (lead > 0.7) return null;
    var kind = a.a.charAt(0);
    if (kind === 'c') {
      var r = w.ropeById(a.a.slice(1));
      if (!r) return null;
      var m = Math.floor((r.pts.length - 1) / 2), p = r.pts[m], q = r.pts[m + 1];
      var dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      return { kind: 'swipe', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, nx: -dy / d, ny: dx / d, lead: lead };
    }
    if (kind === 'p') return w.candy.bubble >= 0 ? { kind: 'tap', x: w.candy.x, y: w.candy.y, lead: lead } : null;
    if (kind === 'b') { var b = w.blowers[+a.a.slice(1)]; return { kind: 'tap', x: b.x, y: b.y, lead: lead }; }
    return null;
  }

  function drawHint(c, h, scene) {
    var tg = hintTarget(h, scene.world);
    if (!tg) return;
    var t = scene.t, ready = tg.lead <= 0.05;
    var rr = ready ? 26 + Math.sin(t * 10) * 4 : 26 + tg.lead * 60;
    D.circle(c, tg.x, tg.y, rr);
    D.paint(c, ready ? 'rgba(255,240,120,.35)' : null, ready ? '#ffe04d' : 'rgba(255,255,255,.9)', 4);
    if (tg.kind === 'swipe') {
      var ph = (t * 1.1) % 1, s = (ph - 0.5) * 90;
      if (ph < 0.8) D.hand(c, tg.x + tg.nx * s, tg.y + tg.ny * s, 1, false);
      c.save(); c.setLineDash([6, 8]); c.lineCap = 'round';
      c.beginPath(); c.moveTo(tg.x - tg.nx * 45, tg.y - tg.ny * 45); c.lineTo(tg.x + tg.nx * 45, tg.y + tg.ny * 45);
      D.paint(c, null, 'rgba(255,255,255,.9)', 4); c.restore();
    } else {
      D.hand(c, tg.x, tg.y + 4, 1, Math.sin(t * 8) > 0);
    }
  }

  // ---------------------------------------------------------------- screens

  var screen = 'title';
  var game = null;          // current play session
  var demo = null;          // title screen animation
  var clock = 0;

  function show(name) {
    screen = name;
    ['title', 'worlds', 'stages', 'shop', 'hud'].forEach(function (id) {
      $(id).classList.toggle('on', id === name || (name === 'play' && id === 'hud'));
    });
    SP.hide(); SP.fit();   // (the sound window closes; long titles make room for the 🔊 button)
    if (name !== 'play') { hidePanel('clear'); hideTip(); releaseWake(); }
  }

  // Android back button walks back through the screens.
  var depth = 0;
  function forward(fn) { depth++; history.pushState({ d: depth }, ''); fn(); }
  // The player now playing, on the title screen (chosen in ケロちゃん ランド; the players are shared by every game,
  // js/accounts.js). With two or more players, a tap on it switches players.
  function dot(u) { return '<i class="udot" style="background:' + Accounts.COLORS[u.color] + '"></i>'; }
  function refreshNameTag() {
    var el = $('name-tag'), u = Accounts.cur(), many = Accounts.list().length > 1;
    el.hidden = !u.name && !many;
    el.classList.toggle('many', many);
    el.innerHTML = dot(u);
    var sp = document.createElement('span');
    sp.textContent = u.name || L('なまえなし');
    el.appendChild(sp);
  }
  function openWho() {
    var box = $('who-list'), now = Accounts.cur().id;
    box.innerHTML = '';
    Accounts.list().forEach(function (u) {
      var b = document.createElement('button');
      b.className = 'btn who-btn' + (u.id === now ? ' on' : '');
      b.innerHTML = dot(u);
      var sp = document.createElement('span');
      sp.textContent = u.name || L('なまえなし');
      b.appendChild(sp);
      b.addEventListener('click', function () {
        S.play('click');
        if (u.id === now) { hidePanel('who'); return; }
        Accounts.setCur(u.id);
        location.reload();   // (the game starts again with that player's records)
      });
      box.appendChild(b);
    });
    showPanel('who');
  }
  // (the players may have been changed in ケロちゃん ランド or another game meanwhile)
  window.addEventListener('pageshow', function (e) { if (e.persisted && Accounts.changed()) location.reload(); else refreshNameTag(); });

  function go(name) {
    if (name === 'title') { show('title'); refreshNameTag(); newDemo(); refreshShopBadge(); }
    else if (name === 'worlds') { buildWorlds(); show('worlds'); }
    else if (name === 'stages') { buildStages(); show('stages'); }
    else if (name === 'shop') { buildShop(); show('shop'); }
  }
  window.addEventListener('popstate', function () {
    depth = Math.max(0, depth - 1);
    ['parent', 'pass', 'buy'].forEach(hidePanel);
    if (screen === 'play') go('stages');
    else if (screen === 'stages') go('worlds');
    else go('title');
  });
  function back() { S.play('click'); if (depth > 0) history.back(); else go('title'); }

  // Back to ケロちゃん ランド, the menu at the top of the site. When the game was opened
  // from it, step back in history (so the phone's back button keeps making sense).
  function toLand() {
    S.play('click');
    var fromLand = false;
    try {
      var ref = new URL(document.referrer);
      fromLand = ref.origin === location.origin && ref.pathname === new URL('../', location.href).pathname;
    } catch (e) { /* no referrer */ }
    setTimeout(function () {
      if (fromLand && depth === 0 && history.length > 1) history.back();
      else location.href = '../';
    }, 120);
  }

  var curWorld = 0;

  // --- title

  var DEMO_LEVEL = { candy: [180, 322], frog: [180, 438], ropes: [[180, 254]], sol: 'c0@2.2' };
  function newDemo() {
    demo = new Scene(DEMO_LEVEL, FOODS[Math.floor(Math.random() * 4)]);
    demo.hint = makeHint(DEMO_LEVEL);
  }
  function updateDemo(dt) {
    if (!demo) newDemo();
    demo.update(dt);
    var w = demo.world;
    updateHint(demo.hint, w);
    if (w.state === 'play' && w.t > 2.2 && !w.log.length) w.act('c0');
    if (demo.endT > 2.4) newDemo();
  }

  // --- world select

  function buildWorlds() {
    var list = $('world-list');
    list.innerHTML = '';
    WORLDS.forEach(function (wd, wi) {
      var open = worldOpen(wi), b = document.createElement('button');
      b.className = 'card' + (open ? '' : ' locked');
      b.style.setProperty('--c1', D.THEMES[wd.theme].sky[0]);
      b.style.setProperty('--c2', D.THEMES[wd.theme].sky[1]);
      var ic = document.createElement('canvas'); ic.width = 128; ic.height = 128; ic.className = 'card-icon';
      var g = ic.getContext('2d'); g.scale(2, 2);
      if (wd.food === 'mix') {
        D.food(g, 'candy', 20, 20, 10, -0.3); D.food(g, 'strawberry', 44, 20, 10, 0.2);
        D.food(g, 'donut', 20, 45, 10, 0); D.food(g, 'cookie', 44, 45, 10, 0);
      } else D.food(g, wd.food, 32, 33, 17, -0.25);
      b.appendChild(ic);
      var tx = document.createElement('div'); tx.className = 'card-text';
      tx.innerHTML = '<div class="card-num">' + L('ワールド {n}', { n: wi + 1 }) + '</div><div class="card-name">' + L(wd.name) + '</div>' +
        '<div class="card-stars">' + icon('star') + ' ' + worldStars(wi) + ' / ' + wd.stages.length * 3 + '</div>';
      b.appendChild(tx);
      if (!open) { var lk = document.createElement('span'); lk.className = 'card-lock'; lk.innerHTML = icon('lock'); b.appendChild(lk); }
      b.addEventListener('click', function () {
        if (!worldOpen(wi)) { S.play('lose'); shake(b); return; }
        S.play('click'); curWorld = wi; forward(function () { go('stages'); });
      });
      list.appendChild(b);
    });
  }

  // --- stage select

  function buildStages() {
    var wd = WORLDS[curWorld], grid = $('stage-grid');
    var wname = L(wd.name);
    $('stages-title').textContent = wname;
    $('stages-title').classList.toggle('long', wname.length > (Lang.cur === 'ja' ? 9 : 16));
    grid.innerHTML = '';
    grid.classList.toggle('oni', stagesOni);
    $('stages-oni').classList.toggle('on', stagesOni);
    $('stages-note').textContent = stagesOni ? L('★3つ とった ステージを、じかん いないに ★を ぜんぶ とって クリアしよう！') : '';
    var nextSet = false;
    wd.stages.forEach(function (lv, si) {
      var open = stagesOni ? oniOpen(curWorld, si) : stageOpen(curWorld, si), b = document.createElement('button');
      b.className = 'stage-btn' + (open ? '' : ' locked') + (stagesOni ? ' oni' : '');
      if (!stagesOni && open && !cleared(curWorld, si) && !nextSet) { b.classList.add('next'); nextSet = true; }
      if (open) {
        var st = starsOf(curWorld, si), s = '';
        for (var k = 0; k < 3; k++) s += '<i class="' + (k < st ? 'got' : '') + '">' + icon('star') + '</i>';
        b.innerHTML = '<span class="num">' + (si + 1) + '</span><span class="mini-stars">' + s + '</span>' +
          (save.oni[skey(curWorld, si)] ? '<span class="oni-mark">' + icon('horns') + '</span>' : '');   // (cleared at おに)
      } else b.innerHTML = icon('lock');
      b.addEventListener('click', function () {
        if (stagesOni && !oniOpen(curWorld, si)) {   // (おに: only a stage cleared with ★3)
          S.play('lose'); shake(b); $('stages-note').textContent = L('★3つ とると おにで あそべるよ'); return;
        }
        if (!stagesOni && !stageOpen(curWorld, si)) { S.play('lose'); shake(b); return; }
        S.play('click'); forward(function () { startLevel(curWorld, si, { oni: stagesOni }); });
      });
      grid.appendChild(b);
    });
  }

  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  // --- shop: buy friends with ★ and choose who eats the treats

  var SHOP_NOTE = L('★を つかって おともだちを ふやそう！');
  var shop = { t: 0, cards: [], fx: [] };

  function drawPreview(cv, kind, t, extra) {
    var g = cv.getContext('2d'), k = cv.width / 240 * 1.05;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, cv.width / 2 - 180 * k, cv.height * 0.6 - 150 * k);
    D.critter(g, Object.assign({ x: 180, y: 150, t: t, kind: kind, look: null, blink: (t % 3.3) < 0.13, mode: 'idle' }, extra || {}));
  }

  function refreshShopBadge() { $('shop-badge').innerHTML = icon('star') + wallet(); }

  function buildShop() {
    var grid = $('shop-grid');
    grid.innerHTML = '';
    shop.cards = [];
    $('shop-wallet').innerHTML = icon('star') + '<span>' + wallet() + '</span>';
    CHARAS.forEach(function (ch) {
      var mine = owns(ch.id), using = save.chara === ch.id, card = document.createElement('div');
      card.className = 'chara-card' + (using ? ' using' : '');
      var cv = document.createElement('canvas');
      cv.width = 240; cv.height = 240; cv.className = 'chara-canvas';
      card.appendChild(cv);
      var nm = document.createElement('div');
      nm.className = 'chara-name'; nm.textContent = L(ch.name);
      card.appendChild(nm);
      var b = document.createElement('button');
      if (using) { b.className = 'btn chara-btn using'; b.textContent = L('つかってる'); }
      else if (mine) { b.className = 'btn chara-btn'; b.textContent = L('えらぶ'); }
      else {
        var can = wallet() >= ch.price;
        b.className = 'btn chara-btn buy' + (can ? '' : ' short');
        b.innerHTML = can ? L('{star}{price} で かう', { star: icon('star'), price: ch.price }) : icon('star') + ch.price;
      }
      b.addEventListener('click', function () { choose(ch, card); });
      card.appendChild(b);
      grid.appendChild(card);
      shop.cards.push({ id: ch.id, canvas: cv, happyT: -9 });
    });
  }

  function choose(ch, card) {
    if (save.chara === ch.id) { S.play('click'); cheer(ch.id); return; }
    if (owns(ch.id)) { S.play('click'); save.chara = ch.id; store(); buildShop(); cheer(ch.id); return; }
    if (wallet() < ch.price) {
      S.play('lose'); shake(card);
      showShopNote(L('あと ★{n} で かえるよ', { n: ch.price - wallet() }));
      return;
    }
    S.play('click');
    buying = ch;
    $('buy-text').innerHTML = L('{name}を<br>{star}{price} で かう？', { name: L(ch.name), star: icon('star'), price: ch.price });
    showPanel('buy');
  }

  var buying = null;
  function confirmBuy() {
    var ch = buying;
    hidePanel('buy'); buying = null;
    if (!ch || owns(ch.id) || wallet() < ch.price) return;
    save.spent += ch.price;
    save.owned.push(ch.id);
    save.chara = ch.id;
    store();
    S.play('fanfare'); vibrate(40);
    buildShop(); cheer(ch.id);
    for (var i = 0; i < 60; i++) {
      shop.fx.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 160, vx: (Math.random() - 0.5) * 80, vy: 40 + Math.random() * 60, life: 2.6, max: 2.6, size: 4 + Math.random() * 3, rot: Math.random() * 6, color: ['#ff7fb5', '#ffd93d', '#7fd3ff', '#8ff08f', '#c79cff'][i % 5] });
    }
    showShopNote(L('{name}が なかまに なったよ！', { name: L(ch.name) }));
  }

  function cheer(id) { shop.cards.forEach(function (c) { if (c.id === id) c.happyT = shop.t; }); }

  function updateShop(dt) {
    shop.t += dt;
    shop.cards.forEach(function (c, i) {
      var since = shop.t - c.happyT;
      drawPreview(c.canvas, c.id, shop.t + i * 0.9, since < 1.4 ? { mode: 'happy', mt: since } : null);
    });
    if (buying) drawPreview($('buy-canvas'), buying.id, shop.t);
    updateFx(shop.fx, dt);
  }

  var noteTimer = null;
  function showShopNote(text) {
    var el = $('shop-note');
    el.textContent = text;
    el.classList.add('flash');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () { el.textContent = SHOP_NOTE; el.classList.remove('flash'); }, 2600);
  }

  // --- grown-ups: the password opens the admin menu (unlock every stage, reset)

  var ADMIN_PASS = '123', typed = '';
  function openPass() { typed = ''; drawDots(); showPanel('pass'); }
  function drawDots() {
    var h = '';
    for (var i = 0; i < Math.max(3, typed.length); i++) h += '<i class="' + (i < typed.length ? 'on' : '') + '"></i>';
    $('pass-dots').innerHTML = h;
  }
  function pressKey(k) {
    if (k === 'del') typed = typed.slice(0, -1);
    else if (k === 'ok') {
      if (typed === ADMIN_PASS) { hidePanel('pass'); S.play('click'); openAdmin(); return; }
      S.play('lose'); shake($('pass-card')); typed = '';
    } else if (typed.length < 6) { typed += k; S.play('click'); }
    drawDots();
  }
  function openAdmin() {
    $('p-all').textContent = L(save.all ? '全ステージ解放：オン' : '全ステージ解放：オフ');
    $('p-all').classList.toggle('active', !!save.all);
    $('p-reset').textContent = L('記録をリセット');
    $('p-info').textContent = L('あつめた★ {got}　つかった★ {spent}', { got: totalStars(), spent: save.spent });
    showPanel('parent');
  }

  // --- playing

  function startLevel(wi, si, opts) {
    opts = opts || {};
    var lv = WORLDS[wi].stages[si];
    var same = game && game.wi === wi && game.si === si;
    var firstTime = !cleared(wi, si) && lv.tip && !save.seen[skey(wi, si)];
    var oni = !!opts.oni;
    game = {
      wi: wi, si: si, level: lv,
      fails: same ? game.fails : 0,
      hintOn: !oni && (opts.hint || (same && game.hintOn) || firstTime),   // (おに: no 💡)
      doneShown: false,
      oni: oni, oniT: 0, limit: oni ? oniLimit(wi, si) : 0, oniMsg: ''
    };
    game.scene = new Scene(lv, foodOf(wi, si), onPlayEvent);
    game.scene.oni = oni;
    game.hint = makeHint(lv);
    curWorld = wi;
    $('h-label').innerHTML = (wi + 1) + ' - ' + (si + 1) + (oni ? '<small class="oni-tag">' + L('おに') + '</small>' : '');
    $('h-hint').hidden = oni;
    setHudStars(0);
    $('h-hint').classList.toggle('glow', game.fails >= 3 && !game.hintOn);
    $('h-hint').classList.toggle('active', !!game.hintOn);
    S.setKey(WORLDS[wi].key || 0);
    show('play');
    if (!same || opts.showTip) hideTip();
    if (lv.tip && (!same || opts.showTip)) showTip(L(TIPS[lv.tip] || lv.tip), lv);
    if (firstTime) { save.seen[skey(wi, si)] = 1; store(); }
    requestWake();
  }

  function onPlayEvent(e) {
    if (e.type === 'star') setHudStars(e.n, true);
    if (e.type === 'lose') game.fails++;
    if (e.type === 'cut' || e.type === 'pop' || e.type === 'puff') hideTip();
  }

  function setHudStars(n, pop) {
    var slots = $('h-stars').children;
    for (var i = 0; i < 3; i++) {
      var on = i < n;
      if (on && pop && i === n - 1) { slots[i].classList.remove('pop'); void slots[i].offsetWidth; slots[i].classList.add('pop'); }
      slots[i].classList.toggle('got', on);
    }
  }

  function updatePlay(dt) {
    var sc = game.scene, w = sc.world;
    sc.update(dt);
    if (game.hintOn) updateHint(game.hint, w);
    if (game.oni) {   // (おに: the time runs from the start; every ★ is needed)
      var need = (game.level.stars || []).length;
      if (w.state === 'play') {
        game.oniT += dt;
        if (game.oniT > game.limit) { w.lose('time'); game.oniMsg = L('じかん ぎれ！'); showTip(game.oniMsg, game.level); }
      }
      if (w.state === 'won' && w.got < need && !game.oniMsg) { game.oniMsg = L('★を 3つ ぜんぶ とってね'); S.play('lose'); showTip(game.oniMsg, game.level); }
      if (w.state === 'won' && w.got < need && sc.endT > 1.8) { hideTip(); startLevel(game.wi, game.si, { oni: true }); return; }
    }
    if (w.state === 'won' && !game.doneShown && sc.endT > 1.6) { game.doneShown = true; showClear(); }
    if (w.state === 'lost' && sc.endT > (game.oniMsg ? 1.8 : 1.5)) { if (game.oniMsg) hideTip(); startLevel(game.wi, game.si, { oni: game.oni }); }
  }
  // おに: the time left, as a bar under the top buttons (what went wrong is said in ケロちゃん's bubble)
  function drawOni(c) {
    if (!game || !game.oni) return;
    worldTransform(c);
    var k = Math.max(0, 1 - game.oniT / game.limit);
    D.roundRect(c, 70, 66, 220, 14, 7); D.paint(c, 'rgba(255,255,255,.85)', D.INK, 2.5);
    if (k > 0.01) { D.roundRect(c, 72, 68, 216 * k, 10, 5); D.paint(c, k > 0.5 ? '#86d65c' : k > 0.25 ? '#ffc21a' : '#ff5a5a'); }
  }

  function retry() { S.play('click'); startLevel(game.wi, game.si, { oni: game.oni }); }

  function toggleHint() {
    S.play('click');
    if (game.oni) return;   // (おに: no 💡)
    game.hintOn = !game.hintOn;
    startLevel(game.wi, game.si, { hint: game.hintOn });
  }

  // --- clear panel

  function showClear() {
    var wi = game.wi, si = game.si, got = game.scene.world.got;
    var first = !cleared(wi, si);
    save.stars[skey(wi, si)] = Math.max(starsOf(wi, si), got);
    store();
    var lastStage = si === WORLDS[wi].stages.length - 1;
    var allDone = WORLDS.every(function (wd, i) { return cleared(i, wd.stages.length - 1); });
    var title = got === 3 ? 'かんぺき！' : got === 2 ? 'すごい！' : 'やったね！';
    if (game.oni) { title = 'おに クリア！'; save.oni[skey(wi, si)] = 1; store(); }   // (おに: a horn mark on the stage)
    else if (lastStage && first) title = wi === WORLDS.length - 1 && allDone ? 'ぜんぶ クリア！' : 'ワールド クリア！';
    title = L(title);
    $('clear-title').textContent = title;
    $('clear-title').classList.toggle('long', title.length > 6);
    var slots = $('clear-stars').children;
    for (var i = 0; i < 3; i++) slots[i].className = '';
    for (var k = 0; k < got; k++) {
      (function (k) {
        setTimeout(function () {
          if (!game || !game.doneShown) return;
          slots[k].className = 'got';
          S.play('resultStar', k);
          var sx = 180 + (k - 1) * 70;
          burst(game.scene.fx, sx, 250, 'spark', 8, '#fff27a');
        }, 450 + k * 330);
      }(k));
    }
    if (lastStage && first) {
      setTimeout(function () { S.play('fanfare'); }, 400);
      for (var c = 0; c < 70; c++) {
        game.scene.fx.push({ kind: 'confetti', x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 40 + Math.random() * 60, life: 3, max: 3, size: 4 + Math.random() * 3, rot: Math.random() * 6, color: ['#ff7fb5', '#ffd93d', '#7fd3ff', '#8ff08f', '#c79cff'][c % 5] });
      }
    }
    showPanel('clear');
  }

  function nextStage() {
    S.play('click');
    hidePanel('clear');
    var wi = game.wi, si = game.si + 1;
    if (game.oni) {   // (おに: the next stage too, if it has ★3; otherwise back to the list)
      if (si < WORLDS[wi].stages.length && oniOpen(wi, si)) { startLevel(wi, si, { oni: true }); return; }
      if (depth > 0) history.back(); else go('stages');
      return;
    }
    if (si >= WORLDS[wi].stages.length) {
      if (wi + 1 < WORLDS.length) curWorld = wi + 1;
      if (depth > 0) history.back(); else go('stages');
      return;
    }
    startLevel(wi, si);
  }

  // --- panels & tips

  function showPanel(id) { $(id).classList.add('on'); }
  function hidePanel(id) { $(id).classList.remove('on'); }

  // The tip is a speech bubble from ケロちゃん. It goes above or below the frog,
  // or at the top/bottom of the screen, wherever it hides the least:
  // the treat and ropes count most, then pins, bubbles and clouds, then the rest.
  function levelPoints(lv) {
    var pts = [], add = function (list, w) { (list || []).forEach(function (p) { pts.push([p[0], p[1], w]); }); };
    pts.push([lv.candy[0], lv.candy[1], 6]);
    (lv.ropes || []).forEach(function (r) {
      pts.push([r[0], r[1], 3]);
      pts.push([(r[0] + lv.candy[0]) / 2, (r[1] + lv.candy[1]) / 2, 3]);
    });
    add(lv.bubbles, 2); add(lv.blowers, 2); add(lv.hooks, 2); add(lv.stars, 1);
    (lv.hats || []).forEach(function (h) { pts.push([h[0], h[1], 2]); pts.push([h[2], h[3], 2]); });
    (lv.rotors || []).forEach(function (r) {
      for (var k = -1; k <= 1; k++) pts.push([r[0] + k * r[2] / 2, r[1], 2]);
      pts.push([r[0], r[1] - r[2] / 2, 2]); pts.push([r[0], r[1] + r[2] / 2, 2]);
    });
    (lv.pads || []).concat(lv.spikes || []).forEach(function (s) {
      for (var k = 0; k <= 4; k++) pts.push([s[0] + (s[2] - s[0]) * k / 4, s[1] + (s[3] - s[1]) * k / 4, 2]);
    });
    return pts;
  }
  var tipTimer = null;
  function showTip(text, lv) {
    var el = $('tip'), w = 230, h = 64, frog = { x: lv.frog[0], y: lv.frog[1] };
    el.textContent = text;
    var pts = levelPoints(lv);
    var cost = function (x, top) {
      return pts.reduce(function (n, p) { return n + (p[0] > x - 22 && p[0] < x + w + 22 && p[1] > top - 22 && p[1] < top + h + 22 ? p[2] : 0); }, 0);
    };
    var fx = Math.max(10, Math.min(W - 10 - w, frog.x - w / 2)), mid = (W - w) / 2;
    var spots = [
      { x: fx, top: frog.y + 78, tail: 'up', pref: 0 },
      { x: fx, top: frog.y - 58 - h, tail: 'down', pref: 0 },
      { x: mid, top: H - h - 12, tail: '', pref: 1 },
      { x: mid, top: 70, tail: '', pref: 1 }
    ].filter(function (sp) { return sp.top > 66 && sp.top + h < H - 4; });
    spots.forEach(function (sp) { sp.cost = cost(sp.x, sp.top) + sp.pref + (sp.tail ? 0 : 0.5); });
    spots.sort(function (a, b) { return a.cost - b.cost; });
    var sp = spots[0];
    el.style.left = sp.x + 'px';
    el.style.width = w + 'px';
    el.style.top = sp.top + 'px';
    el.style.bottom = '';
    el.style.setProperty('--tail', (frog.x - sp.x) + 'px');
    el.classList.toggle('below', sp.tail === 'up');
    el.classList.toggle('free', !sp.tail);
    el.classList.add('on');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 6000);
  }
  function hideTip() { $('tip').classList.remove('on'); }

  // ---------------------------------------------------------------- wake lock (screen stays on while playing)

  var wake = null;
  function requestWake() {
    if (wake || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) { wake = l; l.addEventListener('release', function () { wake = null; }); }).catch(function () {});
  }
  function releaseWake() { if (wake) { wake.release().catch(function () {}); wake = null; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) S.suspend();
    else { S.resume(); if (screen === 'play') requestWake(); }
  });

  // ---------------------------------------------------------------- input

  var pointers = {};

  function firstTouch() {
    S.init();
    if (save.music) S.startMusic();
  }
  window.addEventListener('pointerdown', firstTouch, true);

  canvas.addEventListener('pointerdown', function (e) {
    if (screen !== 'play' || !game) return;
    e.preventDefault();
    var p = toWorld(e), sc = game.scene;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var hit = sc.world.press(p.x, p.y);
    pointers[e.pointerId] = { x: p.x, y: p.y, t: performance.now(), moved: 0, hit: !!hit };
    sc.trail.push({ x: p.x, y: p.y, t: sc.t, start: true });
  });

  canvas.addEventListener('pointermove', function (e) {
    var pt = pointers[e.pointerId];
    if (!pt || screen !== 'play' || !game) return;
    var sc = game.scene;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    for (var i = 0; i < evs.length; i++) {
      var p = toWorld(evs[i]), dx = p.x - pt.x, dy = p.y - pt.y;
      if (dx * dx + dy * dy < 4) continue;
      sc.world.slice(pt.x, pt.y, p.x, p.y);
      pt.moved += Math.sqrt(dx * dx + dy * dy);
      pt.x = p.x; pt.y = p.y;
      sc.addTrail(p.x, p.y);
    }
  });

  function endPointer(e) {
    var pt = pointers[e.pointerId];
    if (!pt) return;
    delete pointers[e.pointerId];
    if (screen !== 'play' || !game || e.type === 'pointercancel') return;
    if (!pt.hit && pt.moved < 14 && performance.now() - pt.t < 450) game.scene.world.tapCut(pt.x, pt.y);
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------------------------------------------------------------- icons

  var ICONS = {
    horns: '<path d="M4.5 20.5c-.4-5.6.6-11 3.4-16.5 1.9 4.3 3.1 9.5 3.3 16.5z" fill="currentColor"/><path d="M19.5 20.5c.4-5.6-.6-11-3.4-16.5-1.9 4.3-3.1 9.5-3.3 16.5z" fill="currentColor"/>',   // (おに)
    home: '<path d="M4 11.5 12 4.5l8 7V20h-5.5v-5.5h-5V20H4z"/>',
    retry: '<path d="M19 12.5a7 7 0 1 1-2.3-5.2"/><path d="M17.5 3v4.8h-4.8"/>',
    hint: '<path d="M9.2 17.5h5.6M10 20.5h4M12 3.5a5.8 5.8 0 0 0-3.6 10.3c.7.6.8 1.6.8 2.2h5.6c0-.6.1-1.6.8-2.2A5.8 5.8 0 0 0 12 3.5z"/>',
    back: '<path d="M14.5 5 7.5 12l7 7"/>',
    next: '<path d="M8 5l10 7-10 7z" fill="currentColor"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/>',
    sfx: '<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z" fill="currentColor"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
    sfxOff: '<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    music: '<path d="M9 17.5V6.5l10-2v11"/><circle cx="6.8" cy="17.5" r="2.4" fill="currentColor"/><circle cx="16.8" cy="15.5" r="2.4" fill="currentColor"/>',
    musicOff: '<path d="M9 17.5V6.5l10-2v11"/><circle cx="6.8" cy="17.5" r="2.4" fill="currentColor"/><circle cx="16.8" cy="15.5" r="2.4" fill="currentColor"/><path d="M4 4l16 16"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="currentColor" stroke-linejoin="round"/>',
    install: '<path d="M12 4v10M7.5 9.5 12 14l4.5-4.5M5 19h14"/>',
    shop: '<path d="M5.5 8.5h13l-1.2 11.5H6.7z" fill="currentColor" fill-opacity=".25"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  function setIcon(el, name) { el.innerHTML = icon(name); }

  // ---------------------------------------------------------------- wiring

  function refreshToggles() {
    setIcon($('btn-sfx'), save.sfx ? 'sfx' : 'sfxOff');
    setIcon($('btn-music'), save.music ? 'music' : 'musicOff');
    $('btn-sfx').classList.toggle('off', !save.sfx);
    $('btn-music').classList.toggle('off', !save.music);
    SP.refresh();
  }
  // One kind of sound on or off, from the buttons on the title or from the sound window (the 🔊 on the other screens).
  function setSound(kind, value) {
    save[kind] = value; S.set(kind, value); store(); refreshToggles();
    if (kind === 'music') { if (value) S.startMusic(); else S.stopMusic(); } else S.play('click');
  }

  function wire() {
    document.querySelectorAll('[data-icon]').forEach(function (el) { setIcon(el, el.getAttribute('data-icon')); });
    document.querySelectorAll('#h-stars i, #clear-stars i').forEach(function (el) { el.innerHTML = icon('star'); });
    refreshShopBadge();
    refreshToggles();
    S.set('sfx', save.sfx); S.set('music', save.music);

    $('btn-play').addEventListener('click', function () { S.play('click'); forward(function () { go('worlds'); }); });
    $('btn-land').addEventListener('click', toLand);
    $('name-tag').addEventListener('click', function () { if (Accounts.list().length < 2) return; S.play('click'); openWho(); });
    $('who-close').addEventListener('click', function () { S.play('click'); hidePanel('who'); });
    ['sfx', 'music'].forEach(function (k) { $('btn-' + k).addEventListener('click', function () { setSound(k, !save[k]); }); });
    SP.init(['sfx', 'music'].map(function (k) {
      return { id: k, label: { sfx: 'こうかおん', music: 'おんがく' }[k], icon: k, get: function () { return save[k]; }, set: function (v) { setSound(k, v); } };
    }), { icon: icon, click: function () { S.play('click'); } });
    $('worlds-back').addEventListener('click', back);
    $('stages-back').addEventListener('click', back);
    $('h-home').addEventListener('click', back);
    $('h-retry').addEventListener('click', retry);
    $('h-hint').addEventListener('click', toggleHint);
    $('c-retry').addEventListener('click', function () { hidePanel('clear'); retry(); });
    $('c-next').addEventListener('click', nextStage);
    $('c-menu').addEventListener('click', function () { hidePanel('clear'); back(); });
    $('stages-oni').addEventListener('click', function () { S.play('click'); stagesOni = !stagesOni; buildStages(); });
    $('tip').addEventListener('click', hideTip);

    // shop
    $('btn-shop').addEventListener('click', function () { S.play('click'); forward(function () { go('shop'); }); });
    $('shop-back').addEventListener('click', back);
    $('buy-yes').addEventListener('click', confirmBuy);
    $('buy-no').addEventListener('click', function () { S.play('click'); buying = null; hidePanel('buy'); });

    // grown-ups: ⚙ -> password -> admin menu
    $('btn-admin').addEventListener('click', function () { S.play('click'); openPass(); });
    document.querySelectorAll('#pass .key').forEach(function (k) {
      k.addEventListener('click', function () { pressKey(k.getAttribute('data-k')); });
    });
    $('pass-close').addEventListener('click', function () { hidePanel('pass'); });
    $('p-all').addEventListener('click', function () { save.all = !save.all; store(); openAdmin(); });
    var resetArmed = false;
    $('p-reset').addEventListener('click', function () {
      if (!resetArmed) { resetArmed = true; $('p-reset').textContent = L('もう一度押すと消えます'); return; }
      save.stars = {}; save.seen = {}; save.all = false;
      save.spent = 0; save.owned = ['frog']; save.chara = 'frog';
      store(); resetArmed = false; openAdmin(); refreshShopBadge();
    });
    $('p-close').addEventListener('click', function () { resetArmed = false; hidePanel('parent'); });

    // "add to home screen" when the browser offers it
    var installEvt = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; $('btn-install').hidden = false; });
    $('btn-install').addEventListener('click', function () {
      if (!installEvt) return;
      installEvt.prompt();
      installEvt.userChoice.then(function () { installEvt = null; $('btn-install').hidden = true; });
    });
    window.addEventListener('appinstalled', function () { $('btn-install').hidden = true; });
  }

  // ---------------------------------------------------------------- main loop

  var lastT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now; clock += dt;
    if (screen === 'play' && game) {
      if (!SP.isOpen()) updatePlay(dt);   // (the game waits while the sound window is open)
      drawBackground(WORLDS[game.wi].theme, game.oni);
      if (game) { game.scene.draw(ctx, game.hintOn ? game.hint : null); drawOni(ctx); }
    } else if (screen === 'title') {
      updateDemo(dt);
      drawBackground(0);
      demo.draw(ctx, demo.hint);
    } else if (screen === 'shop') {
      updateShop(dt);
      drawBackground(1);
      worldTransform(ctx);
      drawFx(ctx, shop.fx);
    } else {
      drawBackground(screen === 'stages' ? WORLDS[curWorld].theme : 0);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  // the chosen language (js/lang.js): the title logo and the fixed text of the page
  Lang.logo($('logo'), Lang.pick(GAME_LOGO), ['#86d65c', '#ff8fc0', '#ffb347', '#6cc6ff', '#b58cff', '#ff8fc0', '#ffd23d', '#86d65c', '#6cc6ff']);
  Lang.apply();
  wire();
  history.replaceState({ d: 0 }, '');
  go('title');
  requestAnimationFrame(frame);

  // Offline play and updates. sw.js keeps the game on the phone. A new version is looked for whenever
  // the game is opened or comes back to the front; once it is stored (the new sw.js takes over at once),
  // the page reloads itself as soon as the title screen is showing, so the phone never keeps an old version.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    var swReg = null, swHad = !!navigator.serviceWorker.controller, swNew = false;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (r) { swReg = r; }).catch(function () {});
    var swCheck = function () { if (swReg && !document.hidden) swReg.update().catch(function () {}); };
    document.addEventListener('visibilitychange', swCheck);
    window.addEventListener('pageshow', function (e) { if (e.persisted) swCheck(); });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (swHad) swNew = true;   // (not the first time the game is stored)
      swHad = true;
    });
    setInterval(function () {
      if (swNew && !document.hidden && screen === 'title' && depth === 0 && !document.querySelector('.panel.on')) { swNew = false; location.reload(); }
    }, 700);
  }

  // for playtesting from the browser console
  window.KERO = { save: save, get game() { return game; }, startLevel: startLevel, WORLDS: WORLDS };
}());
