import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { Curves } from './Curves'

/**
 * CurvesInput: Curve editor with axis min/max controls.
 * Props:
 * - points: Array of {x, y} control points (normalized 0-1, sorted by x)
 * - onChange: function(newPoints) called when points change
 * - x: { min, max, format, onChange? }
 * - y: { min, max, format, onChange? }
 * - width, height, class: optional
 */
export function CurvesInput(props) {
  // Controlled values for axis min/max
  const [xMin, setXMin] = createSignal(props.x?.min ?? 0)
  const [xMax, setXMax] = createSignal(props.x?.max ?? 1)
  const [yMin, setYMin] = createSignal(props.y?.min ?? 0)
  const [yMax, setYMax] = createSignal(props.y?.max ?? 1)

  // Sync signals with props when they change
  createEffect(() => {
    if (props.x?.min !== undefined && props.x?.min !== xMin())
      setXMin(props.x.min)
    if (props.x?.max !== undefined && props.x?.max !== xMax())
      setXMax(props.x.max)
    if (props.y?.min !== undefined && props.y?.min !== yMin())
      setYMin(props.y.min)
    if (props.y?.max !== undefined && props.y?.max !== yMax())
      setYMax(props.y.max)
  })

  // Validation: min <= max
  function handleXMinInput(e) {
    let val = Number(e.target.value)
    if (val > xMax()) val = xMax()
    setXMin(val)
    props.x?.onMinChange?.(val)
  }
  function handleXMaxInput(e) {
    let val = Number(e.target.value)
    if (val < xMin()) val = xMin()
    setXMax(val)
    props.x?.onMaxChange?.(val)
  }
  function handleYMinInput(e) {
    let val = Number(e.target.value)
    if (val > yMax()) val = yMax()
    setYMin(val)
    props.y?.onMinChange?.(val)
  }
  function handleYMaxInput(e) {
    let val = Number(e.target.value)
    if (val < yMin()) val = yMin()
    setYMax(val)
    props.y?.onMaxChange?.(val)
  }

  // Memoized axis objects for Curves
  const xAxis = createMemo(() => ({
    min: xMin(),
    max: xMax(),
    unit: props.x?.unit ?? '',
    format: (v) =>
      `${props.x?.label ?? '—'}: ${v.toFixed(2)}${props.x?.unit ?? ''}`,
  }))
  const yAxis = createMemo(() => ({
    min: yMin(),
    max: yMax(),
    unit: props.y?.unit ?? '',
    format: (v) =>
      `${props.y?.label ?? '|'}: ${v.toFixed(2)}${props.y?.unit ?? ''}`,
  }))

  return (
    <div class='grid grid-cols-[min-content_1fr] grid-rows-[min-content_min-content]'>
      {/* Y axis: maxY (top left), minY (middle left) */}
      <div class='flex flex-col items-end'>
        {/* Max Y */}
        <div class='flex items-center justify-center whitespace-nowrap'>
          <Show
            when={typeof props.y?.onMaxChange === 'function'}
            fallback={
              <div class='text-sm pr-1 text-gray-500'>
                {yMax()}
                {yAxis().unit}
              </div>
            }
          >
            <input
              type='number'
              min={yMin()}
              value={yMax()}
              onInput={handleYMaxInput}
              class='w-16 px-1 py-0.5 rounded border border-gray-300 text-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500 invalid:ring-2 invalid:!ring-red-500'
            />
          </Show>
        </div>

        {/* Label for Y */}
        <div
          class='flex flex-1 items-end justify-center pr-1'
          style={{ 'writing-mode': 'sideways-lr' }}
        >
          {() => {
            const label = props.y?.label ?? ''
            const unit = yAxis().unit
            return label && unit
              ? `${label}, ${unit}`
              : label || unit
                ? `${label}${unit}`
                : ''
          }}
        </div>

        {/* Min Y */}
        <div class='flex items-center justify-center whitespace-nowrap'>
          <Show
            when={typeof props.y?.onMinChange === 'function'}
            fallback={
              <div class='text-sm pr-1 text-gray-500'>
                {yMin()}
                {yAxis().unit}
              </div>
            }
          >
            <input
              type='number'
              max={yMax()}
              value={yMin()}
              onInput={handleYMinInput}
              class='w-16 px-1 py-0.5 rounded border border-gray-300 text-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500 invalid:ring-2 invalid:!ring-red-500'
            />
          </Show>
        </div>
      </div>

      {/* Curves area: spans top two rows, center/right columns */}
      <div class='flex items-center justify-center h-72'>
        <Curves {...props} x={xAxis()} y={yAxis()} />
      </div>

      {/* Empty cell for grid alignment */}
      <div />

      {/* X axis: minX (bottom center), maxX (bottom right) */}
      <div class='flex'>
        {/* Min X */}
        <div class='flex items-center whitespace-nowrap'>
          <Show
            when={typeof props.x?.onMinChange === 'function'}
            fallback={
              <div class='text-sm text-gray-500'>
                {xMin()}
                {xAxis().unit}
              </div>
            }
          >
            <input
              type='number'
              min={0}
              max={xMax()}
              value={xMin()}
              onInput={handleXMinInput}
              class='w-16 px-1 py-0.5 rounded border border-gray-300 text-md text-left focus:outline-none focus:ring-2 focus:ring-blue-500 invalid:ring-2 invalid:!ring-red-500'
            />
          </Show>
        </div>

        {/* Label for X */}
        <div class='flex flex-1 items-start justify-center'>
          {() => {
            const label = props.x?.label ?? ''
            const unit = xAxis().unit
            return label && unit
              ? `${label}, ${unit}`
              : label || unit
                ? `${label}${unit}`
                : ''
          }}
        </div>

        {/* Max X */}
        <div class='flex items-center'>
          <Show
            when={typeof props.x?.onMaxChange === 'function'}
            fallback={
              <div class='text-sm text-gray-500'>
                {xMax()}
                {xAxis().unit}
              </div>
            }
          >
            <input
              type='number'
              min={xMin()}
              value={xMax()}
              onInput={handleXMaxInput}
              class='w-16 px-1 py-0.5 rounded border border-gray-300 text-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500 invalid:ring-2 invalid:!ring-red-500'
            />
          </Show>
        </div>
      </div>
    </div>
  )
}
