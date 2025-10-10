package simulation

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"
)

// NetworkBehavior represents network simulation options
type NetworkBehavior struct {
	To          int
	LatencyFrom int
	LatencyTo   int
	DropRate    []BehaviorPoint
	LatencyMin  []BehaviorPoint
	LatencyMax  []BehaviorPoint
}

// Network simulates a network connection with configurable latency and packet loss
type Network struct {
	server            *Server
	metrics           *Metrics
	behavior          NetworkBehavior
	behaviorStartTime time.Time
	getDropRate       func(x float64) float64
	getLatencyMin     func(x float64) float64
	getLatencyMax     func(x float64) float64
	mu                sync.RWMutex
}

// NewNetwork creates a new network simulator with the specified server
func NewNetwork(server *Server, metrics *Metrics) *Network {
	behavior := NetworkBehavior{
		To:          0,
		LatencyFrom: 0,
		LatencyTo:   100,
		DropRate: []BehaviorPoint{
			{X: 0, Y: 0, Type: Curve},
			{X: 1, Y: 0, Type: Curve},
		},
		LatencyMin: []BehaviorPoint{
			{X: 0, Y: 0.1, Type: Curve},
			{X: 1, Y: 0.1, Type: Curve},
		},
		LatencyMax: []BehaviorPoint{
			{X: 0, Y: 0.4, Type: Curve},
			{X: 1, Y: 0.4, Type: Curve},
		},
	}

	n := &Network{
		behavior: behavior,
		server:   server,
		metrics:  metrics,
	}

	n.behaviorStartTime = time.Time{}
	n.getDropRate = CurveFunction(
		0,
		float64(behavior.To)*1000,
		0,
		1,
		behavior.DropRate,
	)
	n.getLatencyMin = CurveFunction(
		0,
		float64(behavior.To)*1000,     // maxX in ms
		float64(behavior.LatencyFrom), // minY in ms
		float64(behavior.LatencyTo),   // maxY in ms
		behavior.LatencyMin,
	)
	n.getLatencyMax = CurveFunction(
		0,
		float64(behavior.To)*1000,     // maxX in ms
		float64(behavior.LatencyFrom), // minY in ms
		float64(behavior.LatencyTo),   // maxY in ms
		behavior.LatencyMax,
	)

	return n
}

// GetBehavior returns the current network behavior
func (n *Network) GetBehavior() NetworkBehavior {
	n.mu.RLock()
	defer n.mu.RUnlock()
	return n.behavior
}

// SetBehavior sets the current network behavior
func (n *Network) SetBehavior(behavior NetworkBehavior) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.behavior = behavior
	n.behaviorStartTime = time.Time{}
	n.getDropRate = CurveFunction(
		0,
		float64(behavior.To)*1000,
		0,
		1,
		behavior.DropRate,
	)
	n.getLatencyMin = CurveFunction(
		0,
		float64(behavior.To)*1000,     // maxX in ms
		float64(behavior.LatencyFrom), // minY in ms
		float64(behavior.LatencyTo),   // maxY in ms
		behavior.LatencyMin,
	)
	n.getLatencyMax = CurveFunction(
		0,
		float64(behavior.To)*1000,     // maxX in ms
		float64(behavior.LatencyFrom), // minY in ms
		float64(behavior.LatencyTo),   // maxY in ms
		behavior.LatencyMax,
	)
}

// ResetBehavior resets the network behavior to its initial state
func (n *Network) ResetBehavior() {
	n.SetBehavior(n.GetBehavior())
}

// oneWayTrip simulates a one-way trip through the network using curves
func (n *Network) oneWayTrip(ctx context.Context, elapsedMs float64, getDropRate, getLatencyMin, getLatencyMax func(x float64) float64) (time.Duration, error) {
	minLatency := getLatencyMin(elapsedMs)
	maxLatency := getLatencyMax(elapsedMs)

	min := minLatency
	max := maxLatency
	if min > max {
		min, max = max, min
	}

	var latencyMs float64
	if min == max {
		latencyMs = min
	} else {
		// Normal distribution: mean at center, stddev = (max-min)/6 (~99.7% of values within bounds)
		mean := (min + max) / 2
		stddev := (max - min) / 6
		latencyMs = rand.NormFloat64()*stddev + mean
	}

	latencyMs = math.Max(latencyMs, 1) // not less than 1ms
	latency := time.Duration(latencyMs) * time.Millisecond
	err := SleepWithContext(ctx, latency)
	if err != nil {
		return latency, err // Context canceled, count as network error
	}

	// drop request case
	dropRate := getDropRate(elapsedMs)
	if dropRate > 0 && rand.Float64() < dropRate {
		return latency, fmt.Errorf("packet lost")
	}

	return latency, nil
}

// Send transmits a request through the simulated network to the server
func (n *Network) Send(ctx context.Context, req Request) (Response, error) {
	n.mu.Lock()
	if n.behaviorStartTime.IsZero() {
		n.behaviorStartTime = time.Now()
	}
	behaviorStart := n.behaviorStartTime
	getDropRate := n.getDropRate
	getLatencyMin := n.getLatencyMin
	getLatencyMax := n.getLatencyMax
	n.mu.Unlock()

	elapsedMs := float64(time.Since(behaviorStart).Milliseconds())
	requestLatency, requestLostErr := n.oneWayTrip(ctx, elapsedMs, getDropRate, getLatencyMin, getLatencyMax)
	n.metrics.recordRequestLatency(requestLatency)
	if requestLostErr != nil {
		return Response{}, requestLostErr
	}

	n.metrics.ServerReceivedRequests.Add(1)
	resp, err := n.server.HandleRequest(ctx, req)
	if err == nil && resp.Ok {
		n.metrics.ServerSuccessResponses.Add(1)
	} else {
		n.metrics.ServerErrorResponses.Add(1)
		resp.Ok = false
		if resp.Error == "" && err != nil {
			resp.Error = err.Error()
		}
	}

	elapsedMs = float64(time.Since(behaviorStart).Milliseconds())
	responseLatency, responseLostErr := n.oneWayTrip(ctx, elapsedMs, getDropRate, getLatencyMin, getLatencyMax)
	n.metrics.recordResponseLatency(responseLatency)
	if responseLostErr != nil {
		return Response{}, responseLostErr
	}

	return resp, nil
}
