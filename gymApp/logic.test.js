const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

test('Epley matches the previous calculator for 100 x 5', function () {
  assert.equal(Math.round(L.epley(100, 5) * 10) / 10, 116.7);
  assert.equal(L.epley(100, 1), 100);
  assert.equal(L.epley(0, 5), 0);
});

test('weight converts between kg and lbs and stores kg', function () {
  const lbs = L.toDisplayWeight(100, 'lbs');
  assert.equal(lbs, 220.5);
  assert.equal(L.toKg(lbs, 'lbs'), 100);
  assert.equal(L.toDisplayWeight(40, 'kg'), 40);
});

test('week count uses the calendar week and does not treat old sessions as this week', function () {
  const now = new Date('2026-09-24T12:00:00');
  const workouts = [
    { date: '2026-09-23T10:00:00' },
    { date: '2026-09-20T10:00:00' },
    { date: '2026-09-01T10:00:00' }
  ];
  assert.equal(L.weekCount(workouts, now), 2);
});

test('streak is current, and stops when a day is missed', function () {
  const now = new Date('2026-09-24T18:00:00');
  assert.equal(L.streak([
    { date: '2026-09-24T08:00:00' },
    { date: '2026-09-23T08:00:00' },
    { date: '2026-09-22T08:00:00' }
  ], now), 3);
  assert.equal(L.streak([
    { date: '2026-09-24T08:00:00' },
    { date: '2026-09-24T20:00:00' },
    { date: '2026-09-22T08:00:00' }
  ], now), 1);
  assert.equal(L.streak([{ date: '2026-08-01T08:00:00' }], now), 0);
  assert.equal(L.streak([{ date: '2026-09-23T08:00:00' }], now), 1);
});

test('custom routines resolve their own exercises, not the push day', function () {
  const programs = {
    push: { exercises: [{ id: 101, name: 'Bench' }] }
  };
  const templates = [{
    id: 'custom_1',
    name: 'Arms',
    exercises: [{ id: 700, name: 'Curl' }, { id: 701, name: 'Extension' }]
  }];
  const resolved = L.resolveSessionExercises({
    dayType: 'custom_1',
    programs: programs,
    templates: templates,
    workout: {}
  });
  assert.deepEqual(resolved.map(function (ex) { return ex.id; }), [700, 701]);
});

test('saved session exercises and extras survive a resume', function () {
  const resolved = L.resolveSessionExercises({
    dayType: 'push',
    programs: { push: { exercises: [{ id: 101, name: 'Bench' }] } },
    templates: [],
    sessionExercises: [{ id: 900, name: 'Saved move' }],
    workout: { extraExercises: [{ id: 901, name: 'Ignored when session list exists' }] }
  });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].name, 'Saved move');

  const withExtra = L.resolveSessionExercises({
    dayType: 'push',
    programs: { push: { exercises: [{ id: 101, name: 'Bench' }] } },
    templates: [],
    workout: {
      extraExercises: [{ id: 501, name: 'Cable Crunch' }],
      overrides: { 101: { name: 'Machine press' } }
    }
  });
  assert.equal(withExtra[0].name, 'Machine press');
  assert.equal(withExtra[1].name, 'Cable Crunch');
});

test('volume ignores empty set slots and personal records skip null sets', function () {
  const workout = {
    exercises: [{
      id: 101,
      name: 'Bench',
      completedSets: [null, { weight: 80, reps: 5 }, { weight: 85, reps: 3 }]
    }]
  };
  assert.equal(L.volumeOf(workout), 80 * 5 + 85 * 3);
  const history = [{
    exercises: [{ id: 101, completedSets: [{ weight: 70, reps: 5 }, null] }]
  }];
  const prs = L.personalRecords(workout, history, function (ex) { return ex.name; });
  assert.equal(prs.length, 1);
  assert.equal(prs[0].weight, 85);
  assert.equal(L.personalRecords(workout, [], function (ex) { return ex.name; }).length, 0);
});

test('progress series keeps best set and estimated 1RM in order', function () {
  const workouts = [
    { date: '2026-09-02T10:00:00', exercises: [{ id: 101, name: 'Bench', completedSets: [{ weight: 60, reps: 8 }] }] },
    { date: '2026-09-01T10:00:00', exercises: [{ id: 101, name: 'Bench', completedSets: [{ weight: 50, reps: 8 }] }] },
    { date: '2026-09-02T10:00:00', exercises: [{ id: 202, completedSets: [] }] }
  ];
  const series = L.progressSeries(workouts, 101);
  assert.equal(series.length, 2);
  assert.equal(series[0].bestWeight, 50);
  assert.equal(series[1].bestWeight, 60);
  assert.ok(series[1].est1rm > series[0].est1rm);
  const summary = L.exerciseSummaries(workouts, function (ex) { return ex.name || 'Exercise'; });
  assert.equal(summary[0].id, 101);
  assert.equal(summary[0].bestWeight, 60);
  assert.equal(summary[0].sessions, 2);
});

test('overload suggestion adds weight only at the top of the rep range', function () {
  const up = L.suggestOverload({ weight: 40, reps: 12 }, '8-12', 'kg');
  assert.equal(up.kind, 'weight');
  assert.equal(up.display, 42.5);
  const reps = L.suggestOverload({ weight: 40, reps: 8 }, '8-12', 'kg');
  assert.equal(reps.kind, 'reps');
});

test('backup reader accepts the old export and rejects anything else', function () {
  const backup = L.buildBackup({ workouts: [{ date: '2026-01-01', exercises: [] }], templates: [{ id: 'custom_1' }], unit: 'lbs', weight: 70 });
  assert.equal(backup.app, 'StrongLean');
  const parsed = L.parseBackup(JSON.stringify({ app: 'StrongLean', workouts: backup.workouts, settings: { unit: 'kg', weight: '65' } }));
  assert.equal(parsed.workouts.length, 1);
  assert.equal(parsed.templates, null);
  assert.throws(function () { L.parseBackup('{"app":"Other","workouts":[]}'); });
});

test('chart places a larger value higher on the line', function () {
  const points = L.chartGeometry([10, 20], 100, 40, 4);
  assert.ok(points[1].y < points[0].y);
  assert.equal(L.chartGeometry([10], 100, 40, 4), null);
});

test('updating a logged set does not restart rest, and a swap does not prefill the new exercise', function () {
  assert.equal(L.shouldStartRest(null), true);
  assert.equal(L.shouldStartRest({ weight: 0, reps: 0 }), true);
  assert.equal(L.shouldStartRest({ weight: 40, reps: 8 }), false);
  assert.equal(L.prefillFromSet({ weight: 40, reps: 8, exerciseId: 101 }, 101).weight, 40);
  assert.equal(L.prefillFromSet({ weight: 40, reps: 8, exerciseId: 101 }, 700), null);
  assert.equal(L.prefillFromSet({ weight: 40, reps: 8 }, 700).weight, 40);
});

test('elapsed time and average duration stay honest', function () {
  assert.equal(L.formatElapsed(65000), '01:05');
  assert.equal(L.formatElapsed(3661000), '1:01:01');
  assert.equal(L.avgDuration([{ durationMin: 40 }, { durationMin: 50 }, { durationMin: 0 }]), 45);
  assert.equal(L.avgDuration([]), null);
});
