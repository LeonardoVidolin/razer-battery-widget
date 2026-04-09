const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { RazerWatcher } = require('./watcher/razer_watcher');
const { readWindowsAudioLevels, setWindowsAudioLevels } = require('./lib/read_windows_audio');

// Use a local userData folder in dev so cache/settings aren't blocked (e.g. "Access is denied")
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getAppPath(), '.electron-userdata'));
}

let mainWindow = null;
let razerWatcher = null;
let tray = null;
let isQuitting = false;
let audioLevelsTimer = null;
let devicesPushTimer = null;
let alwaysOnTopPollTimer = null;
const AUDIO_LEVELS_POLL_MS = 2000;
const DEVICES_POLL_MS = 30 * 1000;
const ALWAYS_ON_TOP_REAPPLY_MS = 2500;
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
    return { ...defaultSettings(), ...JSON.parse(data) };
  } catch (_) {
    return defaultSettings();
  }
}

function defaultSettings() {
  return { openAtLogin: true, alwaysOnTop: true };
}

function saveSettings(settings) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not save settings:', e.message);
  }
}

/** Windows Z-order levels (Electron): higher tiers beat games/fullscreen better; fallback if one fails. */
const WIN32_ALWAYS_ON_TOP_LEVELS = ['screen-saver', 'pop-up-menu', 'floating'];

function applyAlwaysOnTopWin32(enabled) {
  if (!enabled) {
    mainWindow.setAlwaysOnTop(false);
    return;
  }
  for (const level of WIN32_ALWAYS_ON_TOP_LEVELS) {
    try {
      mainWindow.setAlwaysOnTop(true, level);
      return;
    } catch (_) {}
  }
  try {
    mainWindow.setAlwaysOnTop(true);
  } catch (e) {
    console.warn('applyAlwaysOnTopWin32:', e.message);
  }
}

function applyAlwaysOnTopToMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const on = !!loadSettings().alwaysOnTop;
  try {
    if (process.platform === 'win32') {
      applyAlwaysOnTopWin32(on);
    } else {
      mainWindow.setAlwaysOnTop(on);
    }
  } catch (e) {
    console.warn('applyAlwaysOnTopToMainWindow:', e.message);
  }
}

function showWidgetWithoutStealingFocus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (typeof mainWindow.showInactive === 'function') mainWindow.showInactive();
  else mainWindow.show();
  applyAlwaysOnTopToMainWindow();
}

function pushDevicesToRenderer() {
  if (isQuitting || !razerWatcher) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const wc = mainWindow.webContents;
    if (wc.isDestroyed()) return;
    wc.send('devices-update', razerWatcher.listDevices());
  } catch (e) {
    console.warn('pushDevicesToRenderer:', e.message);
  }
}

async function tickDevicesFromMain() {
  if (!razerWatcher || isQuitting) return;
  try {
    await razerWatcher.refresh();
  } catch (e) {
    console.warn('tickDevicesFromMain:', e.message);
  }
  pushDevicesToRenderer();
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showWidgetWithoutStealingFocus();
    return;
  }

  const winAlwaysOnTop = !!loadSettings().alwaysOnTop;
  mainWindow = new BrowserWindow({
    width: 440,
    height: 292,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: winAlwaysOnTop,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    showWidgetWithoutStealingFocus();
  });
  mainWindow.on('show', () => applyAlwaysOnTopToMainWindow());
  mainWindow.webContents.once('did-finish-load', () => {
    pushDevicesToRenderer();
    applyAlwaysOnTopToMainWindow();
  });
  mainWindow.loadFile('index.html');
  mainWindow.setIgnoreMouseEvents(false);

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let icon = null;
  try {
    const buf = fs.readFileSync(iconPath);
    if (buf && buf.length > 0) {
      icon = nativeImage.createFromBuffer(buf);
      if (!icon.isEmpty() && process.platform === 'win32') {
        icon = icon.resize({ width: 16, height: 16 });
      }
    }
  } catch (_) {}
  if (!icon || icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Razer Battery Widget');
  tray.on('double-click', () => createWindow());
  updateTrayMenu();
}

