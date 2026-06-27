export const BLOCKLIST_KEY = 'blockedDomains';
export const ALWAYS_BLOCKLIST_KEY = 'alwaysBlockedDomains';

export type Blocklist = string[];

export async function getBlocklist(): Promise<Blocklist> {
  const result = await chrome.storage.local.get(BLOCKLIST_KEY);
  return result[BLOCKLIST_KEY] ?? [];
}

export async function setBlocklist(domains: Blocklist): Promise<void> {
  await chrome.storage.local.set({ [BLOCKLIST_KEY]: domains });
}

export async function getAlwaysBlocklist(): Promise<Blocklist> {
  const result = await chrome.storage.local.get(ALWAYS_BLOCKLIST_KEY);
  return result[ALWAYS_BLOCKLIST_KEY] ?? [];
}

export async function setAlwaysBlocklist(domains: Blocklist): Promise<void> {
  await chrome.storage.local.set({ [ALWAYS_BLOCKLIST_KEY]: domains });
}
