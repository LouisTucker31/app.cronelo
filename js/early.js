// Runs in <head>, before the page is drawn.
(function () {
  'use strict';

  // The app used to live on GitHub Pages (louistucker31.github.io/app.cronelo/), which still
  // serves a copy from this repo. Send anyone there to the same page at the real address,
  // keeping ?query and #hash (emailed sign-in links carry their token in the hash). GitHub Pages
  // can't redirect on the server, so this does it before anything else on the page runs.
  if (location.hostname === 'louistucker31.github.io') {
    document.documentElement.style.display = 'none';
    location.replace('https://app.cronelo.co.uk' +
      location.pathname.replace(/^\/app\.cronelo(?=\/|$)/, '') + location.search + location.hash);
    return;
  }

  // Set the theme now so dark mode doesn't flash light on load. STORE.theme in js/shared.js
  // is the same key; that file isn't loaded yet.
  var saved;
  try { saved = localStorage.getItem('theme'); } catch (e) { /* storage off: follow the system setting */ }
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

  // Keep the app out of sight until you are signed in and it has started (js/cloud.js).
  document.documentElement.classList.add('booting');

  // Never show the app inside another site's frame, where it could be overlaid to trick clicks.
  // (The host can't send frame-ancestors on GitHub Pages; see README.md.)
  if (window.top !== window.self) document.documentElement.classList.add('framed');
})();
