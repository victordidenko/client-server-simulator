package simulation

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// ResourceSettings represents resource configuration (part of behavior)
type ResourceSettings struct {
	MaxConcurrentRequests  int
	MaxMemoryMB            int
	MaxQueueSize           int
	MemoryLeakRateMBPerSec float64
	MemoryPerRequestMB     float64
	GCPauseIntervalSec     float64
	GCPauseDurationMs      float64
}

// ResourceState represents current server resource state (runtime values)
type ResourceState struct {
	ActiveRequests     int64
	CurrentMemoryMB    int64
	CPUUtilization     float64
	MemoryUtilization  float64
	QueueUtilization   float64
	ThreadsUtilization float64
	AverageQueueTimeMs float64
	MaxQueueTimeMs     float64
}

// QueuedRequest represents a request waiting in queue
type QueuedRequest struct {
	Request  Request
	QueuedAt time.Time
	Response chan QueuedResponse
}

// QueuedResponse represents the response from processing a queued request
type QueuedResponse struct {
	Response Response
	Error    error
}

// ServerBehavior represents server configuration only (no runtime state)
type ServerBehavior struct {
	To                       int
	ResponseTimeFrom         int
	ResponseTimeTo           int
	Errors                   []BehaviorPoint
	ResponseTimeMin          []BehaviorPoint
	ResponseTimeMax          []BehaviorPoint
	EnableResourceManagement bool
	ResourceSettings         ResourceSettings
}

// Server represents the server with both configuration and runtime state
type Server struct {
	id                 string
	metrics            *Metrics
	behavior           ServerBehavior
	behaviorStartTime  time.Time
	getErrorRate       func(x float64) float64
	getResponseTimeMin func(x float64) float64
	getResponseTimeMax func(x float64) float64

	resourceSettings ResourceSettings
	resourceState    ResourceState
	resourceStateMu  sync.RWMutex
	lastGCTime       time.Time
	startTime        time.Time

	requestQueue chan QueuedRequest
	queueTimes   []float64
	queueTimesMu sync.Mutex

	ctx     context.Context
	cancel  context.CancelFunc
	running atomic.Bool

	wg sync.WaitGroup
	mu sync.RWMutex
}

// NewServer creates a new server (does not start goroutines)
func NewServer(id string, metrics *Metrics) *Server {
	behavior := ServerBehavior{
		To:               0,
		ResponseTimeFrom: 0,
		ResponseTimeTo:   100,
		Errors: []BehaviorPoint{
			{X: 0, Y: 0, Type: Curve},
			{X: 1, Y: 0, Type: Curve},
		},
		ResponseTimeMin: []BehaviorPoint{
			{X: 0, Y: 0.1, Type: Curve},
			{X: 1, Y: 0.1, Type: Curve},
		},
		ResponseTimeMax: []BehaviorPoint{
			{X: 0, Y: 0.5, Type: Curve},
			{X: 1, Y: 0.5, Type: Curve},
		},
		EnableResourceManagement: false,
		ResourceSettings: ResourceSettings{
			MaxConcurrentRequests:  100,
			MaxMemoryMB:            1024,
			MaxQueueSize:           500,
			MemoryLeakRateMBPerSec: 0.1,
			MemoryPerRequestMB:     2.0,
			GCPauseIntervalSec:     10.0,
			GCPauseDurationMs:      50.0,
		},
	}

	s := &Server{
		id:               id,
		metrics:          metrics,
		behavior:         behavior,
		resourceSettings: behavior.ResourceSettings,
		resourceState:    ResourceState{},
		queueTimes:       make([]float64, 0, 100),
	}

	s.setupCurveFunctions()

	return s
}

// Start launches goroutines for resource management and worker pool
func (s *Server) Start(simulationCtx context.Context) error {
	if !s.running.CompareAndSwap(false, true) {
		return fmt.Errorf("server already started")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.ctx, s.cancel = context.WithCancel(simulationCtx)

	if s.behavior.EnableResourceManagement {
		s.resourceStateMu.Lock()
		s.resourceState = ResourceState{}
		s.requestQueue = make(chan QueuedRequest, s.resourceSettings.MaxQueueSize)
		s.lastGCTime = time.Now()
		s.resourceStateMu.Unlock()

		s.wg.Go(s.resourceManager)

		for i := 0; i < s.resourceSettings.MaxConcurrentRequests; i++ {
			s.wg.Go(s.worker)
		}
	}

	s.startTime = time.Now()
	return nil
}

// setupCurveFunctions initializes curve functions from behavior
func (s *Server) setupCurveFunctions() {
	behavior := s.behavior
	s.getErrorRate = CurveFunction(
		0,
		float64(behavior.To)*1000,
		0,
		1,
		behavior.Errors,
	)
	s.getResponseTimeMin = CurveFunction(
		0,
		float64(behavior.To)*1000,
		float64(behavior.ResponseTimeFrom),
		float64(behavior.ResponseTimeTo),
		behavior.ResponseTimeMin,
	)
	s.getResponseTimeMax = CurveFunction(
		0,
		float64(behavior.To)*1000,
		float64(behavior.ResponseTimeFrom),
		float64(behavior.ResponseTimeTo),
		behavior.ResponseTimeMax,
	)
}

// resourceManager runs in background to simulate resource changes over time
func (s *Server) resourceManager() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.updateResources()
		}
	}
}

