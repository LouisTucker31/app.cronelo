// Phones and small tablets held upright: the app laid out like a phone app. The timeline reads as
// an agenda (turn the phone sideways for the chart), the workload as a card per person, the
// calendar gets a list for the chosen day, the board a row of chips to jump between columns,
// and tapping an item opens its details as a sheet from the bottom. The views take turns from a
// tab bar along the bottom, and the ⋯ in the top bar holds what the rail and top bar hold on a
// bigger screen. Everything else is the same app: the same data, forms and saving.
// Part of the app: js/cloud.js loads js/app/*.js in order once you're signed in; they share one scope.
'use strict';

// The phone layout: up to 820px wide, unless that's a phone on its side (short and wide), which
// gets the chart instead. css/styles.css uses the same media query.
var MOBILE_MQ = window.matchMedia('(max-width: 820px) and (min-height: 501px), (max-width: 820px) and (orientation: portrait)');

function isMobile() {
  return MOBILE_MQ.matches;
}

var agendaEl = document.querySelector('[data-agenda]');
var peopleEl = document.querySelector('[data-people-m]');
var calDayList = document.querySelector('[data-cal-daylist]');
var boardJump = document.querySelector('[data-board-jump]');
var boardScroll = boardEl.querySelector('.board-scroll');
var moreBtn = document.querySelector('[data-m-more-btn]');
var moreSheet = document.querySelector('[data-m-more]');
var moreBack = document.querySelector('[data-m-back]');

var ICON_CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';

// Now, as a day offset like the plan's rows.
function nowDay() {
  return (NOW - PLAN_START) / DAY;
}

// "MON 23 NOV", with the year when it isn't this year.
function dayHeading(day) {
  var d = new Date(PLAN_START + Math.floor(day) * DAY);
  var year = d.getUTCFullYear() !== new Date(TODAY).getUTCFullYear() ? ' ' + d.getUTCFullYear() : '';
  return WEEKDAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + year;
}

function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : many);
}

// A task's mark: a ring in its colour, filled with a tick once it's done; a milestone's diamond.
function markHtml(r) {
  if (r.type === 'milestone') return '<i class="m-mark ms"></i>';
  if (r.type === 'phase') return '<i class="m-mark ph" style="' + colorVar(r).slice(2) + '"></i>';
  var cls = 'm-mark' + (r.parent ? ' sub' : '') + (r.progress >= 1 ? ' done' : r.progress > 0 ? ' active' : '');
  return '<i class="' + cls + '" style="' + colorVar(r).slice(2) + '"></i>';
}

// The people stack: the first four as avatars, then "+n".
function facesHtml(people) {
  return people.slice(0, 4).map(function (p) {
    return '<span class="avatar" style="background: ' + safeColor(p.color, AVATAR_COLORS[0]) + '">' + esc(initials(p.name)) + '</span>';
  }).join('') + (people.length > 4 ? '<span class="avatar more-faces">+' + (people.length - 4) + '</span>' : '');
}

// Project progress, the same sum as the footer's: the average of every task.
function projectProgress() {
  var tasks = data.rows.filter(function (r) { return r.type === 'task'; });
  if (!tasks.length) return null;
  var p = tasks.reduce(function (sum, r) { return sum + Math.min(1, Math.max(0, r.progress || 0)); }, 0) / tasks.length;
  var pct = Math.round(p * 100);
  if (pct === 100 && p < 1) pct = 99;
  return { p: p, pct: pct };
}

// ---------------------------------------------------------------------------------------------
// The timeline as an agenda: the project's progress, then the plan in its order, phases as
// cards that collapse (the same collapsing as the chart), each item on a line with its time.
// A heading marks each new day.

function agendaTime(r) {
  var s = startDay(r);
  if (s % 1) return timeOf(s);
  return r.end != null && r.end - s > 1 ? listDate(s).replace(/ \d{4}$/, '') : 'All day';
}

