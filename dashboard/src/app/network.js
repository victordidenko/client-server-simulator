import {
  concurrency,
  connectQuery,
  createJsonMutation,
  createJsonQuery,
  update,
} from '@farfetched/core'
import { anything, arr, num, obj, or, val } from '@withease/contracts'
import { createEvent, createStore, sample } from 'effector'
import { log } from './common'
import { statusQuery } from './simulation'

const pointSchema = obj({
  x: num,
  y: num,
  type: or(val('curve'), val('break')),
})

const networkSchema = obj({
  to: num,
  latfrom: num,
  latto: num,
  drops: arr(pointSchema),
  latmin: arr(pointSchema),
  latmax: arr(pointSchema),
})

export const init = createEvent()

export const networkQuery = createJsonQuery({
  request: {
    method: 'GET',
    url: '/api/network',
  },
  response: {
    contract: networkSchema,
  },
})

concurrency(networkQuery, { strategy: 'TAKE_FIRST' })

connectQuery({
  source: statusQuery,
  filter: ({ result }) =>
    result.status !== 'NONE' && result.status !== 'UNKNOWN',
  target: networkQuery,
})

export const updateNetworkMutation = createJsonMutation({
  request: {
    method: 'PUT',
    url: '/api/network',
    body: (config) => config,
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

update(networkQuery, {
  on: updateNetworkMutation,
  by: {
    success: ({ mutation }) => ({
      result: mutation.params,
      refetch: true,
    }),
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

// errors

export const $updateNetworkMutationError = createStore('').on(
  updateNetworkMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

sample({
  clock: [
    updateNetworkMutation.started,
    updateNetworkMutation.finished.success,
  ],
  target: [$updateNetworkMutationError.reinit],
})

sample({
  clock: networkQuery.finished.failure,
  fn: ({ error }) => ['Error getting network behavior:', error],
  target: log.errorFx,
})

sample({
  clock: updateNetworkMutation.finished.failure,
  fn: ({ error }) => ['Error updating network behavior:', error],
  target: log.errorFx,
})
