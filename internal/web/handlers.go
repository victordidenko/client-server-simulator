package web

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// SimulationHandler handles simulation management requests
func SimulationHandler(d *Dashboard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// GET /api/simulation
		// Get Simulation Status and State
		if r.Method == "GET" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(SimulationDto(d))
			return
		}

		// POST /api/simulation
		// Reset (or Create) Simulation
		if r.Method == "POST" {
			log.Println("[POST /api/simulation] Resetting simulation")
			d.ResetSimulation()
			w.WriteHeader(http.StatusOK)
			return
		}

		// PUT /api/simulation
		// Start Simulation (with optional time limit)
		if r.Method == "PUT" {
			log.Println("[PUT /api/simulation] Starting simulation")

			if d.simulation != nil && len(d.simulation.GetClientConfigs()) == 0 {
				log.Println("[PUT /api/simulation] Error: No client configurations")
				http.Error(w, "No client configurations", http.StatusBadRequest)
				return
			}

			// Parse limit from query or body
			limitSeconds := 0
			limitStr := r.URL.Query().Get("limit")
			if limitStr != "" {
				if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
					limitSeconds = v
				}
			} else {
				// Try to parse from JSON body
				var body struct {
					Limit int `json:"limit"`
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err == nil && body.Limit > 0 {
					limitSeconds = body.Limit
				}
			}

			d.StartSimulation(limitSeconds)
			w.WriteHeader(http.StatusOK)
			return
		}

		// DELETE /api/simulation
		// Stop Simulation
		if r.Method == "DELETE" {
			log.Println("[DELETE /api/simulation] Stopping simulation")
			d.StopSimulation()
			w.WriteHeader(http.StatusOK)
			return
		}

		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// ClientsHandler handles getting and adding client configurations
func ClientsHandler(d *Dashboard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		parts := strings.Split(r.URL.Path, "/")

		// GET /api/clients
		// Get all client configurations
		if r.Method == "GET" && len(parts) == 3 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(d.GetClientConfigs())
			return
		}

		// POST /api/clients
		// Add new clients group configuration
		if r.Method == "POST" && len(parts) == 3 {
			log.Println("[POST /api/clients] Adding new clients group configuration")

			var config ClientConfigJSON
			err := json.NewDecoder(r.Body).Decode(&config)
			if err != nil {
				log.Printf("[POST /api/clients] Error decoding request body: %v", err)
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			err = d.AddClientConfig(config)
			if err != nil {
				log.Printf("[POST /api/clients] Error adding new clients group configuration: %v", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			return
		}

		// DELETE /api/clients
		// Delete all client group configurations
		if r.Method == "DELETE" && len(parts) == 3 {
			log.Println("[DELETE /api/clients] Deleting all clients group configurations")
			err := d.ClearClientConfigs()
			if err != nil {
				log.Printf("[DELETE /api/clients] Error deleting all client group configurations: %v", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		// GET /api/clients/{id}
		// Get client group configuration by ID
		if r.Method == "GET" && len(parts) == 4 {
			id := parts[3]
			config, err := d.GetClientConfigById(id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(config)
			return
		}

		// PUT /api/clients/{id}
		// Update client group configuration by ID
		if r.Method == "PUT" && len(parts) == 4 {
			id := parts[3]
			var config ClientConfigJSON
			if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			err := d.UpdateClientConfig(id, config)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		// DELETE /api/clients/{id}
		// Delete client group configuration by ID
		if r.Method == "DELETE" && len(parts) == 4 {
			id := parts[3]
			log.Printf("[DELETE /api/clients/%s] Deleting client group configuration", id)
			err := d.DeleteClientConfigById(id)
			if err != nil {
				log.Printf("[DELETE /api/clients/%s] Error deleting client group configuration: %v", id, err)
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}

		http.Error(w, "Invalid method or path", http.StatusBadRequest)
	}
}

func ServerBehaviorHandler(d *Dashboard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// GET /api/server
		// Get server behavior
		if r.Method == "GET" {
			behavior, err := d.GetServerBehavior()
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(behavior)
			return
		}

		// PUT /api/server
		// Update server behavior
		if r.Method == "PUT" {
			var behaviorDTO ServerBehaviorJSON
			err := json.NewDecoder(r.Body).Decode(&behaviorDTO)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			err = d.SetServerBehavior(behaviorDTO)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			return
		}

		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// NetworkBehaviorHandler handles getting and setting network behavior
func NetworkBehaviorHandler(d *Dashboard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// GET /api/network
		// Get network behavior
		if r.Method == "GET" {
			behavior, err := d.GetNetworkBehavior()
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(behavior)
			return
		}

		// PUT /api/network
		// Update network behavior
		if r.Method == "PUT" {
			var behaviorDTO NetworkBehaviorJSON
			err := json.NewDecoder(r.Body).Decode(&behaviorDTO)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			err = d.SetNetworkBehavior(behaviorDTO)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			return
		}

		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

// WebSocketMetricsHandler handles WebSocket connections for streaming metrics
func WebSocketMetricsHandler(d *Dashboard, ws *WebSocketHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := Upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "Could not upgrade connection", http.StatusInternalServerError)
			return
		}

		// Get optional name from query parameter
		name := r.URL.Query().Get("name")

		// Create a client with buffer and name
		client := NewWebSocketClient(ws, conn, name)

		// Register this client with the hub
		ws.register <- client

		// Start writer goroutine
		go client.WritePump()

		// Setup reader to handle client disconnections
		client.StartReader(func(c *WebSocketClient) {
			ws.unregister <- c
		})
	}
}

// WebSocketNotifyHandler handles WebSocket connections for notifications (non-metrics)
func WebSocketNotifyHandler(d *Dashboard, ws *WebSocketHub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := Upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "Could not upgrade connection", http.StatusInternalServerError)
			return
		}

		// Get optional name from query parameter
		name := r.URL.Query().Get("name")

		// Create a client with buffer and name
		client := NewWebSocketClient(ws, conn, name)

		// Register this client with the hub
		ws.register <- client

		// Start writer goroutine
		go client.WritePump()

		// Setup reader to handle client disconnections
		client.StartReader(func(c *WebSocketClient) {
			ws.unregister <- c

			// Wait until deregistration is complete
			<-c.unregistered

			// Broadcast left message with all remaining client names
			leftMsg := map[string]any{
				"type": "left",
				"payload": map[string]any{
					"left": c.Name,
					"all":  ws.GetClientNames(),
				},
				"timestamp": time.Now().UnixMilli(),
			}
			msgBytes, _ := json.Marshal(leftMsg)
			ws.Broadcast(msgBytes)
		})

		// Wait until registration is complete
		<-client.registered

		// Broadcast joined message with all client names (including the new one)
		joinedMsg := map[string]any{
			"type": "joined",
			"payload": map[string]any{
				"joined": client.Name,
				"all":    ws.GetClientNames(),
			},
			"timestamp": time.Now().UnixMilli(),
		}
		msgBytes, _ := json.Marshal(joinedMsg)
		ws.Broadcast(msgBytes)
	}
}
