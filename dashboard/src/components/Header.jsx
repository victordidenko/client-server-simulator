import { useUnit } from 'effector-solid'
import { Match, Show, Switch } from 'solid-js'
import { simulation } from '../app'
import { WebSocketStatus } from './WebSocketStatus'

function Status(props) {
  const color = () =>
    ({
      PENDING: 'bg-gray-400',
      NONE: 'bg-gray-500',
      RUNNING: 'bg-green-500',
      STOPPED: 'bg-gray-500',
      UNKNOWN: 'bg-orange-500',
      ERROR: 'bg-red-500',
    })[props.pending ? 'PENDING' : props.error ? 'ERROR' : props.status] ??
    'bg-inherit'

  return (
    <div
      class='ml-2 pl-1.5 pr-1.5 rounded overflow-hidden cursor-default'
      classList={{
        [color()]: true,
      }}
    >
      <Switch>
        <Match when={props.pending}>
          <span class='flex items-center'>
            <span class='inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin align-middle mr-1'></span>
            loading...
          </span>
        </Match>
        <Match when={props.error}>
          <span>error</span>
        </Match>
        <Match when={props.status}>
          <span>{props.status.toLowerCase()}</span>
        </Match>
      </Switch>
    </div>
  )
}

function StatusTooltip(props) {
  const message = () =>
    ({
      PENDING: 'Loading simulation status',
      NONE: 'No active simulation',
      RUNNING: 'Simulation is running',
      STOPPED: 'Simulation is stopped',
      UNKNOWN: 'Unknown status',
      ERROR: props.error?.explanation,
    })[props.pending ? 'PENDING' : props.error ? 'ERROR' : props.status]

  return (
    <Show when={message()}>
      <div
        class='absolute left-full top-1/2 -translate-y-1/2 ml-3 opacity-0 transition-opacity duration-500 delay-[2500ms] ease-out group-hover:opacity-100 group-hover:duration-100 group-hover:delay-0 group-hover:ease-in pointer-events-none'
        classList={{
          '!opacity-100 !duration-0 !delay-0': props.error,
        }}
      >
        <div class='bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap'>
          {message()}
          <div class='absolute top-2 -left-1 w-2 h-2 bg-gray-900 rotate-45'></div>
        </div>
      </div>
    </Show>
  )
}

export function Header() {
  const { data, error, pending } = useUnit(simulation.statusQuery)
  const status = () => data()?.status
  return (
    <h1 class='text-xl font-bold p-0.5 flex items-center bg-gray-300'>
      Client-Server Simulation
      <span class='relative group flex items-center font-normal text-base'>
        <Status pending={pending()} status={status()} error={error()} />
        <StatusTooltip pending={pending()} status={status()} error={error()} />
      </span>
      <div class='flex-1 place-items-end'>
        <WebSocketStatus />
      </div>
    </h1>
  )
}
