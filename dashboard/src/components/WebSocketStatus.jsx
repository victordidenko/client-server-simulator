import { useUnit } from 'effector-solid'
import { metrics, notifications } from '../app'
import { CLOSED, CLOSING, CONNECTING, ERROR, OPEN } from '../app/ws'

function StatusDot(props) {
  const pulse = () => [CONNECTING, CLOSING].includes(props.status)

  const color = () =>
    ({
      [CONNECTING]: 'bg-yellow-500',
      [OPEN]: 'bg-green-500',
      [CLOSING]: 'bg-gray-500',
      [CLOSED]: 'bg-black',
      [ERROR]: 'bg-red-500',
    })[props.status] ?? 'bg-orange-500'

  return (
    <div
      class='w-2 h-2 rounded-full'
      classList={{
        [color()]: true,
        'animate-pulse': pulse(),
      }}
    ></div>
  )
}

function StatusTooltip(props) {
  const visible = () => props.status !== OPEN

  return (
    <div
      class='absolute right-5 -top-2 opacity-0 transition-opacity duration-500 delay-[2500ms] ease-out group-hover:opacity-100 group-hover:duration-100 group-hover:delay-0 group-hover:ease-in pointer-events-none'
      classList={{
        '!opacity-100 !duration-0 !delay-0': visible(),
      }}
    >
      <div class='bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap'>
        {props.message}
        <div class='absolute top-2 -right-1 w-2 h-2 bg-gray-900 rotate-45'></div>
      </div>
    </div>
  )
}

function ClientsList() {
  const clients = useUnit(notifications.$clients)
  const colors = [
    'bg-red-500',
    'bg-red-600',
    'bg-orange-500',
    'bg-orange-600',
    'bg-amber-500',
    'bg-amber-600',
    'bg-yellow-500',
    'bg-yellow-600',
    'bg-lime-500',
    'bg-lime-600',
    'bg-green-500',
    'bg-green-600',
    'bg-emerald-500',
    'bg-emerald-600',
    'bg-teal-500',
    'bg-teal-600',
    'bg-cyan-500',
    'bg-cyan-600',
    'bg-sky-500',
    'bg-sky-600',
    'bg-blue-500',
    'bg-blue-600',
    'bg-indigo-500',
    'bg-indigo-600',
    'bg-violet-500',
    'bg-violet-600',
    'bg-purple-500',
    'bg-purple-600',
    'bg-fuchsia-500',
    'bg-fuchsia-600',
    'bg-pink-500',
    'bg-pink-600',
    'bg-rose-500',
    'bg-rose-600',
  ]

  function fnv1aHash(str) {
    let hash = 0x811c9dc5 // 32-bit FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      hash = (hash * 0x01000193) >>> 0 // FNV prime, keep 32-bit unsigned
    }
    return hash
  }

  function getColorForName(name) {
    const hash = fnv1aHash(name)
    const index = hash % colors.length
    return colors[index]
  }

  return (
    <div class='flex flex-row items-center relative'>
      {clients().map((name, idx) => (
        <div class={`relative group${idx !== 0 ? ' -ml-2.5' : ''}`}>
          <div
            class='w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white cursor-pointer'
            classList={{ [getColorForName(name)]: true }}
          >
            {name[0]?.toUpperCase() ?? '?'}
          </div>
          <div class='pointer-events-none absolute right-full mr-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50'>
            {name}
            <div class='absolute right-[-0.25rem] top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45'></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function WebSocketStatus() {
  const s = useUnit(metrics.$status)
  const status = () => s().status
  const message = () => s().message

  return (
    <div class='flex flex-row items-center gap-2 mr-2'>
      <ClientsList />
      <div class='relative group'>
        <StatusDot status={status()} />
        <StatusTooltip status={status()} message={message()} />
      </div>
    </div>
  )
}
