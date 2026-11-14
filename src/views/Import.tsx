/**
 * First-run screen: take the Spotify export and turn it into the dataset.
 * Accepts the zip exactly as Spotify sends it, the unpacked folder, or loose
 * JSON files — dropped or picked.
 */
import { useCallback, useRef, useState } from 'react'
import { unzipExport } from '../lib/unpack'
import {
  ImportError,
  buildRawDataset,
  isRelevant,
  type ImportFile,
  type ImportReport,
} from '../lib/ingest'
import type { RawDataset } from '../lib/data'
import { num } from '../lib/format'

type Phase = 'idle' | 'reading' | 'error'

export function Import({
  onReady,
  onCancel,
}: {
  onReady: (raw: RawDataset, report: ImportReport) => void
  onCancel?: () => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const filePicker = useRef<HTMLInputElement>(null)
  const folderPicker = useRef<HTMLInputElement>(null)

  // Phones and tablets have no drag-and-drop, and their file pickers cannot
  // return a whole folder, so the wording and the buttons change for them.
  const touchFirst =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches === true

  const handle = useCallback(
    async (files: File[]) => {
      setPhase('reading')
      setError(null)
      try {
        setStatus('Reading files…')
        const collected = await collectFiles(files, setStatus)
        if (!collected.length) {
          throw new ImportError(
            'Nothing usable in there. Drop the zip Spotify emailed you, or the ' +
              'folder you unpacked it to.',
          )
        }
        setStatus(`Analysing ${num(collected.length)} files…`)
        // Yield once so the status paints before the parse blocks the thread.
        await new Promise((r) => setTimeout(r, 16))
        const { raw, report } = buildRawDataset(collected)
        onReady(raw, report)
      } catch (e) {
        setPhase('error')
        setError(
          e instanceof ImportError
            ? e.message
            : `Could not read that export: ${(e as Error).message}`,
        )
      }
    },
    [onReady],
  )

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const items = [...e.dataTransfer.items]
      const entries = items
        .map((i) => (i.kind === 'file' ? i.webkitGetAsEntry?.() : null))
        .filter(Boolean) as FileSystemEntry[]

      if (entries.length && entries.some((en) => en.isDirectory)) {
        setPhase('reading')
        setStatus('Walking the folder…')
        const files: File[] = []
        for (const en of entries) await walkEntry(en, files)
        await handle(files)
        return
      }
      await handle([...e.dataTransfer.files])
    },
    [handle],
  )

  return (
    <div className="import-shell">
      <div className="import-card">
        <div className="import-brand">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="var(--accent)" />
            <path
              d="M7 9.4c3.2-.9 6.6-.6 9.4.9M7.6 12.4c2.7-.7 5.5-.5 7.9.8M8.2 15.3c2.2-.5 4.4-.3 6.3.7"
              stroke="var(--accent-ink)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <h1 className="import-title">Spotify Mapped</h1>
            <p className="import-sub">
              Your full listening history, read straight from your Spotify export.
            </p>
          </div>
        </div>

        <div
          className={`dropzone ${dragging ? 'is-dragging' : ''} ${phase === 'reading' ? 'is-busy' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {phase === 'reading' ? (
            <>
              <div className="spinner" />
              <div className="dropzone-title">{status}</div>
              <div className="dropzone-note">Large exports can take a few seconds.</div>
            </>
          ) : (
            <>
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 16V4m0 0L8 8m4-4 4 4" />
                <path d="M3 15v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-3" />
              </svg>
              <div className="dropzone-title">
                {touchFirst ? 'Add your Spotify export' : 'Drop your Spotify export here'}
              </div>
              <div className="dropzone-note">
                {touchFirst ? (
                  <>
                    Tap below and pick the <code>my_spotify_data.zip</code> Spotify emailed you
                  </>
                ) : (
                  <>
                    The <code>my_spotify_data.zip</code> file, or the folder you unpacked it to
                  </>
                )}
              </div>
              <div className="dropzone-actions">
                <button className="btn-primary" onClick={() => filePicker.current?.click()}>
                  {touchFirst ? 'Choose file' : 'Choose zip or files'}
                </button>
                {!touchFirst && (
                  <button className="icon-btn" onClick={() => folderPicker.current?.click()}>
                    Choose folder
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <input
          ref={filePicker}
          type="file"
          multiple
          accept=".zip,.json,application/zip,application/x-zip-compressed,application/json,application/octet-stream"
          className="sr-only"
          onChange={(e) => e.target.files && handle([...e.target.files])}
        />
        <input
          ref={folderPicker}
          type="file"
          className="sr-only"
          // @ts-expect-error non-standard but supported everywhere it matters
          webkitdirectory=""
          directory=""
          multiple
          onChange={(e) => e.target.files && handle([...e.target.files])}
        />

        {error && (
          <div className="import-error" role="alert">
            <b>Import failed</b>
            <p>{error}</p>
            <button className="icon-btn" onClick={() => { setPhase('idle'); setError(null) }}>
              Try again
            </button>
          </div>
        )}

        <details className="import-help">
          <summary>Where do I get this file?</summary>
          <ol>
            <li>
              Open <span className="mono">spotify.com/account/privacy</span> while signed in.
            </li>
            <li>
              Tick <b>Extended streaming history</b> — the default "Account data" option only
              covers about the last year. Ticking both is fine.
            </li>
            <li>
              Confirm the email Spotify sends, then wait. Account data arrives in a few days;
              extended history can take up to 30.
            </li>
            <li>Drop the zip they email you straight onto this page.</li>
          </ol>
          <p className="import-privacy">
            Everything is parsed in this browser tab and stored on this device only. Nothing is
            uploaded, and there is no server to upload it to.
          </p>
        </details>

        {onCancel && (
          <button className="icon-btn" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>
            Back to my data
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ reading */

/** Expands any zips, drops the files we have no use for, and reads the rest. */
async function collectFiles(
  files: File[],
  setStatus: (s: string) => void,
): Promise<ImportFile[]> {
  const out: ImportFile[] = []

  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const mb = file.size / 1048576
      setStatus(`Unpacking ${file.name} (${mb.toFixed(0)} MB)…`)
      // A whole export has to be held in memory to be unpacked. On a phone a
      // very large one can simply fail to allocate, so say what to do instead.
      let buf: Uint8Array
      try {
        buf = new Uint8Array(await file.arrayBuffer())
      } catch {
        throw new ImportError(
          `This device ran out of memory opening a ${mb.toFixed(0)} MB zip. ` +
            'Unzip it on a computer and select just the ' +
            '"Spotify Extended Streaming History" folder, which is only a few megabytes.',
        )
      }
      out.push(...unzipExport(buf))
      continue
    }
    // A raw folder drop includes megabytes of telemetry logs we never touch.
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    if (!isRelevant(path)) continue
    out.push({ path, text: await file.text() })
  }

  return out
}

/** Recursively pulls every file out of a dropped directory. */
async function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    )
    if (/\.zip$/i.test(file.name) || isRelevant(entry.fullPath || file.name)) {
      // Preserve the path so isRelevant sees the real name later.
      Object.defineProperty(file, 'webkitRelativePath', {
        value: entry.fullPath || file.name,
        configurable: true,
      })
      out.push(file)
    }
    return
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns at most 100 at a time, so keep going until it's empty.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      )
      if (!batch.length) break
      for (const child of batch) await walkEntry(child, out)
    }
  }
}
