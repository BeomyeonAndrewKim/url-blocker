export const BLOCKLIST_KEY = 'blockedDomains';

export type Blocklist = string[];

export async function getBlocklist(): Promise<Blocklist> {
  const result = await chrome.storage.local.get(BLOCKLIST_KEY);
  return result[BLOCKLIST_KEY] ?? [];
}

export async function setBlocklist(domains: Blocklist): Promise<void> {
  await chrome.storage.local.set({ [BLOCKLIST_KEY]: domains });
}
