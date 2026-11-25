/* Pure workout math and history helpers. Safe to run in the browser or in Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GymLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LB = 2.20462;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function epley(weight, reps) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    if (r === 1) return w;
    return w * (1 + r / 30);
  }

  function toDisplayWeight(kg, unit) {
    if (kg == null || kg === '') return '';
    const n = Number(kg);
    if (!Number.isFinite(n)) return '';
    if (unit === 'lbs') return Math.round(n * LB * 2) / 2;
    return Math.round(n * 10) / 10;
  }

  function toKg(display, unit) {
    const n = Number(display);
    if (!Number.isFinite(n)) return 0;
    if (unit === 'lbs') return Math.round((n / LB) * 10) / 10;
    return n;
  }

  function topRep(reps) {
    const parts = String(reps || '').split('-');
    const chunk = parts[1] || parts[0] || '';
    const n = parseInt(String(chunk).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 12;
  }

  function lowRep(reps) {
    const n = parseInt(String(reps || '').split('-')[0].replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 10;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function dayKey(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  }

  function weekCount(workouts, now) {
    const start = startOfWeek(now || new Date());
    return (workouts || []).filter(function (w) {
      return w && w.date && new Date(w.date) >= start;
    }).length;
  }

  function streak(workouts, now) {
    const days = new Set();
    (workouts || []).forEach(function (w) {
      if (w && w.date) days.add(dayKey(w.date));
    });
    const cursor = new Date(now || new Date());
    cursor.setHours(0, 0, 0, 0);
    const today = dayKey(cursor);
    const yesterdayDate = new Date(cursor);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = dayKey(yesterdayDate);
    if (!days.has(today) && !days.has(yesterday)) return 0;
    if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (days.has(dayKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  function avgDuration(workouts) {
    const vals = (workouts || [])
      .map(function (w) { return w && w.durationMin; })
      .filter(function (n) { return typeof n === 'number' && n > 0; });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
  }

  function setsOf(ex) {
    return (ex && ex.completedSets ? ex.completedSets : []).filter(function (set) {
      return set && (Number(set.reps) > 0 || Number(set.weight) > 0);
    });
  }

  function volumeOf(workout) {
    let total = 0;
    (workout && workout.exercises ? workout.exercises : []).forEach(function (ex) {
      setsOf(ex).forEach(function (set) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (weight > 0 && reps > 0) total += weight * reps;
      });
    });
    return Math.round(total);
  }

  function formatVolume(kg) {
    return Math.round(Number(kg) || 0).toLocaleString('en-US');
  }

  function formatElapsed(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  function bestSet(sets) {
    const list = (sets || []).filter(function (set) { return set && (Number(set.reps) > 0 || Number(set.weight) > 0); });
    if (!list.length) return null;
    return list.reduce(function (best, set) {
      const w = Number(set.weight) || 0;
      const r = Number(set.reps) || 0;
      const bw = Number(best.weight) || 0;
      const br = Number(best.reps) || 0;
      if (w > bw || (w === bw && r > br)) return set;
      return best;
    });
  }

  function lastPerformance(workouts, exerciseId, dayType) {
    let fallback = null;
    for (const workout of workouts || []) {
      const ex = (workout.exercises || []).find(function (item) { return item.id === exerciseId; });
      const best = bestSet(ex && ex.completedSets);
      if (!best) continue;
      if (dayType && workout.type === dayType) return best;
      if (!fallback) fallback = best;
    }
    return fallback;
  }

  function suggestOverload(last, repsTarget, unit) {
    if (!last || !(Number(last.weight) > 0)) return null;
    const display = toDisplayWeight(last.weight, unit);
    const top = topRep(repsTarget);
    if (Number(last.reps) >= top - 1) {
      const inc = unit === 'lbs' ? 5 : 2.5;
      const suggested = Math.round((Number(display) + inc) * 10) / 10;
      return {
        kind: 'weight',
        display: suggested,
        text: 'Last time ' + display + ' × ' + last.reps + '. You were at the top of the range. Try ' + suggested + ' ' + unit + '.'
      };
    }
    return {
      kind: 'reps',
      display: display,
      text: 'Last time ' + display + ' × ' + last.reps + '. Try more reps, or the same weight with cleaner form.'
    };
  }

  function personalRecords(workout, history, nameOf) {
    const records = [];
    (workout.exercises || []).forEach(function (ex) {
      let current = 0;
      setsOf(ex).forEach(function (set) {
        const weight = Number(set.weight) || 0;
        if (weight > current) current = weight;
      });
      if (current <= 0) return;
      let historical = 0;
      (history || []).forEach(function (past) {
        (past.exercises || []).forEach(function (prev) {
          if (prev.id !== ex.id) return;
          setsOf(prev).forEach(function (set) {
            const weight = Number(set.weight) || 0;
            if (weight > historical) historical = weight;
          });
        });
      });
      if (historical > 0 && current > historical) {
        records.push({
          id: ex.id,
          name: nameOf ? nameOf(ex) : (ex.name || 'Exercise'),
          weight: current,
          previous: historical
        });
      }
    });
    return records;
  }

  function progressSeries(workouts, exerciseId) {
    const chrono = (workouts || []).filter(function (w) { return w && w.date; }).slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
    const points = [];
    chrono.forEach(function (workout) {
      const ex = (workout.exercises || []).find(function (item) { return item.id === exerciseId; });
      const sets = setsOf(ex);
      if (!sets.length) return;
      let volume = 0;
      let bestRm = 0;
      let best = sets[0];
      sets.forEach(function (set) {
        const weight = Number(set.weight) || 0;
        const reps = Number(set.reps) || 0;
        if (weight > 0 && reps > 0) volume += weight * reps;
        const rm = epley(weight, reps);
        if (rm > bestRm) bestRm = rm;
        const bw = Number(best.weight) || 0;
        const br = Number(best.reps) || 0;
        if (weight > bw || (weight === bw && reps > br)) best = set;
      });
      points.push({
        date: workout.date,
        volume: Math.round(volume),
        bestWeight: Number(best.weight) || 0,
        bestReps: Number(best.reps) || 0,
        est1rm: Math.round(bestRm * 10) / 10,
        name: ex.name || ''
      });
    });
    return points;
  }

  function exerciseSummaries(workouts, nameOf) {
    const map = new Map();
    const chrono = (workouts || []).filter(function (w) { return w && w.date; }).slice().sort(function (a, b) {
      return new Date(a.date) - new Date(b.date);
    });
    chrono.forEach(function (workout) {
      (workout.exercises || []).forEach(function (ex) {
        const sets = setsOf(ex);
        if (!sets.length || ex.id == null) return;
        let rec = map.get(ex.id);
        if (!rec) {
          rec = {
            id: ex.id,
            name: nameOf ? nameOf(ex) : (ex.name || 'Exercise'),
            sessions: 0,
            bestWeight: 0,
            bestReps: 0,
            lastDate: workout.date
          };
        }
        rec.sessions += 1;
        rec.lastDate = workout.date;
        if (ex.name) rec.name = ex.name;
        else if (nameOf) rec.name = nameOf(ex);
        sets.forEach(function (set) {
          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;
          if (weight > rec.bestWeight || (weight === rec.bestWeight && reps > rec.bestReps)) {
            rec.bestWeight = weight;
            rec.bestReps = reps;
          }
        });
        map.set(ex.id, rec);
      });
    });
    return Array.from(map.values()).sort(function (a, b) {
      return new Date(b.lastDate) - new Date(a.lastDate);
    });
  }

  function recentVolume(workouts, limit) {
    return (workouts || [])
      .filter(function (w) { return w && w.date && (w.totalVolume || volumeOf(w)); })
      .slice()
      .sort(function (a, b) { return new Date(a.date) - new Date(b.date); })
      .slice(-(limit || 7))
      .map(function (w) { return { date: w.date, volume: w.totalVolume || volumeOf(w) }; });
  }

  function resolveSessionExercises(options) {
    const dayType = options.dayType;
    const workout = options.workout || {};
    const programs = options.programs || {};
    const templates = options.templates || [];
    if (Array.isArray(options.sessionExercises) && options.sessionExercises.length) {
      return options.sessionExercises.map(clone);
    }
    let base = [];
    if (programs[dayType] && programs[dayType].exercises) {
      base = programs[dayType].exercises.map(clone);
    } else if (String(dayType || '').indexOf('custom_') === 0) {
      const template = templates.find(function (item) { return item.id === dayType; });
      base = template && template.exercises ? template.exercises.map(clone) : [];
    }
    const seen = new Set(base.map(function (ex) { return ex.id; }));
    (workout.extraExercises || []).forEach(function (ex) {
      if (!ex || seen.has(ex.id)) return;
      base.push(clone(ex));
      seen.add(ex.id);
    });
    if (workout.overrides) {
      base = base.map(function (ex) {
        const override = workout.overrides[ex.id];
        if (!override) return ex;
        return Object.assign({}, ex, {
          name: override.name || ex.name,
          description: override.description || ex.description,
          cue: override.cue || ex.cue
        });
      });
    }
    return base;
  }

  function chartGeometry(values, width, height, pad) {
    if (!values || values.length < 2) return null;
    const nums = values.map(function (v) { return Number(v) || 0; });
    const max = Math.max.apply(null, nums);
    const min = Math.min.apply(null, nums);
    const lo = min === max ? min * 0.8 : min;
    const range = Math.max(max - lo, 1e-6);
    const dx = (width - pad * 2) / (nums.length - 1);
    return nums.map(function (v, i) {
      return {
        x: Math.round((pad + i * dx) * 10) / 10,
        y: Math.round((height - pad - ((v - lo) / range) * (height - pad * 2)) * 10) / 10,
        v: v
      };
    });
  }

  function parseBackup(text) {
    const data = JSON.parse(text);
    if (!data || data.app !== 'StrongLean' || !Array.isArray(data.workouts)) {
      const error = new Error('This file is not a StrongLean backup.');
      error.code = 'invalid-backup';
      throw error;
    }
    return {
      workouts: data.workouts,
      settings: data.settings || {},
      templates: Array.isArray(data.templates) ? data.templates : null
    };
  }

  function buildBackup(payload) {
    return {
      app: 'StrongLean',
      version: '2.0',
      date: new Date().toISOString(),
      workouts: payload.workouts || [],
      templates: payload.templates || [],
      settings: {
        unit: payload.unit || 'kg',
        weight: payload.weight != null ? String(payload.weight) : '65',
        plan: payload.plan || null
      }
    };
  }

  const PLAN_GOALS = ['strength', 'muscle', 'mobility', 'mixed'];
  const PLAN_GROUPS = ['push', 'pull', 'legs', 'core'];
  const EMPHASIS_CYCLE = [
    ['push', 'pull'],
    ['legs', 'core'],
    ['pull', 'legs'],
    ['push', 'core']
  ];
  const GROUP_KEYS = {
    push: ['chest', 'pec', 'delt', 'shoulder', 'tricep'],
    pull: ['back', 'lat', 'bicep', 'trap', 'rear'],
    legs: ['quad', 'hamstring', 'glute', 'calv', 'adduct'],
    core: ['abs', 'core', 'oblique']
  };
  const GROUP_LABEL = {
    push: 'Chest and shoulders',
    pull: 'Back and arms',
    legs: 'Legs',
    core: 'Core'
  };
  const WEEK_COPY = {
    1: { name: 'Base', text: 'Manageable sets on this block’s muscles. Own the reps before you add weight.' },
    2: { name: 'Build', text: 'One more set than the base week. Add a rep when the weight still moves cleanly.' },
    3: { name: 'Push', text: 'Top of the range. This is the week a small weight jump belongs.' },
    4: { name: 'Ease', text: 'Fewer sets. Keep the groove, then the next block can move to different muscles.' }
  };

  function isoDay(date) {
    const d = new Date(date || Date.now());
    const m = String(d.getMonth() + 1);
    const day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  function parseDay(iso) {
    const parts = String(iso || '').split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d);
  }

  function daysBetween(startIso, date) {
    const ms = parseDay(isoDay(date)) - parseDay(startIso);
    return Math.round(ms / 86400000);
  }

  function normalizePlan(plan, now) {
    const source = plan || {};
    const goal = PLAN_GOALS.indexOf(source.goal) >= 0 ? source.goal : 'mixed';
    const days = source.days === 3 ? 3 : 4;
    let emphasis = ['push', 'pull'];
    if (Array.isArray(source.emphasis) && source.emphasis.length === 2 &&
      PLAN_GROUPS.indexOf(source.emphasis[0]) >= 0 && PLAN_GROUPS.indexOf(source.emphasis[1]) >= 0 &&
      source.emphasis[0] !== source.emphasis[1]) {
      emphasis = source.emphasis.slice();
    }
    const blockStart = /^\d{4}-\d{2}-\d{2}$/.test(source.blockStart) ? source.blockStart : isoDay(now || new Date());
    return {
      goal: goal,
      days: days,
      emphasis: emphasis,
      blockStart: blockStart,
      blockIndex: Number.isFinite(Number(source.blockIndex)) ? Number(source.blockIndex) : 0,
      variation: Number.isFinite(Number(source.variation)) ? Number(source.variation) : 0,
      lastNote: source.lastNote || '',
      lastNoteBlock: source.lastNoteBlock == null ? -1 : source.lastNoteBlock
    };
  }

  function blockWeek(plan, now) {
    const ready = normalizePlan(plan, now);
    const days = daysBetween(ready.blockStart, now || new Date());
    if (days < 0) return 1;
    return Math.floor(days / 7) + 1;
  }

  function goalLabel(goal) {
    if (goal === 'strength') return 'Strength';
    if (goal === 'muscle') return 'Muscle';
    if (goal === 'mobility') return 'Mobility';
    return 'Mixed';
  }

  function isCardio(ex) {
    return /min/i.test(String(ex && ex.reps)) && /walk|bike|elliptical|row|jack|march/i.test(ex.name || '');
  }

  function isMobility(ex) {
    return /stretch|pose|mobility|cat-cow|child|couch|chin tuck|open book|90\/90|pigeon|figure-4|ankle mobility|world's greatest/i.test(ex && ex.name || '');
  }

  function inGroup(ex, group) {
    const keys = GROUP_KEYS[group] || [];
    const muscles = (ex && ex.muscles ? ex.muscles : []).join(' ').toLowerCase();
    return keys.some(function (key) { return muscles.indexOf(key) !== -1; });
  }

  function exerciseMuscles(ex, libraryById) {
    if (ex && ex.muscles && ex.muscles.length) return ex.muscles;
    const known = libraryById && ex ? libraryById[ex.id] : null;
    return known && known.muscles ? known.muscles : [];
  }

  function groupOfMuscles(muscles) {
    const fake = { muscles: muscles || [] };
    return PLAN_GROUPS.filter(function (group) { return inGroup(fake, group); });
  }

  function windowStats(workouts, library, fromIso, untilIso) {
    const byId = {};
    (library || []).forEach(function (ex) { if (ex) byId[ex.id] = ex; });
    const stats = {};
    PLAN_GROUPS.forEach(function (group) { stats[group] = { volume: 0, best: 0, sessions: 0 }; });
    const from = parseDay(fromIso).getTime();
    const until = untilIso ? parseDay(untilIso).getTime() : Infinity;
    (workouts || []).forEach(function (workout) {
      if (!workout || !workout.date) return;
      const when = new Date(workout.date).getTime();
      if (when < from || when >= until) return;
      const seen = {};
      (workout.exercises || []).forEach(function (ex) {
        const groups = groupOfMuscles(exerciseMuscles(ex, byId));
        if (!groups.length) return;
        setsOf(ex).forEach(function (set) {
          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;
          const volume = weight > 0 && reps > 0 ? weight * reps : 0;
          const best = epley(weight, reps);
          groups.forEach(function (group) {
            stats[group].volume += volume;
            if (best > stats[group].best) stats[group].best = best;
            if (!seen[group]) {
              stats[group].sessions += 1;
              seen[group] = true;
            }
          });
        });
      });
    });
    return stats;
  }

  function emphasisKey(pair) {
    return (pair || []).join('-');
  }

  function nextEmphasis(current) {
    const key = emphasisKey(current);
    const index = EMPHASIS_CYCLE.findIndex(function (pair) { return emphasisKey(pair) === key; });
    return EMPHASIS_CYCLE[(index < 0 ? 0 : index + 1) % EMPHASIS_CYCLE.length].slice();
  }

  function shiftIso(iso, days) {
    const d = parseDay(iso);
    d.setDate(d.getDate() + days);
    return isoDay(d);
  }

  function advancedBecause(stats, emphasis) {
    const current = emphasis.reduce(function (sum, group) {
      const row = stats.current[group] || { volume: 0, best: 0, sessions: 0 };
      return {
        volume: sum.volume + row.volume,
        best: Math.max(sum.best, row.best),
        sessions: sum.sessions + row.sessions
      };
    }, { volume: 0, best: 0, sessions: 0 });
    const previous = emphasis.reduce(function (sum, group) {
      const row = stats.previous[group] || { volume: 0, best: 0, sessions: 0 };
      return {
        volume: sum.volume + row.volume,
        best: Math.max(sum.best, row.best),
        sessions: sum.sessions + row.sessions
      };
    }, { volume: 0, best: 0, sessions: 0 });
    if (current.sessions === 0 && current.volume === 0) return false;
    if (previous.volume === 0 && previous.best === 0) return current.volume > 0 || current.sessions > 0;
    if (previous.volume > 0 && current.volume >= previous.volume * 1.05) return true;
    if (previous.best > 0 && current.best >= previous.best * 1.02) return true;
    if (current.sessions >= 6 && current.volume >= previous.volume) return true;
    return false;
  }

  function advancePlan(plan, workouts, now, library) {
    const ready = normalizePlan(plan, now);
    const today = isoDay(now || new Date());
    if (blockWeek(ready, now || new Date()) < 5) {
      return { plan: ready, changed: !plan, message: '' };
    }
    const previousStart = shiftIso(ready.blockStart, -28);
    const stats = {
      current: windowStats(workouts, library, ready.blockStart, today),
      previous: windowStats(workouts, library, previousStart, ready.blockStart)
    };
    const progressed = advancedBecause(stats, ready.emphasis);
    const next = normalizePlan(ready, now);
    next.blockStart = today;
    next.blockIndex = ready.blockIndex + 1;
    if (progressed) {
      next.emphasis = nextEmphasis(ready.emphasis);
      next.variation = ready.variation + 1;
      next.lastNote = 'The last four weeks moved. This block switches to ' +
        GROUP_LABEL[next.emphasis[0]].toLowerCase() + ' and ' +
        GROUP_LABEL[next.emphasis[1]].toLowerCase() + ', with different exercises.';
    } else if ((stats.current[ready.emphasis[0]] || {}).sessions || (stats.current[ready.emphasis[1]] || {}).sessions) {
      next.variation = ready.variation + 1;
      next.lastNote = 'Those lifts stayed about the same, so the muscles stay. The exercise list changes so the sessions are not copies.';
    } else {
      next.lastNote = 'No sessions landed in that block, so the focus stays and the four weeks start again today.';
    }
    next.lastNoteBlock = next.blockIndex;
    return { plan: next, changed: true, message: next.lastNote };
  }

  function nextSlot(workouts, plan, now) {
    const ready = normalizePlan(plan, now);
    const weekStart = startOfWeek(now || new Date());
    const today = isoDay(now || new Date());
    const done = (workouts || []).filter(function (workout) {
      return workout && workout.plan && workout.date && new Date(workout.date) >= weekStart &&
        workout.plan.blockIndex === ready.blockIndex;
    });
    const doneToday = done.some(function (workout) { return isoDay(workout.date) === today; });
    const used = {};
    done.forEach(function (workout) {
      if (workout.plan.slot != null) used[workout.plan.slot] = true;
    });
    for (let i = 0; i < ready.days; i += 1) {
      if (!used[i]) return { slot: i, doneToday: doneToday };
    }
    return { slot: done.length % ready.days, doneToday: doneToday };
  }

  function weekIds(workouts, plan, now) {
    const ready = normalizePlan(plan, now);
    const weekStart = startOfWeek(now || new Date());
    const ids = [];
    (workouts || []).forEach(function (workout) {
      if (!workout || !workout.plan || !workout.date || new Date(workout.date) < weekStart) return;
      if (workout.plan.blockIndex !== ready.blockIndex) return;
      (workout.exercises || []).forEach(function (ex) {
        if (ex && ex.id != null) ids.push(ex.id);
      });
    });
    return ids;
  }

  function otherGroups(emphasis) {
    return PLAN_GROUPS.filter(function (group) { return emphasis.indexOf(group) === -1; });
  }

  function sessionParts(plan, slot) {
    const emphasis = plan.emphasis;
    const others = otherGroups(emphasis);
    const days = plan.days;
    const index = ((slot % days) + days) % days;
    const mainCount = plan.goal === 'strength' ? 4 : 5;
    if (plan.goal === 'mobility') {
      const group = [emphasis[0], emphasis[1], others[0], others[1]][index % 4];
      return { titleGroup: 'mobility', parts: [
        { group: group, count: 3, kind: 'light' },
        { group: 'core', count: 3, kind: 'mobility' }
      ] };
    }
    if (days === 3) {
      if (index === 0) return { titleGroup: emphasis[0], parts: [
        { group: emphasis[0], count: mainCount, kind: 'main' },
        { group: 'core', count: 1, kind: 'mobility' }
      ] };
      if (index === 1) return { titleGroup: emphasis[1], parts: [
        { group: emphasis[1], count: mainCount, kind: 'main' }
      ] };
      return { titleGroup: 'balance', groups: [others[0], others[1]], parts: [
        { group: others[0], count: 2, kind: 'main' },
        { group: others[1], count: 2, kind: 'accessory' },
        { group: 'core', count: 2, kind: 'mobility' }
      ] };
    }
    if (index === 0) return { titleGroup: emphasis[0], parts: [{ group: emphasis[0], count: mainCount, kind: 'main' }] };
    if (index === 1) return { titleGroup: emphasis[1], parts: [{ group: emphasis[1], count: mainCount, kind: 'main' }] };
    if (index === 2) return { titleGroup: 'balance', groups: [others[0], others[1]], parts: [
      { group: others[0], count: 3, kind: 'main' },
      { group: others[1], count: 2, kind: 'accessory' }
    ] };
    return { titleGroup: 'mobility', parts: [
      { group: emphasis[0], count: 2, kind: 'accessory' },
      { group: 'core', count: 3, kind: 'mobility' }
    ] };
  }

  function poolFor(library, group, kind) {
    return (library || []).filter(function (ex) {
      if (!ex || ex.id == null || isCardio(ex)) return false;
      if (kind === 'mobility') return isMobility(ex);
      if (isMobility(ex)) return false;
      return inGroup(ex, group);
    });
  }

  function scoreExercise(ex, group, kind) {
    const first = String((ex.muscles && ex.muscles[0]) || '').toLowerCase();
    const keys = GROUP_KEYS[group] || [];
    let score = keys.some(function (key) { return first.indexOf(key) !== -1; }) ? 4 : 0;
    const name = String(ex.name || '').toLowerCase();
    if (/behind-the-neck|careful/.test(name)) score -= 5;
    if (/press|squat|deadlift|row|pull-up|pulldown|lunge|thrust|dip/.test(name)) score += kind === 'main' ? 3 : 1;
    if (Number(ex.id) > 0 && Number(ex.id) < 700) score += 2;
    if (ex.category === 'Gym' && kind === 'main') score += 1;
    return score;
  }

  function takeFrom(list, count, seed, out, seen) {
    if (!list.length || out.length >= count) return;
    const start = Math.abs(seed) % list.length;
    for (let i = 0; i < list.length && out.length < count; i += 1) {
      const ex = list[(start + i) % list.length];
      if (seen[String(ex.id)]) continue;
      seen[String(ex.id)] = true;
      out.push(ex);
    }
  }

  function pickExercises(pool, count, seed, avoid, group, kind) {
    const avoidSet = {};
    (avoid || []).forEach(function (id) { avoidSet[String(id)] = true; });
    const ranked = pool.slice().sort(function (a, b) {
      const score = scoreExercise(b, group, kind) - scoreExercise(a, group, kind);
      if (score) return score;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
    const top = ranked.length ? scoreExercise(ranked[0], group, kind) : 0;
    const band = ranked.filter(function (ex) { return scoreExercise(ex, group, kind) >= Math.max(0, top - 1); });
    const preferred = band.length >= count ? band : ranked;
    const fresh = preferred.filter(function (ex) { return !avoidSet[String(ex.id)]; });
    const freshAll = ranked.filter(function (ex) { return !avoidSet[String(ex.id)]; });
    const spare = ranked.filter(function (ex) { return avoidSet[String(ex.id)]; });
    const out = [];
    const seen = {};
    takeFrom(fresh, count, seed, out, seen);
    takeFrom(freshAll, count, seed + 1, out, seen);
    takeFrom(spare, count, seed, out, seen);
    out.sort(function (a, b) { return scoreExercise(b, group, kind) - scoreExercise(a, group, kind); });
    return out;
  }

  function schemeFor(ex, goal, week, kind) {
    const copy = clone(ex);
    const phase = WEEK_COPY[week] ? week : 1;
    if (kind === 'mobility') {
      copy.sets = 2;
      copy.rest = 30;
      if (!/sec|min/i.test(String(copy.reps))) copy.reps = '30-45 sec';
      return copy;
    }
    let sets = 3;
    let reps = '8-12';
    let rest = 75;
    if (goal === 'strength' || (goal === 'mixed' && kind === 'main')) {
      sets = goal === 'strength' ? 4 : 3;
      reps = phase === 3 ? '3-5' : (goal === 'strength' ? '4-6' : '5-8');
      rest = goal === 'strength' ? 150 : 120;
    } else if (goal === 'mobility' || kind === 'light') {
      sets = 3;
      reps = '8-10';
      rest = 60;
    }
    if (phase === 2) sets += 1;
    if (phase === 4) sets = Math.max(2, sets - 1);
    copy.sets = sets;
    copy.reps = reps;
    copy.rest = rest;
    return copy;
  }

  function buildSession(options) {
    const plan = normalizePlan(options.plan, options.now);
    const week = Math.min(4, Math.max(1, options.week || blockWeek(plan, options.now)));
    const slot = Number.isFinite(Number(options.slot)) ? Number(options.slot) : 0;
    const layout = sessionParts(plan, slot);
    const avoid = (options.avoidIds || []).slice();
    const chosen = [];
    layout.parts.forEach(function (part, partIndex) {
      const pool = poolFor(options.library, part.group, part.kind);
      const seed = plan.variation * 100 + week * 17 + slot * 5 + partIndex * 3 + plan.blockIndex;
      pickExercises(pool, part.count, seed, avoid.concat(chosen.map(function (ex) { return ex.id; })), part.group, part.kind).forEach(function (ex) {
        chosen.push(schemeFor(ex, plan.goal, week, part.kind));
      });
    });
    const phase = WEEK_COPY[week];
    const title = layout.titleGroup === 'mobility'
      ? (plan.goal === 'mobility' ? 'Mobility' : goalLabel(plan.goal) + ' · Mobility')
      : layout.titleGroup === 'balance'
        ? goalLabel(plan.goal) + ' · ' + layout.groups.map(function (group) { return GROUP_LABEL[group]; }).join(' and ')
        : goalLabel(plan.goal) + ' · ' + GROUP_LABEL[layout.titleGroup];
    return {
      title: title,
      summary: phase.text,
      week: week,
      weekName: phase.name,
      slot: ((slot % plan.days) + plan.days) % plan.days,
      emphasis: plan.emphasis.slice(),
      exercises: chosen
    };
  }

  function setCount(log, exercise) {
    if (log && log.customSets) return log.customSets;
    return (exercise && exercise.sets) || 3;
  }

  function isLoggedSet(set) {
    return !!(set && (Number(set.reps) > 0 || Number(set.weight) > 0));
  }

  /* Editing weight or reps is not a new set, so the rest clock stays where it is. */
  function shouldStartRest(previousSet) {
    return !isLoggedSet(previousSet);
  }

  /* A set logged before a swap belongs to the old exercise and must not prefill the new one. */
  function prefillFromSet(set, exerciseId) {
    if (!isLoggedSet(set)) return null;
    if (set.exerciseId != null && String(set.exerciseId) !== String(exerciseId)) return null;
    return set;
  }

  return {
    clone: clone,
    epley: epley,
    toDisplayWeight: toDisplayWeight,
    toKg: toKg,
    topRep: topRep,
    lowRep: lowRep,
    startOfWeek: startOfWeek,
    weekCount: weekCount,
    streak: streak,
    avgDuration: avgDuration,
    volumeOf: volumeOf,
    formatVolume: formatVolume,
    formatElapsed: formatElapsed,
    bestSet: bestSet,
    lastPerformance: lastPerformance,
    suggestOverload: suggestOverload,
    personalRecords: personalRecords,
    progressSeries: progressSeries,
    exerciseSummaries: exerciseSummaries,
    recentVolume: recentVolume,
    resolveSessionExercises: resolveSessionExercises,
    chartGeometry: chartGeometry,
    parseBackup: parseBackup,
    buildBackup: buildBackup,
    setCount: setCount,
    isLoggedSet: isLoggedSet,
    shouldStartRest: shouldStartRest,
    prefillFromSet: prefillFromSet,
    isoDay: isoDay,
    normalizePlan: normalizePlan,
    blockWeek: blockWeek,
    advancePlan: advancePlan,
    nextSlot: nextSlot,
    weekIds: weekIds,
    buildSession: buildSession,
    goalLabel: goalLabel,
    GROUP_LABEL: GROUP_LABEL,
    WEEK_COPY: WEEK_COPY
  };
});
