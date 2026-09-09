// Matter ("MT:") onboarding-payload decoding and manual-pairing-code
// derivation, per the Matter core specification's QR-code / manual-pairing-
// code onboarding payload format.
//
// Ported from the MIT-style open-source "matter-qr-app" project:
// https://github.com/chill-uk/matter-qr-app (web/app.js), which implements
// the same base38 decode + bit-field layout + Verhoeff checksum used by the
// reference matter.js / CHIP SDK tooling.

const MATTER_QR_PREFIX = 'MT:';
const MATTER_BASE38_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-.';
const MATTER_LONG_TO_SHORT_DISCRIMINATOR_SHIFT = 8;
const STANDARD_COMMISSIONING_FLOW = 0;

function extractMatterQrPayload(text) {
  if (!text) return '';

  for (const segment of text.trim().split('%')) {
    const normalizedSegment = segment.trim().toUpperCase();
    if (normalizedSegment.startsWith(MATTER_QR_PREFIX) && normalizedSegment.length > MATTER_QR_PREFIX.length) {
      return normalizedSegment.slice(MATTER_QR_PREFIX.length);
    }
  }

  return '';
}

function decodeBase38(payload) {
  const bytes = [];
  let remainingCharacters = payload.length;
  let offset = 0;

  while (remainingCharacters > 0) {
    let charactersInChunk = 0;
    let bytesInChunk = 0;

    if (remainingCharacters >= 5) {
      charactersInChunk = 5;
      bytesInChunk = 3;
    } else if (remainingCharacters === 4) {
      charactersInChunk = 4;
      bytesInChunk = 2;
    } else if (remainingCharacters === 2) {
      charactersInChunk = 2;
      bytesInChunk = 1;
    } else {
      throw new Error('Invalid Matter base38 payload length.');
    }

    let value = 0;

    for (let index = charactersInChunk - 1; index >= 0; index -= 1) {
      const digit = MATTER_BASE38_CHARSET.indexOf(payload[offset + index]);
      if (digit === -1) {
        throw new Error('Invalid character in Matter base38 payload.');
      }
      value = (value * 38) + digit;
    }

    for (let index = 0; index < bytesInChunk; index += 1) {
      bytes.push(value & 0xff);
      value >>= 8;
    }

    if (value > 0) {
      throw new Error('Invalid Matter base38 payload chunk.');
    }

    offset += charactersInChunk;
    remainingCharacters -= charactersInChunk;
  }

  return bytes;
}

function readBits(bytes, state, bitCount) {
  let value = 0;

  for (let offset = 0; offset < bitCount; offset += 1) {
    const bitIndex = state.index + offset;
    const byte = bytes[Math.floor(bitIndex / 8)];
    if (byte === undefined) {
      throw new Error('Matter payload ended unexpectedly.');
    }
    if (byte & (1 << (bitIndex % 8))) {
      value |= (1 << offset);
    }
  }

  state.index += bitCount;
  return value;
}

function parseMatterQrData(text) {
  const payload = extractMatterQrPayload(text);
  if (!payload) return null;

  const bytes = decodeBase38(payload);
  const state = { index: 0 };
  const version = readBits(bytes, state, 3);
  const vendorId = readBits(bytes, state, 16);
  const productId = readBits(bytes, state, 16);
  const commissioningFlow = readBits(bytes, state, 2);
  const rendezvousInformation = readBits(bytes, state, 8);
  const discriminator = readBits(bytes, state, 12);
  const setupPinCode = readBits(bytes, state, 27);
  const padding = readBits(bytes, state, 4);

  if (padding !== 0) {
    throw new Error('Matter payload padding bits are invalid.');
  }

  return {
    version,
    vendorId,
    productId,
    commissioningFlow,
    rendezvousInformation,
    discriminator,
    setupPinCode,
  };
}

function decimalStringWithPadding(number, length) {
  return String(number).padStart(length, '0');
}

function computeVerhoeffCheckDigit(value) {
  const multiplicationTable = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
  ];
  const permutationTable = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
  ];
  const inverseTable = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];
  const digits = value.split('').reverse().map((digit) => Number.parseInt(digit, 10));
  let checksum = 0;

  for (let index = 0; index < digits.length; index += 1) {
    checksum = multiplicationTable[checksum][permutationTable[(index + 1) % 8][digits[index]]];
  }

  return String(inverseTable[checksum]);
}

// Derives the manual pairing code (11 digits for the standard commissioning
// flow, 21 digits when vendorId/productId must be included) directly from a
// Matter "MT:..." QR payload string. Returns "" if the text isn't a Matter
// onboarding payload.
function generateManualPairingCode(text) {
  const payload = parseMatterQrData(text);
  if (!payload) return '';

  const shortDiscriminator = (payload.discriminator >> MATTER_LONG_TO_SHORT_DISCRIMINATOR_SHIFT) & 0x0f;
  const hasVendorAndProduct = payload.commissioningFlow !== STANDARD_COMMISSIONING_FLOW;
  const chunk1 = ((shortDiscriminator >> 2) & 0x03) | (Number(hasVendorAndProduct) << 2);
  const chunk2 = (payload.setupPinCode & ((1 << 14) - 1)) | ((shortDiscriminator & 0x03) << 14);
  const chunk3 = (payload.setupPinCode >> 14) & ((1 << 13) - 1);

  let code =
    decimalStringWithPadding(chunk1, 1) +
    decimalStringWithPadding(chunk2, 5) +
    decimalStringWithPadding(chunk3, 4);

  if (hasVendorAndProduct) {
    code += decimalStringWithPadding(payload.vendorId, 5);
    code += decimalStringWithPadding(payload.productId, 5);
  }

  return code + computeVerhoeffCheckDigit(code);
}

window.MatterPayload = {
  parseMatterQrData,
  generateManualPairingCode,
  extractMatterQrPayload,
};
