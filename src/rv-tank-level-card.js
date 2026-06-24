/**
 * rv-tank-level-card — Home Assistant Lovelace custom card
 *
 * Displays an animated tank fill visualization for RV black/grey waste tanks.
 *
 * Installation:
 *   1. Copy this file to <ha-config>/www/rv-tank-level-card.js
 *   2. Add resource in HA → Settings → Dashboards → Resources:
 *        URL:  /local/rv-tank-level-card.js
 *        Type: JavaScript module
 *   3. Use in a dashboard:
 *
 *        type: custom:rv-tank-level-card
 *        entity: sensor.black_tank_level   # numeric 0–100
 *        name: "Black Tank"
 *        color_scheme: black               # preset ("black"/"grey"/"blue") OR
 *                                          #   any CSS color e.g. "#0a7" / "teal"
 *        colors:                           # optional fine-grained overrides
 *          { fill: "#1a7", wave: "#3c9", border: "#2b8", text: "#dff",
 *            glow: "#4ca", bubble: "rgba(40,200,140,.4)", tank_bg: "#021" }
 *        gradient: false                   # true = glossy top-lit liquid
 *        shape: default                    # "default" | "propane" | "rectangular"
 *        tank_width: 220                   # rectangular only (viewBox px)
 *        tank_height: 150                  # rectangular only (viewBox px)
 *        max_width: 280                    # px cap; "none"/"full" = fill column.
 *                                          #   In Sections view, drag to resize.
 *        font_size: 54                     # px size of the percentage text
 *        decimals: 0                       # decimal places shown
 *        value_format: "{value}%"          # template: {value} and {unit}
 *        tap_action: more-info             # "more-info" (default) | "none"
 *        auto_color: false                 # true/"fresh" (high=green) | "waste"
 *                                          #   (high=red); auto green→amber→red
 *        gradient: false                   # glossy top-lit liquid
 *        icon: "🚽"                         # faint glyph/emoji behind the %
 *        secondary: "{state} / {attr:capacity} gal"   # text under the %
 *        sparkline: false                  # mini in-session history line
 *        trend: false                      # ▲/▼ change arrow from session history
 *        markers:                          # threshold lines across the tank
 *          - { value: 85, label: "FULL", color: "#e0b030" }
 *          - { value: 10, color: red, dashed: true }
 *
 *   Multi-tank: use `type: custom:rv-tank-row-card` with a `tanks:` list (each
 *   item is a full tank config) and an optional `defaults:` merged under all.
 *
 *   Side level markers (cfg.ticks). Numbers, or {value,label,color} objects:
 *        ticks: [0, 33, 66, 100]           # custom levels; false/[] = hide
 *        ticks:
 *          - { value: 90, label: "FULL",  color: "#5fd35f" }
 *          - { value: 20, label: "LOW",   color: "#e0703c" }
 *
 *   Value-driven styling (card-mod "state:" compatible). First match wins;
 *   order from most to least specific. A rule may set the card `color`/`blink`
 *   AND/OR recolor the LIQUID via `fill` (optional `wave`):
 *        state:
 *          - { value: 50, operator: ">=", color: "rgb(217,255,179)" }
 *          - { value: 15, operator: ">=", color: "rgb(255,194,153)" }
 *          - value: 15
 *            operator: "<="
 *            color: red
 *            fill: "#c0392b"               # liquid turns red when low
 *            blink: true                   # shorthand pulse animation
 *            # styles: { card: ["animation: blink 2s ease infinite"] }  # card-mod form
 */

