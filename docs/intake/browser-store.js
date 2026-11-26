// The ONLY file in the page that may use the browser's own storage (look-and-feel R4.3, R5).
// It keeps two small things in this browser and nowhere else: the colour mode and the agent settings. It never stores
// anything about a project (no names, notes, images or answers) and never sends anything anywhere.
//
// Every key starts with "designforyou." and only the two keys below exist. If the browser blocks storage (private mode, a
// setting, an old browser) every call still works: the values then last until the page is closed, and `available` says so.
export const PREFIX = 'designforyou.';
export const KEYS = Object.freeze({ theme: `${PREFIX}theme`, settings: `${PREFIX}agent-settings` });

export function openStore(host = globalThis) {
  const memory = new Map();
  let backing = null;
  try {
    const candidate = host.localStorage;
    if (candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function') backing = candidate;
  } catch {
    backing = null; // some browsers throw just for looking at it
  }
  const store = {
    available: backing !== null,
    read(key) {
      if (!Object.values(KEYS).includes(key)) throw new Error(`The key "${key}" is not one of the two this page may store.`);
      if (backing) {
        try {
          const value = backing.getItem(key);
          if (value !== null) return value;
        } catch {
          store.available = false;
        }
      }
      return memory.has(key) ? memory.get(key) : null;
    },
    write(key, value) {
      if (!Object.values(KEYS).includes(key)) throw new Error(`The key "${key}" is not one of the two this page may store.`);
      memory.set(key, String(value));
      if (!backing) return false;
      try {
        backing.setItem(key, String(value));
        return true;
      } catch {
        store.available = false;
        return false;
      }
    },
  };
  return store;
}
