// Builds one readable HTML page from a Project Brain (R10). Read only: it never
// changes the Brain. It needs no server and sends nothing over a network.
// Internal ids and field names are turned into plain words (R10.2).
import { getLabels, SAMPLE_LABEL, describeTeamRun } from '../label.js';

export const SECTION_HEADINGS = Object.freeze({
  structure: 'Project structure',
  items: 'Items, with status and owner',
  runLog: 'Run log',
  clashes: 'Clash report',
  versions: 'Version history',
});

const KIND_WORDS = {
  wall: 'Walls',
  ceiling: 'Ceiling',
  floor: 'Floor',
  light: 'Lighting',
  electrical: 'Switches and sockets',
  decor: 'Decor',
  style: 'Style',
  layout: 'Furniture and layout',
  door: 'Door',
  window: 'Window',
  clash: 'Clash report',
};

const EVENT_WORDS = {
  started: 'Started',
  finished: 'Finished',
  skipped: 'Skipped',
  failed: 'Failed',
  refused: 'Refused',
};

function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function metres(n) {
  return `${Number(n).toFixed(1)} m`;
}

function positionWords(p) {
  return `${metres(p.x)} from the left, ${metres(p.y)} from the top, ${metres(p.width)} wide, ${metres(p.depth)} deep`;
}

// A value in plain words. Handles the value shapes used in this project.
function valueWords(value) {
  if (value === null || value === undefined) return 'nothing';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  if (typeof value.detail === 'string') return value.detail;
  if (typeof value.name === 'string') {
    const extra = [];
    // Placed furniture: say the type and the turn in plain words. Inside the
    // brackets, so the name before " (" stays the item's name.
    if (typeof value.type === 'string') {
      extra.push(typeof value.turn === 'number' ? `${value.type}, turned ${value.turn} degrees` : value.type);
    }
    if (value.position) extra.push(positionWords(value.position));
    if (value.note) extra.push(value.note);
    return extra.length ? `${value.name} (${extra.join('; ')})` : value.name;
  }
  if (typeof value.summary === 'string') return value.summary;
  return 'a changed value';
}

