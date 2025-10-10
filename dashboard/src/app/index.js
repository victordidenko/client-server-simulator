import { createEvent, sample } from 'effector'
import * as charts from './charts'
import * as clients from './clients'
import * as network from './network'
import * as server from './server'
import * as simulation from './simulation'
import { metrics, notifications } from './ws'

export { metrics, simulation, clients, charts, server, network, notifications }

export const init = createEvent()

sample({
  clock: init,
  target: [
    metrics.init,
    notifications.init,
    simulation.init,
    clients.init,
    charts.init,
    server.init,
    network.init,
  ],
})
