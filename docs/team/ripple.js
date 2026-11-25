// Basis and stale items (design-team R3, design section 4.2 and 6).
//
// An item's basis lists the earlier items it was worked out from, each with the version number
// the Brain had at that time: [{ itemId, version }]. The basis is stored on the item, outside the
// version list, so past versions are never edited.
//
// An item is STALE when something in its basis has changed since (a later version touched it),
// or when something in its basis is itself stale. That follows chains: wall -> door -> light.
// Nothing here changes the Brain. It only reads and reports.

// The newest version number that changed an item's value, or 0 if it never changed.
function lastChange(project, itemId) {
  let last = 0;
  for (const v of project.versions) if (v.item === itemId && v.field === 'value' && v.number > last) last = v.number;
  return last;
}

// Is a basis entry pointing backwards (at a later agent's item) or at an unknown item or agent?
// Same-agent entries are allowed (an agent reads its own items). Returns an error text or null.
function basisError(item, entry, byId, position) {
  const target = byId.get(entry.itemId);
  if (!target) return `Item "${item.id}" has a basis on "${entry.itemId}", which does not exist.`;
  if (entry.itemId === item.id) return `Item "${item.id}" is based on itself.`;
  const mine = position.get(item.owner);
  const theirs = position.get(target.owner);
  if (mine === undefined) return `Item "${item.id}" is owned by ${item.owner}, which is not in the design team, so it cannot have a basis.`;
  if (theirs === undefined) return `Item "${item.id}" is based on "${target.id}", owned by ${target.owner}, which is not in the design team.`;
  if (theirs > mine) {
    return `Item "${item.id}" (${item.owner}) is based on "${target.id}" (${target.owner}), which belongs to a later agent. A basis may only point at earlier agents or the same agent.`;
  }
  return null;
}

// The ending of the reason given when an item is stale only because something it was based on is itself stale.
export const ITSELF_STALE = 'is itself stale.';

// Find stale items and basis errors.
// registry: the checked registry from registry.js (order of agents).
// Returns { stale, errors }.
//   stale  : [{ itemId, owner, locked, because: [{ itemId, why }] }] in item order
//   errors : [{ itemId, message }]  (backwards basis, unknown item, cycle)
export function findStale(project, registry) {
  const position = new Map(registry.order.map((n, i) => [n, i]));
  const byId = new Map(project.items.map((i) => [i.id, i]));
  const errors = [];
  const bad = new Set();

  // Check every basis first. An item with a faulty basis is reported and not followed further.
  for (const item of project.items) {
    for (const entry of item.basis || []) {
      const message = basisError(item, entry, byId, position);
      if (message) { errors.push({ itemId: item.id, message }); bad.add(item.id); break; }
    }
  }

  const memo = new Map(); // itemId -> because list ([] means not stale)
  const visiting = new Set();
  function because(item) {
    if (memo.has(item.id)) return memo.get(item.id);
    if (bad.has(item.id)) return [];
    if (visiting.has(item.id)) {
      errors.push({ itemId: item.id, message: `Item "${item.id}" is part of a loop of bases. A basis may not lead back to itself.` });
      bad.add(item.id);
      return [];
    }
    visiting.add(item.id);
    const reasons = [];
    for (const entry of item.basis || []) {
      const target = byId.get(entry.itemId);
      const changedAt = lastChange(project, target.id);
      if (changedAt > entry.version) {
        reasons.push({ itemId: target.id, why: `"${target.id}" changed in version ${changedAt}, after version ${entry.version} that this item was based on.` });
      } else if (because(target).length > 0) {
        reasons.push({ itemId: target.id, why: `"${target.id}" ${ITSELF_STALE}` });
      }
    }
    visiting.delete(item.id);
    memo.set(item.id, reasons);
    return reasons;
  }

  const stale = [];
  for (const item of project.items) {
    const reasons = because(item);
    if (reasons.length > 0 && !bad.has(item.id)) {
      stale.push({ itemId: item.id, owner: item.owner, locked: item.status === 'Locked', because: reasons });
    }
  }
  return { stale, errors };
}

// Which agents must look again, in run order, and why (R3.3).
// Returns { agents, errors } where agents has one entry per agent in the registry, in order:
//   { agent, recheck: true,  itemIds, reason: "Re-check: ..." }
//   { agent, recheck: false, itemIds: [], reason: "Not affected: nothing it depends on changed." }
export function agentsToRecheck(project, registry) {
  const { stale, errors } = findStale(project, registry);
  const agents = registry.order.map((name) => {
    const mine = stale.filter((s) => s.owner === name);
    if (mine.length === 0) {
      return { agent: name, recheck: false, itemIds: [], reason: 'Not affected: nothing it depends on changed.' };
    }
    const first = mine[0];
    const more = mine.length > 1 ? ` (and ${mine.length - 1} more)` : '';
    return {
      agent: name,
      recheck: true,
      itemIds: mine.map((s) => s.itemId),
      reason: `Re-check ${mine.length} item${mine.length === 1 ? '' : 's'}: ${first.itemId} is stale because ${first.because[0].why}${more}`,
    };
  });
  return { agents, errors };
}
