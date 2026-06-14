import { BLOCKLIST_KEY, getBlocklist } from '../../shared/storage';

function buildRules(
  domains: string[]
): chrome.declarativeNetRequest.Rule[] {
  return domains.map((domain, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
        chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
      ],
    },
  }));
}

async function syncRules(): Promise<void> {
  const domains = await getBlocklist();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: buildRules(domains),
  });
}

chrome.runtime.onInstalled.addListener(syncRules);
chrome.runtime.onStartup.addListener(syncRules);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[BLOCKLIST_KEY]) {
    syncRules();
  }
});
