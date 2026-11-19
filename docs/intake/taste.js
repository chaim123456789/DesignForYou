// The taste questions and the style profile. Fixed rules only: the same answers
// always give the same profile. No AI, no randomness, no page code.
// Each answer has one tag (short) and one sentence (plain language).

export const NO_PROFILE_MESSAGE = 'No style profile yet';

const q = (id, label, answers) => ({
  id,
  label,
  answers: Object.freeze(answers.map(([answerId, text, tag, sentence]) => Object.freeze({ id: answerId, label: text, tag, sentence }))),
});

export const QUESTIONS = Object.freeze([
  q('light', 'Do you prefer light or dark rooms?', [
    ['light', 'Light', 'light', 'You like light rooms.'],
    ['dark', 'Dark', 'dark', 'You like dark rooms.'],
    ['mix', 'A mix of both', 'light and dark mix', 'You like a mix of light and dark.'],
  ]),
  q('contrast', 'Do you prefer soft or high contrast?', [
    ['soft', 'Soft contrast', 'soft contrast', 'You like soft contrast.'],
    ['high', 'High contrast', 'high contrast', 'You like high contrast.'],
  ]),
  q('era', 'Do you prefer a classic or a trendy look?', [
    ['classic', 'Classic', 'classic', 'You lean towards a classic look.'],
    ['trend', 'Trendy', 'trendy', 'You lean towards a trendy look.'],
  ]),
  q('wear', 'Should things be durable or a showpiece?', [
    ['durable', 'Durable', 'durable', 'You want things that last.'],
    ['showpiece', 'A showpiece', 'showpiece', 'You want a few showpieces.'],
  ]),
  q('temperature', 'Do you prefer a warm or a cool feel?', [
    ['warm', 'Warm', 'warm', 'You like a warm feel.'],
    ['cool', 'Cool', 'cool', 'You like a cool feel.'],
  ]),
  q('mood', 'Do you prefer a calm or a lively mood?', [
    ['calm', 'Calm', 'calm', 'You like a calm mood.'],
    ['lively', 'Lively', 'lively', 'You like a lively mood.'],
  ]),
]);

// answers: { questionId: answerId }. A missing, empty or unknown answer counts as skipped.
// removedTags: tags the visitor took out of the profile. They are not used.
// Returns { hasProfile, message, sentences, tags }. Never changes its inputs.
export function buildProfile(answers, removedTags = []) {
  const given = answers && typeof answers === 'object' ? answers : {};
  const removed = new Set(Array.isArray(removedTags) ? removedTags : []);
  const picked = [];
  for (const question of QUESTIONS) {
    const answer = question.answers.find((a) => a.id === given[question.id]);
    if (answer && !removed.has(answer.tag)) picked.push(answer);
  }
  if (picked.length === 0) {
    return { hasProfile: false, message: NO_PROFILE_MESSAGE, sentences: [], tags: [] };
  }
  const tags = picked.map((a) => a.tag);
  const sentences = [...picked.map((a) => a.sentence), `In short: ${tags.join(', ')}.`];
  return { hasProfile: true, message: '', sentences, tags };
}
