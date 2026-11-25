// The stand-in for a paid AI model (design-team D1). It returns a fixed answer and says so. It calls nothing and needs no key.
// Use it as the gate's provider. A real model is a later, separate decision (requirements, owner decision 1).
export const STAND_IN_LABEL = 'stand-in, not a real model';

// request: { task, input }. For judge-taste, input.options is a list of { id, tag }; the stand-in picks the first. For read-photo it reads nothing.
export function standInProvider(request) {
  if (request.task === 'judge-taste') {
    const options = request.input && Array.isArray(request.input.options) ? request.input.options : [];
    const first = options[0];
    return {
      label: STAND_IN_LABEL,
      answer: {
        choice: first ? first.id : '',
        tags: first && first.tag ? [first.tag] : [],
        text: 'Fixed stand-in answer: the first option is picked. No model looked at this.',
      },
    };
  }
  return {
    label: STAND_IN_LABEL,
    answer: { tags: [], text: 'Fixed stand-in answer: no photo was looked at.' },
  };
}
