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
import { Logo } from '../components/Logo'

type Phase = 'idle' | 'reading' | 'error'

export function Import({
  onReady,
}: {
  onReady: (raw: RawDataset, report: ImportReport) => void
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
          <Logo size={32} />
          <h1 className="import-title">Spotify Mapped</h1>
        </div>

        <p className="import-lead">Your whole Spotify history, mapped.</p>

        <ul className="import-features" aria-label="What you'll see">
          {FEATURES.map((f) => (
            <li key={f.label}>
              <Icon d={f.icon} />
              {f.label}
            </li>
          ))}
        </ul>

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
                {touchFirst ? 'Add your Spotify zip' : 'Drop your Spotify zip here'}
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

        <details className="how">
          <summary>
            <Icon d={ICON.shield} size={18} />
            <span className="how-lead">
              <b>Privacy by design:</b> your file never leaves this device.
            </span>
            <span className="how-toggle">
              How it works
              <Icon d={ICON.chevron} size={15} />
            </span>
          </summary>

          <div className="how-flow">
            <div className="how-device">
              <span className="how-device-label">
                <Icon d={ICON.device} size={15} />
                Your device
              </span>
              <ol className="how-chain">
                <li>
                  <Icon d={ICON.zip} size={22} />
                  Your Spotify zip
                </li>
                <li className="how-arrow" aria-hidden="true">
                  <Icon d={ICON.arrow} size={18} />
                </li>
                <li>
                  <Icon d={ICON.browser} size={22} />
                  Opened in this tab
                </li>
                <li className="how-arrow" aria-hidden="true">
                  <Icon d={ICON.arrow} size={18} />
                </li>
                <li>
                  <Icon d={ICON.top} size={22} />
                  Your history, mapped
                </li>
              </ol>
            </div>

            <div className="how-blocked" aria-hidden="true">
              <span className="how-blocked-line" />
              <span className="how-blocked-x">&times;</span>
              <span className="how-blocked-line" />
            </div>

            <div className="how-cloud">
              <Icon d={ICON.cloudOff} size={26} />
              <b>Internet</b>
              <span>Nothing sent</span>
            </div>
          </div>

          <ul className="import-promise" aria-label="Privacy">
            {PROMISES.map((p) => (
              <li key={p.label} title={p.detail}>
                <Icon d={p.icon} size={17} />
                {p.label}
              </li>
            ))}
          </ul>
        </details>

        <section className="import-steps" aria-labelledby="get-file">
          <h2 id="get-file">No file yet?</h2>
          <ol>
            <li>
              <Icon d={ICON.request} />
              <a
                href="https://www.spotify.com/account/privacy/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Request it from Spotify
              </a>
              <span>
                Tick <i>Extended streaming history</i>
              </span>
            </li>
            <li>
              <Icon d={ICON.mail} />
              <b>Get the email</b>
              <span>A few days on average</span>
            </li>
            <li>
              <Icon d={ICON.upload} />
              <b>{touchFirst ? 'Add the zip here' : 'Drop the zip here'}</b>
              <span>No need to unzip</span>
            </li>
          </ol>
        </section>

      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- icons */

/** Line icons drawn for this page, one path string each (24 x 24 grid). */
const ICON = {
  history: 'M4 6h16M4 12h16M4 18h10',
  top: 'M5 20v-7M12 20V5M19 20v-10',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z',
  offline: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18',
  shield: 'M12 2.5 4.5 5.5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10v-6zM8.8 12l2.2 2.2 4.2-4.4',
  request: 'M9 4h6M8 4H6a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2M9 12l2 2 4-4',
  mail: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 7l9 6 9-6',
  upload: 'M12 16V4m0 0L8 8m4-4 4 4M3 15v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-3',
  device: 'M5 5h14a1 1 0 0 1 1 1v9H4V6a1 1 0 0 1 1-1zM2 18.5h20',
  zip: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M10 4h.01M10 7h.01M10 10h.01M10 13h.01',
  browser: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 9h18M6.5 6.5h.01M9 6.5h.01',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  chevron: 'm6 9 6 6 6-6',
  cloudOff: 'M7 18.5h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.3 9.7 4.4 4.4 0 0 0 7 18.5zM3 3l18 18',
}

const FEATURES = [
  { icon: ICON.history, label: 'Every play' },
  { icon: ICON.top, label: 'Top artists' },
  { icon: ICON.clock, label: 'Your habits' },
  { icon: ICON.calendar, label: 'Year by year' },
]

const PROMISES = [
  { icon: ICON.lock, label: 'Stays on your device', detail: 'Your file is read in this browser tab and never uploaded.' },
  { icon: ICON.offline, label: 'Works offline', detail: 'Once the page is open, no internet is needed.' },
  { icon: ICON.shield, label: 'Nothing collected', detail: 'Nothing you add is collected or saved. Close the page and it is gone.' },
]

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
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
