package web

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"request-policy/internal/events"
	"request-policy/internal/simulation"
)

// Dashboard implements web ui dashboard to manage and visualize the simulation
type Dashboard struct {
	simulation *simulation.Simulation
	metrics    *events.MetricsEmitter
	mux        *http.ServeMux
	metricsWs  *WebSocketHub
	notifyWs   *WebSocketHub
	runIndex   atomic.Int64
	mu         sync.RWMutex
	stopTimer  *time.Timer // Timer for simulation time limit
}

// NewDashboard creates a new instance of Dashboard
func NewDashboard() *Dashboard {
	d := &Dashboard{
		metrics:   events.NewMetricsEmitter(),
		mux:       http.NewServeMux(),
		metricsWs: NewWebSocketHub(),
		notifyWs:  NewWebSocketHub(),
	}

	log.Println("Dashboard: Setup routes")
	SetupRoutes(d.mux, d)

	log.Println("Dashboard: Starting metrics forwarding goroutine")
	go d.startMetricsForwarding()

	return d
}

// ListenAndServe starts the dashboard web server
func (d *Dashboard) ListenAndServe() {
	log.Println("Dashboard: Available at http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", d.mux))
}

// Notify sends a notification message to all connected notifyWs clients
func (d *Dashboard) Notify(eventType string, payload any) {
	msg := map[string]any{
		"type":      eventType,
		"payload":   payload,
		"timestamp": time.Now().UnixMilli(),
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Dashboard: Error marshalling notification: %v", err)
		return
	}
	d.notifyWs.Broadcast(data)
}

// resetSimulationUnsafe resets the simulation without locking the mutex
func (d *Dashboard) resetSimulationUnsafe() {
	if d.simulation != nil {
		log.Println("Dashboard: Stopping previous simulation")
		d.simulation.Stop()
	}

	log.Println("Dashboard: Added default client configuration: 100 clients with 3s ramp-up time and 0s delay")
	d.simulation = simulation.NewSimulation(d.runIndex.Add(1))

	id := fmt.Sprintf("%08x", rand.Uint32()) // random hex (8 characters)
	d.simulation.AddClientsConfig(           // 100 clients, 100ms request rate, 3 seconds ramp-up time, 0 delay
		id,                   // id
		100,                  // count
		100*time.Millisecond, // requestRate
		3*time.Second,        // rampUpTime
		0,                    // delay
		"",                   // behavior
	)
}

// stopSimulationTimer stops and clears the simulation stop timer if it exists
func (d *Dashboard) stopSimulationTimer() {
	if d.stopTimer != nil {
		d.stopTimer.Stop()
		d.stopTimer = nil
	}
}

// ResetSimulation resets the simulation
func (d *Dashboard) ResetSimulation() {
	log.Println("Dashboard: Reset simulation")
	d.mu.Lock()
	defer d.mu.Unlock()

	d.stopSimulationTimer()

	log.Println("Dashboard: Create new simulation before start")
	d.resetSimulationUnsafe()

	d.Notify("simulation_reset", nil)
}

// StartSimulation starts the simulation, with optional time limit in seconds
func (d *Dashboard) StartSimulation(limitSeconds ...int) {
	log.Println("Dashboard: Start simulation")
	d.mu.Lock()
	defer d.mu.Unlock()

	// Stop any previous timer
	d.stopSimulationTimer()

	if d.simulation == nil {
		log.Println("Dashboard: No simulation found, create new simulation before start")
		d.resetSimulationUnsafe()
	}

	log.Println("Dashboard: Starting simulation...")
	ctx := d.simulation.Start()

	if ctx == nil {
		log.Println("Dashboard: Simulation already running")
		return
	}

	d.metrics.WatchSimulationRun(ctx, d.simulation.GetMetricsSnapshot)

	d.Notify("simulation_started", nil)

	// If a limit is provided, schedule stop
	if len(limitSeconds) > 0 && limitSeconds[0] > 0 {
		limit := time.Duration(limitSeconds[0]) * time.Second
		d.stopTimer = time.AfterFunc(limit, func() {
			log.Printf("Dashboard: Simulation time limit (%ds) reached, stopping simulation", limitSeconds[0])
			d.StopSimulation()
		})
	}
}

// StopSimulation stops the simulation
func (d *Dashboard) StopSimulation() {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Stop any running timer
	d.stopSimulationTimer()

	if d.simulation == nil {
		return
	}

	log.Println("Dashboard: Stopping simulation...")
	d.simulation.Stop()

	d.Notify("simulation_stopped", nil)
}

