import { Show } from '@refinedev/antd'
import { useShow } from '@refinedev/core'
import { Typography, Descriptions, Space, Tag } from 'antd'

const { Title, Text } = Typography

export function ClientShow() {
  const { queryResult } = useShow({ resource: 'clients' })
  const { data, isLoading } = queryResult
  const record = data?.data

  return (
    <Show title="Detalle del Cliente" isLoading={isLoading}>
      <Title level={5}>{record?.name}</Title>
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Email">{record?.email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Teléfono">{record?.phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Dirección" span={2}>{record?.address || '—'}</Descriptions.Item>
        <Descriptions.Item label="Persona de Contacto">{record?.contact_person || '—'}</Descriptions.Item>
        <Descriptions.Item label="Creado">{record?.created ? new Date(record.created).toLocaleDateString('es-CL') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Notas" span={2}>{record?.notes || '—'}</Descriptions.Item>
      </Descriptions>
    </Show>
  )
}
