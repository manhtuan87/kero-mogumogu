/* ケロちゃん もぐもぐ — sound effects and music, synthesised with Web Audio
   (no audio files, so the game stays tiny and works offline). */
var Sound = (function () {
  'use strict';
  var ac = null, master, sfxBus, musicBus, noiseBuf;
  var on = { sfx: true, music: true };
  var MUSIC_VOL = 0.2;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = on.sfx ? 0.8 : 0; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = on.music ? MUSIC_VOL : 0; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (music.want) startMusic();
  }

  function ready() { return ac && ac.state === 'running'; }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  // o: { f, f2, type, vol, a, d, when, bus, at }
  function tone(o) {
    if (!ac) return;
    var t = (o.at || ac.currentTime) + (o.when || 0), a = o.a || 0.008, d = o.d || 0.2;
    var osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
    env(g, t, a, o.vol || 0.3, d);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + a + d + 0.05);
  }

  // o: { type, f, f2, q, vol, a, d, when, bus, at }
  function noise(o) {
    if (!ac) return;
    var t = (o.at || ac.currentTime) + (o.when || 0), a = o.a || 0.004, d = o.d || 0.1;
    var src = ac.createBufferSource(); src.buffer = noiseBuf;
    var flt = ac.createBiquadFilter(); flt.type = o.type || 'bandpass';
    flt.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) flt.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
    flt.Q.value = o.q || 1;
    var g = ac.createGain(); env(g, t, a, o.vol || 0.3, d);
    src.connect(flt); flt.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + a + d + 0.05);
  }

  function semi(f, n) { return f * Math.pow(2, n / 12); }

  var fx = {
    cut: function () {
      noise({ type: 'highpass', f: 2600, vol: 0.32, d: 0.08 });
      tone({ f: 1900, f2: 800, type: 'triangle', vol: 0.1, d: 0.08 });
    },
    star: function (n) {
      var base = [0, 4, 7][Math.max(0, Math.min(2, n - 1))];
      [0, 7, 12].forEach(function (s, i) { tone({ f: semi(1046.5, base + s), type: 'triangle', vol: 0.16, d: 0.22, when: i * 0.055 }); });
      tone({ f: semi(2093, base + 12), type: 'sine', vol: 0.06, d: 0.3, when: 0.16 });
    },
    bubble: function () { tone({ f: 280, f2: 760, type: 'sine', vol: 0.22, d: 0.28 }); },
    pop: function () {
      noise({ type: 'bandpass', f: 1900, q: 2, vol: 0.5, d: 0.05 });
      tone({ f: 650, f2: 1500, type: 'sine', vol: 0.2, d: 0.06 });
    },
    puff: function () {
      noise({ type: 'lowpass', f: 2200, f2: 300, vol: 0.5, a: 0.03, d: 0.38 });
      tone({ f: 220, f2: 140, type: 'sine', vol: 0.08, d: 0.3 });
    },
    boing: function () {
      tone({ f: 170, f2: 560, type: 'sine', vol: 0.32, d: 0.26 });
      tone({ f: 340, f2: 1100, type: 'triangle', vol: 0.07, d: 0.2 });
    },
    hook: function () {
      tone({ f: 1500, type: 'square', vol: 0.05, d: 0.05 });
      tone({ f: 2250, type: 'square', vol: 0.045, d: 0.07, when: 0.055 });
    },
    open: function () { tone({ f: 420, f2: 640, type: 'sine', vol: 0.12, d: 0.14 }); },
    eat: function () {
      for (var i = 0; i < 3; i++) {
        noise({ type: 'lowpass', f: 1100, vol: 0.4, d: 0.07, when: i * 0.17 });
        tone({ f: 230 - i * 22, type: 'sine', vol: 0.22, d: 0.09, when: i * 0.17 });
      }
      tone({ f: 520, f2: 170, type: 'sine', vol: 0.26, d: 0.2, when: 0.55 });
    },
    win: function () {
      [0, 4, 7, 12].forEach(function (s, i) { tone({ f: semi(523.25, s), type: 'triangle', vol: 0.2, d: 0.2, when: 0.75 + i * 0.11 }); });
      [0, 4, 7].forEach(function (s) { tone({ f: semi(1046.5, s), type: 'triangle', vol: 0.1, d: 0.6, when: 1.2 }); });
    },
    lose: function () {
      tone({ f: 440, f2: 370, type: 'triangle', vol: 0.18, d: 0.22 });
      tone({ f: 370, f2: 262, type: 'triangle', vol: 0.18, d: 0.4, when: 0.26 });
    },
    spike: function () {
      noise({ type: 'lowpass', f: 700, vol: 0.5, d: 0.2 });
      tone({ f: 220, f2: 90, type: 'square', vol: 0.08, d: 0.2 });
    },
    click: function () { tone({ f: 880, f2: 1320, type: 'triangle', vol: 0.14, d: 0.06 }); },
    resultStar: function (i) {
      tone({ f: semi(784, i * 4), type: 'triangle', vol: 0.2, d: 0.25 });
      tone({ f: semi(1568, i * 4), type: 'sine', vol: 0.08, d: 0.35 });
    },
    fanfare: function () {
      var seq = [0, 4, 7, 12, 7, 12, 16];
      seq.forEach(function (s, i) { tone({ f: semi(523.25, s), type: 'triangle', vol: 0.18, d: 0.18, when: i * 0.12 }); });
      [0, 4, 7, 12].forEach(function (s) { tone({ f: semi(523.25, s), type: 'triangle', vol: 0.09, d: 0.9, when: seq.length * 0.12 }); });
    }
  };

  function play(name, arg) {
    if (!ac || !on.sfx || !fx[name]) return;
    try { fx[name](arg); } catch (e) { /* audio is best-effort */ }
  }

  // ---------------------------------------------------------------- music
  // Eighth-note grid; "-" holds the previous note, "." is a rest.
  var SONG = {
    bpm: 112,
    lead: ('G4 C5 E5 C5 D5 E5 C5 . A4 C5 F5 E5 D5 - . . G4 B4 D5 B4 C5 D5 E5 . D5 C5 B4 C5 G4 - . . ' +
           'G4 C5 E5 C5 D5 E5 G5 . A5 G5 F5 E5 D5 - . . F5 E5 D5 C5 B4 C5 D5 . C5 - G4 - C5 - . . ' +
           'E5 - D5 C5 D5 - G4 . E5 - D5 C5 D5 - . . F5 - E5 D5 E5 - C5 . D5 E5 D5 C5 B4 - . . ' +
           'E5 - D5 C5 D5 - G4 . A4 B4 C5 D5 E5 - . . F5 E5 D5 C5 D5 - B4 . C5 - - - . . . .').split(' '),
    bass: ('C3 G3 C3 G3 F3 C4 F3 C4 G3 D4 G3 D4 G3 D4 G3 B3 C3 G3 C3 G3 F3 C4 F3 C4 G3 D4 G3 D4 C3 G3 C3 C3 ' +
           'C3 G3 E3 G3 A2 E3 A2 E3 F3 C4 F3 C4 G3 D4 G3 D4 C3 G3 E3 G3 F3 C4 F3 C4 G3 D4 G3 B3 C3 G3 C3 .').split(' ')
  };
  var NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function freq(n) {
    var m = /^([A-G])(#?)(\d)$/.exec(n);
    if (!m) return 0;
    return 440 * Math.pow(2, (NOTE[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3], 10) - 4) * 12) / 12);
  }

  var music = { want: false, timer: null, next: 0, step: 0, key: 0 };

  function scheduleMusic() {
    if (!ac) return;
    var eighth = 60 / SONG.bpm / 2, k = music.key;
    while (music.next < ac.currentTime + 0.25) {
      var s = music.step, t = music.next, n = SONG.lead[s];
      if (n !== '-' && n !== '.') {
        var len = 1;
        while (SONG.lead[(s + len) % SONG.lead.length] === '-') len++;
        tone({ f: semi(freq(n), k), type: 'triangle', vol: 0.3, a: 0.01, d: Math.min(0.9, eighth * len * 0.95), at: t, bus: musicBus });
        tone({ f: semi(freq(n), k + 12), type: 'sine', vol: 0.04, a: 0.01, d: eighth * 0.8, at: t, bus: musicBus });
      }
      if (s % 2 === 0) {
        var b = SONG.bass[(s / 2) % SONG.bass.length];
        if (b !== '.') tone({ f: semi(freq(b), k), type: 'sine', vol: 0.42, a: 0.01, d: eighth * 1.7, at: t, bus: musicBus });
      } else {
        noise({ type: 'highpass', f: 7000, vol: 0.05, d: 0.03, at: t, bus: musicBus });
      }
      music.next += eighth;
      music.step = (s + 1) % SONG.lead.length;
    }
  }

  function startMusic() {
    music.want = true;
    if (!ac || music.timer) return;
    music.next = ac.currentTime + 0.1;
    music.step = 0;
    music.timer = setInterval(scheduleMusic, 60);
  }

  function stopMusic() {
    music.want = false;
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
  }

  function setKey(k) { music.key = k; }

  function set(kind, value) {
    on[kind] = value;
    if (!ac) return;
    var now = ac.currentTime;
    if (kind === 'sfx') sfxBus.gain.setTargetAtTime(value ? 0.8 : 0, now, 0.02);
    if (kind === 'music') musicBus.gain.setTargetAtTime(value ? MUSIC_VOL : 0, now, 0.05);
  }

  function suspend() { if (ac && ac.state === 'running') ac.suspend(); }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  return { init: init, ready: ready, play: play, set: set, startMusic: startMusic, stopMusic: stopMusic, setKey: setKey, suspend: suspend, resume: resume };
}());
