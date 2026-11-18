// The Layout agent. It owns layout items only (room positions, sizes, furniture
// placement). It is a fixed, rule-based step: no AI and no randomness (R7.7).
//
// It only reads the Brain view it is given and returns proposed changes. It
// never writes anything itself. The Coordinator sends each proposal to the
// gatekeeper, which decides whether to accept it.
//
// Rule: for each Unsure layout item, keep its name and position and record that
// the placement was checked. It does not move furniture, so a clash that the
// Reviewer should find (a door on a sofa) is not hidden by this agent.
const OWNER = 'Layout';
const NOTE = 'Placement checked by Layout';

export function layoutAgent(view) {
  return view.items
    .filter((item) => item.kind === 'layout' && item.owner === OWNER && item.status === 'Unsure')
    .map((item) => ({ itemId: item.id, newValue: { ...item.value, note: NOTE } }));
}
