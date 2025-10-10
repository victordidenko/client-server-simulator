import { useUnit } from 'effector-solid'
import { createEffect, createSignal, untrack } from 'solid-js'
import { network, simulation } from '../../app'
import { MCurvesInput } from './MCurvesInput'
import { MutationErrorIndicator } from './MutationErrorIndicator'

export function NetworkConfig() {
  const { data: status, pending: pendingStatus } = useUnit(
    simulation.statusQuery
  )
  const { data: networkBehavior, pending: pendingNetworkBehavior } = useUnit(
    network.networkQuery
  )

  const { start: applyBehavior, pending: applyingBehavior } = useUnit(
    network.updateNetworkMutation
  )

  const updateNetworkError = useUnit(network.$updateNetworkMutationError)

  const is = {
    disabled: () =>
      status()?.status === 'NONE' ||
      pendingStatus() ||
      pendingNetworkBehavior() ||
      applyingBehavior(),
  }

  const [timeMaxT, setTimeMaxT] = createSignal(0)
  const [latencyMinT, setLatencyMinT] = createSignal(0)
  const [latencyMaxT, setLatencyMaxT] = createSignal(100)
  const [curves, setCurves] = createSignal([
    // drops
    [
      { x: 0, y: 0, type: 'curve' },
      { x: 1, y: 0, type: 'curve' },
    ],
    // latency, min
    [
      { x: 0, y: 0.1, type: 'curve' },
      { x: 1, y: 0.1, type: 'curve' },
    ],
    // latency, max
    [
      { x: 0, y: 0.4, type: 'curve' },
      { x: 1, y: 0.4, type: 'curve' },
    ],
  ])

  createEffect(() => {
    const behavior = networkBehavior()
    if (behavior) {
      setTimeMaxT(behavior.to)
      setLatencyMinT(behavior.latfrom)
      setLatencyMaxT(behavior.latto)
      setTimeout(
        () => setCurves([behavior.drops, behavior.latmin, behavior.latmax]),
        0
      )
    }
  })

  function selectNormalPreset() {
    setTimeMaxT(0)
    setLatencyMinT(0)
    setLatencyMaxT(100)
    setTimeout(() => {
      setCurves([
        // drops
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // latency, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // latency, max
        [
          { x: 0, y: 0.4, type: 'curve' },
          { x: 1, y: 0.4, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyNetworkBehavior, 0)
    }, 0)
  }

  function selectError30Preset() {
    setTimeMaxT(0)
    setLatencyMinT(0)
    setLatencyMaxT(100)
    setTimeout(() => {
      setCurves([
        // drops
        [
          { x: 0, y: 0.3, type: 'curve' },
          { x: 1, y: 0.3, type: 'curve' },
        ],
        // latency, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // latency, max
        [
          { x: 0, y: 0.4, type: 'curve' },
          { x: 1, y: 0.4, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyNetworkBehavior, 0)
    }, 0)
  }

  function selectError70Preset() {
    setTimeMaxT(0)
    setLatencyMinT(0)
    setLatencyMaxT(100)
    setTimeout(() => {
      setCurves([
        // drops
        [
          { x: 0, y: 0.7, type: 'curve' },
          { x: 1, y: 0.7, type: 'curve' },
        ],
        // latency, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // latency, max
        [
          { x: 0, y: 0.4, type: 'curve' },
          { x: 1, y: 0.4, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyNetworkBehavior, 0)
    }, 0)
  }

  function selectError100Preset() {
    setTimeMaxT(0)
    setLatencyMinT(0)
    setLatencyMaxT(100)
    setTimeout(() => {
      setCurves([
        // drops
        [
          { x: 0, y: 1, type: 'curve' },
          { x: 1, y: 1, type: 'curve' },
        ],
        // latency, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // latency, max
        [
          { x: 0, y: 0.4, type: 'curve' },
          { x: 1, y: 0.4, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyNetworkBehavior, 0)
    }, 0)
  }

  function selectSlowPreset() {
    setTimeMaxT(0)
    setLatencyMinT(1000)
    setLatencyMaxT(5000)
    setTimeout(() => {
      setCurves([
        // drops
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // latency, min
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // latency, max
        [
          { x: 0, y: 1, type: 'curve' },
          { x: 1, y: 1, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyNetworkBehavior, 0)
    }, 0)
  }

  function selectScenarioPreset() {
    setTimeMaxT(30)
    setLatencyMinT(0)
    setLatencyMaxT(100)
    setTimeout(() => {
      setCurves([
        // drops
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 0.333, y: 0, type: 'break' },
          { x: 0.334, y: 1, type: 'break' },
          { x: 0.666, y: 1, type: 'break' },
          { x: 0.667, y: 0, type: 'break' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // latency, min
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // latency, max
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyNetworkBehavior, 0)
    }, 0)
  }

  function handleApplyNetworkBehavior() {
    const timeTo = untrack(() => timeMaxT())
    const latFrom = untrack(() => latencyMinT())
    const latTo = untrack(() => latencyMaxT())
    const [dropsPoints, latMinPoints, latMaxPoints] = untrack(() => curves())
    applyBehavior({
      to: timeTo,
      latfrom: latFrom,
      latto: latTo,
      latmin: latMinPoints,
      latmax: latMaxPoints,
      drops: dropsPoints,
    })
  }

  return (
    <div class='bg-white p-2'>
      <h3 class='text-lg font-semibold mb-3'>Network Behavior</h3>

      <div class='flex flex-wrap gap-2 font-normal mb-4'>
        <div class='text-xs font-normal text-gray-500 flex items-center'>
          Preset
        </div>
        <button
          type='button'
          onClick={selectNormalPreset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          Normal
        </button>
        <button
          type='button'
          onClick={selectError30Preset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          30% Error
        </button>
        <button
          type='button'
          onClick={selectError70Preset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          70% Error
        </button>
        <button
          type='button'
          onClick={selectError100Preset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          100% Error
        </button>
        <button
          type='button'
          onClick={selectSlowPreset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          Slow
        </button>
        <button
          type='button'
          onClick={selectScenarioPreset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          Scenario
        </button>
      </div>

      <div class='mb-6 max-w-[500px]'>
        <MCurvesInput
          curves={curves()}
          onChange={setCurves}
          x={{
            min: 0,
            max: timeMaxT(),
            label: 'Time',
            unit: 's',
            onMaxChange: setTimeMaxT,
          }}
          y={[
            {
              min: 0,
              max: 100,
              label: 'Drops Rate',
              unit: '%',
            },
            {
              min: latencyMinT(),
              max: latencyMaxT(),
              label: 'Latency',
              unit: 'ms',
              onMinChange: setLatencyMinT,
              onMaxChange: setLatencyMaxT,
            },
          ]}
          constraints={[
            {
              type: 'minmax',
              curves: [1, 2],
            },
          ]}
        />
      </div>

      <div class='flex gap-2 flex-wrap font-normal'>
        <div class='relative'>
          <button
            type='button'
            onClick={handleApplyNetworkBehavior}
            disabled={is.disabled()}
            class={`px-2 py-1 font-normal rounded ${
              is.disabled()
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Apply
          </button>
          <MutationErrorIndicator error={updateNetworkError()} />
        </div>
      </div>
    </div>
  )
}
