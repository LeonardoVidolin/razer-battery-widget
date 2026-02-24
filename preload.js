const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDevices: () => ipcRenderer.invoke('get-devices'),
  onDevicesUpdate: (cb) => {
    ipcRenderer.on('devices-update', (_e, list) => cb(list));
  },
});
