package simulation

import (
	"fmt"
	"log"
	"math"
	"math/rand"
	"strings"
	"time"
	"unsafe"

	"go.starlark.net/starlark"
	"go.starlark.net/syntax"
)

type ClientBehavior interface {
	OnRequest(req *Request) (allow bool, delayMs int, timeoutMs int, err error)
	OnResponse(req *Request, resp *Response) error
	OnError(req *Request, resp *Response) error
	OnFail(req *Request, rerr error) error
	OnRetry(req *Request, resp *Response, rerr error) (allow bool, delayMs int, err error)
	Close()
}

type executionType int

const (
	execOnRequest executionType = iota
	execOnResponse
	execOnError
	execOnFail
	execOnRetry
)

type scriptExecution struct {
	execType executionType
	req      *Request
	resp     *Response
	err      error
	resultCh chan scriptResult
}

// Generic result that can hold different return types
type scriptResult struct {
	allow     bool
	delayMs   int
	timeoutMs int
	err       error
}

// StarlarkClientBehavior allows client behavior to be defined by a Starlark script
type StarlarkClientBehavior struct {
	globals    starlark.StringDict
	setState   starlark.Callable
	onRequest  starlark.Callable
	onResponse starlark.Callable
	onError    starlark.Callable
	onFail     starlark.Callable
	onRetry    starlark.Callable

	executionChan chan *scriptExecution
	stopChan      chan struct{}
}

const randSourceLocalKey = "starlark_random_source"
const threadStateKey = "starlark_thread_state"

var (
	globalStarlarkBuiltins = starlark.StringDict{
		"get_state": starlark.NewBuiltin("get_state", starlarkState),
		"now":       starlark.NewBuiltin("now", starlarkNow),
		"pow":       starlark.NewBuiltin("pow", starlarkPow),
		"print":     starlark.NewBuiltin("print", starlarkPrint),
		"round":     starlark.NewBuiltin("round", starlarkRound),
		"random":    starlark.NewBuiltin("random", starlarkRandom),
	}
)

// NewStarlarkClientBehavior loads the Starlark script and extracts handler functions
func NewStarlarkClientBehavior(script string) (*StarlarkClientBehavior, error) {
	thread := &starlark.Thread{Name: "compiler"}
	options := &syntax.FileOptions{}

	globals, err := starlark.ExecFileOptions(options, thread, "client_behavior.star", script, globalStarlarkBuiltins)
	if err != nil {
		return nil, fmt.Errorf("starlark script error: %v", err)
	}

	getFn := func(name string) starlark.Callable {
		if fn, ok := globals[name]; ok {
			if fn, ok := fn.(starlark.Callable); ok {
				return fn
			}
		}
		return nil
	}

	behavior := &StarlarkClientBehavior{
		globals:       globals,
		setState:      getFn("set_state"),
		onRequest:     getFn("on_request"),
		onResponse:    getFn("on_response"),
		onError:       getFn("on_error"),
		onFail:        getFn("on_fail"),
		onRetry:       getFn("on_retry"),
		executionChan: make(chan *scriptExecution, 10000), // Buffer for requests
		stopChan:      make(chan struct{}),
	}

	// Start the single executor goroutine
	go behavior.scriptExecutor()

	return behavior, nil
}

func (b *StarlarkClientBehavior) scriptExecutor() {
	thread := &starlark.Thread{Name: "executor"}

	// init "global" / thread local state for the script
	if b.setState != nil {
		stateValue, err := starlark.Call(thread, b.setState, nil, nil)
		if err != nil {
			log.Printf("set_state error: %v\n", err)
		} else {
			thread.SetLocal(threadStateKey, stateValue)
			// log.Printf("Initial state stored in thread local: %v\n", stateValue)
		}
	}

	for {
		select {
		case exec := <-b.executionChan:
			result := b.executeFunction(thread, exec)
			exec.resultCh <- result

		case <-b.stopChan:
			return
		}
	}
}

