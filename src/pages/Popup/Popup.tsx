import React, { useEffect, useState } from 'react';
import './Popup.scss';
import {
  ALWAYS_BLOCKLIST_KEY,
  BLOCKLIST_KEY,
  getAlwaysBlocklist,
  getBlocklist,
  setAlwaysBlocklist,
  setBlocklist,
} from '../../shared/storage';
import {
  DEFAULT_PRESET,
  Phase,
  phaseLabel,
  Preset,
  PomodoroState,
} from '../../shared/pomodoro';
import {
  ACTIVE_PRESET_KEY,
  getActivePresetId,
  getPresets,
  PRESETS_KEY,
  savePresets,
  setActivePresetId,
} from '../../shared/presets';
import {
  getPomodoroState,
  POMODORO_STATE_KEY,
} from '../../shared/pomodoroState';

function normalize(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/\/+$/, ''); // drop trailing slash, but keep any path
  return s;
}

function useStorageValue<T>(
  key: string,
  load: () => Promise<T>
): [T | undefined, (v: T) => void] {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    load().then(setValue);
    const listener = (
      changes: { [k: string]: chrome.storage.StorageChange },
      area: chrome.storage.AreaName
    ) => {
      if (area === 'local' && changes[key]) {
        load().then(setValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, setValue];
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function send(type: string): void {
  chrome.runtime.sendMessage({ type });
}

const RADIUS = 80;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const Ring: React.FC<{ progress: number; children: React.ReactNode }> = ({
  progress,
  children,
}) => (
  <div className="ring">
    <svg viewBox="0 0 180 180">
      <circle
        className="track"
        cx="90"
        cy="90"
        r={RADIUS}
        fill="none"
        strokeWidth="10"
      />
      <circle
        className="fill"
        cx="90"
        cy="90"
        r={RADIUS}
        fill="none"
        strokeWidth="10"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
      />
    </svg>
    <div className="ring-center">{children}</div>
  </div>
);

const TimerView: React.FC = () => {
  const [state] = useStorageValue<PomodoroState | null>(
    POMODORO_STATE_KEY,
    getPomodoroState
  );
  const [presets] = useStorageValue<Preset[]>(PRESETS_KEY, getPresets);
  const [activeId] = useStorageValue<string>(
    ACTIVE_PRESET_KEY,
    getActivePresetId
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(i);
  }, []);

  const paused = !!state?.pausedAt;
  const remaining = state
    ? (paused ? state.pausedAt! : now) <= state.endsAt
      ? state.endsAt - (paused ? state.pausedAt! : now)
      : 0
    : 0;
  const span = state ? state.endsAt - state.startedAt : 0;
  const progress = state && span > 0 ? Math.min(1, remaining / span) : 0;

  return (
    <div className="timer">
      <Ring progress={state ? progress : 0}>
        <div className="phase">
          {!state ? 'Idle' : paused ? 'Paused' : phaseLabel(state.phase)}
        </div>
        <div className="time">
          {state ? formatRemaining(remaining) : '0:00'}
        </div>
        {state && <div className="cycles">{state.cyclesCompleted} cycles</div>}
      </Ring>

      <div className="controls">
        {!state ? (
          <button
            className="btn primary"
            onClick={() => send('pomodoro/start')}
          >
            Start focus
          </button>
        ) : (
          <>
            {paused ? (
              <button
                className="btn primary"
                onClick={() => send('pomodoro/resume')}
              >
                Resume
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => send('pomodoro/pause')}
              >
                Pause
              </button>
            )}
            <button className="btn" onClick={() => send('pomodoro/skip')}>
              Skip
            </button>
            <button className="btn" onClick={() => send('pomodoro/stop')}>
              Stop
            </button>
          </>
        )}
      </div>

      <div className="preset-select">
        <label>Active preset</label>
        <select
          value={activeId ?? ''}
          onChange={(e) => setActivePresetId(e.target.value)}
        >
          {(presets ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.focusMinutes}/{p.shortBreakMinutes}/
              {p.longBreakMinutes}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

const BlocklistEditor: React.FC<{
  title: string;
  storageKey: string;
  load: () => Promise<string[]>;
  save: (domains: string[]) => Promise<void>;
}> = ({ title, storageKey, load, save }) => {
  const [domains] = useStorageValue<string[]>(storageKey, load);
  const [input, setInput] = useState('');
  const list = domains ?? [];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = normalize(input);
    if (!domain || list.includes(domain)) {
      setInput('');
      return;
    }
    await save([...list, domain]);
    setInput('');
  };

  const remove = async (d: string) => {
    await save(list.filter((x) => x !== d));
  };

  return (
    <div>
      <div className="section-head">
        <h4>{title}</h4>
      </div>
      <form className="add-row" onSubmit={add}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="example.com or example.com/path"
        />
        <button className="ghost-btn" type="submit">
          Add
        </button>
      </form>
      <ul className="chip-list">
        {list.map((d) => (
          <li key={d}>
            <span>{d}</span>
            <button className="x" onClick={() => remove(d)}>
              ×
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="empty">No sites blocked yet.</li>}
      </ul>
    </div>
  );
};

const NUM_FIELDS: { key: keyof Preset; label: string }[] = [
  { key: 'focusMinutes', label: 'Focus min' },
  { key: 'shortBreakMinutes', label: 'Short break' },
  { key: 'longBreakMinutes', label: 'Long break' },
  { key: 'cyclesBeforeLongBreak', label: 'Cycles → long' },
];

const PresetEditor: React.FC = () => {
  const [presets] = useStorageValue<Preset[]>(PRESETS_KEY, getPresets);
  const list = presets ?? [];

  const update = async (id: string, patch: Partial<Preset>) => {
    await savePresets(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const add = async () => {
    const id =
      (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
      `preset-${list.length}-${list.reduce((n, p) => n + p.name.length, 1)}`;
    const next: Preset = { ...DEFAULT_PRESET, id, name: 'New preset' };
    await savePresets([...list, next]);
  };

  const remove = async (id: string) => {
    if (list.length <= 1) return;
    await savePresets(list.filter((p) => p.id !== id));
  };

  return (
    <div>
      <div className="section-head">
        <h4>Presets</h4>
        <button className="ghost-btn" onClick={add}>
          + Add
        </button>
      </div>
      {list.map((p) => (
        <div className="preset-card" key={p.id}>
          <div className="preset-name-row">
            <input
              type="text"
              value={p.name}
              onChange={(e) => update(p.id, { name: e.target.value })}
            />
            <button
              className="ghost-btn"
              onClick={() => remove(p.id)}
              disabled={list.length <= 1}
              title={list.length <= 1 ? 'Keep at least one preset' : 'Delete'}
            >
              ×
            </button>
          </div>
          <div className="preset-grid">
            {NUM_FIELDS.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type="number"
                  min={1}
                  value={p[f.key] as number}
                  onChange={(e) =>
                    update(p.id, { [f.key]: Number(e.target.value) || 1 })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Popup: React.FC = () => {
  const [tab, setTab] = useState<'timer' | 'settings'>('timer');
  const [state] = useStorageValue<PomodoroState | null>(
    POMODORO_STATE_KEY,
    getPomodoroState
  );

  const phase: Phase | 'idle' = state ? state.phase : 'idle';

  return (
    <div className={`popup phase-${phase}`}>
      <div className="tabs">
        <button
          className={tab === 'timer' ? 'active' : ''}
          onClick={() => setTab('timer')}
        >
          Timer
        </button>
        <button
          className={tab === 'settings' ? 'active' : ''}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </div>
      {tab === 'timer' ? (
        <TimerView />
      ) : (
        <>
          <BlocklistEditor
            title="Always blocked"
            storageKey={ALWAYS_BLOCKLIST_KEY}
            load={getAlwaysBlocklist}
            save={setAlwaysBlocklist}
          />
          <div className="divider" />
          <BlocklistEditor
            title="Blocked during focus"
            storageKey={BLOCKLIST_KEY}
            load={getBlocklist}
            save={setBlocklist}
          />
          <div className="divider" />
          <PresetEditor />
        </>
      )}
    </div>
  );
};

export default Popup;
