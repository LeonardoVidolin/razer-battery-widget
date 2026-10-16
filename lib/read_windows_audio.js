const { spawn } = require('child_process');
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

/** Clamp 0–100, or keep -1 = “do not change this channel”. */
function optPct(n) {
  if (!Number.isFinite(n) || n < 0) return -1;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** First answer includes PowerShell startup + compiling the C# interop (~1–2 s). */
const FIRST_REPLY_TIMEOUT_MS = 15000;
const REPLY_TIMEOUT_MS = 5000;

/**
 * One long-lived PowerShell (`-Serve`) answers every read/set. Spawning a new one per poll
 * took ~1.3 s each and, being synchronous, froze the main process (window drags stuttered).
 * Everything here is async; requests are answered one at a time in order.
 */
let worker = null;
/** @type {{ line: string, resolve: (v: any) => void, timer?: NodeJS.Timeout }[]} */
let queue = [];
let current = null;

function stopWorker() {
  const w = worker;
  worker = null;
  if (w) {
    try {
      w.proc.stdin.end();
      w.proc.kill();
    } catch (_) {}
  }
  if (current) {
    clearTimeout(current.timer);
    current.resolve(null);
    current = null;
  }
}

function startWorker(app) {
  const ps1 = scriptPath(app);
  if (!fs.existsSync(ps1)) return null;
  let proc;
  try {
    proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Serve'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch (_) {
    return null;
  }
  const w = { proc, buf: '', answered: false };
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    w.buf += chunk;
    let nl;
    while ((nl = w.buf.indexOf('\n')) >= 0) {
      const line = w.buf.slice(0, nl).trim();
      w.buf = w.buf.slice(nl + 1);
      if (!line || worker !== w || !current) continue;
      w.answered = true;
      const req = current;
      current = null;
      clearTimeout(req.timer);
      let result = null;
      try {
        result = parseAudioJson(line);
      } catch (_) {}
      req.resolve(result);
      pump(app);
    }
  });
  const onGone = () => {
    if (worker !== w) return;
    worker = null;
    if (current) {
      clearTimeout(current.timer);
      current.resolve(null);
      current = null;
    }
    pump(app);
  };
  proc.on('exit', onGone);
  proc.on('error', onGone);
  proc.stdin.on('error', () => {});
  return w;
}

function pump(app) {
  if (current || queue.length === 0) return;
  if (!worker) worker = startWorker(app);
  if (!worker) {
    // Script missing or PowerShell unavailable: answer everything with null.
    for (const r of queue.splice(0)) r.resolve(null);
    return;
  }
  current = queue.shift();
  const w = worker;
  current.timer = setTimeout(() => {
    // A stuck worker is replaced on the next request.
    if (worker === w) stopWorker();
    pump(app);
  }, w.answered ? REPLY_TIMEOUT_MS : FIRST_REPLY_TIMEOUT_MS);
  try {
    w.proc.stdin.write(`${current.line}\n`);
  } catch (_) {
    stopWorker();
    pump(app);
  }
}

function request(app, playbackPct, capturePct) {
  if (process.platform !== 'win32') return Promise.resolve(null);
  return new Promise((resolve) => {
    queue.push({ line: `${playbackPct} ${capturePct}`, resolve });
    pump(app);
  });
}

/** @param {import('electron').App | null} app */
function readWindowsAudioLevels(app) {
  return request(app, -1, -1);
}

/** @param {import('electron').App | null} app */
function setWindowsAudioLevels(app, { playbackPct = -1, capturePct = -1 } = {}) {
  return request(app, optPct(playbackPct), optPct(capturePct));
}

/** Close the PowerShell worker (call on quit). */
function shutdownAudioWorker() {
  for (const r of queue.splice(0)) r.resolve(null);
  stopWorker();
}

module.exports = { readWindowsAudioLevels, setWindowsAudioLevels, shutdownAudioWorker, scriptPath };
