(function () {
  // Mouse, keyboard, speaker and controller before headphones so names like "Lancehead"
  // or "Clio HyperSpeed" never match headset patterns.
  const DEVICE_TYPES = [
    { key: 'mouse', label: 'Mouse', keywords: /mouse|deathadder|viper|basilisk|mamba|naga|lancehead|ouroboros|orochi|cobra|pro click|davinci|hyperflux/i },
    { key: 'keyboard', label: 'Keyboard', keywords: /keyboard|blackwidow|huntsman|ornata|cynosa|deathstalker|keypad/i },
    { key: 'speaker', label: 'Speaker', keywords: /speaker|clio|nommo|leviathan|soundbar/i },
    { key: 'controller', label: 'Controller', keywords: /controller|gamepad|wolverine|kishi|raiju|kitsune/i },
    {
      key: 'headphones',
      label: 'Headphones',
      keywords: /headset|headphones?|blackshark|hyperspeed|kraken|barracuda|nari|thresher|hammerhead|opus|kaira|ifrit|piranha|man o' war|earcup|wireless.*audio/i,
    },
  ];

  /** The three fixed slots the widget always shows (placeholder when nothing is connected). */
  const SLOT_TYPES = ['headphones', 'keyboard', 'mouse'];

  /** Every icon a device can be shown with; "other" is the fallback for unrecognised names. */
  const ICON_TYPES = [
    ...DEVICE_TYPES.map((t) => ({ key: t.key, label: t.label })),
    { key: 'other', label: 'Other device' },
  ];
  const ICON_MENU_ORDER = ['headphones', 'keyboard', 'mouse', 'speaker', 'controller', 'other'];

  function typeLabel(key) {
    const t = ICON_TYPES.find((x) => x.key === key);
    return t ? t.label : 'Device';
  }

  function getDeviceType(name) {
    if (!name) return null;
    for (const t of DEVICE_TYPES) {
      if (t.keywords.test(name)) return t.key;
    }
    return null;
  }

  /** Per-device choices from the right-click menu, keyed by lowercase device name. */
  let deviceOverrides = {};

  function deviceKey(d) {
    return String((d && d.name) || '').trim().toLowerCase();
  }

  function isDeviceHidden(d) {
    return deviceOverrides[deviceKey(d)] === 'hidden';
  }

  function resolveDeviceType(d) {
    const ov = deviceOverrides[deviceKey(d)];
    if (ov && ICON_TYPES.some((t) => t.key === ov)) return ov;
    return getDeviceType(d.name) || 'other';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function preferBetterBatteryReading(a, b) {
    const ap = Number(a.batteryPercentage) || 0;
    const bp = Number(b.batteryPercentage) || 0;
    if (ap === 0 && bp > 0) return b;
    if (bp === 0 && ap > 0) return a;
    if (ap !== bp) return ap > bp ? a : b;
    return String(a.handle) < String(b.handle) ? a : b;
  }

  /**
   * Put the best device of each slot type in its slot; every other visible device (speakers,
   * controllers, unrecognised names, a second mouse...) gets its own card after the slots.
   * Devices hidden from the menu, and devices of a hidden slot type, are left out.
   */
  function pickDevices(devices, visibility) {
    const slots = { headphones: null, keyboard: null, mouse: null };
    const extras = [];
    const shown = devices.filter((d) => !isDeviceHidden(d));
    for (const key of SLOT_TYPES) {
      const candidates = shown.filter((d) => resolveDeviceType(d) === key);
      if (candidates.length === 0) continue;
      slots[key] = candidates.length === 1 ? candidates[0] : candidates.reduce(preferBetterBatteryReading);
    }
    for (const d of shown) {
      const type = resolveDeviceType(d);
      if (SLOT_TYPES.includes(type)) {
        if (slots[type] === d || (visibility && visibility[type] === false)) continue;
      }
      extras.push({ type, device: d });
    }
    return { slots, extras };
  }

  const ICONS = {
    headphones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
    keyboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h.01M12 14h.01M16 14h.01M7 18h10"/></svg>`,
    mouse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v6"/></svg>`,
    speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="14" r="4"/><path d="M12 6h.01"/></svg>`,
    controller: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59l-.9 7.82A2.4 2.4 0 0 0 4.18 19c.86 0 1.66-.46 2.08-1.21L7.5 16h9l1.24 1.79A2.4 2.4 0 0 0 19.82 19a2.4 2.4 0 0 0 2.38-2.59l-.9-7.82A4 4 0 0 0 17.32 5z"/></svg>`,
    other: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/><path d="M6 10v4M10 10v4"/></svg>`,
  };

  const LIGHTNING = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;

  const R = 32;
  const C = 2 * Math.PI * R;

  function ringClass(pct) {
    if (pct <= 20) return 'critical';
    if (pct <= 40) return 'low';
    return '';
  }

  function renderDevice(type, device, isSlot) {
    const icon = ICONS[type] || '';
    const pct = device ? device.batteryPercentage : 0;
    const offset = C - (pct / 100) * C;
    const charging = device && device.isCharging;
    const fillClass = device ? ringClass(pct) : '';
    const title = device
      ? `${escapeHtml(device.name || typeLabel(type))} — right-click to change icon or hide`
      : `${typeLabel(type)} — right-click to hide`;
    const deviceAttr = device ? ` data-device="${escapeHtml(deviceKey(device))}"` : '';
    return `
      <div class="device ${device ? '' : 'empty-slot'}" data-type="${type}"${isSlot ? ' data-slot="1"' : ''}${deviceAttr} title="${title}">
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

  function trayIconColor(pct) {
    if (pct <= 20) return '#ff4444';
    if (pct <= 40) return '#b8e600';
    return '#00ff00';
  }

  // Device glyphs (same SVGs as the widget) pre-loaded as images for the tray icon canvas.
  const TRAY_GLYPHS = {};
  for (const t of ICON_TYPES) {
    const svg = ICONS[t.key];
    if (!svg) continue;
    const xml = svg.replace(
      '<svg ',
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" '
    ).replace(/currentColor/g, '#ffffff');
    const img = new Image();
    const entry = { img, ready: false };
    img.onload = () => {
      entry.ready = true;
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(xml)}`;
    TRAY_GLYPHS[t.key] = entry;
  }

  /** Battery number over a dimmed device glyph, as a 64x64 PNG (main derives 16/24/32px DPI variants). */
  function drawTrayIconDataURL(pct, charging, type) {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    // Solid device glyph in the top-left corner so each icon is identifiable at a glance;
    // the battery number sits bottom-right like a badge.
    const glyph = TRAY_GLYPHS[type];
    if (glyph && glyph.ready) {
      const gs = 34;
      const tinted = (color) => {
        const oc = document.createElement('canvas');
        oc.width = gs;
        oc.height = gs;
        const octx = oc.getContext('2d');
        octx.drawImage(glyph.img, 0, 0, gs, gs);
        octx.globalCompositeOperation = 'source-in';
        octx.fillStyle = color;
        octx.fillRect(0, 0, gs, gs);
        return oc;
      };
      ctx.drawImage(tinted('rgba(0, 0, 0, 0.9)'), 1, 1);
      ctx.drawImage(tinted(trayIconColor(pct)), 0, 0);
    }
    const text = String(pct);
    let fontSize = 50;
    while (fontSize > 16) {
      ctx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
      if (ctx.measureText(text).width <= 47) break;
      fontSize -= 2;
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    // Dark outline keeps the number readable on light taskbars and over the glyph.
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(text, S - 1, 44);
    ctx.fillStyle = trayIconColor(pct);
    ctx.fillText(text, S - 1, 44);
    if (charging) {
      ctx.beginPath();
      ctx.moveTo(16, 30);
      ctx.lineTo(4, 46);
      ctx.lineTo(11, 46);
      ctx.lineTo(6, 62);
      ctx.lineTo(19, 44);
      ctx.lineTo(12, 44);
      ctx.closePath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.fill();
    }
    return c.toDataURL('image/png');
  }

  function sendTrayBatteryIcons(picked) {
    if (!window.electronAPI || typeof window.electronAPI.setTrayBatteryIcons !== 'function') return;
    const entries = [
      ...SLOT_TYPES.filter((k) => deviceVisibility[k] !== false).map((k) => ({
        type: k,
        device: picked.slots[k],
        slot: true,
      })),
      ...picked.extras.map((e) => ({ ...e, slot: false })),
    ];
    const items = [];
    for (const { type, device: d, slot } of entries) {
      if (!d || d.handle == null) continue;
      const pct = Math.max(0, Math.min(100, Math.round(Number(d.batteryPercentage) || 0)));
      const charging = !!d.isCharging;
      items.push({
        type,
        slot,
        handle: String(d.handle),
        name: d.name || typeLabel(type),
        pct,
        charging,
        dataURL: drawTrayIconDataURL(pct, charging, type),
      });
    }
    window.electronAPI.setTrayBatteryIcons(items);
  }

  function render(devices) {
    if (Array.isArray(devices)) lastDevices = devices;
    const picked = pickDevices(lastDevices, deviceVisibility);
    const container = document.getElementById('devices');
    container.innerHTML =
      SLOT_TYPES.filter((k) => deviceVisibility[k] !== false)
        .map((k) => renderDevice(k, picked.slots[k], true))
        .join('') + picked.extras.map((e) => renderDevice(e.type, e.device, false)).join('');
    sendTrayBatteryIcons(picked);
  }

  function setDeviceOverride(key, value) {
    if (!key) return;
    const next = { ...deviceOverrides };
    if (!value || value === 'auto') delete next[key];
    else next[key] = value;
    deviceOverrides = next;
    render(lastDevices);
    if (window.electronAPI && typeof window.electronAPI.setDeviceOverride === 'function') {
      window.electronAPI.setDeviceOverride(key, value || null);
    }
  }

  function normalizeDeviceOverrides(v) {
    const out = {};
    if (!v || typeof v !== 'object') return out;
    for (const [k, val] of Object.entries(v)) {
      if (val === 'hidden' || ICON_TYPES.some((t) => t.key === val)) out[k] = val;
    }
    return out;
  }

  function applySettings(s) {
    deviceVisibility = normalizeDeviceVisibility(s && s.deviceVisibility);
    deviceOverrides = normalizeDeviceOverrides(s && s.deviceOverrides);
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
  const DEVICE_MENU_ID = 'device-menu';

  function closeContextMenu() {
    for (const id of [CONTEXT_MENU_ID, DEVICE_MENU_ID]) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
    document.body.classList.remove('context-menu-open');
  }

  function isInsideMenu(target) {
    return [CONTEXT_MENU_ID, DEVICE_MENU_ID].some((id) => {
      const el = document.getElementById(id);
      return el && !el.hidden && el.contains(target);
    });
  }

  /** Show a menu element at (x, y), kept inside the window, with the drag region suspended. */
  function showMenuAt(el, x, y) {
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

  function deviceDisplayName(key) {
    const d = lastDevices.find((x) => deviceKey(x) === key);
    return (d && d.name) || key;
  }

  /** Per-device menu: pick which icon (and slot) a device uses, or hide it. */
  function openDeviceMenu(key, x, y) {
    let el = document.getElementById(DEVICE_MENU_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = DEVICE_MENU_ID;
      el.className = 'context-menu';
      el.hidden = true;
      document.body.appendChild(el);
      el.addEventListener('click', (e) => {
        const item = e.target.closest('.context-menu-item');
        if (!item) return;
        e.preventDefault();
        e.stopPropagation();
        const k = el.dataset.deviceKey;
        const value = item.dataset.menuIcon;
        if (value) {
          setDeviceOverride(k, value);
          el.querySelectorAll('[data-menu-icon]').forEach((b) => b.classList.toggle('checked', b === item));
          return; // keep the menu open so the result can be seen before closing
        }
        if (item.dataset.menuAction === 'hide-device') {
          closeContextMenu();
          setDeviceOverride(k, 'hidden');
        }
      });
    }
    el.dataset.deviceKey = key;
    const ov = deviceOverrides[key];
    const current = ov && ov !== 'hidden' ? ov : 'auto';
    const d = lastDevices.find((x) => deviceKey(x) === key);
    const detected = d ? getDeviceType(d.name) : null;
    const check = '<span class="context-menu-check">✓</span>';
    const item = (value, label) =>
      `<button type="button" class="context-menu-item${current === value ? ' checked' : ''}" data-menu-icon="${value}">${check}${label}</button>`;
    el.innerHTML = `
      <div class="context-menu-header context-menu-title">${escapeHtml(deviceDisplayName(key))}</div>
      <div class="context-menu-header">Show as</div>
      ${item('auto', `Auto-detect (${typeLabel(detected || 'other')})`)}
      ${ICON_MENU_ORDER.map((k) => item(k, typeLabel(k))).join('')}
      <div class="context-menu-sep"></div>
      <button type="button" class="context-menu-item" data-menu-action="hide-device"><span class="context-menu-check"></span>Hide this device</button>
    `;
    showMenuAt(el, x, y);
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
      ${SLOT_TYPES.map(
        (k) => `<button type="button" class="context-menu-item" data-menu-device="${k}">${check}${typeLabel(k)}</button>`
      ).join('')}
      <div data-hidden-devices></div>
      <div class="context-menu-sep"></div>
      <button type="button" class="context-menu-item" data-menu-action="always-on-top">${check}Always on top</button>
      <button type="button" class="context-menu-item" data-menu-action="open-at-login">${check}Start with Windows</button>
      <button type="button" class="context-menu-item" data-menu-action="start-hidden">${check}Start hidden (taskbar icons only)</button>
      <button type="button" class="context-menu-item" data-menu-action="tray-icons">${check}Battery icons in taskbar</button>
      <div class="context-menu-sep"></div>
      <button type="button" class="context-menu-item" data-menu-action="hide"><span class="context-menu-check"></span>Hide widget</button>
      <button type="button" class="context-menu-item" data-menu-action="quit"><span class="context-menu-check"></span>Quit</button>
    `;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      const item = e.target.closest('.context-menu-item');
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const api = window.electronAPI || {};
      const unhide = item.dataset.menuUnhide;
      if (unhide) {
        setDeviceOverride(unhide, null);
        item.remove();
        const list = el.querySelector('[data-hidden-devices]');
        if (list && !list.querySelector('.context-menu-item')) list.innerHTML = '';
        return; // keep the menu open for more toggles
      }
      const devType = item.dataset.menuDevice;
      if (devType) {
        const next = deviceVisibility[devType] === false;
        item.classList.toggle('checked', next);
        setDeviceTypeVisible(devType, next);
        return; // keep the menu open for more toggles
      }
      const action = item.dataset.menuAction;
      if (action === 'always-on-top' || action === 'open-at-login' || action === 'tray-icons' || action === 'start-hidden') {
        const next = !item.classList.contains('checked');
        item.classList.toggle('checked', next);
        if (action === 'always-on-top' && typeof api.setAlwaysOnTop === 'function') api.setAlwaysOnTop(next);
        if (action === 'open-at-login' && typeof api.setOpenAtLogin === 'function') api.setOpenAtLogin(next);
        if (action === 'tray-icons' && typeof api.setTrayIconsEnabled === 'function') api.setTrayIconsEnabled(next);
        if (action === 'start-hidden' && typeof api.setStartHidden === 'function') api.setStartHidden(next);
        return; // keep the menu open
      }
      if (action === 'hide') {
        closeContextMenu();
        if (typeof api.hideWidget === 'function') api.hideWidget();
        return;
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
    const tico = el.querySelector('[data-menu-action="tray-icons"]');
    const shid = el.querySelector('[data-menu-action="start-hidden"]');
    if (aot) aot.classList.toggle('checked', !settings || settings.alwaysOnTop !== false);
    if (oal) oal.classList.toggle('checked', !settings || settings.openAtLogin !== false);
    if (tico) tico.classList.toggle('checked', !settings || settings.deviceTrayIcons !== false);
    if (shid) shid.classList.toggle('checked', !!(settings && settings.startHidden));
    // Devices hidden with "Hide this device" are listed here so they can be brought back.
    const hiddenList = el.querySelector('[data-hidden-devices]');
    if (hiddenList) {
      const hiddenKeys = Object.keys(deviceOverrides).filter((k) => deviceOverrides[k] === 'hidden');
      hiddenList.innerHTML = hiddenKeys.length
        ? `<div class="context-menu-sep"></div><div class="context-menu-header">Hidden devices</div>` +
          hiddenKeys
            .map(
              (k) =>
                `<button type="button" class="context-menu-item" data-menu-unhide="${escapeHtml(k)}"><span class="context-menu-check"></span>Show ${escapeHtml(deviceDisplayName(k))}</button>`
            )
            .join('')
        : '';
    }
    closeContextMenu();
    showMenuAt(el, x, y);
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
    if (isInsideMenu(e.target)) return;
    const dev = e.target.closest('.device');
    if (dev && dev.dataset.device) {
      // Right-click on a connected device: change its icon or hide it.
      closeContextMenu();
      openDeviceMenu(dev.dataset.device, e.clientX, e.clientY);
      return;
    }
    if (dev && dev.dataset.slot) {
      // Right-click on an empty slot hides that slot.
      closeContextMenu();
      setDeviceTypeVisible(dev.dataset.type, false);
      return;
    }
    requestContextMenuAt(e.clientX, e.clientY);
  });

  document.addEventListener('mousedown', (e) => {
    if (!isInsideMenu(e.target)) closeContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContextMenu();
  });
  window.addEventListener('blur', closeContextMenu);

  const hideBtn = document.getElementById('hide-btn');
  if (hideBtn && window.electronAPI && typeof window.electronAPI.hideWidget === 'function') {
    hideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.electronAPI.hideWidget();
    });
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

  // Warning shown when Synapse reports no devices (often stuck on a pending update until opened).
  const synapseWarning = document.getElementById('synapse-warning');
  const synapseWarningOpen = document.getElementById('synapse-warning-open');
  let synapseWarningDismissed = false;

  function renderSynapseStatus(status) {
    if (!synapseWarning) return;
    const noData = !!(status && status.noData);
    // Main only reports the first dropout of each launch; a dismissed warning stays hidden.
    synapseWarning.hidden = !noData || synapseWarningDismissed;
    if (synapseWarningOpen) synapseWarningOpen.hidden = !(status && status.canOpen);
  }

  if (synapseWarningOpen && window.electronAPI && typeof window.electronAPI.openSynapse === 'function') {
    synapseWarningOpen.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.electronAPI.openSynapse();
    });
  }

  const synapseWarningClose = document.getElementById('synapse-warning-close');
  if (synapseWarningClose) {
    synapseWarningClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      synapseWarningDismissed = true;
      if (synapseWarning) synapseWarning.hidden = true;
    });
  }

  const ICON_SPEAKER =`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M17.66 6.34a8 8 0 0 1 0 11.32"/></svg>`;
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
          applySettings(s);
          applyVolumePanelVisible(s && s.volumePanelVisible !== false);
          render(lastDevices);
        })
        .catch(() => applyVolumePanelVisible(true));
    } else {
      applyVolumePanelVisible(true);
    }

    if (typeof window.electronAPI.onSettingsUpdate === 'function') {
      window.electronAPI.onSettingsUpdate((s) => {
        applySettings(s);
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

    if (typeof window.electronAPI.getSynapseStatus === 'function') {
      window.electronAPI.onSynapseStatus(renderSynapseStatus);
      window.electronAPI.getSynapseStatus().then(renderSynapseStatus).catch(() => {});
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
