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

// Normalize a single curve
function normalizePoints(pts) {
  if (!Array.isArray(pts) || pts.length < 2) {
    return [defaultPoints, true]
  }

  let changed = false

  const newPts = pts.map((pt) => {
    if (pt.type == null) changed = true
    return {
      ...pt,
      type: pt.type || 'curve',
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

// Normalize all curves, handling collapsed X dimensions
function normalizeCurves(curves) {
  let changed = false
  const newCurves = (Array.isArray(curves) ? curves : []).map((pts) => {
    const [norm, ch] = normalizePoints(pts)
    if (ch) changed = true
    return norm
  })
  if (newCurves.length === 0) {
    changed = true
    return [[...defaultPoints], changed]
  }
  return [newCurves, changed]
}

// Handle collapsed X dimension for a curve
function handleCollapsedCurve(pts, xConfig) {
  if (!xConfig || xConfig.min === xConfig.max) {
    // X dimension is collapsed - keep only edge points with same Y
    const firstPt = pts[0]
    const lastPt = pts[pts.length - 1]
    const avgY = (firstPt.y + lastPt.y) / 2

    return [
      { x: 0, y: avgY, type: 'curve' },
      { x: 1, y: avgY, type: 'curve' },
    ]
  }
  return pts
}

// Apply collapsed curve handling to all curves
function applyCollapsedCurveHandling(curves, xAxisConfigs) {
  return curves.map((pts, i) => {
    const xConfig = Array.isArray(xAxisConfigs)
      ? xAxisConfigs[Math.min(i, xAxisConfigs.length - 1)]
      : xAxisConfigs
    return handleCollapsedCurve(pts, xConfig)
  })
}

// Color palette for curves
const curveColors = [
  '#2563eb', // blue
  '#059669', // green
  '#eab308', // yellow
  '#db2777', // pink
  '#f97316', // orange
  '#64748b', // slate
]

/**
 * MCurves: SVG-based multi-curve editor.
 * Props:
 * - curves: Array of Array<{x, y, type}>
 * - onChange: function(newCurves) called when curves change
 * - x: axis configuration - single object or array of objects per curve
 *      { min: number, max: number, label?: string, unit?: string, discrete?: boolean, stepped?: boolean }
 * - y: axis configuration - single object or array of objects per curve
 *      { min: number, max: number, label?: string, unit?: string, discrete?: boolean, stepped?: boolean }
 * - constraints: Array of constraint objects
 *      { type: 'minmax', curves: [minCurveIndex, maxCurveIndex] }
 */
export function MCurves(props) {
  const radius = 6
  const padding = 2

  // Emit normalized curves to parent
  function safeEmit(curves) {
    const [normalized] = normalizeCurves(curves)
    props.onChange?.(normalized)
  }

  // Get constraint info for a curve
  const getConstraintInfo = createMemo(() => {
    return (curveIdx) => {
      if (!props.constraints || !Array.isArray(props.constraints)) return null

      for (const constraint of props.constraints) {
        if (
          constraint.type === 'minmax' &&
          Array.isArray(constraint.curves) &&
          constraint.curves.includes(curveIdx)
        ) {
          const [minIdx, maxIdx] = constraint.curves
          return {
            type: 'minmax',
            isMin: curveIdx === minIdx,
            isMax: curveIdx === maxIdx,
            pairedWith: curveIdx === minIdx ? maxIdx : minIdx,
          }
        }
      }
      return null
    }
  })

  // Utility: get effective axis index considering constraints
  function getEffectiveAxisIndex(curveIdx) {
    const constraintInfo = getConstraintInfo()(curveIdx)
    if (constraintInfo?.type === 'minmax') {
      // Always use the min curve's index for axis configs
      return constraintInfo.isMax ? constraintInfo.pairedWith : curveIdx
    }
    return curveIdx
  }

  // Memoized axis configurations for performance
  const getXAxisConfig = createMemo(() => {
    return (curveIdx = 0) => {
      curveIdx = getEffectiveAxisIndex(curveIdx)
      const axisProps = props.x
      if (Array.isArray(axisProps) && axisProps.length > 0) {
        // Use curve-specific config or fall back to last available config
        const config = axisProps[Math.min(curveIdx, axisProps.length - 1)]
        return {
          min: typeof config?.min === 'number' ? config.min : 0,
          max: typeof config?.max === 'number' ? config.max : 1,
          label: typeof config?.label === 'string' ? config.label : '',
          unit: typeof config?.unit === 'string' ? config.unit : '',
          discrete: Boolean(config?.discrete),
          stepped: Boolean(config?.stepped),
        }
      } else if (typeof axisProps === 'object' && axisProps !== null) {
        // Single axis config for all curves (backward compatibility)
        return {
          min: typeof axisProps.min === 'number' ? axisProps.min : 0,
          max: typeof axisProps.max === 'number' ? axisProps.max : 1,
          label: typeof axisProps.label === 'string' ? axisProps.label : '',
          unit: typeof axisProps.unit === 'string' ? axisProps.unit : '',
          discrete: Boolean(axisProps.discrete),
          stepped: Boolean(axisProps.stepped),
        }
      }
      // Default config
      return {
        min: 0,
        max: 1,
        label: '',
        unit: '',
        discrete: false,
        stepped: false,
      }
    }
  })

  const getYAxisConfig = createMemo(() => {
    return (curveIdx = 0) => {
      curveIdx = getEffectiveAxisIndex(curveIdx)
      const axisProps = props.y
      if (Array.isArray(axisProps) && axisProps.length > 0) {
        // Use curve-specific config or fall back to last available config
        const config = axisProps[Math.min(curveIdx, axisProps.length - 1)]
        return {
          min: typeof config?.min === 'number' ? config.min : 0,
          max: typeof config?.max === 'number' ? config.max : 1,
          label: typeof config?.label === 'string' ? config.label : '',
          unit: typeof config?.unit === 'string' ? config.unit : '',
          discrete: Boolean(config?.discrete),
          stepped: Boolean(config?.stepped),
        }
      } else if (typeof axisProps === 'object' && axisProps !== null) {
        // Single axis config for all curves (backward compatibility)
        return {
          min: typeof axisProps.min === 'number' ? axisProps.min : 0,
          max: typeof axisProps.max === 'number' ? axisProps.max : 1,
          label: typeof axisProps.label === 'string' ? axisProps.label : '',
          unit: typeof axisProps.unit === 'string' ? axisProps.unit : '',
          discrete: Boolean(axisProps.discrete),
          stepped: Boolean(axisProps.stepped),
        }
      }
      // Default config
      return {
        min: 0,
        max: 1,
        label: '',
        unit: '',
        discrete: false,
        stepped: false,
      }
    }
  })

  // Format value for display
  function formatValue(value, config) {
    const actualValue = config.min + value * (config.max - config.min)
    const displayValue = config.discrete ? Math.round(actualValue) : actualValue
    const formatted = config.discrete
      ? displayValue.toString()
      : displayValue.toFixed(2)

    if (config.unit) {
      return `${formatted}${config.unit}`
    }
    return formatted
  }

  const [size, setSize] = createSignal({ width: 320, height: 180 })
  const [curves, setCurves] = createSignal([[...defaultPoints]])
  const [dragging, setDragging] = createSignal(null)
  const [tooltip, setTooltip] = createSignal(null)

  // Refs
  let svgRef = null
  let tooltipRef = null
  let resizeObserver = null

  // Double-click detection
  let lastClickTime = 0
  let lastClickTarget = null

  // Responsive sizing
  onMount(() => {
    function updateSize() {
      if (svgRef) {
        const rect = svgRef.getBoundingClientRect()
        setSize({ width: rect.width, height: rect.height })
      }
    }

    resizeObserver = new ResizeObserver(updateSize)
    if (svgRef) resizeObserver.observe(svgRef)
    updateSize()

    window.addEventListener('resize', updateSize)
    onCleanup(() => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateSize)
    })
  })

  // Sync with props.curves and handle collapsed curves
  createEffect(() => {
    const [normalized, changed] = normalizeCurves(props.curves)

    // Apply collapsed curve handling
    const xAxisConfigs = props.x
    const processedCurves = applyCollapsedCurveHandling(
      normalized,
      xAxisConfigs
    )

    const current = JSON.stringify(untrack(() => curves()))
    const incoming = JSON.stringify(processedCurves)

    if (current !== incoming) {
      setCurves(processedCurves)
    }
    if (
      changed ||
      JSON.stringify(normalized) !== JSON.stringify(processedCurves)
    ) {
      safeEmit(processedCurves)
    }
  })

  // Coordinate conversion
  function toSvg({ x, y }) {
    const { width, height } = size()
    return {
      x: padding + x * (width - 2 * padding),
      y: height - padding - y * (height - 2 * padding),
    }
  }

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

  // Interpolate along the original curve (respecting point types)
  function interpolateOriginalCurve(pts, t) {
    if (pts.length < 2) return pts[0] || { x: 0, y: 0 }

    // Find the correct segment for parameter t (0-1)
    const segmentLength = 1 / (pts.length - 1)
    const segmentIndex = Math.min(Math.floor(t / segmentLength), pts.length - 2)
    const localT = (t - segmentIndex * segmentLength) / segmentLength

    return interpolateSegment(pts, segmentIndex, segmentIndex + 1, localT)
  }

  // Generate visual stepped path points following the original curve
  function generateVisualSteppedPoints(pts, _xConfig, yConfig) {
    if (pts.length < 2 || !yConfig.stepped || !yConfig.discrete) return pts

    const visualPoints = []

    // Sample the curve at high resolution to get smooth stepping
    const samples = 1000
    const samplePoints = []

    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      const point = interpolateOriginalCurve(pts, t)
      const actualY = yConfig.min + point.y * (yConfig.max - yConfig.min)
      const roundedY = Math.round(actualY)

      samplePoints.push({
        x: point.x,
        y: point.y,
        actualY,
        roundedY,
        t,
      })
    }

    if (samplePoints.length === 0) return pts

    // Start with first point
    visualPoints.push({ x: pts[0].x, y: pts[0].y, type: pts[0].type })

    let currentRoundedY = samplePoints[0].roundedY

    // Process each sample point
    for (let i = 1; i < samplePoints.length; i++) {
      const sample = samplePoints[i]

      if (sample.roundedY !== currentRoundedY) {
        // Rounded Y value changed - create a step

        // Add horizontal line to the X position where the change occurs
        const normalizedStepY =
          (currentRoundedY - yConfig.min) / (yConfig.max - yConfig.min)
        visualPoints.push({
          x: sample.x,
          y: Math.min(1, Math.max(0, normalizedStepY)),
          type: 'visual-step',
        })

        // Add vertical line to the new Y value
        const newNormalizedY =
          (sample.roundedY - yConfig.min) / (yConfig.max - yConfig.min)
        visualPoints.push({
          x: sample.x,
          y: Math.min(1, Math.max(0, newNormalizedY)),
          type: 'visual-step',
        })

        currentRoundedY = sample.roundedY
      }
    }

    // Add final point
    visualPoints.push({
      x: pts[pts.length - 1].x,
      y: pts[pts.length - 1].y,
      type: pts[pts.length - 1].type,
    })

    return visualPoints
  }

  // Path generation with visual stepped line support
  function mixedPath(pts, curveIdx) {
    if (pts.length < 2) return ''

    const xConfig = getXAxisConfig()(curveIdx)
    const yConfig = getYAxisConfig()(curveIdx)

    // Generate visual stepped points if needed (for rendering only)
    const renderPoints =
      yConfig.stepped && yConfig.discrete
        ? generateVisualSteppedPoints(pts, xConfig, yConfig)
        : pts

    let d = `M ${toSvg(renderPoints[0]).x},${toSvg(renderPoints[0]).y}`

    for (let i = 1; i < renderPoints.length; ++i) {
      const prev = renderPoints[i - 1]
      const curr = renderPoints[i]

      if (
        (yConfig.stepped && yConfig.discrete) ||
        prev.type === 'break' ||
        curr.type === 'break' ||
        curr.type === 'visual-step'
      ) {
        // Use straight lines for stepped or break points
        d += ` L ${toSvg(curr).x},${toSvg(curr).y}`
      } else {
        // Calculate control points for smooth curve
        const dx = curr.x - prev.x
        let mPrev = 0,
          mCurr = 0

        if (i - 2 >= 0 && renderPoints[i - 2].type !== 'visual-step') {
          mPrev =
            (curr.y - renderPoints[i - 2].y) / (curr.x - renderPoints[i - 2].x)
        } else {
          mPrev = (curr.y - prev.y) / (curr.x - prev.x)
        }

        if (
          i + 1 < renderPoints.length &&
          renderPoints[i + 1].type !== 'visual-step'
        ) {
          mCurr =
            (renderPoints[i + 1].y - prev.y) / (renderPoints[i + 1].x - prev.x)
        } else {
          mCurr = (curr.y - prev.y) / (curr.x - prev.x)
        }

        // Prevent overshooting
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

  function reversePath(path) {
    // Split path into commands with parameters
    const commands = path.match(/[a-zA-Z][^a-zA-Z]*/g)

    if (!commands) return path

    const segments = []
    let currentPoint = null

    // Parse the path
    commands.forEach((cmd) => {
      const type = cmd[0]
      const nums = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number)

      if (type === 'M') {
        currentPoint = [nums[0], nums[1]]
        segments.push({ type, points: [currentPoint] })
      } else if (type === 'L') {
        const p = [nums[0], nums[1]]
        segments.push({ type, points: [p] })
        currentPoint = p
      } else if (type === 'C') {
        const p1 = [nums[0], nums[1]]
        const p2 = [nums[2], nums[3]]
        const p = [nums[4], nums[5]]
        segments.push({ type, points: [p1, p2, p] })
        currentPoint = p
      }
    })

    // Reverse the path
    const reversed = []
    // const firstPoint = segments[0].points[0]
    const lastPoint = segments[segments.length - 1].points.slice(-1)[0]

    reversed.push(`M${lastPoint[0]},${lastPoint[1]}`)

    for (let i = segments.length - 1; i > 0; i--) {
      const seg = segments[i]
      if (seg.type === 'L') {
        reversed.push(`L${segments[i - 1].points.slice(-1)[0].join(',')}`)
      } else if (seg.type === 'C') {
        const p1 = seg.points[1] // second control point
        const p2 = seg.points[0] // first control point
        const p = segments[i - 1].points.slice(-1)[0]
        reversed.push(`C${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p[0]},${p[1]}`)
      }
    }

    return reversed.join(' ')
  }

  function filledAreaPath(pts, curveIdx) {
    if (pts.length < 2) return ''

    let d = mixedPath(pts, curveIdx)
    const last = pts[pts.length - 1]
    const first = pts[0]
    d += ` L ${toSvg({ x: last.x, y: 0 }).x},${toSvg({ x: last.x, y: 0 }).y}`
    d += ` L ${toSvg({ x: first.x, y: 0 }).x},${toSvg({ x: first.x, y: 0 }).y}`
    d += ' Z'
    return d
  }

  // Generate min-max filled area between two curves
  function minMaxAreaPath(minCurve, maxCurve, minIdx, maxIdx) {
    if (!minCurve || !maxCurve || minCurve.length < 2 || maxCurve.length < 2)
      return ''

    // Start with the min curve path
    let d = mixedPath(minCurve, minIdx)

    // Connect to the end of max curve
    const lastMaxPoint = maxCurve[maxCurve.length - 1]
    d += ` L ${toSvg(lastMaxPoint).x},${toSvg(lastMaxPoint).y}`

    // Continue with the max curve path in backward direction
    const d2 = reversePath(mixedPath(maxCurve, maxIdx))

    // Connect to the start of min curve
    const firstMinPoint = minCurve[0]
    d += d2 + ` L ${toSvg(firstMinPoint).x},${toSvg(firstMinPoint).y}`

    // Close the path
    d += ' Z'

    return d
  }

  // Hit testing for adding points on lines (aware of stepped visualization)
  function hitTestLine(svgX, svgY) {
    let minDist = Infinity
    let closest = null

    curves().forEach((pts, curveIdx) => {
      const xConfig = getXAxisConfig()(curveIdx)
      const yConfig = getYAxisConfig()(curveIdx)

      // Use visual points for hit testing if stepped
      const testPoints =
        yConfig.stepped && yConfig.discrete
          ? generateVisualSteppedPoints(pts, xConfig, yConfig)
          : pts

      for (let i = 1; i < testPoints.length; ++i) {
        // Sample along segment
        for (let t = 0; t <= 1; t += 0.05) {
          const ptOnCurve = interpolateSegment(testPoints, i - 1, i, t)
          const { x, y } = toSvg(ptOnCurve)
          const dist = Math.hypot(svgX - x, svgY - y)

          if (dist < minDist) {
            minDist = dist
            // Map back to original points for insertion
            if (testPoints === pts) {
              closest = { curveIdx, insertIdx: i }
            } else {
              // For stepped lines, find the appropriate insertion point in original curve
              // This is more complex - we need to find which original segment this visual segment belongs to
              let originalInsertIdx = 1
              for (let j = 0; j < pts.length - 1; j++) {
                const segmentStart = j
                const segmentEnd = j + 1
                if (
                  ptOnCurve.x >= pts[segmentStart].x &&
                  ptOnCurve.x <= pts[segmentEnd].x
                ) {
                  originalInsertIdx = segmentEnd
                  break
                }
              }
              closest = { curveIdx, insertIdx: originalInsertIdx }
            }
          }
        }
      }
    })

    return minDist <= radius * 2.5 ? closest : null
  }

  // Interpolate point along segment for hit testing
  function interpolateSegment(pts, idxA, idxB, t) {
    const prev = pts[idxA]
    const curr = pts[idxB]

    if (prev.type === 'break' || curr.type === 'break') {
      return {
        x: prev.x + (curr.x - prev.x) * t,
        y: prev.y + (curr.y - prev.y) * t,
      }
    }

    // Cubic Bezier interpolation (same logic as in mixedPath)
    const dx = curr.x - prev.x
    let mPrev = 0,
      mCurr = 0

    if (idxA - 1 >= 0) {
      mPrev = (curr.y - pts[idxA - 1].y) / (curr.x - pts[idxA - 1].x)
    } else {
      mPrev = (curr.y - prev.y) / (curr.x - prev.x)
    }

    if (idxB + 1 < pts.length) {
      mCurr = (pts[idxB + 1].y - prev.y) / (pts[idxB + 1].x - prev.x)
    } else {
      mCurr = (curr.y - prev.y) / (curr.x - prev.x)
    }

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

    // Cubic Bezier formula
    const bezier = (a, b, c, d, t) =>
      a * (1 - t) ** 3 +
      3 * b * (1 - t) ** 2 * t +
      3 * c * (1 - t) * t ** 2 +
      d * t ** 3

    return {
      x: bezier(prev.x, cp1.x, cp2.x, curr.x, t),
      y: bezier(prev.y, cp1.y, cp2.y, curr.y, t),
    }
  }

  // Event handlers
  function handleSvgDoubleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top

    const lineHit = hitTestLine(svgX, svgY)
    if (lineHit) {
      const curvesArr = curves()
      const pts = curvesArr[lineHit.curveIdx]
      const newPt = { ...fromSvg({ x: svgX, y: svgY }), type: 'curve' }
      const insertIdx = lineHit.insertIdx

      // Constrain x to be between adjacent points
      const minX = pts[insertIdx - 1].x + 0.01
      const maxX = pts[insertIdx].x - 0.01
      newPt.x = Math.max(minX, Math.min(maxX, newPt.x))
      newPt.y = Math.max(0, Math.min(1, newPt.y))

      const newCurves = curvesArr.map((c, idx) =>
        idx === lineHit.curveIdx
          ? [...c.slice(0, insertIdx), newPt, ...c.slice(insertIdx)]
          : c
      )
      safeEmit(newCurves)
    }
  }

  function handlePointDoubleClick(curveIdx, ptIdx) {
    const curvesArr = curves()
    const pts = curvesArr[curveIdx]

    // Don't allow modification of edge points
    if (ptIdx === 0 || ptIdx === pts.length - 1) {
      return
    }

    const pt = pts[ptIdx]
    let newPts

    if (pt.type === 'curve' || pt.type === undefined) {
      // Toggle to break
      newPts = pts.map((p, i) => (i === ptIdx ? { ...p, type: 'break' } : p))
    } else if (pt.type === 'break') {
      // Remove break point
      newPts = pts.filter((_, i) => i !== ptIdx)
    }

    if (newPts) {
      const newCurves = curvesArr.map((c, idx) =>
        idx === curveIdx ? newPts : c
      )
      safeEmit(newCurves)
    }
  }

  function handlePointerDown(curveIdx, ptIdx, e) {
    // Double-click detection
    const now = Date.now()
    const timeSinceLastClick = now - lastClickTime
    const targetId = `${curveIdx}-${ptIdx}`
    const isSameTarget = lastClickTarget === targetId

    if (timeSinceLastClick < 300 && isSameTarget) {
      handlePointDoubleClick(curveIdx, ptIdx)
      lastClickTime = 0
      lastClickTarget = null
      return
    }

    lastClickTime = now
    lastClickTarget = targetId

    setDragging({ curveIdx, ptIdx })
    e.preventDefault()
    e.stopPropagation()

    // Set initial tooltip
    const rect = svgRef.getBoundingClientRect()
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    const pts = curves()[curveIdx]

    let pt
    if (ptIdx === 0) {
      pt = {
        x: 0,
        y: Math.min(1, Math.max(0, (size().height - svgY) / size().height)),
      }
    } else if (ptIdx === pts.length - 1) {
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
      curveIdx,
      clientX: e.clientX,
      clientY: e.clientY,
    })

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function handlePointerMove(e) {
    const drag = dragging()
    if (!drag || !svgRef) return

    const { curveIdx, ptIdx } = drag
    const rect = svgRef.getBoundingClientRect()
    const svgX = e.clientX - rect.left
    const svgY = e.clientY - rect.top
    const curvesArr = curves()
    const pts = curvesArr[curveIdx]

    // Get axis configs for discrete handling
    const xConfig = getXAxisConfig()(curveIdx)
    const yConfig = getYAxisConfig()(curveIdx)
    const isCollapsed = xConfig.min === xConfig.max

    let newPt
    if (ptIdx === 0) {
      // First point: fixed x=0, variable y
      let normalizedY = Math.min(
        1,
        Math.max(0, (size().height - svgY) / size().height)
      )

      // Apply discrete constraint for Y axis
      if (yConfig.discrete) {
        const actualY = yConfig.min + normalizedY * (yConfig.max - yConfig.min)
        const discreteY = Math.round(actualY)
        normalizedY = (discreteY - yConfig.min) / (yConfig.max - yConfig.min)
        normalizedY = Math.min(1, Math.max(0, normalizedY))
      }

      newPt = { ...pts[ptIdx], x: 0, y: normalizedY }
    } else if (ptIdx === pts.length - 1) {
      // Last point: fixed x=1, variable y
      let normalizedY = Math.min(
        1,
        Math.max(0, (size().height - svgY) / size().height)
      )

      // Apply discrete constraint for Y axis
      if (yConfig.discrete) {
        const actualY = yConfig.min + normalizedY * (yConfig.max - yConfig.min)
        const discreteY = Math.round(actualY)
        normalizedY = (discreteY - yConfig.min) / (yConfig.max - yConfig.min)
        normalizedY = Math.min(1, Math.max(0, normalizedY))
      }

      newPt = { ...pts[ptIdx], x: 1, y: normalizedY }
    } else {
      // Middle points: constrained x between neighbors, variable y
      newPt = { ...pts[ptIdx], ...fromSvg({ x: svgX, y: svgY }) }

      // Apply discrete constraints
      if (xConfig.discrete) {
        const actualX = xConfig.min + newPt.x * (xConfig.max - xConfig.min)
        const discreteX = Math.round(actualX)
        newPt.x = (discreteX - xConfig.min) / (xConfig.max - xConfig.min)
      }

      if (yConfig.discrete) {
        const actualY = yConfig.min + newPt.y * (yConfig.max - yConfig.min)
        const discreteY = Math.round(actualY)
        newPt.y = (discreteY - yConfig.min) / (yConfig.max - yConfig.min)
      }

      // Constrain X between neighbors
      const minX = pts[ptIdx - 1].x + 0.01
      const maxX = pts[ptIdx + 1].x - 0.01
      newPt.x = Math.max(minX, Math.min(maxX, newPt.x))
      newPt.y = Math.max(0, Math.min(1, newPt.y))
    }

    let newPts = pts.map((pt, i) => (i === ptIdx ? newPt : pt))

    // Handle collapsed X dimension: sync edge points Y values
    if (isCollapsed && (ptIdx === 0 || ptIdx === pts.length - 1)) {
      newPts = newPts.map((pt, i) =>
        i === 0 || i === pts.length - 1 ? { ...pt, y: newPt.y } : pt
      )
    }

    const newCurves = curvesArr.map((c, idx) => (idx === curveIdx ? newPts : c))
    safeEmit(newCurves)

    setTooltip({
      x: newPt.x,
      y: newPt.y,
      curveIdx,
      clientX: e.clientX,
      clientY: e.clientY,
    })
  }

  function handlePointerUp() {
    setDragging(null)
    setTooltip(null)
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
  }

  onCleanup(() => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    resizeObserver?.disconnect()
  })

  const { width, height } = size()

  // Group curves by constraints for rendering
  const renderGroups = createMemo(() => {
    const groups = []
    const processedCurves = new Set()
    const curvesData = curves()

    if (!curvesData || curvesData.length === 0) return groups

    curvesData.forEach((pts, curveIdx) => {
      if (processedCurves.has(curveIdx)) return

      const constraintInfo = getConstraintInfo()(curveIdx)
      if (constraintInfo && constraintInfo.type === 'minmax') {
        const pairedIdx = constraintInfo.pairedWith
        if (!processedCurves.has(pairedIdx) && pairedIdx < curvesData.length) {
          const minIdx = constraintInfo.isMin ? curveIdx : pairedIdx
          const maxIdx = constraintInfo.isMax ? curveIdx : pairedIdx

          const minCurve = curvesData[minIdx]
          const maxCurve = curvesData[maxIdx]

          if (minCurve && maxCurve) {
            groups.push({
              type: 'minmax',
              curves: [minIdx, maxIdx],
              minCurve,
              maxCurve,
            })

            processedCurves.add(curveIdx)
            processedCurves.add(pairedIdx)
          }
        }
      } else {
        groups.push({
          type: 'single',
          curveIdx,
          curve: pts,
        })
        processedCurves.add(curveIdx)
      }
    })

    return groups
  })

  return (
    <div class='w-full h-full relative border border-gray-300'>
      <svg
        ref={(el) => (svgRef = el)}
        width={width}
        height={height}
        class='bg-white touch-none block w-full h-full'
        onDblClick={handleSvgDoubleClick}
      >
        {/* Render curve groups */}
        {renderGroups().map((group, groupIdx) => {
          if (group.type === 'minmax') {
            const minIdx = group.curves[0]
            const maxIdx = group.curves[1]
            const minColor = curveColors[minIdx % curveColors.length]

            return (
              <g key={`group-${groupIdx}`}>
                {/* Min-max filled area */}
                <path
                  d={minMaxAreaPath(
                    group.minCurve,
                    group.maxCurve,
                    minIdx,
                    maxIdx
                  )}
                  fill={minColor + '15'}
                  stroke='none'
                />

                {/* Min curve */}
                <path
                  d={mixedPath(group.minCurve, minIdx)}
                  stroke={minColor}
                  stroke-width='2'
                  stroke-dasharray='5,3'
                  fill='none'
                />

                {/* Max curve - same color as min curve */}
                <path
                  d={mixedPath(group.maxCurve, maxIdx)}
                  stroke={minColor}
                  stroke-width='2'
                  stroke-dasharray='5,3'
                  fill='none'
                />
              </g>
            )
          } else {
            // Single curve
            const curveIdx = group.curveIdx
            const pts = group.curve
            const color = curveColors[curveIdx % curveColors.length]

            return (
              <g key={`curve-${curveIdx}`}>
                <path
                  d={filledAreaPath(pts, curveIdx)}
                  fill={color + '20'}
                  stroke='none'
                />
                <path
                  d={mixedPath(pts, curveIdx)}
                  stroke={color}
                  stroke-width='2'
                  fill='none'
                />
              </g>
            )
          }
        })}

        {/* Render points */}
        {curves().map((pts, curveIdx) => {
          const effectiveIdx = getEffectiveAxisIndex(curveIdx)
          return pts.map((pt, ptIdx) => {
            const { x, y } = toSvg(pt)
            const isDragging =
              dragging()?.curveIdx === curveIdx && dragging()?.ptIdx === ptIdx
            const color = curveColors[effectiveIdx % curveColors.length]
            const key = `pt-${curveIdx}-${ptIdx}`

            // Edge points (squares)
            if (ptIdx === 0 || ptIdx === pts.length - 1) {
              const half = radius - 1
              const points = [
                [x - half, y - half],
                [x + half, y - half],
                [x + half, y + half],
                [x - half, y + half],
              ]
                .map(([px, py]) => `${px},${py}`)
                .join(' ')

              return (
                <polygon
                  key={key}
                  points={points}
                  fill={isDragging ? 'red' : '#fff'}
                  stroke={color}
                  stroke-width='2'
                  style={{ cursor: 'ns-resize' }}
                  onPointerDown={(e) => handlePointerDown(curveIdx, ptIdx, e)}
                />
              )
            }

            // Break points (triangles)
            if (pt.type === 'break') {
              const h = radius * 1.2
              const w = radius
              const points = [
                [x, y - h],
                [x + w, y + h * 0.5],
                [x - w, y + h * 0.5],
              ]
                .map(([px, py]) => `${px},${py}`)
                .join(' ')

              return (
                <polygon
                  key={key}
                  points={points}
                  fill={isDragging ? 'red' : '#fff'}
                  stroke={color}
                  stroke-width='2'
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => handlePointerDown(curveIdx, ptIdx, e)}
                />
              )
            }

            // Curve points (circles)
            return (
              <circle
                key={key}
                cx={x}
                cy={y}
                r={radius}
                fill={isDragging ? 'red' : '#fff'}
                stroke={color}
                stroke-width='2'
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => handlePointerDown(curveIdx, ptIdx, e)}
              />
            )
          })
        })}
      </svg>

      {/* Tooltip */}
      <Show when={tooltip()}>
        <div
          ref={(el) => (tooltipRef = el)}
          class='fixed pointer-events-none bg-slate-800/95 text-white text-sm rounded px-2 py-1 z-[1000] shadow-lg whitespace-nowrap'
          style={{
            left: (() => {
              const tip = tooltip()
              let left = tip.clientX + 12
              const tooltipWidth = tooltipRef?.offsetWidth || 120
              if (left + tooltipWidth > window.innerWidth - 8) {
                left = tip.clientX - tooltipWidth - 12
              }
              return `${left}px`
            })(),
            top: `${tooltip().clientY - 8}px`,
          }}
        >
          {(() => {
            const tip = tooltip()
            const xConfig = getXAxisConfig()(tip.curveIdx)
            const yConfig = getYAxisConfig()(tip.curveIdx)

            return (
              <>
                {xConfig.label && (
                  <span class='text-xs opacity-75'>{xConfig.label}: </span>
                )}
                {formatValue(tip.x, xConfig)}
                <br />
                {yConfig.label && (
                  <span class='text-xs opacity-75'>{yConfig.label}: </span>
                )}
                {formatValue(tip.y, yConfig)}
              </>
            )
          })()}
        </div>
      </Show>
    </div>
  )
}
