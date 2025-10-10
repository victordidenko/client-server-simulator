package simulation

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// Simulation manages the overall simulation including clients, network, and metrics
type Simulation struct {
	Id             string
	server         *Server
	network        *Network
	clients        []*Client
	clientsConfigs []ClientConfig
	metrics        *Metrics
	ctx            context.Context
	cancel         context.CancelFunc
	running        atomic.Bool
	startedAt      atomic.Int64
	wg             sync.WaitGroup
	mu             sync.Mutex
}

// ClientConfig stores configuration for a group of clients
type ClientConfig struct {
	Id          string // Unique identifier for the client group
	Count       int
	RequestRate time.Duration
	RampUpTime  time.Duration
	Delay       time.Duration
	Behavior    string
}

// NewSimulation creates a new simulation with default settings
func NewSimulation(index int64) *Simulation {
	id := fmt.Sprintf("simulation-%d", index)
	metrics := NewMetrics()
	server := NewServer(fmt.Sprintf("server-%d", index), metrics)
	network := NewNetwork(server, metrics)

	return &Simulation{
		Id:      id,
		server:  server,
		network: network,
		metrics: metrics,
	}
}

// IsRunning returns whether the simulation is currently running
func (s *Simulation) IsRunning() bool {
	return s.running.Load()
}

// StartedAt returns the time when the simulation was started
func (s *Simulation) StartedAt() int64 {
	return s.startedAt.Load()
}

// GetServerBehavior returns the current server behavior state (internal struct)
func (s *Simulation) GetServerBehavior() ServerBehavior {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.server == nil {
		return ServerBehavior{}
	}
	return s.server.GetBehavior()
}

// SetServerBehavior sets the server behavior state (internal struct)
func (s *Simulation) SetServerBehavior(behavior ServerBehavior) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.server != nil {
		s.server.SetBehavior(behavior)
	}
}

// ResetServerBehavior resets the server behavior state to default
func (s *Simulation) ResetServerBehavior() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.server != nil {
		s.server.ResetBehavior()
	}
}

// GetNetworkBehavior returns the current network behavior state (internal struct)
func (s *Simulation) GetNetworkBehavior() NetworkBehavior {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.network == nil {
		return NetworkBehavior{}
	}
	return s.network.GetBehavior()
}

// SetNetworkBehavior sets the network behavior state (internal struct)
func (s *Simulation) SetNetworkBehavior(behavior NetworkBehavior) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.network != nil {
		s.network.SetBehavior(behavior)
	}
}

// ResetNetworkBehavior resets the network behavior state to default
func (s *Simulation) ResetNetworkBehavior() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.network != nil {
		s.network.ResetBehavior()
	}
}

// GetMetricsSnapshot returns the current metrics snapshot
func (s *Simulation) GetMetricsSnapshot() map[string]any {
	return s.metrics.GetSnapshot()
}

// GetClientConfigs returns the current client configurations
func (s *Simulation) GetClientConfigs() []ClientConfig {
	return s.clientsConfigs
}

// GetClientConfigById returns a single client config by id
func (s *Simulation) GetClientConfigById(id string) (ClientConfig, error) {
	for _, cfg := range s.clientsConfigs {
		if cfg.Id == id {
			return cfg, nil
		}
	}
	return ClientConfig{}, fmt.Errorf("Client group with id '%s' not found", id)
}

// UpdateClientConfig updates a client config by id
func (s *Simulation) UpdateClientConfig(id string, count int, requestRate, rampUpTime, delay time.Duration, behavior string) error {
	if s.running.Load() {
		return fmt.Errorf("Simulation: Error: Cannot update client configs while running")
	}

	for i, cfg := range s.clientsConfigs {
		if cfg.Id == id {
			s.clientsConfigs[i] = ClientConfig{
				Id:          id,
				Count:       count,
				RequestRate: requestRate,
				RampUpTime:  rampUpTime,
				Delay:       delay,
				Behavior:    behavior,
			}
			return nil
		}
	}

	return fmt.Errorf("Client group with id '%s' not found", id)
}

