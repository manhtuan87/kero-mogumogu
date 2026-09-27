// Checks every stage: the stored solution must win with all 3 stars,
// doing nothing must not win, and each action gets a timing window.
// usage: node tools/verify.js [1 | 1-3 ...]
const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'engine.js'));
const WORLDS = require(path.join(__dirname, '..', 'js', 'levels.js'));

const filters = process.argv.slice(2);
let bad = 0, total = 0;

// Shift action i by d seconds; later actions either move with it or stay put.
function shifted(acts, i, d, alone) { return acts.map((a, j) => (j === i || (j > i && !alone) ? { a: a.a, t: a.t + d } : a)); }

// How far action i can move (earlier / later) and still win
// (with the same stars, or with any stars when stars is null).
// (The better of: later actions keep their delay, or later actions keep their time,
// since a child reacts to what the treat is doing rather than to a clock.)
function window(lv, acts, i, stars) {
  const ok = r => r.state === 'won' && (stars == null || r.stars === stars);
  const one = alone => {
    let lo = 0, hi = 0;
    for (let d = 0.05; d <= 1.001; d += 0.05) {
      const b = shifted(acts, i, -d, alone);
      if (b[i].t < 0 || (i > 0 && b[i].t < acts[i - 1].t)) break;
      if (ok(E.run(lv, b, 15))) lo = d; else break;
    }
    for (let d = 0.05; d <= 1.001; d += 0.05) {
      const b = shifted(acts, i, d, alone);
      if (i + 1 < acts.length && alone && b[i].t > b[i + 1].t) break;
      if (ok(E.run(lv, b, 15))) hi = d; else break;
    }
    return [lo, hi];
  };
  // For the next-to-last action, also let the last action re-time itself
  // (what a child watching the treat would do).
  const adapt = () => {
    const last = acts.length - 1;
    const wins = d => {
      for (let d2 = -1; d2 <= 1.001; d2 += 0.05) {
        const b = acts.map((a, j) => (j === i ? { a: a.a, t: a.t + d } : j === last ? { a: a.a, t: a.t + d2 } : a));
        if (b[last].t <= b[i].t) continue;
        if (ok(E.run(lv, b, 15))) return true;
      }
      return false;
    };
    let lo = 0, hi = 0;
    for (let d = 0.05; d <= 1.001; d += 0.05) { if (acts[i].t - d < (i ? acts[i - 1].t : 0)) break; if (wins(-d)) lo = d; else break; }
    for (let d = 0.05; d <= 1.001; d += 0.05) { if (wins(d)) hi = d; else break; }
    return [lo, hi];
  };
  const a = one(false), b = i + 1 < acts.length ? one(true) : a;
  let best = a[0] + a[1] >= b[0] + b[1] ? a : b;
  if (i === acts.length - 2) { const c = adapt(); if (c[0] + c[1] > best[0] + best[1]) best = c; }
  return best;
}

function inBounds(lv) {
  const pts = [lv.candy, lv.frog].concat(lv.ropes || [], lv.stars || [], lv.bubbles || [], lv.blowers || [], lv.hooks || []);
  return pts.every(p => p[0] >= 10 && p[0] <= 350 && p[1] >= 60 && p[1] <= 625);
}

// Clear / 3-star timing slack of every action of a stage (tools/design/select.js uses it too).
function slack(lv) {
  const acts = E.parseSol(lv.sol);
  const res = E.run(lv, acts, 15);
  return {
    acts, res,
    wins: acts.map((a, i) => window(lv, acts, i, res.stars)),
    clears: acts.map((a, i) => window(lv, acts, i, null))
  };
}
module.exports = { slack };

if (require.main === module) WORLDS.forEach((wd, wi) => {
  wd.stages.forEach((lv, si) => {
    const id = `${wi + 1}-${si + 1}`;
    if (filters.length && !filters.some(f => f === id || f === String(wi + 1))) return;
    total++;
    const { acts, res, wins, clears } = slack(lv);
    const idle = E.run(lv, [], 10);
    const minW = wins.length ? Math.min(...wins.map(w => w[0] + w[1])) : 0;
    const minC = clears.length ? Math.min(...clears.map(w => w[0] + w[1])) : 0;
    const problems = [];
    if (res.state !== 'won') problems.push(`solution ${res.state}${res.reason ? '(' + res.reason + ')' : ''}`);
    if (res.stars < (lv.stars || []).length) problems.push(`stars ${res.stars}/${(lv.stars || []).length}`);
    if (idle.state === 'won') problems.push('wins with no action');
    if (!inBounds(lv)) problems.push('object out of bounds');
    if (problems.length) bad++;
    const wtxt = wins.map((w, i) => `${acts[i].a}@${acts[i].t}[${w[0] + w[1] ? (w[0] + w[1]).toFixed(2) : '0'}|${(clears[i][0] + clears[i][1]).toFixed(2)}]`).join(' ');
    console.log(`${problems.length ? 'NG' : 'ok'} ${id.padEnd(5)} ★${res.stars} t=${res.t.toFixed(1)} 3★win=${minW.toFixed(2)}s clear=${minC.toFixed(2)}s  ${wtxt}${problems.length ? '  <-- ' + problems.join(', ') : ''}`);
  });
});
if (require.main === module) {
  console.log(`\n${total - bad}/${total} stages OK`);
  process.exitCode = bad ? 1 : 0;
}
