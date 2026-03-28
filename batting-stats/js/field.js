// field.js - Baseball field SVG diagram

// Zone definitions
// Infield: pie slices from home plate (inner arc r=95)
// Outfield: simplified 3 zones (outer arc r=230)
// Backstroke: small zone above center field (HR only)
const FIELD_ZONES = [
  // Infield zones
  { id: 'if3',  path: 'M150,255 L83,188 A95,95 0 0 1 107,170 Z',  cx: 113, cy: 204 },
  { id: 'ifss', path: 'M150,255 L107,170 A95,95 0 0 1 135,161 Z', cx: 131, cy: 195 },
  { id: 'if2',  path: 'M150,255 L135,161 A95,95 0 0 1 165,161 Z', cx: 150, cy: 192 },
  { id: 'if2b', path: 'M150,255 L165,161 A95,95 0 0 1 193,170 Z', cx: 169, cy: 195 },
  { id: 'if1',  path: 'M150,255 L193,170 A95,95 0 0 1 217,188 Z', cx: 187, cy: 204 },
  // Outfield zones (7 zones: lfl, lf, lc, cf, rc, rf, rfl)
  { id: 'lfl', path: 'M83,188 A95,95 0 0 1 100,175 L45,69 A230,230 0 0 0 5,92 Z',     cx: 22,  cy: 135 },
  { id: 'lf',  path: 'M100,175 A95,95 0 0 1 119,165 L85,45 A230,230 0 0 0 45,69 Z',   cx: 55,  cy: 108 },
  { id: 'lc',  path: 'M119,165 A95,95 0 0 1 139,161 L126,28 A230,230 0 0 0 85,45 Z',  cx: 108, cy: 88  },
  { id: 'cf',  path: 'M139,161 A95,95 0 0 1 161,161 L174,28 A230,230 0 0 0 126,28 Z', cx: 150, cy: 72  },
  { id: 'rc',  path: 'M161,161 A95,95 0 0 1 181,165 L215,45 A230,230 0 0 0 174,28 Z', cx: 192, cy: 88  },
  { id: 'rf',  path: 'M181,165 A95,95 0 0 1 200,175 L255,69 A230,230 0 0 0 215,45 Z', cx: 245, cy: 108 },
  { id: 'rfl', path: 'M200,175 A95,95 0 0 1 217,188 L295,92 A230,230 0 0 0 255,69 Z', cx: 278, cy: 135 },
  // Backstroke zone (HR only) — arcs along outer fence boundary
  { id: 'bs', path: 'M114,28 A230,230 0 0 1 186,28 L178,8 L122,8 Z', cx: 150, cy: 18 },
];

