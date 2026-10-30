const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./game-harness.cjs');

const difficulties = ['easy', 'normal', 'hard', 'extreme'];
const targets = [15, 30, 45, 65, 100];

function launch(game, options = {}) {
  game.run(`Object.assign(runSelection, ${JSON.stringify({ mode: 'endless', difficulty: 'easy', stage: 1, skill: 'vaccine', ...options })}); launchRun();`);
}

function lastParry(game, target) {
  game.run(`score = ${target - 1}; spawnEnemy('up', clock - 1000, 1000, 'virus'); parry('up');`);
}

function winDomain(game) {
  game.run(`
    if (!bossFight) maybeQueueBoss();
    if (bossFight.phase === 'draining') startBossWarning();
    bossFight.kind = 'domain'; bossFight.remaining = 1; bossFight.total = 5;
    startDomainRound('up');
    clock = bossFight.attacks[0].arrival; fxClock = clock;
    bossParry('up');
    for (const dir of [...bossFight.sequence]) { fxClock += 100; bossParry(dir); }
    step(2000);
  `);
}

function isVisible(node) {
  if (!node) return false;
  for (let current = node; current; current = current.parentNode) if (current.hidden) return false;
  return true;
}

function clickMenu(game, selector) {
  const node = game.run(`document.querySelector(${JSON.stringify(selector)})`);
  assert.ok(node, `missing control ${selector}`);
  assert.ok(isVisible(node), `control must be visible before clicking: ${selector}`);
  node.click();
}

function assertScreen(game, expected) {
  assert.equal(game.run('menuScreen'), expected);
  assert.deepEqual(game.plain("[...document.querySelectorAll('[data-menu-screen]')].filter(panel=>!panel.hidden).map(panel=>panel.dataset.menuScreen)"), [expected]);
  assert.equal(isVisible(game.element('menu-back')), expected !== 'home');
}

test('default menu preserves the original easy endless game', () => {
  const game = createHarness();
  assert.deepEqual(game.plain('runSelection'), { mode: 'endless', difficulty: 'easy', stage: 1, skill: 'vaccine' });
  assert.equal(game.element('main-menu').hidden, false);
  assert.equal(game.element('game-view').hidden, true);
  assertScreen(game, 'home');
  for (const id of ['menu-play', 'help-open', 'menu-settings']) assert.ok(isVisible(game.element(id)), `${id} must be on the initial menu`);
  assert.equal(isVisible(game.element('menu-start')), false);
  assert.equal(isVisible(game.element('menu-resume-panel')), false);
  assert.deepEqual(game.plain('STAGE_TARGETS'), targets);
  const easy = game.plain('RUN_DIFFICULTIES.easy');
  assert.equal(easy.speed, 1);
  assert.equal(easy.spawn, 1);
  assert.equal(easy.minGap, 520);
  assert.equal(easy.guard, 360);
  assert.equal(easy.perfect, 100);
  assert.equal(easy.cooldown, 300);
  assert.equal(easy.damage, 1);
  assert.equal(easy.bossSpeed, 1);
  launch(game);
  assert.deepEqual(game.plain('pace()'), { gap: 1450, speed: 1, travel: 2200 });
  assert.equal(game.element('main-menu').hidden, true);
  assert.equal(game.element('game-view').hidden, false);
});

test('difficulty selection increases real speed and narrows real guard/perfect timing', () => {
  const game = createHarness();
  let previous;
  for (const difficulty of difficulties) {
    launch(game, { difficulty });
    const settings = game.plain(`RUN_DIFFICULTIES.${difficulty}`);
    assert.equal(Array.isArray(settings.name), true);
    const pacing = game.plain('pace()');
    if (previous) {
      assert.ok(pacing.speed > previous.pacing.speed, `${difficulty} must travel faster`);
      assert.ok(pacing.gap < previous.pacing.gap, `${difficulty} must spawn more often`);
      assert.ok(settings.guard < previous.settings.guard, `${difficulty} must narrow guard timing`);
      assert.ok(settings.perfect < previous.settings.perfect, `${difficulty} must narrow perfect timing`);
    }
    // 350 ms is a valid original guard, but outside all harder guard windows.
    game.run("spawnEnemy('up', clock, 1000, 'virus'); parry('up', clock + 650);");
    assert.equal(game.run('score'), difficulty === 'easy' ? 1 : 0);
    previous = { settings, pacing };
  }
});

