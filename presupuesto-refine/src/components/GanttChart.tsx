import React from 'react'

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTH_NAMES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export interface GanttTask {
  id: string
  name: string
  phase: string
  startDay: number
  endDay: number
}

export interface GanttChartProps {
  tasks: GanttTask[]
  span: number
  unit: 'hour' | 'day' | 'week' | 'month' | 'year'
  onTasksChange: (tasks: GanttTask[]) => void
  readOnly?: boolean
}

function calcHeaders(span: number, unit: string) {
  if (unit === 'month' || unit === 'year') {
    const label = unit === 'month' ? 'MES' : 'AÑO'
    return {
      top: Array.from({ length: span }, (_, i) => ({ label: `${label} ${String(i + 1).padStart(2, '0')}`, colspan: 1 })),
      mid: [] as { label: string; colspan: number }[],
      bot: [] as { label: string; colspan: number }[],
      totalUnits: span,
    }
  }
  if (unit === 'week') {
    const top: { label: string; colspan: number }[] = []
    let rem = span, mIdx = 0
    while (rem > 0) {
      const w = Math.min(mIdx % 2 === 0 ? 5 : 4, rem)
      top.push({ label: `MES ${MONTH_NAMES[mIdx] || (mIdx + 1)}`, colspan: w })
      rem -= w; mIdx++
    }
    const mid = Array.from({ length: span }, (_, i) => ({ label: `SEM ${i + 1}`, colspan: 1 }))
    return { top, mid, bot: mid, totalUnits: span }
  }
  if (unit === 'hour') {
    const days = Math.ceil(span / 24)
    const top: { label: string; colspan: number }[] = []
    let rem = span
    for (let d = 0; d < days && rem > 0; d++) {
      const h = Math.min(24, rem)
      top.push({ label: `DÍA ${d + 1}`, colspan: h })
      rem -= h
    }
    const bot = Array.from({ length: span }, (_, i) => ({ label: `${i + 1}h`, colspan: 1 }))
    return { top, mid: bot, bot, totalUnits: span }
  }
  // day
  let remaining = span
  const monthGroups: { month: number; days: number; label: string }[] = []
  while (remaining > 0) {
    const m = monthGroups.length
    const used = Math.min(MONTH_DAYS[m % 12], remaining)
    monthGroups.push({ month: m, days: used, label: MONTH_NAMES[m % 12] || `MES ${m + 1}` })
    remaining -= used
  }
  const top = monthGroups.map((mg) => ({ label: mg.label, colspan: mg.days }))
  const mid: { label: string; colspan: number }[] = []
  let dayOffset = 1
  for (const mg of monthGroups) {
    let ws = 1
    while (ws <= mg.days) {
      const we = Math.min(ws + 6, mg.days)
      mid.push({ label: `SEM ${Math.ceil(dayOffset / 7)}`, colspan: we - ws + 1 })
      ws += 7
    }
    dayOffset += mg.days
  }
  const bot = Array.from({ length: span }, (_, i) => ({ label: `${i + 1}`, colspan: 1 }))
  return { top, mid, bot, totalUnits: span }
}

export function GanttChart({ tasks, span, unit, onTasksChange, readOnly }: GanttChartProps) {
  const headers = calcHeaders(span, unit)

  function barStyle(t: GanttTask) {
    const end = t.endDay || t.startDay
    return {
      left: `${((t.startDay - 1) / span) * 100}%`,
      width: `${Math.max(3, ((end - t.startDay + 1) / span) * 100)}%`,
    }
  }

  const phases = [...new Set(tasks.map((t) => t.phase))]

  function addTask(phase: string) {
    const last = tasks.reduce((m, t) => Math.max(m, t.endDay), 0)
    onTasksChange([
      ...tasks,
      { id: crypto.randomUUID(), name: '', phase, startDay: last + 1, endDay: last + 2 },
    ])
  }

  function updateTask(id: string, field: string, value: string | number) {
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  function removeTask(id: string) {
    onTasksChange(tasks.filter((t) => t.id !== id))
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ overflowX: 'auto', border: '1px solid #d9d9d9', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1a2a3a', color: '#fff' }}>
              <th rowSpan={3} style={{ padding: '8px 12px', textAlign: 'left', width: 200, position: 'sticky', left: 0, background: '#1a2a3a', zIndex: 2 }}>
                TAREA
              </th>
              {headers.top.map((h, i) => (
                <th key={i} colSpan={h.colspan} style={{ padding: '8px 4px', textAlign: 'center' }}>
                  {h.label}
                </th>
              ))}
            </tr>
            {headers.mid.length > 0 && (
              <tr style={{ background: '#2c3e50', color: '#fff' }}>
                {headers.mid.map((h, i) => (
                  <th key={i} colSpan={h.colspan} style={{ padding: '4px 4px', textAlign: 'center', fontSize: 10 }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            )}
            {headers.bot.length > 0 && (
              <tr style={{ background: '#34495e', color: '#bbb' }}>
                {headers.bot.map((h, i) => (
                  <th key={i} colSpan={h.colspan || 1} style={{ padding: '2px 2px', textAlign: 'center', fontSize: 9 }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {phases.map((phase) => (
              <React.Fragment key={phase}>
                <tr style={{ background: '#f0f0f0' }}>
                  <td colSpan={100} style={{ padding: '8px 12px', fontWeight: 700, color: '#1a2a3a', fontSize: 12 }}>
                    {phase}
                  </td>
                </tr>
                {tasks.filter((t) => t.phase === phase).map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '4px 8px', position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>
                      <input
                        type="text"
                        value={t.name}
                        onChange={(e) => updateTask(t.id, 'name', e.target.value)}
                        placeholder="Tarea…"
                        disabled={readOnly}
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, padding: '4px 0', background: 'transparent' }}
                      />
                    </td>
                    <td colSpan={headers.totalUnits} style={{ padding: '4px 0', position: 'relative', height: 28 }}>
                      <div style={{ position: 'relative', height: 22, width: '100%' }}>
                        {Array.from({ length: headers.totalUnits }, (_, d) => (
                          <div
                            key={d}
                            style={{
                              position: 'absolute', top: 0, bottom: 0,
                              borderLeft: '1px solid #eee',
                              left: `${(d / headers.totalUnits) * 100}%`,
                              width: `${100 / headers.totalUnits}%`,
                            }}
                          />
                        ))}
                        {t.startDay && t.endDay && (
                          <div
                            style={{
                              position: 'absolute', top: 3, height: 16, borderRadius: 3,
                              display: 'flex', alignItems: 'center', padding: '0 6px',
                              fontSize: 10, color: '#fff', fontWeight: 600,
                              overflow: 'hidden', whiteSpace: 'nowrap',
                              ...barStyle(t),
                              background: phase.includes('CAPTURA') ? '#3498db' : '#2ecc71',
                            }}
                          >
                            {t.name}
                          </div>
                        )}
                      </div>
                      {!readOnly && (
                        <button
                          onClick={() => removeTask(t.id)}
                          style={{
                            position: 'absolute', right: 4, top: 2,
                            border: 'none', background: 'none', color: '#ff4d4f',
                            cursor: 'pointer', fontSize: 14, lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!readOnly && (
                  <tr>
                    <td colSpan={100} style={{ padding: '4px 8px' }}>
                      <button
                        onClick={() => addTask(phase)}
                        style={{
                          border: '1px dashed #d9d9d9', background: 'none',
                          padding: '2px 12px', fontSize: 11, color: '#999',
                          cursor: 'pointer', borderRadius: 4,
                        }}
                      >
                        + Agregar tarea
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