// worker processes requests from the queue
func (s *Server) worker() {
	for {
		select {
		case <-s.ctx.Done():
			return

		case queuedReq, ok := <-s.requestQueue:
			if !ok {
				return
			}

			// Check context before processing
			select {
			case <-s.ctx.Done():
				close(queuedReq.Response)
				return
			default:
			}

			// Increment active requests
			s.resourceStateMu.Lock()
			s.resourceState.ActiveRequests++
			s.resourceStateMu.Unlock()

			queueTime := time.Since(queuedReq.QueuedAt)
			s.updateQueueMetrics(queueTime.Seconds() * 1000)

			response, err := s.processRequest(queuedReq.Request, true)

			// Try to send response
			select {
			case queuedReq.Response <- QueuedResponse{Response: response, Error: err}:
			case <-s.ctx.Done():
			}
			close(queuedReq.Response)

			// Decrement active requests
			s.resourceStateMu.Lock()
			s.resourceState.ActiveRequests--
			s.resourceStateMu.Unlock()
		}
	}
}

// updateQueueMetrics updates queue timing statistics
func (s *Server) updateQueueMetrics(queueTimeMs float64) {
	s.queueTimesMu.Lock()
	defer s.queueTimesMu.Unlock()

	s.queueTimes = append(s.queueTimes, queueTimeMs)
	if len(s.queueTimes) > 100 {
		s.queueTimes = s.queueTimes[1:]
	}

	s.resourceStateMu.Lock()
	if queueTimeMs > s.resourceState.MaxQueueTimeMs {
		s.resourceState.MaxQueueTimeMs = queueTimeMs
	}

	if len(s.queueTimes) > 0 {
		sum := 0.0
		for _, t := range s.queueTimes {
			sum += t
		}
		s.resourceState.AverageQueueTimeMs = sum / float64(len(s.queueTimes))
	}
	s.resourceStateMu.Unlock()
}

