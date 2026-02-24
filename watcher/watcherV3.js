const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { WatchProcess } = require('./watch_process');

const SynapseV3LogPath = path.resolve(
  process.env.LOCALAPPDATA || '',
  'Razer',
  'Synapse3',
  'Log',
  'Razer Synapse 3.log'
);

function throttle(fn, ms, opts = {}) {
  let last = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0 && opts.leading !== false) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = opts.leading === false ? 0 : Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

function getLastMatchByHandle(regex, text) {
  const map = new Map();
  let m;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(text))) {
    const handle = m.groups.handle;
    map.set(handle, m);
  }
  return map;
}

class WatcherV3 extends WatchProcess {
  constructor(onDeviceUpdate) {
    super(onDeviceUpdate);
    this.watcher = null;
    this.retryTimeout = null;
  }

  start() {
    try {
      this.stop();
      const throttled = throttle(() => this.onLogChanged(), 3000, { leading: true });
      this.watcher = fs.watch(SynapseV3LogPath, throttled);
      this.onLogChanged();
    } catch (e) {
      console.warn('WatcherV3 init error:', e.message);
      this.retryTimeout = setTimeout(() => this.start(), 5000);
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  async onLogChanged() {
    const batteryStateRegex = /^(?<timestamp>.+?) INFO[\s\S]*?_OnBatteryLevelChanged[\s\S]*?Name: (?<name>.*)[\s\S]*?Handle: (?<handle>\d+)[\s\S]*?level (?<level>\d+) state (?<isCharging>\d+)/gm;
    const deviceLoadedRegex = /^(?<timestamp>.+?) INFO[\s\S]*?_OnDeviceLoaded[\s\S]*?Name: (?<name>.*)[\s\S]*?Handle: (?<handle>\d+)/gm;
    const deviceRemovedRegex = /^(?<timestamp>.+?) INFO[\s\S]*?_OnDeviceRemoved[\s\S]*?Name: (?<name>.*)[\s\S]*?Handle: (?<handle>\d+)/gm;

    try {
      const log = await fsp.readFile(SynapseV3LogPath, { encoding: 'utf8' });

      const batteryMatches = getLastMatchByHandle(batteryStateRegex, log);
      for (const [handle, m] of batteryMatches) {
        const { name, level, isCharging } = m.groups;
        this.devices.set(handle, {
          name: (name || '').trim(),
          handle,
          batteryPercentage: parseInt(level, 10) || 0,
          isCharging: parseInt(isCharging, 10) !== 0,
          isConnected: false,
        });
      }

      const loadedByHandle = getLastMatchByHandle(deviceLoadedRegex, log);
      const removedByHandle = getLastMatchByHandle(deviceRemovedRegex, log);
      const loadedIndices = new Map();
      const removedIndices = new Map();
      let m;
      const reLoaded = new RegExp(deviceLoadedRegex.source, 'gm');
      while ((m = reLoaded.exec(log))) loadedIndices.set(m.groups.handle, m.index);
      const reRemoved = new RegExp(deviceRemovedRegex.source, 'gm');
      while ((m = reRemoved.exec(log))) removedIndices.set(m.groups.handle, m.index);
      for (const [handle, device] of this.devices) {
        const li = loadedIndices.get(handle) ?? -1;
        const ri = removedIndices.get(handle) ?? -1;
        device.isConnected = li > ri;
      }

      this.onDeviceUpdate(this.devices);
    } catch (e) {
      console.warn('WatcherV3 read error:', e.message);
    }
  }
}

module.exports = { WatcherV3, SynapseV3LogPath };
