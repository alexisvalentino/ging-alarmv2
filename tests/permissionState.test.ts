import assert from 'node:assert/strict';
import test from 'node:test';
import type { PermissionItem } from '../src/types';
import { mergePermissionsWithDefaults } from '../src/utils/permissionState';

const defaults: PermissionItem[] = [
  { id: 'camera', key: 'camera', title: 'Camera access', description: 'Scan QR.', urgency: 'CRITICAL & MANDATORY', isSimulated: false, granted: false },
  { id: 'notification', key: 'notification', title: 'Alarm notification', description: 'Schedule alerts.', urgency: 'CRITICAL & MANDATORY', isSimulated: false, granted: false }
];

test('restores newly added permission rows when loading older saved onboarding state', () => {
  const saved = [{ ...defaults[0], granted: true, title: 'Old camera label' }];
  const restored = mergePermissionsWithDefaults(defaults, saved);

  assert.equal(restored.length, defaults.length);
  assert.equal(restored[0].granted, true);
  assert.equal(restored[0].title, defaults[0].title);
  assert.equal(restored[1].key, 'notification');
  assert.equal(restored[1].granted, false);
});

test('falls back to complete defaults for malformed saved permission state', () => {
  assert.deepEqual(mergePermissionsWithDefaults(defaults, { camera: true }), defaults);
});
