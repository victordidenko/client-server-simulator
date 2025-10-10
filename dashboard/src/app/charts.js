import { combine, createEvent, createStore } from 'effector'
import { clientsQuery } from './clients'
import { metrics, notifications } from './ws'

export const init = createEvent()

//
// Clients count
//

export const $maxClientsCount = clientsQuery.$data //
  .map((groups) => groups?.reduce((s, g) => s + (g?.count || 0), 0) ?? null)

const _clients = () => [
  [], // timestamp
  [], // active_clients
]

export const $clientsData = createStore(_clients())
  .on(notifications.simulation_started, _clients)
  .on(notifications.simulation_reset, _clients)
  .on(metrics.data, ([t, counts], m) => {
    t.push(m.timestamp / 1000)
    counts.push(m.active_clients)
    return [t, counts]
  })

export const $clients = combine(
  clientsQuery.$data,
  $clientsData,
  (groups, [t, counts]) => {
    if (groups == null || groups.length === 0) return [[]]
    const data = [t, [], ...groups.map((_) => [])]
    for (let i = 0; i < t.length; i++) {
      let s = 0
      for (let j = 0; j < groups.length; j++) {
        const v = counts[i][groups[j].id]
        data[j + 2].push(v || null)
        s += v || 0
      }
      data[1].push(s)
    }
    return data
  }
)

export const $clientsSeries = clientsQuery.$data //
  .map((groups) => {
    if (groups == null || groups.length === 0) return [{}]
    return groups.reduce(
      (series, group, index) => {
        series.push({
          label: `${index + 1}`,
          stroke: group?.color ?? '',
          width: 2,
          points: { show: false },
        })
        return series
      },
      [
        {},
        {
          label: 'All',
          stroke: 'gray',
          fill: 'rgba(100, 100, 100, 0.1)',
          width: 2,
          points: { show: false },
        },
      ]
    )
  })

//
// RPS
//

const _rps = () => [
  [], // timestamp
  [], // client_sent_req
  [], // client_success_resp
  [], // client_error_resp
  [], // network_failed_reqs
  [], // server_received_req
  [], // server_success_resp
  [], // server_error_resp
  [], // client_blocked_req
  [], // client_retry_req
]

const $counters = createStore(_rps())
  .on(notifications.simulation_started, _rps)
  .on(notifications.simulation_reset, _rps)
  .on(
    metrics.data,
    ([t, creq, csuc, cerr, nerr, sreq, ssuc, serr, cblk, crtr], m) => {
      t.push(m.timestamp / 1000)
      creq.push(m.client_sent_req)
      csuc.push(m.client_success_resp)
      cerr.push(m.client_error_resp)
      nerr.push(m.network_failed_reqs)
      sreq.push(m.server_received_req)
      ssuc.push(m.server_success_resp)
      serr.push(m.server_error_resp)
      cblk.push(m.client_blocked_req)
      crtr.push(m.client_retry_req)
      return [t, creq, csuc, cerr, nerr, sreq, ssuc, serr, cblk, crtr]
    }
  )

export const $rps = createStore(_rps()) //
  .on(
    $counters,
    ([t, creq, csuc, cerr, nerr, sreq, ssuc, serr, cblk, crtr], c) => {
      if (c[0].length === 0) return _rps()
      t.push(c[0].at(-1))
      creq.push(rps(c[0], c[1]))
      csuc.push(rps(c[0], c[2]))
      cerr.push(rps(c[0], c[3]))
      nerr.push(rps(c[0], c[4]))
      sreq.push(rps(c[0], c[5]))
      ssuc.push(rps(c[0], c[6]))
      serr.push(rps(c[0], c[7]))
      cblk.push(rps(c[0], c[8]))
      crtr.push(rps(c[0], c[9]))
      return [t, creq, csuc, cerr, nerr, sreq, ssuc, serr, cblk, crtr]
    }
  )

