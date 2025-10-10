package simulation

import (
	"maps"
	"slices"
	"sync"
	"sync/atomic"
	"time"
)

type ResourceMetrics struct {
	ActiveRequests     int64
	QueuedRequests     int64
	CPUUtilization     float64
	MemoryUtilization  float64
	QueueUtilization   float64
	ThreadsUtilization float64
	AverageQueueTimeMs float64
	MaxQueueTimeMs     float64
}

// Metrics tracks and computes statistics about the simulation
type Metrics struct {
	mu sync.RWMutex

	ActiveClientsByGroup map[string]int64 // Current number of active clients per group

	// Client-side metrics
	ClientBlockedRequests  atomic.Int64 // Requests blocked by clients' behavior
	ClientSentRequests     atomic.Int64 // Requests sent by clients
	ClientRetryRequests    atomic.Int64 // Requests retried by clients
	ClientSuccessResponses atomic.Int64 // Successful responses received by clients
	ClientErrorResponses   atomic.Int64 // Errorneous responses received by clients

	// Network metrics
	NetworkFailedRequests atomic.Int64 // Requests that failed to send/receive due to network errors

	// Network latency metrics
	MinRequestLatency  time.Duration   // Minimum latency on the way to the server (last 1s)
	MaxRequestLatency  time.Duration   // Maximum latency on the way to the server (last 1s)
	MinResponseLatency time.Duration   // Minimum latency on the way back from the server (last 1s)
	MaxResponseLatency time.Duration   // Maximum latency on the way back from the server (last 1s)
	RequestLatencies   []timedDuration // Array of recent request latencies with timestamps
	ResponseLatencies  []timedDuration // Array of recent response latencies with timestamps

	// Server-side metrics
	ServerReceivedRequests atomic.Int64 // Requests received by server
	ServerSuccessResponses atomic.Int64 // Successful responses returned by server
	ServerErrorResponses   atomic.Int64 // Errorneous responses returned by server

	// Response time metrics (sliding window)
	trackDurationsCount int
	ResponseTimes       []timedDuration // Array of recent response times with timestamps
	MinResponseTime     time.Duration   // Minimum response time (last 1s)
	MaxResponseTime     time.Duration   // Maximum response time (last 1s)
	AvgResponseTime     time.Duration   // Average response time (last 1s)
	P50ResponseTime     time.Duration   // 50th percentile response time (last 1s)
	P80ResponseTime     time.Duration   // 80th percentile response time (last 1s)
	P95ResponseTime     time.Duration   // 95th percentile response time (last 1s)

	// Latest server resource state (pushed by Server)
	latestResourceState ResourceMetrics
	resourceStateMu     sync.RWMutex
}

// SetResourceState sets the latest ResourceState (called by Server)
func (m *Metrics) SetResourceState(state ResourceMetrics) {
	m.resourceStateMu.Lock()
	defer m.resourceStateMu.Unlock()
	m.latestResourceState = state
}

// timedDuration stores a duration and its timestamp
type timedDuration struct {
	timestamp time.Time
	duration  time.Duration
}

// NewMetrics creates a new metrics tracker
func NewMetrics() *Metrics {
	return &Metrics{
		ActiveClientsByGroup: make(map[string]int64),
		ResponseTimes:        make([]timedDuration, 0, 100000),
		RequestLatencies:     make([]timedDuration, 0, 100000),
		ResponseLatencies:    make([]timedDuration, 0, 100000),
		trackDurationsCount:  100000, // Track up to 100,000 recent durations for sliding window
	}
}

// recordResponseTime updates the response time metrics using a sliding window of 1 second
func (m *Metrics) recordResponseTime(responseTime time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	m.ResponseTimes = append(m.ResponseTimes, timedDuration{timestamp: now, duration: responseTime})
	if len(m.ResponseTimes) > m.trackDurationsCount {
		m.ResponseTimes = m.ResponseTimes[len(m.ResponseTimes)-m.trackDurationsCount:]
	}
}

// recordRequestLatency updates the request latency metrics using a sliding window of 1 second
func (m *Metrics) recordRequestLatency(latency time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	m.RequestLatencies = append(m.RequestLatencies, timedDuration{timestamp: now, duration: latency})
	if len(m.RequestLatencies) > m.trackDurationsCount {
		m.RequestLatencies = m.RequestLatencies[len(m.RequestLatencies)-m.trackDurationsCount:]
	}
}

