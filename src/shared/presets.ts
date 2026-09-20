import { DEFAULT_PRESET, Preset } from './pomodoro';
import { readValue, writeValue } from './storage';

export const PRESETS_KEY = 'presets';
export const ACTIVE_PRESET_KEY = 'activePresetId';

export async function getPresets(): Promise<Preset[]> {
  const presets = await readValue<Preset[]>(PRESETS_KEY, []);
  return presets.length > 0 ? presets : [DEFAULT_PRESET];
}

export function savePresets(presets: Preset[]): Promise<void> {
  const safe = presets.length > 0 ? presets : [DEFAULT_PRESET];
  return writeValue(PRESETS_KEY, safe);
}

export function getActivePresetId(): Promise<string> {
  return readValue<string>(ACTIVE_PRESET_KEY, DEFAULT_PRESET.id);
}

export function setActivePresetId(id: string): Promise<void> {
  return writeValue(ACTIVE_PRESET_KEY, id);
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
