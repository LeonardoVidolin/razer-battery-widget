const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDevices: () => ipcRenderer.invoke('get-devices'),
  refreshDevices: () => ipcRenderer.invoke('refresh-devices'),
  getAudioLevels: () => ipcRenderer.invoke('get-audio-levels'),
  setAudioLevels: (payload) => ipcRenderer.invoke('set-audio-levels', payload),
  onDevicesUpdate: (cb) => {
    ipcRenderer.on('devices-update', (_e, list) => cb(list));
  },
  onAudioLevelsUpdate: (cb) => {
    ipcRenderer.on('audio-levels-update', (_e, data) => cb(data));
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setVolumePanelVisible: (visible) => ipcRenderer.invoke('set-volume-panel-visible', visible),
  startWindowResize: (edge) => ipcRenderer.send('window-resize-start', edge),
  updateWindowResize: (screenX, screenY) =>
    ipcRenderer.send('window-resize-move', { x: screenX, y: screenY }),
  endWindowResize: () => ipcRenderer.send('window-resize-end'),
});
