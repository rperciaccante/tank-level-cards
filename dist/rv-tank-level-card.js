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
                 fill="#101822" stroke="#1c2a38" stroke-width="2"/>
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
                 fill="#101822" stroke="#1c2a38" stroke-width="2"/>`,
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
               fill="#101822" stroke="#1c2a38" stroke-width="2"/>
         <rect x="99" y="5" width="42" height="29" rx="6"
               fill="#080e16" stroke="#16222e" stroke-width="1.5"/>`,
    };
  }

  // ── Card markup builder ──────────────────────────────────────────────────────
  // Builds the <style> + tank <div> for one tank (no <ha-card> wrapper, so it
  // can be reused by both the single card and the multi-tank row card).
  //   cfg  — this tank's config
  //   hass — Home Assistant object (may be null before first update)
  //   hist — per-tank array used for the in-memory sparkline / trend
  function tankMarkup(cfg, hass, hist) {
    const name = cfg.name || cfg.entity;
    const c    = resolveScheme(cfg);
    const uid  = (cfg.entity || 'tank').replace(/\W/g, '_');
    const mw   = cfg.max_width;
    const maxW = (mw == null) ? '280px'
               : (mw === 'none' || mw === 'full') ? 'none'
               : (typeof mw === 'number' || /^\d+$/.test(mw)) ? `${parseInt(mw, 10)}px`
               : String(mw);

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

    return `
<style>
.rv${uid}{background:var(--ha-card-background,var(--card-background-color,#080c14));
  border-radius:var(--ha-card-border-radius,12px);padding:10px 6px 6px;
  display:flex;flex-direction:column;align-items:center;flex:1;min-width:120px;
  cursor:${tapCursor};}
.rv${uid} .nm{color:var(--secondary-text-color,#6a7a8a);font-size:.75rem;
  font-family:var(--ha-card-header-font-family,ui-sans-serif,sans-serif);
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:2px;}
.rv${uid} svg{width:100%;max-width:${maxW};height:auto;display:block;margin:0 auto;}
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
    ${g.decor}

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
          fill="${c.text}" font-size="${fontSize}" font-weight="700"
          font-family="ui-sans-serif,system-ui,sans-serif" opacity=".95">${label}</text>
    ${secondary ? `<text x="${cx}" y="${f(secY)}" text-anchor="middle"
          dominant-baseline="middle" fill="${c.text}" font-size="${f(fontSize * 0.32)}"
          font-family="ui-sans-serif,sans-serif" opacity=".7">${secondary}</text>` : ''}
  </svg>
</div>`;
  }

  // ── Custom element ─────────────────────────────────────────────────────────
  class RvTankLevelCard extends HTMLElement {
    setConfig(config) {
      if (!config.entity) throw new Error('rv-tank-level-card: entity is required');
      this._config = config;
      this._lastState = undefined;
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
    }

    set hass(hass) {
      if (!this._config) return;
      const state = hass.states[this._config.entity]?.state;
      if (state === this._lastState) return; // skip re-render if unchanged
      this._lastState = state;
      this._hass = hass;
      this._render();
    }

    _render() {
      this.innerHTML = `<ha-card>${tankMarkup(this._config, this._hass, this._hist)}</ha-card>`;
    }

    getCardSize() { return 4; }

    // Sections (grid) view: default the card's height to the tank's aspect
    // ratio so a flat/wide tank doesn't reserve tall empty space. Calibrated
    // against the default shape (aspect 360/280 → 6 rows at 6 columns); other
    // shapes/sizes scale from there. Still drag-resizable between the bounds.
    getGridOptions() {
      const cfg    = this._config || {};
      const shape  = (cfg.shape || 'default').toLowerCase();
      const gutter = resolveTicks(cfg).length ? 60 : 18;
      const g      = tankGeometry(shape, cfg, {}, 'grid', gutter);
      const R0      = 360 / 280;             // default-shape aspect ratio
      const columns = 6;
      const rows    = Math.max(2, Math.round(columns * (g.vbH / g.vbW) / R0));
      return { rows, columns, min_rows: 2, min_columns: 3, max_columns: 12 };
    }

    static getStubConfig() {
      return { entity: 'sensor.rv_tank_level', name: 'Tank', color_scheme: 'blue' };
    }
  }

  customElements.define('rv-tank-level-card', RvTankLevelCard);

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
    }

    set hass(hass) {
      this._hass = hass;
      if (this._config) this._render();
    }

    _render() {
      const cfg = this._config;
      const cols = cfg.tanks.map(t => {
        const merged = Object.assign({}, cfg.defaults, t);
        const key = (t.entity || '').replace(/\W/g, '_');
        this._hist[key] = this._hist[key] || [];
        return `<div class="rvcol" data-entity="${t.entity}" style="flex:1;min-width:120px;display:flex;">${
          tankMarkup(merged, this._hass, this._hist[key])}</div>`;
      }).join('');
      const title = cfg.title ? `<div class="rvtitle">${cfg.title}</div>` : '';
      this.innerHTML = `<ha-card><style>
.rvrow{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;padding:6px;}
.rvtitle{color:var(--primary-text-color);font-size:1rem;font-weight:600;
  padding:10px 14px 0;font-family:var(--ha-card-header-font-family,inherit);}
</style>${title}<div class="rvrow">${cols}</div></ha-card>`;
    }

    getCardSize() { return 4; }
    getGridOptions() {
      return { rows: 6, columns: 12, min_rows: 3, min_columns: 4, max_columns: 12 };
    }
    static getStubConfig() {
      return { tanks: [
        { entity: 'sensor.black_tank', name: 'Black', color_scheme: '#333333' },
        { entity: 'sensor.grey_tank',  name: 'Grey',  color_scheme: 'grey' },
      ] };
    }
  }

  customElements.define('rv-tank-row-card', RvTankRowCard);

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
})();
