import { PomodoroState } from './pomodoro';
import { readValue, writeValue } from './storage';

export const POMODORO_STATE_KEY = 'pomodoro';

export function getPomodoroState(): Promise<PomodoroState | null> {
  return readValue<PomodoroState | null>(POMODORO_STATE_KEY, null);
}

export function setPomodoroState(state: PomodoroState | null): Promise<void> {
  return writeValue(POMODORO_STATE_KEY, state);
}
