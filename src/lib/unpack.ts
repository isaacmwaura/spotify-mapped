/**
 * Unpacks a Spotify export zip into the text files the importer needs.
 * Kept free of any screen code so it can be tested on its own.
 */
import { unzipSync } from 'fflate'
import { ImportError, isRelevant, type ImportFile } from './ingest'

/**
 * Returns only the files the importer reads. Everything else in the zip — tens
 * of megabytes of telemetry — is skipped without being decompressed.
 *
 * Synchronous on purpose: the async version runs in a Web Worker, which
 * browsers block when the page is opened straight off disk.
 */
export function unzipExport(data: Uint8Array): ImportFile[] {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(data, { filter: (f) => isRelevant(f.name) })
  } catch (e) {
    throw new ImportError(`That zip could not be opened (${(e as Error).message}).`)
  }
  const decoder = new TextDecoder()
  return Object.entries(entries).map(([path, bytes]) => ({
    path,
    text: decoder.decode(bytes),
  }))
}
