// Searches for action sequences that clear a stage (design aid).
// usage: node tools/solve.js 2-5 [--grid 0.2] [--T 6] [--max 3] [--puffs 3]
const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'engine.js'));

function search(level, o) {
  o = Object.assign({ grid: 0.2, T: 6, max: 3, puffs: 3 }, o || {});
  const stepsPerSlot = Math.round(o.grid / E.DT);
  const found = [];
  function actions(w) {
    const out = [];
    w.ropes.forEach(r => out.push('c' + r.id));
    if (w.candy.bubble >= 0) out.push('p');
    w.blowers.forEach((b, i) => out.push('b' + i));
    return out;
  }
  function advance(w) { for (let i = 0; i < stepsPerSlot && w.state === 'play'; i++) w.step(); }
  function run(w, seq, puffs) {
    if (w.state === 'won') { found.push({ seq: seq.slice(), stars: w.got, t: w.t }); return; }
    if (w.state === 'lost' || w.t >= o.T) return;
    if (seq.length < o.max) {
      for (const a of actions(w)) {
        if (a[0] === 'b' && puffs >= o.puffs) continue;
        const c = w.clone();
        c.act(a);
        seq.push({ a, t: +w.t.toFixed(3) });
        advance(c); run(c, seq, puffs + (a[0] === 'b' ? 1 : 0));
        seq.pop();
      }
    }
    advance(w); run(w, seq, puffs);
  }
  run(new E.World(level, { fast: true }), [], 0);
  const groups = {};
  for (const f of found) {
    const key = f.seq.map(s => s.a).join(' ');
    const g = groups[key] || (groups[key] = { key, n: 0, best: 0, list: [] });
    g.n++; g.best = Math.max(g.best, f.stars); g.list.push(f);
  }
  const rows = Object.values(groups).sort((a, b) => b.best - a.best || a.key.split(' ').length - b.key.split(' ').length || b.list.filter(f => f.stars === b.best).length - a.list.filter(f => f.stars === a.best).length);
  return rows.map(g => {
    const top = g.list.filter(f => f.stars === g.best);
    const mid = top[Math.floor(top.length / 2)];
    return { key: g.key, stars: g.best, count: top.length, wins: g.n, example: mid.seq.map(s => s.a + '@' + s.t.toFixed(1)).join(' ') };
  });
}

function report(level, o, limit) {
  const t0 = Date.now();
  const rows = search(level, o);
  const lines = rows.slice(0, limit || 6).map(r => `  ★${r.stars} [${r.key}] ${r.count}/${r.wins} combos  "${r.example}"`);
  if (!rows.length) lines.push('  (no way to win found)');
  return `${lines.join('\n')}\n  (${((Date.now() - t0) / 1000).toFixed(1)}s)`;
}

module.exports = { search, report };

if (require.main === module) {
  const WORLDS = require(path.join(__dirname, '..', 'js', 'levels.js'));
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? +process.argv[i + 1] : d; };
  const [w, s] = process.argv[2].split('-').map(Number);
  console.log(report(WORLDS[w - 1].stages[s - 1], { grid: arg('grid', 0.2), T: arg('T', 6), max: arg('max', 3), puffs: arg('puffs', 3) }, 12));
}
