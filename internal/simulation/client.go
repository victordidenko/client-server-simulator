package simulation

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go.starlark.net/starlark"
)

// Client implements a client that makes requests to the server through a network simulator
type Client struct {
	id          string
	group       string
	network     *Network
	metrics     *Metrics
	running     atomic.Bool
	requestRate time.Duration
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
	behavior    ClientBehavior
	mu          sync.RWMutex
}

// NewClient creates a new client with the specified parameters
// Accepts an optional behavior string. If empty, uses the default.
func NewClient(id string, group string, network *Network, metrics *Metrics, behaviorScript string) *Client {
	var behavior ClientBehavior

	if len(strings.TrimSpace(behaviorScript)) == 0 {
		behavior = NewNoopClientBehavior()
	} else {
		var err error
		behavior, err = NewStarlarkClientBehavior(behaviorScript)
		if err != nil {
			log.Printf("Error evaluating client behavior: %v", err)
			behavior = NewNoopClientBehavior()
		}
	}

	return &Client{
		id:       id,
		group:    group,
		network:  network,
		metrics:  metrics,
		behavior: behavior,
	}
}

// SetBehavior replaces the active Starlark behavior for this client
func (c *Client) SetBehavior(behavior ClientBehavior) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.behavior != nil {
		c.behavior.Close()
	}
	c.behavior = behavior
}

// GetBehavior returns the current Starlark behavior (may be nil)
func (c *Client) GetBehavior() ClientBehavior {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.behavior
}

// Start begins sending requests at the specified rate
func (c *Client) Start(simulationCtx context.Context, requestRate time.Duration) {
	if !c.running.CompareAndSwap(false, true) {
		return
	}

	c.ctx, c.cancel = context.WithCancel(simulationCtx)
	c.requestRate = requestRate

	c.wg.Go(c.runWithJitter)
}

// Stop halts the client's request sending
func (c *Client) Stop() {
	c.cancel()
	c.behavior.Close()
	c.wg.Wait()
	c.running.Store(false)
}

// runWithJitter is the main client loop that sends requests at the specified rate with jitter
func (c *Client) runWithJitter() {
	c.metrics.AddActiveClient(c.group)
	defer c.metrics.RemoveActiveClient(c.group)
	defer c.running.Store(false)

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}

		// Schedule request
		c.wg.Go(func() {
			req := &Request{
				Id:        fmt.Sprintf("%s-%d", c.id, time.Now().UnixNano()),
				ClientId:  c.id,
				Data:      "test data",
				Timestamp: time.Now(),
				Meta:      starlark.NewDict(0), // Initialize empty dict for starlark metadata to save between hooks calls

			}
			c.requestWithHooks(req)
		})

		// Calculate next interval with jitter
		jitterPercent := 0.2 // 20% jitter
		jitter := time.Duration(float64(c.requestRate) * jitterPercent * (rand.Float64()*2 - 1))
		nextInterval := c.requestRate + jitter

		SleepWithContext(c.ctx, nextInterval)
	}
}

// requestWithHooks sends a single request with retry logic (non-recursive)
func (c *Client) requestWithHooks(req *Request) {
	c.mu.RLock()
	behavior := c.behavior
	c.mu.RUnlock()

	isRetry := false
	var timeout time.Duration = 0

	for {
		// Pre-request evaluation loop
		for {
			allow, delayMs, timeoutMs, err := behavior.OnRequest(req)
			if err != nil {
				log.Printf("Error evaluating client behavior: %v", err)
			}

			// Request blocked by client behavior
			if !allow {
				c.metrics.ClientBlockedRequests.Add(1)
				return
			}

			// Client behavior asked to delay request
			if delayMs > 0 {
				err := SleepWithContext(c.ctx, time.Duration(delayMs)*time.Millisecond)
				if err != nil {
					return // Context canceled, cancel scheduled request
				}
				continue // Re-evaluate on_request after delay
			}

			// Get request timeout
			if timeoutMs > 0 {
				timeout = time.Duration(timeoutMs) * time.Millisecond
			}

			break // Allowed, proceed to send
		}

		c.metrics.ClientSentRequests.Add(1)
		if isRetry {
			c.metrics.ClientRetryRequests.Add(1)
		}

		start := time.Now()
		resp, err := c.sendRequest(req, timeout)
		responseTime := time.Since(start)

		c.metrics.recordResponseTime(responseTime)

		var shouldRetry bool
		var retryDelayMs int

		if err == nil {
			if resp.Ok {
				c.metrics.ClientSuccessResponses.Add(1)

				berr := behavior.OnResponse(req, &resp)
				if berr != nil {
					log.Printf("Error evaluating client behavior: %v", berr)
				}

				// Successful response, no retry needed
				return
			} else {
				c.metrics.ClientErrorResponses.Add(1)

				berr := behavior.OnError(req, &resp)
				if berr != nil {
					log.Printf("Error evaluating client behavior: %v", berr)
				}

				shouldRetry, retryDelayMs, berr = behavior.OnRetry(req, &resp, nil)
				if berr != nil {
					log.Printf("Error evaluating client behavior: %v", berr)
				}
			}
		} else {
			c.metrics.NetworkFailedRequests.Add(1)

			berr := behavior.OnFail(req, err)
			if berr != nil {
				log.Printf("Error evaluating client behavior: %v", berr)
			}

			shouldRetry, retryDelayMs, berr = behavior.OnRetry(req, nil, err)
			if berr != nil {
				log.Printf("Error evaluating client behavior: %v", berr)
			}
		}

		// Handle retry - exceptional case that requires another attempt
		if shouldRetry {
			// Apply retry delay if specified
			if retryDelayMs > 0 {
				err := SleepWithContext(c.ctx, time.Duration(retryDelayMs)*time.Millisecond)
				if err != nil {
					return // Context canceled, cancel scheduled retry
				}
			}

			isRetry = true
			continue // Retry the request (exceptional case)
		}

		// Normal completion - request finished successfully or no retry needed
		break
	}
}

// sendRequest sends a request and waits for a response up to the client's requestTimeout
func (c *Client) sendRequest(req *Request, timeout time.Duration) (Response, error) {
	resultCh := make(chan struct {
		resp Response
		err  error
	}, 1)

	go func() {
		resp, err := c.network.Send(c.ctx, *req)
		resultCh <- struct {
			resp Response
			err  error
		}{resp, err}
	}()

	if timeout > 0 {
		select {
		case res := <-resultCh:
			return res.resp, res.err
		case <-c.ctx.Done():
			return Response{}, c.ctx.Err()
		case <-time.After(timeout):
			return Response{}, fmt.Errorf("client request timed")
		}
	} else {
		select {
		case res := <-resultCh:
			return res.resp, res.err
		case <-c.ctx.Done():
			return Response{}, c.ctx.Err()
		}
	}
}