func (b *StarlarkClientBehavior) executeFunction(thread *starlark.Thread, exec *scriptExecution) scriptResult {
	var result scriptResult

	switch exec.execType {
	case execOnRequest:
		if b.onRequest == nil {
			result.allow = true
			return result
		}

		reqDict := requestToDict(exec.req)
		args := starlark.Tuple{reqDict}
		starlarkResult, err := starlark.Call(thread, b.onRequest, args, nil)
		if err != nil {
			result.err = fmt.Errorf("on_request error: %v", err)
			return result
		}

		// Parse on_request specific result
		result.allow, result.delayMs, result.timeoutMs = parseOnRequestResult(starlarkResult)
		updateRequestFromDict(exec.req, reqDict)

	case execOnResponse:
		if b.onResponse == nil {
			return result
		}

		respDict := responseToDict(exec.resp)
		reqDict := requestToDict(exec.req)
		args := starlark.Tuple{reqDict, respDict}
		_, err := starlark.Call(thread, b.onResponse, args, nil)
		if err != nil {
			result.err = fmt.Errorf("on_response error: %v", err)
			return result
		}

		updateRequestFromDict(exec.req, reqDict)

	case execOnError:
		if b.onError == nil {
			return result
		}

		reqDict := requestToDict(exec.req)
		respDict := responseToDict(exec.resp)
		args := starlark.Tuple{reqDict, respDict}
		_, err := starlark.Call(thread, b.onError, args, nil)
		if err != nil {
			result.err = fmt.Errorf("on_error error: %v", err)
			return result
		}

		updateRequestFromDict(exec.req, reqDict)

	case execOnFail:
		if b.onFail == nil {
			return result
		}

		reqDict := requestToDict(exec.req)
		errValue := errorToValue(exec.err)
		args := starlark.Tuple{reqDict, errValue}
		_, err := starlark.Call(thread, b.onFail, args, nil)
		if err != nil {
			result.err = fmt.Errorf("on_fail error: %v", err)
			return result
		}

		updateRequestFromDict(exec.req, reqDict)

	case execOnRetry:
		if b.onRetry == nil {
			return result
		}

		reqDict := requestToDict(exec.req)
		respDict := responseToDict(exec.resp)
		errValue := errorToValue(exec.err)
		args := starlark.Tuple{reqDict, respDict, errValue}
		starlarkResult, err := starlark.Call(thread, b.onRetry, args, nil)
		if err != nil {
			result.err = fmt.Errorf("on_retry error: %v", err)
			return result
		}

		// Parse on_request specific result
		result.allow, result.delayMs, _ = parseOnRequestResult(starlarkResult)
		updateRequestFromDict(exec.req, reqDict)
	}

	return result
}

func (b *StarlarkClientBehavior) Close() {
	close(b.stopChan)
}

// Call `on_request` hook
func (b *StarlarkClientBehavior) OnRequest(req *Request) (allow bool, delayMs int, timeoutMs int, err error) {
	resultCh := make(chan scriptResult, 1)
	exec := &scriptExecution{
		execType: execOnRequest,
		req:      req,
		resultCh: resultCh,
	}

	select {
	case b.executionChan <- exec:
		// Successfully queued
	case <-b.stopChan:
		return false, 0, 0, nil // fmt.Errorf("execution cancelled during shutdown")
	}

	select {
	case result := <-resultCh:
		return result.allow, result.delayMs, result.timeoutMs, result.err
	case <-b.stopChan:
		return false, 0, 0, nil // fmt.Errorf("execution cancelled during shutdown")
	}
}

// Call `on_response` hook
func (b *StarlarkClientBehavior) OnResponse(req *Request, resp *Response) error {
	resultCh := make(chan scriptResult, 1)
	exec := &scriptExecution{
		execType: execOnResponse,
		req:      req,
		resp:     resp,
		resultCh: resultCh,
	}

	select {
	case b.executionChan <- exec:
		// Successfully queued
	case <-b.stopChan:
		return nil // fmt.Errorf("execution cancelled during shutdown")
	}

	select {
	case result := <-resultCh:
		return result.err
	case <-b.stopChan:
		return nil // fmt.Errorf("execution cancelled during shutdown")
	}
}

