// Picks 12 stages per world from the generator output (out/*.jsonl) and
// writes js/levels-more.js with worlds 6-15.
// usage: node select.js
'use strict';
const fs = require('fs');
const path = require('path');
const E = require(path.join(__dirname, '..', '..', 'js', 'engine.js'));
const { slack } = require(path.join(__dirname, '..', 'verify.js'));

// Timing slack measured exactly like tools/verify.js (the first action only
// counts when its timing matters, e.g. spinning spikes or moving pins).
function minClear(lv) {
  const timed = (lv.rotors || []).length || (lv.ropes || []).some(r => r[3] != null) || lv.live;
  const c = slack(lv).clears.map(w => w[0] + w[1]).filter((_, i) => i > 0 || timed);
  return c.length ? Math.min(...c) : 9;
}

const WORLDS = [
  { key: 'w6', name: 'キャンディの まきば', food: 'candy', theme: 0, music: 1 },
  { key: 'w7', name: 'いちごの おはなばたけ', food: 'strawberry', theme: 1, music: 3 },
  { key: 'w8', name: 'ドーナツの ふしぎな そら', food: 'donut', theme: 2, music: -1, intro: 'w8t', tip: 'warp' },
  { key: 'w9', name: 'クッキーの くるくる もり', food: 'cookie', theme: 3, music: 4, intro: 'w9t', tip: 'rotor' },
  { key: 'w10', name: 'にじいろ おまつり', food: 'mix', theme: 4, music: 6 },
  { key: 'w11', name: 'キャンディの ぼうけん', food: 'candy', theme: 0, music: -3 },
  { key: 'w12', name: 'いちごの おしろ', food: 'strawberry', theme: 1, music: 1 },
  { key: 'w13', name: 'ドーナツの ほしぞら', food: 'donut', theme: 2, music: -2 },
  { key: 'w14', name: 'クッキーの おおきな き', food: 'cookie', theme: 3, music: 2 },
  { key: 'w15', name: 'にじいろ グランプリ', food: 'mix', theme: 4, music: 7 }
];

function load(key) {
  const f = path.join(__dirname, 'out', key + '.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

// Drop candidates that look almost the same as one already chosen.
function similar(a, b) {
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  return d(a.level.candy, b.level.candy) < 30 && d(a.level.frog, b.level.frog) < 40 && a.tpl === b.tpl;
}

function pickSpread(list, n, minSlack) {
  const sorted = list.slice().sort((a, b) => a.diff - b.diff);
  const uniq = [];
  sorted.forEach(c => { if (!uniq.some(u => similar(u, c)) && minClear(c.level) >= minSlack) uniq.push(c); });
  if (uniq.length < n) throw new Error('not enough candidates: ' + uniq.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push(uniq[Math.round(i * (uniq.length - 1) / (n - 1))]);
  return out;
}

const KEYS = ['candy', 'frog', 'ropes', 'stars', 'bubbles', 'blowers', 'hooks', 'pads', 'spikes', 'hats', 'rotors'];
function fmt(lv) {
  const parts = KEYS.filter(k => lv[k] && lv[k].length).map(k => `${k}: ${JSON.stringify(lv[k]).replace(/,/g, ', ')}`);
  parts.push(`sol: '${lv.sol}'`);
  if (lv.tip) parts.push(`tip: '${lv.tip}'`);
  return `      { ${parts.join(', ')} }`;
}

const blocks = [];
let total = 0;
WORLDS.forEach(wd => {
  let chosen;
  if (wd.intro) {
    // the first stage with a new gimmick should be gentle: most slack wins
    const intro = load(wd.intro).map(c => ({ c, s: minClear(c.level) })).sort((a, b) => b.s - a.s)[0].c;
    intro.level.tip = wd.tip;
    chosen = [intro].concat(pickSpread(load(wd.key), 11, 0.3));
  } else chosen = pickSpread(load(wd.key), 12, 0.3);
  // sanity: every stage must still clear with 3 stars and not clear by itself
  chosen.forEach((c, i) => {
    const r = E.run(c.level, c.level.sol, 15);
    if (r.state !== 'won' || r.stars !== 3 || E.run(c.level, [], 12).state === 'won') throw new Error(wd.key + ' stage ' + (i + 1) + ' failed');
  });
  total += chosen.length;
  blocks.push(`    { name: '${wd.name}', food: '${wd.food}', theme: ${wd.theme}, key: ${wd.music}, stages: [\n${chosen.map(c => fmt(c.level)).join(',\n')}\n    ] }`);
  console.log(wd.key, chosen.map(c => c.diff).join(' '));
});

const js = `/* ケロちゃん もぐもぐ — worlds 6-15 (a bit harder), made with tools/design/gen.js
   and picked by tools/design/select.js. Same format as js/levels.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LEVELS_MORE = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
${blocks.join(',\n')}
  ];
}));
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'js', 'levels-more.js'), js);
console.log('wrote js/levels-more.js with', total, 'stages');