// AddClientsConfig adds a client configuration without starting the clients
func (s *Simulation) AddClientsConfig(id string, count int, requestRate, rampUpTime, delay time.Duration, behavior string) error {
	if s.running.Load() {
		return fmt.Errorf("Simulation: Error: Cannot add clients configs while running")
	}

	s.clientsConfigs = append(s.clientsConfigs, ClientConfig{
		Id:          id,
		Count:       count,
		RequestRate: requestRate,
		RampUpTime:  rampUpTime,
		Delay:       delay,
		Behavior:    behavior,
	})

	return nil
}

// DeleteClientConfigById removes a client configuration by its Id
func (s *Simulation) DeleteClientConfigById(id string) error {
	if s.running.Load() {
		return fmt.Errorf("Simulation: Error: Cannot delete client configs while running")
	}
	for i, cfg := range s.clientsConfigs {
		if cfg.Id == id {
			s.clientsConfigs = append(s.clientsConfigs[:i], s.clientsConfigs[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("Client group with id '%s' not found", id)
}

// ClearClientConfigs removes all client configurations
func (s *Simulation) ClearClientConfigs() error {
	if s.running.Load() {
		return fmt.Errorf("Simulation: Error: Cannot add clients configs while running")
	}

	s.clientsConfigs = nil

	return nil
}

// Start initializes and starts the simulation
func (s *Simulation) Start() context.Context {
	if !s.running.CompareAndSwap(false, true) {
		return nil
	}

	log.Println("Simulation: Starting...")

	ctx, cancel := context.WithCancel(context.Background())
	s.ctx = ctx
	s.cancel = cancel

	s.startedAt.Store(time.Now().UnixMilli())

	s.server.Start(ctx)
	s.wg.Go(s.run)

	return s.ctx
}

// Stop terminates the simulation
func (s *Simulation) Stop() {
	if !s.running.CompareAndSwap(true, false) {
		return
	}

	log.Println("Simulation: Stopping...")

	s.cancel()

	s.mu.Lock()
	for _, client := range s.clients {
		s.wg.Go(client.Stop)
	}
	s.clients = nil
	s.mu.Unlock()

	s.server.Shutdown()

	s.wg.Wait()

	s.ResetServerBehavior()
	s.ResetNetworkBehavior()
}

// run creates and starts all clients based on configurations
func (s *Simulation) run() {
	for groupIndex, config := range s.clientsConfigs {
		var delay time.Duration
		if config.RampUpTime <= 0 {
			delay = 0
			log.Printf("Simulation: Starting %d clients (almost) immediately\n", config.Count)
		} else {
			delay = config.RampUpTime / time.Duration(config.Count)
			log.Printf("Simulation: Starting %d clients gradually over %v seconds\n", config.Count, config.RampUpTime.Seconds())
		}

		for clientIndex := 0; clientIndex < config.Count; clientIndex++ {
			s.wg.Go(func() {
				jitterPercent := 0.5 // jitter = ±50% of delay
				jitter := time.Duration(float64(delay) * jitterPercent * (rand.Float64()*2 - 1))
				actualDelay := config.Delay + delay*time.Duration(clientIndex) + jitter
				s.startClientIn(
					actualDelay,
					config.Id,
					groupIndex,
					clientIndex,
					config.RequestRate,
					config.Behavior,
				)
			})
		}
	}
}

// startClientIn starts single client with the given delay
func (s *Simulation) startClientIn(delay time.Duration, groupId string, groupIndex, clientIndex int, requestRate time.Duration, behavior string) {
	err := SleepWithContext(s.ctx, delay)
	if err != nil {
		// log.Printf("Simulation: Warning: Failed to start client %d-%d, because simulation was cancelled", groupIndex, clientIndex)
		return
	}

	client := NewClient(
		fmt.Sprintf("client-%d-%d", groupIndex, clientIndex),
		groupId,
		s.network,
		s.metrics,
		behavior,
	)

	s.mu.Lock()
	s.clients = append(s.clients, client)
	s.mu.Unlock()

	client.Start(s.ctx, requestRate)
}
