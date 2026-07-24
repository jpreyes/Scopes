import { useList } from '@refinedev/core'
import { Card, Row, Col, Statistic, Table, Typography, Spin } from 'antd'
import {
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  RiseOutlined,
} from '@ant-design/icons'

const { Title } = Typography

function fmtAmount(n: number, currency = '$'): string {
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${currency}${s}`
}

export function Dashboard() {
  const { data: clientsData, isLoading: clientsLoading } = useList({
    resource: 'clients',
    pagination: { pageSize: 100 },
  })

  const { data: quotesData, isLoading: quotesLoading } = useList({
    resource: 'quotes',
    pagination: { pageSize: 200 },
    sorters: [{ field: 'created', order: 'desc' }],
  })

  if (clientsLoading || quotesLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  const clients = clientsData?.data || []
  const quotes = quotesData?.data || []

  // Stats
  const totalClients = clients.length
  const totalQuotes = quotes.length

  let totalAmount = 0
  const lastQuotes = quotes.slice(0, 10).map((q: any) => {
    const items: Array<{ qty?: number; price?: number }> = q.items || []
    const subtotal = items.reduce((s: number, i) => s + (i.qty || 0) * (i.price || 0), 0)
    const tax = subtotal * ((q.tax_rate || 0) / 100)
    const total = subtotal + tax
    totalAmount += total
    return {
      id: q.id,
      quote_number: q.quote_number,
      client: q.client_id,
      date: q.date,
      total,
      currency: q.currency || '$',
    }
  })

  // Clients with most quotes
  const clientQuoteCount: Record<string, { name: string; count: number }> = {}
  for (const q of quotes) {
    const cid = q.client_id
    if (!cid) continue
    if (!clientQuoteCount[cid]) {
      const client = clients.find((c: any) => c.id === cid)
      clientQuoteCount[cid] = {
        name: client?.name || cid,
        count: 0,
      }
    }
    clientQuoteCount[cid].count++
  }
  const topClients = Object.entries(clientQuoteCount)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([id, data]) => ({ id, ...data }))

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        Dashboard
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Clientes"
              value={totalClients}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Cotizaciones"
              value={totalQuotes}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Monto Total Cotizado"
              value={fmtAmount(totalAmount)}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Promedio por Cotización"
              value={totalQuotes > 0 ? fmtAmount(totalAmount / totalQuotes) : '$0'}
              prefix={<RiseOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Últimas Cotizaciones" size="small">
            <Table
              dataSource={lastQuotes}
              rowKey="id"
              pagination={false}
              size="small"
            >
              <Table.Column dataIndex="quote_number" title="N°" width={140} />
              <Table.Column
                dataIndex="client"
                title="Cliente"
                render={(v: string) => {
                  const c = clients.find((cl: any) => cl.id === v)
                  return c?.name || v || '—'
                }}
              />
              <Table.Column
                dataIndex="date"
                title="Fecha"
                width={100}
                render={(v: string) =>
                  v ? new Date(v).toLocaleDateString('es-CL') : '—'
                }
              />
              <Table.Column
                dataIndex="total"
                title="Total"
                width={120}
                align="right"
                render={(v: number, r: any) => fmtAmount(v, r.currency)}
              />
            </Table>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Clientes con Más Cotizaciones" size="small">
            <Table
              dataSource={topClients}
              rowKey="id"
              pagination={false}
              size="small"
            >
              <Table.Column
                dataIndex="name"
                title="Cliente"
                render={(v: string) => v || '—'}
              />
              <Table.Column
                dataIndex="count"
                title="Cotizaciones"
                width={120}
                align="center"
              />
            </Table>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
