import { Card, Select, InputNumber, Typography } from 'antd'
import { useState } from 'react'

const { Title } = Typography

interface CosteoItem {
  _key: number
  name: string
  cost: number
  markup: number
}

interface CosteoCategory {
  id: string
  label: string
  items: CosteoItem[]
}

interface CosteoGroup {
  id: string
  name: string
  itemKeys: number[]
}

const defaultCategories: CosteoCategory[] = [
  { id: 'personal', label: 'PERSONAL', items: [
    { _key: 1, name: 'Ingeniero Senior', cost: 500000, markup: 30 },
    { _key: 2, name: 'Ingeniero Junior', cost: 300000, markup: 30 },
    { _key: 3, name: 'Técnico', cost: 150000, markup: 25 },
  ]},
  { id: 'equipos', label: 'EQUIPOS', items: [
    { _key: 4, name: 'GPS Diferencial', cost: 200000, markup: 15 },
    { _key: 5, name: 'Drone', cost: 350000, markup: 20 },
  ]},
  { id: 'materiales', label: 'MATERIALES', items: [] },
  { id: 'subcontrato', label: 'SUBCONTRATO', items: [] },
  { id: 'gastos', label: 'GASTOS GENERALES', items: [] },
  { id: 'movilizacion', label: 'MOVILIZACIÓN', items: [] },
  { id: 'imprevistos', label: 'IMPREVISTOS', items: [] },
]

let nextKey = 100
function genKey() { return nextKey++ }

