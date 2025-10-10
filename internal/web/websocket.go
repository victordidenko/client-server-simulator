package web

import (
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket write pump constants
const (
	writeWait  = 10 * time.Second    // Time allowed to write a message to the peer
	pongWait   = 60 * time.Second    // Time allowed to read the next pong message from the peer
	pingPeriod = (pongWait * 9) / 10 // Send pings to peer with this period (must be less than pongWait)
)

// WebSocketHub maintains the set of active websocket connections and broadcasts metrics to them
type WebSocketHub struct {
	clients              map[*WebSocketClient]bool // Registered clients
	register             chan *WebSocketClient     // Channel to register clients
	unregister           chan *WebSocketClient     // Channel to unregister clients
	broadcast            chan []byte               // Channel for broadcasting messages
	lastBroadcastTime    time.Time                 // Time of last broadcast
	minBroadcastInterval time.Duration             // Minimum interval between broadcasts
	mu                   sync.Mutex
}

// WebSocketClient represents a single websocket client connection
type WebSocketClient struct {
	hub          *WebSocketHub
	conn         *websocket.Conn
	sendBuffer   chan []byte
	registered   chan struct{}
	unregistered chan struct{}
	Name         string
}

// Upgrader contains websocket configuration
var Upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,

	// Allow all origins for development purposes
	// In production, you would want to restrict this
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Helper: generate a random name for a client
var adjectives = []string{"Quick", "Lazy", "Happy", "Sad", "Brave", "Clever", "Calm", "Bold"}
var animals = []string{"Fox", "Dog", "Cat", "Bear", "Wolf", "Lion", "Tiger", "Hawk"}

func randomName() string {
	return adjectives[rand.Intn(len(adjectives))] + animals[rand.Intn(len(animals))]
}

// GetClientNames returns a slice of all client names
func (h *WebSocketHub) GetClientNames() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	var names []string
	for c := range h.clients {
		names = append(names, c.Name)
	}
	return names
}

// NewWebSocketHub creates a new WebSocketHub
func NewWebSocketHub() *WebSocketHub {
	h := &WebSocketHub{
		clients:              make(map[*WebSocketClient]bool),
		register:             make(chan *WebSocketClient),
		unregister:           make(chan *WebSocketClient),
		broadcast:            make(chan []byte, 256),
		minBroadcastInterval: 100 * time.Millisecond,
	}

	go h.run()

	return h
}

// run starts the hub's main loop
func (h *WebSocketHub) run() {
	for {
		select {
		case client := <-h.register:
			log.Printf("WebSocketHub: Registering client %p (%s)", client, client.Name)
			h.mu.Lock()
			h.clients[client] = true
			log.Printf("WebSocketHub: Registered client %p (%s). Total clients: %d", client, client.Name, len(h.clients))
			h.mu.Unlock()
			close(client.registered) // Notify registration complete

		case client := <-h.unregister:
			log.Printf("WebSocketHub: Unregistering client %p (%s)", client, client.Name)
			h.mu.Lock()
			delete(h.clients, client)
			log.Printf("WebSocketHub: Unregistered client %p (%s). Total clients: %d", client, client.Name, len(h.clients))
			h.mu.Unlock()
			close(client.unregistered) // Notify deregistration complete

		case message := <-h.broadcast:
			h.lastBroadcastTime = time.Now()

			// Send to all clients
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.sendBuffer <- message:
					// log.Printf("WebSocketHub: Broadcasted message to client %p", client)
				default:
					log.Printf("WebSocketHub: Client %p (%s) buffer full during broadcast, closing connection", client, client.Name)
					// If client's buffer is full, close the connection
					close(client.sendBuffer)
					delete(h.clients, client)
				}
			}
			// log.Printf("WebSocketHub: Finished broadcasting to %d clients", len(h.clients))
			h.mu.Unlock()
		}
	}
}

// Broadcast sends the provided message to all connected clients
func (h *WebSocketHub) Broadcast(message []byte) {
	// Throttle broadcasts
	now := time.Now()
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.clients) > 0 && now.Sub(h.lastBroadcastTime) < h.minBroadcastInterval {
		log.Printf("WebSocketHub: Throttling broadcast, skipping update. Clients: %d\n", len(h.clients))
		return
	}

	select {
	case h.broadcast <- message:
		// log.Printf("WebSocketHub: Queued broadcast to %d clients. Message size: %d bytes\n", len(h.clients), len(message))
	default:
		log.Printf("WebSocketHub: Broadcast channel full, skipping update. Clients: %d\n", len(h.clients))
	}
}

// WritePump pumps messages from the hub to the websocket connection
func (c *WebSocketClient) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.sendBuffer:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				log.Printf("WebSocketClient %p (%s): sendBuffer closed, closing connection", c, c.Name)
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// log.Printf("WebSocketClient %p: Sending message of size %d bytes", c, len(message))
			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				log.Printf("WebSocketClient %p (%s): Error getting writer: %v", c, c.Name, err)
				return
			}

			_, err = w.Write(message)
			if err != nil {
				log.Printf("WebSocketClient %p (%s): Error writing message: %v", c, c.Name, err)
			}

			if err := w.Close(); err != nil {
				log.Printf("WebSocketClient %p (%s): Error closing writer: %v", c, c.Name, err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("WebSocketClient %p (%s): Error sending ping: %v", c, c.Name, err)
				return
			}
		}
	}
}

// NewWebSocketClient creates a new WebSocketClient and assigns a random name
func NewWebSocketClient(hub *WebSocketHub, conn *websocket.Conn, name string) *WebSocketClient {
	if name == "" {
		name = randomName()
	}

	return &WebSocketClient{
		hub:          hub,
		conn:         conn,
		sendBuffer:   make(chan []byte, 100), // Buffer capacity to handle more messages
		registered:   make(chan struct{}),
		unregistered: make(chan struct{}),
		Name:         name,
	}
}

// StartReader starts a reader goroutine to handle client disconnections
func (c *WebSocketClient) StartReader(unregisterFunc func(*WebSocketClient)) {
	go func() {
		defer func() {
			log.Printf("WebSocketClient: Reader goroutine exiting for client %p (%s)", c, c.Name)
			unregisterFunc(c)
			close(c.sendBuffer)
		}()

		for {
			// Read messages from the client (we don't really need them, but we need to handle the connection close)
			_, _, err := c.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocketClient: Unexpected close error for client %p (%s): %v", c, c.Name, err)
				} else {
					log.Printf("WebSocketClient: Read error for client %p (%s): %v", c, c.Name, err)
				}
				break
			} else {
				log.Printf("WebSocketClient: Received message from client %p (%s)", c, c.Name)
			}
		}
	}()
}