// Call `on_error` hook
func (b *StarlarkClientBehavior) OnError(req *Request, resp *Response) error {
	resultCh := make(chan scriptResult, 1)
	exec := &scriptExecution{
		execType: execOnError,
		req:      req,
		resp:     resp,
		resultCh: resultCh,
	}

	select {
	case b.executionChan <- exec:
		// Successfully queued
	case <-b.stopChan:
		return nil // fmt.Errorf("execution cancelled during shutdown")
	}

	select {
	case result := <-resultCh:
		return result.err
	case <-b.stopChan:
		return nil // fmt.Errorf("execution cancelled during shutdown")
	}
}

// Call `on_fail` hook
func (b *StarlarkClientBehavior) OnFail(req *Request, rerr error) error {
	resultCh := make(chan scriptResult, 1)
	exec := &scriptExecution{
		execType: execOnFail,
		req:      req,
		err:      rerr,
		resultCh: resultCh,
	}

	select {
	case b.executionChan <- exec:
		// Successfully queued
	case <-b.stopChan:
		return nil // fmt.Errorf("execution cancelled during shutdown")
	}

	select {
	case result := <-resultCh:
		return result.err
	case <-b.stopChan:
		return nil // fmt.Errorf("execution cancelled during shutdown")
	}
}

// Call `retry` hook
func (b *StarlarkClientBehavior) OnRetry(req *Request, resp *Response, rerr error) (allow bool, delayMs int, err error) {
	resultCh := make(chan scriptResult, 1)
	exec := &scriptExecution{
		execType: execOnRetry,
		req:      req,
		resp:     resp,
		err:      rerr,
		resultCh: resultCh,
	}

	select {
	case b.executionChan <- exec:
		// Successfully queued
	case <-b.stopChan:
		return false, 0, nil // fmt.Errorf("execution cancelled during shutdown")
	}

	select {
	case result := <-resultCh:
		return result.allow, result.delayMs, result.err
	case <-b.stopChan:
		return false, 0, nil // fmt.Errorf("execution cancelled during shutdown")
	}
}

//
// Predeclared
//

// Go built-in function to retrieve the mutable state dict for the current thread
func starlarkState(thread *starlark.Thread, fn *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
	if args.Len() != 0 || len(kwargs) != 0 {
		return nil, fmt.Errorf("%s() takes no arguments", fn.Name())
	}

	state, ok := thread.Local(threadStateKey).(starlark.Value)
	if !ok || state == nil {
		return starlark.None, nil
	}

	return state, nil
}

// Create a function to get current timestamp
func starlarkNow(thread *starlark.Thread, fn *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
	return starlark.Float(float64(time.Now().UnixMilli())), nil // milliseconds
}

// starlarkPow implements pow(base, exponent) function
func starlarkPow(thread *starlark.Thread, fn *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
	if args.Len() != 2 {
		return nil, fmt.Errorf("pow() takes exactly 2 arguments (%d given)", args.Len())
	}

	// Convert base to float64
	var base float64
	switch v := args[0].(type) {
	case starlark.Int:
		if i, ok := v.Int64(); ok {
			base = float64(i)
		} else {
			return nil, fmt.Errorf("pow: base integer too large")
		}
	case starlark.Float:
		base = float64(v)
	default:
		return nil, fmt.Errorf("pow: base must be int or float, got %s", v.Type())
	}

	// Convert exponent to float64
	var exponent float64
	switch v := args[1].(type) {
	case starlark.Int:
		if i, ok := v.Int64(); ok {
			exponent = float64(i)
		} else {
			return nil, fmt.Errorf("pow: exponent integer too large")
		}
	case starlark.Float:
		exponent = float64(v)
	default:
		return nil, fmt.Errorf("pow: exponent must be int or float, got %s", v.Type())
	}

	result := math.Pow(base, exponent)
	return starlark.Float(result), nil
}

