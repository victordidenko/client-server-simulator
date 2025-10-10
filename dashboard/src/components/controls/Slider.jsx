import { createSignal, onCleanup } from 'solid-js'

/**
 * Elegant, minimal slider for number input.
 * Props:
 * - min: number (required)
 * - max: number (required)
 * - value: number (required, controlled)
 * - onInput: function(newValue) (called immediately as value changes)
 * - onChange: function(newValue) (called only after drag ends)
 * - step: number (optional, default 1)
 * - class: string (optional)
 */
export function Slider(props) {
  const min = () => props.min ?? 0
  const max = () => props.max ?? 100
  const step = () => props.step ?? 1
  const value = () => clamp(props.value, min(), max())
  const [dragging, setDragging] = createSignal(false)
  let sliderRef

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max)
  }

  function percent() {
    return ((value() - min()) / (max() - min())) * 100
  }

  function handlePointerDown(e) {
    setDragging(true)
    updateValueFromPointer(e)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function handlePointerMove(e) {
    if (dragging()) {
      updateValueFromPointer(e)
    }
  }

  function handlePointerUp(e) {
    setDragging(false)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    // Call onChange only after drag ends
    if (!sliderRef) return
    const rect = sliderRef.getBoundingClientRect()
    let x =
      e?.clientX !== undefined
        ? e.clientX - rect.left
        : ((value() - min()) / (max() - min())) * rect.width
    x = Math.max(0, Math.min(x, rect.width))
    const ratio = x / rect.width
    let newValue = min() + ratio * (max() - min())
    newValue = Math.round(newValue / step()) * step()
    newValue = clamp(newValue, min(), max())
    props.onChange?.(newValue)
  }

  function updateValueFromPointer(e) {
    if (!sliderRef) return
    const rect = sliderRef.getBoundingClientRect()
    let x = e.clientX - rect.left
    x = Math.max(0, Math.min(x, rect.width))
    const ratio = x / rect.width
    let newValue = min() + ratio * (max() - min())
    // Snap to step
    newValue = Math.round(newValue / step()) * step()
    newValue = clamp(newValue, min(), max())
    if (newValue !== value()) {
      props.onInput?.(newValue)
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
        onPointerDown={handlePointerDown}
      >
        {/* Slider line */}
        <div
          class='absolute top-1/2 left-0 w-full h-0.5 bg-gray-300 rounded'
          style={{ transform: 'translateY(-50%)' }}
        />
        {/* Arrow handle */}
        <div
          class='absolute'
          style={{
            left: `calc(${percent()}% - 8px)`,
            top: 'calc(50% + 3px)',
            transition: dragging() ? 'none' : 'left 0.1s',
            pointerEvents: 'none',
          }}
        >
          <svg width='16' height='10' viewBox='0 0 16 10'>
            <title>&uarr;</title>
            <polygon
              points='8,0 16,10 0,10'
              fill={dragging() ? '#2563eb' : '#666'}
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