function agendaMeta(r) {
  var bits = [];
  var s = startDay(r);
  if (r.type === 'milestone') bits.push(r.end != null ? 'Milestone · until ' + (Math.floor(r.end) === Math.floor(s) ? timeOf(r.end) : listDate(finishDay(r))) : 'Milestone');
  else if (r.end != null) {
    var sameDay = r.end % 1 ? Math.floor(r.end) === Math.floor(s) : r.end - s <= 1;
    bits.push((sameDay ? (r.end % 1 ? 'Until ' + timeOf(r.end) : '') : 'Until ' + listDate(finishDay(r))) );
    bits.push(duration(r));
  }
  var kids = r.type === 'task' && !r.parent ? childCount(r) : 0;
  if (kids) bits.push(plural(kids, 'subtask', 'subtasks'));
  return bits.filter(Boolean).join(' · ');
}

function agendaItem(r) {
  var who = personById(r.person);
  var pct = r.type === 'task' && r.progress > 0 ? Math.round(r.progress * 100) + '%' : '';
  var meta = agendaMeta(r);
  var cls = 'ag-item' + (r.type === 'milestone' ? ' ms' : '') + (r.parent ? ' sub' : '') + (r.type === 'task' && r.progress >= 1 ? ' done' : '') +
    (r.id === freshId ? ' fresh' : '');
  return '<div class="' + cls + '" data-id="' + esc(r.id) + '" role="button" tabindex="0">' +
    '<span class="ag-time">' + agendaTime(r) + '</span>' + markHtml(r) +
    '<span class="ag-main"><span class="ag-name">' + esc(r.name) + '</span>' + (meta ? '<span class="ag-meta">' + esc(meta) + '</span>' : '') + '</span>' +
    (pct ? '<span class="ag-pct">' + pct + '</span>' : '') + (who ? avatar(who) : '') + '</div>';
}

function agendaPhase(r) {
  var tasks = data.rows.slice(rowIndex[r.id] + 1, sectionEnd(r.id)).filter(function (x) { return x.type === 'task'; });
  var done = tasks.filter(function (x) { return x.progress >= 1; }).length;
  var p = progressOf(r);
  var shut = isFolded(r.id);
  var s = r.start;
  var span = s % 1 || (r.end != null && r.end % 1) ? timeOf(s) + (r.end != null ? ' – ' + (Math.floor(r.end) === Math.floor(s) ? timeOf(r.end) : listDate(r.end)) : '')
    : r.end != null ? listDate(s) + ' – ' + listDate(r.end - 1) : 'From ' + listDate(s);
  return '<div class="ag-phase' + (shut ? ' shut' : '') + (r.id === freshId ? ' fresh' : '') + '" data-id="' + esc(r.id) + '" role="button" tabindex="0" style="' + colorVar(r).slice(2) + '">' +
    '<div class="ag-ph-top">' + foldBtn(r) + '<i class="m-mark ph"></i><span class="ag-ph-name">' + esc(r.name) + '</span>' +
    (tasks.length ? '<span class="ag-ph-count">' + done + '/' + tasks.length + '</span>' : '') + '</div>' +
    '<div class="ag-ph-foot"><span class="ag-ph-span">' + esc(span) + (shut && foldCount[r.id] ? ' · ' + itemsWord(foldCount[r.id]) + ' hidden' : '') + '</span>' +
    (p != null ? '<span class="progress-bar"><b style="width: ' + Math.round(p * 100) + '%"></b></span>' : '') + '</div></div>';
}