// Create a print function
func starlarkPrint(thread *starlark.Thread, fn *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
	var parts []string
	for _, arg := range args {
		if str, ok := arg.(starlark.String); ok {
			parts = append(parts, string(str))
		} else {
			parts = append(parts, arg.String())
		}
	}
	fmt.Println(strings.Join(parts, " "))
	return starlark.None, nil
}

// Creates a round function
// - round(number, ndigits=None) -> float or int
// - If ndigits is omitted or None, returns the nearest integer as an int
// - If ndigits is provided, returns a float rounded to ndigits decimal places
func starlarkRound(thread *starlark.Thread, b *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
	var number starlark.Value
	var ndigits starlark.Value = starlark.None

	// Parse arguments: round(number, ndigits=None)
	if err := starlark.UnpackArgs(b.Name(), args, kwargs, "number", &number, "ndigits?", &ndigits); err != nil {
		return nil, err
	}

	// Convert number to float64
	var num float64
	switch v := number.(type) {
	case starlark.Int:
		// Convert starlark.Int to int64, then to float64
		if i, ok := v.Int64(); ok {
			num = float64(i)
		} else {
			// Handle big integers by converting to string and parsing
			return nil, fmt.Errorf("round: integer too large")
		}
	case starlark.Float:
		num = float64(v)
	default:
		return nil, fmt.Errorf("round: expected int or float, got %s", number.Type())
	}

	// Handle ndigits parameter
	if ndigits == starlark.None {
		// Round to nearest integer using Python's "round half to even" and return as int
		rounded := roundHalfToEven(num)
		return starlark.MakeInt64(int64(rounded)), nil
	}

	// ndigits is provided, convert to integer
	var digits int64
	switch v := ndigits.(type) {
	case starlark.Int:
		var ok bool
		digits, ok = v.Int64()
		if !ok {
			return nil, fmt.Errorf("round: ndigits too large")
		}
	default:
		return nil, fmt.Errorf("round: ndigits must be an integer, got %s", ndigits.Type())
	}

	// Round to specified decimal places using Python's rounding
	if digits < 0 {
		// Negative ndigits: round to nearest 10, 100, 1000, etc.
		factor := math.Pow(10, -float64(digits))
		rounded := roundHalfToEven(num/factor) * factor
		return starlark.Float(rounded), nil
	} else {
		// Positive ndigits: round to decimal places
		factor := math.Pow(10, float64(digits))
		rounded := roundHalfToEven(num*factor) / factor
		return starlark.Float(rounded), nil
	}
}

// starlarkRandom generates a random float between 0.0 (inclusive) and 1.0 (exclusive)
func starlarkRandom(thread *starlark.Thread, fn *starlark.Builtin, args starlark.Tuple, kwargs []starlark.Tuple) (starlark.Value, error) {
	// Get or create the *rand.Rand instance for this Starlark thread
	randInst, ok := thread.Local(randSourceLocalKey).(*rand.Rand)
	if !ok {
		// Create a new thread-local random generator
		// With thread pointer as jitter to the seed to handle rapid thread creation
		seed := time.Now().UnixNano() + int64(uintptr(unsafe.Pointer(thread)))
		randInst = rand.New(rand.NewSource(seed))
		thread.SetLocal(randSourceLocalKey, randInst)
	}

	return starlark.Float(randInst.Float64()), nil
}

//
// Helpers
//

