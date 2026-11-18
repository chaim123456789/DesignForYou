// The Builder agent. It owns door and window items only.
// It is a fixed, rule-based step: no AI and no randomness (R7.7).
//
// It only reads the Brain view it is given and returns proposed changes. It
// never writes anything itself. The Coordinator sends each proposal to the
// gatekeeper, which decides whether to accept it.
//
// Rule: for each Unsure door or window, keep its name and position and record
// that the opening was checked. It does not move openings, so a door placed on
// furniture is still there for the Reviewer to report.
const OWNER = 'Builder';
const NOTE = 'Opening checked by Builder';

export function builderAgent(view) {
  return view.items
    .filter((item) => (item.kind === 'door' || item.kind === 'window') && item.owner === OWNER && item.status === 'Unsure')
    .map((item) => ({ itemId: item.id, newValue: { ...item.value, note: NOTE } }));
}