const Field = (() => {
  function buildSVG(interactive, selectedZone, infieldOnly, showBackstroke) {
    const zones = FIELD_ZONES.map(z => {
      const isOutfield  = !z.id.startsWith('if');
      const isBS        = z.id === 'bs';

      if (isBS && !showBackstroke) return '';

      const disabled = !isBS && infieldOnly && isOutfield;
      const cls = ['field-zone'];
      if (isBS)            cls.push('zone-backstroke');
      else if (isOutfield) cls.push('zone-outfield');
      else                 cls.push('zone-infield');
      if (selectedZone === z.id) cls.push('zone-selected');
      if (disabled) cls.push('zone-disabled');
      const action = (interactive && !disabled) ? `data-zone="${z.id}"` : '';
      return `<path class="${cls.join(' ')}" d="${z.path}" ${action}/>`;
    }).join('');

    const deco = `
      <!-- Foul lines -->
      <line class="field-foul" x1="150" y1="255" x2="5" y2="92"/>
      <line class="field-foul" x1="150" y1="255" x2="295" y2="92"/>
      <!-- Diamond outline -->
      <polygon class="field-diamond" points="80,185 150,115 220,185 150,255"/>
      <!-- Pitcher's mound -->
      <circle class="field-mound" cx="150" cy="189" r="8"/>
      <!-- Bases -->
      <rect class="field-base" x="214" y="179" width="12" height="12" transform="rotate(45,220,185)"/>
      <rect class="field-base" x="144" y="109" width="12" height="12" transform="rotate(45,150,115)"/>
      <rect class="field-base" x="74"  y="179" width="12" height="12" transform="rotate(45,80,185)"/>
      <!-- Home plate -->
      <polygon class="field-home" points="150,265 143,259 143,251 157,251 157,259"/>
    `;

    const cursor = interactive ? 'style="cursor:pointer"' : '';
    return `<svg class="field-svg" viewBox="0 0 300 270" ${cursor} xmlns="http://www.w3.org/2000/svg">
      ${zones}
      ${deco}
    </svg>`;
  }

  function render(containerId, selectedZone, onChange, infieldOnly, showBackstroke) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = buildSVG(true, selectedZone, infieldOnly, showBackstroke);

    container.querySelectorAll('[data-zone]').forEach(el => {
      el.addEventListener('click', () => {
        const zoneId = el.dataset.zone;
        const newSelected = zoneId === selectedZone ? null : zoneId;
        render(containerId, newSelected, onChange, infieldOnly, showBackstroke);
        if (onChange) onChange(newSelected);
      });
    });
  }

  // dirData: { hit: {zone: count}, out: {zone: count} }  (or flat {zone: count} for legacy)
  function renderSpray(containerId, dirData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const hitCounts = dirData.hit || dirData;
    const outCounts = dirData.out || {};

    // Total counts per zone for sizing
    const allCounts = {};
    for (const [z, n] of Object.entries(hitCounts)) allCounts[z] = (allCounts[z] || 0) + n;
    for (const [z, n] of Object.entries(outCounts)) allCounts[z] = (allCounts[z] || 0) + n;

    const maxCount = Math.max(1, ...Object.values({ ...allCounts, _dummy: 0 }));
    const hasBS    = ((hitCounts.bs || 0) + (outCounts.bs || 0)) > 0;

    const dots = FIELD_ZONES.map(z => {
      const hc    = hitCounts[z.id] || 0;
      const oc    = outCounts[z.id] || 0;
      const total = hc + oc;
      if (total === 0) return '';

      const rBase = Math.max(11, Math.min(26, 11 + (total / maxCount) * 15));
      let svgEl = '';

      if (hc > 0 && oc > 0) {
        // 両方あり：安打(緑)をやや左上、アウト(グレー)をやや右下に配置
        const rH = Math.max(8, Math.round(rBase * hc / total));
        const rO = Math.max(8, Math.round(rBase * oc / total));
        svgEl  = `<circle class="spray-dot-hit" cx="${z.cx - 4}" cy="${z.cy - 4}" r="${rH}" opacity="0.85"/>`;
        svgEl += `<circle class="spray-dot-out" cx="${z.cx + 4}" cy="${z.cy + 4}" r="${rO}" opacity="0.75"/>`;
      } else if (hc > 0) {
        svgEl = `<circle class="spray-dot-hit" cx="${z.cx}" cy="${z.cy}" r="${rBase}" opacity="0.85"/>`;
      } else {
        svgEl = `<circle class="spray-dot-out" cx="${z.cx}" cy="${z.cy}" r="${rBase}" opacity="0.75"/>`;
      }
      svgEl += `<text class="spray-count" x="${z.cx}" y="${z.cy}">${total}</text>`;
      return svgEl;
    }).join('');

    const base = buildSVG(false, null, false, hasBS);
    container.innerHTML = base.replace('</svg>', dots + '</svg>');
  }

  function getZoneName(zoneId) {
    return I18n.t('dir.' + zoneId);
  }

  return { render, renderSpray, getZoneName, ZONES: FIELD_ZONES, buildSVG };
})();
