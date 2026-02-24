const fs = require('fs');
const path = require('path');
const { WatcherV3 } = require('./watcherV3');
const { WatcherV4, SynapseV4LogDir } = require('./watcherV4');
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
    return Array.from(this.devices.values()).filter((d) => d.isConnected);
  }

  getV4Candidates() {
    try {
      if (!fs.existsSync(SynapseV4LogDir)) return [];
      const fileNameRegex = /^systray_systrayv\d(\d*).log$/;
      return fs.readdirSync(SynapseV4LogDir).filter((x) => fileNameRegex.test(x));
    } catch (_) {
      return [];
    }
  }
}

module.exports = { RazerWatcher };
