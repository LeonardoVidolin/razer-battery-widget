const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { RazerWatcher } = require('./watcher/razer_watcher');
const { readWindowsAudioLevels, setWindowsAudioLevels } = require('./lib/read_windows_audio');

// Use a local userData folder in dev so cache/settings aren't blocked (e.g. "Access is denied")
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getAppPath(), '.electron-userdata'));
}

let mainWindow = null;
let windowResizeSession = null;
/** Height the window had before opening the volume panel forced it taller (restored on close). */
let heightBeforeVolumeExpand = null;

/** Default / design size (also used for 50% minimum math). */
const DEFAULT_WINDOW_WIDTH = 440;
const DEFAULT_WINDOW_HEIGHT = 292;
const MIN_WINDOW_WIDTH = Math.round(DEFAULT_WINDOW_WIDTH * 0.5);
const MIN_WINDOW_HEIGHT_COLLAPSED = Math.round(DEFAULT_WINDOW_HEIGHT * 0.5);
/** When volume panel is visible: min height to avoid overlap (~20% below previous 332px cap). */
const MIN_WINDOW_HEIGHT_VOLUME_OPEN = 266;

const RESIZE_MAX_W = 2400;
const RESIZE_MAX_H = 1800;

function getWindowMinimumHeight() {
  const s = loadSettings();
  return s.volumePanelVisible !== false ? MIN_WINDOW_HEIGHT_VOLUME_OPEN : MIN_WINDOW_HEIGHT_COLLAPSED;
}

function getResizeMinimums() {
  return { w: MIN_WINDOW_WIDTH, h: getWindowMinimumHeight() };
}

function applyWindowMinimumConstraints() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const minW = MIN_WINDOW_WIDTH;
  const minH = getWindowMinimumHeight();
  mainWindow.setMinimumSize(minW, minH);
  const b = mainWindow.getBounds();
  let { x, y, width, height } = b;
  let changed = false;
  if (width < minW) {
    width = minW;
    changed = true;
  }
  if (height < minH) {
    height = minH;
    changed = true;
  }
  if (changed) mainWindow.setBounds({ x, y, width, height }, false);
}

function computeResizedBounds(orig, edge, dx, dy) {
  const { w: RESIZE_MIN_W, h: RESIZE_MIN_H } = getResizeMinimums();
  let x = orig.x;
  let y = orig.y;
  let width = orig.width;
  let height = orig.height;
  const e = String(edge || '');

  if (e.includes('n')) {
    let newH = orig.height - dy;
    newH = Math.min(RESIZE_MAX_H, Math.max(RESIZE_MIN_H, newH));
    y = orig.y + orig.height - newH;
    height = newH;
  }
  if (e.includes('s')) {
    height = Math.min(RESIZE_MAX_H, Math.max(RESIZE_MIN_H, orig.height + dy));
  }
  if (e.includes('w')) {
    let newW = orig.width - dx;
    newW = Math.min(RESIZE_MAX_W, Math.max(RESIZE_MIN_W, newW));
    x = orig.x + orig.width - newW;
    width = newW;
  }
  if (e.includes('e')) {
    width = Math.min(RESIZE_MAX_W, Math.max(RESIZE_MIN_W, orig.width + dx));
  }

  return { x, y, width, height };
}
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
    const defaults = defaultSettings();
    const parsed = JSON.parse(data);
    return {
      ...defaults,
      ...parsed,
      deviceVisibility: { ...defaults.deviceVisibility, ...(parsed.deviceVisibility || {}) },
    };
  } catch (_) {
    return defaultSettings();
  }
}

