'use strict';

let menuScreen = 'home';

const MENU_SKILLS = {
  vaccine: {
    name: ['Vaccine', '백신'],
    description: ['Recover 24 vulnerability points and push nearby enemies back.', '취약률을 24 회복하고 가까운 적을 밀어냅니다.'],
    control: ['Space / ability button / lane swipe', 'Space / 능력 버튼 / 라인 스와이프']
  },
  proxy: {
    name: ['Proxy', '프록시'],
    description: ['Clear one lane and block new enemies there for 5 seconds.', '한 방향의 적을 지우고 5초 동안 새 적을 막습니다.'],
    control: ['Shift + direction / ability button, then direction / lane swipe', 'Shift + 방향 / 능력 버튼 누른 뒤 방향 / 라인 스와이프']
  },
  decoy: {
    name: ['Decoy', '미끼폴더'],
    description: ['Create a shield that absorbs 50 damage.', '피해를 50까지 막는 보호막을 만듭니다.'],
    control: ['Space / ability button / lane swipe', 'Space / 능력 버튼 / 라인 스와이프']
  }
};

function menuText(pair) { return pair[language === 'ko' ? 1 : 0]; }
function menuDifficultyName(id) { return difficultyName(id); }
function menuModeName(value) { return value === 'stage' ? t('Stages', '스테이지 모드') : t('Endless', '무한 모드'); }
function menuStageGoal(stage) {
  const count = stageTarget(stage);
  return stage === 5
    ? t(`${count} eliminations + boss`, `${count}회 방어 + 보스`)
    : t(`${count} eliminations`, `${count}회 방어`);
}

function refreshMenu() {
  const selection = runSelection;
  const titles = {
    home: 'NEON PARRY',
    mode: t('Mode', '모드'),
    difficulty: t('Difficulty', '난이도'),
    stage: t('Stage', '스테이지'),
    ability: t('Ability', '능력'),
    settings: t('Settings', '설정')
  };
  for (const panel of document.querySelectorAll('[data-menu-screen]')) {
    panel.hidden = panel.dataset.menuScreen !== menuScreen;
  }
  $('menu-board').dataset.screen = menuScreen;
  $('menu-title').textContent = titles[menuScreen];
  $('menu-back').hidden = menuScreen === 'home';
  $('menu-back').textContent = t('← Back', '← 뒤로');
  $('menu-play').textContent = 'Play';
  $('help-open').textContent = 'Help';
  $('menu-settings').textContent = 'Settings';
  $('menu-open').textContent = t('Menu', '메뉴');
  $('settings-language-label').textContent = t('Language', '언어');
  $('settings-sound-label').textContent = t('Sound', '소리');
  $('settings-display-label').textContent = t('Display', '화면');

  const context = $('menu-context');
  context.hidden = menuScreen !== 'stage' && menuScreen !== 'ability';
  context.textContent = context.hidden ? '' : `${menuModeName(selection.mode)} · ${menuDifficultyName(selection.difficulty)}${menuScreen === 'ability' && selection.mode === 'stage' ? ` · ${t('Stage', '스테이지')} ${selection.stage}` : ''}`;

  for (const button of document.querySelectorAll('[data-menu-mode]')) {
    const id = button.dataset.menuMode;
    button.querySelector('strong').textContent = menuModeName(id);
    button.setAttribute('aria-pressed', String(id === selection.mode));
  }
  for (const button of document.querySelectorAll('[data-menu-difficulty]')) {
    const id = button.dataset.menuDifficulty;
    button.querySelector('strong').textContent = menuDifficultyName(id);
    button.setAttribute('aria-pressed', String(id === selection.difficulty));
  }
  const clearedCount = [1, 2, 3, 4, 5].filter(stage => stageRecords[`${selection.difficulty}:${stage}`]?.cleared).length;
  if ($('stage-count')) $('stage-count').textContent = t(`${clearedCount} / 5 cleared`, `${clearedCount} / 5 클리어`);
  for (const button of document.querySelectorAll('[data-menu-stage]')) {
    const stage = Number(button.dataset.menuStage);
    const cleared = !!stageRecords[`${selection.difficulty}:${stage}`]?.cleared;
    button.setAttribute('aria-pressed', String(stage === selection.stage));
    button.classList.toggle('is-cleared', cleared);
    button.querySelector('.stage-state').textContent = cleared ? '✓' : stage === 5 ? t('Boss', '보스') : t(String(stageTarget(stage)), `${stageTarget(stage)}회`);
    button.setAttribute('aria-label', `${t('Stage', '스테이지')} ${stage} · ${menuStageGoal(stage)}${cleared ? t(' · cleared', ' · 클리어') : ''}`);
  }

  const draftSkill = selection.skill || selectedSkill;
  for (const button of document.querySelectorAll('[data-menu-skill]')) {
    const id = button.dataset.menuSkill;
    button.setAttribute('aria-pressed', String(id === draftSkill));
    button.querySelector('.ability-name').textContent = menuText(MENU_SKILLS[id].name);
  }
  $('ability-description').textContent = menuText(MENU_SKILLS[draftSkill].description);
  $('ability-cost').textContent = t(`Charge: ${SKILLS[draftSkill].cost} eliminations`, `${SKILLS[draftSkill].cost}회 처치 시 충전`);
  $('ability-control').textContent = menuText(MENU_SKILLS[draftSkill].control);

  const recordNode = $('menu-record');
  if (recordNode) {
    let record = '';
    if (selection.mode === 'stage') {
      const best = stageRecords[`${selection.difficulty}:${selection.stage}`];
      if (best?.cleared) record = t(`Cleared · best ${best.bestVulnerability}% vulnerability`, `클리어 · 최저 취약률 ${best.bestVulnerability}%`);
      else if (best?.bestScore > 0) record = t(`Best: ${best.bestScore} eliminations`, `최고 기록: ${best.bestScore}회 방어`);
    } else if (endlessRecords[selection.difficulty] > 0) {
      record = t(`Best: ${endlessRecords[selection.difficulty]} eliminations`, `최고 기록: ${endlessRecords[selection.difficulty]}회 방어`);
    }
    recordNode.textContent = record;
    recordNode.hidden = !record || (menuScreen !== 'stage' && menuScreen !== 'ability');
  }

  const paused = mode === 'paused' && !!activeRun;
  $('menu-resume-panel').hidden = !paused || menuScreen !== 'home';
  $('menu-resume').textContent = t('Resume', '이어하기');
  $('menu-resume-copy').textContent = paused
    ? `${menuModeName(activeRun.mode)} · ${menuDifficultyName(activeRun.difficulty)}${activeRun.mode === 'stage' ? ` · ${t('Stage', '스테이지')} ${activeRun.stage}` : ''} · ${t(`${score} eliminations`, `${score}회 방어`)}`
    : '';
  $('menu-start').textContent = paused ? t('New game', '새 게임') : t('Start', '시작');
  $('menu-start-note').hidden = !paused;
  $('menu-start-note').textContent = paused ? t('Replaces the paused game.', '진행 중인 게임이 초기화됩니다.') : '';
}

