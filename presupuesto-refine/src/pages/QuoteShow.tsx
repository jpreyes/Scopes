import { Show } from '@refinedev/antd'
import { useShow } from '@refinedev/core'
import { Typography, Descriptions, Table, Tag, Space } from 'antd'

const { Title } = Typography

function fmtAmount(n: number, currency = '$'): string {
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${currency}${s}`
}

export function QuoteShow() {
  const { queryResult } = useShow({
    resource: 'quotes',
    meta: { expand: 'client_id' },
  })
  const { data, isLoading } = queryResult
  const record = data?.data

  const items: Array<{ desc?: string; qty?: number; price?: number }> =
    record?.items || []

  const subtotal = items.reduce((s, i) => s + (i.qty || 0) * (i.price || 0), 0)
  const taxRate = record?.tax_rate || 0
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax

  return (
    <Show title="Detalle de Cotización" isLoading={isLoading}>
      <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
        <Descriptions.Item label="N° Cotización" span={2}>
          <strong>{record?.quote_number}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Cliente">
          {record?.expand?.client_id?.name || record?.client_id || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Contacto">
          {record?.contact_person || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Fecha">
          {record?.date ? new Date(record.date).toLocaleDateString('es-CL') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Válido hasta">
          {record?.valid_until
            ? new Date(record.valid_until).toLocaleDateString('es-CL')
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Revisión">{record?.rev || '01'}</Descriptions.Item>
        <Descriptions.Item label="Moneda">
          <Tag>{record?.currency || '$'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="IVA / Impuesto">{taxRate}%</Descriptions.Item>
      </Descriptions>

      <Title level={5}>Ítems</Title>
      <Table
        dataSource={items}
        rowKey={(_, i) => String(i)}
        pagination={false}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Table.Column
          dataIndex="desc"
          title="Descripción"
          render={(v: string) => v || '(sin descripción)'}
        />
        <Table.Column
          dataIndex="qty"
          title="Cant."
          width={80}
          align="right"
          render={(v: number) => v ?? 0}
        />
        <Table.Column
          dataIndex="price"
          title="P. Unitario"
          width={140}
          align="right"
          render={(v: number) => fmtAmount(v || 0, record?.currency)}
        />
        <Table.Column
          title="Total"
          width={140}
          align="right"
          render={(_, r: { qty?: number; price?: number }) =>
            fmtAmount((r.qty || 0) * (r.price || 0), record?.currency)
          }
        />
      </Table>

      <div
        style={{
          width: 320,
          marginLeft: 'auto',
          borderTop: '2px solid #1a2a3a',
          paddingTop: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>Subtotal</span>
          <span>{fmtAmount(subtotal, record?.currency)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
          <span>IVA ({taxRate}%)</span>
          <span>{fmtAmount(tax, record?.currency)}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '4px 0',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          <span>Total</span>
          <span>{fmtAmount(total, record?.currency)}</span>
        </div>
      </div>
    </Show>
  )
}