function defaultSettings() {
  return {
    openAtLogin: true,
    alwaysOnTop: true,
    volumePanelVisible: true,
    deviceVisibility: { headphones: true, keyboard: true, mouse: true },
    deviceTrayIcons: true,
    windowBounds: null,
  };
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

  const settingsForWin = loadSettings();
  const winAlwaysOnTop = !!settingsForWin.alwaysOnTop;
  const wb = settingsForWin.windowBounds;
  const minW0 = MIN_WINDOW_WIDTH;
  const minH0 = getWindowMinimumHeight();
  let winW = DEFAULT_WINDOW_WIDTH;
  let winH = DEFAULT_WINDOW_HEIGHT;
  let winX;
  let winY;
  if (wb && typeof wb.width === 'number' && typeof wb.height === 'number') {
    winW = Math.max(minW0, Math.min(2000, Math.round(wb.width)));
    winH = Math.max(minH0, Math.min(1600, Math.round(wb.height)));
    if (typeof wb.x === 'number' && typeof wb.y === 'number') {
      winX = Math.round(wb.x);
      winY = Math.round(wb.y);
    }
  }
  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    x: winX,
    y: winY,
    minWidth: minW0,
    minHeight: minH0,
    frame: false,
    transparent: true,
    resizable: true,
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
  mainWindow.on('show', () => {
    applyAlwaysOnTopToMainWindow();
    applyWindowMinimumConstraints();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    pushDevicesToRenderer();
    applyAlwaysOnTopToMainWindow();
    applyWindowMinimumConstraints();
  });
  mainWindow.loadFile('index.html');
  mainWindow.setIgnoreMouseEvents(false);

  // Right-click on the drag region never reaches the page (it's treated as window caption),
  // so catch it here and let the renderer open the in-app context menu at the cursor.
  mainWindow.on('system-context-menu', (event) => {
    event.preventDefault();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const b = mainWindow.getBounds();
    mainWindow.focus();
    try {
      mainWindow.webContents.send('open-context-menu-at', { x: cursor.x - b.x, y: cursor.y - b.y });
    } catch (_) {}
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  let boundsSaveTimer = null;
  function scheduleSaveWindowBounds() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const b = mainWindow.getBounds();
      const s = loadSettings();
      saveSettings({
        ...s,
        windowBounds: { width: b.width, height: b.height, x: b.x, y: b.y },
      });
    }, 450);
  }
  mainWindow.on('resize', scheduleSaveWindowBounds);
  mainWindow.on('move', scheduleSaveWindowBounds);

  applyWindowMinimumConstraints();
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

function pushSettingsToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const wc = mainWindow.webContents;
    if (wc.isDestroyed()) return;
    wc.send('settings-update', loadSettings());
  } catch (e) {
    console.warn('pushSettingsToRenderer:', e.message);
  }
}

const DEVICE_SLOT_TYPES = [
  { key: 'headphones', label: 'Headphones' },
  { key: 'keyboard', label: 'Keyboard' },
  { key: 'mouse', label: 'Mouse' },
];

function setDeviceTypeVisible(typeKey, visible) {
  const settings = loadSettings();
  settings.deviceVisibility = { ...settings.deviceVisibility, [typeKey]: !!visible };
  saveSettings(settings);
  updateTrayMenu();
  pushSettingsToRenderer();
  return settings;
}

/** Per-device taskbar battery icons (rendered as canvas PNGs by the renderer). */
const deviceTrays = new Map(); // device handle -> Tray

function destroyDeviceTrays() {
  for (const t of deviceTrays.values()) {
    try {
      t.destroy();
    } catch (_) {}
  }
  deviceTrays.clear();
}

function setTrayIconsEnabled(enabled) {
  const settings = loadSettings();
  settings.deviceTrayIcons = !!enabled;
  saveSettings(settings);
  if (!settings.deviceTrayIcons) destroyDeviceTrays();
  updateTrayMenu();
  // Re-render in the widget re-sends fresh icons when turning back on.
  pushSettingsToRenderer();
}

/** Native menus always close on click; reopen right away so toggling several devices is quick. */
function reopenTrayMenu() {
  if (!tray) return;
  setTimeout(() => {
    if (!tray || isQuitting) return;
    try {
      tray.popUpContextMenu();
    } catch (_) {}
  }, 0);
}

