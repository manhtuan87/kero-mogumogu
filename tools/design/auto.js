// Solve -> pick the most forgiving solution -> put stars on its path -> report.
// candidate options: order (force action order, e.g. 'c0 p'), starsOn, stars (fixed), search {grid,T,max,puffs}
const path = require('path');
const E = require(require('path').join(__dirname, '..', '..', 'js', 'engine.js'));
const file = path.resolve(process.argv[2]);
const only = process.argv.slice(3);
const cands = require(file);

function searchAll(level, o) {
  o = Object.assign({ grid: 0.1, T: 7, max: 3, puffs: 4 }, o || {});
  const seqOrder = o.order ? o.order.split(' ') : null;
  if (seqOrder) o.max = seqOrder.length;
  const spp = Math.round(o.grid / E.DT), found = [];
  const acts = w => { const a = []; w.ropes.forEach(r => a.push('c' + r.id)); if (w.candy.bubble >= 0) a.push('p'); w.blowers.forEach((b, i) => a.push('b' + i)); return a; };
  const adv = w => { for (let i = 0; i < spp && w.state === 'play'; i++) w.step(); };
  function run(w, seq, puffs) {
    if (w.state === 'won') { found.push({ seq: seq.slice(), stars: w.got }); return; }
    if (w.state === 'lost' || w.t >= o.T) return;
    if (seq.length < o.max && !(seq.length === 0 && w.held && w.t > 0.55)) {
      for (const a of acts(w)) {
        if (seqOrder && a !== seqOrder[seq.length]) continue;
        if (a[0] === 'b' && puffs >= o.puffs) continue;
        const c = w.clone(); c.act(a); seq.push({ a, t: +w.t.toFixed(3) }); adv(c); run(c, seq, puffs + (a[0] === 'b')); seq.pop();
      }
    }
    // first action always at 0.5 (the treat waits for it anyway)
    if (seq.length === 0 && w.t >= 0.45 && w.held) return;
    adv(w); run(w, seq, puffs);
  }
  run(new E.World(level, { fast: true }), [], 0);
  return found;
}

function best(found, order) {
  const groups = {};
  for (const f of found) { const k = f.seq.map(s => s.a).join(' '); (groups[k] = groups[k] || []).push(f); }
  let pick = null;
  for (const [k, list] of Object.entries(groups)) {
    if (order && k !== order) continue;
    const top = Math.max(...list.map(f => f.stars));
    const good = list.filter(f => f.stars === top);
    // most neighbours within 0.25s on every action = most forgiving
    let bestF = null, bestN = -1;
    for (const f of good) {
      let n = 0;
      for (const g of good) if (g.seq.every((s, i) => Math.abs(s.t - f.seq[i].t) <= 0.25)) n++;
      if (n > bestN) { bestN = n; bestF = f; }
    }
    const score = top * 1000 + bestN - k.split(' ').length * 3;
    if (!pick || score > pick.score) pick = { key: k, f: bestF, n: bestN, score, count: good.length, stars: top };
  }
  return pick;
}

function samplePath(lv, sol) {
  const w = new E.World(lv, { fast: true }), acts = E.parseSol(sol);
  let ai = 0; const pts = [];
  while (w.state === 'play' && w.t < 14) {
    while (ai < acts.length && acts[ai].t <= w.t + 1e-9) { w.act(acts[ai].a); ai++; }
    w.step();
    if (!w.held) pts.push([w.candy.x, w.candy.y]);
  }
  return pts;
}
function starsAlong(lv, pts, fr) {
  const fx = lv.frog[0], fy = lv.frog[1];
  let end = pts.length;
  for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i][0] - fx, pts[i][1] - fy) < 75) { end = i; break; }
  const p = pts.slice(0, end), cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const L = cum[cum.length - 1];
  return fr.map(f => { let i = cum.findIndex(c => c >= f * L); if (i < 0) i = p.length - 1; return [Math.round(p[i][0]), Math.round(p[i][1])]; });
}
function fmt(lv) {
  const keys = ['candy', 'frog', 'ropes', 'stars', 'bubbles', 'blowers', 'hooks', 'pads', 'spikes'];
  const parts = keys.filter(k => lv[k] && lv[k].length).map(k => `${k}: ${JSON.stringify(lv[k]).replace(/,/g, ', ')}`);
  parts.push(`sol: '${lv.sol}'`);
  if (lv.tip) parts.push(`tip: '${lv.tip}'`);
  if (lv.live) parts.push('live: true');
  return `{ ${parts.join(', ')} }`;
}
function windows(lv) {
  const acts = E.parseSol(lv.sol), res = E.run(lv, acts, 15);
  return acts.map((a, i) => {
    let lo = 0, hi = 0;
    const ok = d => { const b = acts.map((x, j) => (j === i ? { a: x.a, t: x.t + d } : x)); if (b[i].t < 0) return false; for (let j = 1; j < b.length; j++) if (b[j].t < b[j - 1].t) return false; const r = E.run(lv, b, 15); return r.state === 'won'; };
    for (let d = 0.05; d <= 1; d += 0.05) { if (ok(-d)) lo = d; else break; }
    for (let d = 0.05; d <= 1; d += 0.05) { if (ok(d)) hi = d; else break; }
    return (lo + hi).toFixed(2);
  }).join('/');
}

for (const [name, c] of Object.entries(cands)) {
  if (only.length && !only.includes(name)) continue;
  const t0 = Date.now();
  const lv = Object.assign({}, c); if (!c.stars) delete lv.stars;
  const found = searchAll(lv, Object.assign({}, c.search, c.order ? { order: c.order } : {}));
  const pick = best(found, c.order);
  if (!pick) { console.log(`## ${name}: NO SOLUTION (${((Date.now() - t0) / 1000).toFixed(1)}s)`); continue; }
  const isLive = lv.live || (lv.ropes || []).some(r => r[3] != null);
  const shift = isLive ? 0 : 0.5 - pick.f.seq[0].t;
  lv.sol = c.sol || pick.f.seq.map(s => `${s.a}@${(s.t + shift).toFixed(2).replace(/0$/, '')}`).join(' ');
  lv.stars = c.stars || starsAlong(lv, samplePath(lv, lv.sol), c.starsOn || [0.25, 0.55, 0.85]);
  const r = E.run(lv, lv.sol, 15), idle = E.run(lv, [], 10);
  // how many other ways get 3 stars (lower = stars need the right play)
  const all3 = c.skipAlt ? [] : searchAll(lv, Object.assign({}, c.search, { grid: 0.25, max: Math.min(3, (c.search && c.search.max) || 3), puffs: 2 })).filter(f => f.stars === 3);
  const orders = [...new Set(all3.map(f => f.seq.map(s => s.a).join(' ')))];
  const close = []; for (let i = 0; i < lv.stars.length; i++) for (let j = i + 1; j < lv.stars.length; j++) if (Math.hypot(lv.stars[i][0] - lv.stars[j][0], lv.stars[i][1] - lv.stars[j][1]) < 40) close.push(`${i}-${j}`);
  console.log(`## ${name}: [${pick.key}] ${pick.count} combos, ${pick.n} neighbours -> ${r.state} ★${r.stars} idle:${idle.state} windows ${windows(lv)}s | 3★ orders: ${orders.slice(0, 4).join(' / ')}${close.length ? ' | STARS TOO CLOSE ' + close : ''} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  console.log('   ' + fmt(lv) + ',');
}
