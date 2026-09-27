// Put the frog on the treat's path after the N-th bounce, where no earlier part of the path comes close.
const E = require(require('path').join(__dirname, '..', '..', 'js', 'engine.js'));
function pathOf(level, sol) {
  const w = new E.World(Object.assign({}, level, { frog: [-999, -999] }), { fast: true }), acts = E.parseSol(sol);
  let ai = 0, bounces = 0; const pts = [];
  while (w.state === 'play' && w.t < 8) {
    while (ai < acts.length && acts[ai].t <= w.t + 1e-9) { w.act(acts[ai].a); ai++; }
    w.step();
    bounces += w.events.filter(e => e.type === 'bounce').length; w.events.length = 0;
    pts.push({ x: w.candy.x, y: w.candy.y, b: bounces, t: w.t });
  }
  return pts;
}
function spots(level, sol, needBounces) {
  const pts = pathOf(level, sol), out = [];
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    if (p.b < needBounces || p.x < 45 || p.x > 315 || p.y < 110 || p.y > 575) continue;
    const fx = Math.round(p.x), fy = Math.round(p.y + 25);   // frog slightly below the path
    const early = pts.slice(0, i).some(q => (q.x - fx) ** 2 + (q.y - fy) ** 2 < 52 * 52 && q.b < needBounces);
    if (!early) out.push({ fx, fy, t: p.t.toFixed(2) });
  }
  return out;
}
module.exports = { pathOf, spots };
if (require.main === module) {
  const cands = require(require('path').resolve(process.argv[2]));
  for (const [k, c] of Object.entries(cands)) {
    const s = spots(c, c.sol, c.bounces || 1);
    console.log(`## ${k}: ${s.length} spots` + (s.length ? ' e.g. ' + [s[0], s[Math.floor(s.length / 3)], s[Math.floor(2 * s.length / 3)], s[s.length - 1]].map(q => `(${q.fx},${q.fy})@${q.t}`).join(' ') : ''));
  }
}
