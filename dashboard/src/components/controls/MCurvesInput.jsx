import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { MCurves } from './MCurves'

// Same colors as MCurves component
const curveColors = [
  '#2563eb', // blue
  '#059669', // green
  '#eab308', // yellow
  '#db2777', // pink
  '#f97316', // orange
  '#64748b', // slate
]

/**
 * MCurvesInput: Multi-curve editor with axis min/max controls.
 * Props:
 * - curves: Array of Array<{x, y, type}> control points
 * - onChange: function(newCurves) called when curves change
 * - x: Single axis config OR Array of axis configs per curve
 *      { min, max, label?, unit?, onMinChange?, onMaxChange? }
 * - y: Single axis config OR Array of axis configs per curve
 *      { min, max, label?, unit?, onMinChange?, onMaxChange? }
 */
export function MCurvesInput(props) {
  // Normalize axis configs to arrays
  const xConfigs = createMemo(() =>
    Array.isArray(props.x) ? props.x : [props.x || { min: 0, max: 1 }]
  )
  const yConfigs = createMemo(() =>
    Array.isArray(props.y) ? props.y : [props.y || { min: 0, max: 1 }]
  )

  // Create reactive min/max values for each curve
  const xValues = createMemo(() =>
    xConfigs().map((config) => ({
      min: createSignal(config?.min ?? 0),
      max: createSignal(config?.max ?? 1),
    }))
  )
  const yValues = createMemo(() =>
    yConfigs().map((config) => ({
      min: createSignal(config?.min ?? 0),
      max: createSignal(config?.max ?? 1),
    }))
  )

  // Sync with prop changes
  createEffect(() => {
    xConfigs().forEach((config, i) => {
      const values = xValues()[i]
      if (config?.min !== undefined) values?.min[1](config.min)
      if (config?.max !== undefined) values?.max[1](config.max)
    })
  })

  createEffect(() => {
    yConfigs().forEach((config, i) => {
      const values = yValues()[i]
      if (config?.min !== undefined) values?.min[1](config.min)
      if (config?.max !== undefined) values?.max[1](config.max)
    })
  })

  // Create axis configs for MCurves
  const mcurvesXAxis = createMemo(() =>
    xValues().map((values, i) => ({
      min: values.min[0](),
      max: values.max[0](),
      label: xConfigs()[i]?.label ?? '',
      unit: xConfigs()[i]?.unit ?? '',
      discrete: xConfigs()[i]?.discrete,
      stepped: xConfigs()[i]?.stepped,
    }))
  )

  const mcurvesYAxis = createMemo(() =>
    yValues().map((values, i) => ({
      min: values.min[0](),
      max: values.max[0](),
      label: yConfigs()[i]?.label ?? '',
      unit: yConfigs()[i]?.unit ?? '',
      discrete: yConfigs()[i]?.discrete,
      stepped: yConfigs()[i]?.stepped,
    }))
  )

  // Input change handlers
  function handleXMinChange(curveIdx, value) {
    const values = xValues()[curveIdx]
    const maxVal = values.max[0]()
    const clampedVal = Math.min(value, maxVal)
    values.min[1](clampedVal)
    xConfigs()[curveIdx]?.onMinChange?.(clampedVal)
  }

  function handleXMaxChange(curveIdx, value) {
    const values = xValues()[curveIdx]
    const minVal = values.min[0]()
    const clampedVal = Math.max(value, minVal)
    values.max[1](clampedVal)
    xConfigs()[curveIdx]?.onMaxChange?.(clampedVal)
  }

  function handleYMinChange(curveIdx, value) {
    const values = yValues()[curveIdx]
    const maxVal = values.max[0]()
    const clampedVal = Math.min(value, maxVal)
    values.min[1](clampedVal)
    yConfigs()[curveIdx]?.onMinChange?.(clampedVal)
  }

  function handleYMaxChange(curveIdx, value) {
    const values = yValues()[curveIdx]
    const minVal = values.min[0]()
    const clampedVal = Math.max(value, minVal)
    values.max[1](clampedVal)
    yConfigs()[curveIdx]?.onMaxChange?.(clampedVal)
  }

  return (
    <div class='w-full h-full grid grid-cols-[auto_1fr] grid-rows-[1fr_auto]'>
      {/* Y-axis controls (left side) */}
      <div class='flex flex-col items-end justify-between text-md'>
        {/* Y-max values */}
        <div class='flex flex-col items-end'>
          <For each={yConfigs()}>
            {(config, i) => {
              const color = curveColors[i() % curveColors.length]
              const ycolor = yConfigs().length <= 1 ? 'black' : color
              const values = yValues()[i()]
              return (
                <ValueInput
                  value={values?.max[0]()}
                  unit={config?.unit || ''}
                  onChange={
                    config?.onMaxChange ? (v) => handleYMaxChange(i(), v) : null
                  }
                  color={ycolor}
                  align='right'
                />
              )
            }}
          </For>
        </div>

        {/* Y-axis labels (rotated) */}
        <div
          class='flex flex-col justify-center items-center flex-1 pr-1'
          style={{
            'writing-mode': 'sideways-lr',
            'text-orientation': 'mixed',
          }}
        >
          <For each={yConfigs()}>
            {(config, i) => {
              const color = curveColors[i() % curveColors.length]
              const ycolor = yConfigs().length <= 1 ? 'black' : color
              return <AxisLabel config={config} color={ycolor} />
            }}
          </For>
        </div>

        {/* Y-min values */}
        <div class='flex flex-col items-end'>
          <For each={yConfigs()}>
            {(config, i) => {
              const color = curveColors[i() % curveColors.length]
              const ycolor = yConfigs().length <= 1 ? 'black' : color
              const values = yValues()[i()]
              return (
                <ValueInput
                  value={values?.min[0]()}
                  unit={config?.unit || ''}
                  onChange={
                    config?.onMinChange ? (v) => handleYMinChange(i(), v) : null
                  }
                  color={ycolor}
                  align='right'
                />
              )
            }}
          </For>
        </div>
      </div>

      {/* MCurves area - fills remaining space */}
      <div class='min-h-0 min-w-0'>
        <MCurves
          {...props}
          // curves={props.curves}
          // onChange={props.onChange}
          x={mcurvesXAxis()}
          y={mcurvesYAxis()}
        />
      </div>

      {/* Empty cell */}
      <div />

      {/* X-axis controls (bottom) */}
      <div class='flex flex-row justify-between text-md'>
        {/* X-min values */}
        <div class='flex flex-col items-start'>
          <For each={xConfigs()}>
            {(config, i) => {
              const color = curveColors[i() % curveColors.length]
              const xcolor = xConfigs().length <= 1 ? 'black' : color
              const values = xValues()[i()]
              return (
                <ValueInput
                  value={values?.min[0]()}
                  unit={config?.unit || ''}
                  onChange={
                    config?.onMinChange ? (v) => handleXMinChange(i(), v) : null
                  }
                  color={xcolor}
                  align='left'
                />
              )
            }}
          </For>
        </div>

        {/* X-axis labels */}
        <div class='flex flex-col justify-center items-center'>
          <For each={xConfigs()}>
            {(config, i) => {
              const color = curveColors[i() % curveColors.length]
              const xcolor = xConfigs().length <= 1 ? 'black' : color
              return <AxisLabel config={config} color={xcolor} />
            }}
          </For>
        </div>

        {/* X-max values */}
        <div class='flex flex-col items-end'>
          <For each={xConfigs()}>
            {(config, i) => {
              const color = curveColors[i() % curveColors.length]
              const xcolor = xConfigs().length <= 1 ? 'black' : color
              const values = xValues()[i()]
              return (
                <ValueInput
                  value={values?.max[0]()}
                  unit={config?.unit || ''}
                  onChange={
                    config?.onMaxChange ? (v) => handleXMaxChange(i(), v) : null
                  }
                  color={xcolor}
                  align='right'
                />
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

// Reusable label component
function AxisLabel(props) {
  const text = () => {
    const label = props.config?.label ?? ''
    const unit = props.config?.unit ?? ''
    return label && unit ? `${label}, ${unit}` : `${label}${unit}`
  }

  return (
    <Show when={text}>
      <div class='whitespace-nowrap' style={{ color: props.color }}>
        {text}
      </div>
    </Show>
  )
}

// Reusable input/display component
function ValueInput(props) {
  return (
    <Show
      when={props.onChange}
      fallback={
        <div class='px-1' style={{ color: props.color + '80' }}>
          {props.value}
          {props.unit}
        </div>
      }
    >
      <input
        type='number'
        value={props.value}
        onInput={(e) => props.onChange(Number(e.target.value))}
        class='w-16 px-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 invalid:ring-2 invalid:!ring-red-500'
        style={{
          // 'border-color': props.color + '40',
          'color': props.color,
          'border-color': props.color,
          'text-align': props.align || 'center',
        }}
      />
    </Show>
  )
}
