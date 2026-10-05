import { useState } from 'react'
import { formatDate, formatE1rm } from '../ui/format'

export interface ChartPoint {
  date: string
  value: number
}

const WIDTH = 440
const HEIGHT = 160
const PAD = { top: 12, right: 12, bottom: 22, left: 40 }
const Y_STEP = 5

interface Props {
  /** Oldest first. */
  points: ChartPoint[]
}

/** Session e1RM over time (SPEC §5.3): one series, so no legend; the readout shows the hovered point. */
export function E1rmChart({ points }: Props) {
  const [active, setActive] = useState<number | null>(null)
  if (points.length < 2) return null

  const times = points.map((p) => Date.parse(p.date))
  const values = points.map((p) => p.value)
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  // Round the y-domain out to 5 lb so gridlines land on readable numbers.
  const yMin = Math.floor(Math.min(...values) / Y_STEP) * Y_STEP - Y_STEP
  const yMax = Math.ceil(Math.max(...values) / Y_STEP) * Y_STEP + Y_STEP
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (WIDTH - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (HEIGHT - PAD.top - PAD.bottom)
  const ticks = [yMin, (yMin + yMax) / 2, yMax]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i])},${y(p.value)}`).join(' ')

  const shown = active ?? points.length - 1
  const label = active === null ? 'Latest' : formatDate(points[shown].date, 'short')

  function nearest(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * WIDTH
    let best = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(times[i]) - px) < Math.abs(x(times[best]) - px)) best = i
    }
    setActive(best)
  }

  return (
    <figure className="chart">
      <figcaption>
        <span className="muted">Estimated 1RM · {label}</span>{' '}
        <strong>{formatE1rm(points[shown].value)}</strong>
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Estimated 1RM from ${points[0].value.toFixed(1)} to ${points.at(-1)!.value.toFixed(1)} lb`}
        onPointerMove={nearest}
        onPointerDown={nearest}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        ))}
        <text className="axis" x={PAD.left} y={HEIGHT - 4}>
          {formatDate(points[0].date, 'short')}
        </text>
        <text className="axis" x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end">
          {formatDate(points.at(-1)!.date, 'short')}
        </text>

        {active !== null && (
          <line
            className="crosshair"
            x1={x(times[active])}
            x2={x(times[active])}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
          />
        )}
        <path className="series" d={path} />
        {points.map((p, i) => (
          <circle key={p.date} className="marker" cx={x(times[i])} cy={y(p.value)} r={i === shown ? 5 : 4} />
        ))}
      </svg>
    </figure>
  )
}
