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
    const low = lowRep(repsTarget);
    const reps = Number(last.reps) || low;
    if (reps >= top - 1) {
      const inc = unit === 'lbs' ? 5 : 2.5;
      const suggested = Math.round((Number(display) + inc) * 10) / 10;
      return {
        kind: 'weight',
        display: suggested,
        reps: low,
        weightKg: toKg(suggested, unit),
        label: suggested + ' × ' + low,
        text: 'Add ' + inc + ' ' + unit + '. Last time was ' + display + ' × ' + reps + ', so the next set starts back at ' + low + ' reps.'
      };
    }
    const nextReps = Math.min(top, reps + 1);
    return {
      kind: 'reps',
      display: display,
      reps: nextReps,
      weightKg: Number(last.weight),
      label: display + ' × ' + nextReps,
      text: 'Add a rep at the same weight. Last time was ' + display + ' × ' + reps + '.'
    };
  }

  function formatRest(seconds) {
    const total = Math.max(0, Math.ceil(Number(seconds) || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  const MILESTONES = [
    { id: 'first', title: 'First session', line: 'You showed up. That is the habit.', need: 'Finish 1 workout' },
    { id: 'five', title: '5 sessions', line: 'Keep it up. Five times you chose this.', need: 'Finish 5 workouts' },
    { id: 'ten', title: '10 sessions', line: 'Double digits. This is part of the week now.', need: 'Finish 10 workouts' },
    { id: 'twentyfive', title: '25 sessions', line: 'A real body of work. Be proud of the count.', need: 'Finish 25 workouts' },
    { id: 'streak3', title: '3-day streak', line: 'Three days in a row. Keep it up.', need: 'Train 3 days running' },
    { id: 'streak7', title: '7-day streak', line: 'A full week of showing up.', need: 'Train 7 days running' },
    { id: 'week', title: 'Full week', line: 'Three sessions in one week. That is a trophy.', need: '3 sessions in one week' },
    { id: 'pr', title: 'New best', line: 'You lifted more than you ever have on that movement.', need: 'Beat an old weight' },
    { id: 'strength', title: 'Strength', line: 'The heavy work has a first day.', need: 'Finish a strength session' },
    { id: 'mobility', title: 'Mobility', line: 'You gave the slow work its own session.', need: 'Finish a mobility session' },
    { id: 'cardio', title: 'Cardio', line: 'Heart and lungs got a turn of their own.', need: 'Finish a cardio session' },
    { id: 'back', title: 'You came back', line: 'A quiet week, then you returned. That counts.', need: 'Train again after 7 days off' }
  ];

  function modeOfWorkout(workout) {
    if (workout && workout.plan && workout.plan.mode) return workout.plan.mode;
    return 'strength';
  }

  function earnedMilestoneIds(workouts, now) {
    const list = (workouts || []).filter(function (workout) { return workout && workout.date; });
    const ids = [];
    if (list.length >= 1) ids.push('first');
    if (list.length >= 5) ids.push('five');
    if (list.length >= 10) ids.push('ten');
    if (list.length >= 25) ids.push('twentyfive');
    const run = streak(list, now);
    if (run >= 3) ids.push('streak3');
    if (run >= 7) ids.push('streak7');
    const modes = {};
    list.forEach(function (workout) { modes[modeOfWorkout(workout)] = true; });
    if (modes.strength) ids.push('strength');
    if (modes.mobility) ids.push('mobility');
    if (modes.cardio) ids.push('cardio');
    const weeks = {};
    list.forEach(function (workout) {
      const key = startOfWeek(workout.date).getTime();
      weeks[key] = (weeks[key] || 0) + 1;
    });
    const busiest = Object.keys(weeks).reduce(function (max, key) { return Math.max(max, weeks[key]); }, 0);
    if (busiest >= 3) ids.push('week');
    const times = list.map(function (workout) { return new Date(workout.date).getTime(); }).filter(function (t) { return t; }).sort(function (a, b) { return a - b; });
    for (let i = 1; i < times.length; i += 1) {
      if (times[i] - times[i - 1] >= 7 * 86400000) {
        ids.push('back');
        break;
      }
    }
    const chrono = list.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    for (let i = 1; i < chrono.length; i += 1) {
      if (personalRecords(chrono[i], chrono.slice(0, i)).length) {
        ids.push('pr');
        break;
      }
    }
    return ids;
  }

  function freshMilestones(workouts, seen, now) {
    const have = {};
    (seen || []).forEach(function (id) { have[id] = true; });
    const earned = {};
    earnedMilestoneIds(workouts, now).forEach(function (id) { earned[id] = true; });
    return MILESTONES.filter(function (item) { return earned[item.id] && !have[item.id]; });
  }

  function milestoneBoard(workouts, now) {
    const earned = {};
    earnedMilestoneIds(workouts, now).forEach(function (id) { earned[id] = true; });
    return MILESTONES.map(function (item) {
      return {
        id: item.id,
        title: item.title,
        line: item.line,
        need: item.need,
        earned: !!earned[item.id]
      };
    });
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
        plan: payload.plan || null,
        schedule: payload.schedule || null
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
    const goal = PLAN_GOALS.indexOf(source.goal) >= 0 ? source.goal : 'strength';
    const days = source.days === 3 ? 3 : 4;
    let emphasis = ['push', 'pull'];
    if (Array.isArray(source.emphasis) && source.emphasis.length === 2 &&
      PLAN_GROUPS.indexOf(source.emphasis[0]) >= 0 && PLAN_GROUPS.indexOf(source.emphasis[1]) >= 0 &&
      source.emphasis[0] !== source.emphasis[1]) {
      emphasis = source.emphasis.slice();
    }
    const blockStart = /^\d{4}-\d{2}-\d{2}$/.test(source.blockStart) ? source.blockStart : isoDay(now || new Date());
    const split = source.split === 'push-pull' || source.split === 'full' || source.split === 'upper-lower'
      ? source.split : 'upper-lower';
    return {
      goal: goal,
      days: days,
      split: split,
      name: String(source.name || '').trim(),
      onboarded: source.onboarded === true,
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
    if (goal === 'strength') return 'Get stronger';
    if (goal === 'muscle') return 'Build muscle';
    if (goal === 'mobility') return 'Mobility';
    return 'Stay athletic';
  }

  function splitLabel(split) {
    if (split === 'push-pull') return 'Push / Pull';
    if (split === 'full') return 'Full body';
    return 'Upper / Lower';
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
    if (group === 'push' && /rear/.test(muscles) && !/chest|pec|tricep/.test(muscles)) return false;
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
      next.variation = ready.variation + 1;
      next.lastNote = 'You got stronger. The routine stays ' + splitLabel(ready.split) + ', with different exercises this block.';
    } else if ((stats.current[ready.emphasis[0]] || {}).sessions || (stats.current[ready.emphasis[1]] || {}).sessions) {
      next.variation = ready.variation + 1;
      next.lastNote = 'Those lifts stayed about the same, so the muscles stay. The exercise list changes so the sessions are not copies.';
    } else {
      next.lastNote = 'No sessions landed in that block, so the focus stays and the four weeks start again today.';
    }
    next.lastNoteBlock = next.blockIndex;
    return { plan: next, changed: true, message: next.lastNote };
  }

  function modeCount(plan, mode) {
    return mode === 'mobility' || mode === 'cardio' ? 3 : plan.days;
  }

  function nextSlot(workouts, plan, now, mode) {
    const ready = normalizePlan(plan, now);
    const area = mode || 'strength';
    const count = modeCount(ready, area);
    const weekStart = startOfWeek(now || new Date());
    const today = isoDay(now || new Date());
    const done = (workouts || []).filter(function (workout) {
      const workoutMode = workout && workout.plan && workout.plan.mode ? workout.plan.mode : 'strength';
      return workout && workout.plan && workout.date && new Date(workout.date) >= weekStart &&
        workout.plan.blockIndex === ready.blockIndex && workoutMode === area;
    });
    const doneToday = done.some(function (workout) { return isoDay(workout.date) === today; });
    const used = {};
    done.forEach(function (workout) {
      if (workout.plan.slot != null) used[workout.plan.slot] = true;
    });
    for (let i = 0; i < count; i += 1) {
      if (!used[i]) return { slot: i, doneToday: doneToday, used: used, count: count };
    }
    return { slot: done.length % count, doneToday: doneToday, used: used, count: count };
  }

  function weekIds(workouts, plan, now, mode) {
    const ready = normalizePlan(plan, now);
    const area = mode || 'strength';
    const weekStart = startOfWeek(now || new Date());
    const ids = [];
    (workouts || []).forEach(function (workout) {
      const workoutMode = workout && workout.plan && workout.plan.mode ? workout.plan.mode : 'strength';
      if (!workout || !workout.plan || !workout.date || new Date(workout.date) < weekStart) return;
      if (workout.plan.blockIndex !== ready.blockIndex || workoutMode !== area) return;
      (workout.exercises || []).forEach(function (ex) {
        if (ex && ex.id != null) ids.push(ex.id);
      });
    });
    return ids;
  }

  function otherGroups(emphasis) {
    return PLAN_GROUPS.filter(function (group) { return emphasis.indexOf(group) === -1; });
  }

  const SPLIT_DAYS = {
    /* Upper/Lower calendars use ULU (Upper → Lower → Upper …), including 3-day weeks. */
    'upper-lower': { 3: ['upper', 'lower', 'upper'], 4: ['upper', 'lower', 'upper', 'lower'] },
    'push-pull': { 3: ['push', 'pull', 'legs'], 4: ['push', 'pull', 'legs', 'upper'] },
    full: { 3: ['full', 'full', 'full'], 4: ['full', 'full', 'full', 'full'] }
  };
  /* Titles stay plain only: Upper body / Lower body / Push / Pull / Full body (plus mobility/cardio).
   * Never A/B, Day 1/3, or "chest focus" marketing names. User hard rule. */
  const DAY_LABEL = {
    upper: 'Upper body',
    lower: 'Lower body',
    push: 'Push',
    pull: 'Pull',
    legs: 'Legs',
    full: 'Full body'
  };
  const DAY_FOCUS = {
    upper: 'Chest, back, arms',
    lower: 'Quads, hamstrings, glutes',
    push: 'Chest, shoulders, triceps',
    pull: 'Back, rear delts, biceps',
    legs: 'Quads, hamstrings, glutes',
    full: 'Push, pull, and legs'
  };

  /* Same day type twice in a week keeps a plain title, but picks a different lift bias. */
  function dayParts(day, goal, variant) {
    const count = goal === 'strength' ? 4 : 5;
    const v = variant || 0;
    if (day === 'upper') {
      if (v % 2 === 1) {
        return [
          { group: 'pull', count: 3, kind: 'main', bias: 'pull' },
          { group: 'push', count: 2, kind: 'main', bias: 'press' }
        ];
      }
      return [
        { group: 'push', count: 3, kind: 'main', bias: 'press' },
        { group: 'pull', count: 2, kind: 'main', bias: 'pull' }
      ];
    }
    if (day === 'lower') {
      return [
        { group: 'legs', count: count, kind: 'main', bias: v % 2 === 1 ? 'hinge' : 'squat' },
        { group: 'core', count: 1, kind: 'accessory' }
      ];
    }
    if (day === 'full') {
      if (v % 4 === 1) {
        return [
          { group: 'pull', count: 3, kind: 'main', bias: 'pull' },
          { group: 'push', count: 2, kind: 'main', bias: 'press' },
          { group: 'legs', count: 2, kind: 'main', bias: 'hinge' }
        ];
      }
      if (v % 4 === 2) {
        return [
          { group: 'legs', count: 3, kind: 'main', bias: 'squat' },
          { group: 'push', count: 2, kind: 'main', bias: 'press' },
          { group: 'pull', count: 2, kind: 'main', bias: 'pull' }
        ];
      }
      if (v % 4 === 3) {
        return [
          { group: 'push', count: 2, kind: 'main', bias: 'press' },
          { group: 'pull', count: 2, kind: 'main', bias: 'pull' },
          { group: 'legs', count: 2, kind: 'main', bias: 'hinge' }
        ];
      }
      return [
        { group: 'push', count: 3, kind: 'main', bias: 'press' },
        { group: 'pull', count: 2, kind: 'main', bias: 'pull' },
        { group: 'legs', count: 2, kind: 'main', bias: 'squat' }
      ];
    }
    return [{ group: day, count: count, kind: 'main' }];
  }

  function sessionParts(plan, slot) {
    const pattern = SPLIT_DAYS[plan.split] || SPLIT_DAYS['upper-lower'];
    const days = pattern[plan.days] || pattern[4];
    const index = ((slot % days.length) + days.length) % days.length;
    const day = days[index];
    const variant = days.slice(0, index + 1).filter(function (item) { return item === day; }).length - 1;
    return layoutForDay(plan, day, variant);
  }

  function layoutForDay(plan, day, variant) {
    const key = DAY_LABEL[day] ? day : 'full';
    const v = Number.isFinite(Number(variant)) ? Number(variant) : 0;
    return {
      day: key,
      title: DAY_LABEL[key] || 'Session',
      focus: DAY_FOCUS[key] || '',
      variant: v,
      parts: dayParts(key, plan.goal, v)
    };
  }

  /* Calendar rotation: ULU for upper/lower, plan days for push-pull, always Full for full. */
  function rotationFor(plan) {
    const ready = normalizePlan(plan);
    if (ready.split === 'full') return ['full'];
    if (ready.split === 'upper-lower') return ['upper', 'lower'];
    const pattern = SPLIT_DAYS['push-pull'];
    return (pattern[ready.days] || pattern[4]).slice();
  }

  function defaultWeekdays(days) {
    return days === 3 ? [1, 3, 5] : [1, 2, 4, 5];
  }

  /* Routinery / Streaks-style presets: user picks which days work, then rotation fills types. */
  const WEEKDAY_PRESETS = {
    weekdays: [1, 2, 3, 4, 5],
    mwf: [1, 3, 5],
    mtthf: [1, 2, 4, 5],
    everyday: [0, 1, 2, 3, 4, 5, 6]
  };

  function weekdayPresetOf(weekdays) {
    const sorted = (weekdays || []).slice().sort(function (a, b) { return a - b; });
    const keys = Object.keys(WEEKDAY_PRESETS);
    for (let i = 0; i < keys.length; i += 1) {
      const preset = WEEKDAY_PRESETS[keys[i]];
      if (preset.length === sorted.length && preset.every(function (d, idx) { return d === sorted[idx]; })) {
        return keys[i];
      }
    }
    return 'custom';
  }

  function weekdaysForPreset(preset, planDays) {
    if (preset === 'custom') return null;
    if (WEEKDAY_PRESETS[preset]) return WEEKDAY_PRESETS[preset].slice();
    return defaultWeekdays(planDays);
  }

  function normalizeModes(list) {
    const allowed = ['strength', 'mobility', 'cardio'];
    const out = [];
    (Array.isArray(list) ? list : []).forEach(function (mode) {
      if (allowed.indexOf(mode) >= 0 && out.indexOf(mode) < 0) out.push(mode);
    });
    return out;
  }

  function normalizeSchedule(schedule, plan) {
    const ready = normalizePlan(plan);
    const source = schedule && typeof schedule === 'object' ? schedule : {};
    let weekdays = Array.isArray(source.weekdays)
      ? source.weekdays.map(Number).filter(function (d) { return d >= 0 && d <= 6; })
      : [];
    const preset = typeof source.preset === 'string' ? source.preset : '';
    if (!weekdays.length && preset && WEEKDAY_PRESETS[preset]) {
      weekdays = WEEKDAY_PRESETS[preset].slice();
    }
    if (!weekdays.length) weekdays = defaultWeekdays(ready.days);
    /* Unique + sorted for stable compare. */
    weekdays = weekdays.filter(function (d, i, arr) { return arr.indexOf(d) === i; }).sort(function (a, b) { return a - b; });
    const overrides = {};
    const raw = source.overrides && typeof source.overrides === 'object' ? source.overrides : {};
    Object.keys(raw).forEach(function (key) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      const item = raw[key];
      if (!item || typeof item !== 'object') return;
      const modes = normalizeModes(item.modes);
      if (item.skip === true) {
        overrides[key] = { skip: true };
        if (modes.length) overrides[key].modes = modes;
        return;
      }
      const entry = {};
      if (item.type && DAY_LABEL[item.type]) entry.type = item.type;
      if (modes.length) entry.modes = modes;
      if (entry.type || entry.modes) overrides[key] = entry;
    });
    const rotation = rotationFor(ready);
    let nextIndex = Number(source.nextIndex);
    if (!Number.isFinite(nextIndex) || nextIndex < 0) nextIndex = 0;
    nextIndex = nextIndex % Math.max(1, rotation.length);
    return {
      weekdays: weekdays,
      preset: weekdayPresetOf(weekdays),
      overrides: overrides,
      nextIndex: nextIndex
    };
  }

  function setScheduleWeekdays(schedule, plan, weekdays) {
    const ready = normalizeSchedule(schedule, plan);
    const next = Array.isArray(weekdays)
      ? weekdays.map(Number).filter(function (d) { return d >= 0 && d <= 6; })
      : [];
    const unique = next.filter(function (d, i, arr) { return arr.indexOf(d) === i; }).sort(function (a, b) { return a - b; });
    ready.weekdays = unique.length ? unique : defaultWeekdays(normalizePlan(plan).days);
    ready.preset = weekdayPresetOf(ready.weekdays);
    return ready;
  }

  function applyWeekdayPreset(schedule, plan, preset) {
    const days = weekdaysForPreset(preset, normalizePlan(plan).days);
    if (!days) return normalizeSchedule(schedule, plan);
    return setScheduleWeekdays(schedule, plan, days);
  }

  function dayTypeLabel(type) {
    return DAY_LABEL[type] || 'Session';
  }

  function isTrainingWeekday(schedule, plan, date) {
    const ready = normalizeSchedule(schedule, plan);
    const d = new Date(date);
    return ready.weekdays.indexOf(d.getDay()) >= 0;
  }

  function overrideFor(schedule, plan, iso) {
    const ready = normalizeSchedule(schedule, plan);
    return ready.overrides[iso] || null;
  }

  function advanceSchedule(schedule, plan, loggedType) {
    const ready = normalizeSchedule(schedule, plan);
    const rotation = rotationFor(plan);
    const i = rotation.indexOf(loggedType);
    if (i >= 0) ready.nextIndex = (i + 1) % rotation.length;
    else ready.nextIndex = (ready.nextIndex + 1) % rotation.length;
    return ready;
  }

  function setScheduleDay(schedule, plan, iso, patch) {
    const ready = normalizeSchedule(schedule, plan);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ready;
    if (!patch || patch.clear) {
      delete ready.overrides[iso];
      return ready;
    }
    const prev = ready.overrides[iso] || {};
    if (patch.skip === true) {
      const entry = { skip: true };
      const keepModes = patch.modes != null ? normalizeModes(patch.modes) : normalizeModes(prev.modes);
      if (keepModes.length) entry.modes = keepModes;
      ready.overrides[iso] = entry;
      return ready;
    }
    const entry = {};
    if (patch.type && DAY_LABEL[patch.type]) entry.type = patch.type;
    else if (!patch.clearType && prev.type && DAY_LABEL[prev.type]) entry.type = prev.type;
    const modes = patch.modes != null ? normalizeModes(patch.modes) : normalizeModes(prev.modes);
    if (modes.length) entry.modes = modes;
    if (entry.type || entry.modes) ready.overrides[iso] = entry;
    else delete ready.overrides[iso];
    return ready;
  }

  function toggleScheduleMode(schedule, plan, iso, mode) {
    const ready = normalizeSchedule(schedule, plan);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ready;
    if (['strength', 'mobility', 'cardio'].indexOf(mode) < 0) return ready;
    const tip = suggestionForDate(ready, plan, iso, [], new Date(iso + 'T12:00:00'));
    const prev = ready.overrides[iso] || {};
    let modes = normalizeModes(prev.modes);
    /* Seed strength when this is already a training day and nothing was marked yet. */
    if (!modes.length && tip && tip.type && tip.status !== 'skip') modes = ['strength'];
    const idx = modes.indexOf(mode);
    if (idx >= 0) modes.splice(idx, 1);
    else modes.push(mode);
    const patch = { modes: modes };
    if (prev.type) patch.type = prev.type;
    else if (tip && tip.type && modes.indexOf('strength') >= 0) patch.type = tip.type;
    if (prev.skip) patch.skip = true;
    return setScheduleDay(ready, plan, iso, patch);
  }

  function strengthLoggedType(workout) {
    if (!workout) return null;
    const mode = modeOfWorkout(workout);
    if (mode !== 'strength') return null;
    if (workout.plan && workout.plan.day && DAY_LABEL[workout.plan.day]) return workout.plan.day;
    const name = String(workout.typeName || '').toLowerCase();
    if (name.indexOf('upper') === 0) return 'upper';
    if (name.indexOf('lower') === 0) return 'lower';
    if (name === 'push') return 'push';
    if (name === 'pull') return 'pull';
    if (name === 'legs') return 'legs';
    if (name.indexOf('full') === 0) return 'full';
    return null;
  }

  function modeDayLabel(mode) {
    if (mode === 'mobility') return 'Mobility';
    if (mode === 'cardio') return 'Cardio';
    return 'Strength';
  }

  function monthGrid(year, month, schedule, plan, workouts, now) {
    const ready = normalizeSchedule(schedule, plan);
    const rotation = rotationFor(plan);
    const todayIso = isoDay(now || new Date());
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push({ empty: true });

    /* All modes land on the grid; only strength logs consume a planned strength slot. */
    const logsByDay = {};
    const strengthByDay = {};
    (workouts || []).forEach(function (workout) {
      if (!workout || !workout.date) return;
      const iso = isoDay(workout.date);
      const mode = modeOfWorkout(workout);
      if (!logsByDay[iso]) logsByDay[iso] = [];
      logsByDay[iso].push({
        mode: mode,
        type: mode === 'strength' ? strengthLoggedType(workout) : null,
        typeName: workout.typeName || modeDayLabel(mode)
      });
      if (mode === 'strength' && !strengthByDay[iso]) strengthByDay[iso] = workout;
    });

    const futureDates = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const iso = isoDay(date);
      const override = ready.overrides[iso] || null;
      const weekdayHit = ready.weekdays.indexOf(date.getDay()) >= 0;
      const skipped = !!(override && override.skip);
      const forced = override && override.type ? override.type : null;
      const isSession = !skipped && (weekdayHit || !!forced);
      if (isSession && iso >= todayIso && !strengthByDay[iso]) futureDates.push(iso);
    }

    const assigned = {};
    let cursor = ready.nextIndex % rotation.length;
    futureDates.forEach(function (iso) {
      const override = ready.overrides[iso];
      const suggested = rotation[cursor % rotation.length];
      cursor += 1;
      assigned[iso] = override && override.type ? override.type : suggested;
    });

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const iso = isoDay(date);
      const override = ready.overrides[iso] || null;
      const weekdayHit = ready.weekdays.indexOf(date.getDay()) >= 0;
      const skipped = !!(override && override.skip);
      const logged = strengthByDay[iso] || null;
      const loggedType = strengthLoggedType(logged);
      const logs = logsByDay[iso] || [];
      const loggedModes = [];
      logs.forEach(function (entry) {
        if (loggedModes.indexOf(entry.mode) < 0) loggedModes.push(entry.mode);
      });
      let status = 'rest';
      let type = null;
      let tweaked = false;
      if (skipped) {
        status = 'skip';
      } else if (loggedType) {
        status = 'done';
        type = loggedType;
      } else if (assigned[iso]) {
        status = iso === todayIso ? 'today' : 'planned';
        type = assigned[iso];
        tweaked = !!(override && override.type);
      } else if (weekdayHit || (override && override.type)) {
        status = iso < todayIso ? 'missed' : 'planned';
        type = override && override.type ? override.type : null;
        tweaked = !!(override && override.type);
      }
      const plannedModes = normalizeModes(override && override.modes);
      /* Strength training days imply strength mode for tracking chips/dots. */
      if (type && plannedModes.indexOf('strength') < 0 && (status === 'planned' || status === 'today' || status === 'done' || status === 'missed')) {
        plannedModes.unshift('strength');
      }
      const markModes = [];
      plannedModes.forEach(function (mode) {
        if (markModes.indexOf(mode) < 0) markModes.push(mode);
      });
      loggedModes.forEach(function (mode) {
        if (markModes.indexOf(mode) < 0) markModes.push(mode);
      });
      let title = type ? dayTypeLabel(type) : (status === 'skip' ? 'Skip' : '');
      /* Quiet calendar cells: day letter only when strength is planned; mode names when only mobility/cardio. */
      let short = '';
      if (status === 'skip') short = 'Skip';
      else if (type) short = dayTypeLabel(type).charAt(0);
      else if (!skipped && logs.length) {
        const primary = logs[0];
        title = primary.typeName || modeDayLabel(primary.mode);
        short = modeDayLabel(primary.mode).charAt(0);
      } else if (plannedModes.length && !type) {
        title = plannedModes.map(modeDayLabel).join(' · ');
        short = modeDayLabel(plannedModes[0]).charAt(0);
      }
      cells.push({
        empty: false,
        date: iso,
        day: day,
        weekday: date.getDay(),
        status: status,
        type: type,
        title: title,
        short: short,
        tweaked: tweaked,
        isToday: iso === todayIso,
        logs: logs.slice(),
        loggedModes: loggedModes.slice(),
        plannedModes: plannedModes.slice(),
        markModes: markModes.slice(),
        hasLog: logs.length > 0
      });
    }
    while (cells.length % 7) cells.push({ empty: true });
    return {
      year: year,
      month: month,
      label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      weekdays: ready.weekdays.slice(),
      rotation: rotation.slice(),
      nextIndex: ready.nextIndex,
      cells: cells
    };
  }

  function suggestionForDate(schedule, plan, iso, workouts, now) {
    const when = parseDay(iso);
    if (Number.isNaN(when.getTime())) return null;
    const grid = monthGrid(when.getFullYear(), when.getMonth(), schedule, plan, workouts, now || when);
    return grid.cells.find(function (cell) { return !cell.empty && cell.date === iso; }) || null;
  }

  function poolFor(library, group, kind) {
    return (library || []).filter(function (ex) {
      if (!ex || ex.id == null) return false;
      if (kind === 'cardio') return isCardio(ex);
      if (isCardio(ex)) return false;
      if (kind === 'mobility') return isMobility(ex);
      if (isMobility(ex)) return false;
      return inGroup(ex, group);
    });
  }

  function scoreExercise(ex, group, kind, bias) {
    const first = String((ex.muscles && ex.muscles[0]) || '').toLowerCase();
    const muscles = (ex.muscles || []).join(' ').toLowerCase();
    const keys = GROUP_KEYS[group] || [];
    let score = keys.some(function (key) { return first.indexOf(key) !== -1; }) ? 4 : 0;
    const name = String(ex.name || '').toLowerCase();
    if (/behind-the-neck|careful/.test(name)) score -= 5;
    if (/press|squat|deadlift|row|pull-up|pulldown|lunge|thrust|dip/.test(name)) score += kind === 'main' ? 3 : 1;
    if (Number(ex.id) > 0 && Number(ex.id) < 700) score += 2;
    if (ex.category === 'Gym' && kind === 'main') score += 1;
    if (bias === 'press') {
      if (/bench|chest press|incline|dip|overhead|shoulder press|fly/.test(name) || /chest|pec|tricep/.test(muscles)) score += 3;
      if (/row|pulldown|pull-up|face pull|curl/.test(name)) score -= 1;
    } else if (bias === 'pull') {
      if (/row|pulldown|pull-up|chin|face pull|lat /.test(name) || /lat|back|bicep/.test(muscles)) score += 3;
      if (/bench|chest press|incline|lateral raise/.test(name)) score -= 1;
    } else if (bias === 'squat') {
      if (/squat|leg press|lunge|leg extension|step-up|hack/.test(name) || /quad/.test(muscles)) score += 3;
      if (/rdl|deadlift|leg curl|hip thrust|good morning|pull-through/.test(name) || /hamstring/.test(muscles)) score -= 1;
    } else if (bias === 'hinge') {
      if (/rdl|deadlift|leg curl|hip thrust|good morning|pull-through/.test(name) || /hamstring|glute/.test(muscles)) score += 3;
      if (/leg extension|hack squat/.test(name) || (/quad/.test(muscles) && !/glute|hamstring/.test(muscles))) score -= 1;
    }
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

  function pickExercises(pool, count, seed, avoid, group, kind, bias) {
    const avoidSet = {};
    (avoid || []).forEach(function (id) { avoidSet[String(id)] = true; });
    const ranked = pool.slice().sort(function (a, b) {
      const score = scoreExercise(b, group, kind, bias) - scoreExercise(a, group, kind, bias);
      if (score) return score;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
    const window = ranked.slice(0, Math.min(ranked.length, Math.max(count + 3, count)));
    const fresh = window.filter(function (ex) { return !avoidSet[String(ex.id)]; });
    const freshAll = ranked.filter(function (ex) { return !avoidSet[String(ex.id)]; });
    const spare = ranked.filter(function (ex) { return avoidSet[String(ex.id)]; });
    const out = [];
    const seen = {};
    takeFrom(fresh, count, seed, out, seen);
    takeFrom(freshAll, count, seed + 1, out, seen);
    takeFrom(spare, count, seed, out, seen);
    out.sort(function (a, b) { return scoreExercise(b, group, kind, bias) - scoreExercise(a, group, kind, bias); });
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
    if (kind === 'cardio') {
      copy.sets = 1;
      copy.rest = 0;
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

  const MOBILITY_FLOWS = [
    { title: 'Hips', test: /hip|pigeon|couch|90\/90|figure-4|quad stretch/i },
    { title: 'Spine', test: /cat-cow|thoracic|open book|child|spine|neck/i },
    { title: 'Full flow', test: /stretch|pose|mobility/i }
  ];
  const CARDIO_NAMES = ['Easy', 'Steady', 'Long'];

  function fillSection(library, predicate, count, seed, kind, goal, week) {
    const pool = (library || []).filter(predicate);
    return pickExercises(pool, count, seed, [], 'core', kind).map(function (ex) {
      return schemeFor(ex, goal, week, kind);
    });
  }

  function buildSession(options) {
    const plan = normalizePlan(options.plan, options.now);
    const mode = options.mode === 'mobility' || options.mode === 'cardio' ? options.mode : 'strength';
    const week = Math.min(4, Math.max(1, options.week || blockWeek(plan, options.now)));
    const slot = Number.isFinite(Number(options.slot)) ? Number(options.slot) : 0;
    const phase = WEEK_COPY[week];
    if (mode === 'mobility') {
      const flow = MOBILITY_FLOWS[((slot % 3) + 3) % 3];
      let exercises = fillSection(options.library, function (ex) {
        return ex && isMobility(ex) && flow.test.test(ex.name || '');
      }, 5, plan.variation * 40 + week * 5 + slot, 'mobility', plan.goal, week);
      if (exercises.length < 3) {
        exercises = fillSection(options.library, function (ex) { return ex && isMobility(ex); }, 5, slot + week, 'mobility', plan.goal, week);
      }
      return {
        title: flow.title,
        summary: 'Slow ranges and holds. Strength stays in its own section.',
        week: week,
        weekName: phase.name,
        slot: ((slot % 3) + 3) % 3,
        mode: 'mobility',
        exercises: exercises
      };
    }
    if (mode === 'cardio') {
      const index = ((slot % 3) + 3) % 3;
      const exercises = fillSection(options.library, function (ex) { return ex && isCardio(ex); }, 1, plan.variation + week + index, 'cardio', plan.goal, week);
      return {
        title: CARDIO_NAMES[index],
        summary: 'A separate cardio session. It does not replace the lifting.',
        week: week,
        weekName: phase.name,
        slot: index,
        mode: 'cardio',
        exercises: exercises
      };
    }
    const forcedDay = options.day && DAY_LABEL[options.day] ? options.day : null;
    const layout = forcedDay
      ? layoutForDay(plan, forcedDay, options.variant || 0)
      : sessionParts(plan, slot);
    const avoid = (options.avoidIds || []).slice();
    const chosen = [];
    layout.parts.forEach(function (part, partIndex) {
      const pool = poolFor(options.library, part.group, part.kind);
      const seed = plan.variation * 100 + week * 17 + slot * 5 + partIndex * 3 + plan.blockIndex + (layout.variant || 0) * 11;
      pickExercises(pool, part.count, seed, avoid.concat(chosen.map(function (ex) { return ex.id; })), part.group, part.kind, part.bias).forEach(function (ex) {
        chosen.push(schemeFor(ex, plan.goal, week, part.kind));
      });
    });
    const slotOut = forcedDay
      ? Math.max(0, (SPLIT_DAYS[plan.split] || SPLIT_DAYS['upper-lower'])[plan.days].indexOf(forcedDay))
      : ((slot % plan.days) + plan.days) % plan.days;
    return {
      title: layout.title,
      focus: layout.focus,
      day: layout.day,
      summary: phase.text,
      week: week,
      weekName: phase.name,
      slot: slotOut,
      mode: 'strength',
      split: plan.split,
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
    formatRest: formatRest,
    freshMilestones: freshMilestones,
    milestoneBoard: milestoneBoard,
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
    splitLabel: splitLabel,
    dayTypeLabel: dayTypeLabel,
    rotationFor: rotationFor,
    defaultWeekdays: defaultWeekdays,
    normalizeSchedule: normalizeSchedule,
    isTrainingWeekday: isTrainingWeekday,
    overrideFor: overrideFor,
    advanceSchedule: advanceSchedule,
    setScheduleDay: setScheduleDay,
    setScheduleWeekdays: setScheduleWeekdays,
    applyWeekdayPreset: applyWeekdayPreset,
    toggleScheduleMode: toggleScheduleMode,
    weekdayPresetOf: weekdayPresetOf,
    weekdaysForPreset: weekdaysForPreset,
    WEEKDAY_PRESETS: WEEKDAY_PRESETS,
    monthGrid: monthGrid,
    suggestionForDate: suggestionForDate,
    strengthLoggedType: strengthLoggedType,
    modeDayLabel: modeDayLabel,
    GROUP_LABEL: GROUP_LABEL,
    WEEK_COPY: WEEK_COPY,
    DAY_LABEL: DAY_LABEL
  };
});
