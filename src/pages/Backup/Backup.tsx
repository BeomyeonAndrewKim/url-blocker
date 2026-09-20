import React, { useRef, useState } from 'react';
import './Backup.scss';
import {
  applyBackup,
  Backup as BackupData,
  backupFilename,
  buildBackup,
  ImportMode,
  ImportSummary,
  parseBackup,
} from '../../shared/transfer';

type Status =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; summary: ImportSummary; warnings: string[] };

function downloadJson(filename: string, body: string): void {
  const url = URL.createObjectURL(
    new Blob([body], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some Chrome builds.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function delta(before: number, after: number): string {
  const d = after - before;
  if (d === 0) return `${after} (unchanged)`;
  return `${after} (${d > 0 ? '+' : ''}${d})`;
}

const Preview: React.FC<{ backup: BackupData }> = ({ backup }) => (
  <dl className="preview">
    <div>
      <dt>Always blocked</dt>
      <dd>{backup.alwaysBlocked.length} sites</dd>
    </div>
    <div>
      <dt>Blocked during focus</dt>
      <dd>{backup.focusBlocked.length} sites</dd>
    </div>
    <div>
      <dt>Presets</dt>
      <dd>{backup.presets.length}</dd>
    </div>
    {backup.exportedAt && (
      <div>
        <dt>Exported</dt>
        <dd>{new Date(backup.exportedAt).toLocaleString()}</dd>
      </div>
    )}
  </dl>
);

const Backup: React.FC = () => {
  const [mode, setMode] = useState<ImportMode>('merge');
  const [pending, setPending] = useState<{
    backup: BackupData;
    warnings: string[];
    filename: string;
  } | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportNow = async () => {
    const now = new Date();
    const backup = await buildBackup(now);
    downloadJson(backupFilename(now), JSON.stringify(backup, null, 2));
  };

  const loadFile = async (file: File) => {
    setStatus({ kind: 'idle' });
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setPending(null);
      setStatus({ kind: 'error', message: result.error });
      return;
    }
    setPending({
      backup: result.backup,
      warnings: result.warnings,
      filename: file.name,
    });
  };

  const confirmImport = async () => {
    if (!pending) return;
    const summary = await applyBackup(pending.backup, mode);
    setStatus({ kind: 'done', summary, warnings: pending.warnings });
    setPending(null);
  };

  return (
    <div className="backup">
      <header>
        <h1>Backup &amp; restore</h1>
        <p>
          Save your blocklists and Pomodoro presets to a JSON file, or load them
          back on another machine.
        </p>
      </header>

      <section>
        <h2>Export</h2>
        <p className="hint">
          Downloads a single <code>.json</code> file containing both blocklists
          and every preset.
        </p>
        <button className="btn primary" onClick={exportNow}>
          Export to file
        </button>
      </section>

      <section>
        <h2>Import</h2>

        <div className="modes">
          {(['merge', 'replace'] as ImportMode[]).map((m) => (
            <label key={m} className={mode === m ? 'mode active' : 'mode'}>
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              <span className="mode-name">
                {m === 'merge' ? 'Merge' : 'Overwrite'}
              </span>
              <span className="mode-desc">
                {m === 'merge'
                  ? 'Add to what you already have, skipping duplicates.'
                  : 'Replace your current lists with the file.'}
              </span>
            </label>
          ))}
        </div>

        <div
          className={dragging ? 'dropzone over' : 'dropzone'}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) loadFile(file);
          }}
        >
          <p>Drop a backup file here</p>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            Choose file…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
              // Allow re-picking the same file after a failed import.
              e.target.value = '';
            }}
          />
        </div>

        {status.kind === 'error' && (
          <p className="banner error">{status.message}</p>
        )}

        {pending && (
          <div className="confirm">
            <h3>{pending.filename}</h3>
            <Preview backup={pending.backup} />
            {pending.warnings.map((w) => (
              <p className="banner warn" key={w}>
                {w}
              </p>
            ))}
            <div className="confirm-actions">
              <button className="btn primary" onClick={confirmImport}>
                {mode === 'merge'
                  ? 'Merge into my lists'
                  : 'Overwrite my lists'}
              </button>
              <button className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {status.kind === 'done' && (
          <div className="banner ok">
            <strong>
              Imported (
              {status.summary.mode === 'merge' ? 'merged' : 'overwritten'}).
            </strong>
            <ul>
              <li>
                Always blocked:{' '}
                {delta(
                  status.summary.alwaysBlocked.before,
                  status.summary.alwaysBlocked.after
                )}
              </li>
              <li>
                Blocked during focus:{' '}
                {delta(
                  status.summary.focusBlocked.before,
                  status.summary.focusBlocked.after
                )}
              </li>
              <li>
                Presets:{' '}
                {delta(
                  status.summary.presets.before,
                  status.summary.presets.after
                )}
              </li>
            </ul>
            {status.warnings.map((w) => (
              <p className="warn-line" key={w}>
                {w}
              </p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Backup;
