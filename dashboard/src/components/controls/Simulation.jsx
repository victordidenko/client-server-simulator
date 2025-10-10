import { useUnit } from 'effector-solid'
import { createSignal } from 'solid-js'
import { clients, simulation } from '../../app'
import { MutationErrorIndicator } from './MutationErrorIndicator'

export function Simulation() {
  const { data: status, pending } = useUnit(simulation.statusQuery)
  const { data: clientGroups, pending: pendingClientGroups } = useUnit(
    clients.clientsQuery
  )

  const { start, pending: starting } = useUnit(
    simulation.startSimulationMutation
  )
  const { start: stop, pending: stopping } = useUnit(
    simulation.stopSimulationMutation
  )
  const { start: reset, pending: resetting } = useUnit(
    simulation.resetSimulationMutation
  )

  const startError = useUnit(simulation.$startSimulationMutationError)
  const stopError = useUnit(simulation.$stopSimulationMutationError)
  const resetError = useUnit(simulation.$resetSimulationMutationError)

  const is = {
    running: () => status()?.status === 'RUNNING',
    starting: () => starting(),
    stopping: () => stopping(),
    resetting: () => resetting(),
    noClients: () => clientGroups() == null || clientGroups().length === 0,
    disabled: () =>
      pending() ||
      starting() ||
      stopping() ||
      resetting() ||
      pendingClientGroups(),
  }

  const [limit, setLimit] = createSignal(15)

  function startSimulation(limit) {
    start(limit)
  }

  return (
    <div class='bg-white p-2'>
      <h3 class='text-lg font-semibold mb-3'>Simulation Options</h3>

      <div class='flex gap-2 flex-wrap font-normal'>
        <div class='relative'>
          <button
            type='button'
            onClick={() => startSimulation()}
            disabled={is.disabled() || is.running() || is.noClients()}
            class={`px-2 py-1 rounded w-24 ${
              is.disabled() || is.running() || is.noClients()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {is.starting() ? 'Starting...' : 'Start'}
          </button>
          <MutationErrorIndicator error={startError()} />
        </div>

        <div class='relative flex'>
          <button
            type='button'
            onClick={() => startSimulation(limit())}
            disabled={is.disabled() || is.running() || is.noClients()}
            class={`px-2 py-1 rounded-l w-24 ${
              is.disabled() || is.running() || is.noClients()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {is.starting() ? 'Starting...' : 'Start'}
          </button>
          <MutationErrorIndicator error={startError()} />
          <input
            type='number'
            min='1'
            value={limit()}
            onInput={(e) => setLimit(Number(e.currentTarget.value))}
            class={`w-12 text-right border-2 rounded-r ${
              is.disabled() || is.running() || is.noClients()
                ? 'border-gray-300 text-gray-500 cursor-not-allowed'
                : 'border-green-600'
            }`}
            disabled={is.disabled() || is.running() || is.noClients()}
          />
        </div>

        <div class='relative'>
          <button
            type='button'
            onClick={stop}
            disabled={is.disabled() || !is.running() || is.noClients()}
            class={`px-2 py-1 rounded w-24 ${
              is.disabled() || !is.running() || is.noClients()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-700'
            }`}
          >
            {is.stopping() ? 'Stopping...' : 'Stop'}
          </button>
          <MutationErrorIndicator error={stopError()} />
        </div>

        <div class='relative'>
          <button
            type='button'
            onClick={reset}
            disabled={is.disabled()}
            class={`px-2 py-1 rounded w-24 ${
              is.disabled()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {is.resetting() ? 'Resetting...' : 'Reset'}
          </button>
          <MutationErrorIndicator error={resetError()} />
        </div>
      </div>
    </div>
  )
}
