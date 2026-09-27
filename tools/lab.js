// Helpers for designing levels from the command line.
const path = require('path');
const E = require(path.join(__dirname, '..', 'js', 'engine.js'));

// Print the candy's path while a scripted solution plays out.
function trace(level, sol, T, every) {
  const w = new E.World(level, { fast: true });
  const acts = E.parseSol(sol || '');
  const out = [];
  let ai = 0, step = 0;
  T = T || 8; every = every || 12;
  while (w.t < T) {
    while (ai < acts.length && acts[ai].t <= w.t + 1e-9) { w.act(acts[ai].a); ai++; }
    w.step(); step++;
    if (step % every === 0) out.push(`t=${w.t.toFixed(2)} (${w.candy.x.toFixed(0)},${w.candy.y.toFixed(0)})${w.candy.bubble >= 0 ? ' [bubble]' : ''} ropes=${w.ropes.map(r => r.id).join(',')} stars=${w.got}`);
    if (w.state !== 'play') break;
  }
  out.push(`END t=${w.t.toFixed(2)} (${w.candy.x.toFixed(0)},${w.candy.y.toFixed(0)}) ${w.state} ${w.reason} stars=${w.got}`);
  return out.join('\n');
}

module.exports = { E, trace };
