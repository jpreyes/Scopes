import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'

export function ClientCreate() {
  const { formProps, saveButtonProps } = useForm({ resource: 'clients' })

  return (
    <Create title="Nuevo Cliente" saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Nombre" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Email" name="email">
          <Input type="email" />
        </Form.Item>
        <Form.Item label="Teléfono" name="phone">
          <Input />
        </Form.Item>
        <Form.Item label="Dirección" name="address">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="Persona de Contacto" name="contact_person">
          <Input />
        </Form.Item>
        <Form.Item label="Notas" name="notes">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Create>
  )
}
