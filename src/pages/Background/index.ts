import {
  ALWAYS_BLOCKLIST_KEY,
  BLOCKLIST_KEY,
  getAlwaysBlocklist,
  getBlocklist,
} from '../../shared/storage';
import {
  advance,
  pause,
  PomodoroState,
  phaseLabel,
  resume,
  startFocus,
} from '../../shared/pomodoro';
import {
  ensureDefaults,
  getActivePreset,
} from '../../shared/presets';
import {
  getPomodoroState,
  POMODORO_STATE_KEY,
  setPomodoroState,
} from '../../shared/pomodoroState';

const ALARM_NAME = 'pomodoro';

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

// The set of domains that should be blocked right now: the always-blocked
// list in every phase, plus the focus-only list while focusing (deduped).
async function effectiveDomains(
  state: PomodoroState | null
): Promise<string[]> {
  const isFocus = state?.phase === 'focus';
  const always = await getAlwaysBlocklist();
  const focusOnly = isFocus ? await getBlocklist() : [];
  return always.concat(focusOnly.filter((d) => always.indexOf(d) === -1));
}

function hostMatches(hostname: string, domains: string[]): boolean {
  const host = hostname.replace(/^www\./, '');
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

function blockedPageUrl(host: string): string {
  return chrome.runtime.getURL(`blocked.html?host=${encodeURIComponent(host)}`);
}

async function syncRules(state: PomodoroState | null): Promise<void> {
  const domains = await effectiveDomains(state);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: buildRules(domains),
  });
  await redirectOpenTabs(domains);
}

// declarativeNetRequest only gates network requests, so a page that is already
// open (or served from a site's service worker / cache) is never re-checked.
// Redirect any open tab that now matches the blocklist to the block page so
// enforcement is immediate.
async function redirectOpenTabs(domains: string[]): Promise<void> {
  if (domains.length === 0) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    let host: string;
    try {
      host = new URL(tab.url).hostname;
    } catch {
      continue;
    }
    if (hostMatches(host, domains)) {
      chrome.tabs.update(tab.id, { url: blockedPageUrl(host) });
    }
  }
}

async function scheduleAlarm(state: PomodoroState): Promise<void> {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { when: state.endsAt });
}

function notify(state: PomodoroState): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon-128.png',
    title: phaseLabel(state.phase),
    message:
      state.phase === 'focus'
        ? 'Focus time. Blocked sites are now blocked.'
        : 'Break time. Step away.',
    priority: 1,
  });
}

async function start(): Promise<void> {
  const preset = await getActivePreset();
  const state = startFocus(Date.now(), preset);
  await setPomodoroState(state);
  await scheduleAlarm(state);
  await syncRules(state);
  notify(state);
}

async function skip(): Promise<void> {
  const current = await getPomodoroState();
  if (!current) return start();
  const preset = await getActivePreset();
  const next = advance(current, Date.now(), preset);
  await setPomodoroState(next);
  await scheduleAlarm(next);
  await syncRules(next);
  notify(next);
}

async function pauseTimer(): Promise<void> {
  const current = await getPomodoroState();
  if (!current || current.pausedAt) return;
  await chrome.alarms.clear(ALARM_NAME);
  await setPomodoroState(pause(current, Date.now()));
}

async function resumeTimer(): Promise<void> {
  const current = await getPomodoroState();
  if (!current || !current.pausedAt) return;
  const next = resume(current, Date.now());
  await setPomodoroState(next);
  await scheduleAlarm(next);
}

async function stop(): Promise<void> {
  await chrome.alarms.clear(ALARM_NAME);
  await setPomodoroState(null);
  await syncRules(null);
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await syncRules(await getPomodoroState());
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await syncRules(await getPomodoroState());
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const current = await getPomodoroState();
  if (!current) return;
  const preset = await getActivePreset();
  const next = advance(current, Date.now(), preset);
  await setPomodoroState(next);
  await scheduleAlarm(next);
  await syncRules(next);
  notify(next);
});

// Catch navigations at the navigation layer (before any service worker can
// answer from cache) and redirect blocked sites to the block page. This is
// what makes blocking work without a hard refresh.
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  let host: string;
  try {
    host = new URL(details.url).hostname;
  } catch {
    return;
  }
  const domains = await effectiveDomains(await getPomodoroState());
  if (!hostMatches(host, domains)) return;
  await chrome.tabs.update(details.tabId, { url: blockedPageUrl(host) });
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (
    (changes[BLOCKLIST_KEY] || changes[ALWAYS_BLOCKLIST_KEY]) &&
    !changes[POMODORO_STATE_KEY]
  ) {
    await syncRules(await getPomodoroState());
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handle = async () => {
    if (msg?.type === 'pomodoro/start') await start();
    else if (msg?.type === 'pomodoro/pause') await pauseTimer();
    else if (msg?.type === 'pomodoro/resume') await resumeTimer();
    else if (msg?.type === 'pomodoro/skip') await skip();
    else if (msg?.type === 'pomodoro/stop') await stop();
  };
  handle().then(() => sendResponse({ ok: true }));
  return true;
});
