import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const imageDir = resolve(root, 'images');
const tmpDir = resolve('/var/folders/46/k7lvmswn02xfsh91kk_xc7t80000gn/T/opencode', 'rv-level-cards-screenshots');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

mkdirSync(imageDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const cardScript = `file://${resolve(root, 'rv-tank-level-card.js')}`;

const states = {
  'sensor.black_tank_level': { state: '66', attributes: { unit_of_measurement: '%' } },
  'sensor.grey_tank_level': { state: '72', attributes: { unit_of_measurement: '%' } },
  'sensor.fresh_water_level': { state: '47', attributes: { unit_of_measurement: '%' } },
  'sensor.propane_level': { state: '48', attributes: { unit_of_measurement: '%', capacity: '30' } },
  'sensor.low_tank': { state: '13', attributes: { unit_of_measurement: '%' } },
  'sensor.mid_tank': { state: '55', attributes: { unit_of_measurement: '%' } },
  'sensor.full_tank': { state: '91', attributes: { unit_of_measurement: '%' } },
  'sensor.one': { state: '66', attributes: { unit_of_measurement: '%' } },
  'sensor.two': { state: '48', attributes: { unit_of_measurement: '%' } },
};

const baseCss = `
  :root {
    --ha-card-background: #ffffff;
    --card-background-color: #ffffff;
    --primary-text-color: #111827;
    --secondary-text-color: #6b7280;
    --divider-color: #d7dbe2;
    --ha-card-border-radius: 12px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 22px;
    background: #f5f6f8;
    color: var(--primary-text-color);
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  ha-card {
    display: block;
    background: var(--ha-card-background);
    border: 1px solid rgba(17,24,39,.10);
    border-radius: var(--ha-card-border-radius);
    box-shadow: 0 1px 3px rgba(15,23,42,.08);
    overflow: visible;
  }
  .wrap { display: flex; gap: 18px; align-items: center; justify-content: center; }
  .grid { display: grid; gap: 18px; align-items: center; justify-content: center; }
  .two { grid-template-columns: repeat(2, 300px); }
  .three { grid-template-columns: repeat(3, 230px); }
  .four { grid-template-columns: repeat(4, 180px); }
  .cardbox { width: 100%; min-width: 0; }
  .dark {
    --ha-card-background: #111827;
    --card-background-color: #111827;
    --primary-text-color: #f8fafc;
    --secondary-text-color: #cbd5e1;
    --divider-color: #334155;
    background: #0f172a;
    padding: 18px;
    border-radius: 18px;
  }
  .light {
    background: #f8fafc;
    padding: 18px;
    border-radius: 18px;
  }
`;

function configScript(configs) {
  return `
    const hass = { states: ${JSON.stringify(states)} };
    for (const item of ${JSON.stringify(configs)}) {
      const el = document.createElement(item.type);
      el.className = 'cardbox';
      el.setConfig(item.config);
      el.hass = hass;
      document.getElementById(item.target || 'cards').appendChild(el);
    }
  `;
}

function html(body, configs = [], extraCss = '') {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseCss}${extraCss}</style>
  <script src="${cardScript}"></script>
</head>
<body>
${body}
<script>${configScript(configs)}</script>
</body>
</html>`;
}

function shot(name, width, height, body, configs, extraCss = '') {
  const htmlPath = resolve(tmpDir, `${name}.html`);
  const outPath = resolve(imageDir, `${name}.png`);
  writeFileSync(htmlPath, html(body, configs, extraCss));
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--hide-scrollbars',
    `--window-size=${width},${height}`,
    '--virtual-time-budget=1500',
    `--screenshot=${outPath}`,
    `file://${htmlPath}`,
  ], { stdio: 'inherit' });
}

const tank = (config) => ({ type: 'rv-tank-level-card', config });
const row = (config) => ({ type: 'rv-tank-row-card', config });

shot('shapes', 820, 330, '<div id="cards" class="grid three"></div>', [
  tank({ entity: 'sensor.black_tank_level', name: 'Jerry Can', color_scheme: '#2f343b', shape: 'default', tank_scale: 0.82, max_width: 180 }),
  tank({ entity: 'sensor.fresh_water_level', name: 'Flat Fresh Tank', color_scheme: 'blue', shape: 'rectangular', tank_width: 220, tank_height: 130, tank_scale: 0.9, max_width: 190 }),
  tank({ entity: 'sensor.propane_level', name: 'Propane Bottle', color_scheme: '#f0b44f', shape: 'propane', gradient: true, tank_scale: 0.78, max_width: 170 }),
]);

shot('colors', 860, 290, '<div id="cards" class="grid four"></div>', [
  tank({ entity: 'sensor.fresh_water_level', name: 'Blue', color_scheme: 'blue', shape: 'rectangular', tank_width: 190, tank_height: 120, max_width: 150, tank_scale: 0.86 }),
  tank({ entity: 'sensor.mid_tank', name: 'Teal', color_scheme: '#0f9f8f', shape: 'rectangular', tank_width: 190, tank_height: 120, max_width: 150, tank_scale: 0.86 }),
  tank({ entity: 'sensor.propane_level', name: 'Propane', color_scheme: '#f0b44f', shape: 'propane', gradient: true, max_width: 130, tank_scale: 0.78 }),
  tank({ entity: 'sensor.full_tank', name: 'Waste', color_scheme: '#5a4638', auto_color: 'waste', shape: 'rectangular', tank_width: 190, tank_height: 120, max_width: 150, tank_scale: 0.86 }),
]);

