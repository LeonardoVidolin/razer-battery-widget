(function () {
  const DEVICE_TYPES = [
    { key: 'headphones', label: 'Headphones', keywords: /headset|headphone|blackshark|kraken|barracuda|nari|thresher|man o' war|audio|head/i },
    { key: 'keyboard', label: 'Keyboard', keywords: /keyboard|blackwidow|huntsman|ornata|cynosa|deathstalker|keypad/i },
    { key: 'mouse', label: 'Mouse', keywords: /mouse|deathadder|viper|basilisk|mamba|naga|lancehead|ouroboros|orochi|cobra|pro click|davinci|hyperflux/i },
  ];

  function getDeviceType(name) {
    if (!name) return null;
    for (const t of DEVICE_TYPES) {
      if (t.keywords.test(name)) return t.key;
    }
    return null;
  }

  /** Assign devices to slots by type; fill remaining slots with unmatched devices so nothing is hidden. */
  function pickDevicesByType(devices) {
    const byType = { headphones: null, keyboard: null, mouse: null };
    const assigned = new Set();
    for (const d of devices) {
      const type = getDeviceType(d.name);
      if (type && byType[type] === null) {
        byType[type] = d;
        assigned.add(d.handle);
      }
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

  window.electronAPI.onDevicesUpdate(render);
  window.electronAPI.getDevices().then((list) => render(list || []));
})();
