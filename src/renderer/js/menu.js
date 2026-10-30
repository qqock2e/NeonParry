'use strict';

let menuScreen = 'home';

const MENU_SKILLS = {
  vaccine: {
    name: ['Vaccine', '백신'],
    description: ['Recover 29 vulnerability points and stop the field for 0.3s, then accelerate over 0.9s.', '취약률을 29 회복하고 필드를 0.3초 정지한 뒤 0.9초간 재가속합니다.'],
    control: ['Space / ability button / lane swipe', 'Space / 능력 버튼 / 라인 스와이프']
  },
  proxy: {
    name: ['Proxy', '프록시'],
    description: ['Clear one lane and block new enemies there for 6 seconds, including dormant worms and either side of phishing.', '한 방향의 적을 지우고 6초 동안 새 적을 막습니다. 대기 웜·양쪽 피싱도 제거합니다.'],
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
  refreshPatchNotes();
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
  if ($('main-menu').hidden || ($('help-dialog').open||$('patch-dialog').open) || event.code !== 'Escape' || event.repeat) return;
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

function refreshPatchNotes(){
  $('patch-open').textContent=t('Patch notes · 1.0.2','패치노트 · 1.0.2');$('patch-title').textContent=$('patch-open').textContent;$('patch-close').textContent=t('Close ×','닫기 ×');
  $('patch-content').innerHTML=t(
    '<h3>1.0.2 · Light previews &amp; field stop</h3><ul><li>Dis-Troy: neon-pink gradient lights flash from the lane ends toward the center and fade out in spawn order before fragments appear.</li><li>Vaccine: 0.3s full field stop, then 0.9s acceleration back to normal (1.2s total). Healing remains 29 points; boss entry cancels the effect.</li></ul><h3>1.0.1 · Retained balance</h3><ul><li>Vaccine: 29-point heal, no knockback.</li><li>Proxy: 6s barrier. Clears dormant worms and phishing through either its decoy or real-target lane.</li><li>All skills locked throughout boss encounters, including entry cleanup. Entry clears Vaccine slow and Proxy barriers; existing Decoy shields remain.</li></ul><h3>Bosses</h3><ul><li>Fake Domain: numbered targets in all three other lanes. Follow 1–3; final round 1–9 with three numbers per lane. Wrong inputs add 4 points but preserve progress. Round success heals 5 points. Easy deadlines: 2.4 / 2.2 / 2.0 / 1.8 / 6.0 seconds; higher difficulties shorten these.</li><li>Dis-Troy: lanes preview split spawn order before fragments appear. Miss damage +10% (base 27.5 × remaining attempts × 0.5^depth); successful round healing 25 → 20 points.</li></ul><h3>Retry</h3><p>Choose any skill directly on the game-over or stage-clear screen, then Retry. Mode, stage and difficulty remain unchanged. The selected skill also carries to Next stage.</p>',
    '<h3>1.0.2 · 빛 예고·필드 정지</h3><ul><li>디스-트로이: 라인 끝에서 중심 쪽으로 옅어지는 네온핑크 그라데이션 빛이 생성 순서대로 번쩍인 뒤 페이드아웃됩니다.</li><li>백신: 필드 전체가 0.3초 정지한 뒤 0.9초간 정상 속도로 재가속합니다(총 1.2초). 회복 29%p 유지, 보스 진입 시 효과 해제.</li></ul><h3>1.0.1 · 유지된 밸런스</h3><ul><li>백신: 회복 24→29%p, 넉백 삭제.</li><li>프록시: 장벽 5→6초. 대기 웜 및 피싱의 미끼·본체 어느 쪽 라인에서도 제거할 수 있습니다.</li><li>보스 진입 정리부터 종료까지 모든 스킬 잠금. 진입 시 백신 둔화·프록시 장벽 제거, 미끼폴더 보호막 유지.</li></ul><h3>보스</h3><ul><li>페이크 도메인: 나머지 세 라인의 숫자 1→3 순서로 패링. 마지막은 라인당 3개씩 배정된 숫자 1→9. 오입력은 취약률 +4%p이며 진행 유지, 성공마다 −5%p. 쉬움 제한시간은 2.4 / 2.2 / 2.0 / 1.8 / 6.0초이며 상위 난이도에서는 짧아집니다.</li><li>디스-트로이: 분열 생성 전에 라인이 생성 순서대로 빛납니다. 실패 피해 +10%(기본 27.5×남은 시도횟수×0.5^단계), 패턴 성공 회복 25→20%p.</li></ul><h3>재도전</h3><p>게임 종료·스테이지 클리어 화면에서 스킬을 바로 고르고 재도전하세요. 모드·난이도·스테이지는 유지됩니다. 다음 스테이지에도 선택한 스킬이 적용됩니다.</p>');
}
$('patch-open').addEventListener('click',()=>{pauseGame();pointers.clear();refreshPatchNotes();$('patch-dialog').showModal();});
$('patch-close').addEventListener('click',()=>$('patch-dialog').close());