function renderAgenda() {
  if (!data.rows.length) {
    agendaEl.innerHTML = '<div class="m-empty"><p>Nothing here yet.</p><button class="primary" type="button" data-ag-add>Add a task</button></div>';
    return;
  }
  layLines(); // which phases are collapsed, and what they hide
  var prog = projectProgress();
  var counts = ['task', 'phase', 'milestone'].map(function (t) {
    var n = data.rows.filter(function (r) { return r.type === t; }).length;
    return n ? plural(n, t, t + 's') : '';
  }).filter(Boolean).join(' · ');
  var html = '<div class="ag-card">' +
    (prog ? '<svg class="progress-ring" viewBox="0 0 16 16" width="40" height="40" aria-hidden="true" style="--p: ' + prog.p + '"><circle class="track" cx="8" cy="8" r="6.5"></circle>' +
      (prog.p > 0 ? '<circle class="fill" cx="8" cy="8" r="6.5" pathLength="100" stroke-dasharray="' + prog.p * 100 + ' 100"></circle>' : '') + '</svg>' : '') +
    '<div class="ag-card-text"><b>' + (prog ? prog.pct + '% complete' : esc(project().name)) + '</b><span>' + counts + '</span></div>' +
    (data.people.length ? '<button type="button" class="ag-faces" aria-label="' + plural(data.people.length, 'person', 'people') + ': see the workload" data-ag-people>' + facesHtml(data.people) + '</button>' : '') +
    '</div>';
  var phases = data.rows.some(function (r) { return r.type === 'phase'; });
  html += '<div class="ag-bar">' + (phases ? '<button type="button" class="ag-link" data-ag-fold>' + (allFolded() ? 'Expand all' : 'Collapse all') + '</button>' : '<span></span>') +
    '<button type="button" class="ag-now" data-ag-now><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>Now</button></div>';

  var lastDay = null;
  var open = false; // inside a run of items (the line down the side)
  function day(d) {
    if (Math.floor(d) === lastDay) return '';
    lastDay = Math.floor(d);
    var close = open ? '</div>' : '';
    open = false;
    return close + '<div class="ag-day' + (lastDay === Math.floor(nowDay()) ? ' is-now' : '') + '">' + dayHeading(lastDay) + (lastDay === Math.floor(nowDay()) ? ' · Today' : '') + '</div>';
  }
  data.rows.forEach(function (r, i) {
    if (hiddenRow[i]) return;
    html += day(startDay(r));
    if (r.type === 'phase') {
      if (open) html += '</div>';
      open = false;
      html += agendaPhase(r);
      return;
    }
    if (!open) html += '<div class="ag-items">';
    open = true;
    html += agendaItem(r);
  });
  if (open) html += '</div>';
  html += '<button type="button" class="ag-add" data-ag-add><i></i>New task</button>';
  agendaEl.innerHTML = html;
}

