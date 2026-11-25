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

const catalog = [
  { id: 1, name: 'Bench Press', muscles: ['Chest', 'Triceps'], reps: '8-12', sets: 3, rest: 90 },
  { id: 2, name: 'Incline Press', muscles: ['Upper Chest', 'Shoulders'], reps: '8-12', sets: 3, rest: 90 },
  { id: 3, name: 'Shoulder Press', muscles: ['Shoulders', 'Triceps'], reps: '8-12', sets: 3, rest: 90 },
  { id: 4, name: 'Lateral Raise', muscles: ['Side Delts'], reps: '12-15', sets: 3, rest: 60 },
  { id: 5, name: 'Pushdown', muscles: ['Triceps'], reps: '10-12', sets: 3, rest: 60 },
  { id: 6, name: 'Row', muscles: ['Mid Back', 'Biceps'], reps: '8-12', sets: 3, rest: 90 },
  { id: 7, name: 'Pulldown', muscles: ['Lats', 'Biceps'], reps: '8-12', sets: 3, rest: 90 },
  { id: 8, name: 'Face Pull', muscles: ['Rear Delts'], reps: '12-15', sets: 3, rest: 60 },
  { id: 9, name: 'Curl', muscles: ['Biceps'], reps: '10-12', sets: 3, rest: 60 },
  { id: 10, name: 'Squat', muscles: ['Quads', 'Glutes'], reps: '8-12', sets: 3, rest: 120 },
  { id: 11, name: 'Romanian Deadlift', muscles: ['Hamstrings', 'Glutes'], reps: '8-10', sets: 3, rest: 90 },
  { id: 12, name: 'Calf Raise', muscles: ['Calves'], reps: '12-15', sets: 3, rest: 45 },
  { id: 13, name: 'Leg Press', muscles: ['Quads'], reps: '8-12', sets: 3, rest: 90 },
  { id: 14, name: 'Plank', muscles: ['Core'], reps: '30-45 sec', sets: 2, rest: 30 },
  { id: 15, name: 'Dead Bug', muscles: ['Abs'], reps: '8-12', sets: 3, rest: 45 },
  { id: 16, name: 'World\'s Greatest Stretch', muscles: ['Hips'], reps: '5 / side', sets: 2, rest: 30 },
  { id: 17, name: 'Cat-Cow', muscles: ['Spine Mobility'], reps: '8', sets: 2, rest: 20 },
  { id: 18, name: 'Couch Stretch', muscles: ['Hip Flexors'], reps: '30 sec', sets: 2, rest: 20 },
  { id: 19, name: 'Brisk Walk', muscles: ['Cardio', 'Legs'], reps: '10-20 min', sets: 1, rest: 0 }
];

test('a block is four weeks, then it is ready to change', function () {
  const plan = L.normalizePlan({ goal: 'strength', days: 4, blockStart: '2026-11-01', emphasis: ['push', 'pull'] }, new Date(2026, 10, 1));
  assert.equal(L.blockWeek(plan, new Date(2026, 10, 1)), 1);
  assert.equal(L.blockWeek(plan, new Date(2026, 10, 7)), 1);
  assert.equal(L.blockWeek(plan, new Date(2026, 10, 8)), 2);
  assert.equal(L.blockWeek(plan, new Date(2026, 10, 28)), 4);
  assert.equal(L.blockWeek(plan, new Date(2026, 10, 29)), 5);
});

test('strength weeks add a set, then ease off, and days do not repeat the same list', function () {
  const plan = L.normalizePlan({ goal: 'strength', days: 4, blockStart: '2026-11-01', emphasis: ['push', 'pull'], variation: 0, blockIndex: 0 }, new Date(2026, 10, 1));
  const base = L.buildSession({ library: catalog, plan: plan, week: 1, slot: 0 });
  const build = L.buildSession({ library: catalog, plan: plan, week: 2, slot: 0 });
  const ease = L.buildSession({ library: catalog, plan: plan, week: 4, slot: 0 });
  const other = L.buildSession({ library: catalog, plan: plan, week: 1, slot: 1 });
  assert.equal(base.weekName, 'Base');
  assert.ok(base.exercises.every(function (ex) { return ex.reps === '4-6' && ex.sets === 4; }));
  assert.ok(build.exercises.every(function (ex) { return ex.sets === 5; }));
  assert.ok(ease.exercises.every(function (ex) { return ex.sets < build.exercises[0].sets; }));
  assert.notDeepEqual(base.exercises.map(function (ex) { return ex.id; }), other.exercises.map(function (ex) { return ex.id; }));
  assert.equal(catalog[0].sets, 3);
  assert.equal(base.title.indexOf('Chest and shoulders') >= 0, true);
  assert.equal(other.title.indexOf('Back and arms') >= 0, true);
});

