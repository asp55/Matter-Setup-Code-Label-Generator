# Matter Setup Code Label Generator

A static, client-side web app that generates a **[Matter Primary Setup Code label](https://csa-iot.org/wp-content/uploads/2022/11/Matter_Brand-Guidelines_v1.6a.pdf#page=36)** from a Matter onboarding payload (`MT:...`). The label follows the layout in the Matter brand asset: Matter logo lockup, QR code, and the manual pairing code in the CSA Digits font.

Everything runs in the browser. No build step, no backend, and no data leaves the page.

## Features

- Paste a Matter onboarding payload and get a live label preview.
- The manual setup code is derived from the payload automatically:
  - 11 digits (standard commissioning flow), or
  - 21 digits, shown on two rows, when the payload carries a vendor/product ID.
- Selectable QR error correction level (L / M / Q / H).
- Optional 1pt border.
- Export as **PNG** (300 DPI) or **SVG**.
- Invalid payloads show a specific error instead of a silent failure.

## Label specification

| Property | Value |
| --- | --- |
| Width | 22 mm |
| Height | 31 mm (11-digit code) or 33 mm (21-digit code) |
| Corner radius | 1.5 mm |
| Border | Optional, 1pt, inside-aligned |
| QR code | 16 mm square |
| Pairing code | CSA Digits, 6pt, grouped 4-3-4 (11 digits) or 4-3-4 / 4-3-2-1 (21 digits) |

Placement values are measured from the brand asset's template and are fixed, not proportional. See the constants at the top of [matter-label.js](matter-label.js).

## Usage

Open [index.html](index.html) in a modern browser, or serve the folder with any static server:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

1. Paste the Matter onboarding payload (starting with `MT:`) into the payload box.
2. Choose an error correction level and whether to show the border.
3. Check the preview and derived setup code.
4. Click **Download PNG** or **Download SVG**.

## Project structure

| Path | Purpose |
| --- | --- |
| [index.html](index.html) | App page and script loading order |
| [matter-label.js](matter-label.js) | Label rendering (SVG layout, QR, text, border) |
| [matter-label-app.js](matter-label-app.js) | UI wiring, setup-code derivation, PNG/SVG export |
| [style.css](style.css), [matter-label.css](matter-label.css) | Page and label preview styles |
| [vendor/](vendor/) | Third-party and embedded assets (see below) |
| [font/csaf.ttf](font/csaf.ttf) | CSA Digits font |
| [assets/](assets/) | Matter logo SVG |

### Vendored files

- `vendor/qrcode.js`, `vendor/qrcode_UTF8.js`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
- `vendor/matter-payload.js`: Matter payload parsing and manual pairing code derivation, ported from [matter-qr-app](https://github.com/chill-uk/matter-qr-app).
- `vendor/matter-logo.js`, `vendor/csaf-font-base64.js`: the Matter logo and CSA Digits font embedded as JavaScript so exported SVG/PNG files are self-contained.

## Attribution and licensing

The Matter logo lockup and CSA Digits font are provided under the [Matter Brand Guidelines](https://csa-iot.org/logo-and-brand-assets-library/?al_keywords=&al_solution%5B%5D=935&al_lang=) from the Connectivity Standards Alliance (see also the CSA [trademark logo use guide](https://csa-iot.org/logo-and-brand-assets-library/?al_keywords=&al_solution%5B%5D=1064&al_lang=)). Check those guidelines before distributing labels or the assets. Third-party code keeps its original license.
