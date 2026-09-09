(function () {
  const dataEl = document.getElementById('data');
  const ecLevelEl = document.getElementById('ecLevel');
  const versionEl = document.getElementById('version');
  const sizeEl = document.getElementById('size');
  const marginEl = document.getElementById('margin');
  const fgColorEl = document.getElementById('fgColor');
  const bgColorEl = document.getElementById('bgColor');
  const errorMsgEl = document.getElementById('errorMsg');
  const metaInfoEl = document.getElementById('metaInfo');
  const canvas = document.getElementById('qrCanvas');
  const ctx = canvas.getContext('2d');
  const downloadPngBtn = document.getElementById('downloadPng');
  const downloadSvgBtn = document.getElementById('downloadSvg');

  let lastQr = null;
  let lastModuleCount = 0;

  const ALPHANUMERIC_RE = /^[0-9A-Z $%*+\-./:]*$/;
  const NUMERIC_RE = /^[0-9]*$/;

  // The vendored qrcode-generator library defaults addData() to Byte mode,
  // which wastes bits for numeric/alphanumeric payloads and can bump the
  // QR to an unnecessarily large version. Pick the most compact mode
  // ourselves, same as Python's qrcode library does automatically.
  function pickMode(text) {
    if (NUMERIC_RE.test(text)) return 'Numeric';
    if (ALPHANUMERIC_RE.test(text)) return 'Alphanumeric';
    return 'Byte';
  }

  // Populate version select: 0 = Auto, 1-40 = fixed type number.
  for (let v = 1; v <= 40; v += 1) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = 'Version ' + v;
    versionEl.appendChild(opt);
  }

  function setError(message) {
    if (message) {
      errorMsgEl.textContent = message;
      errorMsgEl.hidden = false;
    } else {
      errorMsgEl.hidden = true;
      errorMsgEl.textContent = '';
    }
  }

  function render() {
    const text = dataEl.value;
    const ecLevel = ecLevelEl.value;
    const typeNumber = parseInt(versionEl.value, 10);
    const cellSize = Math.max(1, parseInt(sizeEl.value, 10) || 1);
    const margin = Math.max(0, parseInt(marginEl.value, 10) || 0);
    const fg = fgColorEl.value;
    const bg = bgColorEl.value;

    if (!text) {
      setError(null);
      metaInfoEl.textContent = '';
      lastQr = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    let qr;
    try {
      qr = qrcode(typeNumber, ecLevel);
      qr.addData(text, pickMode(text));
      qr.make();
    } catch (err) {
      setError('Could not encode this input: ' + err + '. Try a shorter payload, a lower error-correction level, or a higher fixed version.');
      return;
    }

    setError(null);
    lastQr = qr;
    lastModuleCount = qr.getModuleCount();

    const pixelSize = (lastModuleCount + margin * 2) * cellSize;
    canvas.width = pixelSize;
    canvas.height = pixelSize;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, pixelSize, pixelSize);
    ctx.fillStyle = fg;
    for (let row = 0; row < lastModuleCount; row += 1) {
      for (let col = 0; col < lastModuleCount; col += 1) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            (col + margin) * cellSize,
            (row + margin) * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }

    const usedVersion = Math.ceil((lastModuleCount - 17) / 4);
    metaInfoEl.textContent =
      'Version ' + usedVersion + ' · EC ' + ecLevel + ' · ' +
      lastModuleCount + '×' + lastModuleCount + ' modules';
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  const debouncedRender = debounce(render, 150);

  [dataEl].forEach((el) => el.addEventListener('input', debouncedRender));
  [ecLevelEl, versionEl, sizeEl, marginEl, fgColorEl, bgColorEl].forEach((el) =>
    el.addEventListener('input', render)
  );

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  downloadPngBtn.addEventListener('click', () => {
    if (!lastQr) return;
    triggerDownload(canvas.toDataURL('image/png'), 'qrcode.png');
  });

  downloadSvgBtn.addEventListener('click', () => {
    if (!lastQr) return;
    const cellSize = Math.max(1, parseInt(sizeEl.value, 10) || 1);
    const margin = Math.max(0, parseInt(marginEl.value, 10) || 0);
    let svg = lastQr.createSvgTag({
      cellSize: cellSize,
      margin: margin,
      scalable: true,
    });
    svg = svg
      .replace('fill="white"', 'fill="' + bgColorEl.value + '"')
      .replace('fill="black"', 'fill="' + fgColorEl.value + '"');
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'qrcode.svg');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  render();
}());
