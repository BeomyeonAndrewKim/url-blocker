import { DEFAULT_PRESET, Preset } from './pomodoro';

export const PRESETS_KEY = 'presets';
export const ACTIVE_PRESET_KEY = 'activePresetId';

export async function getPresets(): Promise<Preset[]> {
  const result = await chrome.storage.local.get(PRESETS_KEY);
  const presets: Preset[] = result[PRESETS_KEY] ?? [];
  return presets.length > 0 ? presets : [DEFAULT_PRESET];
}

export async function savePresets(presets: Preset[]): Promise<void> {
  const safe = presets.length > 0 ? presets : [DEFAULT_PRESET];
  await chrome.storage.local.set({ [PRESETS_KEY]: safe });
}

export async function getActivePresetId(): Promise<string> {
  const result = await chrome.storage.local.get(ACTIVE_PRESET_KEY);
  return result[ACTIVE_PRESET_KEY] ?? DEFAULT_PRESET.id;
}

export async function setActivePresetId(id: string): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_PRESET_KEY]: id });
}

export async function getActivePreset(): Promise<Preset> {
  const [presets, activeId] = await Promise.all([
    getPresets(),
    getActivePresetId(),
  ]);
  return presets.find((p) => p.id === activeId) ?? presets[0];
}

export async function ensureDefaults(): Promise<void> {
  const presets = await getPresets();
  await savePresets(presets);
  const activeId = await getActivePresetId();
  if (!presets.find((p) => p.id === activeId)) {
    await setActivePresetId(presets[0].id);
  }
}
