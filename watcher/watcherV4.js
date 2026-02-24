const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { WatchProcess } = require('./watch_process');

const SynapseV4LogDir = path.resolve(
  process.env.LOCALAPPDATA || '',
  'Razer',
  'RazerAppEngine',
  'User Data',
  'Logs'
);

class WatcherV4 extends WatchProcess {
  constructor(onDeviceUpdate) {
    super(onDeviceUpdate);
    this.watcher = null;
    this.synapseV4LogPath = null;
    this.retryTimeout = null;
    this.pollInterval = null;
    this.latestParsedTimestamp = '';
  }

  start() {
    try {
      this.stop();
      this.findLatestLogFile();
      if (!this.synapseV4LogPath) throw new Error('V4 log path not found');
      const poll = () => this.onLogChanged();
      this.pollInterval = setInterval(poll, 3000);
      poll();
    } catch (e) {
      console.warn('WatcherV4 init error:', e.message);
      this.retryTimeout = setTimeout(() => this.start(), 5000);
    }
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.synapseV4LogPath = null;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  findLatestLogFile() {
    this.synapseV4LogPath = null;
    try {
      if (!fs.existsSync(SynapseV4LogDir)) return;
      const fileNameRegex = /^systray_systrayv2(\d*).log$/;
      const candidates = fs.readdirSync(SynapseV4LogDir)
        .filter((x) => fileNameRegex.test(x))
        .map((x) => {
          const num = (x.match(fileNameRegex) || [])[1];
          return {
            fileName: x,
            modifyTime: fs.statSync(path.resolve(SynapseV4LogDir, x)).mtime,
            index: num === '' ? -1 : parseInt(num, 10),
          };
        });
      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.index || 0) - (a.index || 0));
        this.synapseV4LogPath = path.resolve(SynapseV4LogDir, candidates[0].fileName);
      }
    } catch (e) {
      console.warn('WatcherV4 find log error:', e.message);
    }
  }

  async onLogChanged() {
    if (!this.synapseV4LogPath) return;
    const batteryStateRegex = /^\[(?<timestamp>.+?)\].*connectingDeviceData: (?<json>.+)$/gm;
    try {
      const log = await fsp.readFile(this.synapseV4LogPath, { encoding: 'utf8' });
      const matches = [];
      let m;
      while ((m = batteryStateRegex.exec(log))) {
        matches.push({ timestamp: m.groups.timestamp, jsonStr: m.groups.json });
      }
      const lastMatch = matches[matches.length - 1];
      if (!lastMatch) return;
      let devicesList;
      try {
        devicesList = JSON.parse(lastMatch.jsonStr);
      } catch (_) {
        return;
      }
      if (this.latestParsedTimestamp === lastMatch.timestamp) return;
      this.latestParsedTimestamp = lastMatch.timestamp;

      const list = Array.isArray(devicesList) ? devicesList : [devicesList];
      for (const x of list) {
        if (!x.hasBattery || !x.powerStatus) continue;
        const handle = x.serialNumber || x.deviceContainerId || 'unknown';
        const name = (x.name && (x.name.en || x.name.en_US || Object.values(x.name)[0])) || 'Razer Device';
        this.devices.set(handle, {
          name,
          handle,
          batteryPercentage: typeof x.powerStatus.level === 'number' ? x.powerStatus.level : 0,
          isCharging: String(x.powerStatus.chargingStatus || '').toLowerCase() === 'charging',
          isConnected: true,
        });
      }
      this.onDeviceUpdate(this.devices);
    } catch (e) {
      console.warn('WatcherV4 read error:', e.message);
    }
  }
}

module.exports = { WatcherV4, SynapseV4LogDir };
