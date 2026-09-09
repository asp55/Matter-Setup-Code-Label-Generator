(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Matter "Primary Setup Code" label.
  //
  // Layout numbers below (logo/QR/pairing-code placement, sizes, border)
  // are taken directly off the Matter brand asset's Primary Setup Code
  // template -- they are exact, not derived/proportional.
  //
  // Card: 22mm wide, 31mm tall for an 11-digit (standard) setup code, or
  // 33mm tall for a 21-digit (custom) one, since that renders as two rows.
  // 1.5mm corner radius, optional 1pt (0.35mm) inside-aligned border.
  // Numeric code: CSA Digits font, fixed 6pt, grouped 4-3-4 (11 digits) or
  // 4-3-4 / 4-3-2-1 (21 digits, two rows).
  // ---------------------------------------------------------------------

  const MM_PER_PT = 25.4 / 72;
  const WHITE = '#FFFFFF';
  const INK = '#000000';

  const CARD_WIDTH_MM = 22;
  const CARD_HEIGHT_STANDARD_MM = 31; // 11-digit setup code
  const CARD_HEIGHT_CUSTOM_MM = 33; // 21-digit setup code (two rows)
  const CORNER_RADIUS_MM = 1.5;
  const BORDER_MM = 1 * MM_PER_PT; // 1pt = 0.3528mm

  // Fixed placements measured off the brand asset (mm, top-left origin).
  const LOGO = { x: 2.518, y: 2.033, width: 16.818, height: 3.608 };
  const QR = { x: 3, y: 8.05, size: 16 };
  const PAIRING_CODE = { fontSizePt: 6, topCenterX: 11, topCenterY: 26.677 };

  // CSA Digits' own cap-height metric (OS/2.sCapHeight = 721/1000 em,
  // checked directly against font/csaf.ttf), used to convert the asset's
  // "top" y-coordinate for the pairing code into an SVG text baseline.
  // Using this explicit font metric -- rather than a specific glyph's ink
  // bounds -- keeps the position identical no matter which digits appear.
  const CAP_HEIGHT_EM = 0.721;
  const LINE_HEIGHT_FACTOR = 1.25; // row-to-row pitch for a 21-digit code, as a multiple of font size
  const ROW_GAP_FACTOR = 0.35; // extra breathing room between the two rows
  const ROW2_SHIFT_UP_MM = 1.558; // nudges the second row up, matching the brand asset

  const ALPHANUMERIC_RE = /^[0-9A-Z $%*+\-./:]*$/;
  const NUMERIC_RE = /^[0-9]*$/;
  function pickMode(text) {
    if (NUMERIC_RE.test(text)) return 'Numeric';
    if (ALPHANUMERIC_RE.test(text)) return 'Alphanumeric';
    return 'Byte';
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    }[c]));
  }

  // Group raw digits per the Matter numeric-setup-code spec:
  // 11 digits -> one row, 4-3-4. 21 digits -> two rows, 4-3-4 then 4-3-2-1.
  function formatSetupCode(digits) {
    if (!/^\d+$/.test(digits)) {
      throw new Error('Setup code must contain only digits.');
    }
    if (digits.length === 11) {
      return [group(digits, [4, 3, 4])];
    }
    if (digits.length === 21) {
      return [
        group(digits.slice(0, 11), [4, 3, 4]),
        group(digits.slice(11), [4, 3, 2, 1]),
      ];
    }
    throw new Error('Setup code must be exactly 11 digits (standard) or 21 digits (custom).');
  }

  function group(digits, sizes) {
    const parts = [];
    let i = 0;
    for (const size of sizes) {
      parts.push(digits.slice(i, i + size));
      i += size;
    }
    return parts.join('-');
  }

  function buildQrModulePath(qr, moduleSize, originX, originY) {
    const n = qr.getModuleCount();
    let d = '';
    const rect = 'l' + moduleSize + ',0 0,' + moduleSize + ' -' + moduleSize + ',0 0,-' + moduleSize + 'z ';
    for (let r = 0; r < n; r += 1) {
      const y = originY + r * moduleSize;
      for (let c = 0; c < n; c += 1) {
        if (qr.isDark(r, c)) {
          const x = originX + c * moduleSize;
          d += 'M' + x + ',' + y + rect;
        }
      }
    }
    return d;
  }

  // Builds the label as a self-contained SVG string (mm units via viewBox),
  // with the CSA Digits font embedded as a base64 data URI so the exported
  // file needs no external font/asset files.
  function buildLabelSvg(opts) {
    const { qrPayload, ecLevel, setupDigits, showBorder } = opts;

    if (!qrPayload) throw new Error('QR payload is required.');
    const codeLines = formatSetupCode(setupDigits);
    const numRows = codeLines.length;
    const cardHeight = numRows === 2 ? CARD_HEIGHT_CUSTOM_MM : CARD_HEIGHT_STANDARD_MM;

    const qr = qrcode(0, ecLevel);
    qr.addData(qrPayload, pickMode(qrPayload));
    qr.make();
    const moduleCount = qr.getModuleCount();
    const moduleSize = QR.size / moduleCount;

    const fontSizeMm = PAIRING_CODE.fontSizePt * MM_PER_PT;
    const capHeightMm = fontSizeMm * CAP_HEIGHT_EM;

    const qrPathD = buildQrModulePath(qr, moduleSize, QR.x, QR.y);

    const textLines = codeLines.map((line, i) => {
      const y = PAIRING_CODE.topCenterY + (i === 0
        ? capHeightMm
        : fontSizeMm * (CAP_HEIGHT_EM + LINE_HEIGHT_FACTOR + ROW_GAP_FACTOR) - ROW2_SHIFT_UP_MM);
      return `<text x="${PAIRING_CODE.topCenterX.toFixed(3)}" y="${y.toFixed(3)}" text-anchor="middle" ` +
        `font-family="CSA Digits" font-size="${fontSizeMm.toFixed(3)}" fill="${INK}">${escapeXml(line)}</text>`;
    }).join('');

    const logoScaleX = LOGO.width / MATTER_LOGO_VIEWBOX.width;
    const logoScaleY = LOGO.height / MATTER_LOGO_VIEWBOX.height;

    // A plain centered 1pt stroke: the rect path is inset by half the
    // border width on each side (0.5pt), so the stroke's outer edge -- not
    // the path itself -- lands exactly on the card's nominal 22 x
    // cardHeight boundary.
    const borderStroke = showBorder ? BORDER_MM : 0;
    const half = borderStroke / 2;
    const cardRect = `<rect x="${half.toFixed(4)}" y="${half.toFixed(4)}" ` +
      `width="${(CARD_WIDTH_MM - borderStroke).toFixed(4)}" height="${(cardHeight - borderStroke).toFixed(4)}" ` +
      `rx="${CORNER_RADIUS_MM}" ry="${CORNER_RADIUS_MM}" fill="${WHITE}" ` +
      (showBorder ? `stroke="${INK}" stroke-width="${BORDER_MM.toFixed(4)}"` : '') + `/>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_WIDTH_MM} ${cardHeight}" ` +
      `width="${CARD_WIDTH_MM}mm" height="${cardHeight}mm">` +
      `<defs><style>@font-face{font-family:'CSA Digits';src:url(data:font/ttf;base64,${CSA_DIGITS_FONT_BASE64}) format('truetype');}</style></defs>` +
      cardRect +
      `<g transform="translate(${LOGO.x},${LOGO.y}) scale(${logoScaleX.toFixed(6)},${logoScaleY.toFixed(6)})">` +
      `<path d="${MATTER_LOGO_PATH_D}" fill="${INK}"/></g>` +
      `<path d="${qrPathD}" fill="${INK}"/>` +
      textLines +
      `</svg>`;

    return {
      svg,
      meta: {
        version: Math.ceil((moduleCount - 17) / 4),
        moduleCount,
        moduleSizeMm: moduleSize,
        cardWidthMm: CARD_WIDTH_MM,
        cardHeightMm: cardHeight,
        fontSizePt: PAIRING_CODE.fontSizePt,
      },
    };
  }

  window.MatterLabel = { buildLabelSvg, formatSetupCode };
}());
