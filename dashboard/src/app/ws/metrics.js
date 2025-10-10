import { createEvent, sample } from 'effector'
import * as simulation from '../simulation'
import { createWebSocket } from './common'

export const init = createEvent()
export const data = createEvent()

export const {
  connect,
  open,
  close,
  error,
  data: message,
  $socket,
  $error,
  $updater,
  $connected,
  $status,
} = createWebSocket('/api/ws/metrics')

sample({
  clock: init,
  target: connect,
})

sample({
  clock: message,
  source: simulation.statusQuery.$data,
  fn: (simulation, payload) => ({
    ...payload,
    timestamp: payload.timestamp - (simulation?.startedAt || 0),
  }),
  target: data,
})