// calculate average rps from 5 previous values
function rps(t, v) {
  const times = t.slice(-5)
  const values = v.slice(-5)
  const l = Math.min(times.length, values.length)
  if (l < 2) return null

  // --- average from last to each previous ---
  // const tl = times[l - 1]
  // const vl = values[l - 1]
  // const rpss = []
  // for (let i = l - 1; i--; ) {
  //   const td = tl - times[i]
  //   const vd = vl - values[i]
  //   if (vd > 0 && td > 0) rpss.push(vd / td)
  // }
  // if (rpss.length === 0) return 0
  // return Math.round(rpss.reduce((a, b) => a + b, 0) / rpss.length)

  // --- moving average (consecutive pairs) ---
  const rpss = []
  for (let i = 1; i < l; i++) {
    const tdiff = times[i] - times[i - 1]
    const vdiff = values[i] - values[i - 1]
    if (tdiff > 0) rpss.push(vdiff / tdiff)
  }
  if (rpss.length === 0) return 0
  return Math.round(rpss.reduce((a, b) => a + b, 0) / rpss.length)

  // --- exponential moving average (ema) ---
  // alpha is the smoothing factor (0 < alpha < 1), higher = more responsive
  // const alpha = 0.5
  // let ema = null
  // for (let i = 1; i < l; i++) {
  //   const tdiff = times[i] - times[i - 1]
  //   const vdiff = values[i] - values[i - 1]
  //   if (tdiff > 0) {
  //     const rps = vdiff / tdiff
  //     ema = ema === null ? rps : alpha * rps + (1 - alpha) * ema
  //   }
  // }
  // return ema !== null ? Math.round(ema) : 0
}

//
// Reponse Time
//

const _responseTime = () => [
  [], // timestamp
  [], // min_response_time
  [], // max_response_time
  [], // avg_response_time
  [], // p50_response_time
  [], // p80_response_time
  [], // p95_response_time
  [], // min_request_latency
  [], // max_request_latency
  [], // min_response_latency
  [], // max_response_latency
]

export const $responseTime = createStore(_responseTime())
  .on(notifications.simulation_started, _responseTime)
  .on(notifications.simulation_reset, _responseTime)
  .on(
    metrics.data,
    ([t, min, max, avg, p50, p80, p95, lql, hql, lal, hal], m) => {
      t.push(m.timestamp / 1000)
      min.push(m.min_response_time || null)
      max.push(m.max_response_time || null)
      avg.push(m.avg_response_time || null)
      p50.push(m.p50_response_time || null)
      p80.push(m.p80_response_time || null)
      p95.push(m.p95_response_time || null)
      lql.push(m.min_request_latency || null)
      hql.push(m.max_request_latency || null)
      lal.push(m.min_response_latency || null)
      hal.push(m.max_response_latency || null)
      return [t, min, max, avg, p50, p80, p95, lql, hql, lal, hal]
    }
  )

//
// Server Resources Utilization
//

const _utilization = () => [
  [], // timestamp
  [], // server_cpu_utilization
  [], // server_memory_utilization
  [], // server_queue_utilization
  [], // server_threads_utilization
]

export const $utilization = createStore(_utilization())
  .on(notifications.simulation_started, _utilization)
  .on(notifications.simulation_reset, _utilization)
  .on(metrics.data, ([t, cpu, mem, que, thr], m) => {
    t.push(m.timestamp / 1000)
    cpu.push(m.server_cpu_utilization * 100)
    mem.push(m.server_memory_utilization * 100)
    que.push(m.server_queue_utilization * 100)
    thr.push(m.server_threads_utilization * 100)
    return [t, cpu, mem, que, thr]
  })

//
//
//

// "server_active_requests":    activeRequests,
// "server_queued_requests":    queuedRequests,
// "server_avg_queue_time_ms":  averageQueueTimeMs,
// "server_max_queue_time_ms":  maxQueueTimeMs,

// ws.data.watch((m) =>
//   console.log({
//     server_active_requests: m.server_active_requests,
//     server_queued_requests: m.server_queued_requests,
//     server_avg_queue_time_ms: m.server_avg_queue_time_ms,
//     server_max_queue_time_ms: m.server_max_queue_time_ms,
//   })
// )
