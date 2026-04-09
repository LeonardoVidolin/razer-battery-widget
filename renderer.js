(function () {
  // Mouse and keyboard before headphones so names like "Lancehead" never match headset patterns
  const DEVICE_TYPES = [
    { key: 'mouse', label: 'Mouse', keywords: /mouse|deathadder|viper|basilisk|mamba|naga|lancehead|ouroboros|orochi|cobra|pro click|davinci|hyperflux/i },
    { key: 'keyboard', label: 'Keyboard', keywords: /keyboard|blackwidow|huntsman|ornata|cynosa|deathstalker|keypad/i },
    {
      key: 'headphones',
      label: 'Headphones',
      keywords: /headset|headphones?|blackshark|hyperspeed|kraken|barracuda|nari|thresher|hammerhead|opus|kaira|ifrit|piranha|man o' war|earcup|wireless.*audio/i,
    },
  ];

  function getDeviceType(name) {
    if (!name) return null;
    for (const t of DEVICE_TYPES) {
      if (t.keywords.test(name)) return t.key;
    }
    return null;
  }

  function preferBetterBatteryReading(a, b) {
    const ap = Number(a.batteryPercentage) || 0;
    const bp = Number(b.batteryPercentage) || 0;
    if (ap === 0 && bp > 0) return b;
    if (bp === 0 && ap > 0) return a;
    if (ap !== bp) return ap > bp ? a : b;
    return String(a.handle) < String(b.handle) ? a : b;
  }

  /** Assign devices to slots by type; fill remaining slots with unmatched devices so nothing is hidden. */
  function pickDevicesByType(devices) {
    const byType = { headphones: null, keyboard: null, mouse: null };
    const assigned = new Set();
    for (const t of DEVICE_TYPES) {
      const candidates = devices.filter((d) => getDeviceType(d.name) === t.key);
      if (candidates.length === 0) continue;
      const best =
        candidates.length === 1 ? candidates[0] : candidates.reduce(preferBetterBatteryReading);
      byType[t.key] = best;
      assigned.add(best.handle);
    }
    const slots = ['headphones', 'keyboard', 'mouse'];
    for (const d of devices) {
      if (assigned.has(d.handle)) continue;
      const empty = slots.find((s) => byType[s] === null);
      if (empty) {
        byType[empty] = d;
        assigned.add(d.handle);
      }
    }
    return byType;
  }

  const ICONS = {
    headphones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
    keyboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h.01M12 14h.01M16 14h.01M7 18h10"/></svg>`,
    mouse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v6"/></svg>`,
  };

  const LIGHTNING = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;

  const R = 32;
  const C = 2 * Math.PI * R;

  function ringClass(pct) {
    if (pct <= 20) return 'critical';
    if (pct <= 40) return 'low';
    return '';
  }

  function renderDevice(type, device) {
    const icon = ICONS[type] || '';
    const pct = device ? device.batteryPercentage : 0;
    const offset = C - (pct / 100) * C;
    const charging = device && device.isCharging;
    const fillClass = device ? ringClass(pct) : '';
    return `
      <div class="device ${device ? '' : 'empty-slot'}" data-type="${type}">
        <div class="device-slot">
          <svg class="ring" viewBox="0 0 76 76">
            <circle class="ring-bg" cx="38" cy="38" r="${R}"/>
            <circle class="ring-fill ${fillClass}" cx="38" cy="38" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
          </svg>
          <div class="device-icon">${icon}</div>
          ${charging ? `<div class="charging">${LIGHTNING}</div>` : ''}
        </div>
        ${device ? `<span class="percentage">${pct}%</span>` : `<span class="placeholder">—</span>`}
      </div>
    `;
  }

  function render(devices) {
    const byType = pickDevicesByType(devices);
    const container = document.getElementById('devices');
    container.innerHTML = DEVICE_TYPES.map((t) => renderDevice(t.key, byType[t.key])).join('');
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn && window.electronAPI && typeof window.electronAPI.refreshDevices === 'function') {
    refreshBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      refreshBtn.classList.add('refreshing');
      try {
        const list = await window.electronAPI.refreshDevices();
        render(Array.isArray(list) ? list : []);
        if (typeof window.electronAPI.getAudioLevels === 'function') {
          window.electronAPI.getAudioLevels().then(renderAudioLevels).catch(() => {});
        }
      } catch (_) {
        const list = await window.electronAPI.getDevices().catch(() => []);
        render(Array.isArray(list) ? list : []);
      } finally {
        refreshBtn.classList.remove('refreshing');
      }
    });
  }

  const ICON_SPEAKER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M17.66 6.34a8 8 0 0 1 0 11.32"/></svg>`;
  const ICON_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/><path d="M8 22h8"/></svg>`;

  function renderAudioLevels(data) {
    const el = document.getElementById('volume-rows');
    if (!el) return;
    if (!data || typeof data.playback !== 'object' || typeof data.capture !== 'object') {
      el.className = 'volume-rows unavailable';
      const dash = `
        <div class="volume-row">
          <div class="volume-row-label">${ICON_SPEAKER}</div>
          <div class="volume-row-body">
            <div class="volume-row-title">Output (headphones)</div>
            <div class="volume-track"><div class="volume-fill" style="width:0%"></div></div>
          </div>
          <span class="volume-pct">—</span>
        </div>`;
      const dash2 = `
        <div class="volume-row">
          <div class="volume-row-label">${ICON_MIC}</div>
          <div class="volume-row-body">
            <div class="volume-row-title">Microphone</div>
            <div class="volume-track"><div class="volume-fill" style="width:0%"></div></div>
          </div>
          <span class="volume-pct">—</span>
        </div>`;
      el.innerHTML = dash + dash2;
      return;
    }
    el.className = 'volume-rows';
    function row(title, icon, slot, kind) {
      const pct = Math.round((slot.level || 0) * 100);
      const muted = !!slot.mute;
      const w = muted ? 0 : pct;
      const knobX = muted ? 0 : pct;
      return `
        <div class="volume-row ${muted ? 'muted' : ''}" data-volume-kind="${kind}">
          <div class="volume-row-label" aria-hidden="true">${icon}</div>
          <div class="volume-row-body">
            <div class="volume-row-title">${title}</div>
            <div class="volume-track" role="slider" aria-label="${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" tabindex="0">
              <div class="volume-fill" style="width:${w}%"></div>
              <button type="button" class="volume-knob" style="left:${knobX}%" aria-label="Adjust ${title}"></button>
            </div>
          </div>
          <span class="volume-pct">${muted ? 'MUTE' : `${pct}%`}</span>
        </div>`;
    }
    el.innerHTML =
      row('Output (headphones)', ICON_SPEAKER, data.playback, 'playback') +
      row('Microphone', ICON_MIC, data.capture, 'capture');
  }

  function setupVolumeSliderDrag() {
    const root = document.getElementById('volume-rows');
    if (!root || root.dataset.volumeDragBound === '1') return;
    root.dataset.volumeDragBound = '1';

    function pctFromClientX(track, clientX) {
      const r = track.getBoundingClientRect();
      if (r.width <= 0) return 0;
      const x = Math.max(0, Math.min(clientX - r.left, r.width));
      return Math.round((x / r.width) * 100);
    }

    function applyVisual(row, pct) {
      const fill = row.querySelector('.volume-fill');
      const knob = row.querySelector('.volume-knob');
      const label = row.querySelector('.volume-pct');
      const track = row.querySelector('.volume-track');
      if (fill) fill.style.width = `${pct}%`;
      if (knob) knob.style.left = `${pct}%`;
      if (label) label.textContent = `${pct}%`;
      if (track) track.setAttribute('aria-valuenow', String(pct));
      if (pct > 0) row.classList.remove('muted');
    }

    function commitToWindows(kind, pct) {
      if (!window.electronAPI || typeof window.electronAPI.setAudioLevels !== 'function') return;
      const payload = kind === 'playback' ? { playback: pct } : { capture: pct };
      window.electronAPI.setAudioLevels(payload).then((data) => {
        if (data) renderAudioLevels(data);
      }).catch(() => {});
    }

    root.addEventListener('mousedown', (e) => {
      if (root.classList.contains('unavailable')) return;
      const track = e.target.closest('.volume-track');
      if (!track) return;
      const row = track.closest('.volume-row');
      const kind = row && row.dataset.volumeKind;
      if (kind !== 'playback' && kind !== 'capture') return;
      e.preventDefault();
      let lastPct = pctFromClientX(track, e.clientX);
      applyVisual(row, lastPct);
      root.classList.add('volume-dragging');

      const onMove = (ev) => {
        lastPct = pctFromClientX(track, ev.clientX);
        applyVisual(row, lastPct);
      };
      const onUp = () => {
        root.classList.remove('volume-dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        commitToWindows(kind, lastPct);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    root.addEventListener('keydown', (e) => {
      if (root.classList.contains('unavailable')) return;
      const track = e.target.closest('.volume-track');
      if (!track || !root.contains(track)) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
      const row = track.closest('.volume-row');
      const kind = row && row.dataset.volumeKind;
      if (kind !== 'playback' && kind !== 'capture') return;
      const cur = parseInt(track.getAttribute('aria-valuenow') || '0', 10);
      let next = cur;
      if (e.key === 'ArrowLeft') next = Math.max(0, cur - 5);
      else if (e.key === 'ArrowRight') next = Math.min(100, cur + 5);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 100;
      applyVisual(row, next);
      commitToWindows(kind, next);
      e.preventDefault();
    });
  }

  setupVolumeSliderDrag();

  if (window.electronAPI) {
    window.electronAPI.onDevicesUpdate(render);
    window.electronAPI.getDevices().then((list) => render(Array.isArray(list) ? list : [])).catch(() => render([]));

    if (typeof window.electronAPI.getAudioLevels === 'function') {
      window.electronAPI.onAudioLevelsUpdate(renderAudioLevels);
      window.electronAPI.getAudioLevels().then(renderAudioLevels).catch(() => renderAudioLevels(null));
    }

    const DEVICES_UI_FALLBACK_MS = 30 * 1000;
    setInterval(() => {
      window.electronAPI.getDevices().then((list) => render(Array.isArray(list) ? list : [])).catch(() => {});
    }, DEVICES_UI_FALLBACK_MS);
  }
})();
