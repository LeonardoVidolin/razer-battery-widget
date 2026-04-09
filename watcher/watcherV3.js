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

/** Synapse 3 usual layout: Name then Handle then "level N state M". */
const BATTERY_STRICT_RX =
  /^(?<timestamp>.+?) INFO[\s\S]*?_OnBatteryLevelChanged[\s\S]*?Name:\s*(?<name>.*?)[\s\S]*?Handle:\s*(?<handle>\d+)[\s\S]*?level\s*(?<level>\d+)\s+state\s*(?<isCharging>\d+)/gim;

/** Some builds / devices (e.g. wireless headsets) log Handle before Name or omit state; order in log may differ. */
const BATTERY_LOOSE_RX =
  /^(?<timestamp>.+?) INFO[\s\S]*?_OnBatteryLevelChanged[\s\S]*?Handle:\s*(?<handle>\d+)[\s\S]*?Name:\s*(?<name>[^\r\n]+?)[\s\S]*?level\s*(?<level>\d+)(?:\s+state\s*(?<isCharging>\d+))?/gim;

function extractSynapse3BatteryRows(log) {
  const rows = [];
  function run(rx) {
    let m;
    const re = new RegExp(rx.source, rx.flags);
    while ((m = re.exec(log))) {
      const level = parseInt(m.groups.level, 10);
      if (!Number.isFinite(level)) continue;
      const isCharging =
        m.groups.isCharging !== undefined && m.groups.isCharging !== ''
          ? parseInt(m.groups.isCharging, 10) !== 0
          : false;
      rows.push({
        handle: m.groups.handle,
        name: (m.groups.name || '').replace(/\s+/g, ' ').trim(),
        level,
        isCharging,
        index: m.index,
      });
    }
  }
  run(BATTERY_STRICT_RX);
  run(BATTERY_LOOSE_RX);
  rows.sort((a, b) => a.index - b.index);
  const seenAtIndex = new Set();
  const deduped = rows.filter((r) => {
    if (seenAtIndex.has(r.index)) return false;
    seenAtIndex.add(r.index);
    return true;
  });
  const byHandle = new Map();
  for (const r of deduped) {
    if (!byHandle.has(r.handle)) byHandle.set(r.handle, []);
    byHandle.get(r.handle).push(r);
  }
  return byHandle;
}

/**
 * Synapse sometimes appends a spurious 0% right after a valid reading for the same handle.
 * If the last line says 0 but the previous event is still nearby in the log and had a sane level, keep that level.
 */
function resolveBatteryFromEvents(events) {
  if (!events || events.length === 0) return null;
  const last = events[events.length - 1];
  if (events.length >= 2 && last.level === 0) {
    const prev = events[events.length - 2];
    const gap = last.index - prev.index;
    if (prev.level >= 12 && gap >= 0 && gap < 12000) {
      return {
        name: last.name || prev.name,
        level: prev.level,
        isCharging: last.isCharging,
      };
    }
  }
  return { name: last.name, level: last.level, isCharging: last.isCharging };
}

/** How often we re-read the Synapse log and push battery updates (matches user preference). */
const BATTERY_UPDATE_MS = 30 * 1000;

class WatcherV3 extends WatchProcess {
  constructor(onDeviceUpdate) {
    super(onDeviceUpdate);
    this.watcher = null;
    this.retryTimeout = null;
    this.pollInterval = null;
    this._logReadBusy = false;
    this._logReadPending = false;
  }

  start() {
    try {
      this.stop();
      const throttled = throttle(() => this.onLogChanged(), BATTERY_UPDATE_MS, { leading: true });
      this.watcher = fs.watch(SynapseV3LogPath, throttled);
      this.onLogChanged();
      this.pollInterval = setInterval(() => this.onLogChanged(), BATTERY_UPDATE_MS);
    } catch (e) {
      console.warn('WatcherV3 init error:', e.message);
      this.retryTimeout = setTimeout(() => this.start(), 5000);
    }
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  async fullRefresh() {
    await this.onLogChanged();
  }

  async onLogChanged() {
    if (this._logReadBusy) {
      this._logReadPending = true;
      return;
    }
    this._logReadBusy = true;
    try {
      do {
        this._logReadPending = false;
        await this._readLogAndNotify();
      } while (this._logReadPending);
    } finally {
      this._logReadBusy = false;
    }
  }

  async _readLogAndNotify() {
    const deviceLoadedRegex = /^(?<timestamp>.+?) INFO[\s\S]*?_OnDeviceLoaded[\s\S]*?Name: (?<name>.*)[\s\S]*?Handle: (?<handle>\d+)/gm;
    const deviceRemovedRegex = /^(?<timestamp>.+?) INFO[\s\S]*?_OnDeviceRemoved[\s\S]*?Name: (?<name>.*)[\s\S]*?Handle: (?<handle>\d+)/gm;

    try {
      const log = await fsp.readFile(SynapseV3LogPath, { encoding: 'utf8' });

      const byHandle = extractSynapse3BatteryRows(log);
      for (const [handle, events] of byHandle) {
        const resolved = resolveBatteryFromEvents(events);
        if (!resolved) continue;
        this.devices.set(handle, {
          name: (resolved.name || '').trim(),
          handle,
          batteryPercentage: Math.max(0, Math.min(100, resolved.level)),
          isCharging: !!resolved.isCharging,
          isConnected: false,
        });
      }

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

      const chargingHandles = [...this.devices.entries()].filter(([, d]) => d.isCharging).map(([h]) => h);
      if (chargingHandles.length > 1) {
        const withLevel = chargingHandles.map((h) => ({ handle: h, pct: this.devices.get(h).batteryPercentage }));
        withLevel.sort((a, b) => b.pct - a.pct);
        const onlyHandle = withLevel[0].handle;
        for (const [handle, device] of this.devices) {
          device.isCharging = handle === onlyHandle;
        }
      }

      this.onDeviceUpdate(this.devices);
    } catch (e) {
      console.warn('WatcherV3 read error:', e.message);
    }
  }
}

module.exports = { WatcherV3, SynapseV3LogPath };
