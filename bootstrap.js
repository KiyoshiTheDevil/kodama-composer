// Kodama's bootstrap inside the Composer.
//
// Injected into every built page by this repo's workflow, so upstream is never forked. It is
// Kodama's code running in the Composer's document, with that document's origin, doing the
// same-origin work a parent frame cannot do across an origin boundary.
//
// This replaces the Tauri initialization_script that used to do the same three jobs. A frame does
// not get one of those, and that is the point rather than a loss: what used to be Kodama reaching
// into another document is now that document asking, over a channel with a permission behind it.
// It is also the first real user of the extension bridge.
(function () {
  "use strict";

  // Framed by Kodama, or opened on its own? Only the first has a parent to ask, and running the
  // rest anyway would post messages into the void and then wait ten seconds for each.
  if (window.parent === window) return;

  // Kodama's bridge runs on the listener's own machine, not on this site. http://localhost is a
  // potentially trustworthy origin, so an https page may reach it: that is how the public
  // Composer has always used a local bridge, and this is the same arrangement.
  var BRIDGE_URL = "http://localhost:9847/composer-bridge";
  var SETTINGS_KEY = "composer-settings";
  var seq = 0;
  var waiting = new Map();

  window.addEventListener("message", function (e) {
    // The parent is the only window that can reach this frame, and the reply carries the id of a
    // call this document made. Anything else is not ours.
    var m = e.data;
    if (!m || m.__kodama !== "reply" || !waiting.has(m.id)) return;
    var w = waiting.get(m.id);
    waiting.delete(m.id);
    clearTimeout(w.timer);
    if (m.ok) w.resolve(m.result);
    else w.reject(new Error((m.error && m.error.message) || "call failed"));
  });

  function call(method, params) {
    return new Promise(function (resolve, reject) {
      var id = String(++seq);
      var timer = setTimeout(function () {
        waiting.delete(id);
        reject(new Error("no reply from Kodama"));
      }, 10000);
      waiting.set(id, { resolve: resolve, reject: reject, timer: timer });
      parent.postMessage({ __kodama: "call", id: id, method: method, params: params || {} }, "*");
    });
  }

  // ── 1. The audio bridge ────────────────────────────────────────────────────
  //
  // Needs no call: the bridge is on this document's own origin, because Kodama serves both. What
  // the init script had to be told, this can simply read off itself.
  try {
    var env = null;
    try { env = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null"); } catch (e) {}
    if (!env || typeof env !== "object") env = { state: {}, version: 2 };
    if (!env.state || typeof env.state !== "object") env.state = {};
    env.state.experiments = Object.assign({}, env.state.experiments, { youtubeBridge: true });
    env.state.composerBridgeUrl = BRIDGE_URL;
    if (typeof env.version !== "number") env.version = 2;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(env));
  } catch (e) { /* private mode: the composer falls back to its own default */ }

  // ── 2. Kodama's colours ────────────────────────────────────────────────────
  //
  // The mapping from Kodama's tokens to the Composer's lives here, on Kodama's side, because it is
  // knowledge about the Composer and not about themes. appearance.get answers with resolved
  // values, which is the only answer that still works for a theme published after this was
  // written: an id would be a word this code has never heard.
  function paint(look) {
    var c = look.colors || {};
    var pairs = [
      ["--color-composer-accent", c.accent],
      ["--color-composer-accent-dark", c.accent],
      ["--color-composer-accent-darker", c.accent],
      ["--color-composer-accent-text", c.accent],
      ["--color-composer-link", c.accent],
    ];
    // The Composer is dark-only. Its surfaces are themed only when Kodama is dark too, keyed on
    // the mode rather than the theme's name: a theme installed rather than shipped is not called
    // "light" even when it is one, and would have had a dark composer painted over it.
    if (look.mode !== "light") {
      pairs.push(
        ["--color-composer-bg", c.bgBase],
        ["--color-composer-bg-dark", c.bgBase],
        ["--color-composer-bg-elevated", c.bgElevated],
        ["--color-composer-border", c.border],
        ["--color-composer-border-hover", c.bgHover],
        ["--color-composer-button", c.bgElevated],
        ["--color-composer-button-hover", c.bgHover],
        ["--color-composer-input", c.bgElevated],
        ["--color-composer-text", c.textPrimary],
        ["--color-composer-text-secondary", c.textSecondary],
        ["--color-composer-text-muted", c.textMuted],
        ["--color-composer-text-tertiary", c.textMuted]
      );
    }
    var apply = function () {
      var r = document.documentElement;
      if (!r) return;
      pairs.forEach(function (p) {
        // Inline !important beats any author rule whatever the layer order, which is what the
        // init script relied on and is still the reason this works at all.
        if (p[1]) r.style.setProperty(p[0], p[1], "important");
      });
    };
    apply();
    document.addEventListener("DOMContentLoaded", apply);
  }

  // ── 3. Inter ───────────────────────────────────────────────────────────────
  function font() {
    var ff = '"Inter", system-ui, sans-serif';
    var run = function () {
      try {
        if (!document.getElementById("__kodama_inter")) {
          var l = document.createElement("link");
          l.id = "__kodama_inter";
          l.rel = "stylesheet";
          l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
          var h = document.head || document.documentElement;
          if (h) h.appendChild(l);
        }
        var r = document.documentElement;
        if (r) r.style.setProperty("--font-family-sans", ff, "important");
        if (document.body) document.body.style.setProperty("font-family", ff, "important");
      } catch (e) {}
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
    window.addEventListener("load", run);
  }

  // ── 4. One header, not two ────────────────────────────────────────────────
  //
  // Kodama already draws a title bar with the window buttons, so this page's own header is a
  // second one saying the same thing: a logo and the word Composer, above a row of tabs. It goes,
  // and the three buttons that lived in it move down into the tab row.
  //
  // Done by POSITION, not by moving nodes. Lifting the button group out of the header and
  // appending it to the tab bar would work until React re-rendered the header and put it back.
  // Taking the header out of flow and laying it over the right end of the tab row survives that,
  // because nothing about the tree has changed.
  //
  // Both elements are found by things upstream chose deliberately: the <header> element itself,
  // and data-tour="tab-bar", which exists for the product tour. Utility classes change whenever
  // the styling does; neither of these does.
  function oneHeader() {
    var css = document.createElement("style");
    css.id = "__kodama_chrome";
    css.textContent = [
      "header{position:fixed!important;top:0;right:0;z-index:5;",
      "border:0!important;background:transparent!important;",
      "padding:0 8px!important;display:flex!important;align-items:center!important}",
      "header>h1{display:none!important}",
    ].join("");

    // The two measurements this needs are read off the page rather than guessed: how tall the tab
    // row is, so the buttons sit on its line, and how wide the buttons are, so no tab ends up
    // underneath them. Guessed numbers would be wrong the first time upstream changed a padding.
    var fit = function () {
      var header = document.querySelector("header");
      var nav = document.querySelector('nav[data-tour="tab-bar"]');
      if (!header || !nav) return false;
      header.style.setProperty("height", nav.offsetHeight + "px", "important");
      nav.style.setProperty("padding-right", Math.ceil(header.offsetWidth) + "px", "important");
      return true;
    };

    var put = function () {
      var h = document.head || document.documentElement;
      if (h && !document.getElementById("__kodama_chrome")) h.appendChild(css);
      return fit();
    };

    if (!put()) {
      // The app mounts after this script runs, so the elements are not there yet. Watched rather
      // than polled, and the watch stops as soon as both have been found and measured.
      var obs = new MutationObserver(function () { if (put()) obs.disconnect(); });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      // A page that never renders a tab bar should not be watched forever.
      setTimeout(function () { obs.disconnect(); }, 15000);
    }
    window.addEventListener("resize", fit);
  }

  oneHeader();
  font();
  call("appearance.get").then(paint).catch(function () {
    // Kodama did not answer, or did not grant it. The Composer keeps its own colours, which is a
    // working Composer that looks like itself rather than a broken one.
  });
})();