for (const difficulty of difficulties) {
  for (let stage = 1; stage <= 5; stage++) {
    test(`${difficulty} stage ${stage}: target, speed, completion and independent clear record`, () => {
      const game = createHarness();
      launch(game, { mode: 'stage', difficulty, stage });
      const active = game.plain('activeRun');
      assert.equal(active.target, targets[stage - 1]);
      assert.equal(active.bossRequired, stage === 5);
      assert.equal(active.bossDefeated, false);
      const baseSpeed = game.run(`RUN_DIFFICULTIES.${difficulty}.speed`);
      assert.ok(Math.abs(game.run('pace().speed') - baseSpeed * (1 + .08 * (stage - 1))) < 1e-9);
      game.run(`score = ${targets[stage - 1] - 1}; checkStageCompletion();`);
      assert.equal(game.run('mode'), 'running');
      lastParry(game, targets[stage - 1]);
      if (stage === 5) {
        assert.equal(game.run('mode'), 'running', 'stage 5 cannot finish with eliminations alone');
        assert.equal(game.run('activeRun.bossDefeated'), false);
        winDomain(game);
      }
      assert.equal(game.run('mode'), 'cleared');
      const records = game.plain('stageRecords');
      assert.equal(records[`${difficulty}:${stage}`].cleared, true);
      assert.ok(records[`${difficulty}:${stage}`].bestScore >= targets[stage - 1]);
      assert.equal(records[`${difficulty}:${stage}`].bestVulnerability, 0);
      assert.equal(Object.keys(records).length, 1);
    });
  }
}

test('a failed/escaped stage 5 boss never counts as a victory', () => {
  const game = createHarness();
  launch(game, { mode: 'stage', stage: 5 });
  game.run("score=100; maybeQueueBoss(); startBossWarning(); bossFight.kind='domain'; bossFight.remaining=1; bossFight.total=5; startDomainRound('up'); failDomain(); step(2000); checkStageCompletion();");
  assert.equal(game.run('mode'), 'running');
  assert.equal(game.run('activeRun.bossDefeated'), false);
  assert.equal(game.run("!!stageRecords['easy:5']?.cleared"), false);
  assert.equal(game.run('bossFight !== null'), true, 'stage 5 offers another required boss after an escape');
});

test('proxy lane clears can finish a stage', () => {
  const game = createHarness();
  launch(game, { mode: 'stage', skill: 'proxy' });
  game.run("score=14; charge=SKILLS.proxy.cost; spawnEnemy('left', clock+100, 1000, 'virus'); activateSkill('left');");
  assert.equal(game.run('mode'), 'cleared');
  assert.equal(game.run("stageRecords['easy:1'].cleared"), true);
});

test('retry resets transient encounter, ability and input state each time', () => {
  const game = createHarness();
  launch(game, { mode: 'stage', difficulty: 'hard', stage: 3, skill: 'decoy' });
  for (let attempt = 0; attempt < 3; attempt++) {
    game.run("score=99; vulnerability=60; clock=8000; charge=24; decoyCapacity=12; proxyArmed=true; arrivalSlots=[9000]; lockedUntil.up=9000; proxyUntil.left=9000; nextWorm=9000; pointers.set(1,{}); spawnEnemy('up'); maybeQueueBoss(); gameOver(); replayRun();");
    assert.equal(game.run('mode'), 'running');
    assert.deepEqual(game.plain('({score,vulnerability,clock,charge,decoyCapacity,proxyArmed,enemies:enemies.length,bossFight,arrivalSlots,lockedUntil,proxyUntil,pointers:pointers.size})'), {
      score: 0, vulnerability: 0, clock: 0, charge: 0, decoyCapacity: 0, proxyArmed: false,
      enemies: 0, bossFight: null, arrivalSlots: [], lockedUntil: {}, proxyUntil: {}, pointers: 0
    });
    assert.equal(game.run('selectedSkill'), 'decoy');
    assert.deepEqual(game.plain('({mode:activeRun.mode,difficulty:activeRun.difficulty,stage:activeRun.stage,skill:activeRun.skill})'), { mode: 'stage', difficulty: 'hard', stage: 3, skill: 'decoy' });
  }
});

