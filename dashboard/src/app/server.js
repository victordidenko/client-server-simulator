import {
  concurrency,
  connectQuery,
  createJsonMutation,
  createJsonQuery,
  update,
} from '@farfetched/core'
import { anything, arr, bool, num, obj, or, val } from '@withease/contracts'
import { createEvent, createStore, sample } from 'effector'
import { log } from './common'
import { statusQuery } from './simulation'

const pointSchema = obj({
  x: num,
  y: num,
  type: or(val('curve'), val('break')),
})

const serverResourcesSchema = obj({
  maxConcurrentRequests: num,
  maxMemoryMB: num,
  maxQueueSize: num,
  memoryLeakRateMBPerSec: num,
  memoryPerRequestMB: num,
  gcPauseIntervalSec: num,
  gcPauseDurationMs: num,
})

const serverSchema = obj({
  to: num,
  rtfrom: num,
  rtto: num,
  rtmin: arr(pointSchema),
  rtmax: arr(pointSchema),
  errors: arr(pointSchema),
  enableResourceManagement: bool,
  resources: serverResourcesSchema,
})

export const init = createEvent()

export const serverQuery = createJsonQuery({
  request: {
    method: 'GET',
    url: '/api/server',
  },
  response: {
    contract: serverSchema,
  },
})

concurrency(serverQuery, { strategy: 'TAKE_FIRST' })

connectQuery({
  source: statusQuery,
  filter: ({ result }) =>
    result.status !== 'NONE' && result.status !== 'UNKNOWN',
  target: serverQuery,
})

export const updateServerMutation = createJsonMutation({
  request: {
    method: 'PUT',
    url: '/api/server',
    body: (config) => config,
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

update(serverQuery, {
  on: updateServerMutation,
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

export const $updateServerMutationError = createStore('').on(
  updateServerMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

sample({
  clock: [updateServerMutation.started, updateServerMutation.finished.success],
  target: [$updateServerMutationError.reinit],
})

sample({
  clock: serverQuery.finished.failure,
  fn: ({ error }) => ['Error getting server behavior:', error],
  target: log.errorFx,
})

sample({
  clock: updateServerMutation.finished.failure,
  fn: ({ error }) => ['Error updating server behavior:', error],
  target: log.errorFx,
})
