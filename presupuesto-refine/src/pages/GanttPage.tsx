import { useState } from 'react'
import { Card, Select, InputNumber, Button, Space, Typography } from 'antd'
import { GanttChart, type GanttTask } from '../components/GanttChart'

const { Title } = Typography

const PHASES = ['CAPTURA DE DATOS', 'ANÁLISIS DE DATOS']

const defaultTasks: GanttTask[] = [
  { id: crypto.randomUUID(), name: 'Levantamiento en terreno', phase: 'CAPTURA DE DATOS', startDay: 1, endDay: 5 },
  { id: crypto.randomUUID(), name: 'Toma de muestras', phase: 'CAPTURA DE DATOS', startDay: 3, endDay: 7 },
  { id: crypto.randomUUID(), name: 'Análisis de laboratorio', phase: 'ANÁLISIS DE DATOS', startDay: 8, endDay: 14 },
  { id: crypto.randomUUID(), name: 'Informe de resultados', phase: 'ANÁLISIS DE DATOS', startDay: 12, endDay: 16 },
]

export function GanttPage() {
  const [tasks, setTasks] = useState<GanttTask[]>(defaultTasks)
  const [span, setSpan] = useState(14)
  const [unit, setUnit] = useState<'hour' | 'day' | 'week' | 'month' | 'year'>('day')

  return (
    <div style={{ padding: 16 }}>
      <Title level={4} style={{ marginBottom: 16 }}>CARTA GANTT</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>Unidad:</span>
          <Select
            value={unit}
            onChange={(v) => setUnit(v)}
            style={{ width: 120 }}
            options={[
              { value: 'hour', label: 'Horas' },
              { value: 'day', label: 'Días' },
              { value: 'week', label: 'Semanas' },
              { value: 'month', label: 'Meses' },
              { value: 'year', label: 'Años' },
            ]}
          />
          <span>Duración:</span>
          <InputNumber value={span} min={1} max={365} onChange={(v) => setSpan(v || 14)} />
          <Button onClick={() => {
            setTasks(tasks.map(t => ({ ...t, startDay: t.startDay + 1, endDay: t.endDay + 1 })))
          }}>
            Desplazar +
          </Button>
        </Space>
      </Card>
      <GanttChart tasks={tasks} span={span} unit={unit} onTasksChange={setTasks} />
    </div>
  )
}