// roundHalfToEven implements Python's "banker's rounding" behavior
// This rounds to the nearest integer, with ties going to the nearest even number
func roundHalfToEven(x float64) float64 {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return x
	}

	// Get the integer and fractional parts
	integer := math.Trunc(x)
	fraction := x - integer

	// Check if we're exactly at 0.5
	if math.Abs(fraction) == 0.5 {
		// Round to even: if integer part is even, round down; if odd, round up
		if math.Mod(math.Abs(integer), 2) == 0 {
			// Even integer part - round toward zero
			return integer
		} else {
			// Odd integer part - round away from zero
			if x > 0 {
				return integer + 1
			} else {
				return integer - 1
			}
		}
	}

	// Not exactly 0.5, use normal rounding
	return math.Round(x)
}

func parseOnRequestResult(result starlark.Value) (allow bool, delayMs int, timeoutMs int) {
	allow = true
	delayMs = 0
	timeoutMs = 0

	if dict, ok := result.(*starlark.Dict); ok {
		if v, found, _ := dict.Get(starlark.String("allow")); found {
			allow = v.Truth() == starlark.True
		}
		if v, found, _ := dict.Get(starlark.String("delay")); found {
			if i, error := starlark.AsInt32(v); error == nil {
				delayMs = i
			}
		}
		if v, found, _ := dict.Get(starlark.String("timeout")); found {
			if i, error := starlark.AsInt32(v); error == nil {
				timeoutMs = i
			}
		}
	}

	return allow, delayMs, timeoutMs
}

// requestToDict helper converts Go Request to Starlark dict
func requestToDict(req *Request) *starlark.Dict {
	if req == nil {
		return starlark.NewDict(0)
	}
	d := starlark.NewDict(5)
	d.SetKey(starlark.String("id"), starlark.String(req.Id))
	d.SetKey(starlark.String("client_id"), starlark.String(req.ClientId))
	d.SetKey(starlark.String("data"), starlark.String(req.Data))
	d.SetKey(starlark.String("timestamp"), starlark.Float(float64(req.Timestamp.UnixNano())/1e6))
	d.SetKey(starlark.String("meta"), req.Meta)
	return d
}

// responseToDict helper converts Go Response to Starlark dict
func responseToDict(resp *Response) *starlark.Dict {
	if resp == nil {
		return starlark.NewDict(0)
	}
	d := starlark.NewDict(5)
	d.SetKey(starlark.String("id"), starlark.String(resp.Id))
	d.SetKey(starlark.String("ok"), starlark.Bool(resp.Ok))
	d.SetKey(starlark.String("data"), starlark.String(resp.Data))
	d.SetKey(starlark.String("error"), starlark.String(resp.Error))
	d.SetKey(starlark.String("timestamp"), starlark.Float(float64(resp.Timestamp.UnixNano())/1e6))
	return d
}

// errorToValue helper converts error to Starlark string
func errorToValue(err error) starlark.Value {
	if err == nil {
		return starlark.None
	}
	return starlark.String(err.Error())
}

// updateRequestFromDict helper updates Go Request from Starlark dict (metadata)
func updateRequestFromDict(req *Request, dict *starlark.Dict) {
	if value, found, _ := dict.Get(starlark.String("meta")); found {
		if meta, ok := value.(*starlark.Dict); ok {
			req.Meta = meta
		}
	}
}

//
// NoopClientBehavior
//

type NoopClientBehavior struct{}

func NewNoopClientBehavior() *NoopClientBehavior {
	return &NoopClientBehavior{}
}

func (b *NoopClientBehavior) OnRequest(req *Request) (allow bool, delayMs int, timeoutMs int, err error) {
	return true, 0, 0, nil
}

func (b *NoopClientBehavior) OnResponse(req *Request, resp *Response) error {
	return nil
}

func (b *NoopClientBehavior) OnError(req *Request, resp *Response) error {
	return nil
}

func (b *NoopClientBehavior) OnFail(req *Request, rerr error) error {
	return nil
}

func (b *NoopClientBehavior) OnRetry(req *Request, resp *Response, rerr error) (allow bool, delayMs int, err error) {
	return false, 0, nil
}

func (b *NoopClientBehavior) Close() {}
