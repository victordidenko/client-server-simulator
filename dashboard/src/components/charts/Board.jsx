import { useUnit } from 'effector-solid'
import { Show } from 'solid-js'
import { server } from '../../app'
import { useSessionSignal } from '../../utils/signals'
import { ClientsCount } from './ClientsCount'
import { RequestsPerSecond } from './RequestsPerSecond'
import { ResponseTime } from './ResponseTime'
import { Utilization } from './Utilization'

function Foldable(props) {
  const [open, setOpen] = useSessionSignal(
    `simulation__board-folded-${props.id}`,
    props.defaultOpen
  )

  return (
    <Show
      when={open()}
      fallback={
        <div class='relative w-full mb-2 min-h-0'>
          <button
            type='button'
            class='absolute top-2 left-2 z-10 p-1 rounded hover:bg-gray-200 transition'
            onClick={() => setOpen(true)}
          >
            <span class='inline-block duration-200 transform-[rotate(0deg)]'>
              ▶
            </span>
          </button>
          <div class='flex items-end justify-start w-full h-8 pl-8 select-none font-bold text-xs'>
            {props.label}
          </div>
        </div>
      }
    >
      <div
        class='w-full mb-7 relative bg-white rounded shadow'
        classList={{ [props.height]: true }}
      >
        <button
          type='button'
          class='absolute top-2 left-2 z-10 p-1 rounded hover:bg-gray-200 transition'
          onClick={() => setOpen(false)}
        >
          <span class='inline-block duration-200 transform-[rotate(90deg)]'>
            ▶
          </span>
        </button>
        <div class='w-full h-full'>{props.children}</div>
      </div>
    </Show>
  )
}

export function Board() {
  const { data: serverBehavior } = useUnit(server.serverQuery)
  const utilization = () => serverBehavior()?.enableResourceManagement || false

  return (
    <div>
      <Foldable
        id='clients'
        label='Clients, N'
        height='h-[250px]'
        defaultOpen={true}
      >
        <ClientsCount />
      </Foldable>
      <Foldable
        id='rps'
        label='Requests/Responces, rps'
        height='h-[800px]'
        defaultOpen={true}
      >
        <RequestsPerSecond />
      </Foldable>
      <Show when={utilization()}>
        <Foldable
          id='utilization'
          label='Utilization, %'
          height='h-[400px]'
          defaultOpen={true}
        >
          <Utilization />
        </Foldable>
      </Show>
      <Foldable
        id='response'
        label='Response Time, ms/s'
        height='h-[400px]'
        defaultOpen={true}
      >
        <ResponseTime />
      </Foldable>
    </div>
  )
}
