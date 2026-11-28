export const dispatchProfileLimit = 40;
export const spacePermissionKey = ({ on, core, space, folder }) => JSON.stringify([on, core, space, folder]);
const pairKey = row => JSON.stringify([spacePermissionKey(row), row.key]);
const bindingKey = row => JSON.stringify([pairKey(row), row.lifecycle, row.run]);

const list = values => Array.isArray(values) && values.every(key => typeof key === 'string');
const unique = values => [...new Set(values)].sort();
export const defaultPermissions = () => ({ version: 2, excludedSpaces: [], agents: [] });
// A Space's checkbox keeps its identity when the folder changes. Launch bindings
// still include the exact folder, Core and executable signature.
export function spaceChoiceKey(key) {
  try {
    const parsed = JSON.parse(key);
    if (Array.isArray(parsed) && parsed.length === 4) return JSON.stringify(parsed.slice(0, 3));
  } catch { /* Invalid keys cannot match a different selectable Space. */ }
  return key;
}

export function readPermissions(value) {
  if (!value || !list(value.agents)) return null;
  if (value.version === 1 && list(value.spaces)) return { version: 1, spaces: unique(value.spaces), agents: unique(value.agents) };
  if (value.version === 2 && list(value.excludedSpaces)) return { version: 2, excludedSpaces: unique(value.excludedSpaces), agents: unique(value.agents) };
  return null;
}

export function editablePermissions(value, spaces) {
  if (!value) return defaultPermissions();
  if (value.version === 2) return value;
  // Existing known unchecked Spaces remain excluded. Future Spaces use the new default.
  return { version: 2, agents: value.agents, excludedSpaces: unique(spaces.map(row => row.key).filter(key => !value.spaces.includes(key)).map(spaceChoiceKey)) };
}

export function permissionSelected(permissions, kind, key) {
  if (kind === 'agents') return permissions.agents.includes(key);
  return permissions.version === 1 ? permissions.spaces.includes(key) : !permissions.excludedSpaces.includes(spaceChoiceKey(key));
}

export function changePermissionChoices(permissions, kind, keys, enabled) {
  const field = kind === 'spaces' ? 'excludedSpaces' : 'agents';
  const changed = new Set(permissions[field]);
  for (const raw of keys) {
    const key = kind === 'spaces' ? spaceChoiceKey(raw) : raw;
    if (kind === 'spaces' ? !enabled : enabled) changed.add(key);
    else changed.delete(key);
  }
  return { ...permissions, [field]: unique(changed) };
}

export function permittedProfiles(permissions, profiles) {
  if (!permissions || !Array.isArray(profiles)) return [];
  return profiles.filter(row => row && permissionSelected(permissions, 'spaces', spacePermissionKey(row)) && permissionSelected(permissions, 'agents', row.key));
}

export function automaticPermissionDiscoveries(approved, discovered) {
  const pairs = new Map(approved.map(row => [pairKey(row), bindingKey(row)]));
  const spaceLocations = new Map(approved.map(row => [JSON.stringify([row.on, row.space]), spacePermissionKey(row)]));
  return discovered.filter(row => {
    const previousBinding = pairs.get(pairKey(row));
    const previousLocation = spaceLocations.get(JSON.stringify([row.on, row.space]));
    // New spaces can join, but an existing Space or launcher must not silently redirect.
    return (!previousLocation || previousLocation === spacePermissionKey(row)) &&
      (!previousBinding || previousBinding === bindingKey(row));
  });
}

// A saved permission is a particular trusted launch on an exact Core and path.
// Offline saved permissions are retained only if both lists still include them.
export function planPermissions(selection, approved, discovered) {
  const permissions = readPermissions(selection) ?? defaultPermissions();
  const existing = permittedProfiles(permissions, approved);
  const choices = permittedProfiles(permissions, discovered);
  const byPair = new Map();
  const exact = new Map(existing.map(row => [bindingKey(row), row]));
  for (const row of existing) byPair.set(pairKey(row), row);
  for (const row of choices) byPair.set(pairKey(row), exact.get(bindingKey(row)) ?? row);
  const profiles = [...byPair.values()];
  return {
    permissions, profiles,
    added: profiles.filter(row => !row.id),
    removed: approved.filter(row => !profiles.includes(row)),
    fingerprint: JSON.stringify([permissions, profiles.map(row => [bindingKey(row), row.id ?? null]).sort()]),
  };
}
