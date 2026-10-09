import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { HistoryView } from './components/HistoryView'
import { ProgramView } from './components/ProgramView'
import { TodayView } from './components/TodayView'
import { EMPTY_PROGRAM } from './program/program'
import { db } from './storage/db'
import { Button } from './ui/Button'
import './App.css'

type Tab = 'today' | 'history' | 'program'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  // The guided seed walkthrough is open on the Today tab (SPEC §5.1).
  const [seeding, setSeeding] = useState(false)

  // Re-runs (and re-renders) whenever the tables it reads change.
  const data = useLiveQuery(async () => ({
    program: (await db.programs.get('main')) ?? EMPTY_PROGRAM,
    sessions: await db.sessions.orderBy('startedAt').toArray(),
    asOf: new Date(),
  }))
  if (!data) return null

  return (
    <main>
      <header className="app-header">
        <h1>Logtelligent</h1>
        <nav className="tabs">
          <Button aria-pressed={tab === 'today'} onClick={() => setTab('today')}>
            Today
          </Button>
          <Button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>
            History
          </Button>
          <Button aria-pressed={tab === 'program'} onClick={() => setTab('program')}>
            Program
          </Button>
        </nav>
      </header>
      {tab === 'today' && (
        <TodayView
          {...data}
          seeding={seeding}
          onSeeding={setSeeding}
          onEditProgram={() => setTab('program')}
        />
      )}
      {tab === 'history' && <HistoryView program={data.program} sessions={data.sessions} />}
      {tab === 'program' && (
        <ProgramView
          program={data.program}
          sessions={data.sessions}
          onTemplateApplied={() => {
            setSeeding(true)
            setTab('today')
          }}
        />
      )}
    </main>
  )
}