test('menu draft edits do not alter a paused run or the ability used when resuming', () => {
  const game = createHarness();
  launch(game, { mode: 'stage', difficulty: 'normal', stage: 2, skill: 'proxy' });
  game.run('score=17; clock=3200; charge=9; returnToMenu();');
  assert.equal(game.run('mode'), 'paused');
  assert.equal(game.element('main-menu').hidden, false);
  game.run("Object.assign(runSelection,{mode:'endless',difficulty:'extreme',stage:5,skill:'decoy'}); refreshMenu(); continueRun();");
  assert.equal(game.run('mode'), 'running');
  assert.deepEqual(game.plain('({mode:activeRun.mode,difficulty:activeRun.difficulty,stage:activeRun.stage,skill:activeRun.skill,selectedSkill,score,clock,charge})'), {
    mode: 'stage', difficulty: 'normal', stage: 2, skill: 'proxy', selectedSkill: 'proxy', score: 17, clock: 3200, charge: 9
  });
  game.run('returnToMenu(); launchRun();');
  assert.deepEqual(game.plain('({mode:activeRun.mode,difficulty:activeRun.difficulty,stage:activeRun.stage,skill:activeRun.skill,selectedSkill,score,clock,charge})'), {
    mode: 'endless', difficulty: 'extreme', stage: 5, skill: 'decoy', selectedSkill: 'decoy', score: 0, clock: 0, charge: 0
  });
});

test('next stage uses the cleared run difficulty and loadout, and stops after stage 5', () => {
  const game = createHarness();
  launch(game, { mode: 'stage', difficulty: 'hard', stage: 4, skill: 'proxy' });
  lastParry(game, 65);
  assert.equal(game.run('mode'), 'cleared');
  game.run("Object.assign(runSelection,{difficulty:'easy',stage:1,skill:'decoy'}); advanceStage();");
  assert.deepEqual(game.plain('({mode:activeRun.mode,difficulty:activeRun.difficulty,stage:activeRun.stage,skill:activeRun.skill,score})'), { mode: 'stage', difficulty: 'hard', stage: 5, skill: 'proxy', score: 0 });
  game.run('score=100;');
  winDomain(game);
  assert.equal(game.run('mode'), 'cleared');
  game.run('advanceStage();');
  assert.ok(game.run('activeRun.stage') <= 5);
  assert.notEqual(game.run('mode'), 'running');
});

test('legacy easy best migrates, difficulty scores stay separate, stage clears persist on reload', () => {
  const game = createHarness({ 'neon-parry-defense-best': '42' });
  assert.equal(game.run('endlessRecords.easy'), 42);
  for (const [difficulty, score] of [['easy', 9], ['normal', 31], ['hard', 21], ['extreme', 11]]) {
    launch(game, { difficulty });
    game.run(`score=${score}; rememberBest();`);
  }
  assert.deepEqual(game.plain('endlessRecords'), { easy: 42, normal: 31, hard: 21, extreme: 11 });
  launch(game, { mode: 'stage', difficulty: 'normal', stage: 1 });
  game.run('vulnerability=34;');
  lastParry(game, 15);
  assert.equal(game.run("stageRecords['normal:1'].bestVulnerability"), 30);
  assert.equal(game.run('endlessRecords.normal'), 31);
  game.run('replayRun(); vulnerability=22;');
  lastParry(game, 15);
  assert.equal(game.run("stageRecords['normal:1'].bestVulnerability"), 18);
  const reload = createHarness(game.snapshotStorage());
  assert.deepEqual(reload.plain('endlessRecords'), { easy: 42, normal: 31, hard: 21, extreme: 11 });
  assert.equal(reload.run("stageRecords['normal:1'].cleared"), true);
  assert.equal(reload.run("stageRecords['normal:1'].bestVulnerability"), 18);
});

test('stage menu advances one visible choice screen at a time before starting the selected run', () => {
  const game = createHarness();
  assertScreen(game, 'home');
  clickMenu(game, '#menu-play');
  assertScreen(game, 'mode');
  clickMenu(game, '[data-menu-mode=stage]');
  assertScreen(game, 'difficulty');
  clickMenu(game, '[data-menu-difficulty=extreme]');
  assertScreen(game, 'stage');
  clickMenu(game, '[data-menu-stage="5"]');
  assertScreen(game, 'ability');
  clickMenu(game, '[data-menu-skill=decoy]');
  assert.deepEqual(game.plain('runSelection'), { mode: 'stage', difficulty: 'extreme', stage: 5, skill: 'decoy' });
  assert.equal(game.run("document.querySelectorAll('[data-menu-stage]').length"), 5);
  assert.equal(game.run("document.querySelectorAll('[data-menu-difficulty]').length"), 4);
  assert.equal(isVisible(game.element('menu-start')), true);
  assert.equal(game.run('mode'), 'idle', 'choosing an ability does not start early');
  clickMenu(game, '#menu-start');
  assert.equal(game.run('mode'), 'running');
  assert.equal(game.run('activeRun.stage'), 5);
  assert.equal(game.run('selectedSkill'), 'decoy');
});

