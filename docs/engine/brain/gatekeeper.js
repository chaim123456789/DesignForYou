// The gatekeeper: the only way to change an item after it is created.
// Every change goes through changeItem or changeStatus. Refusals go to the
// run log and write no version. Accepted changes write exactly one version.
import { getItem, appendVersion, STATUSES, checkBasis, checkApprovedBy } from './brain.js';

export const USER = 'user';

function mustFindItem(project, itemId) {
  const item = getItem(project, itemId);
  if (!item) throw new Error(`Item "${itemId}" does not exist.`);
  return item;
}

function refuse(project, who, item, reason) {
  project.runLog.push({ agent: who, event: 'refused', item: item.id, reason });
  return { accepted: false, reason };
}

// Create the gatekeeper for one project. options.now (optional) gives the
// time for new versions, so runs can be repeated exactly.
export function createGatekeeper(project, options = {}) {
  const timeNow = () => (options.now ? options.now() : undefined);

  // Change an item's value. Check order, exactly:
  //   1. Locked: refused, even for the owner.
  //   2. Not the owner: refused. (The user is not an owner, so a user cannot change values.)
  //   3. Otherwise accepted, and a version is written.
  // details (optional): { basis, approvedBy }. They are checked only after the two refusals above,
  // and are written to the version (and the basis to the item). Without details nothing changes.
  function changeItem(who, itemId, newValue, details = {}) {
    const item = mustFindItem(project, itemId);

    if (item.status === 'Locked') {
      return refuse(project, who, item, `Item "${item.id}" is Locked and cannot be changed.`);
    }
    if (who !== item.owner) {
      return refuse(project, who, item, `${who} does not own item "${item.id}". Its owner is ${item.owner}.`);
    }
    if (newValue === undefined) {
      throw new Error('A change needs a new value.');
    }

    const basis = details.basis === undefined ? undefined : checkBasis(project, details.basis, item.id);
    const approvedBy = details.approvedBy === undefined ? undefined : checkApprovedBy(details.approvedBy);

    const oldValue = item.value;
    item.value = structuredClone(newValue);
    if (basis !== undefined) item.basis = structuredClone(basis);
    const version = appendVersion(project, { who, itemId: item.id, field: 'value', oldValue, newValue, time: timeNow(), approvedBy, basis });
    return { accepted: true, version };
  }

  // Change an item's status (Locked or Unsure). Only the user may do this.
  function changeStatus(who, itemId, newStatus) {
    const item = mustFindItem(project, itemId);
    if (!STATUSES.includes(newStatus)) {
      throw new Error(`Status "${newStatus}" is not allowed. Use Locked or Unsure.`);
    }
    if (who !== USER) {
      return refuse(project, who, item, `Only the user can change the status of item "${item.id}".`);
    }
    if (item.status === newStatus) {
      return { accepted: true, unchanged: true };
    }
    const oldStatus = item.status;
    item.status = newStatus;
    const version = appendVersion(project, { who, itemId: item.id, field: 'status', oldValue: oldStatus, newValue: newStatus, time: timeNow() });
    return { accepted: true, version };
  }

  return { changeItem, changeStatus };
}
