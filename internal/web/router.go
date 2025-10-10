package web

import (
	"net/http"
)

// SetupRoutes initializes and registers all web routes for the simulation
func SetupRoutes(mux *http.ServeMux, d *Dashboard) {
	mux.HandleFunc("/api/simulation", SimulationHandler(d))
	mux.HandleFunc("/api/clients", ClientsHandler(d))
	mux.HandleFunc("/api/clients/", ClientsHandler(d))
	mux.HandleFunc("/api/server", ServerBehaviorHandler(d))
	mux.HandleFunc("/api/network", NetworkBehaviorHandler(d))
	mux.HandleFunc("/api/ws/metrics", WebSocketMetricsHandler(d, d.metricsWs))
	mux.HandleFunc("/api/ws/notifications", WebSocketNotifyHandler(d, d.notifyWs))
}
