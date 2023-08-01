import useSWR from 'swr'

import { SchemaInterface } from '../types/types'
import { ErrorInfo, fetcher } from '../utils/fetcher'

export function useGetSchemas() {
  const { data, error, mutate } = useSWR<
    {
      data: { schemas: SchemaInterface[] }
    },
    ErrorInfo
  >('/api/v2/schemas/', fetcher)

  return {
    mutateSchemas: mutate,
    schemas: data ? data.data.schemas : [],
    isSchemasLoading: !error && !data,
    isSchemasError: error,
  }
}

export function useGetSchema(id: string) {
  const { data, error, mutate } = useSWR<
    {
      data: { schema: SchemaInterface }
    },
    ErrorInfo
  >(id ? `/api/v2/schema/${id}` : null, fetcher)

  return {
    mutateSchema: mutate,
    schema: data ? data.data.schema : undefined,
    isSchemaLoading: !error && !data,
    isSchemaError: error,
  }
}
