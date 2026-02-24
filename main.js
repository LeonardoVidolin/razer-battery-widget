const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { RazerWatcher } = require('./watcher/razer_watcher');

let mainWindow = null;
let razerWatcher = null;
let tray = null;
let isQuitting = false;

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

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const settings = loadSettings();
  mainWindow = new BrowserWindow({
    width: 440,
    height: 200,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: settings.alwaysOnTop !== false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setAlwaysOnTop(settings.alwaysOnTop !== false);
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
      label: 'Always on top',
      type: 'checkbox',
      checked: settings.alwaysOnTop !== false,
      click: (item) => {
        const next = { ...loadSettings(), alwaysOnTop: item.checked };
        saveSettings(next);
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(next.alwaysOnTop);
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

  razerWatcher = new RazerWatcher((devices) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const list = Array.from(devices.values()).filter((d) => d.isConnected);
      mainWindow.webContents.send('devices-update', list);
    }
  });
  razerWatcher.initialize();
  razerWatcher.start();

  createTray();
  createWindow();
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
  if (tray) try { tray.destroy(); tray = null; } catch (_) {}
  if (razerWatcher) razerWatcher.stop();
  razerWatcher = null;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  mainWindow = null;
});

ipcMain.handle('get-devices', () => (razerWatcher ? razerWatcher.listDevices() : []));
ipcMain.handle('get-settings', () => loadSettings());
ipcMain.handle('set-open-at-login', (_, value) => {
  const settings = loadSettings();
  settings.openAtLogin = !!value;
  saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
});
