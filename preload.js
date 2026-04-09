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
});
