// The photo-reading step (design-team D2, R7.4, R7.7, R8.3, R8.5). It sits behind the AI gate and is off by default.
// It asks the gate for the task "read-photo" for each image. When AI is off (cap zero), refused or failed, nothing is read and the
// answer says so. Nothing is described as "understood" or "noticed" unless a real call was made through the gate.
// Pure logic: no files, no network. The images are only names here; the pictures themselves never enter this file.
export const NOT_READ_SENTENCE = 'Your images were not looked at.';

// gate: the AI gate (or undefined). images: [{ name }]. Returns:
// { used: boolean, readings: [{ name, tags, text, costUsd, label }], notes: [text], costUsd }
export function readPhotos(gate, images = []) {
  const list = Array.isArray(images) ? images : [];
  if (list.length === 0) return { used: false, readings: [], notes: ['There are no images to read.'], costUsd: 0 };
  if (!gate) return { used: false, readings: [], notes: [`AI was not used: no AI gate is connected. ${NOT_READ_SENTENCE}`], costUsd: 0 };
  const readings = [];
  const notes = [];
  let costUsd = 0;
  for (const image of list) {
    const name = image && typeof image.name === 'string' ? image.name : 'an image';
    const asked = gate.ask('read-photo', { name });
    if (asked.ok) {
      readings.push({ name, tags: asked.answer.tags, text: asked.answer.text, costUsd: asked.costUsd, label: asked.label });
      costUsd = Math.round((costUsd + asked.costUsd) * 1e6) / 1e6;
    } else {
      notes.push(`AI was not used for ${name}: ${asked.reason} ${NOT_READ_SENTENCE}`);
      break; // the gate said no, so the rest would be refused too
    }
  }
  return { used: readings.length > 0, readings, notes, costUsd };
}
