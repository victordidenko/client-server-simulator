package events

import (
	"log"
)

// EventsHub is a generic event hub that manages subscriptions and publishes events to them
type EventsHub[T any] struct {
	publish     chan T
	register    chan chan T
	unregister  chan chan T
	subscribers map[chan T]struct{}
}

// NewEventsHub creates and starts a new EventsHub for a specific event type
func NewEventsHub[T any]() *EventsHub[T] {
	h := &EventsHub[T]{
		publish:     make(chan T, 10),
		register:    make(chan chan T),
		unregister:  make(chan chan T),
		subscribers: make(map[chan T]struct{}),
	}

	log.Println("EventsHub: Starting...")
	go h.run()

	return h
}

// Publish sends an event to all subscribers
func (h *EventsHub[T]) Publish(event T) {
	select {
	case h.publish <- event:
		// Event queued
	default:
		log.Printf("EventsHub: Error: Hub input buffer full, producer dropped event: %T", event)
	}
}

// Subscribe creates a new subscription channel with the specified buffer size and registers it with the hub
func (h *EventsHub[T]) Subscribe(bufferSize int) chan T {
	subCh := make(chan T, bufferSize)
	h.register <- subCh
	return subCh
}

// Unsubscribe removes a subscription channel from the hub and closes it
func (h *EventsHub[T]) Unsubscribe(subCh chan T) {
	h.unregister <- subCh
}

// run starts the event hub and handles incoming events, subscriptions, and unsubscriptions
func (h *EventsHub[T]) run() {
	defer log.Println("EventsHub: Stopped")
	for {
		select {
		case event := <-h.publish:
			for subCh := range h.subscribers {
				select {
				case subCh <- event:
					// Sent
				default:
					log.Printf("EventsHub: Error: Subscriber channel full, dropped event for one subscriber: %T", event)
				}
			}

		case newSub := <-h.register:
			h.subscribers[newSub] = struct{}{}
			log.Printf("EventsHub: New subscriber registered. Total: %d", len(h.subscribers))

		case oldSub := <-h.unregister:
			if _, ok := h.subscribers[oldSub]; ok {
				delete(h.subscribers, oldSub)
				close(oldSub)
				log.Printf("EventsHub: Subscriber unregistered. Total: %d", len(h.subscribers))
			}
		}
	}
}
