import { DEFAULT_PRESET, Preset } from './pomodoro';
import {
  getAlwaysBlocklist,
  getBlocklist,
  normalizeDomain,
  setAlwaysBlocklist,
  setBlocklist,
} from './storage';
import {
  getActivePresetId,
  getPresets,
  savePresets,
  setActivePresetId,
} from './presets';

export const BACKUP_FORMAT = 'url-blocker-backup';
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  alwaysBlocked: string[];
  focusBlocked: string[];
  presets: Preset[];
  activePresetId: string;
};

export type ImportMode = 'merge' | 'replace';

export type ParseResult =
  | { ok: true; backup: Backup; warnings: string[] }
  | { ok: false; error: string };

export type ImportSummary = {
  mode: ImportMode;
  alwaysBlocked: { before: number; after: number };
  focusBlocked: { before: number; after: number };
  presets: { before: number; after: number };
};

// --- export ---------------------------------------------------------------

export async function buildBackup(now: Date = new Date()): Promise<Backup> {
  const [alwaysBlocked, focusBlocked, presets, activePresetId] =
    await Promise.all([
      getAlwaysBlocklist(),
      getBlocklist(),
      getPresets(),
      getActivePresetId(),
    ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    alwaysBlocked,
    focusBlocked,
    presets,
    activePresetId,
  };
}

export function backupFilename(now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `url-blocker-${stamp}.json`;
}

// --- import ---------------------------------------------------------------

function sanitizeList(value: unknown, warnings: string[], label: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    warnings.push(`"${label}" is not a list — ignored.`);
    return [];
  }
  const out: string[] = [];
  let dropped = 0;
  for (const raw of value) {
    const entry = typeof raw === 'string' ? normalizeDomain(raw) : '';
    if (!entry) {
      dropped++;
      continue;
    }
    if (out.indexOf(entry) === -1) out.push(entry);
  }
  if (dropped > 0) {
    warnings.push(
      `Skipped ${dropped} invalid entr${dropped === 1 ? 'y' : 'ies'} in "${label}".`
    );
  }
  return out;
}

const NUM_KEYS: (keyof Preset)[] = [
  'focusMinutes',
  'shortBreakMinutes',
  'longBreakMinutes',
  'cyclesBeforeLongBreak',
];

function sanitizePresets(value: unknown, warnings: string[]): Preset[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    warnings.push('"presets" is not a list — ignored.');
    return [];
  }
  const out: Preset[] = [];
  let dropped = 0;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') {
      dropped++;
      continue;
    }
    const candidate = raw as Record<string, unknown>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name =
      typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!id || !name || out.some((p) => p.id === id)) {
      dropped++;
      continue;
    }
    const preset: Preset = { ...DEFAULT_PRESET, id, name };
    let bad = false;
    for (const key of NUM_KEYS) {
      const n = Number(candidate[key]);
      if (!Number.isFinite(n) || n < 1) {
        bad = true;
        break;
      }
      // Minutes and cycle counts are always whole numbers >= 1.
      (preset[key] as number) = Math.min(600, Math.round(n));
    }
    if (bad) {
      dropped++;
      continue;
    }
    out.push(preset);
  }
  if (dropped > 0) {
    warnings.push(
      `Skipped ${dropped} invalid preset${dropped === 1 ? '' : 's'}.`
    );
  }
  return out;
}

// Parses a backup file. The input is untrusted user-supplied data, so every
// field is validated and anything unusable is dropped with a warning rather
// than trusted into storage.
export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'That file is not a url-blocker backup.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      error: 'That file is not a url-blocker backup (missing format marker).',
    };
  }
  const version = Number(obj.version);
  if (!Number.isFinite(version) || version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `This backup was made by a newer version of the extension (v${obj.version}).`,
    };
  }

  const warnings: string[] = [];
  const alwaysBlocked = sanitizeList(
    obj.alwaysBlocked,
    warnings,
    'alwaysBlocked'
  );
  const focusBlocked = sanitizeList(obj.focusBlocked, warnings, 'focusBlocked');
  const presets = sanitizePresets(obj.presets, warnings);
  const activePresetId =
    typeof obj.activePresetId === 'string' ? obj.activePresetId : '';

  if (
    alwaysBlocked.length === 0 &&
    focusBlocked.length === 0 &&
    presets.length === 0
  ) {
    return { ok: false, error: 'This backup has nothing to import.' };
  }

  return {
    ok: true,
    warnings,
    backup: {
      format: BACKUP_FORMAT,
      version,
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
      alwaysBlocked,
      focusBlocked,
      presets,
      activePresetId,
    },
  };
}

function mergeLists(current: string[], incoming: string[]): string[] {
  const merged = current.slice();
  for (const entry of incoming) {
    if (merged.indexOf(entry) === -1) merged.push(entry);
  }
  return merged;
}

// Presets are merged by id: an incoming preset replaces the stored one with
// the same id, and anything new is appended.
function mergePresets(current: Preset[], incoming: Preset[]): Preset[] {
  const merged = current.slice();
  for (const preset of incoming) {
    const at = merged.findIndex((p) => p.id === preset.id);
    if (at === -1) merged.push(preset);
    else merged[at] = preset;
  }
  return merged;
}

export async function applyBackup(
  backup: Backup,
  mode: ImportMode
): Promise<ImportSummary> {
  const [always, focus, presets, activeId] = await Promise.all([
    getAlwaysBlocklist(),
    getBlocklist(),
    getPresets(),
    getActivePresetId(),
  ]);

  const nextAlways =
    mode === 'replace'
      ? backup.alwaysBlocked
      : mergeLists(always, backup.alwaysBlocked);
  const nextFocus =
    mode === 'replace'
      ? backup.focusBlocked
      : mergeLists(focus, backup.focusBlocked);

  // A backup that carries no presets never wipes the ones already stored,
  // even in replace mode — there would be nothing left to fall back to.
  const nextPresets =
    backup.presets.length === 0
      ? presets
      : mode === 'replace'
        ? backup.presets
        : mergePresets(presets, backup.presets);

  await Promise.all([
    setAlwaysBlocklist(nextAlways),
    setBlocklist(nextFocus),
    savePresets(nextPresets),
  ]);

  // Keep the active preset pointing at something that exists.
  const wanted =
    backup.activePresetId &&
    nextPresets.some((p) => p.id === backup.activePresetId)
      ? backup.activePresetId
      : nextPresets.some((p) => p.id === activeId)
        ? activeId
        : nextPresets[0].id;
  if (wanted !== activeId) await setActivePresetId(wanted);

  return {
    mode,
    alwaysBlocked: { before: always.length, after: nextAlways.length },
    focusBlocked: { before: focus.length, after: nextFocus.length },
    presets: { before: presets.length, after: nextPresets.length },
  };
}
