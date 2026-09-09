(function () {
  const PNG_EXPORT_DPI = 300;

  const qrPayloadEl = document.getElementById('qrPayload');
  const ecLevelEl = document.getElementById('ecLevel');
  const derivedCodeEl = document.getElementById('derivedCode');
  const showBorderEl = document.getElementById('showBorder');
  const errorMsgEl = document.getElementById('errorMsg');
  const metaInfoEl = document.getElementById('metaInfo');
  const previewEl = document.getElementById('labelPreview');
  const downloadPngBtn = document.getElementById('downloadPng');
  const downloadSvgBtn = document.getElementById('downloadSvg');

  let lastSvg = null;
  let lastMeta = null;

  function setError(message) {
    if (message) {
      errorMsgEl.textContent = message;
      errorMsgEl.hidden = false;
    } else {
      errorMsgEl.hidden = true;
      errorMsgEl.textContent = '';
    }
  }

  // Derives the manual pairing code from the QR payload. Throws with a
  // specific message either when the payload isn't a Matter "MT:" payload
  // at all, or when it is one but fails to decode (bad base38 characters,
  // truncated data, non-zero padding bits, etc).
  function deriveSetupDigits(qrPayload) {
    if (!qrPayload) throw new Error('QR payload is required.');
    if (!MatterPayload.extractMatterQrPayload(qrPayload)) {
      throw new Error('Could not derive a setup code: the QR payload must be a Matter onboarding payload starting with "MT:".');
    }
    return MatterPayload.generateManualPairingCode(qrPayload);
  }

  function currentOptions() {
    return {
      qrPayload: qrPayloadEl.value.trim(),
      ecLevel: ecLevelEl.value,
      showBorder: showBorderEl.checked,
    };
  }

  function render() {
    const opts = currentOptions();
    let result;
    try {
      opts.setupDigits = deriveSetupDigits(opts.qrPayload);
      result = MatterLabel.buildLabelSvg(opts);
    } catch (err) {
      setError(err.message || String(err));
      lastSvg = null;
      lastMeta = null;
      previewEl.innerHTML = '';
      metaInfoEl.textContent = '';
      derivedCodeEl.value = '—';
      return;
    }
    setError(null);
    derivedCodeEl.value = opts.setupDigits;
    lastSvg = result.svg;
    lastMeta = result.meta;
    previewEl.innerHTML = result.svg;
    metaInfoEl.textContent =
      result.meta.cardWidthMm + '×' + result.meta.cardHeightMm + ' mm · QR version ' + result.meta.version +
      ' (EC ' + opts.ecLevel + ') · ' + result.meta.moduleCount + '×' + result.meta.moduleCount + ' modules · ' +
      result.meta.moduleSizeMm.toFixed(3) + ' mm/module';
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  const debouncedRender = debounce(render, 150);

  qrPayloadEl.addEventListener('input', debouncedRender);
  [ecLevelEl, showBorderEl].forEach((el) =>
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

  downloadSvgBtn.addEventListener('click', () => {
    if (!lastSvg) return;
    const blob = new Blob([lastSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'matter-setup-code-label.svg');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  downloadPngBtn.addEventListener('click', () => {
    if (!lastSvg || !lastMeta) return;
    const widthPx = Math.round((lastMeta.cardWidthMm / 25.4) * PNG_EXPORT_DPI);
    const heightPx = Math.round((lastMeta.cardHeightMm / 25.4) * PNG_EXPORT_DPI);

    const blob = new Blob([lastSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        const pngUrl = URL.createObjectURL(pngBlob);
        triggerDownload(pngUrl, 'matter-setup-code-label.png');
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Could not rasterize the label to PNG.');
    };
    img.src = url;
  });

  render();
}());