function updateTrayMenu() {
  const settings = loadSettings();
  const menu = Menu.buildFromTemplate([
    { label: 'Show Widget', type: 'normal', click: () => createWindow() },
    { type: 'separator' },
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: !!settings.alwaysOnTop,
      click: (item) => {
        const next = { ...loadSettings(), alwaysOnTop: item.checked };
        saveSettings(next);
        applyAlwaysOnTopToMainWindow();
      },
    },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: settings.openAtLogin,
      click: (item) => {
        const next = { ...loadSettings(), openAtLogin: item.checked };
        saveSettings(next);
        app.setLoginItemSettings({ openAtLogin: next.openAtLogin });
      },
    },
    { type: 'separator' },
    { label: 'Quit', type: 'normal', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  const settings = loadSettings();
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });

  razerWatcher = new RazerWatcher(() => pushDevicesToRenderer());
  razerWatcher.initialize();
  razerWatcher.start();
  // Extra reads at startup so headsets appear sooner (Synapse often logs them late)
  [400, 1500, 3000, 8000, 15000, 30000].forEach((ms) => {
    setTimeout(async () => {
      if (!razerWatcher || isQuitting) return;
      try {
        await razerWatcher.refresh();
      } catch (_) {}
      pushDevicesToRenderer();
    }, ms);
  });

  devicesPushTimer = setInterval(tickDevicesFromMain, DEVICES_POLL_MS);
  setTimeout(tickDevicesFromMain, 2500);

  function pushAudioLevels() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const levels = readWindowsAudioLevels(app);
    mainWindow.webContents.send('audio-levels-update', levels);
  }
  audioLevelsTimer = setInterval(pushAudioLevels, AUDIO_LEVELS_POLL_MS);
  setTimeout(pushAudioLevels, 500);

  createTray();
  createWindow();

  alwaysOnTopPollTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
    if (!loadSettings().alwaysOnTop) return;
    applyAlwaysOnTopToMainWindow();
  }, ALWAYS_ON_TOP_REAPPLY_MS);
});

app.on('window-all-closed', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  }
});

app.on('activate', () => {
  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (audioLevelsTimer) {
    clearInterval(audioLevelsTimer);
    audioLevelsTimer = null;
  }
  if (devicesPushTimer) {
    clearInterval(devicesPushTimer);
    devicesPushTimer = null;
  }
  if (alwaysOnTopPollTimer) {
    clearInterval(alwaysOnTopPollTimer);
    alwaysOnTopPollTimer = null;
  }
  if (tray) try { tray.destroy(); tray = null; } catch (_) {}
  if (razerWatcher) razerWatcher.stop();
  razerWatcher = null;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  mainWindow = null;
});

ipcMain.handle('get-audio-levels', () => readWindowsAudioLevels(app));
ipcMain.handle('set-audio-levels', (_, payload) => {
  const playbackPct =
    payload && Number.isFinite(payload.playback) ? Math.max(0, Math.min(100, Math.round(payload.playback))) : -1;
  const capturePct =
    payload && Number.isFinite(payload.capture) ? Math.max(0, Math.min(100, Math.round(payload.capture))) : -1;
  if (playbackPct < 0 && capturePct < 0) return readWindowsAudioLevels(app);
  const result = setWindowsAudioLevels(app, { playbackPct, capturePct });
  const out = result ?? readWindowsAudioLevels(app);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('audio-levels-update', out);
  }
  return out;
});
ipcMain.handle('get-devices', () => (razerWatcher ? razerWatcher.listDevices() : []));
ipcMain.handle('refresh-devices', async () => {
  if (razerWatcher) {
    await razerWatcher.refresh();
    pushDevicesToRenderer();
    return razerWatcher.listDevices();
  }
  return [];
});
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('set-open-at-login', (_, value) => {
  const settings = loadSettings();
  settings.openAtLogin = !!value;
  saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
});
ipcMain.handle('set-always-on-top', (_, value) => {
  const settings = loadSettings();
  settings.alwaysOnTop = !!value;
  saveSettings(settings);
  applyAlwaysOnTopToMainWindow();
  updateTrayMenu();
});