(() => {
  let RV_INSTANCE_ID = 0;

  function nextInstanceId() {
    RV_INSTANCE_ID += 1;
    return `i${RV_INSTANCE_ID}`;
  }

  // ── Color schemes ──────────────────────────────────────────────────────────
  const SCHEMES = {
    black: {
      tankBg:  '#0a0a0a',
      fill:    '#2c2c2c',
      wave:    '#424242',
      glow:    '#686868',
      border:  '#545454',
      text:    '#cccccc',
      bubble:  'rgba(110,110,110,0.4)',
    },
    grey: {
      tankBg:  '#130e0a',
      fill:    '#6b5a4e',
      wave:    '#856a5a',
      glow:    '#9a8070',
      border:  '#8a7060',
      text:    '#e0cfc0',
      bubble:  'rgba(150,120,100,0.4)',
    },
    blue: {
      tankBg:  '#04080f',
      fill:    '#1a4a7a',
      wave:    '#2a6a9a',
      glow:    '#3a9aca',
      border:  '#3a7aaa',
      text:    '#a0d8f8',
      bubble:  'rgba(40,130,200,0.4)',
    },
  };

  // ── Color helpers ────────────────────────────────────────────────────────────
  // Resolve ANY CSS color (named / hex / rgb / hsl) to an [r,g,b] triple by
  // letting the canvas normalise it. Returns null if the string isn't a color.
  function toRgb(str) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillStyle = str;               // invalid input leaves it as '#000'
      const v = ctx.fillStyle;
      if (v[0] === '#') {
        return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16),
                parseInt(v.slice(5, 7), 16)];
      }
      const m = v.match(/[\d.]+/g);
      return m ? [+m[0], +m[1], +m[2]] : null;
    } catch (e) { return null; }
  }
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const mixArr = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  const rgb  = a => `rgb(${a[0]},${a[1]},${a[2]})`;
  const rgba = (a, al) => `rgba(${a[0]},${a[1]},${a[2]},${al})`;
  const WHITE = [255, 255, 255], DARK = [8, 10, 16];

  // Derive a full scheme (fill/wave/glow/border/text/bubble/tankBg) from one color.
  function schemeFromColor(str) {
    const c = toRgb(str) || [60, 60, 60];
    return {
      tankBg: rgb(mixArr(c, DARK, 0.82)),
      fill:   rgb(c),
      wave:   rgb(mixArr(c, WHITE, 0.28)),
      glow:   rgb(mixArr(c, WHITE, 0.40)),
      border: rgb(mixArr(c, WHITE, 0.35)),
      text:   rgb(mixArr(c, WHITE, 0.78)),
      bubble: rgba(mixArr(c, WHITE, 0.30), 0.4),
    };
  }
  // Lighten any color toward white by t (used to derive a wave from a fill).
  const lighten = (str, t) => rgb(mixArr(toRgb(str) || [60, 60, 60], WHITE, t));

  function relLuminance(color) {
    const c = toRgb(color) || [60, 60, 60];
    const linear = c.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastText(color) {
    const l = relLuminance(color);
    const contrastWithDark = (l + 0.05) / 0.05;
    const contrastWithLight = 1.05 / (l + 0.05);
    return contrastWithDark >= contrastWithLight ? '#172033' : '#f8fbff';
  }

  // Auto color a level: red (low) → amber → green (high). "waste" inverts it
  // so a FULL waste tank reads red (bad) and an empty one green (good).
  const _RED = [201, 60, 45], _AMBER = [230, 160, 40], _GREEN = [70, 190, 95];
  function autoColor(pct, mode) {
    const p = mode === 'waste' ? 100 - pct : pct;
    const [lo, hi, t] = p <= 50 ? [_RED, _AMBER, p / 50] : [_AMBER, _GREEN, (p - 50) / 50];
    return rgb(mixArr(lo, hi, Math.max(0, Math.min(1, t))));
  }

  // ── Number / template formatting ─────────────────────────────────────────────
  // Format a number with fixed decimals and thousands separators (1,234.5).
  function fmtNum(n, decimals) {
    if (!Number.isFinite(n)) return String(n);
    const [i, d] = n.toFixed(decimals).split('.');
    const i2 = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return d != null ? `${i2}.${d}` : i2;
  }
  // Expand {value} {unit} {state} {name} {attr:NAME} placeholders in a template.
  function formatTemplate(tpl, ctx) {
    return String(tpl)
      .replace(/\{value\}/g, fmtNum(ctx.pct, ctx.decimals))
      .replace(/\{unit\}/g, ctx.unit ?? '')
      .replace(/\{name\}/g, ctx.name ?? '')
      .replace(/\{state\}/g, ctx.rawNum != null ? fmtNum(ctx.rawNum, ctx.decimals) : (ctx.rawState ?? ''))
      .replace(/\{attr:([^}]+)\}/g, (_m, k) => {
        const v = ctx.attrs?.[k.trim()];
        return v != null ? String(v) : '';
      });
  }

  // Pick a scheme: a named preset, else treat color_scheme as a CSS color,
  // then layer any explicit `colors:` overrides on top.
  function resolveScheme(cfg) {
    const base = SCHEMES[cfg.color_scheme]
              || (cfg.color_scheme ? schemeFromColor(cfg.color_scheme) : SCHEMES.blue);
    const o = cfg.colors;
    if (!o || typeof o !== 'object') return base;
    return {
      tankBg: o.tank_bg ?? base.tankBg,
      fill:   o.fill    ?? base.fill,
      wave:   o.wave    ?? base.wave,
      glow:   o.glow    ?? base.glow,
      border: o.border  ?? base.border,
      text:   o.text    ?? base.text,
      bubble: o.bubble  ?? base.bubble,
    };
  }

  // ── Wave path generator ────────────────────────────────────────────────────
  // Generates a closed SVG path: sinusoidal wave from x0 → x1, boxed down to
  // bottomY.  halfPeriod is the width of one half-cycle (crest or trough).
  // The path is intentionally wider than the tank; the clip-path hides the rest.
  function wavePath(wy, x0, x1, halfPeriod, bottomY, amp) {
    const ctrl = halfPeriod * 0.55; // bezier handle length (~sine fit)
    const nSegs = Math.ceil((x1 - x0) / halfPeriod);
    let d = `M ${f(x0)},${f(wy)}`;
    for (let i = 0; i < nSegs; i++) {
      const xa = x0 + i * halfPeriod;
      const xb = xa + halfPeriod;
      const dy = (i % 2 === 0) ? -amp : amp;
      d += ` C ${f(xa + ctrl)},${f(wy + dy)} ${f(xb - ctrl)},${f(wy + dy)} ${f(xb)},${f(wy)}`;
    }
    const xe = x0 + nSegs * halfPeriod;
    d += ` L ${f(xe)},${bottomY} L ${f(x0)},${bottomY} Z`;
    return d;
  }

  function f(n) { return n.toFixed(1); }

  function num(v, dflt) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : dflt;
  }

  // ── Value-driven state rules (card-mod "state:" compatible) ──────────────────
  // Each rule: { value, operator, color?, blink?, styles?: { card: [..] } }
  // Operators: >=  >  <=  <  ==  !=  (default ">="). Returns the FIRST matching
  // rule, so order rules from most to least specific.
  const OPS = {
    '>=': (a, b) => a >= b, '>': (a, b) => a > b,
    '<=': (a, b) => a <= b, '<': (a, b) => a < b,
    '==': (a, b) => a === b, '!=': (a, b) => a !== b,
  };
  function matchStateRule(rules, value) {
    if (!Array.isArray(rules)) return null;
    for (const r of rules) {
      const op = OPS[r.operator || '>='];
      if (op && op(value, num(r.value, NaN))) return r;
    }
    return null;
  }
  // Build an inline style string from a matched rule (background + extras).
  function ruleToStyle(rule, uid) {
    if (!rule) return '';
    let s = '';
    if (rule.color) s += `background:${rule.color};`;
    if (rule.blink) s += `animation:rvBlink_${uid} 1.6s ease infinite;`;
    // card-mod compatibility: styles.card is a list of "prop: value" strings
    const cardStyles = rule.styles?.card;
    if (Array.isArray(cardStyles)) s += cardStyles.join(';') + ';';
    return s;
  }

  function cardBackgroundValue(cfg) {
    return cfg?.card_background == null ? '' : String(cfg.card_background).trim();
  }

  function cardBackgroundStyle(cfg) {
    const bg = cardBackgroundValue(cfg);
    if (!bg) return '';
    if (bg === 'transparent' || bg === 'none') return 'background:transparent;box-shadow:none;border-color:transparent;';
    return `background:${bg};`;
  }

  function cssSize(value, fallback) {
    if (value == null || value === '') return fallback;
    if (typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value))) return `${value}px`;
    return String(value);
  }

  function titleAlign(value) {
    return ['left', 'center', 'right'].includes(value) ? value : 'center';
  }

  function tankScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.max(0.25, Math.min(2, n));
  }

  function rowOrientation(value) {
    return value === 'vertical' ? 'vertical' : 'horizontal';
  }

  function tankBackground(cfg) {
    const explicit = cfg.colors && typeof cfg.colors === 'object' ? cfg.colors.tank_bg : null;
    if (explicit != null) return String(explicit);
    const bg = cardBackgroundValue(cfg);
    if (bg) return bg === 'none' ? 'transparent' : bg;
    return 'var(--ha-card-background,var(--card-background-color,transparent))';
  }

  // ── Side level markers (ticks) ───────────────────────────────────────────────
  //   cfg.ticks:  omitted          → default [0, 33, 66, 100]
  //               false/"none"/[]  → hidden
  //               [..numbers..]    → custom levels, e.g. [0, 25, 50, 75, 100]
  //               [{value,label?,color?}, ..] → custom label text / per-tick color
  //   Returns normalized objects: { value, label, color|null }.
  function resolveTicks(cfg) {
    const t = cfg.ticks;
    if (t === false || t === 'none' || t === 'hidden') return [];
    const arr = Array.isArray(t) ? t : [0, 33, 66, 100];
    return arr.map(item => {
      if (item && typeof item === 'object') {
        const v = Number(item.value);
        if (!Number.isFinite(v)) return null;
        return { value: v, label: item.label != null ? String(item.label) : `${v}%`,
                 color: item.color || null };
      }
      const v = Number(item);
      return Number.isFinite(v) ? { value: v, label: `${v}%`, color: null } : null;
    }).filter(Boolean);
  }

  // ── Tank shape geometry ─────────────────────────────────────────────────────
  // Returns everything shape-specific: the viewBox, the liquid bounding box
  // (tX/tY/tW/tH/tBot — used by the shared wave/bubble/label logic), the tick
  // column x, the clip-path contents, and the SVG fragments for the shell
  // (drawn behind the liquid), the crisp edge (over the liquid), any external
  // decoration (foot rings), and the cap/valve/fitting.
  //
  //   shape: "default"     rounded jerry-can (original)
  //          "propane"     vertical cylinder with domed ends + valve
  //          "rectangular" flat tank, configurable tank_width / tank_height
  //   gutter: right-side space reserved for the tick scale (trimmed when ticks
  //           are hidden so the tank isn't lopsided).
  function tankGeometry(shape, cfg, c, uid, gutter = 60) {
    const glow = `filter="url(#gw_${uid})"`;

    if (shape === 'propane') {
      // tX = gutter keeps the cylinder centred (equal margins both sides)
      const tX = gutter, tY = 60, tW = 150, tH = 262, tBot = tY + tH;
      const rx = 72, ry = 48, cx = tX + tW / 2;
      const rect = (extra) =>
        `<rect x="${tX}" y="${tY}" width="${tW}" height="${tH}" rx="${rx}" ry="${ry}" ${extra}/>`;
      return {
        // cylinder is centred; gutter past its right edge holds the tick scale
        vbW: tX + tW + gutter, vbH: tBot + 28, tX, tY, tW, tH, tBot, tickX: tX + tW + 12,
        clip: rect(''),
        shell: rect(`fill="${c.tankBg}" stroke="${c.border}" stroke-width="3" ${glow}`),
        interiorBg: rect(`fill="${c.tankBg}"`),
        shellEdge: rect(`fill="none" stroke="${c.border}" stroke-width="2"`),
        decor:
          // foot ring the cylinder stands on
          `<rect x="${cx - 38}" y="${f(tBot - 10)}" width="76" height="16" rx="5"
                 fill="${c.tankBg}" stroke="${c.border}" stroke-width="2"/>`,
        cap:
          // protective collar, neck, and valve handwheel
          `<rect x="${cx - 34}" y="44" width="68" height="22" rx="8"
                 fill="${c.tankBg}" stroke="${c.border}" stroke-width="2"/>
           <rect x="${cx - 11}" y="26" width="22" height="22" rx="4"
                 fill="${c.tankBg}" stroke="${c.border}" stroke-width="2"/>
           <circle cx="${cx}" cy="20" r="11" fill="none" stroke="${c.border}" stroke-width="3"/>
           <circle cx="${cx}" cy="20" r="3.5" fill="${c.border}"/>`,
      };
    }

    if (shape === 'rectangular' || shape === 'flat') {
      // Flat RV tank: wide & short by default, fully configurable.
      const tW = num(cfg.tank_width, 220), tH = num(cfg.tank_height, 150);
      const tX = 20, tY = 36, tBot = tY + tH, tR = num(cfg.tank_radius, 12);
      const rect = (extra) =>
        `<rect x="${tX}" y="${tY}" width="${tW}" height="${tH}" rx="${tR}" ${extra}/>`;
      return {
        vbW: tX + tW + gutter, vbH: tBot + 24, tX, tY, tW, tH, tBot, tickX: tX + tW + 12,
        clip: rect(''),
        shell: rect(`fill="${c.tankBg}" stroke="${c.border}" stroke-width="3" ${glow}`),
        interiorBg: rect(`fill="${c.tankBg}"`),
        shellEdge: rect(`fill="none" stroke="${c.border}" stroke-width="2"`),
        decor: '',
        cap:
          // small inlet fitting on the top edge
          `<rect x="${tX + 26}" y="${tY - 16}" width="24" height="20" rx="4"
                 fill="${c.tankBg}" stroke="${c.border}" stroke-width="2"/>`,
      };
    }

    // default — original rounded jerry-can
    const tX = 20, tY = 36, tW = 200, tH = 290, tBot = 326, tR = 28;
    const rect = (extra) =>
      `<rect x="${tX}" y="${tY}" width="${tW}" height="${tH}" rx="${tR}" ${extra}/>`;
    return {
      vbW: tX + tW + gutter, vbH: 360, tX, tY, tW, tH, tBot, tickX: tX + tW + 12,
      clip: rect(''),
      shell: rect(`fill="${c.tankBg}" stroke="${c.border}" stroke-width="3" ${glow}`),
      interiorBg: rect(`fill="${c.tankBg}"`),
      shellEdge: rect(`fill="none" stroke="${c.border}" stroke-width="2"`),
      decor: '',
      cap:
        `<rect x="90" y="2" width="60" height="36" rx="9"
               fill="${c.tankBg}" stroke="${c.border}" stroke-width="2"/>
         <rect x="99" y="5" width="42" height="29" rx="6"
               fill="${c.tankBg}" stroke="${c.border}" stroke-width="1.5"/>`,
    };
  }

  // ── Card markup builder ──────────────────────────────────────────────────────
  // Builds the <style> + tank <div> for one tank (no <ha-card> wrapper, so it
  // can be reused by both the single card and the multi-tank row card).
  //   cfg  — this tank's config
  //   hass — Home Assistant object (may be null before first update)
  //   hist — per-tank array used for the in-memory sparkline / trend
  function tankMarkup(cfg, hass, hist, instanceId = '') {
    const name = cfg.name || cfg.entity;
    const c    = Object.assign({}, resolveScheme(cfg));
    c.tankBg = tankBackground(cfg);
    const uidBase = (cfg.entity || cfg.name || 'tank').replace(/\W/g, '_');
    const uidSuffix = String(instanceId || '').replace(/\W/g, '_');
    const uid = uidSuffix ? `${uidBase}_${uidSuffix}` : uidBase;
    const mw   = cfg.max_width;
    const maxW = (mw == null) ? '280px'
               : (mw === 'none' || mw === 'full') ? 'none'
               : (typeof mw === 'number' || /^\d+$/.test(mw)) ? `${parseInt(mw, 10)}px`
               : String(mw);
    const svgWidth = `${Math.round(tankScale(cfg.tank_scale) * 100)}%`;

    const fontSize = Number(cfg.font_size) || 54;
    const decimals = Number.isFinite(Number(cfg.decimals)) ? Number(cfg.decimals) : 0;
    const fmt      = cfg.value_format || '{value}%';

    // ── Resolve level + formatting context ──
    let pct = 0, label = '--', available = false, attrs = {}, unit = '%', rawState = '';
    if (hass) {
      const s = hass.states[cfg.entity];
      if (s) {
        attrs = s.attributes || {};
        unit  = attrs.unit_of_measurement ?? '%';
        rawState = s.state;
        if (s.state !== 'unavailable' && s.state !== 'unknown') {
          const n = parseFloat(s.state);
          if (!isNaN(n)) {
            available = true;
            pct = Math.max(0, Math.min(100, n));
          }
        }
      }
    }
    const ctx = { pct, decimals, unit, name, rawState, rawNum: available ? parseFloat(rawState) : null, attrs };
    if (available) label = formatTemplate(fmt, ctx);

    // ── In-memory history for sparkline / trend ──
    if (available && Array.isArray(hist)) {
      if (hist.length === 0 || hist[hist.length - 1] !== pct) {
        hist.push(pct);
        if (hist.length > 40) hist.shift();
      }
    }

    // ── Value-driven styling + fill color (rule > auto_color > scheme) ──
    const rule      = matchStateRule(cfg.state, pct);
    const cardStyle = ruleToStyle(rule, uid);
    const auto      = cfg.auto_color === true ? 'fresh' : (cfg.auto_color || null);
    let baseFill = c.fill, baseWave = c.wave;
    if (auto) { baseFill = autoColor(pct, auto); baseWave = lighten(baseFill, 0.28); }
    const fillColor = rule?.fill ? rule.fill : baseFill;
    const waveColor = rule?.fill ? (rule.wave || lighten(rule.fill, 0.28)) : baseWave;
    const hasTextOverride = cfg.colors && typeof cfg.colors === 'object' && cfg.colors.text != null;
    const labelColor = hasTextOverride || !available || pct <= 0 ? c.text : contrastText(fillColor);

    const gradient    = cfg.gradient === true;
    const liquidPaint = gradient ? `url(#lg_${uid})` : fillColor;

    // ── Side level markers ──
    const TICKS     = resolveTicks(cfg);
    const showTicks = TICKS.length > 0;

    // ── Geometry ──
    const shape  = (cfg.shape || 'default').toLowerCase();
    const gutter = showTicks ? 60 : 18;
    const g = tankGeometry(shape, cfg, c, uid, gutter);
    const { tX, tY, tW, tH, tBot, tickX: tkX, vbW, vbH } = g;

    // ── Fill geometry ──
    const waveAmp = 6;
    const period  = tW / 2;
    const halfP   = period / 2;
    const fillY   = pct > 0 ? tY + tH * (1 - pct / 100) : tBot;
    const liquidH = Math.max(0, tBot - fillY - waveAmp);
    const cx      = tX + tW / 2;
    const indY    = Math.max(tY, Math.min(tBot, fillY));

    const wPath = pct > 0
      ? wavePath(fillY, tX - tW, tX + tW * 2 + period, halfP, tBot + 20, waveAmp)
      : '';

    const BUBBLES = pct > 5 ? [
      [0.18, 28, 3.5, 5.0, 0.0],
      [0.45, 58, 2.5, 4.0, 1.3],
      [0.72, 22, 4.5, 6.0, 0.7],
      [0.30, 82, 2.0, 4.5, 2.0],
      [0.84, 48, 3.0, 5.5, 0.4],
    ].map(([fx, up, br, bd, bdl]) => [tX + tW * fx, tBot - up, br, bd, bdl]) : [];

    // ── Threshold marker lines across the tank ──
    const MARKERS = (Array.isArray(cfg.markers) ? cfg.markers : [])
      .map(m => (m && typeof m === 'object') ? m : { value: Number(m) })
      .filter(m => Number.isFinite(Number(m.value)));

    // ── Secondary text (template under the %) ──
    const secondary = cfg.secondary ? formatTemplate(cfg.secondary, ctx) : '';

    // ── Optional faint icon/emoji behind the % ──
    const icon = cfg.icon ? String(cfg.icon) : '';

    // ── Trend arrow + sparkline from history ──
    const showSpark = cfg.sparkline === true && hist && hist.length >= 2;
    const showTrend = cfg.trend === true && hist && hist.length >= 2;
    let trendSvg = '';
    if (showTrend) {
      const delta = hist[hist.length - 1] - hist[0];
      const arrow = delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '▬';
      const tcol  = delta > 0.5 ? '#5fd35f' : delta < -0.5 ? '#e0703c' : c.glow;
      trendSvg = `<text x="${tX + 12}" y="${tY + 22}" fill="${tcol}" font-size="15"
        font-weight="700" font-family="ui-sans-serif,sans-serif"
        >${arrow} ${delta > 0 ? '+' : ''}${fmtNum(delta, decimals)}</text>`;
    }
    let sparkSvg = '';
    if (showSpark) {
      const sw = tW * 0.6, sx = cx - sw / 2, sh = 22, sy = tBot - 30;
      const n = hist.length, max = 100, min = 0;
      const pts = hist.map((v, i) => {
        const px = sx + (sw * i) / (n - 1);
        const py = sy + sh - ((v - min) / (max - min)) * sh;
        return `${f(px)},${f(py)}`;
      }).join(' ');
      sparkSvg = `<polyline points="${pts}" fill="none" stroke="${c.glow}"
        stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>`;
    }

    // ── Label placement (leaves room for secondary text) ──
    const blockH  = fontSize + (secondary ? fontSize * 0.42 : 0);
    const blockMid = Math.min(tBot - blockH * 0.4, Math.max(tY + blockH * 0.6, (fillY + tBot) / 2));
    const labelY  = blockMid - (secondary ? fontSize * 0.18 : 0);
    const secY    = labelY + fontSize * 0.5 + 4;

    const tapCursor = (cfg.tap_action || 'more-info') === 'none' ? 'default' : 'pointer';
    const cardBg = cardBackgroundValue(cfg);
    const panelBg = cardBg ? (cardBg === 'none' ? 'transparent' : cardBg)
      : 'var(--ha-card-background,var(--card-background-color,#080c14))';
    const titleSize = cssSize(cfg.title_font_size, '.75rem');
    const align = titleAlign(cfg.title_align);

    return `
<style>
.rv${uid}{background:${panelBg};
  border-radius:var(--ha-card-border-radius,12px);padding:10px 6px 6px;
  box-sizing:border-box;width:100%;height:100%;
  display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;min-width:0;
  cursor:${tapCursor};}
.rv${uid} .nm{color:var(--secondary-text-color,#6a7a8a);font-size:${titleSize};
  font-family:var(--ha-card-header-font-family,ui-sans-serif,sans-serif);
  text-transform:uppercase;letter-spacing:.1em;margin:0 auto 2px;width:100%;
  text-align:${align};line-height:1.25;}
.rv${uid} svg{width:${svgWidth};max-width:${maxW};height:auto;display:block;margin:0 auto;overflow:visible;}
.rv${uid} .wv{animation:rvWave_${uid} 3s linear infinite;}
.rv${uid} .bb{animation:rvBub_${uid} var(--d) ease-in var(--dl) infinite;opacity:0;}
@keyframes rvWave_${uid}{
  0%{transform:translateX(0)}100%{transform:translateX(${period}px)}}
@keyframes rvBub_${uid}{
  0%{transform:translateY(0);opacity:.45}
  85%{opacity:.15}
  100%{transform:translateY(-${tH + 30}px);opacity:0}}
@keyframes rvBlink_${uid}{50%{opacity:.45}}
</style>
<div class="rv${uid}"${cardStyle ? ` style="${cardStyle}"` : ''}>
  <div class="nm">${name}</div>
  <svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="ck_${uid}">${g.clip}</clipPath>
      <filter id="gw_${uid}" x="-15%" y="-15%" width="130%" height="130%">
        <feGaussianBlur stdDeviation="3.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      ${gradient ? `
      <linearGradient id="lg_${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${lighten(fillColor, 0.22)}"/>
        <stop offset="1" stop-color="${fillColor}"/>
      </linearGradient>` : ''}
    </defs>

    ${g.decor}
    ${g.cap}
    ${g.shell}

    <g clip-path="url(#ck_${uid})">
      ${g.interiorBg}
      ${icon ? `<text x="${cx}" y="${(tY + tBot) / 2}" text-anchor="middle"
        dominant-baseline="middle" font-size="${tW * 0.5}" opacity=".10"
        fill="${c.text}">${icon}</text>` : ''}
      ${pct > 0 ? `
      <rect x="${tX}" y="${f(fillY + waveAmp)}" width="${tW}" height="${f(liquidH)}"
            fill="${liquidPaint}"/>
      <path class="wv" d="${wPath}" fill="${waveColor}" opacity=".88"/>
      ${BUBBLES.map(([bx, by, br, bd, bdl]) =>
        `<circle class="bb" cx="${bx}" cy="${by}" r="${br}"
                 fill="${c.bubble}" style="--d:${bd}s;--dl:${bdl}s"/>`
      ).join('\n      ')}
      ` : ''}
      ${MARKERS.map(m => {
        const my  = tY + tH * (1 - Number(m.value) / 100);
        const col = m.color || '#e0b030';
        const dash = m.dashed === false ? '' : 'stroke-dasharray="6,4"';
        return `<line x1="${tX}" y1="${f(my)}" x2="${tX + tW}" y2="${f(my)}"
            stroke="${col}" stroke-width="2" ${dash} opacity=".9"/>${
          m.label ? `<text x="${tX + 6}" y="${f(my - 4)}" fill="${col}" font-size="11"
            font-weight="700" font-family="ui-sans-serif,sans-serif">${m.label}</text>` : ''}`;
      }).join('\n      ')}
      ${sparkSvg}
    </g>

    ${g.shellEdge}

    ${TICKS.map(t => {
      const ty = tY + tH * (1 - t.value / 100);
      const line = t.color || '#2a3a4a';
      const txt  = t.color || '#4a5a6a';
      return `<line x1="${tkX}" y1="${f(ty)}" x2="${tkX + 10}" y2="${f(ty)}"
          stroke="${line}" stroke-width="1.5"/>
<text x="${tkX + 14}" y="${f(ty + 4)}" fill="${txt}" font-size="10"
      font-family="ui-sans-serif,sans-serif">${t.label}</text>`;
    }).join('\n    ')}

    ${showTicks ? `
    <line x1="${tX + tW}" y1="${f(indY)}" x2="${tkX - 3}" y2="${f(indY)}"
          stroke="${c.glow}" stroke-width="1.5" stroke-dasharray="3,2" opacity=".65"/>
    <circle cx="${tkX - 3}" cy="${f(indY)}" r="4" fill="${c.glow}" opacity=".9"/>
    ` : ''}

    ${trendSvg}

    <text x="${cx}" y="${f(labelY)}" text-anchor="middle" dominant-baseline="middle"
          fill="${labelColor}" font-size="${fontSize}" font-weight="700"
          font-family="ui-sans-serif,system-ui,sans-serif" opacity=".95">${label}</text>
    ${secondary ? `<text x="${cx}" y="${f(secY)}" text-anchor="middle"
          dominant-baseline="middle" fill="${labelColor}" font-size="${f(fontSize * 0.32)}"
          font-family="ui-sans-serif,sans-serif" opacity=".7">${secondary}</text>` : ''}
  </svg>
</div>`;
  }

  // ── Visual editor helpers ──────────────────────────────────────────────────
  const SHAPE_OPTIONS = [
    { value: 'default', label: 'Default / jerry-can' },
    { value: 'propane', label: 'Propane' },
    { value: 'rectangular', label: 'Rectangular' },
    { value: 'flat', label: 'Flat alias' },
  ];

  const AUTO_COLOR_OPTIONS = [
    { value: '', label: 'Off' },
    { value: 'fresh', label: 'Fresh: high is good' },
    { value: 'waste', label: 'Waste: high is bad' },
  ];

  const TITLE_ALIGN_OPTIONS = [
    { value: 'center', label: 'Center' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ];

  const ROW_ORIENTATION_OPTIONS = [
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
  ];

  const TANK_FORM_SCHEMA = [
    { name: 'entity', label: 'Entity', required: true, selector: { entity: { domain: 'sensor' } } },
    { name: 'name', label: 'Name', selector: { text: {} } },
    { name: 'shape', label: 'Shape', selector: { select: { mode: 'dropdown', options: SHAPE_OPTIONS } } },
    { name: 'color_scheme', label: 'Color scheme / CSS color', selector: { text: {} } },
    { name: 'card_background', label: 'Card background CSS value', selector: { text: {} } },
    { name: 'title_font_size', label: 'Title font size', selector: { text: {} } },
    { name: 'title_align', label: 'Title alignment', selector: { select: { mode: 'dropdown', options: TITLE_ALIGN_OPTIONS } } },
    { name: 'tank_scale', label: 'Tank scale', selector: { number: { min: 0.25, max: 2, step: 0.05, mode: 'box' } } },
    { name: 'auto_color', label: 'Auto color', selector: { select: { mode: 'dropdown', options: AUTO_COLOR_OPTIONS } } },
    { name: 'tap_action', label: 'Tap action', selector: { select: { mode: 'dropdown', options: [
      { value: 'more-info', label: 'More info' },
      { value: 'none', label: 'None' },
    ] } } },
    { name: 'gradient', label: 'Gradient fill', selector: { boolean: {} } },
    { name: 'sparkline', label: 'Sparkline', selector: { boolean: {} } },
    { name: 'trend', label: 'Trend arrow', selector: { boolean: {} } },
    { name: 'decimals', label: 'Decimals', selector: { number: { min: 0, mode: 'box' } } },
    { name: 'font_size', label: 'Font size', selector: { number: { min: 8, mode: 'box' } } },
    { name: 'max_width', label: 'Max width', selector: { text: {} } },
    { name: 'value_format', label: 'Value format', selector: { text: {} } },
    { name: 'secondary', label: 'Secondary text', selector: { text: {} } },
    { name: 'icon', label: 'Icon', selector: { text: {} } },
    { name: 'tank_width', label: 'Rectangular tank width', selector: { number: { min: 50, mode: 'box' } } },
    { name: 'tank_height', label: 'Rectangular tank height', selector: { number: { min: 50, mode: 'box' } } },
    { name: 'tank_radius', label: 'Rectangular tank radius', selector: { number: { min: 0, mode: 'box' } } },
  ];

  const ROW_TANK_SCHEMA = [
    { name: 'entity', label: 'Entity', required: true, selector: { entity: { domain: 'sensor' } } },
    { name: 'name', label: 'Name', selector: { text: {} } },
    { name: 'shape', label: 'Shape', selector: { select: { mode: 'dropdown', options: SHAPE_OPTIONS } } },
    { name: 'color_scheme', label: 'Color scheme / CSS color', selector: { text: {} } },
    { name: 'card_background', label: 'Card background CSS value', selector: { text: {} } },
    { name: 'title_font_size', label: 'Title font size', selector: { text: {} } },
    { name: 'title_align', label: 'Title alignment', selector: { select: { mode: 'dropdown', options: TITLE_ALIGN_OPTIONS } } },
    { name: 'tank_scale', label: 'Tank scale', selector: { number: { min: 0.25, max: 2, step: 0.05, mode: 'box' } } },
    { name: 'auto_color', label: 'Auto color', selector: { select: { mode: 'dropdown', options: AUTO_COLOR_OPTIONS } } },
  ];

  const ROW_DEFAULTS_SCHEMA = [
    { name: 'shape', label: 'Default shape', selector: { select: { mode: 'dropdown', options: SHAPE_OPTIONS } } },
    { name: 'color_scheme', label: 'Default color scheme / CSS color', selector: { text: {} } },
    { name: 'card_background', label: 'Default card background CSS value', selector: { text: {} } },
    { name: 'title_font_size', label: 'Default title font size', selector: { text: {} } },
    { name: 'title_align', label: 'Default title alignment', selector: { select: { mode: 'dropdown', options: TITLE_ALIGN_OPTIONS } } },
    { name: 'tank_scale', label: 'Default tank scale', selector: { number: { min: 0.25, max: 2, step: 0.05, mode: 'box' } } },
    { name: 'auto_color', label: 'Default auto color', selector: { select: { mode: 'dropdown', options: AUTO_COLOR_OPTIONS } } },
    { name: 'gradient', label: 'Default gradient fill', selector: { boolean: {} } },
    { name: 'sparkline', label: 'Default sparkline', selector: { boolean: {} } },
    { name: 'trend', label: 'Default trend arrow', selector: { boolean: {} } },
  ];

  const ROW_MAIN_SCHEMA = [
    { name: 'title', label: 'Title', selector: { text: {} } },
    { name: 'card_background', label: 'Card background CSS value', selector: { text: {} } },
    { name: 'title_font_size', label: 'Heading font size', selector: { text: {} } },
    { name: 'title_align', label: 'Heading alignment', selector: { select: { mode: 'dropdown', options: TITLE_ALIGN_OPTIONS } } },
    { name: 'orientation', label: 'Orientation', selector: { select: { mode: 'dropdown', options: ROW_ORIENTATION_OPTIONS } } },
    { name: 'row_padding', label: 'Outer padding', selector: { text: {} } },
    { name: 'tank_gap', label: 'Gap between tanks', selector: { text: {} } },
  ];

  const formKeys = (schema) => schema.map((item) => item.name);
  const TANK_FORM_KEYS = formKeys(TANK_FORM_SCHEMA);
  const ROW_TANK_KEYS = formKeys(ROW_TANK_SCHEMA);
  const ROW_DEFAULTS_KEYS = formKeys(ROW_DEFAULTS_SCHEMA);
  const ROW_MAIN_KEYS = formKeys(ROW_MAIN_SCHEMA);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function editorStyles() {
    return `<style>
      .editor{display:grid;gap:14px;padding:8px 0;color:var(--primary-text-color);}
      .section{border:1px solid var(--divider-color,#2f3b45);border-radius:10px;padding:12px;}
      .section h3,.tank-head h3{font-size:1rem;margin:0 0 10px;font-weight:600;}
      .section summary{cursor:pointer;color:var(--primary-text-color);font-weight:600;}
      .field{display:flex;flex-direction:column;gap:5px;font-size:.9rem;margin-top:10px;}
      .field span{color:var(--secondary-text-color);font-size:.8rem;}
      textarea{box-sizing:border-box;width:100%;border:1px solid var(--divider-color,#2f3b45);
        border-radius:8px;padding:8px;background:var(--card-background-color,#111827);color:var(--primary-text-color);}
      textarea{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem;}
      button{border:1px solid var(--divider-color,#2f3b45);border-radius:8px;padding:8px 10px;
        background:var(--secondary-background-color,#1f2937);color:var(--primary-text-color);cursor:pointer;}
      .tank{border:1px dashed var(--divider-color,#2f3b45);border-radius:10px;padding:10px;margin-top:10px;}
      .tank-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .hint{color:var(--secondary-text-color);font-size:.8rem;margin-top:8px;}
      .error{color:var(--error-color,#db4437);font-size:.85rem;min-height:1.2em;}
    </style>`;
  }

  function editorTextarea(key, label, value, placeholder = '') {
    const text = value == null ? '' : JSON.stringify(value, null, 2);
    return `<label class="field"><span>${label}</span>
      <textarea data-json-key="${key}" rows="5" placeholder="${escapeAttr(placeholder)}">${escapeHtml(text)}</textarea>
    </label>`;
  }

  function editorForm(id, schema, data) {
    return `<ha-form id="${id}"></ha-form>`;
  }

  function normalizeFormData(config) {
    const data = Object.assign({}, config);
    if (data.auto_color === true) data.auto_color = 'fresh';
    return data;
  }

  function applyFormValues(base, values, keys) {
    const next = Object.assign({}, base);
    for (const key of keys) {
      const value = values[key];
      if (value === '' || value == null) delete next[key];
      else next[key] = value;
    }
    return next;
  }

  function configureHaForm(form, hass, schema, data) {
    if (!form) return;
    form.hass = hass;
    form.schema = schema;
    form.data = normalizeFormData(data || {});
    form.computeLabel = (item) => item.label || item.name;
  }

  function fireConfigChanged(el, config) {
    el.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  class RvTankLevelCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = Object.assign({}, config);
      if (!this._rendered) this._render();
      else if (!this.matches(':focus-within')) this._updateForms();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this.matches(':focus-within')) this._updateForms();
    }

    connectedCallback() {
      if (!this._bound) {
        this._bound = true;
        this.addEventListener('change', (ev) => this._handleInput(ev));
        this.addEventListener('value-changed', (ev) => this._handleFormChange(ev));
      }
      if (!this._rendered) this._render();
    }

    _render() {
      const cfg = this._config || {};
      this.innerHTML = `${editorStyles()}
        <div class="editor">
          <div class="section">
            <h3>Tank Card</h3>
            ${editorForm('tank-form', TANK_FORM_SCHEMA, cfg)}
          </div>

          <details class="section">
            <summary>Advanced JSON</summary>
              ${editorTextarea('colors', 'Colors', cfg.colors, '{ "fill": "#1a7", "wave": "#3c9" }')}
              ${editorTextarea('ticks', 'Ticks', cfg.ticks, '[0, 25, 50, 75, 100]')}
              ${editorTextarea('markers', 'Markers', cfg.markers, '[{ "value": 85, "label": "FULL" }]')}
              ${editorTextarea('state', 'State rules', cfg.state, '[{ "value": 15, "operator": "<=", "color": "red" }]')}
            <div class="error">${escapeHtml(this._error || '')}</div>
          </details>
        </div>`;
      this._rendered = true;
      this._updateForms();
    }

    _updateForms() {
      configureHaForm(this.querySelector('#tank-form'), this._hass, TANK_FORM_SCHEMA, this._config);
    }

    _handleFormChange(ev) {
      const form = ev.target;
      if (form?.id !== 'tank-form') return;
      ev.stopPropagation();
      const next = applyFormValues(this._config || {}, ev.detail?.value || {}, TANK_FORM_KEYS);
      this._error = '';
      this._config = next;
      fireConfigChanged(this, next);
    }

    _handleInput(ev) {
      const input = ev.target;
      if (!input?.dataset) return;
      const next = Object.assign({}, this._config || {});

      if (input.dataset.jsonKey) {
        const key = input.dataset.jsonKey;
        const text = input.value.trim();
        if (!text) delete next[key];
        else {
          try {
            next[key] = JSON.parse(text);
          } catch (e) {
            this._error = `${key}: invalid JSON`;
            this._render();
            return;
          }
        }
      }

      this._error = '';
      this._config = next;
      fireConfigChanged(this, next);
    }
  }

  class RvTankRowCardEditor extends HTMLElement {
    setConfig(config) {
      const oldCount = Array.isArray(this._config?.tanks) ? this._config.tanks.length : 0;
      const newCount = Array.isArray(config?.tanks) ? config.tanks.length : 0;
      this._config = Object.assign({}, config);
      if (!this._rendered || oldCount !== newCount) this._render();
      else if (!this.matches(':focus-within')) this._updateForms();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this.matches(':focus-within')) this._updateForms();
    }

    connectedCallback() {
      if (!this._bound) {
        this._bound = true;
        this.addEventListener('change', (ev) => this._handleInput(ev));
        this.addEventListener('click', (ev) => this._handleClick(ev));
        this.addEventListener('value-changed', (ev) => this._handleFormChange(ev));
      }
      if (!this._rendered) this._render();
    }

    _render() {
      const cfg = this._config || {};
      const tanks = Array.isArray(cfg.tanks) ? cfg.tanks : [];
      this.innerHTML = `${editorStyles()}
        <div class="editor">
          <div class="section">
            <h3>Row Card</h3>
            ${editorForm('row-main-form', ROW_MAIN_SCHEMA, cfg)}
          </div>

          <div class="section">
            <h3>Defaults</h3>
            ${editorForm('row-defaults-form', ROW_DEFAULTS_SCHEMA, cfg.defaults || {})}
            <div class="hint">Defaults are merged under every tank.</div>
          </div>

          <div class="section">
            <div class="tank-head">
              <h3>Tanks</h3>
              <button type="button" data-action="add-tank">Add Tank</button>
            </div>
            ${tanks.map((tank, idx) => `
              <div class="tank">
                <div class="tank-head">
                  <h3>${escapeHtml(tank.name || tank.entity || `Tank ${idx + 1}`)}</h3>
                  <button type="button" data-action="remove-tank" data-index="${idx}">Remove</button>
                </div>
                <ha-form class="tank-form" data-index="${idx}"></ha-form>
              </div>
            `).join('')}
            <div class="hint">Use YAML for per-tank advanced options not shown here.</div>
          </div>

          <details class="section">
            <summary>Advanced JSON</summary>
            ${editorTextarea('defaults', 'Defaults JSON', cfg.defaults, '{ "shape": "rectangular", "ticks": [0, 50, 100] }')}
            ${editorTextarea('tanks', 'Tanks JSON', cfg.tanks, '[{ "entity": "sensor.black_tank_level", "name": "Black" }]')}
            <div class="error">${escapeHtml(this._error || '')}</div>
          </details>
        </div>`;
      this._rendered = true;
      this._updateForms();
    }

    _updateForms() {
      const cfg = this._config || {};
      configureHaForm(this.querySelector('#row-main-form'), this._hass, ROW_MAIN_SCHEMA, cfg);
      configureHaForm(this.querySelector('#row-defaults-form'), this._hass,
        ROW_DEFAULTS_SCHEMA, cfg.defaults || {});
      this.querySelectorAll('.tank-form').forEach((form) => {
        const idx = Number(form.dataset.index);
        configureHaForm(form, this._hass, ROW_TANK_SCHEMA, (cfg.tanks || [])[idx] || {});
      });
    }

    _handleClick(ev) {
      const action = ev.target?.dataset?.action;
      if (!action) return;
      const next = Object.assign({}, this._config || {});
      const tanks = Array.isArray(next.tanks) ? next.tanks.slice() : [];
      if (action === 'add-tank') {
        tanks.push({ entity: '', name: 'Tank' });
      } else if (action === 'remove-tank') {
        tanks.splice(Number(ev.target.dataset.index), 1);
      }
      next.tanks = tanks;
      this._config = next;
      this._render();
      fireConfigChanged(this, next);
    }

    _handleFormChange(ev) {
      const form = ev.target;
      const value = ev.detail?.value || {};
      const next = Object.assign({}, this._config || {});

      if (form?.id === 'row-main-form') {
        ev.stopPropagation();
        for (const key of ROW_MAIN_KEYS) {
          if (value[key] === '' || value[key] == null) delete next[key];
          else next[key] = value[key];
        }
      } else if (form?.id === 'row-defaults-form') {
        ev.stopPropagation();
        const defaults = applyFormValues(next.defaults || {}, value, ROW_DEFAULTS_KEYS);
        if (Object.keys(defaults).length) next.defaults = defaults;
        else delete next.defaults;
      } else if (form?.classList?.contains('tank-form')) {
        ev.stopPropagation();
        const idx = Number(form.dataset.index);
        const tanks = Array.isArray(next.tanks) ? next.tanks.slice() : [];
        tanks[idx] = applyFormValues(tanks[idx] || {}, value, ROW_TANK_KEYS);
        next.tanks = tanks;
      } else {
        return;
      }

      this._error = '';
      this._config = next;
      fireConfigChanged(this, next);
    }

    _handleInput(ev) {
      const input = ev.target;
      if (!input?.dataset) return;
      const next = Object.assign({}, this._config || {});

      if (input.dataset.jsonKey) {
        const key = input.dataset.jsonKey;
        const text = input.value.trim();
        if (!text) delete next[key];
        else {
          try {
            next[key] = JSON.parse(text);
          } catch (e) {
            this._error = `${key}: invalid JSON`;
            this._render();
            return;
          }
        }
      }

      this._error = '';
      this._config = next;
      fireConfigChanged(this, next);
    }
  }

  // ── Custom element ─────────────────────────────────────────────────────────
  class RvTankLevelCard extends HTMLElement {
    setConfig(config) {
      if (!config.entity) throw new Error('rv-tank-level-card: entity is required');
      this._uid = this._uid || nextInstanceId();
      this.style.display = 'block';
      this.style.width = '100%';
      this.style.minWidth = '0';
      this.style.boxSizing = 'border-box';
      this._config = config;
      this._lastState = undefined;
      this._hasRendered = false;
      this._hist = this._hist || [];
      // Tap → open the entity's more-info dialog (disable with tap_action: none).
      // Bound once; survives innerHTML re-renders since it lives on the element.
      if (!this._tapBound) {
        this._tapBound = true;
        this.addEventListener('click', () => {
          if ((this._config.tap_action || 'more-info') === 'none') return;
          const ev = new Event('hass-more-info', { bubbles: true, composed: true });
          ev.detail = { entityId: this._config.entity };
          this.dispatchEvent(ev);
        });
      }
      this._render();
    }

    set hass(hass) {
      if (!this._config) return;
      const state = hass.states[this._config.entity]?.state;
      if (this._hasRendered && state === this._lastState) return; // skip re-render if unchanged
      this._lastState = state;
      this._hass = hass;
      this._render();
    }

    _render() {
      this.innerHTML = `<ha-card style="${cardBackgroundStyle(this._config)}height:100%;width:100%;min-width:0;box-sizing:border-box;display:flex;">${tankMarkup(this._config, this._hass, this._hist, this._uid)}</ha-card>`;
      this._hasRendered = true;
    }

    getCardSize() { return 4; }

    // Sections (grid) view: pick a compact default footprint. Users can still
    // resize manually, but new cards should not reserve a huge empty block.
    getGridOptions() {
      const cfg    = this._config || {};
      const shape  = (cfg.shape || 'default').toLowerCase();
      const hasTicks = resolveTicks(cfg).length > 0;
      const wide = shape === 'rectangular' || shape === 'flat';
      const columns = wide || hasTicks ? 4 : 3;
      const rows = wide ? 3 : 4;
      return { rows, columns, min_rows: 2, min_columns: 2, max_columns: 8 };
    }

    static getStubConfig() {
      return {
        entity: 'sensor.rv_tank_level',
        name: 'Tank',
        color_scheme: 'blue',
        shape: 'rectangular',
        tank_width: 170,
        tank_height: 120,
        tank_scale: 0.85,
        font_size: 42,
        max_width: 170,
        ticks: false,
      };
    }

    static getConfigElement() {
      return document.createElement('rv-tank-level-card-editor');
    }
  }

  if (!customElements.get('rv-tank-level-card-editor')) {
    customElements.define('rv-tank-level-card-editor', RvTankLevelCardEditor);
  }
  if (!customElements.get('rv-tank-level-card')) {
    customElements.define('rv-tank-level-card', RvTankLevelCard);
  }

  // ── Multi-tank row card ──────────────────────────────────────────────────────
  // Renders several tanks side by side in one card. Each item in `tanks` is a
  // full tank config; `defaults` (optional) is merged under every tank so shared
  // options (shape, ticks, colors…) are written once.
  //
  //   type: custom:rv-tank-row-card
  //   defaults: { shape: rectangular, auto_color: waste }
  //   tanks:
  //     - { entity: sensor.black_tank, name: Black, color_scheme: "#333" }
  //     - { entity: sensor.grey_tank,  name: Grey,  color_scheme: "#6b5a4e" }
  //     - { entity: sensor.fresh_tank, name: Fresh, color_scheme: blue }
  class RvTankRowCard extends HTMLElement {
    setConfig(config) {
      if (!Array.isArray(config.tanks) || !config.tanks.length) {
        throw new Error('rv-tank-row-card: a non-empty `tanks` list is required');
      }
      this._uid = this._uid || nextInstanceId();
      this.style.display = 'block';
      this.style.width = '100%';
      this.style.minWidth = '0';
      this.style.boxSizing = 'border-box';
      this._config = config;
      this._hist = this._hist || {};
      // Delegate taps to the tank under the pointer (open its more-info).
      if (!this._tapBound) {
        this._tapBound = true;
        this.addEventListener('click', (ev) => {
          const col = ev.target?.closest?.('[data-entity]');
          const entity = col?.getAttribute('data-entity');
          if (!entity) return;
          const t = (this._config.tanks.find(x => x.entity === entity)) || {};
          if ((t.tap_action || this._config.defaults?.tap_action || 'more-info') === 'none') return;
          const e = new Event('hass-more-info', { bubbles: true, composed: true });
          e.detail = { entityId: entity };
          this.dispatchEvent(e);
        });
      }
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._config) this._render();
    }

    _render() {
      const cfg = this._config;
      const cols = cfg.tanks.map((t, idx) => {
        const merged = Object.assign({}, cfg.defaults, t);
        const key = (t.entity || '').replace(/\W/g, '_');
        this._hist[key] = this._hist[key] || [];
        return `<div class="rvcol" data-entity="${t.entity}">${
          tankMarkup(merged, this._hass, this._hist[key], `${this._uid}_${key || 'tank'}_${idx}`)}</div>`;
      }).join('');
      const title = cfg.title ? `<div class="rvtitle">${cfg.title}</div>` : '';
      const rowTitleSize = cssSize(cfg.title_font_size, '1rem');
      const rowTitleAlign = titleAlign(cfg.title_align);
      const rowPadding = cssSize(cfg.row_padding, '6px');
      const tankGap = cssSize(cfg.tank_gap, '6px');
      const orientation = rowOrientation(cfg.orientation);
      const rowDirection = orientation === 'vertical' ? 'column' : 'row';
      const rowWrap = orientation === 'vertical' ? 'nowrap' : 'wrap';
      const colFlex = orientation === 'vertical' ? '0 1 auto' : '1 1 120px';
      const colWidth = orientation === 'vertical' ? '100%' : 'auto';
      this.innerHTML = `<ha-card style="${cardBackgroundStyle(cfg)}height:100%;width:100%;min-width:0;box-sizing:border-box;display:flex;flex-direction:column;"><style>
.rvrow{display:flex;flex-direction:${rowDirection};gap:${tankGap};flex-wrap:${rowWrap};justify-content:center;align-items:center;padding:${rowPadding};flex:1;}
.rvcol{display:flex;justify-content:center;flex:${colFlex};width:${colWidth};min-width:0;}
.rvtitle{color:var(--primary-text-color);font-size:${rowTitleSize};font-weight:600;
  padding:10px 14px 0;font-family:var(--ha-card-header-font-family,inherit);
  text-align:${rowTitleAlign};line-height:1.25;}
</style>${title}<div class="rvrow">${cols}</div></ha-card>`;
    }

    getCardSize() { return 4; }
    getGridOptions() {
      return { rows: 4, columns: 6, min_rows: 3, min_columns: 4, max_columns: 12 };
    }
    static getStubConfig() {
      return {
        defaults: {
          shape: 'rectangular',
          tank_width: 120,
          tank_height: 110,
          tank_scale: 0.85,
          font_size: 32,
          max_width: 120,
          ticks: false,
        },
        tanks: [
          { entity: 'sensor.black_tank', name: 'Black', color_scheme: '#333333' },
          { entity: 'sensor.grey_tank',  name: 'Grey',  color_scheme: 'grey' },
        ],
      };
    }

    static getConfigElement() {
      return document.createElement('rv-tank-row-card-editor');
    }
  }

  if (!customElements.get('rv-tank-row-card-editor')) {
    customElements.define('rv-tank-row-card-editor', RvTankRowCardEditor);
  }
  if (!customElements.get('rv-tank-row-card')) {
    customElements.define('rv-tank-row-card', RvTankRowCard);
  }

  // Register with HA card picker (HACS / manual resource discovery)
  window.customCards = window.customCards || [];
  window.customCards.push(
    {
      type: 'rv-tank-level-card',
      name: 'RV Tank Level Card',
      description: 'Animated tank fill visualization for RV black / grey waste tanks',
      preview: true,
    },
    {
      type: 'rv-tank-row-card',
      name: 'RV Tank Row Card',
      description: 'Several animated tank gauges side by side in one card',
      preview: true,
    },
  );
  console.info('%cRV Tank Level Cards%c 0.2.12', 'color:#3a9aca;font-weight:700', 'color:inherit');
})();
