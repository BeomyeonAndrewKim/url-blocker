import { BLOCKLIST_KEY, getBlocklist } from '../../shared/storage';
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

async function syncRules(state: PomodoroState | null): Promise<void> {
  const isFocus = state?.phase === 'focus';
  const domains = isFocus ? await getBlocklist() : [];
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((r) => r.id),
    addRules: buildRules(domains),
  });
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

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes[BLOCKLIST_KEY] && !changes[POMODORO_STATE_KEY]) {
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