// recordResponseLatency updates the response latency metrics using a sliding window of 1 second
func (m *Metrics) recordResponseLatency(latency time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	m.ResponseLatencies = append(m.ResponseLatencies, timedDuration{timestamp: now, duration: latency})
	if len(m.ResponseLatencies) > m.trackDurationsCount {
		m.ResponseLatencies = m.ResponseLatencies[len(m.ResponseLatencies)-m.trackDurationsCount:]
	}
}

// GetSnapshot returns a snapshot of the current metrics
func (m *Metrics) GetSnapshot() map[string]any {
	now := time.Now()

	clientBlockedRequests := m.ClientBlockedRequests.Load()
	clientSentRequests := m.ClientSentRequests.Load()
	clientRetryRequests := m.ClientRetryRequests.Load()
	clientSuccessResponses := m.ClientSuccessResponses.Load()
	clientErrorResponses := m.ClientErrorResponses.Load()
	networkFailedRequests := m.NetworkFailedRequests.Load()
	serverReceivedRequests := m.ServerReceivedRequests.Load()
	serverSuccessResponses := m.ServerSuccessResponses.Load()
	serverErrorResponses := m.ServerErrorResponses.Load()

	// Get latest ResourceState (thread-safe)
	m.resourceStateMu.RLock()
	state := m.latestResourceState
	m.resourceStateMu.RUnlock()

	cpuUtilization := state.CPUUtilization
	memoryUtilization := state.MemoryUtilization
	activeRequests := state.ActiveRequests
	queuedRequests := state.QueuedRequests
	queueUtilization := state.QueueUtilization
	threadsUtilization := state.ThreadsUtilization
	averageQueueTimeMs := state.AverageQueueTimeMs
	maxQueueTimeMs := state.MaxQueueTimeMs

	activeClientsByGroup := make(map[string]int64)
	m.mu.RLock()
	maps.Copy(activeClientsByGroup, m.ActiveClientsByGroup)
	minResponseTime := m.MinResponseTime.Milliseconds()
	maxResponseTime := m.MaxResponseTime.Milliseconds()
	avgResponseTime := m.AvgResponseTime.Milliseconds()
	p50ResponseTime := m.P50ResponseTime.Milliseconds()
	p80ResponseTime := m.P80ResponseTime.Milliseconds()
	p95ResponseTime := m.P95ResponseTime.Milliseconds()
	minRequestLatency := m.MinRequestLatency.Milliseconds()
	maxRequestLatency := m.MaxRequestLatency.Milliseconds()
	minResponseLatency := m.MinResponseLatency.Milliseconds()
	maxResponseLatency := m.MaxResponseLatency.Milliseconds()
	m.calculateSlidingWindowMetrics(now)
	m.calculateNetworkLatencyMetrics(now)
	m.mu.RUnlock()

	return map[string]any{
		"active_clients": activeClientsByGroup,

		// Client-side metrics
		"client_blocked_req":  clientBlockedRequests,
		"client_sent_req":     clientSentRequests,
		"client_retry_req":    clientRetryRequests,
		"client_success_resp": clientSuccessResponses,
		"client_error_resp":   clientErrorResponses,

		// Network metrics
		"network_failed_reqs": networkFailedRequests,

		// Server-side metrics
		"server_received_req": serverReceivedRequests,
		"server_success_resp": serverSuccessResponses,
		"server_error_resp":   serverErrorResponses,

		// ResourceState metrics (from server)
		"server_cpu_utilization":     cpuUtilization,
		"server_memory_utilization":  memoryUtilization,
		"server_active_requests":     activeRequests,
		"server_queued_requests":     queuedRequests,
		"server_queue_utilization":   queueUtilization,
		"server_threads_utilization": threadsUtilization,
		"server_avg_queue_time_ms":   averageQueueTimeMs,
		"server_max_queue_time_ms":   maxQueueTimeMs,

		// Response time metrics (sliding window)
		"min_response_time": minResponseTime,
		"max_response_time": maxResponseTime,
		"avg_response_time": avgResponseTime,
		"p50_response_time": p50ResponseTime,
		"p80_response_time": p80ResponseTime,
		"p95_response_time": p95ResponseTime,

		// Network latency metrics
		"min_request_latency":  minRequestLatency,
		"max_request_latency":  maxRequestLatency,
		"min_response_latency": minResponseLatency,
		"max_response_latency": maxResponseLatency,

		// Timestamp for client-side calculations
		"timestamp": now.UnixMilli(),
	}
}

