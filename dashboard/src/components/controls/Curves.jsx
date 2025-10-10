import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
  untrack,
} from 'solid-js'

const defaultPoints = [
  { x: 0, y: 0, type: 'curve' },
  { x: 1, y: 1, type: 'curve' },
]

function normalizePoints(pts) {
  if (!Array.isArray(pts) || pts.length < 2) {
    return [defaultPoints, true]
  }

  let changed = false

  const newPts = pts.map((pt) => {
    if (pt.type == null) changed = true
    return {
      ...pt,
      type: pt.type || 'curve', // preserve break, default to curve if missing
    }
  })

  if (newPts.length >= 2) {
    if (newPts[0].x !== 0) {
      newPts[0] = { ...newPts[0], x: 0 }
      changed = true
    }
    if (newPts[newPts.length - 1].x !== 1) {
      newPts[newPts.length - 1] = { ...newPts[newPts.length - 1], x: 1 }
      changed = true
    }
  }

  return [newPts, changed]
}

/**
 * Curves: SVG-based curve editor inspired by Photoshop.
 * Props:
 * - points: Array of {x, y} control points (normalized 0-1, sorted by x)
 * - onChange: function(newPoints) called when points change
 * - width, height, class: optional
 */
export function Curves(props) {
  const radius = 6
  const padding = 2

  function safeEmit(points) {
    const [normalized] = normalizePoints(points)
    props.onChange?.(normalized)
  }

  // Axis scaling for tooltip (object format, reactive)
  const xAxis = createMemo(() => {
    const x = props.x
    return typeof x === 'object' && x !== null
      ? {
          min: typeof x.min === 'number' ? x.min : 0,
          max: typeof x.max === 'number' ? x.max : 1,
          format:
            typeof x.format === 'function' ? x.format : (v) => v.toFixed(2),
        }
      : { min: 0, max: 1, format: (v) => v.toFixed(2) }
  })

  const yAxis = createMemo(() => {
    const y = props.y
    return typeof y === 'object' && y !== null
      ? {
          min: typeof y.min === 'number' ? y.min : 0,
          max: typeof y.max === 'number' ? y.max : 1,
          format:
            typeof y.format === 'function' ? y.format : (v) => v.toFixed(2),
        }
      : { min: 0, max: 1, format: (v) => v.toFixed(2) }
  })

  const [size, setSize] = createSignal({ width: 320, height: 180 })
  let resizeObserver = null
  let svgRef = null

  // Internal points signal, always synced with props.points
  const [points, setPoints] = createSignal(defaultPoints)
  const [dragging, setDragging] = createSignal(null)
  const [tooltip, setTooltip] = createSignal(null)
  let tooltipRef = null

  // Responsive: measure parent/container size
  onMount(() => {
    function updateSize() {
      if (svgRef) {
        const rect = svgRef.getBoundingClientRect()
        setSize({ width: rect.width, height: rect.height })
      }
    }
    resizeObserver = new window.ResizeObserver(updateSize)
    if (svgRef) resizeObserver.observe(svgRef)
    updateSize()
    window.addEventListener('resize', updateSize)
    onCleanup(() => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateSize)
    })
  })

  // Sync internal points with props.points, normalize edges, avoid infinite loop
  createEffect(() => {
    const [normalized, changed] = normalizePoints(props.points)
    const slocal = JSON.stringify(untrack(() => points()))
    const snormalized = JSON.stringify(normalized)

    // Handle collapsed x axis: only keep edge points, synchronize y
    if (xAxis().min === xAxis().max && normalized.length >= 2) {
      const yVal = normalized[0].y
      const edgePoints = [
        { x: 0, y: yVal, type: 'curve' },
        { x: 1, y: yVal, type: 'curve' },
      ]
      const sedge = JSON.stringify(edgePoints)
      if (slocal !== sedge || snormalized !== sedge) {
        setPoints(edgePoints)
        safeEmit(edgePoints)
      }
      return
    }

    // Only update if different
    if (slocal !== snormalized) {
      setPoints(normalized)
    }
    // Only call onChange if normalization changed the array
    if (changed) {
      safeEmit(normalized)
    }
  })

  // Convert normalized points to SVG coordinates, with padding
  function toSvg({ x, y }) {
    const { width, height } = size()
    return {
      x: padding + x * (width - 2 * padding),
      y: height - padding - y * (height - 2 * padding),
    }
  }

  // Convert SVG coordinates to normalized, with padding
  function fromSvg({ x, y }) {
    const { width, height } = size()
    return {
      x: Math.min(1, Math.max(0, (x - padding) / (width - 2 * padding))),
      y: Math.min(
        1,
        Math.max(0, (height - y - padding) / (height - 2 * padding))
      ),
    }
  }

  function handlePointerDown(idx, e) {
    setDragging(idx)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    e.preventDefault()
    e.stopPropagation()
    const rect = svgRef?.getBoundingClientRect?.() ?? { left: 0, top: 0 }
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    let pt
    if (idx === 0) {
      pt = {
        x: 0,
        y: Math.min(1, Math.max(0, (size().height - svgY) / size().height)),
      }
    } else if (idx === points().length - 1) {
      pt = {
        x: 1,
        y: Math.min(1, Math.max(0, (size().height - svgY) / size().height)),
      }
    } else {
      pt = fromSvg({ x: svgX, y: svgY })
    }
    setTooltip({
      x: pt.x,
      y: pt.y,
      clientX: e.clientX,
      clientY: e.clientY,
    })
  }

  function handlePointerMove(e) {
    const idx = dragging()
    if (idx == null) return
    if (!svgRef) return
    const rect = svgRef.getBoundingClientRect()
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    const pts = points()
    let newPt
    if (xAxis().min === xAxis().max && (idx === 0 || idx === pts.length - 1)) {
      // Collapsed axis: synchronize both edge points by y
      const yVal = Math.min(
        1,
        Math.max(0, (size().height - svgY) / size().height)
      )
      const newPoints = [
        { ...pts[0], x: 0, y: yVal, type: 'curve' },
        { ...pts[pts.length - 1], x: 1, y: yVal, type: 'curve' },
      ]
      safeEmit(newPoints)
      setTooltip({
        x: idx === 0 ? 0 : 1,
        y: yVal,
        clientX: e.clientX,
        clientY: e.clientY,
      })
      return
    }
    if (idx === 0) {
      newPt = {
        ...pts[idx],
        x: 0,
        y: Math.min(1, Math.max(0, (size().height - svgY) / size().height)),
      }
    } else if (idx === pts.length - 1) {
      newPt = {
        ...pts[idx],
        x: 1,
        y: Math.min(1, Math.max(0, (size().height - svgY) / size().height)),
      }
    } else {
      newPt = {
        ...pts[idx],
        ...fromSvg({ x: svgX, y: svgY }),
      }
      const minX = pts[idx - 1].x + 0.01
      const maxX = pts[idx + 1].x - 0.01
      newPt.x = Math.max(minX, Math.min(maxX, newPt.x))
      newPt.y = Math.max(0, Math.min(1, newPt.y))
    }
    const newPoints = pts.map((pt, i) => (i === idx ? newPt : pt))
    // Only call onChange, let parent update points via props
    safeEmit(newPoints)
    setTooltip({
      x: newPt.x,
      y: newPt.y,
      clientX: e.clientX,
      clientY: e.clientY,
    })
  }

  function handlePointerUp() {
    setDragging(null)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    setTooltip(null)
  }

  onCleanup(() => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    resizeObserver?.disconnect()
  })

  // Mixed path: break points are sharp, curve points are smooth
  function mixedPath(pts, toSvg) {
    if (pts.length < 2) return ''
    let d = `M ${toSvg(pts[0]).x},${toSvg(pts[0]).y}`
    for (let i = 1; i < pts.length; ++i) {
      const prev = pts[i - 1]
      const curr = pts[i]
      // If either endpoint is a break, draw a straight line
      if (prev.type === 'break' || curr.type === 'break') {
        d += ` L ${toSvg(curr).x},${toSvg(curr).y}`
      } else {
        // Both are curve points, use monotonic cubic interpolation for this segment
        // Calculate tangent for prev and curr
        const dx = curr.x - prev.x
        // Estimate tangents for monotonic cubic (Fritsch-Carlson)
        // Use neighbors if available, else fallback to secant
        let mPrev = 0,
          mCurr = 0
        if (i - 2 >= 0) {
          mPrev = (curr.y - pts[i - 2].y) / (curr.x - pts[i - 2].x)
        } else {
          mPrev = (curr.y - prev.y) / (curr.x - prev.x)
        }
        if (i + 1 < pts.length) {
          mCurr = (pts[i + 1].y - prev.y) / (pts[i + 1].x - prev.x)
        } else {
          mCurr = (curr.y - prev.y) / (curr.x - prev.x)
        }
        // Clamp tangents for monotonicity
        if (Math.sign(mPrev) !== Math.sign(curr.y - prev.y)) mPrev = 0
        if (Math.sign(mCurr) !== Math.sign(curr.y - prev.y)) mCurr = 0
        const cp1 = {
          x: prev.x + dx / 3,
          y: Math.max(0, Math.min(1, prev.y + (mPrev * dx) / 3)),
        }
        const cp2 = {
          x: curr.x - dx / 3,
          y: Math.max(0, Math.min(1, curr.y - (mCurr * dx) / 3)),
        }
        d += ` C ${toSvg(cp1).x},${toSvg(cp1).y} ${toSvg(cp2).x},${toSvg(cp2).y} ${toSvg(curr).x},${toSvg(curr).y}`
      }
    }
    return d
  }

  function filledAreaPath(pts, toSvg) {
    if (pts.length < 2) return ''
    let d = mixedPath(pts, toSvg)
    // Go to last point's x, bottom edge
    const last = pts[pts.length - 1]
    const first = pts[0]
    d += ` L ${toSvg({ x: last.x, y: 0 }).x},${toSvg({ x: last.x, y: 0 }).y}`
    d += ` L ${toSvg({ x: first.x, y: 0 }).x},${toSvg({ x: first.x, y: 0 }).y}`
    d += ' Z'
    return d
  }

  // Double-click on SVG: add point as curve
  function handleSvgDoubleClick(e) {
    // Ignore double-clicks on points (handled separately)
    if (e.target.tagName === 'circle' || e.target.tagName === 'polygon') return
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    const newPt = { ...fromSvg({ x: svgX, y: svgY }), type: 'curve' }
    // Find segment to insert into (closest by x)
    const pts = points()
    let insertIdx = 1
    for (let i = 1; i < pts.length; ++i) {
      if (newPt.x < pts[i].x) {
        insertIdx = i
        break
      }
    }
    // Clamp x between neighbors
    const minX = pts[insertIdx - 1].x + 0.01
    const maxX = pts[insertIdx].x - 0.01
    newPt.x = Math.max(minX, Math.min(maxX, newPt.x))
    newPt.y = Math.max(0, Math.min(1, newPt.y))
    const newPoints = [
      ...pts.slice(0, insertIdx),
      newPt,
      ...pts.slice(insertIdx),
    ]
    safeEmit(newPoints)
  }

  // Double-click on point: toggle curve/break or remove
  function handlePointDoubleClick(idx, e) {
    if (idx === 0 || idx === points().length - 1) return
    const pts = points()
    const pt = pts[idx]
    let newPoints
    if (pt.type === 'curve') {
      // Convert to break
      newPoints = pts.map((p, i) => (i === idx ? { ...p, type: 'break' } : p))
    } else if (pt.type === 'break') {
      // Remove break point
      newPoints = pts.filter((_, i) => i !== idx)
    }
    safeEmit(newPoints)
    e.stopPropagation()
  }

  const { width, height } = size()
  return (
    <div class='w-full h-full relative border border-gray-300'>
      <svg
        ref={(el) => {
          svgRef = el
        }}
        width={width}
        height={height}
        class='bg-white touch-none block w-full h-full'
        onDblClick={handleSvgDoubleClick}
      >
        <title>Curve Control Points</title>
        <path
          d={filledAreaPath(points(), toSvg)}
          fill='rgba(37,99,235,0.15)'
          stroke='none'
        />
        <path
          d={mixedPath(points(), toSvg)}
          stroke='#2563eb'
          stroke-width='2'
          fill='none'
        />
        {points().map((pt, idx) => {
          const { x, y } = toSvg(pt)
          if (idx === 0 || idx === points().length - 1) {
            // Draw square for edge points
            const half = radius - 1
            const pointsAttr = [
              [x - half, y - half],
              [x + half, y - half],
              [x + half, y + half],
              [x - half, y + half],
            ]
              .map(([px, py]) => `${px},${py}`)
              .join(' ')
            return (
              // biome-ignore lint:a11y/noStaticElementInteractions
              <polygon
                points={pointsAttr}
                fill={dragging() === idx ? 'red' : '#fff'}
                stroke='red'
                stroke-width='2'
                style={{
                  cursor: 'ns-resize',
                }}
                onPointerDown={(e) => handlePointerDown(idx, e)}
                onDblClick={(e) => handlePointDoubleClick(idx, e)}
              />
            )
          } else if (pt.type === 'break') {
            // Draw triangle for break point (pointing up)
            const h = radius * 1.2
            const w = radius
            const pointsAttr = [
              [x, y - h],
              [x + w, y + h * 0.5],
              [x - w, y + h * 0.5],
            ]
              .map(([px, py]) => `${px},${py}`)
              .join(' ')
            return (
              // biome-ignore lint:a11y/noStaticElementInteractions
              <polygon
                points={pointsAttr}
                fill={dragging() === idx ? 'red' : '#fff'}
                stroke='red'
                stroke-width='2'
                style={{
                  cursor: 'pointer',
                }}
                onPointerDown={(e) => handlePointerDown(idx, e)}
                onDblClick={(e) => handlePointDoubleClick(idx, e)}
              />
            )
          } else {
            // Draw circle for curve point
            return (
              // biome-ignore lint:a11y/noStaticElementInteractions
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={dragging() === idx ? 'red' : '#fff'}
                stroke='red'
                stroke-width='2'
                style={{
                  cursor: 'pointer',
                }}
                onPointerDown={(e) => handlePointerDown(idx, e)}
                onDblClick={(e) => handlePointDoubleClick(idx, e)}
              />
            )
          }
        })}
      </svg>
      <Show when={tooltip()}>
        <div
          ref={(el) => {
            tooltipRef = el
          }}
          className='fixed pointer-events-none bg-slate-800/95 text-white text-md rounded px-2 py-0.5 z-[1000] shadow-lg whitespace-nowrap'
          style={{
            left: (() => {
              const tip = tooltip()
              let left = tip.clientX + 12
              let tooltipWidth = 120
              if (tooltipRef?.offsetWidth) {
                tooltipWidth = tooltipRef.offsetWidth
              }
              if (left + tooltipWidth > window.innerWidth - 8) {
                left = tip.clientX - tooltipWidth - 12
              }
              return `${left}px`
            })(),
            top: `${tooltip().clientY - 8}px`,
          }}
        >
          {xAxis().format(
            xAxis().min + tooltip().x * (xAxis().max - xAxis().min)
          )}
          <br />
          {yAxis().format(
            yAxis().min + tooltip().y * (yAxis().max - yAxis().min)
          )}
        </div>
      </Show>
    </div>
  )
}
