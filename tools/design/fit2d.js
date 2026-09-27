// Frog placement that keeps BOTH the middle and the last action forgiving.
// cand: { level, pre, mid, midFrom, midTo, last, lastFrom, lastTo (relative to mid), xs, ys }
const E = require(require('path').join(__dirname, '..', '..', 'js', 'engine.js'));
const step = 0.05;
function sim(level, acts, T) {
  const w = new E.World(Object.assign({}, level, { frog: [-999, -999] }), { fast: true });
  let ai = 0; const before = [], between = [], after = [];
  const midT = acts[acts.length - 2].t, lastT = acts[acts.length - 1].t;
  while (w.state === 'play' && w.t < T) {
    while (ai < acts.length && acts[ai].t <= w.t + 1e-9) { w.act(acts[ai].a); ai++; }
    w.step();
    (w.t <= midT ? before : w.t <= lastT ? between : after).push(w.candy.x, w.candy.y);
  }
  return { before, between, after };
}
function fit(c) {
  const pre = E.parseSol(c.pre || '');
  const t1s = []; for (let t = c.midFrom; t <= c.midTo + 1e-9; t += step) t1s.push(+t.toFixed(3));
  const runs = t1s.map(t1 => {
    const t2s = []; for (let d = c.lastFrom; d <= c.lastTo + 1e-9; d += step) t2s.push(+(t1 + d).toFixed(3));
    return t2s.map(t2 => sim(c.level, pre.concat([{ a: c.mid, t: t1 }, { a: c.last, t: t2 }]), t2 + 3.5));
  });
  const R2 = E.P.eatR * E.P.eatR;
  const hit = (arr, fx, fy) => { for (let i = 0; i < arr.length; i += 2) if ((arr[i] - fx) ** 2 + (arr[i + 1] - fy) ** 2 < R2) return true; return false; };
  const out = [];
  for (const fx of c.xs) for (const fy of c.ys) {
    if (runs.some(r => r.some(x => hit(x.before, fx, fy)))) continue;
    const perT1 = runs.map(r => {
      let best = 0, cur = 0, bestEnd = -1;
      r.forEach((x, j) => { if (!hit(x.between, fx, fy) && hit(x.after, fx, fy)) { cur++; if (cur > best) { best = cur; bestEnd = j; } } else cur = 0; });
      return { w: best * step, center: bestEnd - Math.floor(best / 2) };
    });
    let best = 0, cur = 0, bestEnd = -1;
    perT1.forEach((p, i) => { if (p.w >= 0.3) { cur++; if (cur > best) { best = cur; bestEnd = i; } } else cur = 0; });
    if (!best) continue;
    const ci = bestEnd - Math.floor(best / 2);
    const t1 = t1s[ci], t2 = +(t1 + c.lastFrom + perT1[ci].center * step).toFixed(2);
    out.push({ fx, fy, midWin: best * step, lastWin: perT1[ci].w, sol: `${c.pre ? c.pre + ' ' : ''}${c.mid}@${t1} ${c.last}@${t2}` });
  }
  out.sort((a, b) => Math.min(b.midWin, b.lastWin) - Math.min(a.midWin, a.lastWin) || (b.midWin + b.lastWin) - (a.midWin + a.lastWin));
  return out;
}
module.exports = { fit };
if (require.main === module) {
  const path = require('path');
  const cands = require(path.resolve(process.argv[2]));
  for (const [name, c] of Object.entries(cands)) {
    if (process.argv[3] && process.argv[3] !== name) continue;
    const t0 = Date.now();
    const r = fit(c);
    console.log(`## ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    r.slice(0, 6).forEach(x => console.log(`  frog (${x.fx},${x.fy}) mid ${x.midWin.toFixed(2)}s last ${x.lastWin.toFixed(2)}s  sol "${x.sol}"`));
    if (!r.length) console.log('  none');
  }
}