test('later weeks and a finished session change which exercises are chosen', function () {
  const plan = L.normalizePlan({ goal: 'muscle', days: 3, blockStart: '2026-11-01', emphasis: ['push', 'pull'], variation: 0 }, new Date(2026, 10, 1));
  const first = L.buildSession({ library: catalog, plan: plan, week: 1, slot: 0 });
  const later = L.buildSession({ library: catalog, plan: plan, week: 3, slot: 0 });
  const varied = L.buildSession({ library: catalog, plan: Object.assign({}, plan, { variation: 1 }), week: 1, slot: 0 });
  const ids = function (session) { return session.exercises.map(function (ex) { return ex.id; }).join(','); };
  assert.notEqual(ids(first), ids(later));
  assert.notEqual(ids(first), ids(varied));
  const avoided = L.buildSession({ library: catalog, plan: plan, week: 1, slot: 2, avoidIds: [10, 11] });
  assert.ok(avoided.exercises.every(function (ex) { return [10, 11].indexOf(ex.id) === -1; }));
});

test('a mobility day keeps joint work and leaves cardio out', function () {
  const plan = L.normalizePlan({ goal: 'mobility', days: 3, blockStart: '2026-11-01', emphasis: ['legs', 'core'] }, new Date(2026, 10, 1));
  const session = L.buildSession({ library: catalog, plan: plan, week: 1, slot: 0 });
  assert.equal(session.title, 'Mobility');
  assert.ok(session.exercises.some(function (ex) { return /stretch|cat-cow|couch/i.test(ex.name); }));
  assert.ok(session.exercises.every(function (ex) { return ex.name !== 'Brisk Walk'; }));
  assert.ok(session.exercises.filter(function (ex) { return /sec/i.test(ex.reps); }).every(function (ex) { return ex.sets === 2 && ex.rest === 30; }));
});

test('progress after four weeks moves the target muscles', function () {
  const plan = L.normalizePlan({
    goal: 'mixed',
    days: 4,
    blockStart: '2026-10-01',
    emphasis: ['push', 'pull'],
    variation: 0,
    blockIndex: 0
  }, new Date(2026, 9, 1));
  const workouts = [{
    date: '2026-10-10T12:00:00',
    exercises: [
      { id: 1, muscles: ['Chest'], completedSets: [{ weight: 80, reps: 5 }] },
      { id: 6, muscles: ['Mid Back'], completedSets: [{ weight: 60, reps: 8 }] }
    ]
  }];
  const stayed = L.advancePlan(plan, [], new Date(2026, 9, 20), catalog);
  assert.equal(stayed.changed, false);
  const moved = L.advancePlan(plan, workouts, new Date(2026, 9, 29), catalog);
  assert.equal(moved.changed, true);
  assert.deepEqual(moved.plan.emphasis, ['legs', 'core']);
  assert.equal(moved.plan.blockStart, '2026-10-29');
  assert.equal(moved.plan.variation, 1);
  assert.match(moved.message, /legs/i);
  const quiet = L.advancePlan(plan, [], new Date(2026, 9, 29), catalog);
  assert.equal(quiet.changed, true);
  assert.deepEqual(quiet.plan.emphasis, ['push', 'pull']);
  assert.match(quiet.message, /No sessions/);
});

test('the next session slot skips days already trained this week', function () {
  const plan = L.normalizePlan({ days: 4, blockIndex: 2, blockStart: '2026-11-16' }, new Date(2026, 10, 18));
  const now = new Date(2026, 10, 18, 15);
  const workouts = [{ date: '2026-11-18T08:00:00', plan: { blockIndex: 2, slot: 0 }, exercises: [] }];
  const next = L.nextSlot(workouts, plan, now);
  assert.equal(next.doneToday, true);
  assert.equal(next.slot, 1);
});