// startMetricsForwarding starts forwarding metrics from MetricsEmitter to WebSocketHub
func (d *Dashboard) startMetricsForwarding() {
	metricsCh := d.metrics.Subscribe(10)
	defer d.metrics.Unsubscribe(metricsCh)

	for metrics := range metricsCh {
		// log.Println("Dashboard: Metrics forwarding goroutine received metrics from metricsCh")

		metricsData, err := json.Marshal(metrics)
		if err != nil {
			log.Printf("Dashboard: Error marshalling metrics: %v", err)
			continue
		}

		// log.Printf("Dashboard: Forwarding metrics to WebSocket: %s", string(metricsData))
		d.metricsWs.Broadcast(metricsData)
	}
}

// GetClientConfigs returns the current client configs as DTOs
func (d *Dashboard) GetClientConfigs() []ClientConfigJSON {
	d.mu.Lock()
	defer d.mu.Unlock()

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

// AddClientConfig adds a new client config from DTO
func (d *Dashboard) AddClientConfig(config ClientConfigJSON) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return fmt.Errorf("Simulation does not exist")
	}

	err := d.simulation.AddClientsConfig(
		config.Id,
		config.Count,
		time.Duration(config.RequestRate)*time.Millisecond,
		time.Duration(config.RampUpTime)*time.Millisecond,
		time.Duration(config.Delay)*time.Millisecond,
		config.Behavior,
	)

	if err == nil {
		d.Notify("client_config_added", config)
	}

	return err
}

// ClearClientConfigs removes all client configs
func (d *Dashboard) ClearClientConfigs() error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return fmt.Errorf("Simulation does not exist")
	}

	err := d.simulation.ClearClientConfigs()

	if err == nil {
		d.Notify("client_configs_cleared", nil)
	}

	return err
}

// DeleteClientConfigById removes a client config by id
func (d *Dashboard) DeleteClientConfigById(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return fmt.Errorf("Simulation does not exist")
	}

	err := d.simulation.DeleteClientConfigById(id)

	if err == nil {
		d.Notify("client_config_deleted", id)
	}

	return err
}

// GetClientConfigById returns a single client config by id as DTO
func (d *Dashboard) GetClientConfigById(id string) (ClientConfigJSON, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return ClientConfigJSON{}, fmt.Errorf("Simulation does not exist")
	}

	config, err := d.simulation.GetClientConfigById(id)
	if err != nil {
		return ClientConfigJSON{}, err
	}
	return ClientConfigJSON{
		Id:          config.Id,
		Count:       config.Count,
		RequestRate: int(config.RequestRate / time.Millisecond),
		RampUpTime:  int(config.RampUpTime / time.Millisecond),
		Delay:       int(config.Delay / time.Millisecond),
		Behavior:    config.Behavior,
	}, nil
}

// UpdateClientConfig updates a client config by id from DTO
func (d *Dashboard) UpdateClientConfig(id string, config ClientConfigJSON) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return fmt.Errorf("Simulation does not exist")
	}

	err := d.simulation.UpdateClientConfig(
		id,
		config.Count,
		time.Duration(config.RequestRate)*time.Millisecond,
		time.Duration(config.RampUpTime)*time.Millisecond,
		time.Duration(config.Delay)*time.Millisecond,
		config.Behavior,
	)

	if err == nil {
		d.Notify("client_config_updated", config)
	}

	return err
}

// GetServerBehavior returns the current server behavior as DTO, or error if simulation does not exist
func (d *Dashboard) GetServerBehavior() (ServerBehaviorJSON, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return ServerBehaviorJSON{}, fmt.Errorf("Simulation does not exist")
	}

	return ServerBehaviorToJSON(d.simulation.GetServerBehavior()), nil
}

// SetServerBehavior sets the server behavior from DTO
func (d *Dashboard) SetServerBehavior(behaviorDTO ServerBehaviorJSON) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return fmt.Errorf("Simulation does not exist")
	}

	behavior := ServerBehaviorFromJSON(behaviorDTO)
	d.simulation.SetServerBehavior(behavior)

	d.Notify("server_behavior_updated", behaviorDTO)

	return nil
}

// GetNetworkBehavior returns the current network behavior as internal struct, or error if simulation does not exist
func (d *Dashboard) GetNetworkBehavior() (NetworkBehaviorJSON, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return NetworkBehaviorJSON{}, fmt.Errorf("Simulation does not exist")
	}

	return NetworkBehaviorToJSON(d.simulation.GetNetworkBehavior()), nil
}

// SetNetworkBehavior sets the network behavior from internal struct
func (d *Dashboard) SetNetworkBehavior(behaviorDTO NetworkBehaviorJSON) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.simulation == nil {
		return fmt.Errorf("Simulation does not exist")
	}

	behavior := NetworkBehaviorFromJSON(behaviorDTO)
	d.simulation.SetNetworkBehavior(behavior)

	d.Notify("network_behavior_updated", behaviorDTO)

	return nil
}