function setMenuScreen(name) {
  if (!['home', 'mode', 'difficulty', 'stage', 'ability', 'settings'].includes(name)) return;
  menuScreen = name;
  refreshMenu();
  $('menu-title').setAttribute('tabindex', '-1');
  $('menu-title').focus({preventScroll: true});
  window.scrollTo?.(0, 0);
}

function menuBack() {
  const previous = {
    mode: 'home',
    difficulty: 'mode',
    stage: 'difficulty',
    ability: runSelection.mode === 'stage' ? 'stage' : 'difficulty',
    settings: 'home'
  };
  if (previous[menuScreen]) setMenuScreen(previous[menuScreen]);
}

function showGameView() {
  $('main-menu').hidden = true;
  $('game-view').hidden = false;
  $('menu-open').hidden = false;
  window.scrollTo?.(0, 0);
  requestAnimationFrame(fitConsole);
}

function showMenuView() {
  $('game-view').hidden = true;
  $('main-menu').hidden = false;
  $('menu-open').hidden = true;
  setMenuScreen('home');
}

$('menu-play').addEventListener('click', () => setMenuScreen('mode'));
$('menu-settings').addEventListener('click', () => setMenuScreen('settings'));
$('menu-back').addEventListener('click', menuBack);
for (const button of document.querySelectorAll('[data-menu-mode]')) {
  button.addEventListener('click', () => {
    runSelection.mode = button.dataset.menuMode;
    setMenuScreen('difficulty');
  });
}
for (const button of document.querySelectorAll('[data-menu-difficulty]')) {
  button.addEventListener('click', () => {
    runSelection.difficulty = button.dataset.menuDifficulty;
    setMenuScreen(runSelection.mode === 'stage' ? 'stage' : 'ability');
  });
}
for (const button of document.querySelectorAll('[data-menu-stage]')) {
  button.addEventListener('click', () => {
    runSelection.stage = Number(button.dataset.menuStage);
    setMenuScreen('ability');
  });
}
for (const button of document.querySelectorAll('[data-menu-skill]')) {
  button.addEventListener('click', () => {
    runSelection.skill = button.dataset.menuSkill;
    if (mode !== 'running' && mode !== 'paused') selectSkill(runSelection.skill);
    refreshMenu();
  });
}
$('menu-open').addEventListener('click', returnToMenu);
$('menu-start').addEventListener('click', launchRun);
$('menu-resume').addEventListener('click', continueRun);
document.addEventListener('keydown', event => {
  if ($('main-menu').hidden || $('help-dialog').open || event.code !== 'Escape' || event.repeat) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
  if (document.fullscreenElement || $('game-shell').classList.contains('expanded')) {
    event.preventDefault();
    leaveFullscreen();
    return;
  }
  if (menuScreen !== 'home') {
    event.preventDefault();
    menuBack();
  }
});
showMenuView();
