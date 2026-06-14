import React, { useEffect, useState } from 'react';
import {
  BLOCKLIST_KEY,
  getBlocklist,
  setBlocklist,
} from '../../shared/storage';
import {
  DEFAULT_PRESET,
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
  s = s.split('/')[0];
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

  const running = !!state && state.endsAt > now;
  const remaining = state ? state.endsAt - now : 0;

  return (
    <div>
      <div style={{ fontSize: 14, color: '#666' }}>
        {state ? phaseLabel(state.phase) : 'Idle'}
      </div>
      <div style={{ fontSize: 36, fontWeight: 600, margin: '4px 0 12px' }}>
        {state ? formatRemaining(remaining) : '–:––'}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {!running ? (
          <button onClick={() => send('pomodoro/start')}>Start focus</button>
        ) : (
          <>
            <button onClick={() => send('pomodoro/skip')}>Skip</button>
            <button onClick={() => send('pomodoro/stop')}>Stop</button>
          </>
        )}
      </div>
      <label style={{ fontSize: 12, color: '#666' }}>
        Preset:&nbsp;
        <select
          value={activeId ?? ''}
          onChange={(e) => setActivePresetId(e.target.value)}
        >
          {(presets ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.focusMinutes}/{p.shortBreakMinutes}/
              {p.longBreakMinutes})
            </option>
          ))}
        </select>
      </label>
      {state && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
          Cycles completed: {state.cyclesCompleted}
        </div>
      )}
    </div>
  );
};

const BlocklistEditor: React.FC = () => {
  const [domains] = useStorageValue<string[]>(BLOCKLIST_KEY, getBlocklist);
  const [input, setInput] = useState('');
  const list = domains ?? [];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = normalize(input);
    if (!domain || list.includes(domain)) {
      setInput('');
      return;
    }
    await setBlocklist([...list, domain]);
    setInput('');
  };

  const remove = async (d: string) => {
    await setBlocklist(list.filter((x) => x !== d));
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 6px' }}>Blocked sites</h4>
      <form onSubmit={add} style={{ display: 'flex', gap: 4 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="example.com"
          style={{ flex: 1, padding: 4 }}
        />
        <button type="submit">Add</button>
      </form>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 6 }}>
        {list.map((d) => (
          <li
            key={d}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '2px 0',
            }}
          >
            <span>{d}</span>
            <button onClick={() => remove(d)}>×</button>
          </li>
        ))}
        {list.length === 0 && (
          <li style={{ color: '#888' }}>No domains blocked.</li>
        )}
      </ul>
    </div>
  );
};

const PresetEditor: React.FC = () => {
  const [presets] = useStorageValue<Preset[]>(PRESETS_KEY, getPresets);
  const list = presets ?? [];

  const update = async (id: string, patch: Partial<Preset>) => {
    await savePresets(list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const add = async () => {
    const id =
      (typeof crypto !== 'undefined' && crypto.randomUUID?.()) ||
      `preset-${Date.now()}`;
    const next: Preset = { ...DEFAULT_PRESET, id, name: 'New preset' };
    await savePresets([...list, next]);
  };

  const remove = async (id: string) => {
    if (list.length <= 1) return;
    await savePresets(list.filter((p) => p.id !== id));
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h4 style={{ margin: '0 0 6px' }}>Presets</h4>
        <button onClick={add}>+ Add</button>
      </div>
      {list.map((p) => (
        <div
          key={p.id}
          style={{
            border: '1px solid #eee',
            borderRadius: 4,
            padding: 6,
            marginBottom: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <input
              value={p.name}
              onChange={(e) => update(p.id, { name: e.target.value })}
              style={{ flex: 1 }}
            />
            <button
              onClick={() => remove(p.id)}
              disabled={list.length <= 1}
              title={list.length <= 1 ? 'Keep at least one preset' : 'Delete'}
            >
              ×
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              fontSize: 12,
            }}
          >
            <label>
              Focus min
              <input
                type="number"
                min={1}
                value={p.focusMinutes}
                onChange={(e) =>
                  update(p.id, { focusMinutes: Number(e.target.value) || 1 })
                }
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Short break
              <input
                type="number"
                min={1}
                value={p.shortBreakMinutes}
                onChange={(e) =>
                  update(p.id, {
                    shortBreakMinutes: Number(e.target.value) || 1,
                  })
                }
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Long break
              <input
                type="number"
                min={1}
                value={p.longBreakMinutes}
                onChange={(e) =>
                  update(p.id, {
                    longBreakMinutes: Number(e.target.value) || 1,
                  })
                }
                style={{ width: '100%' }}
              />
            </label>
            <label>
              Cycles → long
              <input
                type="number"
                min={1}
                value={p.cyclesBeforeLongBreak}
                onChange={(e) =>
                  update(p.id, {
                    cyclesBeforeLongBreak: Number(e.target.value) || 1,
                  })
                }
                style={{ width: '100%' }}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
};

const Popup: React.FC = () => {
  const [tab, setTab] = useState<'timer' | 'settings'>('timer');
  return (
    <div style={{ width: 320, padding: 12, fontFamily: 'system-ui' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setTab('timer')}
          style={{ fontWeight: tab === 'timer' ? 600 : 400 }}
        >
          Timer
        </button>
        <button
          onClick={() => setTab('settings')}
          style={{ fontWeight: tab === 'settings' ? 600 : 400 }}
        >
          Settings
        </button>
      </div>
      {tab === 'timer' ? (
        <TimerView />
      ) : (
        <>
          <BlocklistEditor />
          <PresetEditor />
        </>
      )}
    </div>
  );
};

export default Popup;
