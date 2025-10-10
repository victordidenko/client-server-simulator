import {
  concurrency,
  connectQuery,
  createJsonMutation,
  createJsonQuery,
  update,
} from '@farfetched/core'
import { anything, arr, num, obj, str } from '@withease/contracts'
import { createEvent, createStore, sample } from 'effector'
import { getSeriesColor } from '../utils/colors'
import { log } from './common'
import { statusQuery } from './simulation'

const clientSchema = obj({
  id: str,
  count: num,
  requestRate: num,
  rampUpTime: num,
  startupDelay: num,
  behavior: str,
})

const clientsSchema = arr(clientSchema)

export const init = createEvent()

export const clientsQuery = createJsonQuery({
  request: {
    method: 'GET',
    url: '/api/clients',
  },
  response: {
    contract: clientsSchema,
    mapData: ({ result }) =>
      result.map((group, i) => {
        group.color = getSeriesColor(i)
        return group
      }),
  },
})

concurrency(clientsQuery, { strategy: 'TAKE_FIRST' })

connectQuery({
  source: statusQuery,
  filter: ({ result }) =>
    result.status !== 'NONE' && result.status !== 'UNKNOWN',
  target: clientsQuery,
})

export const createClientsMutation = createJsonMutation({
  request: {
    method: 'POST',
    url: '/api/clients',
    body: (config) => config,
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

export const getClientsMutation = createJsonMutation({
  request: {
    method: 'GET',
    url: (id) => `/api/clients/${id}`,
  },
  response: {
    contract: clientSchema,
  },
})

export const updateClientsMutation = createJsonMutation({
  request: {
    method: 'PUT',
    url: ({ id }) => `/api/clients/${id}`,
    body: (config) => config,
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

export const removeClientsMutation = createJsonMutation({
  request: {
    method: 'DELETE',
    url: (id) => `/api/clients/${id}`,
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

export const cleanClientsMutation = createJsonMutation({
  request: {
    method: 'DELETE',
    url: '/api/clients',
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

update(clientsQuery, {
  on: createClientsMutation,
  by: {
    success: ({ mutation, query }) => ({
      result: [...query.result, mutation.params],
      refetch: true,
    }),
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

update(clientsQuery, {
  on: getClientsMutation,
  by: {
    success: ({ mutation, query }) => {
      const idx = query.result.findIndex((g) => g.id === mutation.params.id)
      const result =
        idx === -1
          ? query.result.concat(mutation.body)
          : query.result.toSpliced(idx, 1, mutation.body)
      return {
        result,
        refetch: true,
      }
    },
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

update(clientsQuery, {
  on: updateClientsMutation,
  by: {
    success: ({ mutation, query }) => {
      const idx = query.result.findIndex((g) => g.id === mutation.params.id)
      const result = query.result.toSpliced(idx, 1, mutation.params)
      return {
        result,
        refetch: true,
      }
    },
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

update(clientsQuery, {
  on: removeClientsMutation,
  by: {
    success: ({ mutation, query }) => ({
      result: query.result.filter((g) => g.id !== mutation.params.id),
      refetch: true,
    }),
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

update(clientsQuery, {
  on: cleanClientsMutation,
  by: {
    success: () => ({
      result: [],
      refetch: true,
    }),
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

// errors

export const $createClientsMutationError = createStore('').on(
  createClientsMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

export const $getClientsMutationError = createStore('').on(
  getClientsMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

export const $updateClientsMutationError = createStore('').on(
  updateClientsMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

export const $removeClientsMutationError = createStore('').on(
  removeClientsMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

export const $cleanClientsMutationError = createStore('').on(
  cleanClientsMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

sample({
  clock: [
    createClientsMutation.started,
    removeClientsMutation.started,
    cleanClientsMutation.started,
    createClientsMutation.finished.success,
    removeClientsMutation.finished.success,
    cleanClientsMutation.finished.success,
  ],
  target: [
    $createClientsMutationError.reinit,
    $getClientsMutationError.reinit,
    $updateClientsMutationError.reinit,
    $removeClientsMutationError.reinit,
    $cleanClientsMutationError.reinit,
  ],
})

sample({
  clock: clientsQuery.finished.failure,
  fn: ({ error }) => ['Error getting clients:', error],
  target: log.errorFx,
})

sample({
  clock: createClientsMutation.finished.failure,
  fn: ({ error }) => ['Error creating clients:', error],
  target: log.errorFx,
})

sample({
  clock: getClientsMutation.finished.failure,
  fn: ({ error }) => ['Error getting clients:', error],
  target: log.errorFx,
})

sample({
  clock: updateClientsMutation.finished.failure,
  fn: ({ error }) => ['Error updating clients:', error],
  target: log.errorFx,
})

sample({
  clock: removeClientsMutation.finished.failure,
  fn: ({ error }) => ['Error removing clients:', error],
  target: log.errorFx,
})

sample({
  clock: cleanClientsMutation.finished.failure,
  fn: ({ error }) => ['Error cleaning clients:', error],
  target: log.errorFx,
})
