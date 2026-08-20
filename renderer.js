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

  /** Assign devices to slots by type; fill remaining visible slots with unmatched devices so nothing is hidden. */
  function pickDevicesByType(devices, visibility) {
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
    const slots = ['headphones', 'keyboard', 'mouse'].filter(
      (s) => !visibility || visibility[s] !== false
    );
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

  function renderDevice(type, device, label) {
    const icon = ICONS[type] || '';
    const pct = device ? device.batteryPercentage : 0;
    const offset = C - (pct / 100) * C;
    const charging = device && device.isCharging;
    const fillClass = device ? ringClass(pct) : '';
    return `
      <div class="device ${device ? '' : 'empty-slot'}" data-type="${type}" title="${label} — right-click to hide">
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

  let deviceVisibility = { headphones: true, keyboard: true, mouse: true };
  let lastDevices = [];

  function normalizeDeviceVisibility(v) {
    return {
      headphones: !v || v.headphones !== false,
      keyboard: !v || v.keyboard !== false,
      mouse: !v || v.mouse !== false,
    };
  }

  function render(devices) {
    if (Array.isArray(devices)) lastDevices = devices;
    const byType = pickDevicesByType(lastDevices, deviceVisibility);
    const container = document.getElementById('devices');
    container.innerHTML = DEVICE_TYPES.filter((t) => deviceVisibility[t.key] !== false)
      .map((t) => renderDevice(t.key, byType[t.key], t.label))
      .join('');
  }

  function setDeviceTypeVisible(type, visible) {
    deviceVisibility = { ...deviceVisibility, [type]: visible };
    render(lastDevices);
    if (window.electronAPI && typeof window.electronAPI.setDeviceVisibility === 'function') {
      window.electronAPI.setDeviceVisibility(type, visible);
    }
  }

  // In-app context menu (right-click outside a device): same items as the tray menu.
  // Checkbox items keep the menu open so several devices can be toggled in one go.
  const CONTEXT_MENU_ID = 'context-menu';

  function closeContextMenu() {
    const el = document.getElementById(CONTEXT_MENU_ID);
    if (el) el.hidden = true;
    document.body.classList.remove('context-menu-open');
  }

  function ensureContextMenu() {
    let el = document.getElementById(CONTEXT_MENU_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = CONTEXT_MENU_ID;
    el.className = 'context-menu';
    el.hidden = true;
    const check = '<span class="context-menu-check">✓</span>';
    el.innerHTML = `
      <div class="context-menu-header">Devices</div>
      ${DEVICE_TYPES.map(
        (t) => `<button type="button" class="context-menu-item" data-menu-device="${t.key}">${check}${t.label}</button>`
      ).join('')}
      <div class="context-menu-sep"></div>
      <button type="button" class="context-menu-item" data-menu-action="always-on-top">${check}Always on top</button>
      <button type="button" class="context-menu-item" data-menu-action="open-at-login">${check}Start with Windows</button>
      <div class="context-menu-sep"></div>
      <button type="button" class="context-menu-item" data-menu-action="quit"><span class="context-menu-check"></span>Quit</button>
    `;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const api = window.electronAPI || {};
      const devType = item.dataset.menuDevice;
      if (devType) {
        const next = deviceVisibility[devType] === false;
        item.classList.toggle('checked', next);
        setDeviceTypeVisible(devType, next);
        return; // keep the menu open for more toggles
      }
      const action = item.dataset.menuAction;
      if (action === 'always-on-top' || action === 'open-at-login') {
        const next = !item.classList.contains('checked');
        item.classList.toggle('checked', next);
        if (action === 'always-on-top' && typeof api.setAlwaysOnTop === 'function') api.setAlwaysOnTop(next);
        if (action === 'open-at-login' && typeof api.setOpenAtLogin === 'function') api.setOpenAtLogin(next);
        return; // keep the menu open
      }
      if (action === 'quit') {
        closeContextMenu();
        if (typeof api.quitApp === 'function') api.quitApp();
      }
    });
    return el;
  }

  function openContextMenu(x, y, settings) {
    const el = ensureContextMenu();
    el.querySelectorAll('[data-menu-device]').forEach((b) => {
      b.classList.toggle('checked', deviceVisibility[b.dataset.menuDevice] !== false);
    });
    const aot = el.querySelector('[data-menu-action="always-on-top"]');
    const oal = el.querySelector('[data-menu-action="open-at-login"]');
    if (aot) aot.classList.toggle('checked', !settings || settings.alwaysOnTop !== false);
    if (oal) oal.classList.toggle('checked', !settings || settings.openAtLogin !== false);
    el.hidden = false;
    // Suspend the window drag region while open so any click inside the widget reaches
    // the page (and closes the menu) instead of starting a window drag.
    document.body.classList.add('context-menu-open');
    const r = el.getBoundingClientRect();
    el.style.left = `${Math.max(4, Math.min(x, window.innerWidth - r.width - 4))}px`;
    el.style.top = `${Math.max(4, Math.min(y, window.innerHeight - r.height - 4))}px`;
    // Take focus so a click outside the app blurs the window and closes the menu.
    if (window.electronAPI && typeof window.electronAPI.focusWindow === 'function') {
      window.electronAPI.focusWindow();
    }
  }

  function requestContextMenuAt(x, y) {
    const show = (s) => openContextMenu(x, y, s);
    if (window.electronAPI && typeof window.electronAPI.getSettings === 'function') {
      window.electronAPI.getSettings().then(show).catch(() => show(null));
    } else {
      show(null);
    }
  }

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const menuEl = document.getElementById(CONTEXT_MENU_ID);
    if (menuEl && !menuEl.hidden && menuEl.contains(e.target)) return;
    const dev = e.target.closest('.device');
    if (dev && dev.dataset.type) {
      // Right-click on a device still hides just that device.
      closeContextMenu();
      setDeviceTypeVisible(dev.dataset.type, false);
      return;
    }
    requestContextMenuAt(e.clientX, e.clientY);
  });

  document.addEventListener('mousedown', (e) => {
    const el = document.getElementById(CONTEXT_MENU_ID);
    if (el && !el.hidden && !el.contains(e.target)) closeContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContextMenu();
  });
  window.addEventListener('blur', closeContextMenu);

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

  function setupResizeGrips() {
    if (!window.electronAPI || typeof window.electronAPI.startWindowResize !== 'function') return;
    document.querySelectorAll('.resize-grip').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const edge = el.dataset.edge;
        if (!edge) return;
        window.electronAPI.startWindowResize(edge);
        const onMove = (ev) => {
          window.electronAPI.updateWindowResize(ev.screenX, ev.screenY);
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('blur', onUp);
          window.electronAPI.endWindowResize();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('blur', onUp);
      });
    });
  }

  setupResizeGrips();

  const widgetRoot = document.getElementById('widget-root');
  const volumePanelToggle = document.getElementById('volume-panel-toggle');

  function updateCompactLayout() {
    if (!widgetRoot) return;
    const compact = window.innerHeight <= 274 || window.innerWidth <= 328;
    widgetRoot.classList.toggle('widget--compact', compact);
  }

  function applyVolumePanelVisible(visible) {
    if (!widgetRoot || !volumePanelToggle) return;
    widgetRoot.classList.toggle('widget--volume-collapsed', !visible);
    volumePanelToggle.setAttribute('aria-expanded', String(visible));
    volumePanelToggle.title = visible ? 'Hide volume controls' : 'Show volume controls';
    const icon = volumePanelToggle.querySelector('.volume-panel-toggle-icon');
    if (icon) icon.textContent = visible ? '▴' : '▾';
    updateCompactLayout();
  }

  if (volumePanelToggle && window.electronAPI && typeof window.electronAPI.setVolumePanelVisible === 'function') {
    volumePanelToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentlyVisible = !widgetRoot.classList.contains('widget--volume-collapsed');
      const nextVisible = !currentlyVisible;
      applyVolumePanelVisible(nextVisible);
      window.electronAPI.setVolumePanelVisible(nextVisible);
    });
  }

  window.addEventListener('resize', () => {
    updateCompactLayout();
    closeContextMenu();
  });

  if (window.electronAPI) {
    if (typeof window.electronAPI.getSettings === 'function') {
      window.electronAPI
        .getSettings()
        .then((s) => {
          deviceVisibility = normalizeDeviceVisibility(s && s.deviceVisibility);
          applyVolumePanelVisible(s && s.volumePanelVisible !== false);
          render(lastDevices);
        })
        .catch(() => applyVolumePanelVisible(true));
    } else {
      applyVolumePanelVisible(true);
    }

    if (typeof window.electronAPI.onSettingsUpdate === 'function') {
      window.electronAPI.onSettingsUpdate((s) => {
        deviceVisibility = normalizeDeviceVisibility(s && s.deviceVisibility);
        render(lastDevices);
      });
    }

    // Right-clicks on the window drag region are forwarded by the main process.
    if (typeof window.electronAPI.onOpenContextMenuAt === 'function') {
      window.electronAPI.onOpenContextMenuAt((pt) => {
        if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
          requestContextMenuAt(pt.x, pt.y);
        }
      });
    }

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

    updateCompactLayout();
  }
})();
