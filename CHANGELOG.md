# Changelog

## 0.2.2 - 2026-06-24

- Prevents the visual editor from rebuilding its DOM while a field has focus, fixing number inputs jumping back to the top while typing.

## 0.2.1 - 2026-06-24

- Restores the root `rv-tank-level-card.js` artifact for HACS/resource URL compatibility.
- Points `hacs.json` back at the root artifact so existing HACS installs update the file HA loads.

## 0.2.0 - 2026-06-24

- Reworks the visual editors to use Home Assistant's native `ha-form` controls.
- Adds entity selectors and structured controls for row-card tanks and defaults.
- Guards custom element registration for safer reloads.

## 0.1.0 - 2026-06-24

- Initial local development setup for RV Tank Level Cards.
- Preserves the existing Home Assistant card behavior while moving editable source to `src/`.
- Adds Home Assistant visual editor support for single-tank and row cards.
