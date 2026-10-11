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
  // An exercise whose form opens on the Program tab, from a suggestion card (SPEC §6.6).
  const [editExerciseId, setEditExerciseId] = useState<string>()

  function show(next: Tab, exerciseId?: string) {
    setTab(next)
    setEditExerciseId(exerciseId)
  }

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
          <Button aria-pressed={tab === 'today'} onClick={() => show('today')}>
            Today
          </Button>
          <Button aria-pressed={tab === 'history'} onClick={() => show('history')}>
            History
          </Button>
          <Button aria-pressed={tab === 'program'} onClick={() => show('program')}>
            Program
          </Button>
        </nav>
      </header>
      {tab === 'today' && (
        <TodayView
          {...data}
          seeding={seeding}
          onSeeding={setSeeding}
          onEditProgram={() => show('program')}
          onEditExercise={(exerciseId) => show('program', exerciseId)}
        />
      )}
      {tab === 'history' && <HistoryView program={data.program} sessions={data.sessions} />}
      {tab === 'program' && (
        <ProgramView
          program={data.program}
          sessions={data.sessions}
          editExerciseId={editExerciseId}
          onTemplateApplied={() => {
            setSeeding(true)
            show('today')
          }}
        />
      )}
    </main>
  )
}
