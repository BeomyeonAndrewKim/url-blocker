export type Phase = 'focus' | 'shortBreak' | 'longBreak';

export type Preset = {
  id: string;
  name: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
};

export type PomodoroState = {
  phase: Phase;
  endsAt: number;
  cyclesCompleted: number;
};

export const DEFAULT_PRESET: Preset = {
  id: 'classic',
  name: 'Classic',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

function durationMs(phase: Phase, preset: Preset): number {
  const minutes =
    phase === 'focus'
      ? preset.focusMinutes
      : phase === 'shortBreak'
      ? preset.shortBreakMinutes
      : preset.longBreakMinutes;
  return minutes * 60 * 1000;
}

export function startFocus(now: number, preset: Preset): PomodoroState {
  return {
    phase: 'focus',
    endsAt: now + durationMs('focus', preset),
    cyclesCompleted: 0,
  };
}

export function advance(
  state: PomodoroState,
  now: number,
  preset: Preset
): PomodoroState {
  if (state.phase === 'focus') {
    const cycles = state.cyclesCompleted + 1;
    const next: Phase =
      cycles % preset.cyclesBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak';
    return {
      phase: next,
      endsAt: now + durationMs(next, preset),
      cyclesCompleted: cycles,
    };
  }
  return {
    phase: 'focus',
    endsAt: now + durationMs('focus', preset),
    cyclesCompleted: state.cyclesCompleted,
  };
}

export function phaseLabel(phase: Phase): string {
  return phase === 'focus'
    ? 'Focus'
    : phase === 'shortBreak'
    ? 'Short break'
    : 'Long break';
}
