const owned = /^sp-pacafe-[a-f0-9]{24}$/;
const session = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;

/** Core owns the ID namespace; remote IDs are qualified only in Desktop. */
export const qualifiedOwnedSpace = (id, on) => on === null ? id : `${on}/${id}`;
export const isOwnedSpace = (id, on) => typeof id === 'string' &&
  (on === null ? owned.test(id) : id.startsWith(`${on}/`) && owned.test(id.slice(on.length + 1)));
export const ownedSpaceLabels = (id, sessionId) => {
  if (!owned.test(id) || !session.test(sessionId)) throw new Error('Invalid PA Cafe Space binding.');
  return [`herdr.space=${id}`, `herdr.tab=tb-pacafe-${sessionId.replaceAll('-', '')}`];
};

/** Only an already attached, verified pane can prove that adoption happened. */
export function ownedPlacement(id, on, address, spaces, panes) {
  const target = qualifiedOwnedSpace(id, on);
  const attached = panes.find(pane => pane.terminal === address);
  if (!attached) return null;
  const space = spaces.find(item => item.id === target && item.machine === on);
  // A person might have moved the tab. Never pull it back or rename their Space.
  return { pane: attached.pane, rename: space && !space.named && space.tabs?.some(tab => tab.id === attached.tab) ? target : null };
}