// updateResources simulates resource consumption and recovery
func (s *Server) updateResources() {
	s.resourceStateMu.Lock()
	defer s.resourceStateMu.Unlock()

	activeReqs := s.resourceState.ActiveRequests
	maxReqs := int64(s.resourceSettings.MaxConcurrentRequests)

	// Thread utilization - how many worker threads are busy
	s.resourceState.ThreadsUtilization = float64(activeReqs) / float64(maxReqs)

	// CPU utilization increases with load, but not linearly
	// It grows faster as we approach capacity (non-linear relationship)
	loadFactor := s.resourceState.ThreadsUtilization

	// CPU impact: starts slow, accelerates near capacity
	// At 50% threads: ~35% CPU, at 75% threads: ~65% CPU, at 100% threads: ~100% CPU
	targetCPU := math.Pow(loadFactor, 1.5) * 0.95 // Power function for non-linear growth

	// Smooth transition using exponential moving average
	smoothingFactor := 0.3
	s.resourceState.CPUUtilization += (targetCPU - s.resourceState.CPUUtilization) * smoothingFactor

	// Clamp values
	if s.resourceState.CPUUtilization > 1.0 {
		s.resourceState.CPUUtilization = 1.0
	}
	if s.resourceState.CPUUtilization < 0.0 {
		s.resourceState.CPUUtilization = 0.0
	}

	// Memory calculation: base memory + (active requests * per-request memory) + accumulated leaks
	baseMemoryMB := float64(maxReqs) * 0.5 // Base memory for server infrastructure
	requestMemoryMB := float64(activeReqs) * s.resourceSettings.MemoryPerRequestMB

	// Calculate target memory (base + requests)
	targetMemoryMB := baseMemoryMB + requestMemoryMB

	// Add memory leak over time (only when under load)
	if loadFactor > 0.1 {
		leakAmount := s.resourceSettings.MemoryLeakRateMBPerSec * 0.1 * loadFactor
		s.resourceState.CurrentMemoryMB += int64(leakAmount)
	}

	// Memory should track target with smoothing, but leaks accumulate
	currentTarget := int64(targetMemoryMB)
	if s.resourceState.CurrentMemoryMB < currentTarget {
		// Memory increases quickly when needed
		diff := currentTarget - s.resourceState.CurrentMemoryMB
		s.resourceState.CurrentMemoryMB += diff / 2 // Move halfway toward target
	} else if s.resourceState.CurrentMemoryMB > currentTarget && loadFactor < 0.1 {
		// Slow recovery when idle (simulates gradual GC/cleanup)
		diff := s.resourceState.CurrentMemoryMB - currentTarget
		s.resourceState.CurrentMemoryMB -= diff / 20 // Very slow recovery
	}

	// Memory should not exceed max
	currentMem := s.resourceState.CurrentMemoryMB
	maxMem := int64(s.resourceSettings.MaxMemoryMB)
	if currentMem > maxMem {
		s.resourceState.CurrentMemoryMB = maxMem
		currentMem = maxMem
	}

	// Memory utilization
	s.resourceState.MemoryUtilization = float64(currentMem) / float64(maxMem)

	// Simulate GC pauses - major cleanup event
	if time.Since(s.lastGCTime).Seconds() > s.resourceSettings.GCPauseIntervalSec {
		s.lastGCTime = time.Now()
		// GC recovers memory: removes leaks but keeps baseline for active requests
		targetAfterGC := int64(targetMemoryMB * 1.1) // Keep a bit more than baseline
		if s.resourceState.CurrentMemoryMB > targetAfterGC {
			s.resourceState.CurrentMemoryMB = targetAfterGC
		}
	}

	// Queue utilization
	queuedRequests := len(s.requestQueue)
	queueCapacity := cap(s.requestQueue)
	s.resourceState.QueueUtilization = float64(queuedRequests) / float64(queueCapacity)

	// Push latest resource state to metrics
	if s.metrics != nil {
		s.metrics.SetResourceState(ResourceMetrics{
			ActiveRequests:     activeReqs,
			QueuedRequests:     int64(queuedRequests),
			CPUUtilization:     s.resourceState.CPUUtilization,
			MemoryUtilization:  s.resourceState.MemoryUtilization,
			QueueUtilization:   s.resourceState.QueueUtilization,
			ThreadsUtilization: s.resourceState.ThreadsUtilization,
			AverageQueueTimeMs: s.resourceState.AverageQueueTimeMs,
			MaxQueueTimeMs:     s.resourceState.MaxQueueTimeMs,
		})
	}
}

// getResourceImpact calculates how current resources affect response time and errors
func (s *Server) getResourceImpact() (responseTimeMultiplier float64, additionalErrorRate float64) {
	s.resourceStateMu.RLock()
	defer s.resourceStateMu.RUnlock()

	responseTimeMultiplier = 1.0

	// CPU impact - exponential degradation when high
	if s.resourceState.CPUUtilization > 0.7 {
		cpuImpact := math.Pow(s.resourceState.CPUUtilization, 3)
		responseTimeMultiplier *= (1.0 + cpuImpact*2)
	}

	// Memory pressure impact - when memory is scarce, everything slows down
	if s.resourceState.MemoryUtilization > 0.8 {
		memImpact := (s.resourceState.MemoryUtilization - 0.8) / 0.2
		responseTimeMultiplier *= (1.0 + memImpact*3)
	}

	// Thread contention - when all workers are busy, there's context switching overhead
	if s.resourceState.ThreadsUtilization > 0.7 {
		concurrencyImpact := math.Pow(s.resourceState.ThreadsUtilization, 2)
		responseTimeMultiplier *= (1.0 + concurrencyImpact)
	}

	// Error rate increases under extreme resource pressure
	additionalErrorRate = 0.0
	if s.resourceState.CPUUtilization > 0.9 {
		additionalErrorRate += (s.resourceState.CPUUtilization - 0.9) * 0.5
	}
	if s.resourceState.MemoryUtilization > 0.9 {
		additionalErrorRate += (s.resourceState.MemoryUtilization - 0.9) * 0.3
	}

	return responseTimeMultiplier, additionalErrorRate
}

// getGCPause checks if we're currently in a GC pause
func (s *Server) getGCPause() float64 {
	s.resourceStateMu.RLock()
	defer s.resourceStateMu.RUnlock()

	timeSinceGC := time.Since(s.lastGCTime).Milliseconds()
	if float64(timeSinceGC) < s.resourceSettings.GCPauseDurationMs {
		return s.resourceSettings.GCPauseDurationMs
	}

	return 0
}

