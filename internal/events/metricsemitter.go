package events

import (
	"context"
	"log"
	"time"
)

// MetricsCtxWatcher represents a context and a metrics function for handle simulation runs
type MetricsCtxWatcher struct {
	ctx     context.Context
	metrics func() map[string]any
}

// MetricsEmitter represents a metrics emitter
type MetricsEmitter struct {
	events *EventsHub[map[string]any]
	watch  chan MetricsCtxWatcher
}

// NewMetricsEmitter creates a new MetricsEmitter instance
func NewMetricsEmitter() *MetricsEmitter {
	me := &MetricsEmitter{
		events: NewEventsHub[map[string]any](),
		watch:  make(chan MetricsCtxWatcher),
	}

	log.Println("MetricsEmitter: Starting...")
	go me.run()

	return me
}

// WatchSimulationRun registers new simulation run
func (me *MetricsEmitter) WatchSimulationRun(ctx context.Context, metrics func() map[string]any) {
	me.watch <- MetricsCtxWatcher{
		ctx:     ctx,
		metrics: metrics,
	}
}

// Subscribe registers a new subscriber to the metrics emitter
func (me *MetricsEmitter) Subscribe(bufferSize int) chan map[string]any {
	return me.events.Subscribe(bufferSize)
}

// Unsubscribe removes a subscriber from the metrics emitter
func (me *MetricsEmitter) Unsubscribe(subCh chan map[string]any) {
	me.events.Unsubscribe(subCh)
}

// run starts the metrics emitter
func (me *MetricsEmitter) run() {
	defer log.Println("MetricsEmitter: Stopped")
	for {
		run := <-me.watch
		log.Println("MetricsEmitter: Got new simulation run")

		ctx := run.ctx
		metrics := run.metrics
		ticker := time.NewTicker(200 * time.Millisecond)

	run:
		for {
			select {
			case <-ctx.Done():
				log.Println("MetricsEmitter: Current simulation context cancelled, stopping metric emission for this simulation run")
				break run

			case <-ticker.C:
				snapshot := metrics()
				// log.Printf("MetricsEmitter: Publishing metrics: %+v\n", snapshot)
				me.events.Publish(snapshot)
				// log.Printf("MetricsEmitter: Published: %s\n", snapshot)
			}
		}

		ticker.Stop()
	}
}
