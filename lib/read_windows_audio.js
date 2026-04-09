const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function scriptPath(app) {
  const rel = path.join('lib', 'windows-audio-levels.ps1');
  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', rel);
  }
  return path.join(__dirname, 'windows-audio-levels.ps1');
}

/**
 * @param {import('electron').App | null} app
 * @returns {{ playback: { level: number, mute: boolean }, capture: { level: number, mute: boolean } } | null}
 */
function parseAudioJson(raw) {
  const data = JSON.parse(raw.trim());
  const norm = (x) => ({
    level: Math.max(0, Math.min(1, Number(x.level) || 0)),
    mute: !!x.mute,
  });
  return {
    playback: norm(data.playback || {}),
    capture: norm(data.capture || {}),
  };
}

function readWindowsAudioLevels(app) {
  return runAudioScript(app, -1, -1);
}

/** Clamp 0–100, or keep -1 = “do not change this channel”. */
function optPct(n) {
  if (!Number.isFinite(n) || n < 0) return -1;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** @param {import('electron').App | null} app */
function setWindowsAudioLevels(app, { playbackPct = -1, capturePct = -1 } = {}) {
  return runAudioScript(app, optPct(playbackPct), optPct(capturePct));
}

function runAudioScript(app, playbackPct, capturePct) {
  if (process.platform !== 'win32') return null;
  const ps1 = scriptPath(app);
  if (!fs.existsSync(ps1)) return null;
  try {
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      ps1,
      '-PlaybackPct',
      String(playbackPct),
      '-CapturePct',
      String(capturePct),
    ];
    const out = execFileSync('powershell.exe', args, {
      encoding: 'utf8',
      timeout: 12000,
      windowsHide: true,
      maxBuffer: 256 * 1024,
    });
    return parseAudioJson(out);
  } catch (_) {
    return null;
  }
}

module.exports = { readWindowsAudioLevels, setWindowsAudioLevels, scriptPath };
