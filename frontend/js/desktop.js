'use strict';

(() => {
  const desktop = window.neonDesktop;
  if (!desktop?.isDesktop) return;
  let nativeFullscreen = false;

  function updateFullscreen(active) {
    nativeFullscreen = active;
    document.getElementById('game-shell').classList.toggle('expanded', active);
    document.body.classList.toggle('expanded', active);
    updateFullscreenButton();
    requestAnimationFrame(fitConsole);
  }

  const fullscreen = document.getElementById('fullscreen');
  fullscreen.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    desktop.toggleFullscreen().then(updateFullscreen).catch(() => {});
  }, {capture: true});

  window.addEventListener('keydown', event => {
    if (event.code !== 'Escape' || event.repeat || !nativeFullscreen) return;
    if ((document.getElementById('help-dialog').open||document.getElementById('patch-dialog').open)) return;
    if (event.target.closest('input,textarea,select,[contenteditable]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    desktop.setFullscreen(false).then(updateFullscreen).catch(() => {});
  }, {capture: true});

  function updateLabels() {
    document.getElementById('share').textContent = t('Copy score', '기록 복사');
  }
  document.getElementById('language').addEventListener('change', updateLabels);
  updateLabels();
  desktop.onFullscreenChanged(updateFullscreen);
  desktop.getFullscreen().then(updateFullscreen).catch(() => {});
})();
