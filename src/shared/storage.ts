export const BLOCKLIST_KEY = 'blockedDomains';
export const ALWAYS_BLOCKLIST_KEY = 'alwaysBlockedDomains';

export type Blocklist = string[];

// `chrome.storage.local.get` is typed to return `unknown` values, so every
// read has to name the shape it expects. These two helpers do that once.
export async function readValue<T>(key: string, fallback: T): Promise<T> {
  const result =
    await chrome.storage.local.get<Record<string, T | undefined>>(key);
  return result[key] ?? fallback;
}

export async function writeValue<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export function getBlocklist(): Promise<Blocklist> {
  return readValue<Blocklist>(BLOCKLIST_KEY, []);
}

export function setBlocklist(domains: Blocklist): Promise<void> {
  return writeValue(BLOCKLIST_KEY, domains);
}

export function getAlwaysBlocklist(): Promise<Blocklist> {
  return readValue<Blocklist>(ALWAYS_BLOCKLIST_KEY, []);
}

export function setAlwaysBlocklist(domains: Blocklist): Promise<void> {
  return writeValue(ALWAYS_BLOCKLIST_KEY, domains);
}

// Normalize a user-typed blocklist entry into the canonical form we store:
// lowercase, no scheme, no leading "www.", no trailing slash — but any path
// prefix ("youtube.com/shorts") is preserved.
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}
