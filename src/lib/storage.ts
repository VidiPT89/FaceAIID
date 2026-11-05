/**
 * localStorage access that never throws. Reading or writing it can throw
 * when site data is blocked (some privacy settings, embedded contexts) or
 * the quota is full — and every caller here treats storage as a
 * convenience, so a failure must degrade to "not remembered", not crash.
 */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
