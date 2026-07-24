import { List, useTable, EditButton, DeleteButton, ShowButton, DateField } from '@refinedev/antd'
import { Table, Space } from 'antd'

export function ClientList() {
  const { tableProps } = useTable({
    resource: 'clients',
    sorters: { initial: [{ field: 'created', order: 'desc' }] },
  })

  return (
    <List title="Clientes">
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Nombre" sorter />
        <Table.Column dataIndex="email" title="Email" />
        <Table.Column dataIndex="phone" title="Teléfono" />
        <Table.Column dataIndex="contact_person" title="Contacto" />
        <Table.Column dataIndex="created" title="Creado" render={(v) => <DateField value={v} format="DD/MM/YYYY" />} />
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
