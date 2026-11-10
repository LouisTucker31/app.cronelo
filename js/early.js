// Runs in <head>, before the page is drawn.
(function () {
  'use strict';

  // Project links used to be #project/<name>; they're /<name> now (js/app/core.js). Rewrite an
  // old link before the app reads the address. /project/<name> always works, whatever the name;
  // the app then tidies it to /<name>.
  var old = /^#project\/([^/?#]+)/.exec(location.hash);
  if (old && location.pathname === '/') history.replaceState(null, '', '/project/' + old[1] + location.search);

  // Set the theme now so dark mode doesn't flash light on load. STORE.theme in js/shared.js
  // is the same key; that file isn't loaded yet.
  var saved;
  try { saved = localStorage.getItem('theme'); } catch (e) { /* storage off: follow the system setting */ }
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

  // Keep the app out of sight until you are signed in and it has started (js/cloud.js).
  document.documentElement.classList.add('booting');

  // Never show the app inside another site's frame, where it could be overlaid to trick clicks.
  // (A second line of defence: the frame-ancestors header in _headers does this properly.)
  if (window.top !== window.self) document.documentElement.classList.add('framed');
})();