// Now: the first item from now on (or the last, when everything's past), on screen.
function agendaToNow() {
  var t = nowDay();
  var rows = data.rows.filter(function (r, i) { return !hiddenRow[i]; });
  var next = rows.filter(function (r) { return (r.end != null ? r.end : startDay(r)) >= t; })[0] || rows[rows.length - 1];
  if (!next) return;
  var el = agendaEl.querySelector('[data-id="' + CSS.escape(next.id) + '"]');
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

agendaEl.addEventListener('click', function (e) {
  if (popupJustClosed) { // that tap closed a popup
    popupJustClosed = false;
    return;
  }
  var t = e.target;
  var fold = t.closest('[data-fold]');
  if (fold) return toggleFold(fold.getAttribute('data-fold'));
  if (t.closest('[data-ag-now]')) return agendaToNow();
  if (t.closest('[data-ag-fold]')) return setAllFolded(!allFolded());
  if (t.closest('[data-ag-people]')) return setPage('workload');
  if (t.closest('[data-ag-add]')) return openForm();
  var item = t.closest('[data-id]');
  if (item) openPeek(item.getAttribute('data-id'), item, 0);
});
agendaEl.addEventListener('keydown', function (e) {
  var item = e.target.closest('[data-id]');
  if (item && e.target === item && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openPeek(item.getAttribute('data-id'), item, 0);
  }
});

// ---------------------------------------------------------------------------------------------
// The workload as a card per person: how many items they have and how many are done, a strip
// of where their items fall across the plan, a dot that turns red when two of their timed
// tasks overlap, and their items listed when the card is opened.
var peopleOpen = sessionStore.getJSON('cronelo.mPeopleOpen') || {};

function renderPeopleM() {
  var items = data.rows.filter(function (r) { return r.type !== 'phase'; });
  var owners = data.people.map(function (p) { return { id: p.id, p: p }; });
  if (items.some(function (r) { return !personById(r.person); }) || !owners.length) owners.push({ id: '', p: null });
  var from = Infinity;
  var to = -Infinity;
  items.forEach(function (r) {
    from = Math.min(from, startDay(r));
    to = Math.max(to, r.end != null ? r.end : startDay(r));
  });
  var oneDay = isFinite(from) && Math.floor(from) === Math.floor(to - 1e-6);
  if (oneDay) { // a day's plan: the strip runs over its hours
    from = Math.floor(from * 24) / 24;
    to = Math.ceil(to * 24) / 24;
  }
  var span = to - from || 1;
  function x(d) { return Math.max(0, Math.min(100, (d - from) / span * 100)); }

  var html = '<div class="pm-head"><div><h2>Workload</h2><span>' + plural(data.people.length, 'person', 'people') + ' · ' + plural(items.length, 'item', 'items') +
    '</span></div></div>';
  if (isFinite(from)) {
    html += '<div class="pm-axis"><span>' + (oneDay ? dayHeading(from) + ' · ' + timeOf(from) : listDate(Math.floor(from))) + '</span><span>' +
      (oneDay ? timeOf(to) : listDate(Math.floor(to - 1e-6))) + '</span></div>';
  }
  html += owners.map(function (o) {
    var mine = items.filter(function (r) { return (personById(r.person) ? r.person : '') === o.id; })
      .sort(function (a, b) { return startDay(a) - startDay(b) || rowIndex[a.id] - rowIndex[b.id]; });
    var done = mine.filter(function (r) { return r.type === 'task' && r.progress >= 1; }).length;
    var over = overlaps(mine);
    var state = over.length ? 'over' : mine.length ? 'ok' : 'idle';
    var name = o.p ? o.p.name : 'Unassigned';
    var isOpen = !!peopleOpen[o.id] && mine.length;
    var strip = mine.map(function (r) {
      var s = startDay(r);
      if (r.type === 'task' && r.end != null && x(r.end) - x(s) > 2) {
        return '<i class="pm-span' + (r.progress >= 1 ? ' done' : '') + '" style="left: ' + x(s) + '%; width: ' + (x(r.end) - x(s)) + '%"></i>';
      }
      return '<i class="pm-dot' + (r.type === 'milestone' ? ' ms' : r.progress >= 1 ? ' done' : '') + '" style="left: ' + x(s) + '%"></i>';
    }).join('');
    var list = isOpen ? '<div class="pm-items">' + mine.map(function (r) {
      var s = startDay(r);
      return '<div class="pm-item' + (r.type === 'task' && r.progress >= 1 ? ' done' : '') + '" data-id="' + esc(r.id) + '" role="button" tabindex="0">' +
        '<span class="pm-time">' + (oneDay ? (s % 1 ? timeOf(s) : 'All day') : listDate(s)) + '</span>' + markHtml(r) +
        '<span class="pm-name">' + esc(r.name) + '</span><span class="pm-phase">' + esc(phaseName(r)) + '</span></div>';
    }).join('') + '</div>' : '';
    var tip = state === 'over' ? 'Overlapping tasks' : state === 'ok' ? 'No overlapping tasks' : 'Nothing assigned';
    return '<section class="pm-card' + (o.p ? '' : ' none') + (isOpen ? ' open' : '') + '"' + (o.p ? ' style="--c: ' + safeColor(o.p.color, AVATAR_COLORS[0]) + '"' : '') + '>' +
      '<button type="button" class="pm-top" aria-expanded="' + !!isOpen + '" data-pm="' + esc(o.id) + '"' + (mine.length ? '' : ' disabled') + '>' +
      (o.p ? avatar(o.p) : '<span class="person-avatar none" aria-hidden="true"></span>') +
      '<span class="pm-who"><b>' + esc(name) + '</b><span>' + (mine.length ? plural(mine.length, 'item', 'items') + ' · ' + done + ' done' : 'Nothing assigned') +
      (over.length ? ' · overlaps' : '') + '</span></span>' +
      '<i class="workload-dot ' + state + '" title="' + tip + '"></i>' + (mine.length ? '<span class="pm-chev">' + ICON_CHEVRON + '</span>' : '') + '</button>' +
      (mine.length ? '<div class="pm-strip">' + strip + '</div>' : '') + list + '</section>';
  }).join('');
  peopleEl.innerHTML = html;
}

peopleEl.addEventListener('click', function (e) {
  if (popupJustClosed) {
    popupJustClosed = false;
    return;
  }
  var top = e.target.closest('[data-pm]');
  if (top) {
    var id = top.getAttribute('data-pm');
    if (peopleOpen[id]) delete peopleOpen[id];
    else peopleOpen[id] = true;
    sessionStore.set('cronelo.mPeopleOpen', JSON.stringify(peopleOpen));
    renderPeopleM();
    var again = peopleEl.querySelector('[data-pm="' + CSS.escape(id) + '"]');
    if (again) again.focus();
    return;
  }
  var item = e.target.closest('[data-id]');
  if (item) openPeek(item.getAttribute('data-id'), item, 0);
});

// ---------------------------------------------------------------------------------------------
// The calendar: the month shows dots for what's on each day, and tapping a day lists it below.
var calSel = +sessionStore.get('cronelo.mCalSel') || TODAY;

function calRowsOn(t) {
  return data.rows.filter(function (r) {
    if (cal.show[r.type] === false) return false;
    var sp = calSpan(r);
    return sp[0] <= t && sp[1] >= t;
  });
}

function decorateCal() {
  var cells = Array.prototype.slice.call(calGrid.querySelectorAll('.cal-day[data-day]'));
  var inView = cells.filter(function (c) { return !c.classList.contains('out'); });
  if (!inView.some(function (c) { return +c.getAttribute('data-day') === calSel; })) {
    var today = inView.filter(function (c) { return +c.getAttribute('data-day') === TODAY; })[0];
    calSel = +(today || inView[0] || cells[0]).getAttribute('data-day');
  }
  sessionStore.set('cronelo.mCalSel', String(calSel));
  cells.forEach(function (c) {
    var t = +c.getAttribute('data-day');
    var on = calRowsOn(t);
    c.classList.toggle('sel', t === calSel);
    c.setAttribute('aria-pressed', String(t === calSel));
    c.removeAttribute('title'); // "Click to add a task": a tap picks the day here
    c.querySelector('.cal-date').textContent = new Date(t).getUTCDate(); // just the number in the small month
    var kinds = [];
    if (on.some(function (r) { return r.type === 'milestone'; })) kinds.push('<i class="ms"></i>');
    if (on.some(function (r) { return r.type === 'phase'; })) kinds.push('<i class="ph"></i>');
    on.filter(function (r) { return r.type === 'task'; }).slice(0, 3 - kinds.length).forEach(function (r) {
      kinds.push('<i style="' + colorVar(r).slice(2) + '"></i>');
    });
    var dots = c.querySelector('.m-dots') || c.appendChild(document.createElement('span'));
    dots.className = 'm-dots';
    dots.innerHTML = kinds.slice(0, 3).join('');
  });
  renderCalDay();
}

function renderCalDay() {
  var on = calRowsOn(calSel).sort(function (a, b) {
    var rank = { milestone: 0, phase: 1, task: 2 };
    return rank[a.type] - rank[b.type] || startDay(a) - startDay(b) || rowIndex[a.id] - rowIndex[b.id];
  });
  var d = new Date(calSel);
  var counts = ['milestone', 'phase', 'task'].map(function (t) {
    var n = on.filter(function (r) { return r.type === t; }).length;
    return n ? plural(n, t, t + 's') : '';
  }).filter(Boolean).join(' · ');
  var day = (calSel - PLAN_START) / DAY;
  calDayList.innerHTML = '<div class="cd-head"><b>' + WEEKDAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MONTHS_LONG[d.getUTCMonth()] + '</b><span>' + (counts || 'Nothing on') + '</span></div>' +
    on.map(function (r) {
      var s = startDay(r);
      var time = Math.floor(s) === day && s % 1 ? timeOf(s) : Math.floor(s) === day ? 'All day' : 'From ' + listDate(Math.floor(s)).replace(/ \d{4}$/, '');
      var right = '';
      if (r.type === 'milestone') right = '<span class="status ms">Milestone</span>';
      else if (r.type === 'phase') {
        var n = data.rows.slice(rowIndex[r.id] + 1, sectionEnd(r.id)).filter(function (x) { return x.type === 'task'; }).length;
        right = n ? '<span class="cd-count">' + plural(n, 'task', 'tasks') + '</span>' : '';
      } else {
        var st = statusOf(r);
        right = '<span class="status ' + st + '">' + STATUS[st] + '</span>';
      }
      return '<div class="cd-item k-' + (r.type === 'task' && r.parent ? 'sub' : r.type) + (r.type === 'task' && r.progress >= 1 ? ' done' : '') + '" data-id="' + esc(r.id) +
        '" role="button" tabindex="0" style="' + colorVar(r).slice(2) + '">' + markHtml(r) + '<span class="cd-time">' + time + '</span><span class="cd-name">' + esc(r.name) + '</span>' + right + '</div>';
    }).join('') + '<button type="button" class="ag-add" data-cd-add><i></i>New task on ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + '</button>';
}

function addOnDay(t) {
  openForm();
  form.elements.startDate.value = isoDate(t);
  form.elements.allDay.checked = true;
  syncForm();
}

// On a phone a tap on a day picks it, and a tap on an item opens its details. Runs before the
// calendar's own clicks (capture), which add a task or open the form instead.
calEl.addEventListener('click', function (e) {
  if (!isMobile()) return;
  var cell = e.target.closest('.cal-day[data-day]');
  if (!cell || !calGrid.contains(cell)) return;
  e.stopPropagation();
  if (popupJustClosed) {
    popupJustClosed = false;
    return;
  }
  calSel = +cell.getAttribute('data-day');
  decorateCal();
}, true);

calDayList.addEventListener('click', function (e) {
  if (popupJustClosed) {
    popupJustClosed = false;
    return;
  }
  if (e.target.closest('[data-cd-add]')) return addOnDay(calSel);
  var item = e.target.closest('[data-id]');
  if (item) openPeek(item.getAttribute('data-id'), item, 0);
});

// ---------------------------------------------------------------------------------------------
// The board: one column at a time, swiped sideways, with a chip per column to jump to it.
function renderBoardJump() {
  var cols = Array.prototype.slice.call(boardCols.querySelectorAll('.board-col'));
  boardJump.innerHTML = cols.map(function (c, i) {
    var dot = c.querySelector('.board-col-head > .col-dot, .board-col-head > .person-avatar');
    return '<button type="button" class="chip-jump" data-jump="' + i + '">' + (dot ? dot.outerHTML : '') +
      '<span>' + esc(c.querySelector('.board-col-title').textContent) + '</span><b>' + c.querySelector('.board-col-count').textContent + '</b></button>';
  }).join('');
  syncBoardJump();
}

function syncBoardJump() {
  var cols = boardCols.querySelectorAll('.board-col');
  if (!cols.length) return;
  var w = cols[0].offsetWidth || 1;
  var at = Math.round(boardScroll.scrollLeft / (w + 10));
  Array.prototype.forEach.call(boardJump.querySelectorAll('[data-jump]'), function (b, i) {
    var on = i === at;
    if (on !== b.classList.contains('on')) {
      b.classList.toggle('on', on);
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });
}

boardJump.addEventListener('click', function (e) {
  var b = e.target.closest('[data-jump]');
  if (!b) return;
  var col = boardCols.querySelectorAll('.board-col')[+b.getAttribute('data-jump')];
  if (col) boardScroll.scrollTo({ left: col.offsetLeft - boardCols.offsetLeft, behavior: 'smooth' });
});
boardScroll.addEventListener('scroll', function () { if (isMobile()) syncBoardJump(); }, { passive: true });

// ---------------------------------------------------------------------------------------------
// Tapping an item on the list, board or calendar opens its details sheet (Edit is a tap away),
// where a mouse click on a bigger screen goes straight to the form.
function tapToPeek(box, sel) {
  box.addEventListener('click', function (e) {
    if (!isMobile()) return;
    var el = e.target.closest(sel);
    if (!el || e.target.closest('button, [data-fold], select, input')) return;
    e.stopPropagation();
    if (popupJustClosed) {
      popupJustClosed = false;
      return;
    }
    openPeek(el.getAttribute('data-id'), el, 0);
  }, true);
}
tapToPeek(listEl, '.list-row[data-id]');
tapToPeek(boardEl, '.card[data-id]');

// The + button: on the calendar it adds on the day picked.
newBtn.addEventListener('click', function (e) {
  if (!isMobile() || app.getAttribute('data-page') !== 'calendar') return;
  e.stopImmediatePropagation();
  addOnDay(calSel);
}, true);

// ---------------------------------------------------------------------------------------------
// The details sheet: swipe it down to close.
(function () {
  var start = null;
  peek.addEventListener('touchstart', function (e) {
    if (!isMobile() || peek.scrollTop > 0 || e.touches.length !== 1) return;
    start = { y: e.touches[0].clientY, dy: 0 };
  }, { passive: true });
  peek.addEventListener('touchmove', function (e) {
    if (!start) return;
    start.dy = Math.max(0, e.touches[0].clientY - start.y);
    peek.style.transform = start.dy ? 'translateY(' + start.dy + 'px)' : '';
    peek.style.transition = 'none';
  }, { passive: true });
  peek.addEventListener('touchend', function () {
    if (!start) return;
    var far = start.dy > 90;
    start = null;
    peek.style.transition = '';
    peek.style.transform = '';
    if (far) closePeek();
  });
})();

// ---------------------------------------------------------------------------------------------
// The ⋯ sheet: undo and redo, the project's actions, settings, profile and theme.
function moreItem(act, label, hint, opts) {
  opts = opts || {};
  return '<button type="button" class="m-sheet-item' + (opts.danger ? ' danger' : '') + '" data-more="' + act + '"' + (opts.disabled ? ' disabled' : '') + '>' +
    '<span>' + label + (hint ? '<em>' + hint + '</em>' : '') + '</span></button>';
}

function renderMore() {
  var dark = root.getAttribute('data-theme') === 'dark';
  moreSheet.innerHTML = '<div class="m-handle" aria-hidden="true"></div>' +
    '<div class="m-sheet-row">' +
    '<button type="button" class="btn" data-more="undo"' + (undoBtn.disabled ? ' disabled' : '') + '>' + undoBtn.innerHTML + 'Undo</button>' +
    '<button type="button" class="btn" data-more="redo"' + (redoBtn.disabled ? ' disabled' : '') + '>' + redoBtn.innerHTML + 'Redo</button></div>' +
    '<div class="m-sheet-head">Project</div>' +
    moreItem('settings', 'Project settings', 'Defaults, people, tags and more') +
    moreItem('duplicate', 'Duplicate project', 'A copy to work on separately') +
    moreItem('template', 'Save as template…', 'Start new projects from this one') +
    moreItem('reset', 'Reset project…', 'Remove every item', { danger: true }) +
    '<div class="m-sheet-head">You</div>' +
    moreItem('profile', 'Your profile', 'Name, colour, account and sign out') +
    moreItem('theme', dark ? 'Light mode' : 'Dark mode') +
    moreItem('home', 'All your projects', 'Back to Cronelo');
}

function openMore(open) {
  if (open) renderMore();
  moreSheet.hidden = moreBack.hidden = !open;
  moreBtn.setAttribute('aria-expanded', String(open));
  if (open) moreSheet.querySelector('button:not(:disabled)').focus();
}

moreBtn.addEventListener('click', function () { openMore(moreSheet.hidden); });
moreBack.addEventListener('click', function () { openMore(false); });
moreSheet.addEventListener('click', function (e) {
  var b = e.target.closest('[data-more]');
  if (!b) return;
  var act = b.getAttribute('data-more');
  if (act === 'undo' || act === 'redo') {
    stepHistory(act === 'undo');
    return renderMore(); // stays open for another step
  }
  openMore(false);
  if (act === 'settings') setPage('settings');
  else if (act === 'duplicate') duplicateProject();
  else if (act === 'template') openTemplateDialog();
  else if (act === 'reset') openResetDialog();
  else if (act === 'profile') openProfile(true);
  else if (act === 'theme') toggle.click();
  else if (act === 'home') goHome();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !moreSheet.hidden) openMore(false);
});

// ---------------------------------------------------------------------------------------------
// Keep the phone's own views drawn with the rest: the plan's redraw (every change, collapsing
// and switching pages) redraws the agenda and workload cards, the calendar's its day list and
// the board's its chips.
function renderMobile() {
  if (!isMobile()) return;
  renderAgenda();
  renderPeopleM();
}

var baseRenderPlan = renderPlan;
renderPlan = function () {
  baseRenderPlan();
  renderMobile();
};
var baseRenderCal = renderCal;
renderCal = function () {
  baseRenderCal();
  if (isMobile()) decorateCal();
};
var baseRenderBoard = renderBoard;
renderBoard = function () {
  baseRenderBoard();
  if (isMobile()) renderBoardJump();
};

// Turning the phone, or resizing the window across the line, redraws for the new layout.
function onLayoutChange() {
  if (!isMobile()) {
    openMore(false);
    baseRenderCal(); // the calendar as a bigger screen draws it
    return;
  }
  renderMobile();
  decorateCal();
  renderBoardJump();
}
if (MOBILE_MQ.addEventListener) MOBILE_MQ.addEventListener('change', onLayoutChange);
else MOBILE_MQ.addListener(onLayoutChange);
onLayoutChange();
