/* StrongLean. Static, on-device strength trainer. */
(function () {
  const Lib = window.GymLibrary;
  const L = window.GymLogic;
  const view = document.getElementById('view');
  const CIRC = 2 * Math.PI * 18;

  const MUSCLE_REGIONS = {
    chest: ['pecUL', 'pecUR', 'pecLL', 'pecLR'], pecs: ['pecUL', 'pecUR', 'pecLL', 'pecLR'],
    'upper chest': ['pecUL', 'pecUR', 'deltFL', 'deltFR'], 'lower chest': ['pecLL', 'pecLR'],
    shoulders: ['deltFL', 'deltFR', 'deltBL', 'deltBR'], 'front delts': ['deltFL', 'deltFR'],
    'side delts': ['deltFL', 'deltFR', 'deltBL', 'deltBR'], 'rear delts': ['deltBL', 'deltBR'],
    'rear shoulders': ['deltBL', 'deltBR'], 'rotator cuff': ['deltBL', 'deltBR'],
    traps: ['traps'], 'upper back': ['traps', 'latL', 'latR'], back: ['latL', 'latR', 'traps'],
    'mid back': ['latL', 'latR'], lats: ['latL', 'latR'], 'lower back': ['lowerBack'],
    abs: ['abs'], core: ['abs', 'oblL', 'oblR'], 'deep core': ['abs'], obliques: ['oblL', 'oblR'],
    'hip flexors': ['abs'], biceps: ['bicL', 'bicR'], triceps: ['triL', 'triR'],
    forearms: ['fArmL', 'fArmR'], grip: ['fArmL', 'fArmR'], glutes: ['glutes'], hips: ['glutes'],
    quads: ['quadL', 'quadR'], hamstrings: ['hamL', 'hamR'], adductors: ['adductors'],
    'outer thighs': ['glutes'], legs: ['quadL', 'quadR', 'hamL', 'hamR', 'glutes'],
    'posterior chain': ['glutes', 'hamL', 'hamR', 'lowerBack'],
    calves: ['calfFL', 'calfFR', 'calfBL', 'calfBR'], ankles: ['calfFL', 'calfFR'],
    'full body': ['pecUL', 'pecUR', 'pecLL', 'pecLR', 'abs', 'bicL', 'bicR', 'triL', 'triR', 'quadL', 'quadR', 'deltFL', 'deltFR', 'latL', 'latR', 'glutes', 'hamL', 'hamR']
  };

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'Gym', label: 'Gym' },
    { id: 'Home', label: 'Home' },
    { id: 'Pull-up Bar', label: 'Bar' },
    { id: 'Calisthenics', label: 'Calisthenics' },
    { id: 'Core', label: 'Core' }
  ];

  const state = {
    section: 'today',
    unit: 'kg',
    weight: 65,
    notifications: true,
    workouts: [],
    templates: [],
    session: null,
    dayType: null,
    sessionExercises: [],
    startTime: null,
    rest: null,
    openId: null,
    query: '',
    filter: 'all',
    sheet: null,
    template: null,
    draft: null,
    dialog: null,
    notes: '',
    calcW: '100',
    calcR: '5',
    canInstall: false,
    scrollToId: null
  };

  let deferredPrompt = null;
  let restTimer = null;
  let elapsedTimer = null;
  let audioCtx = null;
  let toastTimer = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null || raw === '') return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function sameId(a, b) {
    return String(a) === String(b);
  }

  function idFrom(el) {
    const raw = el.dataset.id;
    return raw && /^\d+$/.test(raw) ? Number(raw) : raw;
  }

  function exerciseName(ex) {
    if (!ex) return 'Exercise';
    if (ex.name) return ex.name;
    const found = Lib.byId[ex.id];
    return found ? found.name : 'Exercise';
  }

  function displayWeight(kg) {
    if (kg == null || kg === '') return '';
    const n = L.toDisplayWeight(kg, state.unit);
    return n === '' ? '' : String(n);
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const today = new Date();
    const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
    if (sameDay) return 'Today';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function routineTitle(type) {
    if (Lib.programs[type]) return Lib.programs[type].name;
    const template = state.templates.find(function (item) { return item.id === type; });
    if (template) return template.name;
    return 'Workout';
  }

  function workoutTitle(workout) {
    if (!workout) return 'Workout';
    if (workout.typeName) return workout.typeName;
    if (Lib.programs[workout.type]) return Lib.programs[workout.type].name;
    if (String(workout.type || '').indexOf('custom_') === 0) {
      const template = state.templates.find(function (item) { return item.id === workout.type; });
      return template ? template.name : 'Custom';
    }
    return 'Workout';
  }

  function sessionExercise(id) {
    return state.sessionExercises.find(function (ex) { return sameId(ex.id, id); });
  }

  function findLog(id) {
    if (!state.session) return null;
    return (state.session.exercises || []).find(function (ex) { return sameId(ex.id, id); });
  }

  function ensureLog(id) {
    let log = findLog(id);
    const ex = sessionExercise(id);
    if (!log) {
      log = { id: ex ? ex.id : id, name: ex ? ex.name : 'Exercise', completedSets: [] };
      state.session.exercises.push(log);
    }
    if (ex && ex.name) log.name = ex.name;
    return log;
  }

  function loggedSetCount(log) {
    return ((log && log.completedSets) || []).filter(function (set) {
      return set && (Number(set.reps) > 0 || Number(set.weight) > 0);
    }).length;
  }

  function progressCounts() {
    let done = 0;
    let total = 0;
    state.sessionExercises.forEach(function (ex) {
      const log = findLog(ex.id);
      const count = L.setCount(log, ex);
      total += count;
      done += Math.min(count, loggedSetCount(log));
    });
    return { done: done, total: total };
  }

  function nextIncompleteId(afterId) {
    const list = state.sessionExercises;
    const start = Math.max(0, list.findIndex(function (ex) { return sameId(ex.id, afterId); }));
    for (let step = 1; step <= list.length; step += 1) {
      const ex = list[(start + step) % list.length];
      const log = findLog(ex.id);
      if (loggedSetCount(log) < L.setCount(log, ex)) return ex.id;
    }
    return afterId;
  }

  function libraryMatches(ex) {
    if (state.filter === 'Core') {
      const muscles = (ex.muscles || []).join(' ').toLowerCase();
      const core = ex.category === 'Core' || /abs|core|oblique/.test(muscles);
      if (!core) return false;
    } else if (state.filter !== 'all' && ex.category !== state.filter) {
      return false;
    }
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    return [ex.name, (ex.muscles || []).join(' '), ex.category || '', ex.cue || ''].join(' ').toLowerCase().indexOf(q) !== -1;
  }

  function filteredLibrary() {
    return Lib.library.filter(libraryMatches).slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  }

  function icon(name) {
    const paths = {
      today: '<rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 9h16M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      train: '<path d="M4 9h2.2v6H4a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zm14 0H20a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2v-6zM7.2 10.2h9.6v3.6H7.2z" fill="currentColor"/>',
      history: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4.2l2.8 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      library: '<path d="M5 5.5h10.5A2.5 2.5 0 0 1 18 8v11H7.2A2.2 2.2 0 0 0 5 21.2V5.5z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H18v16" fill="none" stroke="currentColor" stroke-width="1.8"/>',
      you: '<circle cx="12" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.5 19.5c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths[name] + '</svg>';
  }

  function muscleSVG(muscles) {
    const active = new Set();
    (muscles || []).forEach(function (muscle) {
      (MUSCLE_REGIONS[String(muscle).toLowerCase()] || []).forEach(function (region) { active.add(region); });
    });
    const on = 'var(--green)';
    const off = 'var(--fill)';
    const sil = 'var(--track)';
    const skin = 'var(--tertiary)';
    const f = function (region) { return active.has(region) ? on : off; };
    return '<svg viewBox="0 0 220 200" role="img" aria-label="Muscles worked, front and back">' +
      '<g><circle cx="50" cy="14" r="9" fill="' + skin + '"/>' +
      '<rect x="22" y="24" width="56" height="15" rx="7" fill="' + sil + '"/>' +
      '<rect x="33" y="24" width="34" height="66" rx="10" fill="' + sil + '"/>' +
      '<rect x="15" y="30" width="11" height="52" rx="5" fill="' + sil + '" transform="rotate(9 20 56)"/>' +
      '<rect x="74" y="30" width="11" height="52" rx="5" fill="' + sil + '" transform="rotate(-9 80 56)"/>' +
      '<rect x="34" y="86" width="32" height="14" rx="6" fill="' + sil + '"/>' +
      '<rect x="34" y="98" width="14" height="80" rx="7" fill="' + sil + '"/>' +
      '<rect x="52" y="98" width="14" height="80" rx="7" fill="' + sil + '"/>' +
      '<ellipse cx="27" cy="33" rx="8" ry="7" fill="' + f('deltFL') + '"/>' +
      '<ellipse cx="73" cy="33" rx="8" ry="7" fill="' + f('deltFR') + '"/>' +
      '<rect x="35" y="37" width="14" height="8" rx="3" fill="' + f('pecUL') + '"/>' +
      '<rect x="51" y="37" width="14" height="8" rx="3" fill="' + f('pecUR') + '"/>' +
      '<rect x="35" y="46" width="14" height="8" rx="3" fill="' + f('pecLL') + '"/>' +
      '<rect x="51" y="46" width="14" height="8" rx="3" fill="' + f('pecLR') + '"/>' +
      '<ellipse cx="19" cy="47" rx="5" ry="10" fill="' + f('bicL') + '" transform="rotate(9 19 47)"/>' +
      '<ellipse cx="81" cy="47" rx="5" ry="10" fill="' + f('bicR') + '" transform="rotate(-9 81 47)"/>' +
      '<rect x="42" y="57" width="16" height="26" rx="3" fill="' + f('abs') + '"/>' +
      '<rect x="35" y="58" width="6" height="22" rx="3" fill="' + f('oblL') + '"/>' +
      '<rect x="59" y="58" width="6" height="22" rx="3" fill="' + f('oblR') + '"/>' +
      '<ellipse cx="41" cy="122" rx="7" ry="21" fill="' + f('quadL') + '"/>' +
      '<ellipse cx="59" cy="122" rx="7" ry="21" fill="' + f('quadR') + '"/>' +
      '<ellipse cx="41" cy="160" rx="4" ry="12" fill="' + f('calfFL') + '"/>' +
      '<ellipse cx="59" cy="160" rx="4" ry="12" fill="' + f('calfFR') + '"/>' +
      '<text x="50" y="196" text-anchor="middle" font-size="9" fill="var(--secondary)">FRONT</text></g>' +
      '<g transform="translate(120,0)"><circle cx="50" cy="14" r="9" fill="' + skin + '"/>' +
      '<rect x="22" y="24" width="56" height="15" rx="7" fill="' + sil + '"/>' +
      '<rect x="33" y="24" width="34" height="66" rx="10" fill="' + sil + '"/>' +
      '<path d="M35 34 L65 34 L58 50 L50 46 L42 50 Z" fill="' + f('traps') + '"/>' +
      '<ellipse cx="27" cy="33" rx="8" ry="7" fill="' + f('deltBL') + '"/>' +
      '<ellipse cx="73" cy="33" rx="8" ry="7" fill="' + f('deltBR') + '"/>' +
      '<path d="M36 50 L48 50 L46 68 L38 64 Z" fill="' + f('latL') + '"/>' +
      '<path d="M64 50 L52 50 L54 68 L62 64 Z" fill="' + f('latR') + '"/>' +
      '<ellipse cx="19" cy="47" rx="5" ry="10" fill="' + f('triL') + '" transform="rotate(9 19 47)"/>' +
      '<ellipse cx="81" cy="47" rx="5" ry="10" fill="' + f('triR') + '" transform="rotate(-9 81 47)"/>' +
      '<rect x="42" y="66" width="16" height="14" rx="3" fill="' + f('lowerBack') + '"/>' +
      '<rect x="36" y="84" width="28" height="16" rx="8" fill="' + f('glutes') + '"/>' +
      '<ellipse cx="41" cy="124" rx="7" ry="20" fill="' + f('hamL') + '"/>' +
      '<ellipse cx="59" cy="124" rx="7" ry="20" fill="' + f('hamR') + '"/>' +
      '<ellipse cx="41" cy="160" rx="4.5" ry="13" fill="' + f('calfBL') + '"/>' +
      '<ellipse cx="59" cy="160" rx="4.5" ry="13" fill="' + f('calfBR') + '"/>' +
      '<text x="50" y="196" text-anchor="middle" font-size="9" fill="var(--secondary)">BACK</text></g></svg>';
  }

  function trendSVG(values) {
    const geom = L.chartGeometry(values, 320, 120, 18);
    if (!geom) return '';
    const d = geom.map(function (point, index) {
      return (index === 0 ? 'M' : 'L') + point.x + ' ' + point.y;
    }).join(' ');
    const dots = geom.map(function (point) {
      return '<circle cx="' + point.x + '" cy="' + point.y + '" r="3.5"></circle>';
    }).join('');
    return '<svg class="trend" viewBox="0 0 320 120" role="img" aria-label="Progress chart"><path d="' + d + '"></path>' + dots + '</svg>';
  }

  function recentMuscles() {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const names = [];
    state.workouts.forEach(function (workout) {
      if (!workout.date || new Date(workout.date).getTime() < cutoff) return;
      (workout.exercises || []).forEach(function (ex) {
        if (!loggedSetCount(ex)) return;
        const def = Lib.byId[ex.id];
        (def && def.muscles || []).forEach(function (muscle) {
          if (names.indexOf(muscle) === -1) names.push(muscle);
        });
      });
    });
    return names;
  }

  function saveWorkouts() {
    localStorage.setItem('stronglean_workouts', JSON.stringify(state.workouts));
  }

  function saveTemplates() {
    localStorage.setItem('stronglean_templates', JSON.stringify(state.templates));
  }

  function saveActive() {
    if (!state.session) {
      localStorage.removeItem('gymActiveState');
      return;
    }
    localStorage.setItem('gymActiveState', JSON.stringify({
      currentWorkout: state.session,
      currentDayType: state.dayType,
      workoutStartTime: state.startTime,
      sessionExercises: state.sessionExercises,
      timerRemaining: state.rest ? state.rest.remaining : 0,
      timerPaused: state.rest ? !!state.rest.paused : false,
      restEndsAt: state.rest ? state.rest.endsAt : null,
      restName: state.rest ? state.rest.name : '',
      restTotal: state.rest ? state.rest.total : 0,
      activeSection: state.section,
      openId: state.openId
    }));
  }

  function load() {
    const unit = localStorage.getItem('stronglean_unit');
    state.unit = unit === 'lbs' ? 'lbs' : 'kg';
    const weight = parseFloat(localStorage.getItem('user_weight'));
    state.weight = Number.isFinite(weight) ? weight : 65;
    state.notifications = localStorage.getItem('gymNotifications') !== 'false';
    const workouts = readJSON('stronglean_workouts', []);
    state.workouts = Array.isArray(workouts) ? workouts : [];
    const templates = readJSON('stronglean_templates', []);
    state.templates = Array.isArray(templates) ? templates : [];
    const saved = readJSON('gymActiveState', null);
    if (saved && saved.currentWorkout) {
      state.session = saved.currentWorkout;
      state.dayType = saved.currentDayType;
      state.startTime = saved.workoutStartTime || saved.currentWorkout.startTime || Date.now();
      state.openId = saved.openId;
      state.sessionExercises = L.resolveSessionExercises({
        dayType: state.dayType,
        workout: state.session,
        programs: Lib.programs,
        templates: state.templates,
        sessionExercises: saved.sessionExercises
      });
      if (!state.sessionExercises.length) {
        state.sessionExercises = (state.session.exercises || []).map(function (log) {
          const known = Lib.byId[log.id];
          if (known) return L.clone(known);
          return {
            id: log.id,
            name: log.name || 'Exercise',
            muscles: [],
            sets: log.customSets || 3,
            reps: '8-12',
            rest: 90,
            description: '',
            cue: '',
            alternatives: []
          };
        });
      }
      if (saved.restEndsAt && saved.timerRemaining > 0) {
        if (saved.timerPaused) {
          state.rest = {
            total: saved.restTotal || saved.timerRemaining,
            remaining: saved.timerRemaining,
            paused: true,
            name: saved.restName || 'Rest',
            endsAt: null
          };
        } else if (saved.restEndsAt > Date.now()) {
          state.rest = {
            total: saved.restTotal || saved.timerRemaining,
            remaining: Math.ceil((saved.restEndsAt - Date.now()) / 1000),
            paused: false,
            name: saved.restName || 'Rest',
            endsAt: saved.restEndsAt
          };
        }
      }
      const sectionMap = { dashboard: 'today', workout: 'train', tips: 'you', today: 'today', train: 'train', history: 'history', library: 'library', you: 'you' };
      state.section = sectionMap[saved.activeSection] || 'train';
    }
  }

  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function paintThemeColor() {
    const stored = localStorage.getItem('theme');
    const dark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', dark ? '#000000' : '#f2f2f7');
  }

  function applyTheme(mode) {
    if (mode === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', mode);
    document.documentElement.classList.remove('light', 'dark');
    const stored = localStorage.getItem('theme');
    if (stored === 'light') document.documentElement.classList.add('light');
    if (stored === 'dark') document.documentElement.classList.add('dark');
    paintThemeColor();
    if (state.section === 'you' && !state.sheet && !state.template) render({ keepScroll: true });
  }

  function unlockAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }

  function playBeep() {
    try {
      unlockAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      [523.25, 659.25].forEach(function (freq, index) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + index * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    } catch (e) {}
  }

  function render(options) {
    const opts = options || {};
    const keep = !!opts.keepScroll;
    const y = keep ? window.scrollY : 0;
    view.innerHTML = pages[state.section] ? pages[state.section]() : pages.today();
    view.classList.remove('view-enter');
    if (!keep) {
      void view.offsetWidth;
      view.classList.add('view-enter');
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, y);
    }
    if (state.scrollToId) {
      const target = document.getElementById('ex-' + state.scrollToId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      state.scrollToId = null;
    }
    renderChrome();
    ensureElapsed();
  }

  function renderChrome() {
    renderTabs();
    renderRest(false);
    renderOverlay();
    renderDialog();
    document.body.classList.toggle('resting', !!(state.rest && state.rest.remaining > 0));
    if (state.rest && state.rest.remaining > 0) ensureRestTicker();
  }

  function renderTabs() {
    const tabs = [
      ['today', 'Today', 'today'],
      ['train', 'Train', 'train'],
      ['history', 'History', 'history'],
      ['library', 'Library', 'library'],
      ['you', 'You', 'you']
    ];
    document.getElementById('tabbar').innerHTML = tabs.map(function (tab) {
      const current = state.section === tab[0] ? ' aria-current="page"' : '';
      const dot = tab[0] === 'train' && state.session ? '<i class="dot"></i>' : '';
      return '<button type="button" data-action="nav" data-section="' + tab[0] + '"' + current + '>' +
        icon(tab[2]) + dot + '<span>' + tab[1] + '</span></button>';
    }).join('');
  }

  const pages = {
    today: renderToday,
    train: renderTrain,
    history: renderHistory,
    library: renderLibrary,
    you: renderYou
  };

  function renderToday() {
    const week = L.weekCount(state.workouts);
    const streak = L.streak(state.workouts);
    const avg = L.avgDuration(state.workouts);
    const volume = state.workouts.reduce(function (sum, workout) {
      return sum + (Number(workout.totalVolume) || L.volumeOf(workout));
    }, 0);
    const series = L.recentVolume(state.workouts, 7);
    const muscles = recentMuscles();
    const recent = state.workouts.slice(0, 3);
    const resume = state.session
      ? '<button class="btn btn-primary" data-action="nav" data-section="train">Resume ' + esc(routineTitle(state.dayType)) + '</button>'
      : '<button class="btn btn-primary" data-action="nav" data-section="train">Start a workout</button>';
    const install = state.canInstall
      ? '<button class="add-row" data-action="install">Install StrongLean</button>'
      : '';
    return '<section class="page">' +
      '<header class="page-head"><div><h1>Today</h1><p class="lede">A calm place for routines, sets, and the progress that follows.</p></div></header>' +
      '<div class="today-grid"><div class="stack">' +
      '<div class="card hero-card"><p class="eyebrow">This week</p><p class="hero-number">' + week + '</p><p class="hero-unit">' + (week === 1 ? 'workout' : 'workouts') + '</p>' +
      '<div class="macro-pills"><span>' + streak + ' day streak</span><span>' + esc(shownVolume(volume)) + ' ' + esc(state.unit) + '</span>' +
      (avg ? '<span>' + avg + ' min avg</span>' : '') + '</div></div>' +
      resume +
      (install ? '<div class="group">' + install + '</div>' : '') +
      '</div><div>' +
      (series.length >= 2
        ? '<div class="section-head"><h2>Volume</h2><span>Last ' + series.length + '</span></div><div class="card" style="padding:12px 12px 8px">' + trendSVG(series.map(function (point) { return point.volume; })) + '<p class="hero-sub">Latest ' + esc(shownVolume(series[series.length - 1].volume)) + ' ' + esc(state.unit) + '</p></div>'
        : '<div class="section-head"><h2>Volume</h2></div><div class="card empty"><h3>Two sessions start the line</h3><p>Finish a couple of workouts and the weekly volume shows up here.</p></div>') +
      (muscles.length
        ? '<div class="section-head"><h2>Last 7 days</h2></div><div class="card" style="padding:12px">' + muscleSVG(muscles) + '<div class="muscle-pills">' + muscles.slice(0, 8).map(function (muscle) { return '<span class="pill">' + esc(muscle) + '</span>'; }).join('') + '</div></div>'
        : '') +
      '</div></div>' +
      '<div class="section-head"><h2>Recent</h2></div>' +
      (recent.length
        ? '<div class="group">' + recent.map(function (workout, index) {
          return '<button class="log-row" data-action="open-history" data-index="' + index + '"><span class="choice-copy"><strong>' + esc(workoutTitle(workout)) + '</strong><small>' + esc(formatWhen(workout.date)) + ' · ' + esc(shownVolume(workout.totalVolume || L.volumeOf(workout))) + ' ' + esc(state.unit) + '</small></span><span class="chevron">›</span></button>';
        }).join('') + '</div>'
        : '<div class="empty"><div class="empty-icon">' + icon('train') + '</div><h3>Nothing logged yet</h3><p>Start a built-in day or make a routine. It stays on this device.</p></div>') +
      '<p class="footnote">Everything stays on this device. No account, no cloud.</p></section>';
  }

  function renderTrain() {
    if (state.session) return renderSession();
    const builtin = Object.keys(Lib.programs).map(function (key) {
      const program = Lib.programs[key];
      return '<button class="log-row" data-action="start" data-type="' + esc(program.id) + '"><span class="choice-copy"><strong>' + esc(program.name) + '</strong><small>' + esc(program.detail) + ' · ' + program.exercises.length + ' exercises</small></span><span class="chevron">›</span></button>';
    }).join('');
    const custom = state.templates.map(function (template) {
      return '<div class="food-row"><button class="food-main" data-action="start" data-type="' + esc(template.id) + '"><span class="choice-copy"><strong>' + esc(template.name) + '</strong><small>' + template.exercises.length + ' exercises</small></span></button>' +
        '<button class="icon-btn" data-action="edit-template" data-id="' + esc(template.id) + '" aria-label="Edit ' + esc(template.name) + '">Edit</button></div>';
    }).join('');
    return '<section class="page"><header class="page-head"><div><h1>Train</h1><p class="lede">Built-in days, or a routine of your own.</p></div></header>' +
      '<div class="group"><button class="add-row" data-action="open-template">Create a routine</button></div>' +
      '<div class="section-label">Routines</div><div class="group">' + custom + builtin + '</div></section>';
  }

  function renderSession() {
    const counts = progressCounts();
    const cards = state.sessionExercises.map(function (ex, index) { return exerciseCard(ex, index); }).join('');
    return '<section class="page"><header class="page-head"><div class="titles"><h1>' + esc(routineTitle(state.dayType)) + '</h1><p class="lede"><span id="elapsed">' + esc(L.formatElapsed(Date.now() - state.startTime)) + '</span> · ' + counts.done + ' of ' + counts.total + ' sets</p></div>' +
      '<button class="text-btn strong" data-action="finish">Finish</button></header>' +
      cards +
      '<div class="group"><button class="add-row" data-action="open-add">Add an exercise</button><button class="add-row" data-action="open-abs">Add core work</button></div>' +
      '<button class="btn btn-quiet danger-text" data-action="discard">Discard workout</button></section>';
  }

  function exerciseCard(ex, index) {
    const log = findLog(ex.id);
    const total = L.setCount(log, ex);
    const done = loggedSetCount(log);
    const complete = done >= total && total > 0;
    const open = sameId(state.openId, ex.id) || (state.openId == null && index === 0 && !complete);
    const last = L.lastPerformance(state.workouts, ex.id, state.dayType);
    const lastLine = last && Number(last.weight) > 0
      ? '<small>Last ' + esc(displayWeight(last.weight)) + ' ' + esc(state.unit) + ' × ' + esc(last.reps) + '</small>'
      : '<small>' + esc((ex.muscles || []).slice(0, 3).join(' · ')) + '</small>';
    const badge = complete ? '✓' : String(index + 1);
    let nextMarked = false;
    const rows = [];
    for (let i = 0; i < total; i += 1) {
      const set = log && log.completedSets ? log.completedSets[i] : null;
      const logged = set && (Number(set.reps) > 0 || Number(set.weight) > 0);
      const isNext = !logged && !nextMarked && !complete;
      if (isNext) nextMarked = true;
      if (logged) {
        const weightText = Number(set.weight) > 0 ? esc(displayWeight(set.weight)) + ' ' + esc(state.unit) + ' × ' + esc(set.reps) : esc(set.reps) + ' reps';
        rows.push('<div class="set-row"><span class="set-num done">✓</span><span class="set-copy"><strong>' + weightText + '</strong><small>Set ' + (i + 1) + '</small></span><button class="set-go quiet" data-action="open-log" data-id="' + esc(ex.id) + '" data-index="' + i + '" data-slot="' + index + '">Edit</button></div>');
      } else {
        const same = previousNumbers(ex, i);
        rows.push('<div class="set-row"><span class="set-num' + (isNext ? ' next' : '') + '">' + (i + 1) + '</span><span class="set-copy"><strong>Set ' + (i + 1) + '</strong><small>' + esc(ex.reps) + '</small></span>' +
          (same ? '<button class="set-go quiet" data-action="log-same" data-id="' + esc(ex.id) + '" data-index="' + i + '" data-slot="' + index + '">Same</button>' : '') +
          '<button class="set-go" data-action="open-log" data-id="' + esc(ex.id) + '" data-index="' + i + '" data-slot="' + index + '">Log</button></div>');
      }
    }
    return '<article class="card ex" id="ex-' + esc(ex.id) + '"><button class="ex-head" data-action="toggle-ex" data-id="' + esc(ex.id) + '"><span class="set-num' + (complete ? ' done' : '') + '">' + badge + '</span><span class="choice-copy"><strong class="clip">' + esc(ex.name) + '</strong>' + lastLine + '</span><span class="chevron">' + (open ? '˅' : '›') + '</span></button>' +
      (open ? '<div class="ex-body"><div class="ex-tools"><button data-action="open-howto" data-id="' + esc(ex.id) + '" data-slot="' + index + '">How to</button><button data-action="open-swap" data-id="' + esc(ex.id) + '" data-slot="' + index + '">Swap</button><button data-action="open-video" data-id="' + esc(ex.id) + '">Video</button></div>' +
        rows.join('') +
        '<div class="ex-tools" style="margin-top:8px"><button data-action="add-set" data-id="' + esc(ex.id) + '">Add a set</button>' +
        (total > 1 ? '<button data-action="remove-set" data-id="' + esc(ex.id) + '">Remove set</button>' : '') +
        '</div>' +
        (state.sessionExercises.length > 1 ? '<button class="btn btn-quiet danger-text" data-action="remove-ex" data-id="' + esc(ex.id) + '">Remove exercise</button>' : '') +
        '</div>' : '') +
      '</article>';
  }

  function previousNumbers(ex, setIndex) {
    const log = findLog(ex.id);
    if (log && setIndex > 0 && log.completedSets) {
      const prior = L.prefillFromSet(log.completedSets[setIndex - 1], ex.id);
      if (prior) return prior;
    }
    const last = L.lastPerformance(state.workouts, ex.id, state.dayType);
    if (last && (Number(last.weight) > 0 || Number(last.reps) > 0)) return last;
    return null;
  }

  function shownVolume(kg) {
    const n = L.toDisplayWeight(kg, state.unit);
    return L.formatVolume(n === '' ? 0 : n);
  }

  /* The open log sheet follows the exercise currently in that workout slot. */
  function logExercise() {
    if (!state.sheet) return null;
    if (state.sheet.slot != null && state.sessionExercises[state.sheet.slot]) {
      const live = state.sessionExercises[state.sheet.slot];
      if (state.sheet.followSlot || sameId(live.id, state.sheet.id)) return live;
    }
    return sessionExercise(state.sheet.id);
  }

  function renderHistory() {
    const sessions = state.workouts.length
      ? '<div class="group">' + state.workouts.map(function (workout, index) {
        const sets = workout.completedSets || (workout.exercises || []).reduce(function (n, ex) { return n + loggedSetCount(ex); }, 0);
        return '<button class="log-row" data-action="open-history" data-index="' + index + '"><span class="choice-copy"><strong>' + esc(workoutTitle(workout)) + '</strong><small>' + esc(formatWhen(workout.date)) + ' · ' + (workout.durationMin || 0) + ' min · ' + sets + ' sets</small></span><span class="chevron">›</span></button>';
      }).join('') + '</div>'
      : '<div class="empty"><div class="empty-icon">' + icon('history') + '</div><h3>No sessions yet</h3><p>A finished workout lands here, with its sets and notes.</p></div>';
    const summaries = L.exerciseSummaries(state.workouts, exerciseName);
    const progress = summaries.length
      ? '<div class="section-head"><h2>Progress</h2></div><div class="group">' + summaries.map(function (item) {
        const best = item.bestWeight > 0 ? esc(displayWeight(item.bestWeight)) + ' ' + esc(state.unit) + ' × ' + item.bestReps : item.bestReps + ' reps';
        return '<button class="log-row" data-action="open-progress" data-id="' + esc(item.id) + '"><span class="choice-copy"><strong class="clip">' + esc(item.name) + '</strong><small>Best ' + best + ' · ' + item.sessions + ' sessions</small></span><span class="chevron">›</span></button>';
      }).join('') + '</div>'
      : '';
    const clear = state.workouts.length ? '<button class="btn btn-quiet danger-text" data-action="clear-history">Clear history</button>' : '';
    return '<section class="page"><header class="page-head"><div><h1>History</h1><p class="lede">Sessions and the lifts that are moving.</p></div></header>' + sessions + progress + clear + '</section>';
  }

  function renderLibrary() {
    return '<section class="page"><header class="page-head"><div><h1>Library</h1><p class="lede" id="library-count">' + filteredLibrary().length + ' exercises</p></div></header>' +
      '<label class="search"><span class="sr-only">Search exercises</span><input id="library-search" type="search" placeholder="Search" value="' + esc(state.query) + '" autocomplete="off"></label>' +
      '<div class="chips">' + FILTERS.map(function (filter) {
        return '<button type="button" data-action="filter" data-filter="' + esc(filter.id) + '" aria-pressed="' + (state.filter === filter.id ? 'true' : 'false') + '">' + esc(filter.label) + '</button>';
      }).join('') + '</div><div id="library-list">' + libraryListHTML() + '</div></section>';
  }

  function libraryListHTML() {
    const list = filteredLibrary();
    if (!list.length) return '<div class="empty"><h3>No matches</h3><p>Try a muscle, a name, or another filter.</p></div>';
    const groups = [];
    list.forEach(function (ex) {
      const letter = ex.name.charAt(0).toUpperCase();
      if (!groups.length || groups[groups.length - 1].letter !== letter) groups.push({ letter: letter, items: [] });
      groups[groups.length - 1].items.push(ex);
    });
    return '<div class="lib-grid">' + groups.map(function (group) {
      return '<section><div class="section-label">' + esc(group.letter) + '</div><div class="group">' + group.items.map(function (ex) {
        const meta = [ex.category || '', (ex.muscles || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ');
        return '<button class="log-row" data-action="open-howto" data-id="' + esc(ex.id) + '"><span class="choice-copy"><strong class="clip">' + esc(ex.name) + '</strong><small>' + esc(meta) + '</small></span><span class="chevron">›</span></button>';
      }).join('') + '</div></section>';
    }).join('') + '</div>';
  }

  function renderYou() {
    const stored = localStorage.getItem('theme');
    const theme = stored === 'light' || stored === 'dark' ? stored : 'system';
    const one = calculatorValue();
    const notify = notificationsActive();
    return '<section class="page"><header class="page-head"><div><h1>You</h1><p class="lede">Units, appearance, and a copy of your data.</p></div></header>' +
      '<div class="group"><label class="field"><span class="label">Body weight</span><input id="body-weight" inputmode="decimal" value="' + esc(displayWeight(state.weight)) + '"><span class="suffix">' + esc(state.unit) + '</span></label>' +
      '<div class="field"><span class="label">Units</span><div class="segmented wide">' +
      seg('set-unit', 'kg', 'kg', state.unit === 'kg') + seg('set-unit', 'lbs', 'lbs', state.unit === 'lbs') + '</div></div>' +
      '<div class="field"><span class="label">Appearance</span><div class="segmented wide">' +
      seg('set-theme', 'system', 'Auto', theme === 'system') + seg('set-theme', 'light', 'Light', theme === 'light') + seg('set-theme', 'dark', 'Dark', theme === 'dark') +
      '</div></div>' +
      '<button class="log-row" data-action="toggle-notify"><span class="choice-copy"><strong>Rest notifications</strong><small>' + (notify ? 'On, including if you leave the app' : 'Off') + '</small></span><span class="chevron">' + (notify ? 'On' : 'Off') + '</span></button>' +
      (state.canInstall ? '<button class="add-row" data-action="install">Install app</button>' : '') +
      '</div>' +
      '<div class="section-head"><h2>1RM calculator</h2></div><div class="card" style="padding:16px">' +
      '<div class="field" style="border-radius:12px"><span class="label">Weight</span><input id="calc-weight" inputmode="decimal" value="' + esc(state.calcW) + '"></div>' +
      '<div class="field"><span class="label">Reps</span><input id="calc-reps" inputmode="numeric" value="' + esc(state.calcR) + '"></div>' +
      '<p class="hero-number" style="font-size:32px;margin-top:12px">' + (one ? one.toFixed(1) : '–') + '</p><p class="hero-unit">estimated 1RM · ' + esc(state.unit) + '</p>' +
      (one ? '<div class="pcts">' + [90, 80, 70, 60].map(function (pct) {
        return '<div><small>' + pct + '%</small><strong>' + (one * pct / 100).toFixed(1) + '</strong></div>';
      }).join('') + '</div>' : '') +
      '<p class="footnote tight">Epley estimate. A planning number, not a max you have to attempt.</p></div>' +
      '<div class="section-head"><h2>Data</h2></div><div class="group">' +
      '<button class="log-row" data-action="export">Export backup</button>' +
      '<button class="log-row" data-action="import">Import backup</button></div>' +
      '<p class="footnote">Backups are JSON files from StrongLean. Importing replaces workout history on this device.</p>' +
      '<div class="section-head"><h2>Training notes</h2></div><div class="card"><ul class="tips-list">' +
      '<li><strong>Add load when the top reps are easy.</strong><span>2.5 kg, or 5 lb, is enough. Otherwise add a rep.</span></li>' +
      '<li><strong>Rest 90–120 seconds</strong><span>on the big lifts. Shorter on accessories.</span></li>' +
      '<li><strong>Protein and sleep do the rebuilding.</strong><span>About 1.6–2.2 g per kg, and a real night of sleep.</span></li>' +
      '<li><strong>Warm up before the first work set.</strong><span>A few easy minutes, then the movement with less weight.</span></li>' +
      '</ul></div><p class="footnote">Training notes, not medical advice.</p></section>';
  }

  function seg(action, value, label, on) {
    return '<button type="button" data-action="' + action + '" data-value="' + value + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + label + '</button>';
  }

  function calculatorValue() {
    const w = parseFloat(state.calcW);
    const r = parseInt(state.calcR, 10);
    if (!(w > 0) || !(r > 0)) return null;
    return r === 1 ? w : w * (1 + r / 30);
  }

  function notificationsActive() {
    return state.notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  function renderOverlay() {
    const root = document.getElementById('overlay');
    let html = '';
    if (state.template) html += templateModal();
    if (state.sheet) html += sheetHTML();
    root.innerHTML = html;
  }

  function templateModal() {
    if (state.template.page === 'pick') return pickModal('Add exercise', 'template-pick');
    const rows = state.draft.exercises.length
      ? state.draft.exercises.map(function (ex, index) {
        return '<div class="draft-row"><div class="top"><span class="choice-copy"><strong class="clip">' + esc(ex.name) + '</strong><small>' + esc((ex.muscles || []).slice(0, 2).join(', ')) + '</small></span>' +
          '<button class="tiny" data-action="draft-move" data-index="' + index + '" data-dir="-1" aria-label="Move up">↑</button>' +
          '<button class="tiny" data-action="draft-move" data-index="' + index + '" data-dir="1" aria-label="Move down">↓</button>' +
          '<button class="tiny" data-action="draft-remove" data-index="' + index + '" aria-label="Remove">×</button></div>' +
          '<div class="draft-controls"><label>Sets <button class="tiny" data-action="draft-step" data-index="' + index + '" data-field="sets" data-dir="-1">−</button> ' + ex.sets + ' <button class="tiny" data-action="draft-step" data-index="' + index + '" data-field="sets" data-dir="1">+</button></label>' +
          '<label>Reps <input data-bind="draft-reps" data-index="' + index + '" value="' + esc(ex.reps) + '"></label>' +
          '<label>Rest <button class="tiny" data-action="draft-step" data-index="' + index + '" data-field="rest" data-dir="-15">−</button> ' + ex.rest + 's <button class="tiny" data-action="draft-step" data-index="' + index + '" data-field="rest" data-dir="15">+</button></label></div></div>';
      }).join('')
      : '<p class="empty">Add at least one exercise.</p>';
    return '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="template-title"><div class="modal-bar"><button class="text-btn" data-action="close-template">Cancel</button><h2 id="template-title">' + (state.draft.editing ? 'Edit routine' : 'New routine') + '</h2><button class="text-btn strong" data-action="save-template">Save</button></div>' +
      '<div class="modal-body"><div class="group"><label class="field"><span class="label">Name</span><input id="draft-name" value="' + esc(state.draft.name) + '"></label></div>' +
      '<div class="section-label">Exercises</div><div class="group">' + rows + '<button class="add-row" data-action="template-pick">Add an exercise</button></div>' +
      (state.draft.editing ? '<button class="btn btn-quiet danger-text" data-action="delete-template">Delete routine</button>' : '') +
      '</div></div>';
  }

  function pickModal(title, action) {
    const q = (state.template && state.template.query || '').toLowerCase();
    const list = Lib.library.filter(function (ex) {
      return !q || ex.name.toLowerCase().indexOf(q) !== -1 || (ex.muscles || []).join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 40);
    return '<div class="modal" role="dialog" aria-modal="true"><div class="modal-bar"><button class="text-btn" data-action="template-back">Back</button><h2>' + title + '</h2><span></span></div><div class="modal-body">' +
      '<label class="search"><span class="sr-only">Search</span><input id="pick-search" type="search" placeholder="Search" value="' + esc(state.template.query || '') + '"></label>' +
      '<div class="group" id="pick-list">' + (list.map(function (ex) {
        return '<button class="log-row" data-action="' + action + '" data-id="' + esc(ex.id) + '"><span class="choice-copy"><strong>' + esc(ex.name) + '</strong><small>' + esc((ex.muscles || []).slice(0, 3).join(', ')) + '</small></span></button>';
      }).join('') || '<p class="empty">No matches.</p>') + '</div></div></div>';
  }

  function sheetHTML() {
    const sheet = state.sheet;
    let body = '';
    let title = '';
    if (sheet.type === 'log') body = logSheet();
    else if (sheet.type === 'finish') { title = 'Complete'; body = finishSheet(); }
    else if (sheet.type === 'howto') { title = 'How to'; body = howtoSheet(); }
    else if (sheet.type === 'add' || sheet.type === 'swap') { title = sheet.type === 'swap' ? 'Swap' : 'Add'; body = pickSheet(); }
    else if (sheet.type === 'abs') { title = 'Core'; body = absSheet(); }
    else if (sheet.type === 'history') { title = 'Session'; body = historySheet(); }
    else if (sheet.type === 'progress') { title = 'Progress'; body = progressSheet(); }
    if (sheet.type === 'log') {
      return '<div class="overlay" data-action="close-sheet"><div class="sheet" role="dialog" aria-modal="true" data-action="stop">' + body + '</div></div>';
    }
    return '<div class="overlay" data-action="close-sheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" data-action="stop"><div class="grabber"></div>' +
      '<div class="sheet-head"><button class="text-btn" data-action="close-sheet">' + (sheet.back ? 'Back' : 'Close') + '</button><h2>' + esc(title) + '</h2><span class="sheet-trail"></span></div>' +
      '<div class="sheet-body">' + body + '</div></div></div>';
  }

  function logSheet() {
    const ex = logExercise();
    if (!ex) return '';
    if (!sameId(state.sheet.id, ex.id) || state.sheet.name !== ex.name) {
      applyLogExercise(ex, state.sheet.index, state.sheet.slot, false);
    }
    const suggestion = state.sheet.suggestion
      ? '<div class="banner banner-ok">' + esc(state.sheet.suggestion) + '</div>'
      : '';
    const editing = !!state.sheet.editing;
    return '<div class="grabber"></div><div class="sheet-head"><button class="text-btn" data-action="close-sheet">Cancel</button><h2 class="clip" id="log-title">' + esc(ex.name) + '</h2><span class="sheet-trail"></span></div>' +
      '<div class="sheet-body"><p class="eyebrow" style="text-align:center">Set ' + (state.sheet.index + 1) + ' · ' + esc(ex.reps) + (ex.muscles && ex.muscles.length ? ' · ' + esc(ex.muscles.slice(0, 2).join(', ')) : '') + '</p>' + suggestion +
      '<p class="section-label" style="text-align:center;margin-top:8px">Weight · ' + esc(state.unit) + '</p>' +
      '<div class="stepper"><button type="button" data-action="step-log" data-field="weight" data-dir="-1" aria-label="Decrease weight">−</button><input id="log-weight" inputmode="decimal" value="' + esc(state.sheet.weight) + '"><button type="button" data-action="step-log" data-field="weight" data-dir="1" aria-label="Increase weight">+</button></div>' +
      '<div class="segmented" style="margin:8px auto;max-width:200px">' + seg('sheet-unit', 'kg', 'kg', state.unit === 'kg') + seg('sheet-unit', 'lbs', 'lbs', state.unit === 'lbs') + '</div>' +
      '<p class="section-label" style="text-align:center">Reps</p>' +
      '<div class="stepper"><button type="button" data-action="step-log" data-field="reps" data-dir="-1" aria-label="Decrease reps">−</button><input id="log-reps" inputmode="numeric" value="' + esc(state.sheet.reps) + '"><button type="button" data-action="step-log" data-field="reps" data-dir="1" aria-label="Increase reps">+</button></div>' +
      '<button class="btn btn-primary" data-action="save-log" style="margin-top:12px">' + (editing ? 'Update set' : 'Save set') + '</button>' +
      '<p class="footnote" style="text-align:center">' + (editing ? 'Updating leaves the rest timer alone.' : 'Saving starts the rest timer.') + '</p></div>';
  }

  function finishSheet() {
    const volume = L.volumeOf(state.session);
    const minutes = Math.max(1, Math.round((Date.now() - state.startTime) / 60000));
    const prs = state.pendingPrs || [];
    return '<div class="card hero-card"><p class="eyebrow">Nice work</p><p class="hero-number">' + esc(shownVolume(volume)) + '</p><p class="hero-unit">' + esc(state.unit) + ' moved · ' + minutes + ' min</p></div>' +
      (prs.length ? '<div class="banner banner-ok"><strong>New bests</strong><br>' + prs.map(function (pr) {
        return esc(pr.name) + ' · ' + esc(displayWeight(pr.weight)) + ' ' + esc(state.unit);
      }).join('<br>') + '</div>' : '') +
      '<textarea id="finish-notes" class="note" placeholder="How did it feel?">' + esc(state.notes) + '</textarea>' +
      '<button class="btn btn-primary" style="margin-top:12px" data-action="save-finish">Save workout</button>';
  }

  function howtoSheet() {
    const ex = exerciseForHowTo(state.sheet.id);
    if (!ex) return '<p class="empty">That exercise is missing from the library.</p>';
    const series = L.progressSeries(state.workouts, ex.id);
    const best = series.length ? series.reduce(function (a, b) { return b.bestWeight > a.bestWeight ? b : a; }) : null;
    const charts = series.length >= 2
      ? '<div class="section-head"><h2>Volume</h2></div>' + trendSVG(series.map(function (point) { return point.volume; })) +
        '<div class="section-head"><h2>Est. 1RM</h2></div>' + trendSVG(series.map(function (point) { return point.est1rm; }))
      : '<p class="footnote tight">Log this exercise twice and a chart of volume and estimated 1RM shows up here.</p>';
    const alts = (ex.alternatives || []).map(function (name) {
      return '<button class="log-row" data-action="swap-name" data-name="' + esc(name) + '"><span class="choice-copy"><strong>' + esc(name) + '</strong><small>Alternative</small></span></button>';
    }).join('');
    return '<h1 style="font-size:28px">' + esc(ex.name) + '</h1><div class="muscle-pills" style="margin:12px 0">' + (ex.muscles || []).map(function (muscle) {
      return '<span class="pill">' + esc(muscle) + '</span>';
    }).join('') + (ex.category ? '<span class="pill">' + esc(ex.category) + '</span>' : '') + '</div>' +
      muscleSVG(ex.muscles) +
      '<div class="section-head"><h2>How to</h2></div><p>' + esc(ex.description || 'Move with control through a full range.') + '</p>' +
      (ex.cue ? '<div class="banner banner-ok"><strong>Cue. </strong>' + esc(ex.cue) + '</div>' : '') +
      (best ? '<p class="footnote tight">Best set ' + esc(displayWeight(best.bestWeight)) + ' ' + esc(state.unit) + ' × ' + best.bestReps + '</p>' : '') +
      charts +
      '<button class="btn btn-secondary" style="margin-top:12px" data-action="open-video" data-id="' + esc(ex.id) + '" data-name="' + esc(ex.name) + '">Watch a form video</button>' +
      (state.session && alts ? '<div class="section-label">Swap options</div><div class="group">' + alts + '</div>' : '') +
      '<button class="btn btn-quiet" data-action="open-progress" data-id="' + esc(ex.id) + '">Full progress</button>';
  }

  function exerciseForHowTo(id) {
    return sessionExercise(id) || Lib.byId[id] || Lib.all.find(function (ex) { return sameId(ex.id, id); });
  }

  function pickSheet() {
    const q = (state.sheet.query || '').toLowerCase();
    let html = '<label class="search"><span class="sr-only">Search</span><input id="sheet-search" type="search" placeholder="Search" value="' + esc(state.sheet.query || '') + '"></label>';
    if (state.sheet.type === 'swap') {
      const current = sessionExercise(state.sheet.id);
      const alts = (current && current.alternatives) || [];
      if (alts.length && !q) {
        html += '<div class="section-label">Suggested</div><div class="group">' + alts.map(function (name) {
          return '<button class="log-row" data-action="swap-name" data-name="' + esc(name) + '"><span class="choice-copy"><strong>' + esc(name) + '</strong></span></button>';
        }).join('') + '</div>';
      }
    }
    const list = Lib.library.filter(function (ex) {
      if (!q) return true;
      return ex.name.toLowerCase().indexOf(q) !== -1 || (ex.muscles || []).join(' ').toLowerCase().indexOf(q) !== -1;
    }).slice(0, 30);
    html += '<div class="section-label">Library</div><div class="group">' + list.map(function (ex) {
      const action = state.sheet.type === 'swap' ? 'do-swap' : 'do-add';
      return '<button class="log-row" data-action="' + action + '" data-id="' + esc(ex.id) + '"><span class="choice-copy"><strong>' + esc(ex.name) + '</strong><small>' + esc((ex.muscles || []).slice(0, 3).join(', ')) + '</small></span></button>';
    }).join('') + '</div>';
    return html;
  }

  function absSheet() {
    return '<div class="group">' + Lib.abs.map(function (ex) {
      const added = state.sessionExercises.some(function (item) { return sameId(item.id, ex.id); });
      return '<button class="log-row" data-action="do-add" data-id="' + esc(ex.id) + '"' + (added ? ' disabled' : '') + '><span class="choice-copy"><strong>' + esc(ex.name) + '</strong><small>' + (added ? 'Added' : esc(ex.sets + ' × ' + ex.reps)) + '</small></span></button>';
    }).join('') + '</div><button class="btn btn-primary" style="margin-top:12px" data-action="add-all-abs">Add all core exercises</button>';
  }

  function historySheet() {
    const workout = state.workouts[state.sheet.index];
    if (!workout) return '<p class="empty">That session is gone.</p>';
    const blocks = (workout.exercises || []).map(function (ex) {
      const sets = (ex.completedSets || []).filter(function (set) { return set && (set.reps || set.weight); });
      if (!sets.length) return '';
      return '<div class="section-label">' + esc(exerciseName(ex)) + '</div><div class="group">' + sets.map(function (set, index) {
        const text = Number(set.weight) > 0 ? esc(displayWeight(set.weight)) + ' ' + esc(state.unit) + ' × ' + esc(set.reps) : esc(set.reps) + ' reps';
        return '<div class="log-row static"><span class="choice-copy"><strong>Set ' + (index + 1) + '</strong></span><span>' + text + '</span></div>';
      }).join('') + '<button class="add-row" data-action="open-progress" data-id="' + esc(ex.id) + '">Progress</button></div>';
    }).join('');
    return '<p class="lede">' + esc(formatWhen(workout.date)) + ' · ' + (workout.durationMin || 0) + ' min · ' + esc(shownVolume(workout.totalVolume || L.volumeOf(workout))) + ' ' + esc(state.unit) + '</p>' +
      (workout.notes ? '<div class="banner banner-ok">' + esc(workout.notes) + '</div>' : '') +
      blocks +
      '<button class="btn btn-quiet danger-text" data-action="delete-workout" data-index="' + state.sheet.index + '">Delete session</button>';
  }

  function progressSheet() {
    const series = L.progressSeries(state.workouts, state.sheet.id);
    const name = (series[0] && series[0].name) || exerciseName({ id: state.sheet.id });
    if (!series.length) return '<h1 style="font-size:28px">' + esc(name) + '</h1><p class="lede">No sets logged for this exercise yet.</p>';
    const best = series.reduce(function (a, b) { return (b.bestWeight > a.bestWeight || (b.bestWeight === a.bestWeight && b.bestReps > a.bestReps)) ? b : a; });
    return '<h1 style="font-size:28px">' + esc(name) + '</h1><div class="card hero-card" style="margin-top:12px"><p class="eyebrow">Best set</p><p class="hero-number" style="font-size:32px">' + esc(displayWeight(best.bestWeight) || best.bestReps) + '</p><p class="hero-unit">' + (best.bestWeight > 0 ? esc(state.unit) + ' × ' + best.bestReps : 'reps') + '</p></div>' +
      (series.length >= 2
        ? '<div class="section-head"><h2>Volume</h2></div>' + trendSVG(series.map(function (point) { return point.volume; })) + '<p class="footnote tight">Sum of weight × reps each session.</p><div class="section-head"><h2>Est. 1RM</h2></div>' + trendSVG(series.map(function (point) { return point.est1rm; }))
        : '<p class="footnote">One more session and this becomes a chart.</p>') +
      '<div class="section-label">Sessions</div><div class="group">' + series.slice().reverse().map(function (point) {
        return '<div class="log-row"><span class="choice-copy"><strong>' + esc(formatWhen(point.date)) + '</strong><small>' + esc(shownVolume(point.volume)) + ' ' + esc(state.unit) + ' volume</small></span><span>' + esc(displayWeight(point.bestWeight)) + ' × ' + point.bestReps + '</span></div>';
      }).join('') + '</div>';
  }

  function renderDialog() {
    const root = document.getElementById('dialog');
    if (!state.dialog) {
      root.innerHTML = '';
      return;
    }
    root.innerHTML = '<div class="confirm-overlay"><div class="dialog" role="alertdialog" aria-modal="true"><h2>' + esc(state.dialog.title) + '</h2><p>' + esc(state.dialog.message) + '</p><div class="dialog-actions"><button type="button" data-action="confirm-no">Cancel</button><button type="button" class="' + (state.dialog.danger ? 'danger' : '') + '" data-action="confirm-yes">' + esc(state.dialog.confirm || 'Confirm') + '</button></div></div></div>';
  }

  function ask(options) {
    state.dialog = options;
    renderDialog();
  }

  function closeSheet() {
    if (state.sheet && state.sheet.back && state.sheet.back !== 'closed') {
      state.sheet = state.sheet.back;
    } else state.sheet = null;
    renderChrome();
  }

  function openLog(id, index, slot) {
    const resolvedSlot = slot == null ? state.sessionExercises.findIndex(function (ex) { return sameId(ex.id, id); }) : slot;
    const ex = resolvedSlot >= 0 ? state.sessionExercises[resolvedSlot] : sessionExercise(id);
    if (!ex) return;
    state.sheet = { type: 'log', id: ex.id, index: index, slot: resolvedSlot, followSlot: true, weight: '', reps: '', suggestion: '', editing: false, name: '' };
    applyLogExercise(ex, index, resolvedSlot, true);
    renderChrome();
    const input = document.getElementById('log-weight');
    if (input) input.focus();
  }

  function applyLogExercise(ex, index, slot, preferLogged) {
    const log = findLog(ex.id);
    const existing = log && log.completedSets ? log.completedSets[index] : null;
    let weight = '';
    let reps = '';
    let editing = false;
    if (preferLogged && L.isLoggedSet(existing)) {
      weight = displayWeight(existing.weight);
      reps = String(existing.reps || '');
      editing = true;
    } else if (!preferLogged && state.sheet && state.sheet.editing && sameId(state.sheet.id, ex.id)) {
      weight = state.sheet.weight;
      reps = state.sheet.reps;
      editing = true;
    } else {
      const prev = previousNumbers(ex, index);
      if (prev) {
        weight = displayWeight(prev.weight);
        reps = String(prev.reps || L.lowRep(ex.reps));
      } else {
        reps = String(L.lowRep(ex.reps));
      }
    }
    const last = L.lastPerformance(state.workouts, ex.id, state.dayType);
    const suggestion = L.suggestOverload(last, ex.reps, state.unit);
    state.sheet.type = 'log';
    state.sheet.id = ex.id;
    state.sheet.name = ex.name;
    state.sheet.index = index;
    state.sheet.slot = slot;
    state.sheet.followSlot = true;
    state.sheet.weight = weight;
    state.sheet.reps = reps;
    state.sheet.editing = editing;
    state.sheet.suggestion = suggestion ? suggestion.text : '';
  }

  function readLogFields() {
    const weight = document.getElementById('log-weight');
    const reps = document.getElementById('log-reps');
    if (weight && state.sheet) state.sheet.weight = weight.value;
    if (reps && state.sheet) state.sheet.reps = reps.value;
  }

  function commitSet(id, index, weightKg, reps) {
    const ex = (state.sheet && state.sheet.slot != null && state.sessionExercises[state.sheet.slot]) || sessionExercise(id);
    const exerciseId = ex ? ex.id : id;
    const log = ensureLog(exerciseId);
    while (log.completedSets.length <= index) log.completedSets.push(null);
    const editing = !L.shouldStartRest(log.completedSets[index]);
    log.completedSets[index] = {
      weight: weightKg,
      reps: reps,
      timestamp: Date.now(),
      exerciseId: exerciseId,
      name: ex ? ex.name : log.name
    };
    if (ex) log.name = ex.name;
    const finished = loggedSetCount(log) >= L.setCount(log, ex);
    if (!editing && finished) {
      state.openId = nextIncompleteId(exerciseId);
      state.scrollToId = state.openId;
    } else state.openId = exerciseId;
    saveActive();
    unlockAudio();
    state.sheet = null;
    if (editing) {
      render({ keepScroll: true });
      toast('Set updated');
      return;
    }
    startRest((ex && ex.rest) || 90, ex ? ex.name : 'Rest');
    render({ keepScroll: true });
  }

  function startWorkout(type) {
    const exercises = L.resolveSessionExercises({
      dayType: type,
      workout: {},
      programs: Lib.programs,
      templates: state.templates
    });
    if (!exercises.length) {
      toast('That routine has no exercises.');
      return;
    }
    state.dayType = type;
    state.sessionExercises = exercises;
    state.startTime = Date.now();
    state.openId = exercises[0].id;
    state.session = {
      date: new Date().toISOString(),
      type: type,
      typeName: routineTitle(type),
      exercises: exercises.map(function (ex) {
        return { id: ex.id, name: ex.name, completedSets: [] };
      }),
      startTime: state.startTime,
      durationMin: 0,
      totalVolume: 0,
      notes: '',
      extraExercises: []
    };
    state.section = 'train';
    saveActive();
    render();
    toast(routineTitle(type) + ' started');
  }

  function addExerciseToSession(ex) {
    if (state.sessionExercises.some(function (item) { return sameId(item.id, ex.id); })) {
      toast('Already in this workout.');
      return;
    }
    const copy = L.clone(ex);
    state.sessionExercises.push(copy);
    state.session.exercises.push({ id: copy.id, name: copy.name, completedSets: [], customSets: copy.sets });
    if (!state.session.extraExercises) state.session.extraExercises = [];
    state.session.extraExercises.push(copy);
    state.openId = copy.id;
    state.scrollToId = copy.id;
    state.sheet = null;
    saveActive();
    render({ keepScroll: true });
    toast('Added ' + copy.name);
  }

  function stampSets(log, exerciseId) {
    (log && log.completedSets || []).forEach(function (set) {
      if (set && set.exerciseId == null) set.exerciseId = exerciseId;
    });
  }

  function swapTo(ex) {
    const oldId = state.sheet && (state.sheet.swapId != null ? state.sheet.swapId : state.sheet.id);
    if (oldId == null) return;
    if (sameId(ex.id, oldId)) {
      closeSheet();
      return;
    }
    if (state.sessionExercises.some(function (item) { return sameId(item.id, ex.id); })) {
      toast('That exercise is already in this workout.');
      return;
    }
    const index = state.sessionExercises.findIndex(function (item) { return sameId(item.id, oldId); });
    if (index < 0) return;
    const previousName = state.sessionExercises[index].name;
    const log = findLog(oldId);
    stampSets(log, oldId);
    state.sessionExercises[index] = L.clone(ex);
    if (state.rest && state.rest.name === previousName) state.rest.name = ex.name;
    if (log) {
      log.id = ex.id;
      log.name = ex.name;
    }
    if (sameId(state.openId, oldId)) state.openId = ex.id;
    if (state.session.overrides) delete state.session.overrides[oldId];
    const reopen = state.sheet && state.sheet.type === 'log' && state.sheet.slot === index;
    const setIndex = reopen ? state.sheet.index : null;
    state.sheet = null;
    saveActive();
    render({ keepScroll: true });
    if (reopen) openLog(ex.id, setIndex, index);
    toast('Swapped to ' + ex.name);
  }

  function swapToName(name) {
    const known = Lib.library.find(function (ex) { return ex.name.toLowerCase() === name.toLowerCase(); });
    if (known) {
      swapTo(known);
      return;
    }
    const sourceId = state.sheet && (state.sheet.swapId != null ? state.sheet.swapId : state.sheet.id);
    if (sourceId == null) return;
    const ex = sessionExercise(sourceId);
    if (!ex) return;
    const previous = ex.name;
    const slot = state.sessionExercises.findIndex(function (item) { return sameId(item.id, ex.id); });
    ex.name = name;
    if (state.rest && state.rest.name === previous) state.rest.name = name;
    ex.description = 'Replacement for ' + previous + '. Keep the same sets and rest.';
    const log = findLog(ex.id);
    stampSets(log, ex.id);
    if (log) log.name = name;
    if (!state.session.overrides) state.session.overrides = {};
    state.session.overrides[ex.id] = { name: name, description: ex.description, cue: ex.cue };
    const reopen = state.sheet && state.sheet.type === 'log' && state.sheet.slot === slot;
    const setIndex = reopen ? state.sheet.index : null;
    state.sheet = null;
    saveActive();
    render({ keepScroll: true });
    if (reopen) openLog(ex.id, setIndex, slot);
    toast('Swapped to ' + name);
  }

  function discardSession() {
    stopRest();
    state.session = null;
    state.sessionExercises = [];
    state.dayType = null;
    state.startTime = null;
    state.openId = null;
    state.sheet = null;
    localStorage.removeItem('gymActiveState');
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
    state.section = 'train';
    render();
    toast('Workout discarded');
  }

  function openTemplate(existing) {
    const source = existing
      ? { id: existing.id, name: existing.name, exercises: existing.exercises.map(L.clone), editing: true }
      : { id: null, name: '', exercises: [], editing: false };
    state.draft = source;
    state.draftSnapshot = JSON.stringify(source);
    state.template = { page: 'edit', query: '' };
    renderOverlay();
  }

  function saveTemplate() {
    const nameInput = document.getElementById('draft-name');
    if (nameInput) state.draft.name = nameInput.value;
    const name = state.draft.name.trim() || 'Custom workout';
    if (!state.draft.exercises.length) {
      toast('Add an exercise first.');
      return;
    }
    if (state.draft.editing) {
      const template = state.templates.find(function (item) { return item.id === state.draft.id; });
      if (template) {
        template.name = name;
        template.exercises = state.draft.exercises;
      }
    } else {
      state.templates.unshift({ id: 'custom_' + Date.now(), name: name, exercises: state.draft.exercises });
    }
    saveTemplates();
    state.template = null;
    state.draft = null;
    render();
    toast('Routine saved');
  }

  function startRest(seconds, name) {
    const total = Math.max(10, seconds || 90);
    state.rest = {
      total: total,
      remaining: total,
      paused: false,
      name: name || 'Rest',
      endsAt: Date.now() + total * 1000
    };
    ensureRestTicker();
    saveActive();
    renderRest(true);
    document.body.classList.add('resting');
  }

  function ensureRestTicker() {
    if (restTimer) return;
    restTimer = setInterval(tickRest, 250);
  }

  function tickRest() {
    if (!state.rest || state.rest.paused) return;
    state.rest.remaining = Math.max(0, Math.ceil((state.rest.endsAt - Date.now()) / 1000));
    paintRest();
    if (state.rest.remaining <= 0) completeRest();
  }

  function renderRest(rebuild) {
    const bar = document.getElementById('restbar');
    if (!state.rest || state.rest.remaining <= 0) {
      bar.hidden = true;
      document.body.classList.remove('resting');
      return;
    }
    bar.hidden = false;
    document.body.classList.add('resting');
    if (rebuild || !document.getElementById('rest-count')) {
      bar.innerHTML = '<div class="rest-ring"><svg viewBox="0 0 44 44"><circle class="track" cx="22" cy="22" r="18"></circle><circle id="rest-ring" class="val" cx="22" cy="22" r="18" stroke-dasharray="' + CIRC + '"></circle></svg><div class="rest-count" id="rest-count"></div></div>' +
        '<div class="rest-copy"><strong id="rest-label"></strong><small>Rest</small></div>' +
        '<div class="rest-actions"><button type="button" data-action="adjust-rest" data-dir="-15">−15</button><button type="button" data-action="pause-rest" id="rest-pause">Pause</button><button type="button" data-action="adjust-rest" data-dir="15">+15</button><button type="button" class="go" data-action="skip-rest">Skip</button></div>';
    }
    paintRest();
  }

  function paintRest() {
    const count = document.getElementById('rest-count');
    const ring = document.getElementById('rest-ring');
    const label = document.getElementById('rest-label');
    const pause = document.getElementById('rest-pause');
    if (!count || !state.rest) return;
    count.textContent = state.rest.remaining;
    if (label) label.textContent = state.rest.name || 'Rest';
    if (pause) pause.textContent = state.rest.paused ? 'Resume' : 'Pause';
    if (ring) {
      const pct = state.rest.total ? state.rest.remaining / state.rest.total : 0;
      ring.setAttribute('stroke-dashoffset', String(CIRC * (1 - Math.max(0, Math.min(1, pct)))));
      ring.style.stroke = state.rest.remaining <= 10 ? 'var(--orange)' : 'var(--green)';
    }
  }

  function completeRest() {
    stopRest();
    playBeep();
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    if (notificationsActive()) {
      try {
        const note = new Notification('Rest complete', { body: 'Time for the next set.', icon: 'icon-192.png' });
        note.onclick = function () { window.focus(); };
      } catch (e) {}
    }
    toast('Rest complete');
    renderChrome();
  }

  function stopRest() {
    state.rest = null;
    if (restTimer) {
      clearInterval(restTimer);
      restTimer = null;
    }
    const bar = document.getElementById('restbar');
    if (bar) bar.hidden = true;
    document.body.classList.remove('resting');
    saveActive();
  }

  function ensureElapsed() {
    if (!state.session) {
      if (elapsedTimer) {
        clearInterval(elapsedTimer);
        elapsedTimer = null;
      }
      return;
    }
    if (elapsedTimer) return;
    elapsedTimer = setInterval(function () {
      const el = document.getElementById('elapsed');
      if (el && state.startTime) el.textContent = L.formatElapsed(Date.now() - state.startTime);
    }, 1000);
  }

  function refreshLibraryList() {
    const list = document.getElementById('library-list');
    const count = document.getElementById('library-count');
    if (list) list.innerHTML = libraryListHTML();
    if (count) count.textContent = filteredLibrary().length + ' exercises';
    document.querySelectorAll('[data-action="filter"]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.filter === state.filter ? 'true' : 'false');
    });
  }

  function refreshPickList() {
    if (!state.template || state.template.page !== 'pick') return;
    const list = document.getElementById('pick-list');
    if (!list) return;
    const q = (state.template.query || '').toLowerCase();
    const matches = Lib.library.filter(function (ex) {
      return !q || ex.name.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 40);
    list.innerHTML = matches.map(function (ex) {
      return '<button class="log-row" data-action="template-add" data-id="' + esc(ex.id) + '"><span class="choice-copy"><strong>' + esc(ex.name) + '</strong><small>' + esc((ex.muscles || []).slice(0, 3).join(', ')) + '</small></span></button>';
    }).join('') || '<p class="empty">No matches.</p>';
  }

  function exportBackup() {
    const backup = L.buildBackup({
      workouts: state.workouts,
      templates: state.templates,
      unit: state.unit,
      weight: state.weight
    });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stronglean_backup_' + Date.now() + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = L.parseBackup(String(reader.result));
        ask({
          title: 'Replace history?',
          message: 'This imports ' + parsed.workouts.length + ' workouts and replaces the history on this device.',
          confirm: 'Import',
          danger: true,
          onYes: function () {
            state.workouts = parsed.workouts;
            saveWorkouts();
            if (parsed.templates) {
              state.templates = parsed.templates;
              saveTemplates();
            }
            if (parsed.settings.unit === 'kg' || parsed.settings.unit === 'lbs') {
              state.unit = parsed.settings.unit;
              localStorage.setItem('stronglean_unit', state.unit);
            }
            if (parsed.settings.weight) {
              const weight = parseFloat(parsed.settings.weight);
              if (Number.isFinite(weight)) {
                state.weight = weight;
                localStorage.setItem('user_weight', String(weight));
              }
            }
            render();
            toast('Backup imported');
          }
        });
      } catch (error) {
        toast(error.message || 'Could not read that file.');
      }
    };
    reader.readAsText(file);
  }

  const actions = {
    stop: function () {},
    nav: function (el) {
      state.section = el.dataset.section;
      state.sheet = null;
      render();
      saveActive();
    },
    start: function (el) {
      if (state.session) {
        toast('Finish or discard the workout in progress.');
        state.section = 'train';
        render();
        return;
      }
      startWorkout(el.dataset.type);
    },
    'open-template': function () { openTemplate(null); },
    'edit-template': function (el) {
      const template = state.templates.find(function (item) { return item.id === el.dataset.id; });
      if (template) openTemplate(template);
    },
    'close-template': function () {
      const nameInput = document.getElementById('draft-name');
      if (nameInput && state.draft) state.draft.name = nameInput.value;
      const dirty = state.draft && JSON.stringify(state.draft) !== state.draftSnapshot;
      if (dirty) {
        ask({
          title: 'Discard edits?',
          message: 'This routine has unsaved changes.',
          confirm: 'Discard',
          danger: true,
          onYes: function () {
            state.template = null;
            state.draft = null;
            render();
          }
        });
        return;
      }
      state.template = null;
      state.draft = null;
      renderChrome();
    },
    'save-template': saveTemplate,
    'template-pick': function () {
      const nameInput = document.getElementById('draft-name');
      if (nameInput) state.draft.name = nameInput.value;
      state.template.page = 'pick';
      state.template.query = '';
      renderOverlay();
      const search = document.getElementById('pick-search');
      if (search) search.focus();
    },
    'template-back': function () {
      state.template.page = 'edit';
      renderOverlay();
    },
    'template-add': function (el) {
      const ex = Lib.byId[idFrom(el)];
      if (!ex) return;
      if (state.draft.exercises.some(function (item) { return sameId(item.id, ex.id); })) {
        toast('Already in this routine.');
        return;
      }
      state.draft.exercises.push(L.clone(ex));
      state.template.page = 'edit';
      renderOverlay();
    },
    'draft-remove': function (el) {
      state.draft.exercises.splice(Number(el.dataset.index), 1);
      renderOverlay();
    },
    'draft-move': function (el) {
      const index = Number(el.dataset.index);
      const dir = Number(el.dataset.dir);
      const next = index + dir;
      if (next < 0 || next >= state.draft.exercises.length) return;
      const item = state.draft.exercises.splice(index, 1)[0];
      state.draft.exercises.splice(next, 0, item);
      renderOverlay();
    },
    'draft-step': function (el) {
      const ex = state.draft.exercises[Number(el.dataset.index)];
      const dir = Number(el.dataset.dir);
      if (el.dataset.field === 'sets') ex.sets = Math.max(1, (ex.sets || 3) + dir);
      if (el.dataset.field === 'rest') ex.rest = Math.max(15, (ex.rest || 60) + dir);
      renderOverlay();
    },
    'delete-template': function () {
      ask({
        title: 'Delete routine?',
        message: 'Saved workouts stay. Only the routine is removed.',
        confirm: 'Delete',
        danger: true,
        onYes: function () {
          state.templates = state.templates.filter(function (item) { return item.id !== state.draft.id; });
          saveTemplates();
          state.template = null;
          state.draft = null;
          render();
        }
      });
    },
    'toggle-ex': function (el) {
      const id = idFrom(el);
      state.openId = sameId(state.openId, id) ? null : id;
      render({ keepScroll: true });
    },
    'open-log': function (el) { openLog(idFrom(el), Number(el.dataset.index), el.dataset.slot == null ? null : Number(el.dataset.slot)); },
    'save-log': function () {
      readLogFields();
      const reps = parseInt(state.sheet.reps, 10);
      if (!(reps > 0)) {
        toast('Enter the reps you completed.');
        return;
      }
      const weight = state.sheet.weight === '' ? 0 : L.toKg(state.sheet.weight, state.unit);
      commitSet(state.sheet.id, state.sheet.index, weight, reps);
    },
    'log-same': function (el) {
      const id = idFrom(el);
      const index = Number(el.dataset.index);
      const slot = el.dataset.slot == null ? null : Number(el.dataset.slot);
      const ex = slot != null && state.sessionExercises[slot] ? state.sessionExercises[slot] : sessionExercise(id);
      const prev = ex && previousNumbers(ex, index);
      if (!ex || !prev) {
        openLog(id, index, slot);
        return;
      }
      state.sheet = { type: 'log', id: ex.id, slot: slot, index: index };
      commitSet(ex.id, index, Number(prev.weight) || 0, Number(prev.reps) || 0);
    },
    'step-log': function (el) {
      readLogFields();
      const field = el.dataset.field === 'weight' ? 'weight' : 'reps';
      const input = document.getElementById(field === 'weight' ? 'log-weight' : 'log-reps');
      const dir = Number(el.dataset.dir);
      const step = field === 'weight' ? (state.unit === 'lbs' ? 5 : 2.5) : 1;
      const current = parseFloat(input.value) || 0;
      const next = Math.max(0, Math.round((current + dir * step) * 10) / 10);
      input.value = String(next);
      state.sheet[field] = input.value;
    },
    'sheet-unit': function (el) {
      readLogFields();
      const next = el.dataset.value;
      if (next === state.unit) return;
      const current = parseFloat(state.sheet.weight);
      if (Number.isFinite(current)) {
        const kg = L.toKg(current, state.unit);
        state.unit = next;
        state.sheet.weight = String(L.toDisplayWeight(kg, next));
      } else state.unit = next;
      localStorage.setItem('stronglean_unit', state.unit);
      renderChrome();
    },
    'add-set': function (el) {
      const id = idFrom(el);
      const ex = sessionExercise(id);
      const log = ensureLog(id);
      log.customSets = L.setCount(log, ex) + 1;
      saveActive();
      render({ keepScroll: true });
    },
    'remove-set': function (el) {
      const id = idFrom(el);
      const ex = sessionExercise(id);
      const log = ensureLog(id);
      const count = L.setCount(log, ex);
      if (count <= 1) return;
      log.customSets = count - 1;
      if (log.completedSets && log.completedSets.length > log.customSets) log.completedSets = log.completedSets.slice(0, log.customSets);
      saveActive();
      render({ keepScroll: true });
    },
    'remove-ex': function (el) {
      const id = idFrom(el);
      const log = findLog(id);
      const go = function () {
        state.sessionExercises = state.sessionExercises.filter(function (ex) { return !sameId(ex.id, id); });
        state.session.exercises = state.session.exercises.filter(function (ex) { return !sameId(ex.id, id); });
        if (state.session.extraExercises) {
          state.session.extraExercises = state.session.extraExercises.filter(function (ex) { return !sameId(ex.id, id); });
        }
        state.openId = state.sessionExercises[0] ? state.sessionExercises[0].id : null;
        saveActive();
        render({ keepScroll: true });
      };
      if (log && loggedSetCount(log)) {
        ask({ title: 'Remove exercise?', message: 'Sets logged for it in this workout will be dropped.', confirm: 'Remove', danger: true, onYes: go });
      } else go();
    },
    'open-add': function () { state.sheet = { type: 'add', query: '' }; renderChrome(); },
    'open-abs': function () { state.sheet = { type: 'abs' }; renderChrome(); },
    'open-swap': function (el) {
      const id = idFrom(el);
      const slot = el.dataset.slot == null ? state.sessionExercises.findIndex(function (ex) { return sameId(ex.id, id); }) : Number(el.dataset.slot);
      state.sheet = { type: 'swap', id: id, swapId: id, slot: slot, query: '' };
      renderChrome();
    },
    'do-add': function (el) {
      const ex = Lib.byId[idFrom(el)] || Lib.abs.find(function (item) { return sameId(item.id, idFrom(el)); });
      if (ex) addExerciseToSession(ex);
    },
    'add-all-abs': function () {
      let added = 0;
      Lib.abs.forEach(function (ex) {
        if (state.sessionExercises.some(function (item) { return sameId(item.id, ex.id); })) return;
        const copy = L.clone(ex);
        state.sessionExercises.push(copy);
        state.session.exercises.push({ id: copy.id, name: copy.name, completedSets: [], customSets: copy.sets });
        if (!state.session.extraExercises) state.session.extraExercises = [];
        state.session.extraExercises.push(copy);
        added += 1;
      });
      if (!added) {
        toast('Core work is already in this workout.');
        return;
      }
      state.openId = state.sessionExercises[state.sessionExercises.length - 1].id;
      state.sheet = null;
      saveActive();
      render({ keepScroll: true });
      toast('Added ' + added + ' core exercises');
    },
    'do-swap': function (el) {
      const ex = Lib.byId[idFrom(el)];
      if (ex) swapTo(ex);
    },
    'swap-name': function (el) {
      if (!state.session) {
        toast('Start a workout to swap.');
        return;
      }
      if (!state.sheet || state.sheet.type === 'howto') {
        const id = state.sheet && state.sheet.id != null ? state.sheet.id : state.openId;
        const slot = state.sessionExercises.findIndex(function (ex) { return sameId(ex.id, id); });
        state.sheet = { type: 'swap', id: id, swapId: id, slot: slot, query: '' };
      } else if (state.sheet.swapId == null) {
        state.sheet.swapId = state.sheet.id;
      }
      swapToName(el.dataset.name);
    },
    'open-howto': function (el) {
      const back = state.sheet && state.sheet.type === 'history' ? state.sheet : null;
      state.sheet = { type: 'howto', id: idFrom(el), back: back };
      renderChrome();
    },
    'open-video': function (el) {
      const ex = exerciseForHowTo(idFrom(el));
      const name = el.dataset.name || (ex && ex.name);
      if (!name) return;
      window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' proper form'), '_blank', 'noopener');
    },
    'open-history': function (el) {
      state.sheet = { type: 'history', index: Number(el.dataset.index) };
      renderChrome();
    },
    'open-progress': function (el) {
      const back = state.sheet ? state.sheet : null;
      state.sheet = { type: 'progress', id: idFrom(el), back: back };
      renderChrome();
    },
    'close-sheet': function () { closeSheet(); },
    finish: function () {
      const counts = progressCounts();
      const open = function () {
        state.pendingPrs = L.personalRecords(state.session, state.workouts, exerciseName);
        state.notes = '';
        state.sheet = { type: 'finish' };
        renderChrome();
      };
      if (counts.done === 0) {
        ask({ title: 'Finish with no sets?', message: 'You can keep going and log a set first.', confirm: 'Finish', onYes: open });
      } else open();
    },
    'save-finish': function () {
      const notes = document.getElementById('finish-notes');
      if (notes) state.notes = notes.value;
      const workout = state.session;
      const ms = Date.now() - state.startTime;
      workout.durationMin = Math.max(1, Math.round(ms / 60000));
      workout.durationSec = Math.round(ms / 1000);
      workout.totalVolume = L.volumeOf(workout);
      workout.completedSets = (workout.exercises || []).reduce(function (sum, ex) { return sum + loggedSetCount(ex); }, 0);
      workout.notes = state.notes.trim();
      workout.typeName = workout.typeName || routineTitle(state.dayType);
      state.workouts.unshift(workout);
      saveWorkouts();
      stopRest();
      state.session = null;
      state.sessionExercises = [];
      state.dayType = null;
      state.startTime = null;
      state.sheet = null;
      localStorage.removeItem('gymActiveState');
      if (elapsedTimer) {
        clearInterval(elapsedTimer);
        elapsedTimer = null;
      }
      state.section = 'history';
      render();
      toast('Workout saved');
    },
    discard: function () {
      ask({
        title: 'Discard workout?',
        message: 'Sets in this session will not be saved.',
        confirm: 'Discard',
        danger: true,
        onYes: discardSession
      });
    },
    'delete-workout': function (el) {
      const index = Number(el.dataset.index);
      ask({
        title: 'Delete session?',
        message: 'This removes it from history on this device.',
        confirm: 'Delete',
        danger: true,
        onYes: function () {
          state.workouts.splice(index, 1);
          saveWorkouts();
          state.sheet = null;
          render();
        }
      });
    },
    'clear-history': function () {
      ask({
        title: 'Clear all history?',
        message: 'Routines stay. Logged workouts are removed.',
        confirm: 'Clear',
        danger: true,
        onYes: function () {
          state.workouts = [];
          localStorage.removeItem('stronglean_workouts');
          state.sheet = null;
          render();
        }
      });
    },
    'confirm-yes': function () {
      const action = state.dialog && state.dialog.onYes;
      state.dialog = null;
      renderDialog();
      if (action) action();
    },
    'confirm-no': function () {
      state.dialog = null;
      renderDialog();
    },
    'set-unit': function (el) {
      const next = el.dataset.value;
      if (next !== 'kg' && next !== 'lbs') return;
      state.unit = next;
      localStorage.setItem('stronglean_unit', next);
      render({ keepScroll: true });
    },
    'set-theme': function (el) { applyTheme(el.dataset.value); },
    'toggle-notify': function () {
      if (typeof Notification === 'undefined') {
        toast('This browser does not show notifications.');
        return;
      }
      if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(function (permission) {
          state.notifications = permission === 'granted';
          localStorage.setItem('gymNotifications', state.notifications ? 'true' : 'false');
          render({ keepScroll: true });
        });
        return;
      }
      state.notifications = !state.notifications;
      localStorage.setItem('gymNotifications', state.notifications ? 'true' : 'false');
      render({ keepScroll: true });
    },
    export: exportBackup,
    import: function () {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = function () {
        if (input.files && input.files[0]) importBackup(input.files[0]);
      };
      input.click();
    },
    install: async function () {
      if (!deferredPrompt) {
        toast('Open the browser menu and choose Add to Home Screen.');
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      state.canInstall = false;
      render({ keepScroll: true });
    },
    filter: function (el) {
      state.filter = el.dataset.filter;
      refreshLibraryList();
    },
    'skip-rest': function () {
      stopRest();
      toast('Rest skipped');
      renderChrome();
    },
    'pause-rest': function () {
      if (!state.rest) return;
      if (state.rest.paused) {
        state.rest.paused = false;
        state.rest.endsAt = Date.now() + state.rest.remaining * 1000;
      } else {
        state.rest.remaining = Math.max(0, Math.ceil((state.rest.endsAt - Date.now()) / 1000));
        state.rest.paused = true;
      }
      paintRest();
      saveActive();
    },
    'adjust-rest': function (el) {
      if (!state.rest) return;
      if (!state.rest.paused) state.rest.remaining = Math.max(0, Math.ceil((state.rest.endsAt - Date.now()) / 1000));
      state.rest.remaining = Math.max(10, state.rest.remaining + Number(el.dataset.dir));
      state.rest.total = Math.max(state.rest.total, state.rest.remaining);
      if (!state.rest.paused) state.rest.endsAt = Date.now() + state.rest.remaining * 1000;
      paintRest();
      saveActive();
    }
  };

  document.addEventListener('click', function (event) {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = actions[el.dataset.action];
    if (!action) return;
    if (el.dataset.action === 'stop') return;
    unlockAudio();
    action(el, event);
  });

  document.addEventListener('input', function (event) {
    const target = event.target;
    if (target.id === 'library-search') {
      state.query = target.value;
      refreshLibraryList();
    } else if (target.id === 'pick-search' && state.template) {
      state.template.query = target.value;
      refreshPickList();
    } else if (target.id === 'sheet-search' && state.sheet) {
      state.sheet.query = target.value;
      const body = target.closest('.sheet-body');
      if (body) {
        const scroll = body.scrollTop;
        body.innerHTML = pickSheet();
        const again = document.getElementById('sheet-search');
        if (again) {
          again.focus();
          const len = again.value.length;
          again.setSelectionRange(len, len);
        }
        body.scrollTop = scroll;
      }
    } else if (target.id === 'draft-name' && state.draft) {
      state.draft.name = target.value;
    } else if (target.dataset.bind === 'draft-reps' && state.draft) {
      state.draft.exercises[Number(target.dataset.index)].reps = target.value;
    } else if (target.id === 'body-weight') {
      const kg = L.toKg(target.value, state.unit);
      if (target.value === '') return;
      if (Number.isFinite(kg) && kg > 0 && kg < 500) {
        state.weight = kg;
        localStorage.setItem('user_weight', String(Math.round(kg * 10) / 10));
      }
    } else if (target.id === 'calc-weight') {
      state.calcW = target.value;
      render({ keepScroll: true });
      const input = document.getElementById('calc-weight');
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    } else if (target.id === 'calc-reps') {
      state.calcR = target.value;
      render({ keepScroll: true });
      const input = document.getElementById('calc-reps');
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    } else if (target.id === 'finish-notes') {
      state.notes = target.value;
    } else if (target.id === 'log-weight' && state.sheet) {
      state.sheet.weight = target.value;
    } else if (target.id === 'log-reps' && state.sheet) {
      state.sheet.reps = target.value;
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (state.dialog) {
        state.dialog = null;
        renderDialog();
      } else if (state.sheet) closeSheet();
      else if (state.template && state.template.page === 'pick') {
        state.template.page = 'edit';
        renderOverlay();
      }
    }
    if (event.key === 'Enter' && state.sheet && state.sheet.type === 'log' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault();
      actions['save-log']();
    }
    if (event.key === '/' && state.section === 'library' && document.activeElement && document.activeElement.tagName === 'BODY') {
      event.preventDefault();
      const search = document.getElementById('library-search');
      if (search) search.focus();
    }
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    state.canInstall = true;
    if (state.section === 'today' || state.section === 'you') render({ keepScroll: true });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintThemeColor);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  }

  load();
  paintThemeColor();
  render();
})();
