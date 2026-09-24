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
        weight: payload.weight != null ? String(payload.weight) : '65'
      }
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
    prefillFromSet: prefillFromSet
  };
});