function updateTrayMenu() {
  if (!tray) return;
  const settings = loadSettings();
  const vis = settings.deviceVisibility || {};
  const menu = Menu.buildFromTemplate([
    { label: 'Show Widget', type: 'normal', click: () => createWindow() },
    { type: 'separator' },
    { label: 'Devices', enabled: false },
    ...DEVICE_SLOT_TYPES.map(({ key, label }) => ({
      label,
      type: 'checkbox',
      checked: vis[key] !== false,
      click: (item) => {
        setDeviceTypeVisible(key, item.checked);
        reopenTrayMenu();
      },
    })),
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
    {
      label: 'Battery icons in taskbar',
      type: 'checkbox',
      checked: settings.deviceTrayIcons !== false,
      click: (item) => setTrayIconsEnabled(item.checked),
    },
    { type: 'separator' },
    { label: 'Quit', type: 'normal', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  for (const t of deviceTrays.values()) {
    try {
      t.setContextMenu(menu);
    } catch (_) {}
  }
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
  destroyDeviceTrays();
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
  updateTrayMenu();
});
ipcMain.handle('quit-app', () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle('focus-widget-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
});
ipcMain.handle('set-tray-icons-enabled', (_, value) => setTrayIconsEnabled(value));
ipcMain.handle('set-tray-battery-icons', (_, list) => {
  if (isQuitting) return;
  if (loadSettings().deviceTrayIcons === false) {
    destroyDeviceTrays();
    return;
  }
  const items = Array.isArray(list) ? list : [];
  const seen = new Set();
  let created = false;
  for (const it of items) {
    if (!it || !it.handle || typeof it.dataURL !== 'string') continue;
    let icon;
    try {
      const src = nativeImage.createFromDataURL(it.dataURL);
      if (src.isEmpty()) continue;
      if (process.platform === 'win32') {
        // DPI-aware variants so the icon stays crisp (and as large as the tray allows) on scaled displays.
        icon = nativeImage.createEmpty();
        icon.addRepresentation({ scaleFactor: 1.0, buffer: src.resize({ width: 16, height: 16 }).toPNG() });
        icon.addRepresentation({ scaleFactor: 1.5, buffer: src.resize({ width: 24, height: 24 }).toPNG() });
        icon.addRepresentation({ scaleFactor: 2.0, buffer: src.resize({ width: 32, height: 32 }).toPNG() });
      } else {
        icon = src;
      }
    } catch (_) {
      continue;
    }
    const key = String(it.handle);
    seen.add(key);
    let t = deviceTrays.get(key);
    if (!t) {
      try {
        t = new Tray(icon);
      } catch (_) {
        continue;
      }
      t.on('double-click', () => createWindow());
      deviceTrays.set(key, t);
      created = true;
    } else {
      t.setImage(icon);
    }
    const pct = Math.max(0, Math.min(100, Math.round(Number(it.pct) || 0)));
    t.setToolTip(`${String(it.name || 'Device')} — ${pct}%${it.charging ? ' (charging)' : ''}`);
  }
  for (const [key, t] of deviceTrays) {
    if (seen.has(key)) continue;
    try {
      t.destroy();
    } catch (_) {}
    deviceTrays.delete(key);
  }
  if (created) updateTrayMenu();
});
ipcMain.handle('set-always-on-top', (_, value) => {
  const settings = loadSettings();
  settings.alwaysOnTop = !!value;
  saveSettings(settings);
  applyAlwaysOnTopToMainWindow();
  updateTrayMenu();
});
ipcMain.handle('set-volume-panel-visible', (_, value) => {
  const settings = loadSettings();
  settings.volumePanelVisible = !!value;
  saveSettings(settings);
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const before = mainWindow.getBounds();
  applyWindowMinimumConstraints();
  if (value) {
    // applyWindowMinimumConstraints already grew the window if needed; remember
    // the pre-expand height so closing the panel returns to the original size.
    heightBeforeVolumeExpand = before.height < getWindowMinimumHeight() ? before.height : null;
  } else if (heightBeforeVolumeExpand !== null) {
    const b = mainWindow.getBounds();
    const restored = Math.max(MIN_WINDOW_HEIGHT_COLLAPSED, Math.round(heightBeforeVolumeExpand));
    mainWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: restored }, false);
    heightBeforeVolumeExpand = null;
  }
});

ipcMain.handle('set-device-visibility', (_, payload) => {
  const typeKey = payload && String(payload.type);
  if (!DEVICE_SLOT_TYPES.some((t) => t.key === typeKey)) return loadSettings();
  return setDeviceTypeVisible(typeKey, payload.visible);
});

ipcMain.on('window-resize-start', (event, edge) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  // A manual resize expresses a new preferred size; don't undo it when the volume panel closes.
  heightBeforeVolumeExpand = null;
  windowResizeSession = {
    win,
    edge: String(edge || ''),
    orig: win.getBounds(),
    start: screen.getCursorScreenPoint(),
  };
});

ipcMain.on('window-resize-move', (event, point) => {
  if (!windowResizeSession || windowResizeSession.win.isDestroyed()) return;
  const { win, edge, orig, start } = windowResizeSession;
  const pt =
    point && typeof point.x === 'number' && typeof point.y === 'number'
      ? { x: point.x, y: point.y }
      : screen.getCursorScreenPoint();
  const dx = pt.x - start.x;
  const dy = pt.y - start.y;
  win.setBounds(computeResizedBounds(orig, edge, dx, dy));
});

ipcMain.on('window-resize-end', () => {
  windowResizeSession = null;
});
