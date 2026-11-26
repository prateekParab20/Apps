/* Exercise demo photos: free-exercise-db (Unlicense) CDN + local clear demos.
 * Prefer CDN paths (Folder/0.jpg or 1.jpg). Local files use local:filename under media/photos/.
 * Portrait CDN frames that crop badly are letterboxed locally. See ATTRIBUTION.json.
 */
(function (root) {
  const BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
  const LOCAL_BASE = "media/photos/";
  const PHOTOS = {"101":"Dumbbell_Bench_Press/0.jpg","102":"Incline_Dumbbell_Press/0.jpg","103":"Seated_Dumbbell_Press/0.jpg","104":"Cable_Seated_Lateral_Raise/0.jpg","105":"Triceps_Pushdown_-_Rope_Attachment/0.jpg","106":"Cable_Crunch/0.jpg","107":"Pallof_Press/0.jpg","201":"local:assisted-pull-up.jpg","202":"Seated_Cable_Rows/0.jpg","203":"Wide-Grip_Lat_Pulldown/0.jpg","204":"One-Arm_Dumbbell_Row/0.jpg","205":"Face_Pull/1.jpg","206":"Dumbbell_Bicep_Curl/0.jpg","207":"Hanging_Leg_Raise/0.jpg","301":"Smith_Machine_Bench_Press/0.jpg","302":"local:assisted-pull-up.jpg","303":"Seated_Dumbbell_Press/0.jpg","304":"Seated_Cable_Rows/0.jpg","305":"Cable_Seated_Lateral_Raise/0.jpg","306":"Triceps_Pushdown_-_Rope_Attachment/0.jpg","307":"Cable_Crunch/0.jpg","401":"Leg_Press/0.jpg","402":"Romanian_Deadlift/0.jpg","403":"Leg_Extensions/0.jpg","404":"Thigh_Abductor/0.jpg","405":"Split_Squats/0.jpg","406":"Standing_Calf_Raises/0.jpg","501":"Cable_Crunch/0.jpg","502":"Hanging_Leg_Raise/0.jpg","503":"Pallof_Press/0.jpg","504":"Plank/0.jpg","700":"Dumbbell_Bench_Press/0.jpg","701":"Incline_Dumbbell_Press/0.jpg","702":"Decline_Push-Up/0.jpg","703":"Flat_Bench_Cable_Flyes/0.jpg","704":"Butterfly/0.jpg","705":"Pushups/0.jpg","706":"Pushups/0.jpg","707":"local:svend-press.jpg","708":"Dumbbell_Floor_Press/0.jpg","709":"Cable_Chest_Press/0.jpg","710":"Bent_Over_Barbell_Row/0.jpg","711":"Bent_Over_Barbell_Row/0.jpg","712":"One-Arm_Long_Bar_Row/0.jpg","713":"Wide-Grip_Lat_Pulldown/0.jpg","714":"Close-Grip_Front_Lat_Pulldown/0.jpg","715":"Straight-Arm_Pulldown/0.jpg","716":"Bent-Arm_Dumbbell_Pullover/0.jpg","717":"Seated_Cable_Rows/0.jpg","718":"Seated_One-arm_Cable_Pulley_Rows/0.jpg","719":"Bent_Over_One-Arm_Long_Bar_Row/0.jpg","720":"Superman/0.jpg","721":"Hyperextensions_Back_Extensions/0.jpg","722":"Good_Morning/0.jpg","723":"Seated_Cable_Rows/0.jpg","724":"Inverted_Row_with_Straps/0.jpg","725":"Arnold_Dumbbell_Press/0.jpg","726":"Side_Lateral_Raise/0.jpg","727":"Front_Dumbbell_Raise/0.jpg","728":"Seated_Bent-Over_Rear_Delt_Raise/0.jpg","729":"Reverse_Machine_Flyes/0.jpg","730":"Smith_Machine_Upright_Row/0.jpg","731":"Front_Cable_Raise/0.jpg","732":"local:landmine-180s.jpg","733":"Handstand_Push-Ups/0.jpg","734":"Side_Lateral_Raise/0.jpg","735":"Cuban_Press/0.jpg","736":"External_Rotation/0.jpg","737":"Barbell_Curl/0.jpg","738":"Alternate_Hammer_Curl/0.jpg","739":"Incline_Dumbbell_Curl/0.jpg","740":"Preacher_Curl/0.jpg","741":"Standing_Biceps_Cable_Curl/0.jpg","742":"Concentration_Curls/0.jpg","743":"Standing_Dumbbell_Triceps_Extension/0.jpg","744":"Lying_Dumbbell_Tricep_Extension/0.jpg","745":"Close-Grip_Barbell_Bench_Press/0.jpg","746":"Tricep_Dumbbell_Kickback/0.jpg","747":"Bench_Dips/0.jpg","748":"Triceps_Pushdown_-_Rope_Attachment/0.jpg","749":"Seated_Dumbbell_Palms-Down_Wrist_Curl/0.jpg","750":"Reverse_Barbell_Curl/0.jpg","751":"Barbell_Squat/0.jpg","752":"Front_Barbell_Squat/0.jpg","753":"Barbell_Hack_Squat/0.jpg","754":"Barbell_Walking_Lunge/0.jpg","755":"Dumbbell_Lunges/0.jpg","756":"Dumbbell_Lunges/0.jpg","757":"Romanian_Deadlift/0.jpg","758":"Sumo_Deadlift/0.jpg","759":"Barbell_Deadlift/0.jpg","760":"local:trap-bar-deadlift.jpg","761":"Barbell_Hip_Thrust/0.jpg","762":"Single_Leg_Glute_Bridge/0.jpg","763":"Lying_Leg_Curls/0.jpg","764":"Seated_Leg_Curl/0.jpg","765":"Leg_Press/0.jpg","766":"Narrow_Stance_Leg_Press/0.jpg","767":"Seated_Calf_Raise/0.jpg","768":"Standing_Dumbbell_Calf_Raise/0.jpg","769":"Natural_Glute_Ham_Raise/0.jpg","770":"Box_Squat/0.jpg","771":"Crunches/0.jpg","772":"Cable_Reverse_Crunch/0.jpg","773":"Air_Bike/0.jpg","774":"Russian_Twist/0.jpg","775":"Side_Bridge/0.jpg","776":"Mountain_Climbers/0.jpg","777":"Barbell_Ab_Rollout_-_On_Knees/0.jpg","778":"Hanging_Leg_Raise/0.jpg","779":"Hanging_Leg_Raise/0.jpg","780":"Stomach_Vacuum/0.jpg","781":"Jackknife_Sit-Up/0.jpg","782":"Exercise_Ball_Crunch/0.jpg","783":"Sit_Squats/0.jpg","784":"Incline_Push-Up/0.jpg","785":"One-Legged_Cable_Kickback/0.jpg","786":"Walking_Treadmill/0.jpg","787":"Calf_Stretch_Elbows_Against_Wall/0.jpg","788":"local:cat-cow.jpg","789":"Upper_Back_Stretch/0.jpg","790":"Band_Good_Morning/0.jpg","791":"Chest_Stretch_on_Stability_Ball/0.jpg","792":"Dumbbell_Bicep_Curl/0.jpg","793":"Inverted_Row/0.jpg","794":"Dumbbell_Step_Ups/0.jpg","795":"Chin-Up/0.jpg","796":"Wide-Grip_Rear_Pull-Up/0.jpg","797":"Mixed_Grip_Chin/0.jpg","798":"Pullups/0.jpg","799":"Hanging_Pike/0.jpg","800":"One_Handed_Hang/0.jpg","801":"Walking_Treadmill/0.jpg","802":"Trail_Running_Walking/0.jpg","803":"local:jumping-jacks.jpg","804":"Bicycling/0.jpg","805":"Elliptical_Trainer/0.jpg","806":"Rowing_Stationary/0.jpg","807":"Smith_Machine_Squat/0.jpg","808":"Smith_Machine_Stiff-Legged_Deadlift/0.jpg","809":"One-Legged_Cable_Kickback/0.jpg","810":"Monster_Walk/0.jpg","811":"Thigh_Adductor/0.jpg","812":"Thigh_Abductor/0.jpg","813":"Smith_Machine_Close-Grip_Bench_Press/0.jpg","814":"Bench_Dips/0.jpg","815":"Cable_Hip_Adduction/0.jpg","816":"Cable_Crunch/0.jpg","817":"Smith_Machine_Incline_Bench_Press/0.jpg","818":"Incline_Cable_Flye/0.jpg","819":"Cable_Crossover/0.jpg","820":"Plyo_Push-up/0.jpg","821":"One_Arm_Dumbbell_Bench_Press/0.jpg","822":"One-Arm_Dumbbell_Row/0.jpg","823":"Bent_Over_Barbell_Row/0.jpg","824":"One-Arm_Dumbbell_Row/0.jpg","825":"Straight-Arm_Pulldown/0.jpg","826":"Face_Pull/1.jpg","827":"Side_Lateral_Raise/0.jpg","828":"Front_Cable_Raise/0.jpg","829":"Push_Press_-_Behind_the_Neck/0.jpg","830":"Front_Plate_Raise/0.jpg","831":"Standing_Military_Press/0.jpg","832":"Spider_Curl/0.jpg","833":"Cable_Rope_Overhead_Triceps_Extension/0.jpg","834":"JM_Press/0.jpg","835":"Barbell_Curl/0.jpg","836":"Alternate_Hammer_Curl/0.jpg","837":"Split_Squats/0.jpg","838":"Dumbbell_Rear_Lunge/0.jpg","839":"Barbell_Walking_Lunge/0.jpg","840":"One-Legged_Cable_Kickback/0.jpg","841":"Barbell_Hip_Thrust/0.jpg","842":"Weighted_Sissy_Squat/0.jpg","843":"Standing_Leg_Curl/0.jpg","844":"Romanian_Deadlift/0.jpg","845":"Flutter_Kicks/0.jpg","846":"Jackknife_Sit-Up/0.jpg","847":"Side_Bridge/0.jpg","848":"Pallof_Press/0.jpg","849":"Dead_Bug/0.jpg","850":"One-Arm_Kettlebell_Swings/0.jpg","851":"One-Arm_Kettlebell_Clean/0.jpg","852":"Kettlebell_Thruster/0.jpg","853":"local:burpee.jpg","854":"local:med-ball-slam.jpg","855":"local:battling-ropes.jpg","856":"Worlds_Greatest_Stretch/0.jpg","857":"90_90_Hamstring/0.jpg","858":"local:pigeon-pose.jpg","859":"IT_Band_and_Glute_Stretch/0.jpg","860":"Childs_Pose/0.jpg","861":"Iron_Crosses_stretch/0.jpg","862":"Standing_Elevated_Quad_Stretch/0.jpg","863":"Kneeling_Hip_Flexor/0.jpg","864":"Calf_Stretch_Elbows_Against_Wall/0.jpg","865":"Chin_To_Chest_Stretch/0.jpg","866":"Pullups/0.jpg","867":"Dips_-_Chest_Version/0.jpg","868":"Bench_Dips/0.jpg","869":"Single-Arm_Push-Up/0.jpg","870":"Pushups/0.jpg","871":"Push-Ups_With_Feet_Elevated/0.jpg","872":"Inverted_Row/0.jpg","873":"local:smith-pistol-squat.jpg","874":"Split_Squats/0.jpg","875":"Handstand_Push-Ups/0.jpg","876":"Handstand_Push-Ups/0.jpg","877":"Bear_Crawl_Sled_Drags/0.jpg","878":"local:l-sit.jpg","879":"Muscle_Up/0.jpg","880":"local:box-jump.jpg","881":"Flutter_Kicks/0.jpg","882":"Flutter_Kicks/0.jpg","883":"Scissor_Kick/0.jpg","884":"Flat_Bench_Lying_Leg_Raise/0.jpg","885":"Isometric_Wipers/0.jpg","886":"Plank/0.jpg","887":"Push_Up_to_Side_Plank/0.jpg","888":"local:bird-dog.jpg","889":"local:reverse-plank.jpg","890":"Mountain_Climbers/0.jpg"};
  const PATTERNS = {"101":"push","102":"push","103":"push","104":"shoulders","105":"arms","106":"core","107":"core","201":"pull","202":"pull","203":"pull","204":"pull","205":"pull","206":"arms","207":"core","301":"push","302":"pull","303":"push","304":"pull","305":"shoulders","306":"arms","307":"core","401":"squat","402":"hinge","403":"squat","404":"hips","405":"squat","406":"cardio","501":"core","502":"core","503":"core","504":"core","700":"push","701":"push","702":"push","703":"push","704":"push","705":"push","706":"push","707":"push","708":"push","709":"push","710":"pull","711":"pull","712":"pull","713":"pull","714":"pull","715":"pull","716":"pull","717":"pull","718":"pull","719":"pull","720":"general","721":"hinge","722":"hinge","723":"pull","724":"pull","725":"push","726":"shoulders","727":"shoulders","728":"shoulders","729":"shoulders","730":"pull","731":"shoulders","732":"push","733":"push","734":"shoulders","735":"push","736":"shoulders","737":"arms","738":"arms","739":"arms","740":"arms","741":"arms","742":"arms","743":"arms","744":"arms","745":"push","746":"arms","747":"push","748":"arms","749":"arms","750":"arms","751":"squat","752":"squat","753":"squat","754":"squat","755":"squat","756":"squat","757":"hinge","758":"hinge","759":"hinge","760":"hinge","761":"hinge","762":"hinge","763":"hinge","764":"hinge","765":"squat","766":"squat","767":"cardio","768":"cardio","769":"hinge","770":"squat","771":"core","772":"core","773":"core","774":"core","775":"core","776":"core","777":"core","778":"core","779":"core","780":"core","781":"core","782":"core","783":"squat","784":"push","785":"squat","786":"core","787":"mobility","788":"general","789":"mobility","790":"hinge","791":"mobility","792":"arms","793":"pull","794":"squat","795":"pull","796":"pull","797":"core","798":"push","799":"core","800":"shoulders","801":"cardio","802":"cardio","803":"squat","804":"cardio","805":"cardio","806":"cardio","807":"squat","808":"hinge","809":"hips","810":"cardio","811":"hips","812":"hips","813":"push","814":"push","815":"hips","816":"core","817":"push","818":"push","819":"push","820":"push","821":"push","822":"pull","823":"pull","824":"pull","825":"pull","826":"pull","827":"shoulders","828":"shoulders","829":"shoulders","830":"shoulders","831":"push","832":"arms","833":"arms","834":"push","835":"arms","836":"arms","837":"squat","838":"squat","839":"squat","840":"hips","841":"hinge","842":"squat","843":"hinge","844":"hinge","845":"core","846":"core","847":"core","848":"core","849":"core","850":"hinge","851":"general","852":"squat","853":"squat","854":"core","855":"cardio","856":"mobility","857":"mobility","858":"mobility","859":"mobility","860":"mobility","861":"mobility","862":"mobility","863":"mobility","864":"mobility","865":"mobility","866":"pull","867":"push","868":"push","869":"core","870":"core","871":"push","872":"pull","873":"squat","874":"squat","875":"shoulders","876":"core","877":"core","878":"core","879":"general","880":"squat","881":"core","882":"core","883":"core","884":"core","885":"core","886":"core","887":"core","888":"core","889":"core","890":"core"};

  const FALLBACK_COLORS = {
    push: '#0a84ff',
    pull: '#30d158',
    squat: '#ff9f0a',
    hinge: '#ff453a',
    shoulders: '#64d2ff',
    arms: '#bf5af2',
    core: '#ff375f',
    hips: '#ac8e68',
    cardio: '#ffd60a',
    mobility: '#5e5ce6',
    general: '#8e8e93'
  };

  function escapeAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function patternOf(id, muscles, name) {
    const key = String(id);
    if (PATTERNS[key]) return PATTERNS[key];
    const n = String(name || '').toLowerCase();
    const m = (muscles || []).join(' ').toLowerCase();
    if (/stretch|mobility|pose/.test(n)) return 'mobility';
    if (/plank|crunch|core|abs|twist|hollow/.test(n + ' ' + m)) return 'core';
    if (/squat|lunge|leg press/.test(n)) return 'squat';
    if (/deadlift|rdl|hinge|thrust|swing/.test(n)) return 'hinge';
    if (/row|pull|chin/.test(n)) return 'pull';
    if (/press|push|bench|fly|dip/.test(n)) return 'push';
    if (/curl|tricep|bicep|pushdown/.test(n)) return 'arms';
    if (/raise|shoulder|delt/.test(n + ' ' + m)) return 'shoulders';
    if (/walk|cardio|bike|jump|march/.test(n)) return 'cardio';
    if (/hip|abduct|adduct/.test(n)) return 'hips';
    return 'general';
  }

  function photoUrl(id) {
    const path = PHOTOS[String(id)];
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    if (path.indexOf('local:') === 0) return LOCAL_BASE + path.slice(6);
    return BASE + path;
  }

  function fallbackSvg(id, muscles, name) {
    const pattern = patternOf(id, muscles, name);
    const color = FALLBACK_COLORS[pattern] || FALLBACK_COLORS.general;
    const label = pattern.charAt(0).toUpperCase() + pattern.slice(1);
    const icons = {
      push: '<path d="M28 62h64M40 62V38l20-12 20 12v24M48 50h32" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
      pull: '<path d="M30 36h60M40 36v28l20 14 20-14V36M48 52h24" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
      squat: '<path d="M40 28v18l-10 30h20l14-24 14 24h20L88 46V28" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
      hinge: '<path d="M34 70l20-36h12l20 36M54 34V22" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
      shoulders: '<path d="M30 70l18-34h24l18 34M48 36l12-14 12 14" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
      arms: '<path d="M36 64c0-18 12-30 28-30s28 12 28 30M64 34V22" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round"/>',
      core: '<ellipse cx="64" cy="48" rx="22" ry="28" fill="none" stroke="' + color + '" stroke-width="5"/><path d="M64 28v40M50 48h28" fill="none" stroke="' + color + '" stroke-width="4" stroke-linecap="round"/>',
      hips: '<path d="M40 36h48v16H40zM48 52v22M80 52v22M40 44H28M100 44h-12" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
      cardio: '<path d="M24 64h16l10-28 12 40 12-24 8 12h22" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
      mobility: '<path d="M40 70c0-24 16-40 24-40s24 16 24 40M48 40c8-12 24-12 32 0" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round"/>',
      general: '<circle cx="64" cy="48" r="26" fill="none" stroke="' + color + '" stroke-width="5"/><path d="M64 30v36M46 48h36" fill="none" stroke="' + color + '" stroke-width="4" stroke-linecap="round"/>'
    };
    const icon = icons[pattern] || icons.general;
    return '<svg class="ex-visual-svg" viewBox="0 0 128 96" role="img" aria-label="' + escapeAttr(label) + ' movement"><rect width="128" height="96" rx="16" fill="currentColor" opacity="0.06"/>' + icon + '<text x="64" y="88" text-anchor="middle" fill="currentColor" opacity="0.45" font-size="10" font-family="system-ui,sans-serif">' + escapeAttr(label) + '</text></svg>';
  }

  function visualHTML(id, opts) {
    opts = opts || {};
    const muscles = opts.muscles || [];
    const name = opts.name || '';
    const size = opts.size || 'md';
    const url = photoUrl(id);
    const pattern = patternOf(id, muscles, name);
    const cls = 'ex-visual ex-visual-' + size;
    if (url) {
      return '<div class="' + cls + '" data-pattern="' + escapeAttr(pattern) + '">' +
        '<img src="' + escapeAttr(url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';var f=this.nextElementSibling;if(f)f.hidden=false;">' +
        '<div class="ex-visual-fallback" hidden>' + fallbackSvg(id, muscles, name) + '</div>' +
        '</div>';
    }
    return '<div class="' + cls + ' ex-visual-fallback-only" data-pattern="' + escapeAttr(pattern) + '">' + fallbackSvg(id, muscles, name) + '</div>';
  }

  root.GymMedia = {
    photoUrl: photoUrl,
    patternOf: patternOf,
    visualHTML: visualHTML,
    hasPhoto: function (id) { return !!PHOTOS[String(id)]; },
    coverage: function () { return { mapped: Object.keys(PHOTOS).length }; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
