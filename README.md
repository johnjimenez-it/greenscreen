# Sprint 3 Green Screen Kiosk

This project delivers a fully touch-friendly HTML kiosk experience for the group green screen sprint. Open `index.html` in any modern browser to run the kiosk locally.

## Features

- Guided, touch-first workflow for choosing backgrounds, adding custom uploads, and capturing an identifying selfie.
- Configurable pricing, payment methods, delivery options, and selectable backgrounds via `config.json`.
- Dynamic email and print selections with on-screen keyboard input (no hardware keyboard required).
- Auto-generated two-part receipt with stamp areas, price breakdowns, and operations checklist ready for printing.
- Operator dashboard (`operator.html`) for reviewing logged transactions, updating status buttons, and exporting CSV summaries.

## Customizing the kiosk

1. Update the values in `config.json` to adjust pricing, event names, delivery methods, payment methods, or available backgrounds.
2. Provide new background image URLs or host local assets and update the `backgrounds` array.
3. Open `index.html` in a browser, and the kiosk will reflect the new configuration immediately.

## Development notes

- The kiosk stores completed transactions in `localStorage` and offers a downloadable `records.json` for operator sync.
- All assets are static and require no build step; modify the HTML, CSS, or JavaScript directly as needed.
