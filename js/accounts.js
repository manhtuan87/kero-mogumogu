/* The players of the ケロちゃん games (the same file in every app on the site).
   Chosen and edited in ケロちゃん ランド (the menu) and in the games; kept in localStorage 'kero-users', so every game
   knows who is playing and the list is the same everywhere:
     { v: 1, users: [{ id: 'k1', name: 'はなこ', type: 'kid' | 'adult', color: 0..5 }], cur: 'k1', next: 2, claimed: true }
   Each game keeps its own records per player, under these ids. Ids are never used again, so a new player never gets
   the records of one that was removed. The name of the player now playing is also kept in 'kero-name' (older key). */
var Accounts = (function () {
  'use strict';
  var KEY = 'kero-users', NAME_KEY = 'kero-name', MAX = 4, NAME_MAX = 10;
  var COLORS = ['#86d65c', '#ff8fc0', '#6cc6ff', '#ffb347', '#b58cff', '#ffd23d'];

  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function raw() { var ls = store(); try { return ls ? ls.getItem(KEY) : null; } catch (e) { return null; } }
  function oldName() { var ls = store(); try { return ((ls && ls.getItem(NAME_KEY)) || '').trim().slice(0, NAME_MAX); } catch (e) { return ''; } }
  function int(v, a, b) { v = Math.round(+v); return isFinite(v) ? Math.max(a, Math.min(b, v)) : a; }

  // A list read back safely; with nothing saved yet, one player (with the nickname set in the menu before, if any).
  function clean(text) {
    var s = null;
    try { s = JSON.parse(text); } catch (e) { s = null; }
    var out = { v: 1, users: [], cur: '', next: 2, claimed: false };
    if (s && typeof s === 'object' && Array.isArray(s.users)) {
      s.users.forEach(function (u) {
        if (!u || typeof u.id !== 'string' || !/^k\d+$/.test(u.id) || out.users.length >= MAX) return;
        if (out.users.some(function (x) { return x.id === u.id; })) return;
        out.users.push({ id: u.id, name: typeof u.name === 'string' ? u.name.trim().slice(0, NAME_MAX) : '',
          type: u.type === 'adult' ? 'adult' : 'kid', color: int(u.color, 0, COLORS.length - 1) });
      });
      out.next = int(s.next, 2, 1e9);
      out.claimed = !!s.claimed;
      out.cur = typeof s.cur === 'string' ? s.cur : '';
    }
    if (!out.users.length) { var n = oldName(); out.users.push({ id: 'k1', name: n, type: 'kid', color: 0 }); out.claimed = !!n; }
    out.users.forEach(function (u) { var m = /^k(\d+)$/.exec(u.id); out.next = Math.max(out.next, +m[1] + 1); });
    if (!out.users.some(function (u) { return u.id === out.cur; })) out.cur = out.users[0].id;
    return out;
  }

  var state = clean(raw()), saved = null;
  function write() {
    var ls = store(), text = JSON.stringify(state);
    saved = text;
    if (!ls) return;
    try {
      ls.setItem(KEY, text);
      var n = cur().name;
      if (n) ls.setItem(NAME_KEY, n); else ls.removeItem(NAME_KEY);
    } catch (e) { /* ignore */ }
  }
  if (raw() == null) write(); else saved = raw();

  function copy(u) { return { id: u.id, name: u.name, type: u.type, color: u.color }; }
  function find(id) { for (var i = 0; i < state.users.length; i++) if (state.users[i].id === id) return state.users[i]; return null; }
  function cur() { return find(state.cur) || state.users[0]; }
  function freeColor(want) {
    var used = state.users.map(function (u) { return u.color; });
    if (want != null && used.indexOf(want) < 0) return want;
    for (var c = 0; c < COLORS.length; c++) if (used.indexOf(c) < 0) return c;
    return 0;
  }

  // (another page of the site may have changed the list meanwhile)
  function reload() { state = clean(raw()); saved = raw(); }
  function changed() { return raw() !== saved; }

  function setCur(id) { reload(); if (find(id)) { state.cur = id; write(); } }
  function add(name, type, color) {
    reload();
    if (state.users.length >= MAX) return null;
    var u = { id: 'k' + state.next++, name: String(name || '').trim().slice(0, NAME_MAX), type: type === 'adult' ? 'adult' : 'kid', color: freeColor(color) };
    state.users.push(u);
    state.claimed = true;
    write();
    return copy(u);
  }
  function update(id, o) {
    reload();
    var u = find(id);
    if (!u) return null;
    if (o.name != null) u.name = String(o.name).trim().slice(0, NAME_MAX);
    if (o.type) u.type = o.type === 'adult' ? 'adult' : 'kid';
    if (o.color != null) u.color = int(o.color, 0, COLORS.length - 1);
    state.claimed = true;
    write();
    return copy(u);
  }
  // The last player stays (there is always someone playing).
  function remove(id) {
    reload();
    if (state.users.length <= 1 || !find(id)) return false;
    state.users = state.users.filter(function (u) { return u.id !== id; });
    if (state.cur === id) state.cur = state.users[0].id;
    state.claimed = true;
    write();
    return true;
  }

  /* A game's own players from before this list existed ({ id, name, type, color }) join the list:
     - the same name is the same player;
     - a game's first player is the phone's first player (the child the games were made for), whatever its name;
       while that one is still untouched, it takes the game's player as it is;
     - an unnamed one takes an unnamed player;
     - anyone else is added while there is room.
     Returns { the game's id: the shared id } (a player that found no place is left out). */
  function adopt(list) {
    reload();
    var map = {}, taken = {};
    var key = function (s) { return String(s || '').trim().toLowerCase(); };
    list = list || [];
    // first everyone whose name is already there, then the rest
    list.forEach(function (g) {
      var nm = key(g.name), hit = null;
      if (nm) state.users.forEach(function (u) { if (!hit && !taken[u.id] && key(u.name) === nm) hit = u; });
      if (hit) { taken[hit.id] = true; map[g.id] = hit.id; }
    });
    list.forEach(function (g, i) {
      if (map[g.id]) return;
      var nm = key(g.name), hit = null;
      if (i === 0 && !taken[state.users[0].id]) {
        hit = state.users[0];
        if (!state.claimed) { hit.type = g.type === 'adult' ? 'adult' : 'kid'; hit.color = int(g.color, 0, COLORS.length - 1); }
        if (!hit.name && nm) hit.name = String(g.name).trim().slice(0, NAME_MAX);
      }
      if (!hit && !nm) state.users.forEach(function (u) { if (!hit && !taken[u.id] && !key(u.name)) hit = u; });
      if (!hit && state.users.length < MAX) {
        hit = { id: 'k' + state.next++, name: String(g.name || '').trim().slice(0, NAME_MAX), type: g.type === 'adult' ? 'adult' : 'kid', color: freeColor(int(g.color, 0, COLORS.length - 1)) };
        state.users.push(hit);
      }
      if (hit) { taken[hit.id] = true; map[g.id] = hit.id; }
    });
    state.claimed = true;
    write();
    return map;
  }

  return {
    KEY: KEY, MAX: MAX, NAME_MAX: NAME_MAX, COLORS: COLORS,
    list: function () { return state.users.map(copy); },
    cur: function () { return copy(cur()); },
    get: function (id) { var u = find(id); return u ? copy(u) : null; },
    setCur: setCur, add: add, update: update, remove: remove, adopt: adopt, reload: reload, changed: changed
  };
}());
