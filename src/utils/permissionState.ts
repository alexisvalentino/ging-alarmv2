import type { PermissionItem } from '../types';

export function mergePermissionsWithDefaults(
  defaults: PermissionItem[],
  savedPermissions: unknown
): PermissionItem[] {
  const knownKeys = new Set(defaults.map(permission => permission.key));
  const savedByKey = new Map<PermissionItem['key'], Partial<PermissionItem>>();

  if (Array.isArray(savedPermissions)) {
    for (const saved of savedPermissions) {
      if (!saved || typeof saved !== 'object') continue;
      const item = saved as Partial<PermissionItem>;
      if (item.key && knownKeys.has(item.key)) savedByKey.set(item.key, item);
    }
  }

  return defaults.map(permission => {
    const saved = savedByKey.get(permission.key);
    return {
      ...permission,
      granted: saved?.granted === true,
      isSimulated: saved?.isSimulated === true
    };
  });
}