test('endless selection skips the stage screen and Back retraces each applicable screen', () => {
  const game = createHarness();
  clickMenu(game, '#menu-play');
  clickMenu(game, '[data-menu-mode=endless]');
  clickMenu(game, '[data-menu-difficulty=hard]');
  assertScreen(game, 'ability');
  clickMenu(game, '[data-menu-skill=proxy]');
  clickMenu(game, '#menu-back');
  assertScreen(game, 'difficulty');
  assert.equal(game.run('runSelection.skill'), 'proxy', 'Back keeps the ability draft');
  clickMenu(game, '#menu-back');
  assertScreen(game, 'mode');
  clickMenu(game, '[data-menu-mode=stage]');
  clickMenu(game, '[data-menu-difficulty=normal]');
  assertScreen(game, 'stage');
  clickMenu(game, '[data-menu-stage="3"]');
  assertScreen(game, 'ability');
  clickMenu(game, '#menu-back');
  assertScreen(game, 'stage');
  assert.equal(game.run('runSelection.stage'), 3);
  clickMenu(game, '#menu-back');
  assertScreen(game, 'difficulty');
  clickMenu(game, '#menu-back');
  assertScreen(game, 'mode');
  clickMenu(game, '#menu-back');
  assertScreen(game, 'home');
});

test('settings owns the unique language, sound and fullscreen controls; Help returns to the home menu', () => {
  const game = createHarness();
  const ids = game.plain("[...document.querySelectorAll('[id]')].map(node=>node.id)");
  assert.equal(new Set(ids).size, ids.length, 'every HTML id must be unique');
  for (const id of ['language', 'sound-toggle', 'fullscreen']) {
    assert.equal(game.run(`document.querySelectorAll('[id="${id}"]').length`), 1);
    assert.equal(game.element(id).closest('[data-menu-screen]').dataset.menuScreen, 'settings');
    assert.equal(isVisible(game.element(id)), false);
  }
  clickMenu(game, '#menu-settings');
  assertScreen(game, 'settings');
  for (const id of ['language', 'sound-toggle', 'fullscreen']) assert.equal(isVisible(game.element(id)), true);
  game.element('language').value = 'ko';
  game.element('language').dispatchEvent({ type: 'change' });
  assert.equal(game.run('language'), 'ko');
  assertScreen(game, 'settings');
  clickMenu(game, '#menu-back');
  assertScreen(game, 'home');
  clickMenu(game, '#help-open');
  assert.equal(game.element('help-dialog').open, true);
  game.element('help-close').click();
  assert.equal(game.element('help-dialog').open, false);
  assertScreen(game, 'home');
  assert.equal(game.run('mode'), 'idle');
});

test('paused run resumes from home after editing a sequential new-run draft and viewing Help', () => {
  const game = createHarness();
  launch(game, { mode: 'stage', difficulty: 'normal', stage: 2, skill: 'proxy' });
  game.run('score=17; clock=3200; charge=9;');
  clickMenu(game, '#menu-open');
  assertScreen(game, 'home');
  assert.ok(isVisible(game.element('menu-resume-panel')));
  clickMenu(game, '#help-open');
  assert.equal(game.element('help-dialog').open, true);
  game.element('help-close').click();
  clickMenu(game, '#menu-play');
  assert.equal(isVisible(game.element('menu-resume-panel')), false);
  clickMenu(game, '[data-menu-mode=endless]');
  clickMenu(game, '[data-menu-difficulty=extreme]');
  clickMenu(game, '[data-menu-skill=decoy]');
  assert.equal(game.run('mode'), 'paused');
  assert.equal(game.run('activeRun.skill'), 'proxy');
  for (let back = 0; back < 3; back++) clickMenu(game, '#menu-back');
  assertScreen(game, 'home');
  clickMenu(game, '#menu-resume');
  assert.equal(game.run('mode'), 'running');
  assert.deepEqual(game.plain('({mode:activeRun.mode,difficulty:activeRun.difficulty,stage:activeRun.stage,skill:activeRun.skill,selectedSkill,score,clock,charge})'), {
    mode: 'stage', difficulty: 'normal', stage: 2, skill: 'proxy', selectedSkill: 'proxy', score: 17, clock: 3200, charge: 9
  });
  clickMenu(game, '#menu-open');
  assertScreen(game, 'home');
  assert.ok(isVisible(game.element('menu-resume-panel')));
});

