import { createPluginBus } from '@dschz/solid-uplot'
import * as plugins from '@dschz/solid-uplot/plugins'
import { Show } from 'solid-js'

function Legend(props) {
  const cursorVisible = () =>
    props.bus.data.cursor?.state[props.u.root.id]?.visible

  const opacity = () => (cursorVisible() ? 'opacity-50' : 'opacity-100')

  return (
    <div
      class='bg-white border-gray-100 border pl-1 pr-1 transition-opacity duration-200 text-sm'
      classList={{ [opacity()]: true }}
    >
      <For each={props.seriesData}>
        {(series) => (
          <Show when={series.visible}>
            <div class='flex items-center gap-1'>
              <div class='w-2.5 h-2.5' style={{ background: series.stroke }} />
              <span>{series.label}</span>
            </div>
          </Show>
        )}
      </For>
    </div>
  )
}

function Tooltip(props) {
  return (
    <div class='bg-white border-gray-100 border pl-1 pr-1 opacity-70 text-sm'>
      <div>
        Time: {new Date(props.cursor.xValue * 1000).toLocaleTimeString()}
      </div>
      <For each={props.seriesData}>
        {(series) => {
          const value = () => props.u.data[series.seriesIdx]?.[props.cursor.idx]
          return (
            <Show when={series.visible}>
              <div style={{ color: series.stroke }}>
                {series.label}: {v(value())}
              </div>
            </Show>
          )
        }}
      </For>
    </div>
  )
}

export const bus = createPluginBus()

export const cursor = plugins.cursor()

export const focusSeries = plugins.focusSeries({
  pxThreshold: 20,
})

export const tooltip = plugins.tooltip(Tooltip, {
  placement: 'bottom-right',
})

export const legend = plugins.legend(Legend, {
  placement: 'top-left',
  pxOffset: 0,
  class: '!pointer-events-none',
})

function v(x) {
  if (Number.isInteger(x)) {
    return x.toString()
  } else if (typeof x === 'number' && !Number.isNaN(x)) {
    return x.toFixed(2)
  } else {
    return String(x)
  }
}
