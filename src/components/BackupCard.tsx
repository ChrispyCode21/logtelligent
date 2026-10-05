import { useRef, useState } from 'react'
import { exportBackup, parseBackup, restoreBackup } from '../storage/backup'
import { formatDate } from '../ui/format'

/** Export and restore all data as JSON (SPEC §2). Data never leaves the device otherwise. */
export function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string>()

  async function download() {
    const { filename, json } = await exportBackup()
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    setStatus(`Exported ${filename}.`)
  }

  async function restore(file: File) {
    try {
      const backup = parseBackup(await file.text())
      const date = formatDate(backup.exportedAt, 'numeric')
      const ok = confirm(
        `Replace ALL current data with this backup from ${date} (${backup.sessions.length} sessions)? ` +
          'This cannot be undone. Export first if you want to keep what is here now.',
      )
      if (!ok) return
      await restoreBackup(backup)
      setStatus(`Restored the backup from ${date}.`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'That backup could not be restored.')
    }
  }

  return (
    <section className="card backup">
      <h2>Backup</h2>
      <p className="muted">
        Your data lives only on this device. Export a backup now and then; restoring one replaces everything.
      </p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => void download()}>
          Export data
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Restore from file…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void restore(file)
          }}
        />
      </div>
      {status && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
    </section>
  )
}
