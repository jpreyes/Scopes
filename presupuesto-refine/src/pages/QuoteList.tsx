import { List, useTable, EditButton, DeleteButton, ShowButton, DateField } from '@refinedev/antd'
import { Table, Space, Tag } from 'antd'

export function QuoteList() {
  const { tableProps } = useTable({
    resource: 'quotes',
    sorters: { initial: [{ field: 'created', order: 'desc' }] },
  })

  return (
    <List title="Cotizaciones">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="quote_number" title="N° Cotización" sorter />
        <Table.Column dataIndex="client_id" title="Cliente" render={(v: any, record: any) => record.expand?.client_id?.name || v?.name || v || '—'} />
        <Table.Column dataIndex="date" title="Fecha" render={(v) => <DateField value={v} format="DD/MM/YYYY" />} />
        <Table.Column dataIndex="currency" title="Moneda" render={(v) => <Tag>{v || '$'}</Tag>} />
        <Table.Column dataIndex="total" title="Total" render={(v) => v ? `$${Number(v).toLocaleString('es-CL')}` : '—'} />
        <Table.Column
          title="Acciones"
          dataIndex="actions"
          render={(_, record) => (
            <Space>
              <ShowButton hideText size="small" recordItemId={record.id} />
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  )
}
