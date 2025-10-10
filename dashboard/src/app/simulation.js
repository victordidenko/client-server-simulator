import {
  concurrency,
  createJsonMutation,
  createJsonQuery,
  update,
} from '@farfetched/core'
import { anything, nothing, num, obj, or, str, val } from '@withease/contracts'
import { createEvent, createStore, sample } from 'effector'
import { log } from './common'

const sumulationSchema = obj({
  id: or(str, nothing),
  status: or(
    val('NONE'), //
    val('RUNNING'),
    val('STOPPED'),
    val('UNKNOWN')
  ),
  startedAt: num,
})

export const init = createEvent()

export const statusQuery = createJsonQuery({
  request: {
    method: 'GET',
    url: '/api/simulation',
  },
  response: {
    contract: sumulationSchema,
  },
})

concurrency(statusQuery, { strategy: 'TAKE_FIRST' })

export const startSimulationMutation = createJsonMutation({
  request: {
    method: 'PUT',
    url: (limit) =>
      limit ? `/api/simulation?limit=${limit}` : `/api/simulation`,
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

export const stopSimulationMutation = createJsonMutation({
  request: {
    method: 'DELETE',
    url: '/api/simulation',
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

export const resetSimulationMutation = createJsonMutation({
  request: {
    method: 'POST',
    url: '/api/simulation',
  },
  response: {
    contract: anything,
    status: { expected: 200 },
  },
})

update(statusQuery, {
  on: startSimulationMutation,
  by: {
    success: ({ query }) => ({
      result: { id: query.result.id, status: 'RUNNING' },
      refetch: true,
    }),
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

update(statusQuery, {
  on: stopSimulationMutation,
  by: {
    success: ({ query }) => ({
      result: { id: query.result.id, status: 'STOPPED' },
      refetch: true,
    }),
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

update(statusQuery, {
  on: resetSimulationMutation,
  by: {
    success: ({ query }) => ({
      result: { id: query.result.id, status: 'STOPPED' },
      refetch: true,
    }),
    failure: ({ query }) => ({
      result: query.result,
      refetch: true,
    }),
  },
})

sample({
  clock: init,
  target: statusQuery.refresh,
})

sample({
  source: statusQuery.finished.success,
  filter: ({ result }) => result.status === 'NONE',
  target: resetSimulationMutation.start,
})

// errors

export const $startSimulationMutationError = createStore('').on(
  startSimulationMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

export const $stopSimulationMutationError = createStore('').on(
  stopSimulationMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

export const $resetSimulationMutationError = createStore('').on(
  resetSimulationMutation.finished.failure,
  (_, { error }) => String(error.response || error.explanation)
)

sample({
  clock: [
    startSimulationMutation.started,
    stopSimulationMutation.started,
    resetSimulationMutation.started,
    startSimulationMutation.finished.success,
    stopSimulationMutation.finished.success,
    resetSimulationMutation.finished.success,
  ],
  target: [
    $startSimulationMutationError.reinit,
    $stopSimulationMutationError.reinit,
    $resetSimulationMutationError.reinit,
  ],
})

sample({
  clock: statusQuery.finished.failure,
  fn: ({ error }) => ['Error getting simulation status:', error],
  target: log.errorFx,
})

sample({
  clock: startSimulationMutation.finished.failure,
  fn: ({ error }) => ['Error starting simulation:', error],
  target: log.errorFx,
})

sample({
  clock: stopSimulationMutation.finished.failure,
  fn: ({ error }) => ['Error stopping simulation:', error],
  target: log.errorFx,
})

sample({
  clock: resetSimulationMutation.finished.failure,
  fn: ({ error }) => ['Error resetting simulation:', error],
  target: log.errorFx,
})
