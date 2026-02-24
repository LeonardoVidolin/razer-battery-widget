class WatchProcess {
  constructor(onDeviceUpdate) {
    this.onDeviceUpdate = onDeviceUpdate;
    this.devices = new Map();
  }

  stop() {}
  start() {}
}

module.exports = { WatchProcess };
