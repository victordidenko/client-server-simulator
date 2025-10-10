package web

import (
	"request-policy/internal/simulation"
	"time"
)

type SimulationJSON struct {
	Id        *string `json:"id,omitempty"`
	Status    Status  `json:"status"`
	StartedAt int64   `json:"startedAt"`
}

type ClientConfigJSON struct {
	Id          string `json:"id"`
	Count       int    `json:"count"`
	RequestRate int    `json:"requestRate"`
	RampUpTime  int    `json:"rampUpTime"`
	Delay       int    `json:"startupDelay"`
	Behavior    string `json:"behavior"`
}

type BehaviorPointJSON struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Type string  `json:"type"` // curve | break
}

type ServerResourcesJSON struct {
	MaxConcurrentRequests  int     `json:"maxConcurrentRequests"`
	MaxMemoryMB            int     `json:"maxMemoryMB"`
	MaxQueueSize           int     `json:"maxQueueSize"`
	MemoryLeakRateMBPerSec float64 `json:"memoryLeakRateMBPerSec"`
	MemoryPerRequestMB     float64 `json:"memoryPerRequestMB"`
	GCPauseIntervalSec     float64 `json:"gcPauseIntervalSec"`
	GCPauseDurationMs      float64 `json:"gcPauseDurationMs"`
}

type ServerBehaviorJSON struct {
	To                       int                 `json:"to"`
	ResponseTimeFrom         int                 `json:"rtfrom"`
	ResponseTimeTo           int                 `json:"rtto"`
	ReponseTimeMin           []BehaviorPointJSON `json:"rtmin"`
	ReponseTimeMax           []BehaviorPointJSON `json:"rtmax"`
	Errors                   []BehaviorPointJSON `json:"errors"`
	EnableResourceManagement bool                `json:"enableResourceManagement"`
	Resources                ServerResourcesJSON `json:"resources"`
}

type ServerResourceMetricsJSON struct {
	CPUUtilization     float64 `json:"cpuUtilization"`
	MemoryUtilization  float64 `json:"memoryUtilization"`
	ActiveRequests     int64   `json:"activeRequests"`
	CurrentMemoryMB    int64   `json:"currentMemoryMB"`
	QueuedRequests     int64   `json:"queuedRequests"`
	QueueUtilization   float64 `json:"queueUtilization"`
	AverageQueueTimeMs float64 `json:"averageQueueTimeMs"`
	MaxQueueTimeMs     float64 `json:"maxQueueTimeMs"`
}

type NetworkBehaviorJSON struct {
	To          int                 `json:"to"`
	LatencyFrom int                 `json:"latfrom"`
	LatencyTo   int                 `json:"latto"`
	DropRate    []BehaviorPointJSON `json:"drops"`
	LatencyMin  []BehaviorPointJSON `json:"latmin"`
	LatencyMax  []BehaviorPointJSON `json:"latmax"`
}

func ClientConfigsDto(d *Dashboard) []ClientConfigJSON {
	if d.simulation == nil {
		return nil
	}

	configs := d.simulation.GetClientConfigs()
	result := make([]ClientConfigJSON, 0, len(configs))

	for _, config := range configs {
		jsonConfig := ClientConfigJSON{
			Id:          config.Id,
			Count:       config.Count,
			RequestRate: int(config.RequestRate / time.Millisecond),
			RampUpTime:  int(config.RampUpTime / time.Millisecond),
			Delay:       int(config.Delay / time.Millisecond),
			Behavior:    config.Behavior,
		}
		result = append(result, jsonConfig)
	}

	return result
}

func SimulationDto(d *Dashboard) SimulationJSON {
	var id *string
	var status Status
	var startedAt int64

	simulation := d.simulation
	if simulation == nil {
		id = nil
		status = StatusNone
		startedAt = 0
	} else {
		id = &simulation.Id
		if simulation.IsRunning() {
			status = StatusRunning
		} else {
			status = StatusStopped
		}
		startedAt = simulation.StartedAt()
	}

	return SimulationJSON{
		Id:        id,
		Status:    status,
		StartedAt: startedAt,
	}
}

func BehaviorPointToJSON(ep simulation.BehaviorPoint) BehaviorPointJSON {
	return BehaviorPointJSON{
		X:    ep.X,
		Y:    ep.Y,
		Type: ep.Type.String(),
	}
}

func BehaviorPointFromJSON(epj BehaviorPointJSON) simulation.BehaviorPoint {
	var pt simulation.BehaviorPointType
	switch epj.Type {
	case "curve":
		pt = simulation.Curve
	case "break":
		pt = simulation.Break
	default:
		pt = simulation.Curve // fallback
	}
	return simulation.BehaviorPoint{
		X:    epj.X,
		Y:    epj.Y,
		Type: pt,
	}
}