function fmt(n: number): string {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function CosteoPage() {
  const [categories, setCategories] = useState<CosteoCategory[]>(defaultCategories)
  const [groups, setGroups] = useState<CosteoGroup[]>([
    { id: 'g1', name: 'Grupo 1', itemKeys: [] },
    { id: 'g2', name: 'Grupo 2', itemKeys: [] },
  ])
  const [markup, setMarkup] = useState(20)
  const [marginMode, setMarginMode] = useState<'venta' | 'utilidad'>('venta')

  function salePrice(cost: number, m: number): number {
    if (marginMode === 'venta') return cost * (1 + m / 100)
    return cost / (1 - m / 100)
  }

  function catTotal(cat: CosteoCategory): number {
    return cat.items.reduce((s, i) => s + i.cost, 0)
  }

  function catSaleTotal(cat: CosteoCategory): number {
    return cat.items.reduce((s, i) => s + salePrice(i.cost, i.markup), 0)
  }

  function groupTotal(g: CosteoGroup): { cost: number; sale: number } {
    let cost = 0, sale = 0
    for (const cat of categories) {
      for (const item of cat.items) {
        if (g.itemKeys.includes(item._key)) {
          cost += item.cost
          sale += salePrice(item.cost, item.markup)
        }
      }
    }
    return { cost, sale }
  }

  function allGroupsTotal() {
    let cost = 0, sale = 0
    for (const g of groups) {
      const t = groupTotal(g)
      cost += t.cost; sale += t.sale
    }
    return { cost, sale }
  }

  function findItemByKey(key: number) {
    for (const cat of categories) {
      const found = cat.items.find(i => i._key === key)
      if (found) return found
    }
    return null
  }

  function addCosteoItem(catId: string) {
    setCategories(categories.map(c => {
      if (c.id !== catId) return c
      return { ...c, items: [...c.items, { _key: genKey(), name: '', cost: 0, markup }] }
    }))
  }

  function updateItem(key: number, field: string, value: string | number) {
    setCategories(categories.map(c => ({
      ...c,
      items: c.items.map(i => i._key === key ? { ...i, [field]: value } : i)
    })))
  }

  function removeItem(key: number) {
    setCategories(categories.map(c => ({ ...c, items: c.items.filter(i => i._key !== key) })))
    setGroups(groups.map(g => ({ ...g, itemKeys: g.itemKeys.filter(k => k !== key) })))
  }

  // drag handlers
  function handleDragStart(e: React.DragEvent, itemKey: number) {
    e.dataTransfer.setData('text/plain', String(itemKey))
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  function handleCategoryDragStart(e: React.DragEvent, catId: string) {
    const cat = categories.find(c => c.id === catId)
    if (!cat) return
    e.dataTransfer.setData('application/json', JSON.stringify(cat.items.map(i => i._key)))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function handleGroupDrop(e: React.DragEvent, groupId: string) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('text/plain')
    const json = e.dataTransfer.getData('application/json')
    if (json) {
      const keys: number[] = JSON.parse(json)
      setGroups(groups.map(g => {
        if (g.id !== groupId) return g
        return { ...g, itemKeys: [...g.itemKeys, ...keys.filter(k => !g.itemKeys.includes(k))] }
      }))
      // copy → remove from source not needed
      return
    }
    if (raw) {
      const key = parseInt(raw)
      const sourceGroup = groups.find(g => g.itemKeys.includes(key))
      setGroups(groups.map(g => {
        if (g.id === groupId && !g.itemKeys.includes(key)) return { ...g, itemKeys: [...g.itemKeys, key] }
        if (g.id === sourceGroup?.id) return { ...g, itemKeys: g.itemKeys.filter(k => k !== key) }
        return g
      }))
    }
  }

  function removeFromGroup(groupId: string, key: number) {
    setGroups(groups.map(g => g.id === groupId ? { ...g, itemKeys: g.itemKeys.filter(k => k !== key) } : g))
  }

  function addGroup() {
    setGroups([...groups, { id: crypto.randomUUID(), name: `Grupo ${groups.length + 1}`, itemKeys: [] }])
  }

  function removeGroup(id: string) {
    setGroups(groups.filter(g => g.id !== id))
  }

  function updateGroupName(id: string, name: string) {
    setGroups(groups.map(g => g.id === id ? { ...g, name } : g))
  }

  const total = allGroupsTotal()

  function recalcSales() {
    setCategories(categories.map(c => ({ ...c, items: c.items.map(i => ({ ...i, markup })) })))
  }

  return (
    <div style={{ padding: 16 }}>
      <Title level={4} style={{ marginBottom: 16 }}>COSTEO INTERNO</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Controls */}
        <Card size="small">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Margen global:</span>
            <InputNumber value={markup} min={0} max={500} onChange={(v) => setMarkup(v || 0)} style={{ width: 80 }} />
            <span>%</span>
            <Select
              value={marginMode}
              onChange={(v) => { setMarginMode(v); recalcSales() }}
              style={{ width: 130 }}
              options={[
                { value: 'venta', label: 'Margen Venta' },
                { value: 'utilidad', label: 'Margen Utilidad' },
              ]}
            />
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Left: Categories */}
          <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {categories.map((cat) => (
              <Card key={cat.id} size="small" title={cat.label}
                extra={<span style={{ fontSize: 12 }}>Costo: {fmt(catTotal(cat))} | Venta: {fmt(catSaleTotal(cat))}</span>}
                draggable
                onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
              >
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#999', borderBottom: '1px solid #eee' }}>
                      <th style={{ textAlign: 'left', padding: '2px 4px' }}>Item</th>
                      <th style={{ textAlign: 'right', padding: '2px 4px', width: 100 }}>Costo</th>
                      <th style={{ textAlign: 'right', padding: '2px 4px', width: 60 }}>%</th>
                      <th style={{ textAlign: 'right', padding: '2px 4px', width: 100 }}>Venta</th>
                      <th style={{ width: 20 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((item) => (
                      <tr key={item._key} draggable onDragStart={(e) => handleDragStart(e, item._key)}
                        style={{ borderBottom: '1px solid #f5f5f5', cursor: 'grab' }}>
                        <td style={{ padding: '2px 4px' }}>
                          <input type="text" value={item.name}
                            onChange={(e) => updateItem(item._key, 'name', e.target.value)}
                            placeholder="Nombre…"
                            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 12, background: 'transparent' }} />
                        </td>
                        <td style={{ padding: '2px 4px' }}>
                          <input type="number" value={item.cost}
                            onChange={(e) => updateItem(item._key, 'cost', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', border: '1px solid #eee', borderRadius: 4, padding: '2px 4px', fontSize: 12, textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: '2px 4px', textAlign: 'right', color: '#666' }}>
                          <input type="number" value={item.markup}
                            onChange={(e) => updateItem(item._key, 'markup', parseFloat(e.target.value) || 0)}
                            style={{ width: '100%', border: '1px solid #eee', borderRadius: 4, padding: '2px 4px', fontSize: 12, textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: '2px 4px', textAlign: 'right', fontWeight: 600, color: '#1a2a3a', fontSize: 12 }}>
                          {fmt(salePrice(item.cost, item.markup))}
                        </td>
                        <td>
                          <button onClick={() => removeItem(item._key)}
                            style={{ border: 'none', background: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: 14, padding: 0 }}>
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => addCosteoItem(cat.id)}
                  style={{ marginTop: 4, border: '1px dashed #d9d9d9', background: 'none', padding: '2px 12px', fontSize: 11, color: '#999', cursor: 'pointer', borderRadius: 4 }}>
                  + Agregar item
                </button>
              </Card>
            ))}
          </div>

          {/* Right: Groups */}
          <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => (
              <Card key={g.id} size="small"
                title={
                  <input type="text" value={g.name}
                    onChange={(e) => updateGroupName(g.id, e.target.value)}
                    style={{ border: 'none', outline: 'none', fontWeight: 700, fontSize: 13, background: 'transparent', width: '100%' }} />
                }
                extra={
                  <span style={{ fontSize: 11 }}>
                    {(groupTotal(g).cost > 0 || groupTotal(g).sale > 0) ? `${fmt(groupTotal(g).cost)} / ${fmt(groupTotal(g).sale)}` : '—'}
                  </span>
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleGroupDrop(e, g.id)}
                style={{ background: '#fafafa', borderStyle: g.itemKeys.length === 0 ? 'dashed' : 'solid' }}
              >
                {g.itemKeys.length === 0 ? (
                  <div style={{ color: '#bbb', fontSize: 11, textAlign: 'center', padding: 8 }}>
                    Arrastra items aquí
                  </div>
                ) : (
                  g.itemKeys.map((key) => {
                    const item = findItemByKey(key)
                    if (!item) return null
                    return (
                      <div key={key}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 12 }}>
                        <span>{item.name || '(sin nombre)'}</span>
                        <span style={{ color: '#888' }}>
                          {fmt(salePrice(item.cost, item.markup))}
                          <button onClick={() => removeFromGroup(g.id, key)}
                            style={{ border: 'none', background: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: 12, marginLeft: 6 }}>
                            ×
                          </button>
                        </span>
                      </div>
                    )
                  })
                )}
              </Card>
            ))}
            <button onClick={addGroup}
              style={{ border: '1px dashed #d9d9d9', background: 'none', padding: '6px 12px', fontSize: 11, color: '#999', cursor: 'pointer', borderRadius: 4 }}>
              + Agregar grupo
            </button>

            {/* Totals */}
            <Card size="small" title="TOTALES" style={{ background: '#f0f5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Costo total: <strong>{fmt(total.cost)}</strong></span>
                <span>Venta total: <strong>{fmt(total.sale)}</strong></span>
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                Utilidad: <strong>{fmt(total.sale - total.cost)}</strong> ({total.cost > 0 ? ((total.sale - total.cost) / total.cost * 100).toFixed(1) : 0}%)
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
