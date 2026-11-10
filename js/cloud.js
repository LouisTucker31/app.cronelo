// Cloud: sign-in and syncing with Supabase. Loaded after shared.js and data.js; starts the app
// (js/app/*.js) once you're signed in and synced.
//
// The app keeps working from its copy in this browser (localStorage), so it stays quick;
// this file sends every change to the items it keeps (projects, plans, tags, templates,
// notes, profile) to Supabase as one row each, and brings them back on other devices.
// Until you're signed in, a sign-in screen covers the app. The first sign-in uploads
// whatever this browser already has; after that the cloud copy wins when a device opens.
//
// The URL and key below are public by design: the database's row level security (see
// supabase/schema.sql) is what keeps each person's rows to themselves.
(function () {
  'use strict';

  var SUPABASE_URL = 'https://rvpczyvdulqwxopspipb.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2cGN6eXZkdWxxd3hvcHNwaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyODM0MDcsImV4cCI6MjEwODg1OTQwN30.GxcOvjYsAPd24BUl0-dWlFPI9l88c3UMk82NvqwEieQ';
  var SITE = location.origin + location.pathname; // where emailed links come back to
  // Cloudflare Turnstile, the "are you a person" check on sign in, sign up and password reset
  // (see README.md). Empty turns it off. It's public, like the Supabase key.
  var TURNSTILE_SITE_KEY = '0x4AAAAAAF7e6bJLsZurMyrp';
  var CONTACT = 'hello@cronelo.co.uk';
  // Tells the website (cronelo.co.uk) that this browser is signed in, so it can show
  // "Open Cronelo" instead of "Log in" and "Create free account". The site can't read the
  // app's sign-in, which is stored for app.cronelo.co.uk only, so this cookie is shared across
  // cronelo.co.uk instead. It holds only "1", never the sign-in itself. It's renewed on every
  // visit while signed in and removed on sign out; on any other address it isn't set.
  var SHARED_DOMAIN = 'cronelo.co.uk';
  function markSignedIn(on) {
    var host = location.hostname;
    if (host !== SHARED_DOMAIN && host.slice(-SHARED_DOMAIN.length - 1) !== '.' + SHARED_DOMAIN) return;
    document.cookie = 'cronelo_signed_in=' + (on ? '1; Max-Age=2592000' : '; Max-Age=0') +
      '; Domain=' + SHARED_DOMAIN + '; Path=/; Secure; SameSite=Lax';
  }
  var store = window.localStorage;
  var rawSet = Storage.prototype.setItem;
  var rawRemove = Storage.prototype.removeItem;

  var sb = window.supabase && window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'workspaceAuth' },
    global: { fetch: send }
  });
  var user = null;
  var ready = false;   // the first sync has finished, so changes can go up
  var pending = {};    // key → new JSON text, or null to remove
  var timer = 0;
  var lastPull = 0;
  // The database turns away any item over 1MB (supabase/schema.sql). Its stored form is a little
  // longer than ours, so anything near that stays in this browser instead of failing every upload.
  var MAX_BYTES = 900000;
  var tooBig = {}; // keys held back for size
  var leaving = false; // the page is going out of view or closing

  // Uploads made while the page is going away use keepalive, so they can finish after it has
  // gone. Browsers only allow that for small bodies (64KB), so bigger ones go as normal.
  function send(url, options) {
    if (leaving && options && typeof options.body === 'string' && options.body.length < 60000) {
      options = Object.assign({}, options, { keepalive: true });
    }
    return fetch(url, options);
  }

  // Error reports: anything that goes wrong in the page is noted in the account's app_errors table
  // (supabase/schema.sql), so problems people hit can be seen and fixed. Only the error itself,
  // the page and the browser are sent, never anyone's plans. At most 10 a visit, no repeats.
  var errors = [];
  var errorsSeen = {};
  var errorsSent = 0;

  function reportError(message, source, stack) {
    message = String(message || 'Unknown error');
    // Errors from other sites' scripts (browser extensions) say only "Script error." and can't be
    // acted on; the ResizeObserver note is a harmless browser warning.
    if (/^Script error\.?$/.test(message) || /ResizeObserver loop/.test(message)) return;
    if (errorsSeen[message] || errorsSent + errors.length >= 10) return;
    errorsSeen[message] = true;
    errors.push({
      message: message.slice(0, 1000),
      source: source ? String(source).slice(0, 500) : null,
      stack: stack ? String(stack).slice(0, 4000) : null,
      page: location.pathname.slice(0, 500),
      agent: navigator.userAgent.slice(0, 400)
    });
    sendErrors();
  }

  function sendErrors() {
    if (!sb || !user || !errors.length) return;
    var batch = errors;
    errors = [];
    errorsSent += batch.length;
    sb.from('app_errors').insert(batch).then(null, function () { /* a report that can't be sent is dropped */ });
  }

  window.addEventListener('error', function (e) {
    reportError(e.message, e.filename ? e.filename + ':' + e.lineno + ':' + e.colno : '', e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    reportError(r && r.message ? r.message : r, 'Unhandled promise', r && r.stack);
  });

  // Watch the app's own saves: a synced item going into localStorage is queued for upload. It's
  // queued before it's stored, so the change still reaches the account if this browser can't
  // store it (the error still goes back to the app, which says so).
  Storage.prototype.setItem = function (key, value) {
    if (this === store && isSynced(key)) queue(key, String(value));
    rawSet.call(this, key, value);
  };
  Storage.prototype.removeItem = function (key) {
    if (this === store && isSynced(key)) queue(key, null);
    rawRemove.call(this, key);
  };

  function syncedKeys() {
    var keys = [];
    for (var i = 0; i < store.length; i++) if (isSynced(store.key(i))) keys.push(store.key(i));
    return keys;
  }

  function queue(key, value) {
    if (!ready || !user) return;
    pending[key] = value;
    noteUnsent();
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
    setStatus('saving');
  }

  // Which items haven't reached the account yet, kept in this browser too: if the page closes
  // first, the next start sends them instead of taking the older copy from the cloud.
  function noteUnsent() {
    var keys = Object.keys(pending);
    if (keys.length) localStore.set(STORE.unsent, JSON.stringify({ owner: user.id, keys: keys }));
    else localStore.remove(STORE.unsent);
  }

  function takeUnsent(u) {
    var unsent = localStore.getJSON(STORE.unsent);
    if (unsent && unsent.owner === u.id && Array.isArray(unsent.keys)) {
      unsent.keys.forEach(function (k) { if (isSynced(k)) pending[k] = store.getItem(k); });
    } else {
      localStore.remove(STORE.unsent);
    }
  }

  function flush() {
    var keys = Object.keys(pending);
    if (!keys.length || !user) return Promise.resolve();
    var ups = [];
    var dels = [];
    keys.forEach(function (k) {
      delete tooBig[k];
      if (pending[k] == null) return dels.push(k);
      if (new TextEncoder().encode(pending[k]).length > MAX_BYTES) { tooBig[k] = true; return; }
      var value;
      try { value = JSON.parse(pending[k]); } catch (e) { return; }
      ups.push({ owner: user.id, key: k, value: value, updated_at: new Date().toISOString() });
    });
    var sent = pending;
    pending = {};
    var jobs = [];
    if (ups.length) jobs.push(sb.from('user_data').upsert(ups, { onConflict: 'owner,key' }));
    if (dels.length) jobs.push(sb.from('user_data')['delete']().eq('owner', user.id)['in']('key', dels));
    return Promise.all(jobs).then(function (results) {
      var failed = results.some(function (r) { return r.error; });
      if (failed) {
        // Put them back for the next try.
        Object.keys(sent).forEach(function (k) { if (!(k in pending) && !tooBig[k]) pending[k] = sent[k]; });
        setStatus('offline');
      } else {
        setStatus(Object.keys(tooBig).length ? 'too-big' : 'saved');
      }
      noteUnsent();
    }, function () {
      Object.keys(sent).forEach(function (k) { if (!(k in pending) && !tooBig[k]) pending[k] = sent[k]; });
      noteUnsent();
      setStatus('offline');
    });
  }

  // Bring down everything this person has. On the first sign-in (nothing in the cloud yet)
  // upload this browser's items instead, and return 'empty'.
  function pull(first) {
    return sb.from('user_data').select('key, value').then(function (res) {
      if (res.error) throw res.error;
      lastPull = Date.now();
      var rows = res.data || [];
      if (!rows.length) {
        ready = true;
        syncedKeys().forEach(function (k) { queue(k, store.getItem(k)); });
        return 'empty';
      }
      var cloud = {};
      rows.forEach(function (r) { cloud[r.key] = JSON.stringify(r.value); });
      var changed = [];
      Object.keys(cloud).forEach(function (k) {
        if (k in pending) return; // a change made here that hasn't gone up yet
        if (store.getItem(k) !== cloud[k]) {
          changed.push({ key: k, old: store.getItem(k), now: cloud[k] });
          rawSet.call(store, k, cloud[k]);
        }
      });
      syncedKeys().forEach(function (k) {
        if (!(k in cloud) && !(k in pending)) {
          changed.push({ key: k, old: store.getItem(k), now: null });
          rawRemove.call(store, k);
        }
      });
      if (!first) {
        // Tell the open app, the same way another tab's changes reach it.
        changed.forEach(function (c) {
          try { window.dispatchEvent(new StorageEvent('storage', { key: c.key, oldValue: c.old, newValue: c.now, storageArea: store })); } catch (e) { /* no StorageEvent here: the open app misses this live update */ }
        });
      }
      ready = true;
      return changed.length > 0;
    });
  }

  // The app itself (js/app/*.js) only starts once the first sync is done, so it always starts
  // from the latest copy, and nothing it saves while starting can race the download.
  var booted = false;

  // The app's files, in the order they run. They share one scope, so a later file can use
  // what an earlier one set up.
  var APP_FILES = ['core', 'timeline', 'timeline-controls', 'plan', 'task-form', 'task-list', 'details', 'list', 'board',
    'calendar', 'settings', 'pages', 'tags', 'search', 'projects', 'notes', 'profile', 'home', 'start'];

  // Signed in: fetch the app's files while the first sync runs, so they're ready when it ends.
  var preloaded = false;
  function preloadApp() {
    if (preloaded) return;
    preloaded = true;
    APP_FILES.forEach(function (name) {
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = 'js/app/' + name + '.js';
      document.head.appendChild(link);
    });
  }

  // While they load, page-level events are held back: a handler set up by an early file could
  // otherwise run before the files it calls into have arrived. Input is dropped (the app is
  // still hidden); storage and history changes are replayed once everything has loaded.
  var HELD = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
    'lostpointercapture', 'wheel', 'scroll', 'keydown', 'keyup', 'input', 'change', 'submit', 'focusin', 'focusout',
    'dragstart', 'dragover', 'drop', 'resize', 'storage', 'popstate'];

  function boot() {
    if (booted) return hideGate();
    booted = true;
    var replay = [];
    var hold = function (e) {
      if (e.target instanceof Node && gate.contains(e.target)) return; // the loading screen itself
      e.stopImmediatePropagation();
      if (e.type === 'storage') replay.push(new StorageEvent('storage', e));
      if (e.type === 'popstate') replay.push(new PopStateEvent('popstate', { state: e.state }));
    };
    HELD.forEach(function (type) { window.addEventListener(type, hold, true); });
    APP_FILES.forEach(function (name, i) {
      var s = document.createElement('script');
      s.src = 'js/app/' + name + '.js';
      s.async = false; // run in list order
      if (i === APP_FILES.length - 1) {
        // Reveal the app (and drop the loading screen) only once it has drawn itself.
        s.onload = s.onerror = function () {
          HELD.forEach(function (type) { window.removeEventListener(type, hold, true); });
          replay.forEach(function (e) { window.dispatchEvent(e); });
          document.documentElement.classList.remove('booting');
          hideGate();
        };
      }
      document.body.appendChild(s);
    });
  }

  // Signed in: sync, then start the app. A brand new account (nothing in the cloud yet)
  // starts its profile with the name given when signing up.
  var recovering = false; // signed in from a password reset email, choosing a new password

  // Remove this browser's copy of the account: on sign out, after deleting the account, and when
  // someone else signs in here.
  function clearLocal() {
    syncedKeys().forEach(function (k) { rawRemove.call(store, k); });
    [STORE.current, STORE.page, STORE.unsent, STORE.owner].forEach(function (k) { rawRemove.call(store, k); });
    try { sessionStorage.clear(); } catch (e) { /* storage off: nothing kept there */ }
  }

  function start(u) {
    user = u;
    preloadApp();
    // Items left here by a different account (its session ended without signing out) are cleared
    // first, so they can't show here or be uploaded into this account as if they were its own.
    var owner = localStore.get(STORE.owner);
    if (owner && owner !== u.id) clearLocal();
    localStore.set(STORE.owner, u.id);
    takeUnsent(u);
    sendErrors();
    showGate('loading');
    pull(true).then(function (result) {
      var name = u.user_metadata && u.user_metadata.name;
      if (result === 'empty' && name) {
        var prof = localStore.getJSON(STORE.profile) || {};
        prof.name = name;
        localStore.set(STORE.profile, JSON.stringify(prof));
      }
      if (Object.keys(pending).length) flush(); // changes left over from last time
      else setStatus('saved');
      boot();
    }, function () {
      // Can't reach the cloud: carry on with this browser's copy and try again later.
      ready = true;
      setStatus('offline');
      boot();
    });
  }

  // Going out of view may be the last chance before the tab is closed, so send what's waiting
  // straight away. Coming back into view, pick up changes made on other devices.
  document.addEventListener('visibilitychange', function () {
    if (!user || !ready) return;
    if (document.visibilityState === 'hidden') return sendNow();
    leaving = false;
    if (Date.now() - lastPull < 15000) return;
    flush().then(function () { return pull(false); }).then(null, function () { setStatus('offline'); });
  });
  window.addEventListener('online', function () { if (user) flush(); });
  window.addEventListener('pagehide', function () { if (user && ready) sendNow(); });

  function sendNow() {
    leaving = true;
    clearTimeout(timer);
    flush();
  }

  // The sign-in screen: sign in, create an account, reset a forgotten password, or (from
  // a reset email) choose a new one. The marketing website links to #signup or #signin. Also a short "Loading your workspace" while syncing.
  var gate = document.createElement('div');
  gate.className = 'gate';
  gate.setAttribute('role', 'dialog');
  gate.setAttribute('aria-modal', 'true');
  gate.setAttribute('aria-label', 'Sign in to Cronelo');
  document.body.appendChild(gate);
  var LOGO = '<span class="logo" aria-hidden="true"><svg viewBox="0 0 32 32" width="22" height="22"><path d="M22.3 10.7A7.5 7.5 0 1 0 22.3 21.3" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>';

  function showGate(view, note) {
    document.documentElement.classList.add('gated');
    gate.hidden = false;
    var head = '<div class="gate-brand">' + LOGO + '<span>Cronelo</span></div>';
    if (view === 'loading') {
      gate.innerHTML = '<div class="gate-card loading">' + head + '<p class="gate-sub">Loading your workspace…</p></div>';
      return;
    }
    var forms = {
      signin: { title: 'Sign in', button: 'Sign in', fields: ['email', 'password'] },
      signup: { title: 'Create your account', button: 'Create account', fields: ['name', 'email', 'newpassword'] },
      forgot: { title: 'Reset your password', button: 'Send reset link', fields: ['email'] },
      recover: { title: 'Choose a new password', button: 'Save password', fields: ['newpassword'] },
      sent: { title: 'Check your email', fields: [] }
    };
    var f = forms[view];
    var field = {
      name: '<label class="field"><span class="field-label">Your name</span><input type="text" name="name" autocomplete="name" maxlength="60" required></label>',
      email: '<label class="field"><span class="field-label">Email</span><input type="email" name="email" autocomplete="email" required></label>',
      password: '<label class="field"><span class="field-label">Password</span><input type="password" name="password" autocomplete="current-password" required></label>',
      newpassword: '<label class="field"><span class="field-label">Password <em>at least 8 characters</em></span><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>'
    };
    gate.innerHTML = '<form class="gate-card" novalidate data-gate-form="' + view + '">' + head +
      '<h1>' + f.title + '</h1>' +
      (note ? '<p class="gate-note">' + esc(note) + '</p>' : '') +
      f.fields.map(function (k) { return field[k]; }).join('') +
      (CAPTCHA_VIEWS[view] && TURNSTILE_SITE_KEY ? '<div class="gate-captcha" data-captcha></div>' : '') +
      '<p class="gate-err" role="alert" hidden></p>' +
      (view === 'signup' ? '<p class="gate-consent">By creating an account you agree to the <a href="terms.html" target="_blank" rel="noopener">terms</a> and <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</p>' : '') +
      (f.button ? '<button class="primary" type="submit">' + f.button + '</button>' : '') +
      '<div class="gate-links">' +
      (view === 'signin' ? '<button type="button" data-gate="forgot">Forgot your password?</button><span>New here? <button type="button" data-gate="signup">Create an account</button></span>' : '') +
      (view === 'signup' ? '<span>Already have an account? <button type="button" data-gate="signin">Sign in</button></span>' : '') +
      (view === 'forgot' || view === 'sent' ? '<button type="button" data-gate="signin">Back to sign in</button>' : '') +
      '</div>' +
      '<p class="gate-legal"><a href="privacy.html" target="_blank" rel="noopener">Privacy</a><span aria-hidden="true">·</span>' +
      '<a href="terms.html" target="_blank" rel="noopener">Terms</a><span aria-hidden="true">·</span>' +
      '<a href="mailto:' + CONTACT + '?subject=Cronelo">Contact</a></p></form>';
    var first = gate.querySelector('input');
    if (first) first.focus();
    renderCaptcha();
  }

  // The Turnstile check. Its script loads the first time a form needs it; it usually passes
  // without asking anything, and only shows itself when it needs a click. A token is good for
  // one try, so it's renewed after every attempt.
  var CAPTCHA_VIEWS = { signin: true, signup: true, forgot: true };
  var captchaToken = '';
  var captchaWidget = null;
  var captchaWaiting = null; // a form sent before the check finished: sent again once it has
  var turnstileLoading = false;

  function renderCaptcha() {
    if (captchaWidget != null && window.turnstile) {
      try { window.turnstile.remove(captchaWidget); } catch (e) { /* already gone with the old form */ }
    }
    captchaToken = '';
    captchaWidget = null;
    captchaWaiting = null;
    var el = gate.querySelector('[data-captcha]');
    if (!el) return;
    if (!window.turnstile) {
      if (!turnstileLoading) {
        turnstileLoading = true;
        var s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.onload = renderCaptcha;
        s.onerror = function () { turnstileLoading = false; };
        document.head.appendChild(s);
      }
      return;
    }
    captchaWidget = window.turnstile.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
      size: 'flexible',
      appearance: 'interaction-only',
      callback: function (token) {
        captchaToken = token;
        var waiting = captchaWaiting;
        captchaWaiting = null;
        if (waiting && gate.contains(waiting)) waiting.requestSubmit();
      },
      'expired-callback': function () { captchaToken = ''; },
      'error-callback': function () { captchaToken = ''; }
    });
  }

  function resetCaptcha() {
    captchaToken = '';
    if (captchaWidget != null && window.turnstile) window.turnstile.reset(captchaWidget);
  }

  function hideGate() {
    document.documentElement.classList.remove('gated');
    gate.hidden = true;
    gate.innerHTML = '';
  }

  function gateError(msg) {
    var e = gate.querySelector('.gate-err');
    e.textContent = msg;
    e.hidden = false;
    var b = gate.querySelector('button[type=submit]');
    if (b) b.disabled = false;
    resetCaptcha();
  }

  // The request itself failed: no connection, or the server didn't answer. Supabase reports
  // that as an error result rather than a failed promise, so both come here.
  function unreachable() {
    gateError('Couldn’t reach the server. Check your connection and try again.');
  }

  function offline(error) {
    return error && (error.name === 'AuthRetryableFetchError' || error.status === 0);
  }

  // Supabase's own error messages are technical, so the common ones are said plainly here and
  // anything else gets the caller's general message.
  var AUTH_MESSAGES = {
    invalid_credentials: 'That email and password don’t match.',
    email_not_confirmed: 'Confirm your email first: open the link we sent you, then sign in.',
    user_already_exists: 'There’s already an account for this email. Sign in instead.',
    email_exists: 'There’s already an account for this email. Sign in instead.',
    email_address_invalid: 'Enter a valid email address.',
    weak_password: 'Choose a longer password, or one that’s harder to guess.',
    same_password: 'Choose a password you haven’t used for this account before.',
    over_email_send_rate_limit: 'Too many emails sent. Wait a few minutes, then try again.',
    over_request_rate_limit: 'Too many attempts. Wait a few minutes, then try again.',
    signup_disabled: 'New accounts can’t be created at the moment.',
    session_not_found: 'This link has expired. Ask for a new one.',
    session_expired: 'This link has expired. Ask for a new one.',
    captcha_failed: 'The security check didn’t pass. Try again.'
  };

  function authMessage(error, fallback) {
    return AUTH_MESSAGES[error.code] || fallback;
  }

  gate.addEventListener('click', function (e) {
    var to = e.target.closest('[data-gate]');
    if (to) showGate(to.getAttribute('data-gate'));
  });

  gate.addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var view = form.getAttribute('data-gate-form');
    var get = function (n) { return form.elements[n] ? form.elements[n].value.trim() : ''; };
    var email = get('email');
    var password = form.elements.password ? form.elements.password.value : '';
    if (form.elements.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return gateError('Enter your email address.');
    if (view === 'signup' && !get('name')) return gateError('Enter your name.');
    if ((view === 'signup' || view === 'recover') && password.length < 8) return gateError('Use at least 8 characters for your password.');
    if (view === 'signin' && !password) return gateError('Enter your password.');
    var needsCheck = CAPTCHA_VIEWS[view] && TURNSTILE_SITE_KEY;
    if (needsCheck && !window.turnstile) return gateError('The security check didn’t load. Check your connection, then reload the page.');
    if (needsCheck && !captchaToken) {
      // Still checking: send the form as soon as it's done.
      captchaWaiting = form;
      form.querySelector('button[type=submit]').disabled = true;
      return;
    }
    var check = needsCheck ? captchaToken : undefined;
    form.querySelector('button[type=submit]').disabled = true;
    if (view === 'signin') {
      sb.auth.signInWithPassword({ email: email, password: password, options: { captchaToken: check } }).then(function (r) {
        if (offline(r.error)) return unreachable();
        if (r.error) return gateError(authMessage(r.error, /confirm/i.test(r.error.message) ? AUTH_MESSAGES.email_not_confirmed : AUTH_MESSAGES.invalid_credentials));
      }, unreachable);
    } else if (view === 'signup') {
      sb.auth.signUp({ email: email, password: password, options: { emailRedirectTo: SITE, data: { name: get('name') }, captchaToken: check } }).then(function (r) {
        if (offline(r.error)) return unreachable();
        if (r.error) return gateError(authMessage(r.error, 'Your account wasn’t created. Check your details and try again.'));
        if (!r.data.session) showGate('sent', 'We’ve sent a link to ' + email + '. Open it to confirm your account, then sign in.');
      }, unreachable);
    } else if (view === 'forgot') {
      sb.auth.resetPasswordForEmail(email, { redirectTo: SITE, captchaToken: check }).then(function (r) {
        if (offline(r.error)) return unreachable();
        if (r.error) return gateError(authMessage(r.error, 'The reset link wasn’t sent. Wait a few minutes, then try again.'));
        showGate('sent', 'If there’s an account for ' + email + ', a link to reset its password is on its way.');
      }, unreachable);
    } else if (view === 'recover') {
      sb.auth.updateUser({ password: password }).then(function (r) {
        if (offline(r.error)) return unreachable();
        if (r.error) return gateError(authMessage(r.error, 'Your new password wasn’t saved. Try again, or ask for a new reset link.'));
        recovering = false;
        start(user); // signed in already by the reset link
      }, unreachable);
    }
  });

  // A small saved / saving / offline note for the app to show.
  function setStatus(s) {
    document.documentElement.setAttribute('data-cloud', s);
    window.dispatchEvent(new CustomEvent('cloud-status', { detail: s }));
  }

  // For the app: who's signed in, and the account actions in the profile popup.
  window.cloud = {
    available: !!sb,
    email: function () { return user ? user.email : ''; },
    changePassword: function (password) {
      return sb.auth.updateUser({ password: password }).then(function (r) {
        if (offline(r.error)) throw new Error('Couldn’t reach the server. Check your connection and try again.');
        if (r.error) throw new Error(authMessage(r.error, 'Your password wasn’t changed. Try again.'));
      });
    },
    // Send anything unsaved, sign out, and clear this browser's copy so the next person
    // to use it doesn't see it.
    signOut: function () {
      return flush().then(null, function () {}).then(function () { return sb.auth.signOut(); }).then(function () {
        markSignedIn(false);
        clearLocal();
        location.replace(SITE);
      });
    },
    // Delete the account and everything saved to it (supabase/schema.sql: delete_my_account),
    // then this browser's copy. Nothing is sent after this starts.
    deleteAccount: function () {
      ready = false;
      clearTimeout(timer);
      return sb.rpc('delete_my_account').then(function (r) {
        if (offline(r.error)) throw new Error('Couldn’t reach the server. Check your connection and try again.');
        if (r.error) throw new Error('Your account wasn’t deleted. Try again, or email ' + CONTACT + '.');
        user = null;
        markSignedIn(false);
        clearLocal();
        return sb.auth.signOut({ scope: 'local' }).then(null, function () {});
      }).then(function () {
        location.replace(SITE + '?deleted'); // a fresh page, which says it's done
      }, function (e) {
        ready = true; // still here: carry on saving, starting with anything held back
        flush();
        throw e;
      });
    },
    contact: CONTACT
  };

  if (!sb) {
    // The Supabase library didn't load (offline?): use this browser's copy for now.
    setStatus('offline');
    boot();
    return;
  }

  sb.auth.onAuthStateChange(function (event, session) {
    markSignedIn(!!(session && session.user));
    if (event === 'PASSWORD_RECOVERY') {
      recovering = true;
      user = session.user;
      return showGate('recover');
    }
    if (event === 'SIGNED_OUT') user = null;
    if (session && session.user && !user && !recovering && !booted) start(session.user);
  });
  showGate('loading');
  sb.auth.getSession().then(function (r) {
    var session = r.data && r.data.session;
    if (session || user) return;
    if (/^\?deleted\b/.test(location.search)) {
      history.replaceState(null, '', SITE);
      return showGate('signin', 'Your account and everything saved to it have been deleted.');
    }
    showGate(location.hash === '#signup' ? 'signup' : 'signin');
  });
})();
