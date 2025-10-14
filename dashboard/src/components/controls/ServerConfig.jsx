import { useUnit } from 'effector-solid'
import { createEffect, createSignal, untrack } from 'solid-js'
import { server, simulation } from '../../app'
import { Input } from './Input'
import { MCurvesInput } from './MCurvesInput'
import { MutationErrorIndicator } from './MutationErrorIndicator'
import { Slider } from './Slider'

export function ServerConfig() {
  const { data: status, pending: pendingStatus } = useUnit(
    simulation.statusQuery
  )
  const { data: serverBehavior, pending: pendingServerBehavior } = useUnit(
    server.serverQuery
  )

  const { start: applyBehavior, pending: applyingBehavior } = useUnit(
    server.updateServerMutation
  )

  const updateServerError = useUnit(server.$updateServerMutationError)

  const is = {
    disabled: () =>
      status()?.status === 'NONE' ||
      pendingStatus() ||
      pendingServerBehavior() ||
      applyingBehavior(),
  }

  const [timeMaxT, setTimeMaxT] = createSignal(0)
  const [responseTimeMinT, setResponseTimeMinT] = createSignal(0)
  const [responseTimeMaxT, setResponseTimeMaxT] = createSignal(100)

  // Resource management state
  const [enableResourceManagement, setEnableResourceManagement] =
    createSignal(false)
  const [maxConcurrentRequests, setMaxConcurrentRequests] = createSignal(100)
  const [maxQueueSize, setMaxQueueSize] = createSignal(50)
  const [maxMemoryMB, setMaxMemoryMB] = createSignal(1024)
  const [memoryLeakRateMBPerSec, setMemoryLeakRateMBPerSec] = createSignal(0.1)
  const [memoryPerRequestMB, setMemoryPerRequestMB] = createSignal(2.0)
  const [gcPauseIntervalSec, setGcPauseIntervalSec] = createSignal(10.0)
  const [gcPauseDurationMs, setGcPauseDurationMs] = createSignal(5.0)
  const [curves, setCurves] = createSignal([
    // errors
    [
      { x: 0, y: 0, type: 'curve' },
      { x: 1, y: 0, type: 'curve' },
    ],
    // response time, min
    [
      { x: 0, y: 0.1, type: 'curve' },
      { x: 1, y: 0.1, type: 'curve' },
    ],
    // response time, max
    [
      { x: 0, y: 0.5, type: 'curve' },
      { x: 1, y: 0.5, type: 'curve' },
    ],
  ])

  createEffect(() => {
    const behavior = serverBehavior()
    if (behavior) {
      setTimeMaxT(behavior.to)
      setResponseTimeMinT(behavior.rtfrom)
      setResponseTimeMaxT(behavior.rtto)
      setTimeout(
        () => setCurves([behavior.errors, behavior.rtmin, behavior.rtmax]),
        0
      )

      // Update resource management state
      setEnableResourceManagement(behavior.enableResourceManagement ?? false)
      if (behavior.resources) {
        setMaxConcurrentRequests(
          behavior.resources.maxConcurrentRequests ?? 100
        )
        setMaxQueueSize(behavior.resources.maxQueueSize ?? 50)
        setMaxMemoryMB(behavior.resources.maxMemoryMB ?? 1024)
        setMemoryLeakRateMBPerSec(
          behavior.resources.memoryLeakRateMBPerSec ?? 0.1
        )
        setGcPauseIntervalSec(behavior.resources.gcPauseIntervalSec ?? 10.0)
        setGcPauseDurationMs(behavior.resources.gcPauseDurationMs ?? 5.0)
        setMemoryPerRequestMB(
          behavior.resources.memoryPerRequestMB !== undefined
            ? behavior.resources.memoryPerRequestMB
            : 2.0
        )
      }
    }
  })

  function selectNormalPreset() {
    setTimeMaxT(0)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(100)
    setEnableResourceManagement(false)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.5, type: 'curve' },
          { x: 1, y: 0.5, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectError30Preset() {
    setTimeMaxT(0)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(100)
    setEnableResourceManagement(false)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0.3, type: 'curve' },
          { x: 1, y: 0.3, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.5, type: 'curve' },
          { x: 1, y: 0.5, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectError70Preset() {
    setTimeMaxT(0)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(100)
    setEnableResourceManagement(false)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0.7, type: 'curve' },
          { x: 1, y: 0.7, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.5, type: 'curve' },
          { x: 1, y: 0.5, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectError100Preset() {
    setTimeMaxT(0)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(100)
    setEnableResourceManagement(false)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 1, type: 'curve' },
          { x: 1, y: 1, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.5, type: 'curve' },
          { x: 1, y: 0.5, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectSlowPreset() {
    setTimeMaxT(120)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(15000)
    setEnableResourceManagement(true)
    setMaxConcurrentRequests(7000)
    setMaxQueueSize(10000)
    setMaxMemoryMB(6144)
    setMemoryPerRequestMB(0.01)
    setMemoryLeakRateMBPerSec(0.0)
    setGcPauseIntervalSec(3600.0)
    setGcPauseDurationMs(0.1)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 0.4, y: 0, type: 'curve' },
          { x: 0.5, y: 0.1, type: 'curve' },
          { x: 0.8, y: 0.4, type: 'curve' },
          { x: 1, y: 0.5, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.002, type: 'curve' },
          { x: 1, y: 0.8, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.0025, type: 'curve' },
          { x: 0.5, y: 1, type: 'break' },
          { x: 1, y: 1, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectUnstablePreset() {
    setTimeMaxT(60)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(10000)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 0.06, y: 0.02, type: 'curve' },
          { x: 0.12, y: 0.25, type: 'curve' },
          { x: 0.16, y: 0.08, type: 'curve' },
          { x: 0.21, y: 0.05, type: 'curve' },
          { x: 0.29, y: 0.51, type: 'curve' },
          { x: 0.37, y: 0.03, type: 'curve' },
          { x: 0.48, y: 0.18, type: 'curve' },
          { x: 0.62, y: 0.09, type: 'curve' },
          { x: 0.72, y: 0.3, type: 'curve' },
          { x: 0.86, y: 0.06, type: 'curve' },
          { x: 1, y: 0.03, type: 'curve' },
        ],
        // response time min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 0.14, y: 0.22, type: 'curve' },
          { x: 0.2, y: 0.32, type: 'curve' },
          { x: 0.37, y: 0.05, type: 'curve' },
          { x: 0.62, y: 0.22, type: 'curve' },
          { x: 0.81, y: 0.12, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time max
        [
          { x: 0, y: 0.2, type: 'curve' },
          { x: 0.07, y: 0.24, type: 'curve' },
          { x: 0.12, y: 0.62, type: 'curve' },
          { x: 0.24, y: 0.5, type: 'curve' },
          { x: 0.31, y: 0.96, type: 'curve' },
          { x: 0.37, y: 0.18, type: 'curve' },
          { x: 0.48, y: 0.59, type: 'curve' },
          { x: 0.62, y: 0.42, type: 'curve' },
          { x: 0.72, y: 0.77, type: 'curve' },
          { x: 0.86, y: 0.21, type: 'curve' },
          { x: 1, y: 0.36, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectScenarioPreset() {
    setTimeMaxT(50)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(100)
    setEnableResourceManagement(false)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 0.2, y: 0, type: 'break' },
          { x: 0.201, y: 0.3, type: 'break' },
          { x: 0.4, y: 0.3, type: 'break' },
          { x: 0.401, y: 0, type: 'break' },
          { x: 0.6, y: 0, type: 'break' },
          { x: 0.601, y: 1, type: 'break' },
          { x: 0.8, y: 1, type: 'break' },
          { x: 0.801, y: 0, type: 'break' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.5, type: 'curve' },
          { x: 1, y: 0.5, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectThreadsLimitedPreset() {
    setTimeMaxT(0)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(100)
    setEnableResourceManagement(true)
    setMaxConcurrentRequests(30)
    setMaxQueueSize(60)
    setMaxMemoryMB(512)
    setMemoryPerRequestMB(2.0)
    setMemoryLeakRateMBPerSec(0.0)
    setGcPauseIntervalSec(3600.0)
    setGcPauseDurationMs(10.0)
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function selectMemoryLeakPreset() {
    setTimeMaxT(0)
    setResponseTimeMinT(0)
    setResponseTimeMaxT(100)
    setEnableResourceManagement(true)
    setMaxConcurrentRequests(100)
    setMaxQueueSize(50)
    setMaxMemoryMB(384)
    setMemoryPerRequestMB(2.0)
    setMemoryLeakRateMBPerSec(50.0) // High leak rate
    setGcPauseIntervalSec(3600.0) // Infrequent GC
    setGcPauseDurationMs(50.0) // Long GC pauses
    setTimeout(() => {
      setCurves([
        // errors
        [
          { x: 0, y: 0, type: 'curve' },
          { x: 1, y: 0, type: 'curve' },
        ],
        // response time, min
        [
          { x: 0, y: 0.1, type: 'curve' },
          { x: 1, y: 0.1, type: 'curve' },
        ],
        // response time, max
        [
          { x: 0, y: 0.5, type: 'curve' },
          { x: 1, y: 0.5, type: 'curve' },
        ],
      ])
      setTimeout(handleApplyServerBehavior, 0)
    }, 0)
  }

  function handleApplyServerBehavior() {
    const timeTo = untrack(() => timeMaxT())
    const rtFrom = untrack(() => responseTimeMinT())
    const rtTo = untrack(() => responseTimeMaxT())
    const [errorsPoints, rtMinPoints, rtMaxPoints] = untrack(() => curves())
    applyBehavior({
      to: timeTo,
      rtfrom: rtFrom,
      rtto: rtTo,
      rtmin: rtMinPoints,
      rtmax: rtMaxPoints,
      errors: errorsPoints,
      enableResourceManagement: untrack(() => enableResourceManagement()),
      resources: {
        maxConcurrentRequests: untrack(() => maxConcurrentRequests()),
        maxQueueSize: untrack(() => maxQueueSize()),
        maxMemoryMB: untrack(() => maxMemoryMB()),
        memoryLeakRateMBPerSec: untrack(() => memoryLeakRateMBPerSec()),
        memoryPerRequestMB: untrack(() => memoryPerRequestMB()),
        gcPauseIntervalSec: untrack(() => gcPauseIntervalSec()),
        gcPauseDurationMs: untrack(() => gcPauseDurationMs()),
      },
    })
  }

  return (
    <div class='bg-white p-2'>
      <h3 class='text-lg font-semibold mb-3'>Server Behavior</h3>

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
          onClick={selectUnstablePreset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          Unstable
        </button>
        <button
          type='button'
          onClick={selectScenarioPreset}
          class='px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700'
        >
          Scenario
        </button>
        <button
          type='button'
          onClick={selectThreadsLimitedPreset}
          class='px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-700'
        >
          Threads Limited
        </button>
        <button
          type='button'
          onClick={selectMemoryLeakPreset}
          class='px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700'
        >
          Memory Leak
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
              label: 'Error Rate',
              unit: '%',
            },
            {
              min: responseTimeMinT(),
              max: responseTimeMaxT(),
              label: 'Response time',
              unit: 'ms',
              onMinChange: setResponseTimeMinT,
              onMaxChange: setResponseTimeMaxT,
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

      {/* Resource Management Section */}
      <div class='mb-6 pt-4 border-t-1 border-blue-200'>
        <div class='flex items-center justify-between mb-4'>
          <h4 class='text-md font-semibold'>Resource Management</h4>
          <div class='flex items-center gap-3'>
            <button
              type='button'
              onClick={() =>
                setEnableResourceManagement(!enableResourceManagement())
              }
              disabled={is.disabled()}
              class={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                enableResourceManagement()
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              } ${is.disabled() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
            >
              {enableResourceManagement() ? 'Enabled' : 'Disabled'}
            </button>
            <input
              type='checkbox'
              checked={enableResourceManagement()}
              onChange={(e) => setEnableResourceManagement(e.target.checked)}
              disabled={is.disabled()}
              class='w-4 h-4'
            />
          </div>
        </div>

        {enableResourceManagement() && (
          <div class='flex flex-col gap-7 p-4 pb-0 border-l-1 border-blue-200'>
            <div class='flex items-center gap-4'>
              <Input
                label='Max Concurrent Requests'
                min={1}
                max={10000}
                value={maxConcurrentRequests()}
                onInput={(e) =>
                  setMaxConcurrentRequests(parseInt(e.target.value, 10))
                }
                disabled={is.disabled()}
              />
              <Slider
                min={1}
                max={10000}
                step={1}
                value={maxConcurrentRequests()}
                onInput={setMaxConcurrentRequests}
                disabled={is.disabled()}
                class='flex-1'
              />
            </div>

            <div class='flex items-center gap-4'>
              <Input
                label='Max Queue Size'
                min={1}
                max={10000}
                value={maxQueueSize()}
                onInput={(e) => setMaxQueueSize(parseInt(e.target.value, 10))}
                disabled={is.disabled()}
              />
              <Slider
                min={1}
                max={10000}
                step={1}
                value={maxQueueSize()}
                onInput={setMaxQueueSize}
                disabled={is.disabled()}
                class='flex-1'
              />
            </div>

            <div class='flex items-center gap-4'>
              <Input
                label='Max Memory (MB)'
                min={1}
                max={100000}
                value={maxMemoryMB()}
                onInput={(e) => setMaxMemoryMB(parseInt(e.target.value, 10))}
                disabled={is.disabled()}
              />
              <Slider
                min={1}
                max={100000}
                step={1}
                value={maxMemoryMB()}
                onInput={setMaxMemoryMB}
                disabled={is.disabled()}
                class='flex-1'
              />
            </div>

            <div class='flex items-center gap-4'>
              <Input
                label='Memory Per Request (MB)'
                min={0.01}
                max={1000}
                step={0.01}
                value={memoryPerRequestMB()}
                onInput={(e) =>
                  setMemoryPerRequestMB(parseFloat(e.target.value))
                }
                disabled={is.disabled()}
              />
              <Slider
                min={0.01}
                max={1000}
                step={0.01}
                value={memoryPerRequestMB()}
                onInput={setMemoryPerRequestMB}
                disabled={is.disabled()}
                class='flex-1'
              />
            </div>

            <div class='flex items-center gap-4'>
              <Input
                label='Memory Leak Rate (MB/s)'
                min={0}
                max={100}
                step={0.01}
                value={memoryLeakRateMBPerSec()}
                onInput={(e) =>
                  setMemoryLeakRateMBPerSec(parseFloat(e.target.value))
                }
                disabled={is.disabled()}
              />
              <Slider
                min={0}
                max={100}
                step={1}
                value={memoryLeakRateMBPerSec()}
                onInput={setMemoryLeakRateMBPerSec}
                disabled={is.disabled()}
                class='flex-1'
              />
            </div>

            <div class='flex items-center gap-4'>
              <Input
                label='GC Interval (s)'
                min={0.1}
                max={3600}
                step={0.1}
                value={gcPauseIntervalSec()}
                onInput={(e) =>
                  setGcPauseIntervalSec(parseFloat(e.target.value))
                }
                disabled={is.disabled()}
              />
              <Slider
                min={0.1}
                max={3600}
                step={1}
                value={gcPauseIntervalSec()}
                onInput={setGcPauseIntervalSec}
                disabled={is.disabled()}
                class='flex-1'
              />
            </div>

            <div class='flex items-center gap-4'>
              <Input
                label='GC Pause Duration (ms)'
                min={0.1}
                max={10000}
                step={0.1}
                value={gcPauseDurationMs()}
                onInput={(e) =>
                  setGcPauseDurationMs(parseFloat(e.target.value))
                }
                disabled={is.disabled()}
              />
              <Slider
                min={0.1}
                max={10000}
                step={0.1}
                value={gcPauseDurationMs()}
                onInput={setGcPauseDurationMs}
                disabled={is.disabled()}
                class='flex-1'
              />
            </div>
          </div>
        )}
      </div>

      <div class='flex gap-2 flex-wrap font-normal'>
        <div class='relative'>
          <button
            type='button'
            onClick={handleApplyServerBehavior}
            disabled={is.disabled()}
            class={`px-2 py-1 font-normal rounded ${
              is.disabled()
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Apply
          </button>
          <MutationErrorIndicator error={updateServerError()} />
        </div>
      </div>
    </div>
  )
}
