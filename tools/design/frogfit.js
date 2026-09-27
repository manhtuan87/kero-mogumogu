// Find frog positions that make the LAST action of a solution forgiving.
// cand: { level (frog ignored), pre: 'c0@0.6', last: 'c1', from: 0.7, to: 3.5, xs:[..], ys:[..] }
const E = require(require('path').join(__dirname, '..', '..', 'js', 'engine.js'));
function trajectories(c) {
  const out = [];
  for (let t = c.from; t <= c.to + 1e-9; t += 0.02) {
    const lv = Object.assign({}, c.level, { frog: [-999, -999] });
    const w = new E.World(lv, { fast: true });
    const acts = E.parseSol(c.pre || '').concat([{ a: c.last, t }]);
    const need = c.needEvent || (c.needBounce ? 'bounce' : null);
    let ai = 0, bounced = !need; const pre = [], post = [];
    while (w.state === 'play' && w.t < t + 3.5) {
      while (ai < acts.length && acts[ai].t <= w.t + 1e-9) { w.act(acts[ai].a); ai++; }
      w.step();
      if (need && w.events.some(e => e.type === need)) bounced = true;
      w.events.length = 0;
      if (ai >= acts.length) { if (bounced) post.push([w.candy.x, w.candy.y]); else pre.push([w.candy.x, w.candy.y]); }
      else pre.push([w.candy.x, w.candy.y]);
    }
    out.push({ t, pre, post });
  }
  return out;
}
function fit(c) {
  const tr = trajectories(c);
  const res = [];
  const R2 = E.P.eatR * E.P.eatR;
  for (const fx of c.xs) for (const fy of c.ys) {
    const hitPre = tr.map(x => x.pre.some(p => (p[0] - fx) ** 2 + (p[1] - fy) ** 2 < R2));
    if (hitPre.some(Boolean)) continue;          // frog would eat it before the last action
    const ok = tr.map(x => x.post.some(p => (p[0] - fx) ** 2 + (p[1] - fy) ** 2 < R2));
    let best = 0, run = 0, bestEnd = 0, total = 0;
    ok.forEach((v, i) => { if (v) { run++; total++; if (run > best) { best = run; bestEnd = i; } } else run = 0; });
    if (best) res.push({ fx, fy, win: best * 0.02, total: total * 0.02, center: tr[bestEnd - Math.floor(best / 2)].t });
  }
  res.sort((a, b) => b.win - a.win || b.total - a.total);
  return res;
}
module.exports = { fit };
if (require.main === module) {
  const path = require('path');
  const cands = require(path.resolve(process.argv[2]));
  for (const [name, c] of Object.entries(cands)) {
    if (process.argv[3] && process.argv[3] !== name) continue;
    const r = fit(c);
    console.log(`## ${name}`);
    r.slice(0, 8).forEach(x => console.log(`  frog (${x.fx},${x.fy}) window ${x.win.toFixed(2)}s (total ${x.total.toFixed(2)}) center t=${x.center.toFixed(2)}`));
  }
}
