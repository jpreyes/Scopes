import { useState, useMemo } from 'react'
import { useList, useUpdate, useCreate, useDelete } from '@refinedev/core'
import { Card, Button, Modal, Form, Input, InputNumber, Select, Typography, Spin, Tag, Space, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const { Title, Text } = Typography

const STAGES = [
  { key: 'lead', label: 'Nuevo', color: '#bfbfbf' },
  { key: 'contacted', label: 'Contactado', color: '#91d5ff' },
  { key: 'proposal', label: 'Cotizado', color: '#69c0ff' },
  { key: 'negotiation', label: 'Negociación', color: '#ffec3d' },
  { key: 'won', label: 'Ganado', color: '#95de64' },
  { key: 'lost', label: 'Perdido', color: '#ff9c6e' },
]

const stageMap = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<string, (typeof STAGES)[number]>

function fmtAmount(n: number, currency = '$'): string {
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${currency}${s}`
}

function DealCard({ deal, onEdit, onDelete }: { deal: any; onEdit: (d: any) => void; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        size="small"
        style={{ marginBottom: 8, background: '#fff' }}
        actions={[
          <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); onEdit(deal) }} />,
          <Popconfirm key="delete" title="¿Eliminar?" onConfirm={() => onDelete(deal.id)}>
            <DeleteOutlined onClick={(e) => e.stopPropagation()} />
          </Popconfirm>,
        ]}
      >
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{deal.title}</div>
        <div style={{ fontSize: 11, color: '#888' }}>
          {deal.expand?.client_id?.name && <div>{deal.expand.client_id.name}</div>}
          <div style={{ fontWeight: 700, color: '#1a2a3a', marginTop: 2 }}>
            {deal.value ? fmtAmount(deal.value, deal.currency) : '—'}
          </div>
        </div>
      </Card>
    </div>
  )
}

export function DealsKanban() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<any>(null)
  const [form] = Form.useForm()

  const { data, isLoading, refetch } = useList({
    resource: 'deals',
    pagination: { pageSize: 200 },
    sorters: [{ field: 'sort_order', order: 'asc' }],
    meta: { expand: 'client_id' },
  })

  const { mutate: updateDeal } = useUpdate()
  const { mutate: createDeal } = useCreate()
  const { mutate: deleteDeal } = useDelete()

  const { data: clientsData } = useList({ resource: 'clients', pagination: { pageSize: 100 } })
  const clients = clientsData?.data || []

  const deals = data?.data || []

  const columns = useMemo(() => {
    return STAGES.map((stage) => ({
      ...stage,
      deals: deals.filter((d: any) => d.stage === stage.key),
    }))
  }, [deals])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const activeDeal = activeId ? deals.find((d: any) => d.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const dealId = active.id as string
    const deal = deals.find((d: any) => d.id === dealId)
    if (!deal) return

    // Determine target stage: if dropped over a column header, use that stage
    let targetStage: string | null = null
    const overId = over.id as string

    if (overId.startsWith('column-')) {
      targetStage = overId.replace('column-', '')
    } else {
      // Dropped over another card — find its stage
      const overDeal = deals.find((d: any) => d.id === overId)
      if (overDeal) targetStage = overDeal.stage
    }

    if (targetStage && targetStage !== deal.stage) {
      updateDeal(
        { resource: 'deals', id: dealId, values: { stage: targetStage } },
        { onSuccess: () => refetch() }
      )
    }
  }

  function handleAdd(stage: string) {
    setEditingDeal(null)
    form.resetFields()
    form.setFieldsValue({ stage, currency: '$' })
    setModalOpen(true)
  }

  function handleEdit(deal: any) {
    setEditingDeal(deal)
    form.setFieldsValue(deal)
    setModalOpen(true)
  }

  function handleDelete(id: string) {
    deleteDeal({ resource: 'deals', id }, { onSuccess: () => refetch() })
  }

  function handleSave() {
    form.validateFields().then((values) => {
      if (editingDeal) {
        updateDeal(
          { resource: 'deals', id: editingDeal.id, values },
          { onSuccess: () => { setModalOpen(false); refetch() } }
        )
      } else {
        createDeal(
          { resource: 'deals', values: { ...values, sort_order: Date.now() } },
          { onSuccess: () => { setModalOpen(false); refetch() } }
        )
      }
    })
  }

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>Pipeline de Ventas (Kanban)</Title>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, minHeight: 'calc(100vh - 200px)' }}>
          {columns.map((col) => (
            <div key={col.key} style={{ flex: '0 0 260px', minWidth: 260, display: 'flex', flexDirection: 'column' }}>
              <div
                id={`column-${col.key}`}
                style={{
                  background: '#f5f5f5',
                  borderRadius: 8,
                  padding: 8,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Tag color={col.color} style={{ fontSize: 12, fontWeight: 600 }}>
                    {col.label} ({col.deals.length})
                  </Tag>
                  <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleAdd(col.key)} />
                </div>
                <SortableContext items={col.deals.map((d: any) => d.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ flex: 1, minHeight: 80 }}>
                    {col.deals.map((deal: any) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                    {col.deals.length === 0 && (
                      <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 16 }}>
                        Arrastra una oportunidad aquí
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? (
            <Card size="small" style={{ width: 240, opacity: 0.9, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{activeDeal.title}</div>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Modal
        title={editingDeal ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Título" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Cliente" name="client_id">
            <Select
              allowClear
              showSearch
              placeholder="Seleccionar cliente"
              filterOption={(input, option) =>
                (option?.children as any)?.toLowerCase?.()?.includes(input.toLowerCase())
              }
            >
              {clients.map((c: any) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Etapa" name="stage">
            <Select>
              {STAGES.map((s) => (
                <Select.Option key={s.key} value={s.key}>
                  {s.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Monto" name="value">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Moneda" name="currency">
            <Select>
              <Select.Option value="$">CLP $</Select.Option>
              <Select.Option value="US$">US$</Select.Option>
              <Select.Option value="€">EUR €</Select.Option>
              <Select.Option value="UF">UF</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Notas" name="notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