// HandleRequest routes to appropriate implementation based on resource management setting
func (s *Server) HandleRequest(_unusedRequestCtx context.Context, req Request) (Response, error) {
	s.mu.RLock()
	enableResourceManagement := s.behavior.EnableResourceManagement
	s.mu.RUnlock()

	if enableResourceManagement {
		return s.handleRequestWithResources(req)
	}

	// Simple mode: process directly without queue
	return s.processRequest(req, false)
}

// handleRequestWithResources implements queue-based processing with resource management
func (s *Server) handleRequestWithResources(req Request) (Response, error) {
	// Check memory pressure before accepting request
	s.resourceStateMu.RLock()
	memUtil := s.resourceState.MemoryUtilization
	s.resourceStateMu.RUnlock()

	if memUtil > 0.98 {
		return Response{}, fmt.Errorf("server out of memory")
	}

	queuedReq := QueuedRequest{
		Request:  req,
		QueuedAt: time.Now(),
		Response: make(chan QueuedResponse, 1),
	}

	// Check if server is shutting down
	select {
	case <-s.ctx.Done():
		return Response{}, s.ctx.Err()
	default:
	}

	// Try to enqueue request (non-blocking to detect full queue)
	select {
	case s.requestQueue <- queuedReq:
		// Successfully queued
	case <-s.ctx.Done():
		return Response{}, s.ctx.Err()
	default:
		// Queue is full
		return Response{}, fmt.Errorf("server queue full")
	}

	// Wait for response
	select {
	case result := <-queuedReq.Response:
		return result.Response, result.Error
	case <-s.ctx.Done():
		return Response{}, s.ctx.Err()
	}
}

// processRequest handles the actual request processing (used by both simple and resource modes)
func (s *Server) processRequest(req Request, resourceManagementEnabled bool) (Response, error) {
	// Get resource impact if resource management is enabled
	var responseTimeMultiplier float64 = 1.0
	var additionalErrorRate float64 = 0.0

	if resourceManagementEnabled {
		responseTimeMultiplier, additionalErrorRate = s.getResourceImpact()
	}

	s.mu.Lock()
	if s.behaviorStartTime.IsZero() {
		s.behaviorStartTime = time.Now()
	}
	behaviorStartTime := s.behaviorStartTime
	getErrorRate := s.getErrorRate
	getResponseTimeMin := s.getResponseTimeMin
	getResponseTimeMax := s.getResponseTimeMax
	s.mu.Unlock()

	elapsedMs := float64(time.Since(behaviorStartTime).Milliseconds())

	responseTimeMin := getResponseTimeMin(elapsedMs)
	responseTimeMax := getResponseTimeMax(elapsedMs)

	min := responseTimeMin
	max := responseTimeMax
	if min > max {
		min, max = max, min
	}

	var workMs float64
	if min == max {
		workMs = min
	} else {
		mean := (min + max) / 2
		stddev := (max - min) / 6
		workMs = rand.NormFloat64()*stddev + mean
		if workMs < 0 {
			workMs = 0
		}
	}

	// Apply resource impact if resource management is enabled
	workMs *= responseTimeMultiplier

	if resourceManagementEnabled {
		workMs += s.getGCPause()
	}

	workDuration := time.Duration(workMs * float64(time.Millisecond))

	err := SleepWithContext(s.ctx, workDuration)
	if err != nil {
		return Response{}, err
	}

	// Check for errors
	baseErrorRate := getErrorRate(elapsedMs)
	totalErrorRate := baseErrorRate + additionalErrorRate
	if totalErrorRate > 1.0 {
		totalErrorRate = 1.0
	}

	if totalErrorRate > 0 && rand.Float64() < totalErrorRate {
		errResp := Response{
			Id:        req.Id,
			Ok:        false,
			Error:     "Server Error",
			Timestamp: time.Now(),
		}
		return errResp, fmt.Errorf("server error")
	}

	resp := Response{
		Id:        req.Id,
		Ok:        true,
		Data:      "OK",
		Timestamp: time.Now(),
	}

	return resp, nil
}

// GetBehavior returns the current server behavior
func (s *Server) GetBehavior() ServerBehavior {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.behavior
}

// SetBehavior sets the current server behavior
func (s *Server) SetBehavior(behavior ServerBehavior) {
	s.mu.Lock()
	s.resourceStateMu.Lock()
	defer s.mu.Unlock()
	defer s.resourceStateMu.Unlock()

	s.behavior = behavior
	s.resourceSettings = behavior.ResourceSettings
	s.behaviorStartTime = time.Time{}
	s.setupCurveFunctions()
}

// ResetBehavior resets the behavior of the server to its initial state
func (s *Server) ResetBehavior() {
	s.SetBehavior(s.GetBehavior())
}

// Shutdown gracefully stops all server goroutines
func (s *Server) Shutdown() {
	if !s.running.CompareAndSwap(true, false) {
		return
	}

	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
}
