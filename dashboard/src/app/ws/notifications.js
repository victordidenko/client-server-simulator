import { createEvent, createStore, sample, split } from 'effector'
import * as clients from '../clients'
import * as network from '../network'
import * as server from '../server'
import * as simulation from '../simulation'
import { createWebSocket, name } from './common'

export const init = createEvent()

export const joined = createEvent()
export const left = createEvent()
export const simulation_reset = createEvent()
export const simulation_started = createEvent()
export const simulation_stopped = createEvent()
export const client_config_added = createEvent()
export const client_configs_cleared = createEvent()
export const client_config_deleted = createEvent()
export const client_config_updated = createEvent()
export const server_behavior_updated = createEvent()
export const network_behavior_updated = createEvent()

export const $clients = createStore([]) //
  .on(joined, (_, payload) => moveToLast(payload.payload.all, name))
  .on(left, (_, payload) => moveToLast(payload.payload.all, name))

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
} = createWebSocket('/api/ws/notifications')

sample({
  clock: init,
  target: connect,
})

split({
  source: message,
  match: (payload) => payload.type,
  cases: {
    joined,
    left,
    simulation_reset,
    simulation_started,
    simulation_stopped,
    client_config_added,
    client_configs_cleared,
    client_config_deleted,
    client_config_updated,
    server_behavior_updated,
    network_behavior_updated,
  },
})

sample({
  clock: [simulation_started, simulation_stopped, simulation_reset],
  target: simulation.statusQuery.refresh,
})

sample({
  clock: [
    client_config_added,
    client_configs_cleared,
    client_config_deleted,
    client_config_updated,
  ],
  target: clients.clientsQuery.refresh,
})

sample({
  clock: [server_behavior_updated],
  target: server.serverQuery.refresh,
})

sample({
  clock: [network_behavior_updated],
  target: network.networkQuery.refresh,
})

//
// Helpers
//

function moveToLast(arr, move) {
  const newArr = [...arr]
  const lastIndex = newArr.lastIndexOf(move)
  if (lastIndex !== -1) {
    const [removedString] = newArr.splice(lastIndex, 1)
    newArr.push(removedString)
  }
  return newArr
}
