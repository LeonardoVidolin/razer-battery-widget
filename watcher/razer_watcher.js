const fs = require('fs');
const path = require('path');
const { WatcherV3 } = require('./watcherV3');
const { WatcherV4, SynapseV4LogDir, SYSTRAY_LOG_RE } = require('./watcherV4');
const { WatchProcess } = require('./watch_process');

class RazerWatcher {
  constructor(onDeviceUpdate) {
    this.onDeviceUpdate = onDeviceUpdate;
    this.devices = new Map();
    this.process = null;
  }

  initialize() {
    this.onDeviceUpdate(this.devices);
  }

  start() {
    this.process && this.process.stop();
    const v4Candidates = this.getV4Candidates();
    if (v4Candidates.length > 0) {
      this.process = new (require('./watcherV4').WatcherV4)((devices) => {
        this.devices = devices;
        this.onDeviceUpdate(devices);
      });
    } else {
      this.process = new (require('./watcherV3').WatcherV3)((devices) => {
        this.devices = devices;
        this.onDeviceUpdate(devices);
      });
    }
    this.process.devices = this.devices;
    this.process.start();
  }

  stop() {
    this.process && this.process.stop();
    this.process = null;
  }

  listDevices() {
    const list = Array.from(this.devices.values()).filter((d) => (d.name || '').trim().length > 0);
    // Synapse sometimes emits two entries for the same model (e.g. different ids); prefer the row with a real battery % over 0%.
    const byName = new Map();
    for (const d of list) {
      const k = d.name.trim().toLowerCase();
      const prev = byName.get(k);
      if (!prev) {
        byName.set(k, d);
        continue;
      }
      const pa = Number(prev.batteryPercentage) || 0;
      const pb = Number(d.batteryPercentage) || 0;
      if (pa === 0 && pb > 0) byName.set(k, d);
      else if (pb === 0 && pa > 0) byName.set(k, prev);
      else if (pb > pa) byName.set(k, d);
    }
    return [...byName.values()];
  }

  /** Force re-discover log (if needed) and immediate re-read, then push updated devices. */
  async refresh() {
    if (!this.process) return;
    if (typeof this.process.fullRefresh === 'function') {
      await this.process.fullRefresh();
    } else if (typeof this.process.onLogChanged === 'function') {
      await this.process.onLogChanged(true);
    }
  }

  getV4Candidates() {
    try {
      if (!fs.existsSync(SynapseV4LogDir)) return [];
      return fs.readdirSync(SynapseV4LogDir).filter((x) => SYSTRAY_LOG_RE.test(x));
    } catch (_) {
      return [];
    }
  }
}

module.exports = { RazerWatcher };