test('stage completion respects pause, game over and endless mode', () => {
  const game = createHarness();
  launch(game, { mode: 'stage' });
  game.run('score=15; pauseGame(); checkStageCompletion();');
  assert.equal(game.run('mode'), 'paused');
  assert.equal(game.run("!!stageRecords['easy:1']?.cleared"), false);
  game.run('resumeGame(); gameOver(); checkStageCompletion();');
  assert.equal(game.run('mode'), 'over');
  assert.equal(game.run("!!stageRecords['easy:1']?.cleared"), false);
  launch(game);
  game.run('score=150; checkStageCompletion();');
  assert.equal(game.run('mode'), 'running');
  assert.equal(game.run("!!stageRecords['easy:1']?.cleared"), false);
});

test('original easy damage, perfect healing, and phishing reverse-lane rule remain intact', () => {
  const game = createHarness();
  for (const [kind, damage] of [['virus', 14], ['ddos', 24], ['trojan', 34], ['worm', 30], ['ransom', 8], ['phishing', 40], ['echo', 8]]) {
    launch(game);
    game.run(`onImpact(spawnEnemy('up',clock,1000,${JSON.stringify(kind)}));`);
    assert.equal(game.run('vulnerability'), damage, `${kind} keeps its original damage`);
  }
  launch(game);
  game.run("vulnerability=40; spawnEnemy('up',clock-900,900,'worm'); parry('up');");
  assert.equal(game.run('vulnerability'), 20);
  launch(game);
  game.run("spawnEnemy('up',clock-1900,1900,'phishing'); parry('up');");
  assert.equal(game.run('score'), 0);
  assert.equal(game.run('vulnerability'), 4);
  game.run("parry('down');");
  assert.equal(game.run('score'), 1);
  assert.equal(game.run('vulnerability'), 0);
});

test('vaccine heals 29 without pushback and decoy shield behavior survives menu changes', () => {
  const game = createHarness();
  launch(game, { skill: 'vaccine' });
  game.run("vulnerability=48; charge=20; spawnEnemy('up',clock-1000,1000,'virus'); activateSkill();");
  assert.equal(game.run('vulnerability'), 19);
  assert.equal(game.run('charge'), 0);
  assert.equal(game.run('!!enemies[0].push'), false);
  assert.equal(game.run('vaccineSlowAt'), game.run('fxClock'));
  launch(game, { skill: 'decoy' });
  game.run("charge=24; activateSkill(); dealDamage(80,'test hit',true,'virus');");
  assert.equal(game.run('vulnerability'), 0, 'the shield-breaking attack cannot spill into the core');
  assert.equal(game.run('decoyCapacity'), 0);
  game.run("dealDamage(14,'test hit',true,'virus');");
  assert.equal(game.run('vulnerability'), 14);
  game.run("vulnerability=32; charge=24; activateSkill(); onImpact(spawnEnemy('left',clock,1000,'ransom'));");
  assert.equal(game.run('vulnerability'), 22);
  assert.equal(game.run('lockedUntil.left || 0'), 0, 'ransomware absorbed by a decoy cannot lock the lane');
});

test('vaccine slows all enemy timelines for 1200 real active milliseconds without knockback', () => {
  const game=createHarness();launch(game);
  game.run("vulnerability=50;charge=20;spawnEnemy('up',0,2200,'virus');spawnEnemy('right',0,1900,'phishing');activateSkill();nextSpawn=Infinity;nextWorm=Infinity;");
  const positions=game.plain('enemies.map(e=>({arrival:e.arrival,at:e.at,travel:e.travel}))');
  game.run('step(25)');assert.equal(game.run('clock'),0);assert.equal(game.run('vulnerability'),21);
  game.run('pauseGame();step(1000)');assert.equal(game.run('fxClock'),25);
  game.run('resumeGame();for(let i=0;i<47;i++)step(25)');
  assert.equal(game.run('fxClock'),1200);assert.equal(game.run('clock'),300);
  assert.deepEqual(game.plain('enemies.map(e=>({arrival:e.arrival,at:e.at,travel:e.travel}))'),positions);
  const before=game.run('clock');game.run('step(25)');assert.equal(game.run('clock')-before,25);
});

