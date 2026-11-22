import assert from 'node:assert/strict';
import test from 'node:test';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { matchesWakeUpCode } from '../src/utils/qrValidation';

const secret = 'GING_AB23CD';

test('accepts only the exact non-empty wake-up code payload', () => {
  assert.equal(matchesWakeUpCode(secret, secret), true);
  assert.equal(matchesWakeUpCode('GING_WRONG1', secret), false);
  assert.equal(matchesWakeUpCode(` ${secret}`, secret), false);
  assert.equal(matchesWakeUpCode(secret, ''), false);
  assert.equal(matchesWakeUpCode(secret, undefined), false);
});

test('generated QR pixels decode to the exact payload accepted by the alarm scanner', () => {
  const qr = QRCode.create(secret, { errorCorrectionLevel: 'H' });
  const moduleScale = 8;
  const quietZone = 4;
  const size = (qr.modules.size + quietZone * 2) * moduleScale;
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const moduleX = Math.floor(x / moduleScale) - quietZone;
      const moduleY = Math.floor(y / moduleScale) - quietZone;
      const isDark = moduleX >= 0 && moduleY >= 0 && moduleX < qr.modules.size && moduleY < qr.modules.size
        && qr.modules.get(moduleY, moduleX) === 1;
      const pixel = (y * size + x) * 4;
      const color = isDark ? 0 : 255;
      pixels[pixel] = color;
      pixels[pixel + 1] = color;
      pixels[pixel + 2] = color;
      pixels[pixel + 3] = 255;
    }
  }

  const decoded = jsQR(pixels, size, size, { inversionAttempts: 'dontInvert' });
  assert.ok(decoded, 'jsQR should decode the generated code image');
  assert.equal(decoded.data, secret);
  assert.equal(matchesWakeUpCode(decoded.data, secret), true);
});
