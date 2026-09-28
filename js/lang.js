/* Languages of the ケロちゃん games (the same file in every game on the site).
   The language is chosen in ケロちゃん ランド and shared by every game (localStorage 'kero-lang').
   Japanese is the games' own text and the key of every translation:
     L('あそびたい ゲームを えらんでね！')      → the text in the chosen language (Japanese when there is none)
     L('スタンプ {n}こめ！', { n: 3 })           → parts that change go in braces
   Each game adds its own table with Lang.add({ '日本語': ['Tiếng Việt', 'English', '한국어'], ... }).
   Lang.apply() translates the fixed text of the page (text, placeholder, aria-label, title). */
var Lang = (function () {
  'use strict';
  var LIST = [
    { id: 'ja', name: '日本語' },
    { id: 'vi', name: 'Tiếng Việt' },
    { id: 'en', name: 'English' }
    // { id: 'ko', name: '한국어' }   // Korean is switched off for now (2026-09-29); its translations stay in the tables
  ];
  var KEY = 'kero-lang', IDX = { vi: 0, en: 1 /* , ko: 2 */ };   // (a phone that had chosen Korean shows Japanese)
  var JA = /[぀-ヿ㐀-鿿！-～]/;   // kana, kanji, full-width marks
  function read() {
    try { var v = localStorage.getItem(KEY); return IDX[v] != null ? v : 'ja'; } catch (e) { return 'ja'; }
  }
  var cur = read();
  var dict = {}, missing = {};

  function add(table) { for (var k in table) if (Object.prototype.hasOwnProperty.call(table, k)) dict[k] = table[k]; }
  function fill(s, vars) {
    return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s;
  }
  function L(ja, vars) {
    var s = ja;
    if (cur !== 'ja') {
      var e = dict[ja];
      if (e && e[IDX[cur]] != null) s = e[IDX[cur]];
      else missing[ja] = true;
    }
    return fill(s, vars);
  }
  // One value per language, e.g. Lang.pick({ ja: [...], vi: [...], en: [...], ko: [...] }).
  function pick(table) { return table[cur] != null ? table[cur] : table.ja; }

  function apply(root) {
    try { document.documentElement.lang = cur; } catch (e) { /* ignore */ }
    if (cur === 'ja') return;
    root = root || document.body;
    if (root === document.body && document.title) document.title = L(document.title);
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, nodes = [];
    while ((n = walk.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var raw = node.nodeValue, key = raw.trim();
      if (key && JA.test(key)) node.nodeValue = raw.replace(key, L(key));
    });
    ['placeholder', 'aria-label', 'title'].forEach(function (a) {
      root.querySelectorAll('[' + a + ']').forEach(function (el) {
        var v = el.getAttribute(a);
        if (v && JA.test(v)) el.setAttribute(a, L(v));
      });
    });
  }

  // A title logo: one row per line, every letter a <b> that hops on its own (the CSS makes them hop),
  // coloured in turn from `colors`. Latin letters are narrower, so the logo gets the class "latin".
  function logo(el, rows, colors) {
    var d = 0, ci = 0;
    el.innerHTML = '';
    el.classList.toggle('latin', cur === 'vi' || cur === 'en');
    rows.forEach(function (row, r) {
      var line = document.createElement('span');
      line.className = 'l' + (r + 1);
      Array.from(row).forEach(function (ch) {
        var b = document.createElement('b');
        if (ch === ' ') { b.className = 'gap'; b.innerHTML = '&nbsp;'; }
        else { b.textContent = ch; b.style.color = colors[ci++ % colors.length]; }
        b.style.setProperty('--d', d++);
        line.appendChild(b);
      });
      el.appendChild(line);
    });
  }

  function set(id) {
    if (IDX[id] == null && id !== 'ja') return;
    try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    cur = id;
  }

  // A page kept in the background while the language was changed in the menu starts again in the new language.
  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', function (e) { if (e.persisted && read() !== cur) location.reload(); });
  }

  return {
    L: L, add: add, pick: pick, apply: apply, logo: logo, set: set, LIST: LIST, missing: missing, hasJapanese: function (s) { return JA.test(s); },
    get cur() { return cur; }
  };
}());
var L = Lang.L;