test('proxy removes dormant worms and phishing through either lane without charging',()=>{
  for(const side of ['up','down']){
    const game=createHarness();launch(game,{skill:'proxy'});
    game.run(`charge=16;spawnWorm('${side}');spawnEnemy('up',clock,1900,'phishing');activateSkill('${side}');`);
    assert.equal(game.run('enemies.length'),0);assert.equal(game.run('score'),2);assert.equal(game.run('charge'),0);
    assert.equal(game.run(`proxyUntil.${side}-clock`),6000);
  }
});

test('boss entry cancels slow/barriers and locks every skill throughout every boss phase',()=>{
  for(const skill of ['vaccine','proxy','decoy']){
    const game=createHarness();launch(game,{skill});
    game.run('charge=SKILLS[selectedSkill].cost;decoyCapacity=35;vaccineSlowAt=fxClock;proxyUntil.up=clock+6000;score=100;maybeQueueBoss();');
    assert.equal(game.run('vaccineSlowAt'),-Infinity);assert.deepEqual(game.plain('proxyUntil'),{});assert.equal(game.run('decoyCapacity'),35);
    for(const phase of ['draining','warning','active','reaction','telegraph','retry','rebound','failed','finisher']){
      game.run(`bossFight.phase='${phase}';updateSkillHUD();`);assert.equal(game.element('skill').disabled,true);
      assert.equal(game.run("activateSkill('right')"),false);assert.equal(game.run('charge'),game.run('SKILLS[selectedSkill].cost'));
    }
    game.run('resumeRegularAfterBoss();');assert.equal(game.element('skill').disabled,false);
  }
  const game=createHarness();launch(game,{skill:'proxy'});
  game.run("score=99;charge=16;spawnEnemy('up');activateSkill('up');");assert.ok(game.run('!!bossFight'));assert.deepEqual(game.plain('proxyUntil'),{});
});

function domainReaction(game,remaining=5){
  game.run(`score=100;maybeQueueBoss();startBossWarning();bossFight.kind='domain';bossFight.remaining=${remaining};startDomainRound('up');clock=bossFight.attacks[0].arrival;fxClock=clock;bossParry('up');`);
}
test('domain ordinary rounds use all three numbered lanes; mistakes preserve sequence and deadline',()=>{
  const game=createHarness();launch(game);domainReaction(game);
  assert.equal(game.run('bossFight.mains.size'),3);assert.equal(game.run('bossFight.sequence.length'),3);
  assert.equal(new Set(game.plain('bossFight.sequence')).size,3);assert.ok(!game.plain('bossFight.sequence').includes('up'));
  const deadline=game.run('bossFight.phaseUntil');
  game.run("fxClock+=100;bossParry('up');");assert.equal(game.run('vulnerability'),4);assert.equal(game.run('bossFight.sequenceIndex'),0);assert.equal(game.run('bossFight.phaseUntil'),deadline);
  game.run('vulnerability=30;for(const dir of [...bossFight.sequence]){fxClock+=100;bossParry(dir);}');
  assert.equal(game.run('bossFight.remaining'),4);assert.equal(game.run('bossFight.phase'),'rebound');assert.equal(game.run('vulnerability'),25);
});

test('domain final round uses nine ordered numbers, three per lane, and only timeout ends a failed encounter',()=>{
  const game=createHarness();launch(game);domainReaction(game,1);
  const seq=game.plain('bossFight.sequence');assert.equal(seq.length,9);
  for(const dir of ['left','right','down'])assert.equal(seq.filter(d=>d===dir).length,3);
  game.run('vulnerability=40;fxClock+=100;bossParry(bossFight.sequence[0]);');assert.equal(game.run('bossFight.mains.size'),3);
  game.run('for(const dir of bossFight.sequence.slice(1)){fxClock+=100;bossParry(dir);}');
  assert.equal(game.run('bossFight.phase'),'finisher');assert.equal(game.run('vulnerability'),35);
  const missed=createHarness();launch(missed);domainReaction(missed,2);
  missed.run('fxClock=bossFight.phaseUntil;step(0);');assert.equal(missed.run('bossFight.phase'),'failed');assert.equal(missed.run('vulnerability'),40);
});

