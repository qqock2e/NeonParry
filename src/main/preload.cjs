'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const versionArgument = process.argv.find(argument => argument.startsWith('--neon-parry-version='));
const version = versionArgument ? decodeURIComponent(versionArgument.slice('--neon-parry-version='.length)) : '';

contextBridge.exposeInMainWorld('neonDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  version,
  getFullscreen: () => ipcRenderer.invoke('desktop:get-fullscreen'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop:toggle-fullscreen'),
  setFullscreen: value => {
    if (typeof value !== 'boolean') return Promise.reject(new TypeError('Fullscreen must be a boolean.'));
    return ipcRenderer.invoke('desktop:set-fullscreen', value);
  },
  copyScore: text => {
    if (typeof text !== 'string' || text.length > 200 ||
        !/^Neon Parry · (?:Best: \d+ eliminations!|최고 \d+회 방어!)$/.test(text)) {
      return Promise.reject(new TypeError('Invalid score text.'));
    }
    return ipcRenderer.invoke('desktop:copy-score', text);
  },
  onFullscreenChanged: callback => {
    if (typeof callback !== 'function') throw new TypeError('A fullscreen callback is required.');
    const listener = (_event, value) => {
      if (typeof value === 'boolean') callback(value);
    };
    ipcRenderer.on('desktop:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('desktop:fullscreen-changed', listener);
  },
}));
