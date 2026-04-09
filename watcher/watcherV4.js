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

/** Same pattern as razer_watcher.getV4Candidates (was v2-only here and could miss systray_systrayv3.log, etc.). */
const SYSTRAY_LOG_RE = /^systray_systrayv\d(\d*)\.log$/;

const REFRESH_INTERVAL_MS = 30 * 1000;

function readBatteryLevel(powerStatus) {
  if (!powerStatus || typeof powerStatus !== 'object') return null;
  const raw =
    powerStatus.level ??
    powerStatus.batteryLevel ??
    powerStatus.percent ??
    powerStatus.percentage;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }
  if (typeof raw === 'string') {
    const n = parseInt(String(raw).replace(/%/g, '').trim(), 10);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  }
  return null;
}

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
      this.pollInterval = setInterval(() => this.onLogChanged(true), REFRESH_INTERVAL_MS);
      this.onLogChanged();
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
      const candidates = fs.readdirSync(SynapseV4LogDir)
        .filter((x) => SYSTRAY_LOG_RE.test(x))
        .map((x) => {
          const num = (x.match(SYSTRAY_LOG_RE) || [])[1];
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

  /** Re-discover log file and force a full re-read (for refresh / late Synapse startup). */
  async fullRefresh() {
    this.findLatestLogFile();
    await this.onLogChanged(true);
  }

  async onLogChanged(forceRefresh = false) {
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
      if (!forceRefresh && this.latestParsedTimestamp === lastMatch.timestamp) return;
      this.latestParsedTimestamp = lastMatch.timestamp;

      const list = Array.isArray(devicesList) ? devicesList : [devicesList];
      const parsed = [];
      for (const x of list) {
        if (!x.powerStatus || typeof x.powerStatus !== 'object') continue;
        const rawLevel = readBatteryLevel(x.powerStatus);
        if (!x.hasBattery && rawLevel === null) continue;
        const handle = x.serialNumber || x.deviceContainerId || 'unknown';
        const name = (x.name && (x.name.en || x.name.en_US || Object.values(x.name)[0])) || 'Razer Device';
        const prev = this.devices.get(handle);
        let batteryPercentage = rawLevel;
        if (batteryPercentage === null && prev) batteryPercentage = prev.batteryPercentage;
        if (batteryPercentage === null) continue;
        const s = String(x.powerStatus.chargingStatus || '').toLowerCase().trim();
        const apiSaysCharging = s === 'charging' || s === 'charge';
        parsed.push({
          handle,
          name,
          batteryPercentage,
          apiSaysCharging,
        });
      }
      // Synapse often reports "charging" for all devices; show lightning only for one. Prefer the one with highest battery (likely the one plugged in and full).
      const chargingCandidates = parsed.filter((d) => d.apiSaysCharging);
      const onlyOneChargingHandle =
        chargingCandidates.length > 1
          ? (chargingCandidates.sort((a, b) => b.batteryPercentage - a.batteryPercentage)[0]?.handle ?? null)
          : chargingCandidates.length === 1
            ? chargingCandidates[0].handle
            : null;
      for (const d of parsed) {
        this.devices.set(d.handle, {
          name: d.name,
          handle: d.handle,
          batteryPercentage: d.batteryPercentage,
          isCharging: onlyOneChargingHandle === d.handle,
          isConnected: true,
        });
      }
      this.onDeviceUpdate(this.devices);
    } catch (e) {
      console.warn('WatcherV4 read error:', e.message);
    }
  }
}

module.exports = { WatcherV4, SynapseV4LogDir, SYSTRAY_LOG_RE };