// AddActiveClient increments the active client count for a group
func (m *Metrics) AddActiveClient(groupId string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ActiveClientsByGroup[groupId]++
}

// RemoveActiveClient decrements the active client count for a group
func (m *Metrics) RemoveActiveClient(groupId string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ActiveClientsByGroup[groupId]--
}

// calculateSlidingWindowMetrics cleans up old values and calculates metrics for the current 1-second window
func (m *Metrics) calculateSlidingWindowMetrics(now time.Time) {
	cutoff := now.Add(-1 * time.Second)
	filtered := m.ResponseTimes[:0]
	for _, tr := range m.ResponseTimes {
		if tr.timestamp.After(cutoff) || tr.timestamp.Equal(cutoff) {
			filtered = append(filtered, tr)
		}
	}
	m.ResponseTimes = filtered

	if len(m.ResponseTimes) > 0 {
		window := m.ResponseTimes
		var sum int64
		min := window[0].duration
		max := window[0].duration
		times := make([]time.Duration, len(window))
		for i, tr := range window {
			rt := tr.duration
			times[i] = rt
			sum += int64(rt)
			if rt < min {
				min = rt
			}
			if rt > max {
				max = rt
			}
		}
		m.MinResponseTime = min
		m.MaxResponseTime = max
		m.AvgResponseTime = time.Duration(sum / int64(len(window)))

		// Sort for percentiles
		slices.Sort(times)

		p50Idx := int(float64(len(times)) * 0.5)
		p80Idx := int(float64(len(times)) * 0.8)
		p95Idx := int(float64(len(times)) * 0.95)

		if p50Idx >= len(times) {
			p50Idx = len(times) - 1
		}
		if p80Idx >= len(times) {
			p80Idx = len(times) - 1
		}
		if p95Idx >= len(times) {
			p95Idx = len(times) - 1
		}

		m.P50ResponseTime = times[p50Idx]
		m.P80ResponseTime = times[p80Idx]
		m.P95ResponseTime = times[p95Idx]
	} else {
		// No data in the last window, set metrics to zero
		m.MinResponseTime = 0
		m.MaxResponseTime = 0
		m.AvgResponseTime = 0
		m.P50ResponseTime = 0
		m.P80ResponseTime = 0
		m.P95ResponseTime = 0
	}
}

// calculateNetworkLatencyMetrics cleans up old values and calculates min/max for request/response latencies in the last 1s
func (m *Metrics) calculateNetworkLatencyMetrics(now time.Time) {
	cutoff := now.Add(-1 * time.Second)

	// Request latencies
	filtered := m.RequestLatencies[:0]
	for _, tr := range m.RequestLatencies {
		if tr.timestamp.After(cutoff) || tr.timestamp.Equal(cutoff) {
			filtered = append(filtered, tr)
		}
	}
	m.RequestLatencies = filtered

	if len(m.RequestLatencies) > 0 {
		window := m.RequestLatencies
		min := window[0].duration
		max := window[0].duration
		for _, tr := range window {
			rt := tr.duration
			if rt < min {
				min = rt
			}
			if rt > max {
				max = rt
			}
		}
		m.MinRequestLatency = min
		m.MaxRequestLatency = max
	} else {
		m.MinRequestLatency = 0
		m.MaxRequestLatency = 0
	}

	// Response latencies
	filtered = m.ResponseLatencies[:0]
	for _, tr := range m.ResponseLatencies {
		if tr.timestamp.After(cutoff) || tr.timestamp.Equal(cutoff) {
			filtered = append(filtered, tr)
		}
	}
	m.ResponseLatencies = filtered

	if len(m.ResponseLatencies) > 0 {
		window := m.ResponseLatencies
		min := window[0].duration
		max := window[0].duration
		for _, tr := range window {
			rt := tr.duration
			if rt < min {
				min = rt
			}
			if rt > max {
				max = rt
			}
		}
		m.MinResponseLatency = min
		m.MaxResponseLatency = max
	} else {
		m.MinResponseLatency = 0
		m.MaxResponseLatency = 0
	}
}
