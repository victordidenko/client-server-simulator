import { createSignal, onCleanup } from 'solid-js'

/**
 * RangeSlider: Elegant, minimal slider for selecting a range (low/high).
 * Props:
 * - min: number (required)
 * - max: number (required)
 * - low: number (required, controlled)
 * - high: number (required, controlled)
 * - onInput: function({low, high}) (called immediately as values change)
 * - onChange: function({low, high}) (called only after drag ends)
 * - step: number (optional, default 1)
 * - class: string (optional)
 */
export function RangeSlider(props) {
  const min = () => props.min ?? 0
  const max = () => props.max ?? 100
  const step = () => props.step ?? 1

  // Clamp values
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max)
  }

  // Controlled values
  const low = () => clamp(props.low, min(), max())
  const high = () => clamp(props.high, min(), max())

  // Which handle is being dragged? 'low' or 'high' or null
  const [dragging, setDragging] = createSignal(null)
  let sliderRef

  // Get percent positions for handles
  function percent(val) {
    return ((val - min()) / (max() - min())) * 100
  }

  function handlePointerDown(which, e) {
    setDragging(which)
    updateValueFromPointer(which, e)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    e.preventDefault()
    e.stopPropagation()
  }

  function handlePointerMove(e) {
    if (dragging()) {
      updateValueFromPointer(dragging(), e)
    }
  }

  function handlePointerUp(e) {
    if (!sliderRef) return
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    // Call onChange only after drag ends
    const rect = sliderRef.getBoundingClientRect()
    let x =
      e?.clientX !== undefined
        ? e.clientX - rect.left
        : (((dragging() === 'low' ? low() : high()) - min()) /
            (max() - min())) *
          rect.width
    x = Math.max(0, Math.min(x, rect.width))
    const ratio = x / rect.width
    let newValue = min() + ratio * (max() - min())
    newValue = Math.round(newValue / step()) * step()
    newValue = clamp(newValue, min(), max())

    // Swap handles if crossing
    let newLow, newHigh
    if (dragging() === 'low') {
      if (newValue > high()) {
        newLow = high()
        newHigh = newValue
        setDragging('high')
      } else {
        newLow = newValue
        newHigh = high()
      }
    } else if (dragging() === 'high') {
      if (newValue < low()) {
        newLow = newValue
        newHigh = low()
        setDragging('low')
      } else {
        newLow = low()
        newHigh = newValue
      }
    }
    props.onChange?.({ low: newLow, high: newHigh })
    setDragging(null)
  }

  function updateValueFromPointer(which, e) {
    if (!sliderRef) return
    const rect = sliderRef.getBoundingClientRect()
    let x = e.clientX - rect.left
    x = Math.max(0, Math.min(x, rect.width))
    const ratio = x / rect.width
    let newValue = min() + ratio * (max() - min())
    newValue = Math.round(newValue / step()) * step()
    newValue = clamp(newValue, min(), max())

    // Swap handles if crossing
    let newLow,
      newHigh,
      newWhich = which
    if (which === 'low') {
      if (newValue > high()) {
        newLow = high()
        newHigh = newValue
        newWhich = 'high'
      } else {
        newLow = newValue
        newHigh = high()
      }
    } else if (which === 'high') {
      if (newValue < low()) {
        newLow = newValue
        newHigh = low()
        newWhich = 'low'
      } else {
        newLow = low()
        newHigh = newValue
      }
    }
    setDragging(newWhich)
    if (newLow !== props.low || newHigh !== props.high) {
      props.onInput?.({ low: newLow, high: newHigh })
    }
  }

  // Clean up listeners if component unmounts during drag
  onCleanup(() => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
  })

  return (
    <div class={`flex items-center gap-2 select-none ${props.class ?? ''}`}>
      <span class='text-xs text-gray-500 w-8 text-right'>{min()}</span>
      <div
        ref={sliderRef}
        class='relative flex-1 h-6'
        style={{ minWidth: '80px' }}
      >
        {/* Slider line */}
        <div
          class='absolute top-1/2 left-0 w-full h-0.5 bg-gray-300 rounded'
          style={{ transform: 'translateY(-50%)' }}
        />
        {/* Range highlight */}
        <div
          class='absolute top-1/2 h-1 bg-blue-200 rounded'
          style={{
            left: `calc(${percent(Math.min(low(), high()))}% )`,
            width: `calc(${Math.abs(percent(high()) - percent(low()))}% )`,
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        />
        {/* Low handle */}
        <div
          class='absolute cursor-pointer'
          style={{
            left: `calc(${percent(low())}% - 8px)`,
            top: 'calc(50% + 3px)',
            transition: dragging() === 'low' ? 'none' : 'left 0.1s',
            zIndex: dragging() === 'low' ? 2 : 1,
          }}
          onPointerDown={(e) => handlePointerDown('low', e)}
        >
          <svg width='16' height='10' viewBox='0 0 16 10'>
            <title>&uarr;</title>
            <polygon
              points='8,0 16,10 0,10'
              fill={dragging() === 'low' ? '#2563eb' : '#666'}
              stroke='#ccc'
              strokeWidth='1'
            />
          </svg>
        </div>
        {/* High handle */}
        <div
          class='absolute cursor-pointer'
          style={{
            left: `calc(${percent(high())}% - 8px)`,
            top: 'calc(50% + 3px)',
            transition: dragging() === 'high' ? 'none' : 'left 0.1s',
            zIndex: dragging() === 'high' ? 2 : 1,
          }}
          onPointerDown={(e) => handlePointerDown('high', e)}
        >
          <svg width='16' height='10' viewBox='0 0 16 10'>
            <title>&uarr;</title>
            <polygon
              points='8,0 16,10 0,10'
              fill={dragging() === 'high' ? '#2563eb' : '#666'}
              stroke='#ccc'
              strokeWidth='1'
            />
          </svg>
        </div>
      </div>
      <span class='text-xs text-gray-500 w-8'>{max()}</span>
    </div>
  )
}
