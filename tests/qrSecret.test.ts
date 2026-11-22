import assert from 'node:assert/strict';
import test from 'node:test';
import { generateWakeUpSecret } from '../src/utils/qrSecret';

test('creates an 80-bit wake-up code using the platform cryptographic random generator', () => {
  let requestedBytes = 0;
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const deterministicCrypto = {
    getRandomValues: (bytes: Uint8Array) => {
      requestedBytes = bytes.length;
      bytes.fill(0);
      return bytes;
    }
  } as unknown as Crypto;

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: deterministicCrypto
  });

  try {
    assert.equal(generateWakeUpSecret(), `GING_${'A'.repeat(16)}`);
    assert.equal(requestedBytes, 16);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'crypto');
    }
  }
});
