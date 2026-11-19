// The Style agent. It owns style items only (materials, colours, mood).
// It is a fixed, rule-based step: no AI and no randomness (R7.7).
//
// It only reads the Brain view it is given and returns proposed changes.
// It never writes anything itself. The Coordinator sends each proposal to the
// gatekeeper, which decides whether to accept it.
import { getEffectiveInspiration } from '../../brain/inspiration.js';

const OWNER = 'Style';
const MARKER = ' (kept in line with: ';

// Rule for an Unsure style item: add the room's effective inspiration (its
// override if it has one, otherwise the overall set) to the item's detail.
function refine(view, item) {
  const refs = item.room ? getEffectiveInspiration(view, item.room) : [...(view.inspiration || [])];
  const base = String(item.value.detail || '').split(MARKER)[0];
  const detail = refs.length > 0 ? `${base}${MARKER}${refs.join(', ')})` : base;
  return { ...item.value, detail };
}

// options.tryLockedItem: also propose a change to the first Locked style item.
// The sample turns this on so the gatekeeper's refusal can be seen in the run
// log. The agent does not skip Locked items itself: the gatekeeper is the guard.
export function createStyleAgent(options = {}) {
  return function styleAgent(view) {
    const mine = view.items.filter((item) => item.kind === 'style' && item.owner === OWNER);
    const proposals = mine
      .filter((item) => item.status === 'Unsure')
      .map((item) => ({ itemId: item.id, newValue: refine(view, item) }));

    if (options.tryLockedItem) {
      const locked = mine.find((item) => item.status === 'Locked');
      if (locked) {
        proposals.push({
          itemId: locked.id,
          newValue: { ...locked.value, tag: 'pale ash', detail: 'Pale ash instead of the current wood' },
        });
      }
    }
    return proposals;
  };
}

// The version used in a normal run, and the one used in Sample mode.
export const styleAgent = createStyleAgent();
export const sampleStyleAgent = createStyleAgent({ tryLockedItem: true });
