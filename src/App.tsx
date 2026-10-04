import { useLiveQuery } from 'dexie-react-hooks'
import { SessionLogger } from './components/SessionLogger'
import { SuggestionCard } from './components/SuggestionCard'
import { suggestNext } from './engine'
import { BENCH } from './program'
import { db } from './storage/db'
import { exerciseHistory } from './storage/history'
import { startSession } from './storage/sessions'
import './App.css'

export default function App() {
  // Re-runs (and re-renders) whenever the sessions table changes.
  const data = useLiveQuery(async () => {
    const sessions = await db.sessions.orderBy('startedAt').toArray()
    return {
      active: sessions.find((s) => !s.finishedAt),
      suggestion: suggestNext(BENCH, exerciseHistory(sessions, BENCH.id), new Date()),
    }
  })
  if (!data) return null

  const { active, suggestion } = data

  return (
    <main>
      <h1>Logtelligent</h1>
      <SuggestionCard
        config={BENCH}
        suggestion={suggestion}
        heading={active ? 'Today' : 'Next session'}
      />
      {active ? (
        <SessionLogger key={active.id} config={BENCH} session={active} suggestion={suggestion} />
      ) : (
        <button
          type="button"
          className="primary block"
          disabled={suggestion.kind === 'needsSeed'}
          onClick={() => void startSession([BENCH.id])}
        >
          Start session
        </button>
      )}
    </main>
  )
}
