import { Show } from 'solid-js'

export function MutationErrorIndicator(props) {
  return (
    <Show when={props.error}>
      <span class='absolute group flex size-3 -top-1 -right-1 z-50'>
        <span class='absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75'></span>
        <span class='relative inline-flex size-3 rounded-full bg-red-600'></span>
        <div class='absolute left-1/2 -translate-x-1/2 top-6 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100 group-hover:duration-100 group-hover:ease-in pointer-events-none'>
          <div class='bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap relative'>
            {props.error}
            <div class='absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45'></div>
          </div>
        </div>
      </span>
    </Show>
  )
}
