/* The sound window of the ケロちゃん games (the same file in every game on the site).
   The title screen has a button for each kind of sound; every other screen has one 🔊 button
   (class "snd-btn", at the top right) that opens this small window with a switch for each kind:
   こえ (ケロはかせ's voice, in the games that have him), こうかおん, おんがく.
   While the window is open the game waits (it asks SoundPanel.isOpen()), and a tap anywhere
   outside the window only closes it (the game underneath never gets that tap).
     SoundPanel.init([{ id: 'sfx', label: 'こうかおん', icon: 'sfx', get: fn, set: fn(on) }, ...],
                     { icon: fn(name) → svg markup, click: fn (the tap sound), onOpen: fn, onClose: fn })
     SoundPanel.refresh()   after a sound was switched somewhere else (the buttons on the title)
     SoundPanel.hide()      when the screen changes
     SoundPanel.fit()       titles next to the 🔊 button that are too long get a smaller font */
var SoundPanel = (function () {
  'use strict';
  var kinds = [], o = {}, back = null, card = null, on = false;

  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function init(list, opts) {
    kinds = list; o = opts || {};
    back = document.createElement('div');
    back.className = 'snd-back';
    card = document.createElement('div');
    card.className = 'snd-card';
    kinds.forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'snd-row';
      b.innerHTML = '<span class="snd-ic"></span><span class="snd-lb"></span><i class="snd-sw"><b></b></i>';
      b.querySelector('.snd-lb').textContent = L(k.label);
      b.addEventListener('click', function () { k.set(!k.get()); refresh(); });
      k.el = b;
      card.appendChild(b);
    });
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn snd-close';
    close.textContent = L('とじる');
    close.addEventListener('click', function () { if (o.click) o.click(); hide(); });
    card.appendChild(close);
    back.appendChild(card);
    document.getElementById('stage').appendChild(back);
    all('.snd-btn').forEach(function (b) {
      b.setAttribute('aria-label', L('おと'));
      b.addEventListener('click', function () { if (o.click) o.click(); if (on) hide(); else show(b); });
    });
    // While the window is open, a tap anywhere else only closes it.
    var outside = function (e) { return on && !card.contains(e.target); };
    ['pointerdown', 'pointermove', 'pointerup'].forEach(function (type) {
      window.addEventListener(type, function (e) { if (outside(e)) e.stopPropagation(); }, true);
    });
    window.addEventListener('click', function (e) {
      if (!outside(e)) return;
      e.stopPropagation(); e.preventDefault();
      hide();
    }, true);
    refresh();
  }

  // The window opens under the button that was tapped, its little tail pointing at it.
  function show(btn) {
    if (on || !back) return;
    var st = document.getElementById('stage').getBoundingClientRect(), k = st.width / 360 || 1;
    var r = btn.getBoundingClientRect();
    var bx = ((r.left + r.right) / 2 - st.left) / k, by = (r.bottom - st.top) / k;   // (in the 360×640 stage)
    on = true;
    refresh();
    back.classList.add('on');
    var w = card.offsetWidth || 280, left = Math.max(8, Math.min(360 - 8 - w, bx - w / 2));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(by + 14) + 'px';
    card.style.setProperty('--tail', Math.round(Math.max(30, Math.min(w - 30, bx - left))) + 'px');
    fitLabels();
    if (o.onOpen) o.onOpen();
  }
  function hide() {
    if (!on) return;
    on = false;
    back.classList.remove('on');
    if (o.onClose) o.onClose();
  }

  // The switches, and the 🔊 buttons (crossed out when every sound is off).
  function refresh() {
    var any = false;
    kinds.forEach(function (k) {
      var v = !!k.get();
      if (v) any = true;
      if (!k.el) return;
      k.el.classList.toggle('off', !v);
      k.el.setAttribute('aria-pressed', v ? 'true' : 'false');
      k.el.querySelector('.snd-ic').innerHTML = o.icon ? o.icon(v ? k.icon : k.icon + 'Off') : '';
    });
    all('.snd-btn').forEach(function (b) {
      b.innerHTML = o.icon ? o.icon(any ? 'sfx' : 'sfxOff') : '';
      b.classList.toggle('off', !any);
    });
  }

  // A one-line text that does not fit its box gets a smaller font, down to `min` px (after that, "…").
  function shrink(el, min, box) {
    if (!el) return;
    el.style.fontSize = '';
    box = box || el;
    var size = parseFloat(window.getComputedStyle(el).fontSize), n = 0;
    while (box.scrollWidth > box.clientWidth + 0.5 && size > min && n++ < 16) { size -= 1; el.style.fontSize = size + 'px'; }
  }
  function fitLabels() { kinds.forEach(function (k) { if (k.el) shrink(k.el.querySelector('.snd-lb'), 13); }); }
  // (the titles of the screen on show: the bars, and the name of the training being played)
  function fit() {
    all('.screen.on .bar h2').forEach(function (el) { shrink(el, 14); });
    all('.screen.on .p-name').forEach(function (el) { shrink(el, 11, el.querySelector('.nm') || el); });
  }

  return { init: init, show: show, hide: hide, refresh: refresh, fit: fit, isOpen: function () { return on; } };
}());
