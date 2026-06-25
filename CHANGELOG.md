# Changelog

## 0.3.1 - 2026-06-25

- Updates documentation and tooling paths for the renamed GitHub repository: `tank-level-cards`.

## 0.3.0 - 2026-06-25

- Renames user-facing branding to **Tank Level Cards** while keeping existing `custom:rv-*` card types for compatibility.
- Adds `heating_oil` tank shape for horizontal heating oil tanks.
- Adds `pool` tank shape for above-ground pools.
- Updates examples and screenshots for the broader tank scope.

## 0.2.14 - 2026-06-24

- Scopes row-card layout CSS per card instance so vertical and horizontal row cards can coexist on the same dashboard.
- Regenerates README screenshots from the current implementation.

## 0.2.13 - 2026-06-24

- Expands the row-card visual editor so per-tank rows expose the same scalar options as single-tank cards.
- Adds more row-card default controls for scalar tank options such as tap action, value formatting, sizing, secondary text, and rectangular dimensions.

## 0.2.12 - 2026-06-24

- Fixes repeated tank cards clipping or losing left edges in stacks by making SVG ids unique per card instance.
- Allows SVG stroke/glow overflow so tank edges remain visible in compact layouts.

## 0.2.11 - 2026-06-24

- Fixes single tank cards overlapping when placed inside Home Assistant horizontal stacks.
- Makes card hosts and wrappers flex-item safe with explicit block width and `min-width: 0`.

## 0.2.10 - 2026-06-24

- Adds row-card `orientation` with `horizontal` and `vertical` layouts.

## 0.2.9 - 2026-06-24

- Adds row-card `row_padding` and `tank_gap` layout controls.

## 0.2.8 - 2026-06-24

- Improves Home Assistant Sections defaults so new single-tank cards use a compact grid footprint.
- Centers card content vertically and horizontally inside resized Sections blocks.
- Reduces the default row-card Sections footprint.
- Draws propane foot-ring decoration behind the tank shell instead of in front.

## 0.2.7 - 2026-06-24

- Adds configurable title font size and alignment for tank titles and row-card headings.
- Keeps wrapped two-line titles aligned instead of falling back to left alignment.
- Adds `tank_scale` for shrinking or enlarging tank SVGs inside cramped dashboard blocks.

## 0.2.6 - 2026-06-24

- Makes the empty SVG tank interior theme-aware instead of using a dark scheme background by default.
- Scales card picker stub configs so Home Assistant previews fit the picker tiles.
- Makes tank caps and fittings follow the tank background and border colors.

## 0.2.5 - 2026-06-24

- Fixes the Home Assistant card picker preview for single-tank cards when the stub entity does not exist.

## 0.2.4 - 2026-06-24

- Improves percentage and secondary-text contrast against auto-colored or state-colored liquid fills.

## 0.2.3 - 2026-06-24

- Adds `card_background` support for `transparent`, `none`, or any CSS background value.
- Exposes card background styling in the visual editors.

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