func NetworkBehaviorToJSON(nb simulation.NetworkBehavior) NetworkBehaviorJSON {
	dropRate := GenericMap(nb.DropRate, BehaviorPointToJSON)
	latencyMin := GenericMap(nb.LatencyMin, BehaviorPointToJSON)
	latencyMax := GenericMap(nb.LatencyMax, BehaviorPointToJSON)
	return NetworkBehaviorJSON{
		To:          nb.To,
		LatencyFrom: nb.LatencyFrom,
		LatencyTo:   nb.LatencyTo,
		DropRate:    dropRate,
		LatencyMin:  latencyMin,
		LatencyMax:  latencyMax,
	}
}

func NetworkBehaviorFromJSON(nbj NetworkBehaviorJSON) simulation.NetworkBehavior {
	dropRate := GenericMap(nbj.DropRate, BehaviorPointFromJSON)
	latencyMin := GenericMap(nbj.LatencyMin, BehaviorPointFromJSON)
	latencyMax := GenericMap(nbj.LatencyMax, BehaviorPointFromJSON)
	return simulation.NetworkBehavior{
		To:          nbj.To,
		LatencyFrom: nbj.LatencyFrom,
		LatencyTo:   nbj.LatencyTo,
		DropRate:    dropRate,
		LatencyMin:  latencyMin,
		LatencyMax:  latencyMax,
	}
}

func ServerBehaviorToJSON(sb simulation.ServerBehavior) ServerBehaviorJSON {
	responseTimeMin := GenericMap(sb.ResponseTimeMin, BehaviorPointToJSON)
	responseTimeMax := GenericMap(sb.ResponseTimeMax, BehaviorPointToJSON)
	errors := GenericMap(sb.Errors, BehaviorPointToJSON)
	return ServerBehaviorJSON{
		To:                       sb.To,
		ResponseTimeFrom:         sb.ResponseTimeFrom,
		ResponseTimeTo:           sb.ResponseTimeTo,
		ReponseTimeMin:           responseTimeMin,
		ReponseTimeMax:           responseTimeMax,
		Errors:                   errors,
		EnableResourceManagement: sb.EnableResourceManagement,
		Resources: ServerResourcesJSON{
			MaxConcurrentRequests:  sb.ResourceSettings.MaxConcurrentRequests,
			MaxMemoryMB:            sb.ResourceSettings.MaxMemoryMB,
			MaxQueueSize:           sb.ResourceSettings.MaxQueueSize,
			MemoryLeakRateMBPerSec: sb.ResourceSettings.MemoryLeakRateMBPerSec,
			MemoryPerRequestMB:     sb.ResourceSettings.MemoryPerRequestMB,
			GCPauseIntervalSec:     sb.ResourceSettings.GCPauseIntervalSec,
			GCPauseDurationMs:      sb.ResourceSettings.GCPauseDurationMs,
		},
	}
}

func ServerBehaviorFromJSON(sbj ServerBehaviorJSON) simulation.ServerBehavior {
	responseTimeMin := GenericMap(sbj.ReponseTimeMin, BehaviorPointFromJSON)
	responseTimeMax := GenericMap(sbj.ReponseTimeMax, BehaviorPointFromJSON)
	errors := GenericMap(sbj.Errors, BehaviorPointFromJSON)
	return simulation.ServerBehavior{
		To:                       sbj.To,
		ResponseTimeFrom:         sbj.ResponseTimeFrom,
		ResponseTimeTo:           sbj.ResponseTimeTo,
		ResponseTimeMin:          responseTimeMin,
		ResponseTimeMax:          responseTimeMax,
		Errors:                   errors,
		EnableResourceManagement: sbj.EnableResourceManagement,
		ResourceSettings: simulation.ResourceSettings{
			MaxConcurrentRequests:  sbj.Resources.MaxConcurrentRequests,
			MaxMemoryMB:            sbj.Resources.MaxMemoryMB,
			MaxQueueSize:           sbj.Resources.MaxQueueSize,
			MemoryLeakRateMBPerSec: sbj.Resources.MemoryLeakRateMBPerSec,
			MemoryPerRequestMB:     sbj.Resources.MemoryPerRequestMB,
			GCPauseIntervalSec:     sbj.Resources.GCPauseIntervalSec,
			GCPauseDurationMs:      sbj.Resources.GCPauseDurationMs,
		},
	}
}

// GenericMap takes a slice of type S and a function that transforms S to D,
// returning a new slice of type D.
func GenericMap[S, D any](slice []S, fn func(S) D) []D {
	if slice == nil {
		return nil
	}

	result := make([]D, len(slice))
	for i, v := range slice {
		result[i] = fn(v)
	}

	return result
}

// func ServerResourceMetricsToJSON(sr simulation.ResourceState) ServerResourceMetricsJSON {
// 	return ServerResourceMetricsJSON{
// 		CPUUtilization:     sr.CPUUtilization,
// 		MemoryUtilization:  sr.MemoryUtilization,
// 		ActiveRequests:     sr.ActiveRequests,
// 		CurrentMemoryMB:    sr.CurrentMemoryMB,
// 		QueuedRequests:     sr.QueuedRequests,
// 		QueueUtilization:   sr.QueueUtilization,
// 		AverageQueueTimeMs: sr.AverageQueueTimeMs,
// 		MaxQueueTimeMs:     sr.MaxQueueTimeMs,
// 	}
// }