export function makeSummaryHtml(project) {
  const roomNames = new Map();
  const floorOfRoom = new Map();
  for (const floor of project.floors) {
    for (const room of floor.rooms) {
      roomNames.set(room.id, room.name);
      floorOfRoom.set(room.id, floor.name);
    }
  }
  const itemById = new Map(project.items.map((i) => [i.id, i]));
  const itemName = (id) => {
    const item = itemById.get(id);
    if (!item) return 'an unknown item';
    // Use the item's starting wording so a name stays stable through the run.
    const start = project.itemStarts && project.itemStarts[id] ? project.itemStarts[id].value : item.value;
    if (item.kind === 'clash') return 'The clash report';
    return typeof start === 'string' ? start : valueWords(start).split(' (')[0];
  };
  // Replace quoted internal item ids inside a sentence with the item's name.
  const plainSentence = (text) => String(text || '').replace(/"(item-\d+)"/g, (_, id) => `"${itemName(id)}"`);
  const roomWords = (roomId) => (roomId ? roomNames.get(roomId) || 'Unknown room' : 'Whole project');

  // A design-team run says where each line came from (Rule-based or AI). The old four-agent sample has none of this, so its page is unchanged.
  const team = describeTeamRun(project, itemName);
  const labels = getLabels(project);
  const showsSample = labels.includes(SAMPLE_LABEL);
  const banner = labels.map((l) => `<p class="${l === SAMPLE_LABEL ? 'label' : 'statement'}">${esc(l)}</p>`).join('\n');

  // 1. Structure
  const inspiration = (project.inspiration || []).join(', ') || 'none';
  const floors = project.floors.map((floor) => {
    const rooms = floor.rooms.map((room) => {
      const style = room.override && room.override.length
        ? `own style: ${esc(room.override.join(', '))} (replaces the overall style in this room)`
        : 'uses the overall style';
      return `<li>${esc(room.name)}: ${style}</li>`;
    }).join('\n');
    return `<li><strong>${esc(floor.name)}</strong><ul>\n${rooms}\n</ul></li>`;
  }).join('\n');
  const structure = `<p>Project name: <strong>${esc(project.name)}</strong></p>
<p>Overall style for the whole project: ${esc(inspiration)}</p>
<ul>\n${floors}\n</ul>`;

  // 2. Items
  const itemRows = project.items.map((item) => `<tr>
<td>${esc(itemName(item.id))}</td><td>${esc(KIND_WORDS[item.kind] || item.kind)}</td><td>${esc(roomWords(item.room))}</td>
<td class="${item.status === 'Locked' ? 'locked' : 'unsure'}">${esc(item.status)}</td><td>${esc(item.owner)}</td><td>${esc(valueWords(item.value))}</td></tr>`).join('\n');
  const items = `<table>
<tr><th>Item</th><th>Type</th><th>Room</th><th>Status</th><th>Owner</th><th>Current value</th></tr>
${itemRows}
</table>`;

  // 3. Run log
  const logRows = team ? team.rows.map((r) => `<tr><td>${r.number}</td><td>${esc(r.agent)}</td><td>${esc(r.what)}</td><td>${esc(r.tag)}</td><td>${esc(plainSentence(r.details))}</td></tr>`).join('\n') : project.runLog.map((e, n) => {
    const parts = [];
    if (e.item) parts.push(`item: ${itemName(e.item)}`);
    if (e.reason) parts.push(plainSentence(e.reason));
    return `<tr><td>${n + 1}</td><td>${esc(e.agent)}</td><td>${esc(EVENT_WORDS[e.event] || e.event)}</td><td>${esc(parts.join('. '))}</td></tr>`;
  }).join('\n');
  const runLog = `<table>
${team ? '<tr><th>Step</th><th>Agent</th><th>What happened</th><th>Where it came from</th><th>Details</th></tr>' : '<tr><th>Step</th><th>Agent</th><th>What happened</th><th>Details</th></tr>'}
${logRows}
</table>`;

  // 4. Clash report
  const reportItem = project.items.find((i) => i.kind === 'clash');
  const report = reportItem && reportItem.value && typeof reportItem.value === 'object' ? reportItem.value : null;
  let clashes;
  if (!report || !Array.isArray(report.clashes)) {
    clashes = '<p>The clash report has not been made yet.</p>';
  } else if (report.clashes.length === 0) {
    clashes = '<p>No clashes found</p>';
  } else {
    const rows = report.clashes.map((c) => `<tr><td>${esc(c.number)}</td><td>${esc(c.severity)}</td><td>${esc(c.type)}</td>
<td>${esc(roomWords(c.room))}</td><td>${esc(c.items.map(itemName).join(' and '))}</td><td>${esc(c.description)}</td></tr>`).join('\n');
    clashes = `<p>${esc(report.summary)}. The Reviewer reports clashes and does not fix them.</p>
<table>
<tr><th>No.</th><th>How serious</th><th>Kind of clash</th><th>Room</th><th>Items involved</th><th>What is wrong</th></tr>
${rows}
</table>`;
  }

  // 5. Versions
  const versionRows = project.versions.map((v, n) => `<tr><td>${esc(v.number)}</td><td>${esc(v.time)}</td><td>${esc(v.who)}</td>
<td>${esc(itemName(v.item))}</td><td>${esc(v.field === 'status' ? 'Status' : 'Value')}</td><td>${esc(valueWords(v.oldValue))}</td><td>${esc(valueWords(v.newValue))}</td>${team ? `<td>${esc(team.versionSources[n] === 'ai' ? 'AI' : 'Rule-based')}</td><td>${esc(v.approvedBy || 'not recorded')}</td>` : ''}</tr>`).join('\n');
  const versions = project.versions.length === 0
    ? '<p>No changes have been made yet.</p>'
    : `${showsSample ? '<p>The times below come from a fixed sample clock, so every run of the sample looks the same.</p>\n' : ''}<table>
<tr><th>Version</th><th>Time</th><th>Changed by</th><th>Item</th><th>What changed</th><th>Before</th><th>After</th>${team ? '<th>Where it came from</th><th>Approved by</th>' : ''}</tr>
${versionRows}
</table>`;

  const teamNotes = team ? team.sentences.map((t) => `<p class="statement">${esc(t)}</p>\n`).join('') : '';
  const footer = labels.map((l) => `<p class="statement">${esc(l)}</p>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(showsSample ? `${SAMPLE_LABEL}: ` : '')}${esc(project.name)}: summary</title>
<style>
body { font-family: Arial, Helvetica, sans-serif; max-width: 1000px; margin: 24px auto; padding: 0 16px; color: #222; line-height: 1.4; }
.label { background: #b00020; color: #fff; padding: 8px 12px; font-weight: bold; font-size: 1.2em; }
.statement { border: 2px solid #b00020; padding: 8px 12px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; }
th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #eee; }
.locked { font-weight: bold; color: #b00020; }
</style>
</head>
<body>
${banner}
<h1>${esc(project.name)}: summary</h1>
${teamNotes}<h2>${SECTION_HEADINGS.structure}</h2>
${structure}
<h2>${SECTION_HEADINGS.items}</h2>
${items}
<h2>${SECTION_HEADINGS.runLog}</h2>
${runLog}
<h2>${SECTION_HEADINGS.clashes}</h2>
${clashes}
<h2>${SECTION_HEADINGS.versions}</h2>
${versions}
${footer}
</body>
</html>
`;
}