shot('value-styling', 760, 310, '<div id="cards" class="grid three"></div>', [
  tank({ entity: 'sensor.full_tank', name: 'Comfortable', shape: 'rectangular', tank_width: 190, tank_height: 120, max_width: 155, tank_scale: 0.9, state: [{ value: 50, operator: '>=', color: 'rgba(34,197,94,.16)', fill: '#22c55e' }] }),
  tank({ entity: 'sensor.mid_tank', name: 'Watch', shape: 'rectangular', tank_width: 190, tank_height: 120, max_width: 155, tank_scale: 0.9, state: [{ value: 50, operator: '>=', color: 'rgba(245,158,11,.18)', fill: '#f59e0b' }] }),
  tank({ entity: 'sensor.low_tank', name: 'Low', shape: 'rectangular', tank_width: 190, tank_height: 120, max_width: 155, tank_scale: 0.9, state: [{ value: 20, operator: '<=', color: 'rgba(239,68,68,.16)', fill: '#ef4444', blink: true }] }),
]);

shot('ticks', 760, 330, '<div id="cards" class="grid three"></div>', [
  tank({ entity: 'sensor.fresh_water_level', name: 'Default Ticks', color_scheme: 'blue', shape: 'rectangular', tank_width: 190, tank_height: 130, max_width: 185, ticks: [0, 33, 66, 100] }),
  tank({ entity: 'sensor.mid_tank', name: 'Custom Labels', color_scheme: '#0f9f8f', shape: 'rectangular', tank_width: 190, tank_height: 130, max_width: 185, ticks: [{ value: 20, label: 'LOW', color: '#ef4444' }, { value: 50, label: 'MID' }, { value: 90, label: 'FULL', color: '#22c55e' }] }),
  tank({ entity: 'sensor.propane_level', name: 'Hidden Ticks', color_scheme: '#f0b44f', shape: 'propane', gradient: true, max_width: 150, ticks: false }),
]);

shot('features', 820, 340, '<div id="cards" class="grid three"></div>', [
  tank({ entity: 'sensor.fresh_water_level', name: 'Markers', color_scheme: 'blue', shape: 'rectangular', tank_width: 200, tank_height: 130, max_width: 180, markers: [{ value: 90, label: 'FULL', color: '#f59e0b' }, { value: 20, label: 'LOW', color: '#ef4444' }] }),
  tank({ entity: 'sensor.propane_level', name: 'Secondary', color_scheme: '#f0b44f', shape: 'propane', gradient: true, max_width: 155, secondary: '{state}% / {attr:capacity} lb' }),
  tank({ entity: 'sensor.full_tank', name: 'Auto Waste', auto_color: 'waste', shape: 'rectangular', tank_width: 200, tank_height: 130, max_width: 180, trend: true, sparkline: true }),
]);

shot('multi-tank', 1020, 520, '<div id="cards" class="grid two"></div>', [
  row({ title: 'Horizontal Holding Tanks', orientation: 'horizontal', row_padding: 6, tank_gap: 6, defaults: { shape: 'rectangular', tank_width: 145, tank_height: 115, max_width: 105, tank_scale: 0.8, ticks: false }, tanks: [
    { entity: 'sensor.black_tank_level', name: 'Black', color_scheme: '#333333' },
    { entity: 'sensor.grey_tank_level', name: 'Grey', color_scheme: 'grey' },
    { entity: 'sensor.fresh_water_level', name: 'Fresh', color_scheme: 'blue' },
  ] }),
  row({ title: 'Vertical Tank Row', orientation: 'vertical', row_padding: 4, tank_gap: 4, defaults: { shape: 'rectangular', tank_width: 170, tank_height: 70, max_width: 180, tank_scale: 0.78, ticks: false, title_font_size: '0.68rem' }, tanks: [
    { entity: 'sensor.black_tank_level', name: 'Black', color_scheme: '#333333' },
    { entity: 'sensor.grey_tank_level', name: 'Grey', color_scheme: 'grey' },
    { entity: 'sensor.fresh_water_level', name: 'Fresh', color_scheme: 'blue' },
  ] }),
], '.two { grid-template-columns: 470px 360px; }');

shot('theming', 820, 350, '<div class="wrap"><div id="light" class="light wrap"></div><div id="dark" class="dark wrap"></div></div>', [
  { ...tank({ entity: 'sensor.fresh_water_level', name: 'Light Theme', color_scheme: 'blue', shape: 'rectangular', tank_width: 200, tank_height: 130, max_width: 180, card_background: 'transparent' }), target: 'light' },
  { ...tank({ entity: 'sensor.propane_level', name: 'Dark Theme', color_scheme: '#f0b44f', shape: 'propane', gradient: true, max_width: 150, card_background: 'transparent' }), target: 'dark' },
]);

console.log('Generated screenshots in images/');
