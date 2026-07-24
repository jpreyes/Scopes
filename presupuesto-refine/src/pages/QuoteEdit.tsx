import { Edit, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, InputNumber, Select, DatePicker, Space } from 'antd'

export function QuoteEdit() {
  const { formProps, saveButtonProps, queryResult } = useForm({ resource: 'quotes' })

  const { selectProps: clientSelectProps } = useSelect({
    resource: 'clients',
    optionLabel: 'name',
    optionValue: 'id',
  })

  return (
    <Edit title="Editar Cotización" saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="N° Cotización" name="quote_number" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Cliente" name="client_id">
          <Select {...clientSelectProps} placeholder="Seleccionar cliente" allowClear />
        </Form.Item>
        <Space style={{ width: '100%' }} size={16}>
          <Form.Item label="Fecha" name="date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Válido hasta" name="valid_until">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Revisión" name="rev">
            <Input style={{ width: 80 }} />
          </Form.Item>
        </Space>
        <Space style={{ width: '100%' }} size={16}>
          <Form.Item label="Moneda" name="currency">
            <Select style={{ width: 100 }} options={[
              { value: '$', label: 'CLP $' },
              { value: 'US$', label: 'US$' },
              { value: '€', label: 'EUR €' },
              { value: 'UF', label: 'UF' },
            ]} />
          </Form.Item>
          <Form.Item label="IVA/Impuesto %" name="tax_rate">
            <InputNumber min={0} max={100} />
          </Form.Item>
        </Space>
        <Form.Item label="Contacto" name="contact_person">
          <Input />
        </Form.Item>
      </Form>
    </Edit>
  )
}
