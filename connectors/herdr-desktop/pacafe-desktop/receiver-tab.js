// Herdr 0.1.18 exposes every pane in every tab, even outside the shown Space.
// Use the mod identity, not a user-editable tab title, to resume it.
export function receiverTabCommand(spaces, panes) {
  const local = spaces.filter(space => space.machine === null);
  const tabIds = new Set(local.flatMap(space => space.tabs.map(tab => tab.id)));
  const existing = panes.find(pane => pane.mod === 'pacafe-desktop' && tabIds.has(pane.tab));
  if (existing) return ['tab.select', { id: existing.tab }];
  const space = local.find(row => row.active) ?? local[0];
  return space ? ['tab.new', { mod: 'pacafe-desktop', space: space.id, name: 'PA Cafe', props: { role: 'receiver' }, focus: true }] : null;
}
