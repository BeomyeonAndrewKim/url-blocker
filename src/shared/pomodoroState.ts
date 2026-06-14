import { PomodoroState } from './pomodoro';

export const POMODORO_STATE_KEY = 'pomodoro';

export async function getPomodoroState(): Promise<PomodoroState | null> {
  const result = await chrome.storage.local.get(POMODORO_STATE_KEY);
  return result[POMODORO_STATE_KEY] ?? null;
}

export async function setPomodoroState(
  state: PomodoroState | null
): Promise<void> {
  await chrome.storage.local.set({ [POMODORO_STATE_KEY]: state });
}