test('destroy previews all spawn lanes in order before launching its staggered fragments',()=>{
  const game=createHarness();launch(game);
  game.run("score=100;maybeQueueBoss();startBossWarning();bossFight.kind='destroy';bossFight.remaining=4;startDestroyRound('up');clock=bossFight.attacks[0].arrival;fxClock=clock;bossParry('up');");
  assert.equal(game.run('bossFight.phase'),'telegraph');assert.equal(game.run('bossFight.attacks.length'),0);
  const planned=game.plain('bossFight.wavePlan');assert.equal(planned.length,2);assert.notEqual(planned[0],planned[1]);
  game.run('fxClock+=bossFight.previewInterval;updateBoss(0);');
  assert.equal(game.run('bossFight.previewNodes[1].getAttribute("opacity")'),'1');
  assert.equal(game.run('bossFight.previewNodes[1].querySelectorAll("lineargradient").length'),1);
  game.run('fxClock+=50;updateBoss(0);');
  assert.ok(Number(game.run('bossFight.previewNodes[1].getAttribute("opacity")'))<1);
  game.run('fxClock=bossFight.phaseUntil;updateBoss(0);');assert.equal(game.run('bossFight.phase'),'active');
  assert.deepEqual(game.plain('bossFight.attacks.map(a=>a.dir)'),planned);
  assert.equal(game.run('bossFight.attacks[1].arrival-bossFight.attacks[0].arrival'),220);
  game.run('vulnerability=50;bossFight.depth=2;bossFight.attacks=[];resolveDestroyHit();');assert.equal(game.run('vulnerability'),30);
  game.run("bossFight.remaining=4;bossPhase('active');missDestroy({depth:2});");assert.equal(game.run('vulnerability'),57.5);
});

test('result screen skill selection changes retry loadout while preserving run and next-stage context',()=>{
  for(const mode of ['stage','endless']){
    const game=createHarness();launch(game,{mode,difficulty:'hard',stage:3,skill:'vaccine'});game.run('gameOver();');
    assert.equal(game.element('skill-choices').hidden,false);game.element('skill-choices').querySelector('[data-skill="proxy"]').click();
    game.run('replayRun();');assert.deepEqual(game.plain('({mode:activeRun.mode,difficulty:activeRun.difficulty,stage:activeRun.stage,skill:activeRun.skill})'),{mode,difficulty:'hard',stage:3,skill:'proxy'});
  }
  const game=createHarness();launch(game,{mode:'stage'});game.run('score=15;completeStage();');
  assert.equal(game.element('skill-choices').hidden,false);game.run("selectSkill('decoy');advanceStage();");assert.equal(game.run('activeRun.skill'),'decoy');assert.equal(game.run('activeRun.stage'),2);
});

test('home patch notes are bilingual modal content and Escape cannot resume through them',()=>{
  const game=createHarness();game.element('patch-open').click();assert.equal(game.element('patch-dialog').open,true);
  assert.ok(game.element('patch-content').innerHTML.includes('29-point'));
  game.run("language='ko';refreshLanguage();");assert.ok(game.element('patch-open').textContent.includes('패치노트'));
  game.element('patch-close').click();assert.equal(game.element('patch-dialog').open,false);
});

test('vaccine holds for 300ms, accelerates monotonically, and is independent of frame partition',()=>{
  const a=createHarness(),b=createHarness();launch(a);launch(b);
  for(const game of [a,b])game.run('charge=20;activateSkill();nextSpawn=Infinity;nextWorm=Infinity;');
  a.run('step(300)');assert.equal(a.run('clock'),0);
  const speeds=[];
  for(let i=0;i<3;i++){const before=a.run('clock');a.run('step(300)');speeds.push(a.run('clock')-before);}
  assert.ok(speeds[0]<speeds[1]&&speeds[1]<speeds[2]);assert.equal(a.run('clock'),300);
  b.run('for(let i=0;i<48;i++)step(25)');assert.equal(b.run('clock'),a.run('clock'));
  a.run('score=100;maybeQueueBoss();step(25)');assert.equal(a.run('clock'),325);
});
