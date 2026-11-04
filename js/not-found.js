// For 404.html: point "Go to your projects" at the app. On GitHub Pages the app is under
// /<repo>/ (e.g. /app.cronelo/); on a host at the site root (Cloudflare) it's /.
(function () {
  'use strict';
  var home = document.querySelector('[data-home]');
  var repo = location.pathname.split('/')[1];
  if (home && repo && /\.github\.io$/.test(location.hostname)) home.setAttribute('href', '/' + repo + '/');
})();
