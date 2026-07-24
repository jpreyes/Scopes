import type { DataProvider } from '@refinedev/core'
import { getPB } from './pocketbaseClient'

export const pocketbaseDataProvider: DataProvider = {
  getList: async ({ resource, pagination, sorters, filters, meta }) => {
    const pb = getPB()
    const page = pagination?.current || 1
    const perPage = pagination?.pageSize || 20

    let sort = '-created'
    if (sorters && sorters.length > 0) {
      sort = sorters.map(s => `${s.order === 'asc' ? '' : '-'}${s.field}`).join(',')
    }

    let filter = ''
    if (filters && filters.length > 0) {
      const parts = filters.map(f => {
        if (f.operator === 'contains') return `${f.field}~'${f.value}'`
        if (f.operator === 'eq') return `${f.field}='${f.value}'`
        if (f.operator === 'gte') return `${f.field}>='${f.value}'`
        if (f.operator === 'lte') return `${f.field}<='${f.value}'`
        return ''
      }).filter(Boolean)
      if (parts.length) filter = `(${parts.join(' && ')})`
    }

    const options: any = { sort, filter: filter || undefined }
    if (meta?.expand) options.expand = meta.expand

    const result = await pb.collection(resource).getList(page, perPage, options)

    return {
      data: result.items as any,
      total: result.totalItems,
    }
  },

  getMany: async ({ resource, ids, meta }) => {
    const pb = getPB()
    const options: any = {}
    if (meta?.expand) options.expand = meta.expand
    const items = await Promise.all(
      ids.map(id => pb.collection(resource).getOne(id as string, options))
    )
    return { data: items as any }
  },

  getOne: async ({ resource, id, meta }) => {
    const pb = getPB()
    const options: any = {}
    if (meta?.expand) options.expand = meta.expand
    const item = await pb.collection(resource).getOne(id as string, options)
    return { data: item as any }
  },

  create: async ({ resource, variables }) => {
    const pb = getPB()
    const item = await pb.collection(resource).create(variables as any)
    return { data: item as any }
  },

  update: async ({ resource, id, variables }) => {
    const pb = getPB()
    const item = await pb.collection(resource).update(id as string, variables as any)
    return { data: item as any }
  },

  deleteOne: async ({ resource, id }) => {
    const pb = getPB()
    await pb.collection(resource).delete(id as string)
    return { data: { id } } as any
  },

  getApiUrl: () => 'http://127.0.0.1:8090/api',
}
